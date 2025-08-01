import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { QlooAgent } from './qloo-agent';
import { QlooParameters, ApiResponse } from '../../types';
import { getInsights, getEntity, getTags } from '../qloo/api';
import { parseQlooResponse, ParsedResponse } from '../qloo/parser';
import { AgentContext, ChatMessage } from '../../types';
import { broadcastDebugMessage } from '../utils/debug';
import { PersonaManager, PersonalInterest } from './persona-manager';
import { getDatabaseService } from '../database/database';
import { ChatHistoryAgent } from './chat-history-agent';
import { EntityRetrievalTool } from './entity-retrieval-tool';
import { SignalTagSelector } from './signal-tag-selector';

export class MainAgent {
  private qlooAgent: QlooAgent;
  private personaManager: PersonaManager;
  private tagSelector: SignalTagSelector;
  private context: AgentContext;

  constructor(context: AgentContext = {}) {
    this.context = context;
    this.qlooAgent = new QlooAgent(context);
    this.personaManager = new PersonaManager();
    this.tagSelector = new SignalTagSelector();
  }

  async processQuery(
    userQuery: string,
    sessionId?: string,
    onStep?: (step: string, details: any) => void,
    messages?: ChatMessage[]
  ): Promise<string> {
    let parameters: QlooParameters | undefined;
    
    try {
      // Set session ID in agents
      if (sessionId) {
        console.log('🎯 Setting session ID in agents:', sessionId);
        this.qlooAgent.setSessionId(sessionId);
        this.personaManager.setSessionId(sessionId);
      }

      // Check if this is a new session and handle persona creation tutorial
      const isNewSession = this.context.isNewSession || (messages && messages.length <= 1);
      
      // Check if user has already provided persona information
      let hasPersonaInfo = false;
      if (sessionId) {
        try {
          const personaDetails = await this.personaManager.getPersonaDetails();
          const storedInterests = await this.personaManager.getStoredInterests();
          hasPersonaInfo = !!(personaDetails?.name || storedInterests.length > 0);
        } catch (error) {
          console.log('⚠️ Could not check persona info:', error);
        }
      }
      
      // Only do persona building if this is actually a new session AND the user hasn't provided their info yet
      if (isNewSession && sessionId && !hasPersonaInfo) {
        console.log('🎯 New session detected - starting persona creation tutorial');
        
        // Extract basic info from first message
        const nameLocationExtraction = await this.personaManager.extractFromMessage(userQuery);
        
        // Check if this is the very first message
        if (messages && messages.length === 1) {
        if (nameLocationExtraction.name) {
          console.log('✅ Extracted name from first message:', nameLocationExtraction.name);
            return this.getPersonaCreationTutorial(nameLocationExtraction.name, nameLocationExtraction.location);
          } else {
            return this.getInitialGreeting();
          }
        }
        
        // For subsequent messages in new session, continue persona building
        if (messages && messages.length <= 3) {
          return await this.handlePersonaBuilding(userQuery, messages);
        }
      }

      // Get persona data for context
      let personaContext = '';
      let personaData = null;
      if (sessionId) {
        try {
          const persona = await this.personaManager.getPersonaSummary();
          const storedInterests = await this.personaManager.getStoredInterests();
          const personaDetails = await this.personaManager.getPersonaDetails();
          
          if (persona && storedInterests.length > 0) {
            const interestsText = storedInterests.map((interest: PersonalInterest) => `${interest.name} (${interest.category})`).join(', ');
            
            // Enhanced persona context with structured data
            personaData = {
              interests: storedInterests,
              summary: persona,
              details: personaDetails,
              topCategories: persona.topCategories,
              confidence: persona.confidence
            };
            
            personaContext = `\n\n🎯 PERSONA CONTEXT:
- Interests: ${interestsText}
- Top Categories: ${persona.topCategories.join(', ')}
- Confidence: ${Math.round(persona.confidence * 100)}%
- Location: ${personaDetails?.location || 'Unknown'}
- Name: ${personaDetails?.name || 'Unknown'}

Use this persona data to provide personalized recommendations. Consider their interests as signals for better suggestions.`;
          }
        } catch (error) {
          console.log('⚠️ Could not load persona data:', error);
        }
      }

      // Step 1: Query Analysis & Intent Detection
      onStep?.('query-analysis', { query: userQuery, status: 'starting' });
      const intent = await this.analyzeQueryIntent(userQuery);
      console.log('🎯 Intent analysis result:', intent);
      onStep?.('query-analysis', { 
        query: userQuery, 
        status: 'completed',
        intent: intent,
        shouldUseQloo: intent.shouldUseQloo
      });

      // Step 2: Extract interests from conversation (with deduplication)
      if (sessionId) {
        try {
          const extractedInterests = await this.personaManager.extractInterestsFromConversation(messages || []);
          console.log(`🎯 Extracted ${extractedInterests.length} interests from conversation`);
          
          // Update persona context with new interests
          if (extractedInterests.length > 0) {
            const newInterestsText = extractedInterests.map((interest: PersonalInterest) => `${interest.name} (${interest.category})`).join(', ');
            personaContext += `\n\n🆕 NEW INTERESTS DETECTED: ${newInterestsText}`;
          }
        } catch (error) {
          console.log('⚠️ Failed to extract interests:', error);
        }
      }

      // Step 3: Route to appropriate response generator
      console.log('🎯 Routing to response generator. shouldUseQloo:', intent.shouldUseQloo, 'intent:', intent.intent);
      
      if (intent.intent === 'chat_history') {
        console.log('🎯 Taking chat history path');
        onStep?.('chat-history', { reason: 'Chat history query detected' });
        return await this.handleChatHistoryQuery(userQuery, sessionId || '');
      } else if (intent.shouldUseQloo) {
        console.log('🎯 Taking Qloo path');
        return await this.generateQlooResponse(userQuery, intent, personaContext, personaData);
      } else {
        console.log('🎯 Taking general response path');
        onStep?.('general-response', { reason: 'Not a Qloo-related query' });
        return await this.generateGeneralResponse(userQuery, personaContext);
      }

    } catch (error) {
      console.error('❌ Error in MainAgent.processQuery:', error);
      return `I apologize, but I encountered an error while processing your request. Please try again or rephrase your question.`;
    }
  }

