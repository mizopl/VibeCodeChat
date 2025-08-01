export type ParsingLevel = 'full' | 'summary' | 'tiny' | 'minimal';

export interface ParsedEntity {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  description?: string;
  score?: number;
  relevanceScore?: number;
  tags?: string[];
  metadata?: any;
  imageUrl?: string;
  entityType?: string;
  properties?: any;
}

export interface ParsedResponse {
  entities: ParsedEntity[];
  metadata: {
    parsingLevel: ParsingLevel;
    originalCount: number;
    parsedCount: number;
    tokenSavings?: number;
  };
}

export function parseQlooResponse(
  response: any, 
  parsingLevel: ParsingLevel = 'full'
): ParsedResponse {
  // Handle different Qloo API response structures:
  // 1. Insights API with signals: { data: { results: { entities: [...] } } }
  // 2. Insights API without signals: { data: { entities: [...] } }
  // 3. Entity Search API: { data: { results: [entity1, entity2, ...] } }
  // 4. GET Insights API: { results: { entities: [...] } }
  // 5. GET Insights API: { results: [entity1, entity2, ...] }
  let entities: any[] = [];
  
  if (response?.data?.results?.entities) {
    // Insights API with signals (POST)
    entities = response.data.results.entities;
  } else if (response?.data?.entities) {
    // Insights API without signals (POST) - THIS IS THE CURRENT CASE
    entities = response.data.entities;
  } else if (response?.data?.results && Array.isArray(response.data.results)) {
    // Entity Search API - results is an array of entities
    entities = response.data.results;
  } else if (response?.results?.entities) {
    // GET Insights API with signals
    entities = response.results.entities;
  } else if (response?.results && Array.isArray(response.results)) {
    // GET Insights API - results is an array of entities
    entities = response.results;
  }
  
  const originalCount = entities.length;
  
  console.log('🔍 Parser debug:', {
    hasResponse: !!response,
    hasResults: !!(response && response.results),
    hasData: !!(response && response.data),
    hasDataResults: !!(response && response.data && response.data.results),
    hasDataEntities: !!(response && response.data && response.data.entities),
    isResultsArray: !!(response?.data?.results && Array.isArray(response.data.results)),
    hasResultsEntities: !!(response && response.results && response.results.entities),
    isResultsArrayDirect: !!(response?.results && Array.isArray(response.results)),
    entityCount: entities.length,
    responseKeys: response ? Object.keys(response) : [],
    dataKeys: response?.data ? Object.keys(response.data) : [],
    resultsKeys: response?.results ? Object.keys(response.results) : []
  });
  
  let parsedEntities: ParsedEntity[] = [];
  
  // Entity-specific parsing for optimal token usage
  parsedEntities = entities.map((entity: any, index: number) => {
    // Log the first entity structure for debugging
    if (index === 0) {
      console.log('🔍 First entity structure:', {
        keys: Object.keys(entity),
        type: entity.type,
        entity_type: entity.entity_type,
        entityType: entity.entityType,
        hasProperties: !!entity.properties,
        propertiesKeys: entity.properties ? Object.keys(entity.properties) : [],
        properties: entity.properties
      });
    }
    
    // Extract image URL from various possible locations
    const imageUrl = entity.properties?.image?.url || 
                    entity.properties?.image_url || 
                    entity.image?.url || 
                    entity.external?.image_url ||
                    entity.metadata?.image_url;
    
    // Extract entity type for better categorization
    let entityType = entity.type || entity.entity_type || entity.entityType || 'unknown';
    
    // If the type is just "urn:entity", try to determine the proper type from context
    if (entityType === 'urn:entity' || entityType === 'unknown') {
      // Try to determine type from entity properties or context
      if (entity.properties?.cuisine || entity.properties?.address || 
          entity.name?.toLowerCase().includes('park') || 
          entity.name?.toLowerCase().includes('museum') ||
          entity.name?.toLowerCase().includes('store') ||
          entity.name?.toLowerCase().includes('cafe') ||
          entity.name?.toLowerCase().includes('restaurant')) {
        entityType = 'urn:entity:place';
      } else if (entity.properties?.genre || entity.properties?.director || 
                 entity.name?.toLowerCase().includes('movie') ||
                 entity.name?.toLowerCase().includes('film')) {
        entityType = 'urn:entity:movie';
      } else if (entity.properties?.artist || entity.properties?.album ||
                 entity.name?.toLowerCase().includes('artist') ||
                 entity.name?.toLowerCase().includes('band')) {
        entityType = 'urn:entity:artist';
      } else if (entity.properties?.author || entity.properties?.book ||
                 entity.name?.toLowerCase().includes('book')) {
        entityType = 'urn:entity:book';
      } else if (entity.properties?.brand || entity.properties?.company ||
                 entity.name?.toLowerCase().includes('brand') ||
                 entity.name?.toLowerCase().includes('company')) {
        entityType = 'urn:entity:brand';
      }
    }
    
    // Extract rich properties
    const properties = {
      description: entity.properties?.description || entity.description,
      address: entity.properties?.address || entity.address,
      phone: entity.properties?.phone || entity.phone,
      website: entity.properties?.website || entity.website,
      rating: entity.properties?.rating || entity.rating,
      price_range: entity.properties?.price_range || entity.price_range,
      cuisine: entity.properties?.cuisine || entity.cuisine,
      genre: entity.properties?.genre || entity.genre,
      director: entity.properties?.director || entity.director,
      release_year: entity.properties?.release_year || entity.release_year,
      runtime: entity.properties?.runtime || entity.runtime,
      cast: entity.properties?.cast || entity.cast,
      // Add Qloo-specific properties
      filming_location: entity.properties?.filming_location,
      production_companies: entity.properties?.production_companies,
      release_country: entity.properties?.release_country,
      short_descriptions: entity.properties?.short_descriptions,
      ...entity.properties
    };

    const baseEntity = {
      id: entity.entity_id || entity.id, // Use entity_id from API response
      name: entity.name,
      type: entityType, // Use the detected entity type instead of the original
      subtype: entity.subtype,
      entityType: entityType,
      imageUrl: imageUrl,
      properties: properties
    };

    switch (parsingLevel) {
      case 'full':
        return {
          ...baseEntity,
          description: properties.description,
          score: entity.query?.affinity || entity.score,
          relevanceScore: entity.relevanceScore,
          tags: entity.tags?.map((tag: any) => tag.name).slice(0, 5), // Extract tag names
          metadata: {
            // Include rich metadata from API response
            properties: properties,
            image: imageUrl,
            external: entity.external,
            popularity: entity.popularity,
            disambiguation: entity.disambiguation,
            fullEntity: entity // Store the complete entity for database
          }
        };
        
      case 'summary':
        return {
          ...baseEntity,
          description: properties.description ? 
            properties.description.substring(0, 200) + (properties.description.length > 200 ? '...' : '') : 
            undefined,
          score: entity.query?.affinity || entity.score,
          relevanceScore: entity.relevanceScore,
          tags: entity.tags?.map((tag: any) => tag.name).slice(0, 3)
        };
        
      case 'tiny':
        return {
          ...baseEntity,
          description: properties.description ? 
            properties.description.substring(0, 100) + (properties.description.length > 100 ? '...' : '') : 
            undefined,
          score: entity.query?.affinity || entity.score
        };
        
      case 'minimal':
      default:
        return {
          ...baseEntity,
          description: properties.description?.substring(0, 50) || undefined
        };
    }
  });
  
  // Less aggressive limiting - allow more entities for better user experience
  const responseSize = JSON.stringify(response).length;
  let finalEntities = parsedEntities;
  
  if (responseSize > 200000) { // Very large response
    finalEntities = parsedEntities.slice(0, 3);
  } else if (responseSize > 100000) { // Large response
    finalEntities = parsedEntities.slice(0, 5);
  } else if (responseSize > 50000) { // Medium response
    finalEntities = parsedEntities.slice(0, 8);
  } else {
    finalEntities = parsedEntities.slice(0, 10); // Allow up to 10 entities
  }
  
  console.log('🔍 Parser result:', {
    originalCount,
    parsedCount: finalEntities.length,
    finalEntityCount: finalEntities.length,
    responseSize,
    parsingLevel,
    entityNames: finalEntities.map(e => e.name)
  });
  
  return {
    entities: finalEntities,
    metadata: {
      parsingLevel,
      originalCount,
      parsedCount: finalEntities.length,
      tokenSavings: responseSize > 20000 ? 50 : 20
    }
  };
}

