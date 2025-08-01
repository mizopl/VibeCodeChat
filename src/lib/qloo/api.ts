import { config } from '@/lib/config';
import { 
  QlooParameters, 
  QlooInsightsResponse, 
  QlooEntityResponse, 
  QlooTagsResponse,
  QlooAgentError,
  ApiResponse 
} from '@/types';
import { trackApiCall, trackError } from '@/lib/utils/debug';
import { getDatabaseService } from '@/lib/database/database';
import { parseQlooResponse, ParsingLevel, getParsingLevelFromIntent } from './parser';
import { buildLocationFilter, extractLocationFromQuery } from './location';

// Base API call function with timeout and error handling
async function qlooApiCall<T>(
  endpoint: string,
  method: 'GET' | 'POST',
  body?: any,
  sessionId?: string,
  parsingLevel?: ParsingLevel,
  originalParams?: any
): Promise<ApiResponse<T>> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const url = `${config.qlooApiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'X-API-Key': config.qlooApiKey,
    };

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Qloo API Error Response:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url,
        body
      });
      const error = new QlooAgentError(
        `Qloo API error: ${response.status} ${response.statusText} - ${errorText}`,
        'API_ERROR',
        { status: response.status, errorText }
      );
      
      const duration = Date.now() - startTime;
      trackApiCall(`${method} ${endpoint}`, { url, headers, body }, duration, false, errorText);
      throw error;
    }

    const data = await response.json();
    const processingTime = Date.now() - startTime;

    // Parse response based on parsing level and size
    let parsedData;
    const responseSize = JSON.stringify(data).length;
    
    if (responseSize > 50000) {
      // Very large response - use minimal parsing
      parsedData = parseQlooResponse(data, 'minimal');
      console.log('📏 Large response detected, using minimal parsing:', responseSize, 'bytes');
    } else if (responseSize > 20000) {
      // Large response - use tiny parsing
      parsedData = parseQlooResponse(data, 'tiny');
      console.log('📏 Medium response detected, using tiny parsing:', responseSize, 'bytes');
    } else if (parsingLevel && parsingLevel !== 'full') {
      // Normal parsing based on level
      parsedData = parseQlooResponse(data, parsingLevel);
    } else {
      parsedData = data;
    }

    // Track successful API call
    trackApiCall(`${method} ${endpoint}`, { url, headers, body }, processingTime, true);

    // Log API call to database if session is available
    if (sessionId) {
      console.log('🔍 Attempting to log API call for session:', sessionId);
      try {
        // Use original parameters if provided, otherwise extract from URL
        let parameters = originalParams || body || {};
        if (!originalParams && method === 'GET' && url.includes('?')) {
          const urlParams = new URLSearchParams(url.split('?')[1]);
          parameters = Object.fromEntries(urlParams.entries());
        }
        
        await databaseService.logApiCall(
          sessionId,
          endpoint,
          method,
          parameters,
          data, // Store the full raw response
          response.status,
          processingTime
        );
        console.log('💾 Logged complete raw Qloo response to database');
      } catch (dbError) {
        console.error('❌ Failed to log API call to database:', dbError);
        console.error('❌ Error details:', dbError);
      }
    } else {
      console.log('⚠️ No sessionId provided, skipping API call logging');
    }

    return {
      success: true,
      data: parsedData,
      metadata: { processingTime, parsingLevel }
    };

  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof QlooAgentError) {
      const duration = Date.now() - startTime;
      trackApiCall(`${method} ${endpoint}`, { url: `${config.qlooApiUrl}${endpoint}` }, duration, false, error.message);
      throw error;
    }

    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new QlooAgentError(
        'Qloo API request timed out. Please try again.',
        'TIMEOUT_ERROR'
      );
      const duration = Date.now() - startTime;
      trackApiCall(`${method} ${endpoint}`, { url: `${config.qlooApiUrl}${endpoint}` }, duration, false, 'Timeout');
      throw timeoutError;
    }

    const networkError = new QlooAgentError(
      `Qloo API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'NETWORK_ERROR',
      { originalError: error }
    );
    const duration = Date.now() - startTime;
    trackApiCall(`${method} ${endpoint}`, { url: `${config.qlooApiUrl}${endpoint}` }, duration, false, error instanceof Error ? error.message : 'Unknown error');
    throw networkError;
  }
}