  private getInitialGreeting(): string {
    return `Hi! 👋 I'm QLooTwin, your AI companion! 

I'm here to chat with you about anything and everything, plus provide personalized recommendations for restaurants, movies, brands, and more based on your interests.

Let's start by getting to know you better! What's your name? 

Once I know your name, I'll be able to have great conversations and help you discover amazing recommendations! 🎯`;
  }

  private getPersonaCreationTutorial(name: string, location?: string): string {
    const locationText = location ? ` from ${location}` : '';
    
    return `Hi ${name}${locationText}! 👋 Nice to meet you!

I'm QLooTwin, your AI companion! I'm here to chat with you about anything and everything, plus provide personalized recommendations for restaurants, movies, brands, and more based on your interests.

Let's build your profile together so I can get to know you better!

**Tell me about yourself:**
• What are your main interests? (e.g., music, food, travel, fashion)
• What brands do you love?
• What's your age and gender?
• Where are you located?

For example, you could say: "I'm 28, female, love indie music, coffee shops, and sustainable fashion. I'm from San Francisco."

This helps me have better conversations and provide personalized recommendations! 🎯`;
  }

  private async handlePersonaBuilding(userQuery: string, messages: ChatMessage[]): Promise<string> {
    try {
      // Extract interests and demographics from the message
      const extractedInterests = await this.personaManager.extractInterestsFromConversation(messages);
      const nameLocation = await this.personaManager.extractFromMessage(userQuery);
      
      console.log('🎯 Persona building - extracted interests:', extractedInterests.length);
      console.log('🎯 Persona building - name/location:', nameLocation);
      
      if (extractedInterests.length > 0) {
        const interestsText = extractedInterests.map((interest: PersonalInterest) => `${interest.name} (${interest.category})`).join(', ');
        
        return `Great! I've learned about your interests: ${interestsText}

Your profile is coming together nicely! 🎯

Now you can ask me for recommendations like:
• "Recommend me some restaurants in my area"
• "What music should I listen to?"
• "Show me fashion brands I might like"
• "What travel destinations match my style?"

What would you like to explore first? 🌟`;
      } else {
        return `Thanks for sharing! I'm still learning about your preferences. 

You can tell me more about:
• Your favorite activities
• Brands you love
• Types of food you enjoy
• Music genres you like

Or just ask me for recommendations and I'll help you discover new things! 🚀`;
      }
    } catch (error) {
      console.error('❌ Error in persona building:', error);
      return `Thanks for sharing! I'm here to help you discover great recommendations. What would you like to explore? 🌟`;
    }
  }