export function getParsingLevelFromIntent(userQuery: string): ParsingLevel {
  const query = userQuery.toLowerCase();
  
  // Intent detection for parsing level
  if (query.includes('just') || query.includes('only') || query.includes('list') || query.includes('names')) {
    return 'minimal';
  }
  
  if (query.includes('brief') || query.includes('short') || query.includes('quick')) {
    return 'tiny';
  }
  
  if (query.includes('detailed') || query.includes('full') || query.includes('complete')) {
    return 'full';
  }
  
  // Movie searches often return large responses - use minimal parsing
  if (query.includes('movie') || query.includes('film') || query.includes('cinema')) {
    return 'minimal';
  }
  
  // Brand searches can be large too
  if (query.includes('brand') || query.includes('company') || query.includes('product')) {
    return 'tiny';
  }
  
  // Default to summary for most queries
  return 'summary';
}

export function estimateTokenSavings(originalResponse: any, parsedResponse: ParsedResponse): {
  bytes: number;
  percentage: number;
  originalSize: number;
  parsedSize: number;
} {
  const originalSize = JSON.stringify(originalResponse).length;
  const parsedSize = JSON.stringify(parsedResponse).length;
  const savings = originalSize - parsedSize;
  const percentage = ((savings / originalSize) * 100).toFixed(1);
  
  return {
    bytes: savings,
    percentage: parseFloat(percentage),
    originalSize,
    parsedSize
  };
} 