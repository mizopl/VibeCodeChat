import { google } from '@ai-sdk/google';
import { generateText, generateObject } from 'ai';
import { searchTags, getTagTypes, searchTagsWithTolerance } from '../qloo/api';
import { config } from '../config';
import { broadcastDebugMessage } from '../utils/debug';

export interface TagSelection {
  tags: string[];
  confidence: number;
  reasoning: string;
  entityType: string;
}

export class SignalTagSelector {
  private async analyzeQueryIntent(userQuery: string): Promise<{
    entityType: string;
    context: string;
    intent: string;
    keywords: string[];
  }> {
    const prompt = `Analyze this user query to extract entity type, context, and intent:

Query: "${userQuery}"

Extract:
1. Entity type (movie, brand, place, artist, book, destination, person, podcast, tv_show, video_game)
2. Context (what they're looking for)
3. Intent (recommendation, search, discovery)
4. Keywords (important terms for tag search, including genres, categories, types)

For example:
- "horror comedy romance movies" → keywords: ["horror", "comedy", "romance"]
- "sport brands" → keywords: ["sport", "sports", "athletic"]
- "italian chinese restaurants" → keywords: ["italian", "chinese", "cuisine"]

Respond in JSON format:
{
  "entityType": "urn:entity:movie",
  "context": "Multiple genres requested",
  "intent": "recommendation", 
  "keywords": ["horror", "comedy", "romance"]
}`;

    // Configure Google AI with API key from localStorage
    configureGoogleAI();
    
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      maxTokens: 300
    });

    try {
      return JSON.parse(result.text);
    } catch (error) {
      // Fallback to rule-based analysis
      return this.ruleBasedAnalysis(userQuery);
    }
  }

  private ruleBasedAnalysis(userQuery: string): {
    entityType: string;
    context: string;
    intent: string;
    keywords: string[];
  } {
    const queryLower = userQuery.toLowerCase();
    
    // Determine entity type
    let entityType = 'urn:entity:place';
    if (queryLower.includes('movie') || queryLower.includes('film')) {
      entityType = 'urn:entity:movie';
    } else if (queryLower.includes('brand')) {
      entityType = 'urn:entity:brand';
    }
    
    // Extract context and keywords
    const context = queryLower.includes('new york') ? 'New York setting' : 'general';
    const keywords = queryLower.match(/\b(new york|nyc|city|urban|drama|action|comedy)\b/g) || [];
    
    return {
      entityType,
      context,
      intent: 'recommendation',
      keywords: keywords.length > 0 ? keywords : ['general']
    };
  }

  private async searchRelevantTags(keywords: string[], entityType: string): Promise<string[]> {
    const allTags: string[] = [];
    
    try {
      // Step 1: Get available tag types for this entity
      console.log('🏷️ Step 1: Getting tag types for entity:', entityType);
      broadcastDebugMessage('api', {
        type: 'tag-types-search',
        method: 'GETTAGTYPES',
        parameters: { entityType },
        status: 'calling'
      });
      
      const tagTypesResult = await getTagTypes(entityType);
      console.log('🏷️ Available tag types:', tagTypesResult);
      
      broadcastDebugMessage('api', {
        type: 'tag-types-search',
        method: 'GETTAGTYPES',
        parameters: { entityType },
        response: tagTypesResult,
        status: 'completed',
        duration: 0
      });
      
      // Step 2: Use the new searchTagsWithTolerance function for better tag discovery
      console.log('🏷️ Step 2: Searching for tags with typo tolerance:', keywords);
      
      broadcastDebugMessage('api', {
        type: 'tag-search',
        method: 'SEARCHTAGSWITHTOLERANCE',
        parameters: { keywords, entityType },
        status: 'calling'
      });
      
      const tagResults = await searchTagsWithTolerance(keywords, entityType, 20);
      console.log('🏷️ Tags found with tolerance:', tagResults);
      
      if (tagResults && tagResults.data && tagResults.data.results) {
        const tagIds = tagResults.data.results.map((tag: any) => tag.id);
        allTags.push(...tagIds);
        console.log(`✅ Found ${tagIds.length} tags with typo tolerance`);
      }
      
      broadcastDebugMessage('api', {
        type: 'tag-search',
        method: 'SEARCHTAGSWITHTOLERANCE',
        parameters: { keywords, entityType },
        response: tagResults,
        status: 'completed',
        duration: 0
      });
      
    } catch (error) {
      console.log('🏷️ Tag search failed:', error);
      broadcastDebugMessage('error', {
        type: 'tag-search',
        method: 'SEARCHTAGSWITHTOLERANCE',
        parameters: { keywords, entityType },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });
    }
    
    return [...new Set(allTags)]; // Remove duplicates
  }

  private async selectBestTags(
    availableTags: string[], 
    context: string, 
    entityType: string
  ): Promise<string[]> {
    if (availableTags.length === 0) {
      return [];
    }

    const prompt = `Select the best tags for this context:

Context: "${context}"
Entity Type: ${entityType}
Available Tags: ${availableTags.join(', ')}

Select 2-4 most relevant tags that would help find good recommendations.
Consider:
- Relevance to the context
- Popularity/common usage
- Specificity (not too generic)

Respond with just the selected tag names, comma-separated:`;

    // Configure Google AI with API key from localStorage
    configureGoogleAI();
    
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      maxTokens: 200
    });

    const selectedTags = result.text
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => availableTags.includes(tag))
      .slice(0, 4);

          // If no tags were selected by AI, fall back to selecting the first few available tags
      if (selectedTags.length === 0 && availableTags.length > 0) {
        console.log('🤖 AI didn\'t select tags, using fallback selection');
        console.log('⚠️ Tag selection fallback: AI model failed to select tags, using first 3 available tags');
        return availableTags.slice(0, 3); // Take first 3 available tags
      }

    return selectedTags;
  }

  public async selectTagsForQuery(userQuery: string): Promise<TagSelection> {
    try {
      console.log('🎯 Analyzing query for tag selection:', userQuery);
      broadcastDebugMessage('api', {
        type: 'tag-selection',
        method: 'SELECTTAGS',
        parameters: { userQuery },
        status: 'calling'
      });
      
      // Step 1: Analyze query intent
      const analysis = await this.analyzeQueryIntent(userQuery);
      console.log('📊 Query analysis:', analysis);
      
      // Step 2: Search for relevant tags
      const availableTags = await this.searchRelevantTags(analysis.keywords, analysis.entityType);
      console.log('🏷️ Available tags:', availableTags);
      
      // Step 3: Select best tags
      const selectedTags = await this.selectBestTags(availableTags, analysis.context, analysis.entityType);
      console.log('✅ Selected tags:', selectedTags);
      
      const result = {
        tags: selectedTags,
        confidence: selectedTags.length > 0 ? 0.8 : 0.3,
        reasoning: `Selected ${selectedTags.length} tags based on context: "${analysis.context}"`,
        entityType: analysis.entityType
      };
      
      broadcastDebugMessage('api', {
        type: 'tag-selection',
        method: 'SELECTTAGS',
        parameters: { userQuery },
        response: result,
        status: 'completed',
        duration: 0
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ Tag selection failed:', error);
      broadcastDebugMessage('error', {
        type: 'tag-selection',
        method: 'SELECTTAGS',
        parameters: { userQuery },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });
      
      return {
        tags: [],
        confidence: 0.1,
        reasoning: 'Tag selection failed due to error - AI model or API unavailable',
        entityType: 'urn:entity:place'
      };
    }
  }
} 