    private async analyzeQueryIntent(userQuery: string): Promise<{
    shouldUseQloo: boolean;
    intent: string;
    confidence: number;
  }> {
    // Temporarily use only rule-based analysis to debug the issue
    console.log('🎯 Using rule-based intent analysis for:', userQuery);
    return this.ruleBasedIntentAnalysis(userQuery);
  }

  private ruleBasedIntentAnalysis(userQuery: string): {
    shouldUseQloo: boolean;
    intent: string;
    confidence: number;
  } {
    const query = userQuery.toLowerCase();
    
    // Keywords that indicate Qloo usage
    const qlooKeywords = [
      'recommend', 'recomend', 'recomendation', 'suggestion', 'similar', 'like', 'preference',
      'restaurant', 'movie', 'brand', 'artist', 'book', 'game',
      'find', 'search', 'look for', 'discover', 'best', 'top',
      'pizza', 'food', 'cafe', 'dining', 'place', 'spot', 'venue'
    ];
    
    // Keywords that indicate general conversation
    const generalKeywords = [
      'hello', 'hi', 'how are you', 'what is', 'explain',
      'help', 'thanks', 'thank you', 'bye', 'goodbye', 'what did', 'tell me about',
      'do you remember', 'what did i', 'did i tell', 'my preferences'
    ];
    
    // Keywords that indicate chat history queries
    const historyKeywords = [
      'do you remember', 'what did i', 'did i tell', 'my preferences',
      'what did we talk about', 'previous conversation', 'earlier',
      'before', 'last time', 'remember when', 'what was that'
    ];
    
    const hasQlooKeywords = qlooKeywords.some(keyword => query.includes(keyword));
    const hasGeneralKeywords = generalKeywords.some(keyword => query.includes(keyword));
    const hasHistoryKeywords = historyKeywords.some(keyword => query.includes(keyword));
    
    console.log('🎯 Rule-based analysis:', {
      query,
      hasQlooKeywords,
      hasGeneralKeywords,
      hasHistoryKeywords,
      qlooKeywordsFound: qlooKeywords.filter(keyword => query.includes(keyword)),
      historyKeywordsFound: historyKeywords.filter(keyword => query.includes(keyword))
    });
    
    if (hasHistoryKeywords) {
      return {
        shouldUseQloo: false,
        intent: 'chat_history',
        confidence: 0.9
      };
    }
    
    if (hasQlooKeywords && !hasGeneralKeywords) {
      return {
        shouldUseQloo: true,
        intent: 'recommendation',
        confidence: 0.8
      };
    }
    
    return {
      shouldUseQloo: false,
      intent: 'general',
      confidence: 0.9
    };
  }

