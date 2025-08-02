import { google } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { z } from 'zod';
import { config, EntityType } from '@/lib/config';
import {
  QlooParameters,
  ParameterExtractionResult,
  AgentContext,
  QlooAgentError
} from '@/types';
import { determineTargetAPI } from '@/lib/qloo/api';
import { trackAgentActivity, trackError, trackTokenUsage } from '@/lib/utils/debug';
import { getDatabaseService } from '@/lib/database/database';
import { getParsingLevelFromIntent } from '@/lib/qloo/parser';
import { extractLocationFromQuery, buildLocationFilter } from '@/lib/qloo/location';
import { SignalTagSelector } from './signal-tag-selector';
import { ParameterEvaluator } from './parameter-evaluator';
import { EntityResolver } from './entity-resolver';
import { PersonaManager } from './persona-manager';

// Structured schema for Qloo parameter extraction
const QlooParameterSchema = z.object({
  parameters: z.object({
    query: z.string().describe('Main search term'),
    entityType: z.string().describe('Entity type URN'),
    reason: z.string().optional().describe('User intent'),
    location: z.object({
      city: z.string().optional(),
      country: z.string().optional()
    }).optional(),
    targetAPI: z.enum(['GETINSIGHTS', 'GETENTITY', 'GETTAGS']).default('GETINSIGHTS'),
    limit: z.number().min(1).max(10).default(3)
  }),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  extractedFields: z.array(z.string())
});

type QlooParameterExtraction = z.infer<typeof QlooParameterSchema>;

// QLOO AGENT: Parameter Extractor
export class QlooAgent {
  private context: AgentContext;
  private sessionId?: string;
  private tagSelector: SignalTagSelector;
  private parameterEvaluator: ParameterEvaluator;
  private entityResolver: EntityResolver;
  private personaManager: PersonaManager;

  constructor(context: AgentContext = {}) {
    this.context = context;
    this.tagSelector = new SignalTagSelector();
    this.parameterEvaluator = new ParameterEvaluator();
    this.entityResolver = new EntityResolver();
    this.personaManager = new PersonaManager();
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
    this.personaManager.setSessionId(sessionId);
  }