// GETINSIGHTS: Get personalized insights and recommendations
export async function getInsights(
  params: QlooParameters,
  sessionId?: string,
  parsingLevel?: ParsingLevel
): Promise<ApiResponse<QlooInsightsResponse>> {
  const endpoint = '/v2/insights';
  const method = 'GET';
  
  console.log('🔍 Calling Qloo Insights API with parameters:', params);
  
  // Build query parameters for GET request
  const queryParams = new URLSearchParams();
  
  // Add required parameters
  if (params.entityType) {
    queryParams.append('filter.type', params.entityType);
  }
  
  if (params.limit) {
    queryParams.append('take', params.limit.toString());
  } else {
    queryParams.append('take', '3');
  }
  
  if (params.query) {
    queryParams.append('reason', params.query);
  }
  
  if (params.explainability !== false) {
    queryParams.append('feature.explainability', 'true');
  }

  // Add location filter if provided
  if (params.location?.city) {
    queryParams.append('filter.location.query', params.location.city);
    console.log('📍 Using location filter:', params.location.city);
  }

  // Add signal entities if provided (these should be valid entity IDs)
  if (params.signalEntities && params.signalEntities.length > 0) {
    // Filter out any invalid entity IDs and format them properly
    const validEntityIds = params.signalEntities.filter((entityId: string) => 
      entityId && (entityId.startsWith('urn:entity:') || entityId.startsWith('E') || entityId.match(/^[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}$/i))
    );
    
    if (validEntityIds.length > 0) {
      // For GET requests, join entity IDs with commas
      queryParams.append('signal.interests.entities', validEntityIds.join(','));
      console.log('🎯 Using signal entities:', validEntityIds);
    } else {
      console.log('⚠️ No valid entity IDs found in signals');
    }
  }

  // Add signal tags if provided (these should be valid tag IDs)
  if (params.signalTags && params.signalTags.length > 0) {
    // Filter out any invalid tag IDs
    const validTagIds = params.signalTags.filter((tagId: string) => 
      tagId && tagId.startsWith('urn:tag:')
    );
    
    if (validTagIds.length > 0) {
      // For GET requests, join tag IDs with commas
      queryParams.append('signal.interests.tags', validTagIds.join(','));
      console.log('🎯 Using signal tags:', validTagIds);
    } else {
      console.log('⚠️ No valid tag IDs found in signals');
    }
  }

  // Add filter tags if provided (these are category filters like 'fashion', 'tech', etc.)
  if (params.filterTags && params.filterTags.length > 0) {
    // Join filter tags with commas
    queryParams.append('filter.tags', params.filterTags.join(','));
    console.log('🏷️ Using filter tags:', params.filterTags);
  }

  const startTime = Date.now();
  const fullEndpoint = `${endpoint}?${queryParams.toString()}`;
  
  try {
    // For GET requests, we pass the query string instead of a body
    const response = await qlooApiCall<QlooInsightsResponse>(fullEndpoint, method, undefined, sessionId, parsingLevel, params);
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Insights API response received in', processingTime, 'ms');
    
    // Store discovered entities if session is available
    if (sessionId && response.data && 'entities' in response.data && Array.isArray(response.data.entities)) {
      try {
        await databaseService.storeEntitiesFromResponse(
          sessionId, 
          response.data.entities, 
          'insights-api'
        );
        console.log('✅ Stored', response.data.entities.length, 'entities from insights');
      } catch (dbError) {
        console.error('❌ Failed to store entities from insights:', dbError);
      }
    }
    
    return response;
  } catch (error) {
    console.error('❌ Insights API error:', error);
    
    // Log the error to database if session is available
    if (sessionId) {
      try {
        await databaseService.logApiCall(
          sessionId,
          fullEndpoint,
          method,
          params,
          null,
          500,
          Date.now() - startTime,
          error instanceof Error ? error.message : String(error)
        );
      } catch (dbError) {
        console.error('❌ Failed to log API error to database:', dbError);
      }
    }
    
    throw error;
  }
}