  private async generateQlooResponse(
    userQuery: string, 
    intent: { shouldUseQloo: boolean; intent: string; confidence: number }, 
    personaContext: string, 
    personaData: { interests?: PersonalInterest[]; summary?: Record<string, unknown>; details?: Record<string, unknown>; topCategories?: string[]; confidence?: number } | null
  ): Promise<string> {
    try {
      console.log('🎯 generateQlooResponse called with:', { userQuery, intent });
      
      // Step 1: Extract QLOO parameters
      const extractionResult = await this.qlooAgent.extractParameters(userQuery);
      console.log('🎯 Parameter extraction result:', extractionResult);

      if (!extractionResult.parameters) {
        throw new Error('Failed to extract QLOO parameters');
      }

      // Step 2: Call QLOO API with persona signals
      let apiResponse: ApiResponse<any>;
      const startTime = Date.now();

      if (extractionResult.parameters.targetAPI === 'GETINSIGHTS') {
        console.log('🎯 About to generate persona signals for entity type:', extractionResult.parameters.entityType);
        const personaSignals = await this.personaManager.generateSignals(extractionResult.parameters.entityType);
        console.log('🎯 Using persona signals for recommendations:', personaSignals);
        console.log('🎯 Entity type for signals:', extractionResult.parameters.entityType);
        
        // Check if we have signals for insights
        if (personaSignals.entitySignals.length > 0 || personaSignals.audienceSignals.length > 0 || personaSignals.tagSignals.length > 0) {
          // Add persona signals to the parameters
          const enhancedParams = {
            ...extractionResult.parameters,
            signalEntities: personaSignals.entitySignals,
            signalAudiences: personaSignals.audienceSignals,
            signalTags: personaSignals.tagSignals
          };
          
          // If we have filterTags from parameter extraction, use them as additional signal tags
          if (extractionResult.parameters.filterTags && extractionResult.parameters.filterTags.length > 0) {
            console.log('🏷️ Using filterTags as additional signal tags:', extractionResult.parameters.filterTags);
            // Combine existing signal tags with filter tags
            enhancedParams.signalTags = [
              ...(enhancedParams.signalTags || []),
              ...extractionResult.parameters.filterTags
            ];
          }
          
          // If we still don't have any signal tags, try to get some from the tag selector
          if (!enhancedParams.signalTags || enhancedParams.signalTags.length === 0) {
            console.log('🏷️ No signal tags available, trying to get tags from query...');
            try {
              const tagSelection = await this.tagSelector.selectTagsForQuery(userQuery);
              if (tagSelection.tags && tagSelection.tags.length > 0) {
                enhancedParams.signalTags = tagSelection.tags;
                console.log('🏷️ Got signal tags from tag selector:', tagSelection.tags);
              }
            } catch (error) {
              console.log('⚠️ Failed to get tags from tag selector:', error);
            }
          }
          
          console.log('🎯 Enhanced parameters with signals:', enhancedParams);
          
          try {
            apiResponse = await getInsights(enhancedParams, this.context.sessionId);
            console.log('✅ Insights API call successful');
            console.log('📊 API Response data structure:', {
              hasResults: !!apiResponse.data,
              hasEntities: !!(apiResponse.data && apiResponse.data.entities),
              entityCount: apiResponse.data?.entities?.length || 0,
              responseKeys: apiResponse.data ? Object.keys(apiResponse.data) : []
            });
            
            // Check if insights returned entities
            const insightsEntities = apiResponse.data?.results?.entities || apiResponse.data?.entities || [];
            console.log('🔍 Insights entities found:', insightsEntities.length);
            if (insightsEntities.length === 0) {
              console.log('⚠️ Insights API returned no entities, falling back to entity search');
              // Fallback to entity search with enhanced query for sport brands
              const fallbackParams = { 
                ...extractionResult.parameters,
                query: extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))
                  ? 'Nike Adidas Under Armour Puma Reebok sport brands'
                  : extractionResult.parameters.query,
                location: extractionResult.parameters.location // Preserve location in fallback
              };
              
              // For sport brands, enhance the query with known sport brand names
              if (extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))) {
                console.log('🏃 Enhanced query for sport brands:', fallbackParams.query);
              }
              
              apiResponse = await getEntity(fallbackParams, this.context.sessionId);
              console.log('✅ Entity search fallback successful');
            }
          } catch (insightsError) {
            console.error('❌ Insights API call failed:', insightsError);
            // Fallback to entity search with enhanced query for sport brands
            console.log('🔄 Falling back to entity search');
            const fallbackParams = { 
              ...extractionResult.parameters,
              query: extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))
                ? 'Nike Adidas Under Armour Puma Reebok sport brands'
                : extractionResult.parameters.query,
              location: extractionResult.parameters.location // Preserve location in fallback
            };
            
            // For sport brands, enhance the query with known sport brand names
            if (extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))) {
              console.log('🏃 Enhanced query for sport brands:', fallbackParams.query);
            }
            
            apiResponse = await getEntity(fallbackParams, this.context.sessionId);
            console.log('✅ Entity search fallback successful');
          }
        } else {
          // No persona signals available, but check if we have filterTags
          if (extractionResult.parameters.filterTags && extractionResult.parameters.filterTags.length > 0) {
            console.log('🏷️ No persona signals but using filterTags:', extractionResult.parameters.filterTags);
            // Use filterTags as signal tags
            const enhancedParams = {
              ...extractionResult.parameters,
              signalTags: extractionResult.parameters.filterTags
            };
            try {
              apiResponse = await getInsights(enhancedParams, this.context.sessionId);
              console.log('✅ Insights API call with filterTags successful');
            } catch (insightsError) {
              console.error('❌ Insights API call with filterTags failed:', insightsError);
              // Fallback to entity search with enhanced query for sport brands
              console.log('🔄 Falling back to entity search');
              const fallbackParams = { 
                ...extractionResult.parameters,
                query: extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))
                  ? 'Nike Adidas Under Armour Puma Reebok sport brands'
                  : extractionResult.parameters.query,
                location: extractionResult.parameters.location // Preserve location in fallback
              };
              
              // For sport brands, enhance the query with known sport brand names
              if (extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))) {
                console.log('🏃 Enhanced query for sport brands:', fallbackParams.query);
              }
              
              apiResponse = await getEntity(fallbackParams, this.context.sessionId);
              console.log('✅ Entity search fallback successful');
            }
          } else {
            // No persona signals available, use entity search directly with enhanced query for sport brands
            console.log('⚠️ No persona signals available, using entity search');
            const fallbackParams = { 
              ...extractionResult.parameters,
              query: extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))
                ? 'Nike Adidas Under Armour Puma Reebok sport brands'
                : extractionResult.parameters.query,
              location: extractionResult.parameters.location // Preserve location in fallback
            };
            
            // For sport brands, enhance the query with known sport brand names
            if (extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))) {
              console.log('🏃 Enhanced query for sport brands:', fallbackParams.query);
            }
            
            apiResponse = await getEntity(fallbackParams, this.context.sessionId);
            console.log('✅ Entity search successful');
          }
        }
      } else if (extractionResult.parameters.targetAPI === 'GETENTITY') {
        console.log('🎯 Using entity search directly');
        // Use enhanced query for sport brands even in direct entity search
        const enhancedParams = { 
          ...extractionResult.parameters,
          query: extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))
            ? 'Nike Adidas Under Armour Puma Reebok sport brands'
            : extractionResult.parameters.query,
          location: extractionResult.parameters.location // Preserve location in direct entity search
        };
        
        // For sport brands, enhance the query with known sport brand names
        if (extractionResult.parameters.filterTags?.some(tag => ['sport', 'sports', 'athletic', 'fitness'].includes(tag))) {
          console.log('🏃 Enhanced query for sport brands:', enhancedParams.query);
        }
        
        apiResponse = await getEntity(enhancedParams, this.context.sessionId);
        console.log('✅ Entity search successful');
      } else {
        console.log('🎯 Using tags search');
        apiResponse = await getTags(extractionResult.parameters, this.context.sessionId);
        console.log('✅ Tags search successful');
      }

      const duration = Date.now() - startTime;

      // Step 3: Parse and generate response
      let parsedResponse: ParsedResponse;
      
      try {
        console.log('🔍 About to parse Qloo response with structure:', {
          hasData: !!apiResponse.data,
          dataKeys: apiResponse.data ? Object.keys(apiResponse.data) : [],
          hasResults: !!(apiResponse.data && apiResponse.data.results),
          resultsKeys: apiResponse.data?.results ? Object.keys(apiResponse.data.results) : [],
          hasEntities: !!(apiResponse.data?.results?.entities),
          entityCount: apiResponse.data?.results?.entities?.length || 0
        });
        
        // Test: Log the actual response structure being passed to parser
        console.log('🔍 Raw API response keys:', Object.keys(apiResponse));
        console.log('🔍 API response.data keys:', apiResponse.data ? Object.keys(apiResponse.data) : 'no data');
        console.log('🔍 API response.data.results keys:', apiResponse.data?.results ? Object.keys(apiResponse.data.results) : 'no results');
        console.log('🔍 API response.data.results.entities count:', apiResponse.data?.results?.entities?.length || 0);
        
        parsedResponse = parseQlooResponse(apiResponse, 'summary');
        console.log('📊 Parsed response structure:', {
          entityCount: parsedResponse.entities?.length || 0,
          hasEntities: !!(parsedResponse.entities && parsedResponse.entities.length > 0),
          metadata: parsedResponse.metadata
        });
        
        if (parsedResponse.entities && parsedResponse.entities.length > 0) {
          console.log('✅ Parsed entities found:', parsedResponse.entities.map(e => ({ name: e.name, type: e.type })));
        } else {
          console.log('⚠️ No entities found in parsed response');
        }
      } catch (parseError) {
        console.error('❌ Error parsing Qloo response:', parseError);
        // If parsing fails, try to extract basic information
        parsedResponse = {
          entities: [],
          metadata: {
            parsingLevel: 'minimal',
            originalCount: 0,
            parsedCount: 0
          }
        };
      }
      
              // Check if we got actual recommendations from Qloo
        console.log('🔍 Checking parsed response entities:', parsedResponse.entities?.length || 0);
        console.log('🔍 Raw API response entities:', apiResponse.data?.results?.entities?.length || apiResponse.data?.entities?.length || 0);
        console.log('🔍 Parsed response structure:', {
          hasEntities: !!(parsedResponse.entities && parsedResponse.entities.length > 0),
          entityCount: parsedResponse.entities?.length || 0,
          metadata: parsedResponse.metadata
        });
        
        if (parsedResponse.entities && parsedResponse.entities.length > 0) {
          console.log('✅ Found recommendations from Qloo API');
        
        // Store full entity data in database BEFORE parsing
        if (this.context.sessionId && apiResponse.data) {
          try {
            // Store the complete raw entities from the correct path
            const rawEntities = apiResponse.data.results?.entities || apiResponse.data.entities || [];
            const databaseService = getDatabaseService();
            await databaseService.storeEntitiesFromResponse(
                this.context.sessionId,
                rawEntities,
                'insights-api'
              );
              console.log('💾 Stored full entity data in database');
            }
          } catch (dbError) {
            console.error('❌ Failed to store entities:', dbError);
          }
        }
        
        // Store parsed entity data in context for visual components
        console.log('🎯 Storing response metadata with entities:', {
          entityCount: parsedResponse.entities.length,
          entityNames: parsedResponse.entities.map(e => e.name),
          intent: intent.intent,
          source: 'qloo-insights'
        });
        
        this.context.lastResponseMetadata = {
          entities: parsedResponse.entities,
          intent: intent.intent,
          source: 'qloo-insights',
          entityCount: parsedResponse.entities.length
        };
        
        // Generate personalized response using persona context
        const response = await this.generatePersonalizedResponse(
          userQuery,
          parsedResponse,
          extractionResult.parameters,
          personaContext,
          personaData
        );
        return response;
      } else {
        // No recommendations from Qloo - provide informative failure message
        console.log('⚠️ No recommendations from Qloo API, providing failure explanation');
        console.log('🔍 Debug: parsedResponse.entities is empty or undefined');
        console.log('🔍 Debug: parsedResponse structure:', {
          hasEntities: !!(parsedResponse.entities),
          entityCount: parsedResponse.entities?.length || 0,
          metadata: parsedResponse.metadata
        });
        
        // Provide informative failure message explaining what went wrong
        const queryLower = userQuery.toLowerCase();
        let failureMessage = '';
        
        if (queryLower.includes('restaurant') || queryLower.includes('food') || queryLower.includes('dining')) {
          failureMessage = `❌ **Qloo API Failure**: I was unable to find restaurant recommendations for you.

**What failed:**
• The Qloo Insights API returned no restaurant results for your query
• This could be due to insufficient persona signals, location restrictions, or API limitations

**What I tried:**
• Called Qloo Insights API with your location and preferences
• Attempted entity search as fallback
• Both methods returned empty results

**Suggestions:**
• Try being more specific: "Italian restaurants in San Francisco"
• Add more interests to your persona profile
• Try a different cuisine or location`;
        } else if (queryLower.includes('movie') || queryLower.includes('film')) {
          failureMessage = `❌ **Qloo API Failure**: I was unable to find movie recommendations for you.

**What failed:**
• The Qloo Insights API returned no movie results for your query
• This could be due to insufficient persona signals or API limitations

**What I tried:**
• Called Qloo Insights API with your preferences
• Attempted entity search as fallback
• Both methods returned empty results

**Suggestions:**
• Try being more specific: "action movies from 2023"
• Add more movie preferences to your persona profile
• Try a different genre or time period`;
        } else if (queryLower.includes('wine') || queryLower.includes('bar')) {
          failureMessage = `❌ **Qloo API Failure**: I was unable to find wine bar recommendations for you.

**What failed:**
• The Qloo Insights API returned no wine bar results for your query
• This could be due to insufficient persona signals, location restrictions, or API limitations

**What I tried:**
• Called Qloo Insights API with your location and preferences
• Attempted entity search as fallback
• Both methods returned empty results

**Suggestions:**
• Try being more specific: "wine bars in downtown San Francisco"
• Add more wine preferences to your persona profile
• Try a different location or wine type`;
        } else if (queryLower.includes('brand') || queryLower.includes('company') || queryLower.includes('product')) {
          failureMessage = `❌ **Qloo API Failure**: I was unable to find brand recommendations for you.

**What failed:**
• The Qloo Insights API returned no brand results for your query
• This could be due to insufficient persona signals or API limitations

**What I tried:**
• Called Qloo Insights API with your preferences
• Attempted entity search as fallback
• Both methods returned empty results

**Suggestions:**
• Try being more specific: "fashion shoe brands" or "tech companies"
• Add more brand preferences to your persona profile
• Try a different category or industry`;
        } else {
          failureMessage = `❌ **Qloo API Failure**: I was unable to find recommendations for you.

**What failed:**
• The Qloo Insights API returned no results for your query
• This could be due to insufficient persona signals or API limitations

**What I tried:**
• Called Qloo Insights API with your preferences
• Attempted entity search as fallback
• Both methods returned empty results

**Suggestions:**
• Try being more specific about what you're looking for
• Add more interests to your persona profile
• Try a different category or query`;
        }
        
        return failureMessage;
      }

    } catch (error) {
      console.error('❌ Error in QLOO response generation:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        userQuery,
        sessionId: this.context.sessionId,
        intent
      });
      
      // Provide informative error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return `❌ **System Error**: I encountered a technical problem while processing your request.