  // Main method to extract parameters from user query
  async extractParameters(userQuery: string): Promise<ParameterExtractionResult> {
    const startTime = Date.now();

    try {
      trackAgentActivity('QLOO AGENT', 'Starting parameter extraction', { userQuery });

      // Use rule-based extraction for now to avoid token limits
      const analysis = await this.ruleBasedExtraction(userQuery);
      
      // Step 2: Determine target API if not specified
      if (!analysis.parameters.targetAPI) {
        analysis.parameters.targetAPI = determineTargetAPI(analysis.parameters);
      }

      // Step 3: Enhance parameters with context
      const enhancedParams = await this.enhanceWithContext(analysis.parameters);
      
      // Step 4: Use proper Insights API workflow with entity resolution and persona signals
      if (enhancedParams.targetAPI === 'GETINSIGHTS') {
        console.log('🔍 Using Insights API with entity resolution and persona workflow');
        
        // Extract interests from conversation
        const extractedInterests = await this.personaManager.extractInterestsFromConversation(
          this.context.conversationHistory || []
        );
        
        // Generate signals from persona
        const personaSignals = await this.personaManager.generateSignals(enhancedParams.entityType);
        console.log('🎯 Persona signals for recommendations:', personaSignals);
        
        // Evaluate which parameters are relevant
        const insightsParams = await this.parameterEvaluator.evaluateParameters(
          userQuery, 
          enhancedParams.entityType || 'urn:entity:place'
        );
        
        // Combine persona signals with resolved entities
        const allEntityIds = [...personaSignals.entitySignals];
        
        // Add entity signals to parameters for better recommendations
        if (allEntityIds.length > 0) {
          enhancedParams.signalEntities = allEntityIds;
          console.log('🎯 Enhanced parameters with persona signals:', enhancedParams);
        }
        
        // Add tag signals to parameters
        if (personaSignals.tagSignals.length > 0) {
          enhancedParams.signalTags = personaSignals.tagSignals;
          console.log('🎯 Enhanced parameters with tag signals:', enhancedParams);
        }
        
        return {
          parameters: enhancedParams,
          confidence: analysis.confidence,
          reasoning: `Enhanced with ${personaSignals.entitySignals.length} persona signals and ${extractedInterests.length} new interests`,
          extractedFields: Object.keys(enhancedParams)
        };
      }

      const processingTime = Date.now() - startTime;

      // Log structured extraction to database if session is available
      if (this.sessionId) {
        try {
          const databaseService = getDatabaseService();
          await databaseService.logStructuredExtraction(
            this.sessionId,
            userQuery,
            enhancedParams,
            analysis.confidence,
            analysis.reasoning,
            analysis.extractedFields,
          );
        } catch (dbError) {
          console.error('❌ Failed to log structured extraction:', dbError);
        }
      }

      trackAgentActivity('QLOO AGENT', 'Parameter extraction completed', {
        parameters: enhancedParams,
        confidence: analysis.confidence,
        processingTime,
      }, processingTime);

      return {
        parameters: enhancedParams,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
        extractedFields: analysis.extractedFields,
      };

    } catch (error) {
      trackError(error as Error, { userQuery, agent: 'QLOO AGENT' });
      throw new QlooAgentError(
        `Parameter extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXTRACTION_ERROR',
        { userQuery, originalError: error }
      );
    }
  }

  // Analyze user query and extract parameters using structured data generation
  private async analyzeQuery(userQuery: string): Promise<{
    parameters: QlooParameters;
    confidence: number;
    reasoning: string;
    extractedFields: string[];
  }> {
    // Extract location information first
    const extractedLocation = extractLocationFromQuery(userQuery);
    const locationFilter = buildLocationFilter(extractedLocation);
    
    try {
      trackAgentActivity('QLOO AGENT', 'Starting structured parameter extraction', { userQuery });

      const { object } = await generateObject({
        model: google('gemini-2.5-flash'),
      // Configure Google AI with API key from localStorage
      configureGoogleAI();
        schema: QlooParameterSchema,
        schemaName: 'QlooParameterExtraction',
        schemaDescription: 'Extract parameters for Qloo API calls from user queries',
        prompt: this.buildStructuredAnalysisPrompt(userQuery),
        maxTokens: 500, // Reduced token limit
      });

      // Track token usage (if available in the result)
      if ('usage' in object && object.usage && typeof object.usage === 'object') {
        const usage = object.usage as { promptTokens?: number; completionTokens?: number; totalTokens?: number };
        trackTokenUsage({
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
          totalTokens: usage.totalTokens || 0,
        });
      }

      trackAgentActivity('QLOO AGENT', 'Structured parameter extraction completed', {
        extractedParameters: object.parameters,
        confidence: object.confidence,
        reasoning: object.reasoning,
      });

      // Log structured extraction to database if session is available
      if (this.sessionId) {
        try {
          const databaseService = getDatabaseService();
          await databaseService.logStructuredExtraction(
            this.sessionId,
            userQuery,
            object.parameters,
            object.confidence,
            object.reasoning,
            object.extractedFields,
          );
        } catch (dbError) {
          console.error('❌ Failed to log structured extraction:', dbError);
        }
      }

      return {
        parameters: object.parameters as QlooParameters,
        confidence: object.confidence,
        reasoning: object.reasoning,
        extractedFields: object.extractedFields,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      trackError(error as Error, { userQuery, method: 'analyzeQuery' });
      trackAgentActivity('QLOO AGENT', 'Falling back to basic extraction', { error: errorMessage });
      // Fallback to basic parameter extraction
      return this.fallbackExtraction(userQuery);
    }
  }

  // Build the structured analysis prompt for Gemini
  private buildStructuredAnalysisPrompt(userQuery: string): string {
    const personaContext = this.context.persona ? 
      `\nPERSONA CONTEXT:\n${JSON.stringify(this.context.persona, null, 2)}` : '';

    return `Extract Qloo API parameters from: "${userQuery}"

ENTITY TYPES: urn:entity:artist, urn:entity:book, urn:entity:brand, urn:entity:destination, urn:entity:movie, urn:entity:person, urn:entity:place, urn:entity:podcast, urn:entity:tv_show, urn:entity:video_game

EXAMPLES:
- "movies like The Matrix" → entityType: "urn:entity:movie", query: "The Matrix"
- "restaurants in London" → entityType: "urn:entity:place", query: "restaurant", location: {city: "London"}
- "brands like Nike" → entityType: "urn:entity:brand", query: "Nike"

Return structured parameters.`;
  }

  // Build the analysis prompt for Gemini (legacy method for fallback)
  private buildAnalysisPrompt(userQuery: string): string {
    const personaContext = this.context.persona ? 
      `\nPERSONA CONTEXT:\n${JSON.stringify(this.context.persona, null, 2)}` : '';

    return `You are an AI assistant that analyzes user queries and extracts optimal parameters for Qloo API calls.

${personaContext}

USER QUERY: "${userQuery}"

ANALYZE the query and return a JSON object with the following structure:

{
  "parameters": {
    "query": "main search term",
    "entityType": "urn:entity:place|brand|artist|movie|book|videogame|podcast|tvshow|destination|person",
    "reason": "why the user wants recommendations",
    "location": {
      "city": "city name if mentioned",
      "country": "country name if mentioned"
    },
    "filterTags": ["tag1", "tag2"],
    "excludeTags": ["tag to exclude"],
    "targetAPI": "GETINSIGHTS|GETENTITY|GETTAGS",
    "limit": 3,
    "explainability": true
  },
  "confidence": 0.85,
  "reasoning": "brief explanation of analysis",
  "extractedFields": ["query", "entityType", "location"]
}

GUIDELINES:
- Extract the main search query from the user's request
- Determine the appropriate entity type based on context
- Identify location information if mentioned
- Extract any specific tags or categories mentioned
- Determine if user wants recommendations (GETINSIGHTS), specific search (GETENTITY), or tags (GETTAGS)
- Set confidence based on how clear the parameters are
- Only include fields that are actually mentioned or can be reasonably inferred

Return ONLY valid JSON, no markdown formatting.`;
  }

  // Parse the analysis result from Gemini
  private parseAnalysisResult(resultText: string, userQuery: string): {
    parameters: QlooParameters;
    confidence: number;
    reasoning: string;
    extractedFields: string[];
  } {
    try {
      // Clean the response and extract JSON
      const cleanedText = resultText
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      // Validate and normalize parameters
      const parameters: QlooParameters = {
        query: parsed.parameters?.query || userQuery,
        entityType: parsed.parameters?.entityType,
        reason: parsed.parameters?.reason,
        location: parsed.parameters?.location,
        filterTags: parsed.parameters?.filterTags || [],
        excludeTags: parsed.parameters?.excludeTags || [],
        targetAPI: parsed.parameters?.targetAPI || 'GETINSIGHTS',
        limit: parsed.parameters?.limit || config.defaultLimit,
        explainability: parsed.parameters?.explainability !== false,
      };

      return {
        parameters,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'Default analysis',
        extractedFields: parsed.extractedFields || [],
      };

    } catch (error) {
      throw new Error(`Failed to parse analysis result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Fallback extraction when AI analysis fails
  private fallbackExtraction(userQuery: string): {
    parameters: QlooParameters;
    confidence: number;
    reasoning: string;
    extractedFields: string[];
  } {
    const queryLower = userQuery.toLowerCase();
    const extractedFields: string[] = ['query'];

    // Basic entity type detection
    let entityType: EntityType = config.defaultEntityType;
    if (queryLower.includes('brand') || queryLower.includes('company')) {
      entityType = 'urn:entity:brand' as EntityType;
      extractedFields.push('entityType');
    } else if (queryLower.includes('movie') || queryLower.includes('film')) {
      entityType = 'urn:entity:movie' as EntityType;
      extractedFields.push('entityType');
    } else if (queryLower.includes('artist') || queryLower.includes('musician')) {
      entityType = 'urn:entity:artist' as EntityType;
      extractedFields.push('entityType');
    }

    // Basic location detection
    const locationMatch = userQuery.match(/\b(in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    let location;
    if (locationMatch) {
      location = { city: locationMatch[2] };
      extractedFields.push('location');
    }

    // Basic API determination
    let targetAPI: 'GETINSIGHTS' | 'GETENTITY' | 'GETTAGS' = 'GETINSIGHTS';
    if (queryLower.includes('find') || queryLower.includes('search')) {
      targetAPI = 'GETENTITY';
    } else if (queryLower.includes('tag') || queryLower.includes('category')) {
      targetAPI = 'GETTAGS';
    }

    return {
      parameters: {
        query: userQuery,
        entityType,
        location,
        targetAPI,
        limit: config.defaultLimit,
        explainability: true,
      },
      confidence: 0.3,
      reasoning: 'Fallback extraction due to AI parsing failure - using basic rule-based analysis',
      extractedFields,
    };
  }

  // Enhance parameters with persona context
  private async enhanceWithContext(parameters: QlooParameters): Promise<QlooParameters> {
    const enhanced = { ...parameters };

    // Try to get persona data from database if not in context
    let personaData = this.context.persona;
    if (!personaData && this.sessionId) {
      try {
        const persona = await this.personaManager.getPersonaSummary();
        const personaDetails = await this.personaManager.getPersonaDetails();
        const storedInterests = await this.personaManager.getStoredInterests();
        
        // Always try to get persona details even if no interests
        if (personaDetails?.location) {
          console.log('📍 Found persona location:', personaDetails.location);
          personaData = {
            id: this.sessionId,
            interests: storedInterests.map(interest => interest.name),
            demographics: { 
              location: { 
                city: personaDetails.location, 
                country: personaDetails.location === 'Krakow' ? 'Poland' : 'United States' 
              } 
            }
          };
        } else if (persona && storedInterests.length > 0) {
          // Use persona's actual location or fallback to New York
          const defaultLocation = personaDetails?.location || 'New York';
          personaData = {
            id: this.sessionId,
            interests: storedInterests.map(interest => interest.name),
            demographics: { location: { city: defaultLocation, country: 'United States' } }
          };
        }
      } catch (error) {
        console.log('⚠️ Could not load persona data for context enhancement:', error);
      }
    }

    if (!personaData) {
      return enhanced;
    }

    // Add persona location if not specified
    if (!enhanced.location?.city && personaData.demographics?.location?.city) {
      enhanced.location = {
        city: personaData.demographics.location.city,
        country: personaData.demographics.location.country,
      };
      console.log('📍 Using persona location:', enhanced.location);
    } else if (enhanced.location?.city) {
      console.log('📍 Using existing location:', enhanced.location);
    } else {
      console.log('⚠️ No location specified in parameters or persona data');
      // Try to get location from persona details as fallback
      if (this.sessionId) {
        try {
          const personaDetails = await this.personaManager.getPersonaDetails();
          if (personaDetails?.location) {
            enhanced.location = {
              city: personaDetails.location,
              country: personaDetails.location === 'Krakow' ? 'Poland' : 
                      personaDetails.location === 'Berlin' ? 'Germany' : 'United States'
            };
            console.log('📍 Using fallback persona location:', enhanced.location);
          }
        } catch (error) {
          console.log('⚠️ Could not get fallback location:', error);
        }
      }
    }

    // Add persona interests as signal entities for better recommendations
    if (personaData.interests && personaData.interests.length > 0) {
      // Always include persona interests as signals for better personalization
      enhanced.signalEntities = [
        ...(enhanced.signalEntities || []),
        ...personaData.interests
      ];
      console.log('🎯 Using persona interests as signals:', personaData.interests);
    }

    // Add persona interests as filter tags if relevant to the query
    if (personaData.interests && personaData.interests.length > 0) {
      const relevantInterests = personaData.interests.filter(interest =>
        parameters.query.toLowerCase().includes(interest.toLowerCase())
      );
      
      if (relevantInterests.length > 0) {
        enhanced.filterTags = [
          ...(enhanced.filterTags || []),
          ...relevantInterests
        ];
        console.log('🏷️ Using relevant persona interests as filters:', relevantInterests);
      }
    }

    // Detect parsing level from user intent if not specified
    if (!enhanced.parsingLevel && enhanced.query) {
      enhanced.parsingLevel = getParsingLevelFromIntent(enhanced.query);
    }

    return enhanced;
  }

  // Update agent context
  updateContext(newContext: Partial<AgentContext>): void {
    this.context = { ...this.context, ...newContext };
  }

  // Get current context
  getContext(): AgentContext {
    return this.context;
  }

  // Rule-based extraction for reliable parameter extraction
  private async ruleBasedExtraction(userQuery: string): Promise<{
    parameters: QlooParameters;
    confidence: number;
    reasoning: string;
    extractedFields: string[];
  }> {
    const queryLower = userQuery.toLowerCase();
    const extractedFields: string[] = ['query'];

    // Enhanced entity type detection
    let entityType: EntityType = config.defaultEntityType;
    let filterTags: string[] = [];
    
    if (queryLower.includes('movie') || queryLower.includes('film') || queryLower.includes('cinema')) {
      entityType = 'urn:entity:movie' as EntityType;
      extractedFields.push('entityType');
      
      // Extract movie genres
      const movieGenres = ['action', 'comedy', 'drama', 'horror', 'romance', 'thriller', 'sci-fi', 'fantasy', 'documentary', 'animation'];
      const foundGenres = movieGenres.filter(genre => queryLower.includes(genre));
      if (foundGenres.length > 0) {
        filterTags = foundGenres;
        extractedFields.push('filterTags');
      }
    } else if (queryLower.includes('brand') || queryLower.includes('company') || queryLower.includes('product')) {
      entityType = 'urn:entity:brand' as EntityType;
      extractedFields.push('entityType');
      
      // Enhanced brand category detection with more specific keywords
      const brandCategories = [
        // Fashion & Footwear
        'fashion', 'clothing', 'apparel', 'wear', 'dress', 'outfit', 'style',
        'shoe', 'shoes', 'footwear', 'boot', 'boots', 'sneaker', 'sneakers', 'heel', 'heels',
        'sandals', 'sandal', 'loafers', 'loafer', 'oxford', 'oxfords', 'pump', 'pumps',
        'athletic', 'running', 'casual', 'formal', 'dress', 'dressy',
        
        // Sports & Fitness
        'sport', 'sports', 'fitness', 'athletic', 'gym', 'workout', 'exercise', 'training',
        'football', 'basketball', 'soccer', 'tennis', 'golf', 'swimming', 'cycling',
        'running', 'jogging', 'weightlifting', 'yoga', 'pilates', 'crossfit',
        
        // Tech & Digital
        'tech', 'technology', 'digital', 'software', 'app', 'application', 'platform',
        'streaming', 'video', 'movie', 'film', 'entertainment', 'media',
        
        // Food & Dining
        'food', 'restaurant', 'dining', 'cuisine', 'kitchen', 'cooking', 'chef',
        
        // Beauty & Personal Care
        'beauty', 'cosmetic', 'makeup', 'skincare', 'personal', 'care',
        
        // Automotive
        'automotive', 'car', 'vehicle', 'auto', 'motor', 'transport',
        
        // Luxury & Premium
        'luxury', 'premium', 'high-end', 'designer', 'exclusive', 'premium',
        
        // Home & Lifestyle
        'home', 'furniture', 'decor', 'lifestyle', 'living', 'household'
      ];
      
      const foundCategories = brandCategories.filter(category => queryLower.includes(category));
      if (foundCategories.length > 0) {
        // For brand queries, we need to be more specific about what we're looking for
        if (queryLower.includes('brand')) {
          // For sport brands, use specific brand categories that work better with Qloo
          if (foundCategories.some(cat => ['sport', 'sports', 'athletic', 'fitness'].includes(cat))) {
            filterTags = ['sports', 'athletic', 'fitness']; // Use specific brand categories
          } else {
            filterTags = foundCategories; // Use the found categories directly
          }
        } else {
          filterTags = foundCategories; // Use the found categories directly
        }
        extractedFields.push('filterTags');
      }
    } else if (queryLower.includes('artist') || queryLower.includes('musician') || queryLower.includes('band') || queryLower.includes('singer')) {
      entityType = 'urn:entity:artist' as EntityType;
      extractedFields.push('entityType');
      
      // Extract music genres
      const musicGenres = ['rock', 'pop', 'jazz', 'classical', 'hip-hop', 'country', 'electronic', 'blues'];
      const foundGenres = musicGenres.filter(genre => queryLower.includes(genre));
      if (foundGenres.length > 0) {
        filterTags = foundGenres;
        extractedFields.push('filterTags');
      }
    } else if (queryLower.includes('book') || queryLower.includes('novel') || queryLower.includes('literature')) {
      entityType = 'urn:entity:book' as EntityType;
      extractedFields.push('entityType');
      
      // Extract book genres
      const bookGenres = ['fiction', 'non-fiction', 'mystery', 'romance', 'fantasy', 'sci-fi', 'biography', 'history'];
      const foundGenres = bookGenres.filter(genre => queryLower.includes(genre));
      if (foundGenres.length > 0) {
        filterTags = foundGenres;
        extractedFields.push('filterTags');
      }
    } else if (queryLower.includes('restaurant') || queryLower.includes('cafe') || queryLower.includes('food') || queryLower.includes('pizza') || queryLower.includes('dining')) {
      entityType = 'urn:entity:place' as EntityType;
      extractedFields.push('entityType');
      
      // Extract cuisine types
      const cuisineTypes = ['italian', 'chinese', 'japanese', 'mexican', 'indian', 'french', 'thai', 'mediterranean'];
      const foundCuisines = cuisineTypes.filter(cuisine => queryLower.includes(cuisine));
      if (foundCuisines.length > 0) {
        filterTags = foundCuisines;
        extractedFields.push('filterTags');
      }
    } else if (queryLower.includes('destination') || queryLower.includes('travel') || queryLower.includes('city') || queryLower.includes('country')) {
      entityType = 'urn:entity:destination' as EntityType;
      extractedFields.push('entityType');
    } else if (queryLower.includes('person') || queryLower.includes('celebrity') || queryLower.includes('actor')) {
      entityType = 'urn:entity:person' as EntityType;
      extractedFields.push('entityType');
    } else if (queryLower.includes('podcast')) {
      entityType = 'urn:entity:podcast' as EntityType;
      extractedFields.push('entityType');
    } else if (queryLower.includes('tv') || queryLower.includes('show') || queryLower.includes('series')) {
      entityType = 'urn:entity:tv_show' as EntityType;
      extractedFields.push('entityType');
    } else if (queryLower.includes('game') || queryLower.includes('gaming') || queryLower.includes('video game')) {
      entityType = 'urn:entity:video_game' as EntityType;
      extractedFields.push('entityType');
    }

    // Enhanced location detection
    const locationMatch = userQuery.match(/\b(in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i);
    let location;
    if (locationMatch) {
      location = { city: locationMatch[2] };
      extractedFields.push('location');
      
      // Update persona location if sessionId is available
              if (this.sessionId) {
          try {
            const databaseService = getDatabaseService();
            await databaseService.updatePersona(this.sessionId, {
            location: locationMatch[2]
          });
          console.log('📍 Updated persona location to:', locationMatch[2]);
          
          // Also update the persona manager's session ID to ensure it has the latest data
          this.personaManager.setSessionId(this.sessionId);
          
          // Broadcast location update event
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('persona-location-updated', {
              detail: { location: locationMatch[2], sessionId: this.sessionId }
            }));
          }
        } catch (error) {
          console.log('⚠️ Failed to update persona location:', error);
        }
      }
    }

    // Enhanced API determination
    let targetAPI: 'GETINSIGHTS' | 'GETENTITY' | 'GETTAGS' = 'GETINSIGHTS';
    if (queryLower.includes('tag') || queryLower.includes('category') || queryLower.includes('genre')) {
      targetAPI = 'GETTAGS';
    } else if (queryLower.includes('like') || queryLower.includes('similar') || queryLower.includes('recommend') || 
               queryLower.includes('suggestion') || queryLower.includes('preference') || 
               (queryLower.includes('find') && (queryLower.includes('movie') || queryLower.includes('restaurant') || queryLower.includes('brand')))) {
      targetAPI = 'GETINSIGHTS';
    } else if (queryLower.includes('find') || queryLower.includes('search') || queryLower.includes('look for')) {
      targetAPI = 'GETENTITY';
    }

    // Extract main query term
    let query = userQuery;
    if (queryLower.includes('like')) {
      const likeMatch = userQuery.match(/like\s+([^,\s]+(?:\s+[^,\s]+)*)/i);
      if (likeMatch) {
        query = likeMatch[1];
      }
    }

    return {
      parameters: {
        query,
        entityType,
        location,
        targetAPI,
        limit: config.defaultLimit,
        explainability: true,
        filterTags: filterTags.length > 0 ? filterTags : undefined,
      },
      confidence: 0.8,
      reasoning: 'Rule-based extraction using keyword matching',
      extractedFields,
    };
  }
} 