// GETENTITY: Search for specific entities
export async function getEntity(
  params: QlooParameters,
  sessionId?: string,
  parsingLevel?: ParsingLevel
): Promise<ApiResponse<QlooEntityResponse>> {
  const endpoint = '/search';
  const method = 'GET';
  
  console.log('🔍 Calling Qloo Entity Search API with parameters:', params);
  
  // Ensure take is at least 2 (Qloo API requires > 1)
  const takeValue = Math.max(2, params.limit || 3);
  
  const queryParams = new URLSearchParams({
    query: params.query,
    take: takeValue.toString(),
  });

  if (params.entityType) {
    queryParams.append('filter.type', params.entityType);
  }

  // Add location filter if provided
  if (params.location?.city) {
    queryParams.append('filter.location.query', params.location.city);
  }

  const startTime = Date.now();
  const fullEndpoint = `${endpoint}?${queryParams.toString()}`;
  
  try {
    const response = await qlooApiCall<QlooEntityResponse>(fullEndpoint, method, undefined, sessionId, parsingLevel, params);
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Entity Search API response received in', processingTime, 'ms');
    
    // Store discovered entities if session is available
    if (sessionId && response.data && 'entities' in response.data && Array.isArray(response.data.entities)) {
      try {
        await databaseService.storeEntitiesFromResponse(
          sessionId, 
          response.data.entities, 
          'entity-search'
        );
        console.log('✅ Stored', response.data.entities.length, 'entities from search');
      } catch (dbError) {
        console.error('❌ Failed to store entities from search:', dbError);
      }
    }
    
    return response;
  } catch (error) {
    console.error('❌ Entity Search API error:', error);
    
    // Log the error to database if session is available
    if (sessionId) {
      try {
        await databaseService.logApiCall(
          sessionId,
          fullEndpoint,
          method,
          params,
          null,
          500,
          Date.now() - startTime,
          error instanceof Error ? error.message : String(error)
        );
      } catch (dbError) {
        console.error('❌ Failed to log API error to database:', dbError);
      }
    }
    
    throw error;
  }
}

// GETTAGS: Search for relevant tags
export async function getTags(
  params: QlooParameters,
  sessionId?: string,
  parsingLevel?: ParsingLevel
): Promise<ApiResponse<QlooTagsResponse>> {
  const {
    query,
    entityType,
    limit = config.defaultLimit
  } = params;

  const searchParams = new URLSearchParams({
    query: query,
    take: limit.toString(),
  });

  if (entityType) {
    searchParams.append('filter.parents.types', entityType);
  }

  return qlooApiCall<QlooTagsResponse>(`/v2/tags?${searchParams}`, 'GET', undefined, sessionId, parsingLevel);
}

// Enhanced tag search using the proper Tags Search API with typo tolerance
export async function searchTagsWithTolerance(
  keywords: string[],
  entityType?: string,
  limit: number = 10
): Promise<ApiResponse<QlooTagsResponse>> {
  console.log('🔍 Searching for tags with keywords:', keywords, 'entityType:', entityType);
  
  const allTags: string[] = [];
  const tagResults: any[] = [];
  
  for (const keyword of keywords) {
    try {
      const searchParams = new URLSearchParams({
        'filter.query': keyword,
        'feature.typo_tolerance': 'true',
        'take': Math.ceil(limit / keywords.length).toString(),
      });

      if (entityType) {
        searchParams.append('filter.parents.types', entityType);
      }

      const response = await qlooApiCall<QlooTagsResponse>(
        `/v2/tags?${searchParams}`, 
        'GET', 
        undefined, 
        undefined, 
        'summary'
      );

      if (response.data?.results) {
        console.log(`✅ Found ${response.data.results.length} tags for keyword "${keyword}"`);
        tagResults.push(...response.data.results);
        allTags.push(...response.data.results.map((tag: any) => tag.id));
      }
    } catch (error) {
      console.error(`❌ Error searching for tag "${keyword}":`, error);
    }
  }

  // Remove duplicates and limit results
  const uniqueTags = tagResults.filter((tag, index, self) => 
    index === self.findIndex(t => t.id === tag.id)
  ).slice(0, limit);

  console.log('🏷️ Total unique tags found:', uniqueTags.length);

  return {
    success: true,
    data: {
      results: uniqueTags
    },
    metadata: {
      processingTime: 0
    }
  };
}