**What failed:**
• ${errorMessage}

**What I tried:**
• Parameter extraction from your query
• Qloo API calls with your preferences
• Response generation and parsing

**Technical details:**
• Session ID: ${this.context.sessionId || 'None'}
• Query: "${userQuery}"
• Intent: ${intent.intent}

**Suggestions:**
• Try rephrasing your request
• Check your internet connection
• Try again in a few moments`;
    }
  }

  private async generatePersonalizedResponse(
    userQuery: string,
    parsedResponse: ParsedResponse,
    parameters: QlooParameters,
    _personaContext: string,
    _personaData: { interests?: PersonalInterest[]; summary?: Record<string, unknown>; details?: Record<string, unknown>; topCategories?: string[]; confidence?: number } | null
  ): Promise<string> {
    try {
      console.log('🎯 Generating personalized response with entities:', parsedResponse.entities?.length || 0);
      
      if (!parsedResponse.entities || parsedResponse.entities.length === 0) {
        return `❌ **No Results Found**: I couldn't find any recommendations for your query.

**What happened:**
• The Qloo API returned results, but they couldn't be parsed properly
• This might be due to API response format changes or parsing issues

**What I tried:**
• Called Qloo API successfully
• Attempted to parse the response
• No valid entities could be extracted

**Suggestions:**
• Try rephrasing your request
• Be more specific about what you're looking for
• Check if the API is working properly`;
      }

      // Determine the entity type from the first entity or parameters
      const entityType = parsedResponse.entities[0]?.type || parameters.entityType || 'unknown';
      const userQueryLower = userQuery.toLowerCase();
      
      // Use both entity type and user query to determine category
      const isRestaurant = (entityType.includes('place') && (userQueryLower.includes('restaurant') || userQueryLower.includes('food') || userQueryLower.includes('dining'))) || entityType.includes('restaurant');
      const isMovie = entityType.includes('movie') || entityType.includes('film') || userQueryLower.includes('movie') || userQueryLower.includes('film');
      const isBrand = entityType.includes('brand') || entityType.includes('company') || userQueryLower.includes('brand');
      const isMusic = entityType.includes('music') || entityType.includes('artist') || userQueryLower.includes('music') || userQueryLower.includes('artist') || userQueryLower.includes('song');
      const isBook = entityType.includes('book') || entityType.includes('author') || userQueryLower.includes('book') || userQueryLower.includes('read');
      const isPlace = entityType.includes('place') && !isRestaurant && !isMusic; // Generic places that aren't restaurants or music venues

      // Create appropriate header based on entity type
      let header = '';
      if (isRestaurant) {
        header = '🍽️ Based on your interests, here are some great restaurant recommendations for you:';
      } else if (isMovie) {
        header = '🎬 Based on your interests, here are some great movie recommendations for you:';
      } else if (isBrand) {
        header = '🏢 Based on your interests, here are some great brand recommendations for you:';
      } else if (isMusic) {
        header = '🎵 Based on your interests, here are some great music recommendations for you:';
      } else if (isBook) {
        header = '📚 Based on your interests, here are some great book recommendations for you:';
      } else {
        header = '🎯 Based on your interests, here are some great recommendations for you:';
      }

      // Create footer with appropriate call-to-action
      let footer = '';
      if (isRestaurant) {
        footer = 'These recommendations are personalized based on your dining preferences. Would you like me to tell you more about any of these restaurants or suggest similar places?';
      } else if (isMovie) {
        footer = 'These recommendations are personalized based on your movie preferences. Would you like me to tell you more about any of these films or suggest similar movies?';
      } else if (isBrand) {
        footer = 'These recommendations are personalized based on your brand preferences. Would you like me to tell you more about any of these brands or suggest similar companies?';
      } else if (isMusic) {
        footer = 'These recommendations are personalized based on your music preferences. Would you like me to tell you more about any of these artists or suggest similar music?';
      } else if (isBook) {
        footer = 'These recommendations are personalized based on your reading preferences. Would you like me to tell you more about any of these books or suggest similar reads?';
      } else {
        footer = 'These recommendations are personalized based on your interests and preferences. Would you like me to tell you more about any of these items?';
      }

      // Generate simple text response without entity names (they'll be shown in visual components)
      return `${header}

${footer}`;
      
    } catch (error) {
      console.error('❌ Error generating personalized response:', error);
      return `❌ **Personalization Failed**: I found recommendations but couldn't personalize them properly.

**What failed:**
• The personalization logic encountered an error
• This could be due to data format issues or processing problems

**What I tried:**
• Successfully retrieved recommendations from Qloo API
• Attempted to personalize the response for you
• The personalization step failed

**Suggestions:**
• Try asking again - the recommendations might still be useful
• Check if your persona profile is complete
• Try a different query`;
    }
  }

  private async generateGeneralResponse(userQuery: string, personaContext: string): Promise<string> {
    try {
      const prompt = `You are QLooTwin, a friendly and knowledgeable AI assistant. You can chat about anything - from casual conversation to answering questions about any topic.

The user has asked: "${userQuery}"

${personaContext ? `PERSONA CONTEXT: ${personaContext}

Use this persona information to make your response more personalized and relevant to the user's interests and background.` : ''}

**Your capabilities:**
- You can have casual conversations about any topic
- You can answer questions about science, history, technology, culture, etc.
- You can provide advice, explanations, and insights
- You can help with creative tasks like writing, brainstorming, etc.
- You can discuss current events, trends, and popular culture
- You can engage in philosophical discussions
- You can help with learning and education topics