// Enhanced search with fallback logic
export async function searchTagsEnhanced(
  query: string,
  entityType?: string,
  limit: number = 10
): Promise<ApiResponse<QlooTagsResponse>> {
  const startTime = Date.now();

  try {
    // Step 1: Try with specific entity type filter
    let results = await getTags({
      query,
      entityType: entityType as any,
      limit,
      targetAPI: 'GETTAGS'
    });

    // Step 2: If no results and entity type was specified, try broader search
    if (results.data?.results?.length === 0 && entityType) {
      const broaderResults = await getTags({
        query,
        limit: limit * 2,
        targetAPI: 'GETTAGS'
      });

      // Filter results manually for the entity type
      const fallbackQueries = getEntitySpecificFallbacks(entityType);
      let filteredResults = broaderResults.data?.results || [];

      if (fallbackQueries.length > 0) {
        filteredResults = filteredResults.filter((tag: any) => {
          const tagName = tag.name?.toLowerCase() || '';
          const tagType = tag.type?.toLowerCase() || '';

          return fallbackQueries.some(fallback =>
            tagName.includes(fallback.toLowerCase()) ||
            tagType.includes(fallback.toLowerCase())
          );
        });
      }

      results = {
        ...results,
        data: {
          ...results.data,
          results: filteredResults.slice(0, limit)
        }
      };
    }

    const processingTime = Date.now() - startTime;
    return {
      ...results,
      metadata: { ...results.metadata, processingTime }
    };

  } catch (error) {
    throw new QlooAgentError(
      `Enhanced tag search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'SEARCH_ERROR',
      { query, entityType, originalError: error }
    );
  }
}

// Helper function for entity-specific fallback queries
function getEntitySpecificFallbacks(entityType: string): string[] {
  const fallbacks: Record<string, string[]> = {
    'urn:entity:brand': ['brand', 'company', 'product', 'fashion', 'luxury', 'premium'],
    'urn:entity:place': ['restaurant', 'cafe', 'bar', 'hotel', 'museum', 'venue', 'location'],
    'urn:entity:movie': ['film', 'cinema', 'movie', 'action', 'comedy', 'drama'],
    'urn:entity:videogame': ['game', 'video game', 'gaming', 'rpg', 'fps', 'strategy'],
    'urn:entity:artist': ['musician', 'band', 'singer', 'rapper', 'rock', 'pop'],
    'urn:entity:book': ['book', 'novel', 'fiction', 'non-fiction', 'literature'],
  };

  return fallbacks[entityType] || [];
}

// Utility function to determine which API to call based on parameters
export function determineTargetAPI(params: QlooParameters): 'GETINSIGHTS' | 'GETENTITY' | 'GETTAGS' {
  const { targetAPI, query } = params;

  if (targetAPI) {
    return targetAPI;
  }

  // Auto-determine based on query characteristics
  const searchKeywords = ['find', 'search', 'look for', 'discover'];
  const recommendationKeywords = ['recommend', 'suggestion', 'similar', 'like', 'preference'];
  const tagKeywords = ['tags', 'categories', 'genres', 'types'];

  const queryLower = query.toLowerCase();

  if (tagKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'GETTAGS';
  }

  if (recommendationKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'GETINSIGHTS';
  }

  if (searchKeywords.some(keyword => queryLower.includes(keyword))) {
    return 'GETENTITY';
  }

  // Default to insights for general queries
  return 'GETINSIGHTS';
} 

// Get tag types for an entity type (step 1)
export async function getTagTypes(entityType: string): Promise<any> {
  try {
    const url = `https://hackathon.api.qloo.com/v2/tags/types`;
    const params = new URLSearchParams();
    if (entityType) { params.append('filter.parents.types', entityType); }
    
    console.log('🔑 Tag Types API Key check:', {
      hasKey: !!config.qlooApiKey,
      keyLength: config.qlooApiKey ? config.qlooApiKey.length : 0,
      keyPrefix: config.qlooApiKey ? config.qlooApiKey.substring(0, 10) + '...' : 'none',
      url: url,
      params: params.toString()
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-Api-Key': config.qlooApiKey
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new QlooAgentError(
        `Tag types search failed: ${response.status} ${response.statusText} - ${errorText}`,
        'API_ERROR',
        { status: response.status, errorText }
      );
    }
    const data = await response.json();
    console.log('🏷️ Tag types results:', data);
    return data;
  } catch (error) {
    console.error('🏷️ Tag types search error:', error);
    throw error;
  }
}

// Search for tags using the correct format (step 2)
export async function searchTags(query: string, entityType?: string): Promise<any> {
  try {
    const url = `https://hackathon.api.qloo.com/v2/tags`;
    const params = new URLSearchParams();
    if (query) { params.append('query', query); }
    if (entityType) { params.append('filter.parents.types', entityType); }
    
    console.log('🔑 Tags API Key check:', {
      hasKey: !!config.qlooApiKey,
      keyLength: config.qlooApiKey ? config.qlooApiKey.length : 0,
      keyPrefix: config.qlooApiKey ? config.qlooApiKey.substring(0, 10) + '...' : 'none',
      url: url,
      params: params.toString()
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-Api-Key': config.qlooApiKey
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new QlooAgentError(
        `Tags search failed: ${response.status} ${response.statusText} - ${errorText}`,
        'API_ERROR',
        { status: response.status, errorText }
      );
    }
    const data = await response.json();
    console.log('🏷️ Tags search results:', data);
    return data;
  } catch (error) {
    console.error('🏷️ Tags search error:', error);
    throw error;
  }
} 

// GETAUDIENCETYPES: Get available audience types
export async function getAudienceTypes(): Promise<ApiResponse<any>> {
  const endpoint = '/audience-types';
  const method = 'GET';
  
  console.log('🔍 Calling Qloo Audience Types API');
  
  const startTime = Date.now();
  
  try {
    const response = await qlooApiCall<any>(endpoint, method, undefined, undefined, 'minimal');
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Audience Types API response received in', processingTime, 'ms');
    
    return response;
  } catch (error) {
    console.error('❌ Audience Types API error:', error);
    throw error;
  }
}

// GETAUDIENCES: Get audiences for a specific parent type
export async function getAudiences(parentType: string): Promise<ApiResponse<any>> {
  const endpoint = '/audiences';
  const method = 'GET';
  
  console.log('🔍 Calling Qloo Audiences API with parent type:', parentType);
  
  const queryParams = new URLSearchParams({
    'filter.parents.types': parentType
  });
  
  const startTime = Date.now();
  
  try {
    const response = await qlooApiCall<any>(`${endpoint}?${queryParams.toString()}`, method, undefined, undefined, 'minimal');
    const processingTime = Date.now() - startTime;
    
    console.log('✅ Audiences API response received in', processingTime, 'ms');
    
    return response;
  } catch (error) {
    console.error('❌ Audiences API error:', error);
    throw error;
  }
}

// Get all available audience categories
export async function getAllAudienceCategories(): Promise<Record<string, any[]>> {
  const categories: Record<string, any[]> = {};
  
  const audienceTypes = [
    'urn:audience:communities',
    'urn:audience:global_issues',
    'urn:audience:hobbies_and_interests',
    'urn:audience:investing_interests',
    'urn:audience:leisure',
    'urn:audience:life_stage',
    'urn:audience:lifestyle_preferences_beliefs',
    'urn:audience:political_preferences',
    'urn:audience:professional_area',
    'urn:audience:spending_habits'
  ];
  
  for (const type of audienceTypes) {
    try {
      const response = await getAudiences(type);
      if (response.data && 'audiences' in response.data) {
        categories[type] = response.data.audiences || [];
      }
    } catch (error) {
      console.error(`❌ Failed to get audiences for ${type}:`, error);
      categories[type] = [];
    }
  }
  
  return categories;
}

// Get tag types from Qloo API
export async function getQlooTagTypes(): Promise<ApiResponse<any>> {
  return qlooApiCall<any>('/v2/tags/types', 'GET');
}

// Get tags from Qloo API
export async function getQlooTags(params: {
  tagType: string;
  query?: string;
  limit?: number;
}): Promise<ApiResponse<any>> {
  try {
    console.log('🔍 Calling Qloo Tags API with parameters:', params);
    
    const url = new URL(`${config.qlooApiUrl}/tags`);
    url.searchParams.append('tagType', params.tagType);
    if (params.query) url.searchParams.append('query', params.query);
    if (params.limit) url.searchParams.append('limit', params.limit.toString());

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'x-api-key': config.qlooApiKey,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Qloo API error: ${response.status} ${response.statusText} - ${JSON.stringify(data)}`);
    }

    console.log('✅ Tags API response received');
    return { success: true, data };
  } catch (error) {
    console.error('❌ Tags API call failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 

// Get demographics data from QLOO API
export async function getDemographics(entities: string[], tags?: string[]): Promise<ApiResponse<{ demographics: Array<{ entity_id: string; query: { age: Record<string, number>; gender: Record<string, number> } }> }>> {
  try {
    const params = new URLSearchParams();
    
    // Add filter for demographics
    params.append('filter.type', 'urn:demographics');
    
    // Add signal entities
    if (entities.length > 0) {
      params.append('signal.interests.entities', entities.join(','));
    }
    
    // Add signal tags
    if (tags && tags.length > 0) {
      params.append('signal.interests.tags', tags.join(','));
    }

    const response = await fetch(`${config.qlooApiUrl}/insights?${params.toString()}`, {
      headers: {
        'x-api-key': config.qlooApiKey,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    console.error('❌ Failed to fetch demographics:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
} 