**Response style:**
- Be conversational, friendly, and engaging
- Use emojis occasionally to make responses more lively
- Be helpful and informative
- If relevant, you can mention that you can also provide personalized recommendations for restaurants, movies, brands, etc. through Qloo
- Keep responses concise but comprehensive
- Show personality and warmth

Provide a helpful, conversational response to the user's query.`;

      const response = await generateText({
        model: google('gemini-2.5-flash'),
        prompt,
        maxTokens: 600,
      });

      return response.text;
    } catch (error) {
      console.error('❌ Error generating general response:', error);
      return `❌ **AI Response Generation Failed**: I couldn't generate a helpful response for your query.

**What failed:**
• The AI model (Gemini) failed to generate a response
• This could be due to model unavailability or technical issues

**What I tried:**
• Analyzed your query: "${userQuery}"
• Attempted to generate a helpful response using AI
• The AI model returned an error

**Suggestions:**
• Try rephrasing your request
• Ask for specific recommendations (restaurants, movies, brands, etc.)
• Try again in a few moments`;
    }
  }

  // Update agent context
  updateContext(newContext: Partial<AgentContext>): void {
    this.context = { ...this.context, ...newContext };
    // Also update the Qloo agent context
    this.qlooAgent.updateContext(newContext);
  }

  // Handle chat history queries
  async handleChatHistoryQuery(userQuery: string, sessionId: string): Promise<string> {
    try {
      console.log('🔍 Handling chat history query:', userQuery);
      
      const chatHistoryAgent = new ChatHistoryAgent(sessionId);
      
      // Extract entity name from query if present
      const entityMatch = userQuery.match(/(?:about|tell me about|what is|find|search for)\s+([^?]+)/i);
      const entityName = entityMatch ? entityMatch[1].trim() : undefined;
      
      const result = await chatHistoryAgent.searchChatHistory({
        query: userQuery,
        sessionId,
        entityName,
        includeMessages: true,
        includeEntities: true
      });
      
      if (result.found) {
        if (result.entityDetails) {
          // User asked about a specific entity
          const entity = result.entityDetails;
          return `I found information about **${entity.name}** in our conversation history:\n\n` +
                 `**Type:** ${entity.type}\n` +
                 `**Description:** ${entity.description || 'No description available'}\n` +
                 `**Source:** ${result.source === 'database' ? 'From our previous conversation' : 'Fetched from Qloo API'}\n\n` +
                 `Would you like to know more about this ${entity.type.replace('urn:entity:', '')} or get similar recommendations?`;
        } else {
          // User asked about general chat history
          const entityList = result.entities.slice(0, 5).map(e => `- ${e.name} (${e.type.replace('urn:entity:', '')})`).join('\n');
          return `I found these items from our previous conversation:\n\n${entityList}\n\n` +
                 `What specific information would you like to know about any of these?`;
        }
      } else {
        return `I don't have any information about that in our conversation history. Would you like me to search for it using the Qloo API?`;
      }
    } catch (error) {
      console.error('❌ Error handling chat history query:', error);
      return 'I encountered an error while searching our conversation history. Please try again.';
    }
  }
}