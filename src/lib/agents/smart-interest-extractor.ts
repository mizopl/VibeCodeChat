import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getQlooTags, getQlooTagTypes } from '../qloo/api';
import { broadcastDebugMessage } from '../utils/debug';

export interface ExtractedInterest {
  name: string;
  category: string;
  confidence: number;
  qlooTagId?: string;
  qlooEntityId?: string;
  source: 'conversation' | 'explicit' | 'inferred';
  context: string;
}

export interface InterestValidation {
  isValid: boolean;
  qlooTagId?: string;
  qlooEntityId?: string;
  confidence: number;
  reasoning: string;
}

export class SmartInterestExtractor {
  private cachedTagTypes: any[] = [];
  private cachedTags: Record<string, any[]> = {};
  private sessionId?: string;

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Initialize tag cache
  async initialize(): Promise<void> {
    try {
      console.log('🔍 Initializing smart interest extractor...');
      
      // Get tag types
      const tagTypesResponse = await getQlooTagTypes();
      if (tagTypesResponse.data && 'tagTypes' in tagTypesResponse.data) {
        this.cachedTagTypes = tagTypesResponse.data.tagTypes;
      }
      
      console.log('✅ Smart interest extractor initialized with', this.cachedTagTypes.length, 'tag types');
    } catch (error) {
      console.error('❌ Failed to initialize smart interest extractor:', error);
    }
  }

  // Extract interests from text
  async extractFromText(text: string): Promise<ExtractedInterest[]> {
    if (!text.trim()) return [];

    try {
      const prompt = `Extract personal interests from this bio text. Focus on brands, products, activities, preferences, and lifestyle choices.

Bio: "${text}"

Extract interests in these categories:
- brands (companies, products, services)
- entertainment (movies, music, books, games, shows)
- lifestyle (food, travel, fitness, fashion, hobbies)
- technology (apps, devices, platforms, software)
- activities (sports, hobbies, social activities, interests)

For each interest, provide:
- name: the specific interest
- category: one of the above categories
- confidence: 0.0-1.0 based on how clearly it's mentioned
- context: brief explanation of why you extracted this

Return as JSON array:
[
  {
    "name": "Nike",
    "category": "brands",
    "confidence": 0.9,
    "context": "User explicitly mentioned liking Nike"
  }
]`;

      const result = await generateText({
        model: google('gemini-2.5-flash'),
      // Configure Google AI with API key from localStorage
      configureGoogleAI();
        prompt,
        maxTokens: 800
      });

      // Extract JSON from the response
      let jsonText = result.text;
      
      // Remove markdown code blocks if present
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0];
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1];
      }
      
      // Clean up the JSON text
      jsonText = jsonText.trim();
      
      try {
        const extractedInterests = JSON.parse(jsonText);
        
        if (!Array.isArray(extractedInterests)) {
          console.error('❌ Invalid response format - expected array');
          return [];
        }
        
        // Validate and process each interest
        const validatedInterests: ExtractedInterest[] = [];
        
        for (const interest of extractedInterests) {
          if (interest.name && interest.category) {
            const validatedInterest: ExtractedInterest = {
              name: interest.name,
              category: interest.category,
              confidence: Math.min(1.0, Math.max(0.0, interest.confidence || 0.5)),
              context: interest.context || 'Extracted from bio',
              source: 'inferred'
            };
            
            validatedInterests.push(validatedInterest);
          }
        }
        
        console.log(`🎯 Extracted ${validatedInterests.length} interests from text`);
        return validatedInterests;
        
      } catch (parseError) {
        console.error('❌ Failed to parse JSON response:', parseError);
        console.error('Raw response:', result.text);
        return [];
      }
      
    } catch (error) {
      console.error('❌ Error extracting interests from text:', error);
      return [];
    }
  }

  // Extract interests from conversation
  async extractFromConversation(messages: any[]): Promise<ExtractedInterest[]> {
    const userMessages = messages
      .filter(msg => msg.role === 'user')
      .map(msg => msg.content)
      .join(' ');

    if (!userMessages.trim()) return [];

    try {
      const prompt = `Extract personal interests from this conversation. Focus on brands, products, activities, preferences, and lifestyle choices.

Conversation: "${userMessages}"

Extract interests in these categories:
- brands (companies, products, services)
- entertainment (movies, music, books, games, shows)
- lifestyle (food, travel, fitness, fashion, hobbies)
- technology (apps, devices, platforms, software)
- activities (sports, hobbies, social activities, interests)

For each interest, provide:
- name: the specific interest
- category: one of the above categories
- confidence: 0.0-1.0 based on how clearly it's mentioned
- context: brief explanation of why you extracted this

Return as JSON array:
[
  {
    "name": "Nike",
    "category": "brands",
    "confidence": 0.9,
    "context": "User explicitly mentioned liking Nike"
  }
]`;

      const result = await generateText({
        model: google('gemini-2.5-flash'),
      // Configure Google AI with API key from localStorage
      configureGoogleAI();
        prompt,
        maxTokens: 800
      });

      // Extract JSON from the response
      let jsonText = result.text;
      
      // Remove markdown code blocks if present
      if (jsonText.includes('```json')) {
        jsonText = jsonText.split('```json')[1].split('```')[0];
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.split('```')[1];
      }
      
      // Clean up the JSON text
      jsonText = jsonText.trim();
      
      // Try to fix common JSON issues
      try {
        // First try to parse as-is
        const extractedInterests = JSON.parse(jsonText);
        return extractedInterests;
      } catch (parseError) {
        console.error('Failed to parse interest extraction JSON:', parseError);
        console.log('Raw response:', result.text);
        
        // Try to fix common issues
        try {
          // Remove trailing commas
          jsonText = jsonText.replace(/,(\s*[}\]])/g, '$1');
          
          // If the JSON is incomplete, try to close it
          if (jsonText.includes('[') && !jsonText.includes(']')) {
            jsonText += ']';
          }
          
          // If there are incomplete objects, try to close them
          const openBraces = (jsonText.match(/\{/g) || []).length;
          const closeBraces = (jsonText.match(/\}/g) || []).length;
          if (openBraces > closeBraces) {
            jsonText += '}'.repeat(openBraces - closeBraces);
          }
          
          const extractedInterests = JSON.parse(jsonText);
          console.log('✅ Fixed JSON parsing successfully');
          return extractedInterests;
        } catch (secondParseError) {
          console.error('Failed to fix JSON parsing:', secondParseError);
          console.log('Attempted to fix JSON:', jsonText);
          return [];
        }
      }

      // Validate each interest with Qloo
      const validatedInterests: ExtractedInterest[] = [];
      
      for (const interest of extractedInterests) {
        const validation = await this.validateWithQloo(interest.name, interest.category);
        
        if (validation.isValid) {
          validatedInterests.push({
            name: interest.name,
            category: interest.category,
            confidence: interest.confidence,
            qlooTagId: validation.qlooTagId,
            qlooEntityId: validation.qlooEntityId,
            source: 'conversation',
            context: interest.context
          });
        }
      }

      console.log('✅ Extracted and validated interests:', validatedInterests.map(i => i.name));
      
      broadcastDebugMessage('api', {
        type: 'interest-extraction',
        method: 'EXTRACT_FROM_CONVERSATION',
        parameters: { messageCount: messages.length },
        response: validatedInterests,
        status: 'completed'
      });

      return validatedInterests;

    } catch (error) {
      console.error('❌ Failed to extract interests from conversation:', error);
      
      broadcastDebugMessage('error', {
        type: 'interest-extraction',
        method: 'EXTRACT_FROM_CONVERSATION',
        parameters: { messageCount: messages.length },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });

      return [];
    }
  }

  // Validate interest with Qloo tag search
  async validateWithQloo(interestName: string, category: string): Promise<InterestValidation> {
    try {
      // Map category to Qloo tag type
      const tagType = this.mapCategoryToTagType(category);
      
      if (!tagType) {
        return {
          isValid: false,
          confidence: 0.1,
          reasoning: `No Qloo tag type found for category: ${category}`
        };
      }

      // Search for tags
      const tagsResponse = await getQlooTags({
        tagType: tagType,
        query: interestName,
        limit: 5
      });

      if (tagsResponse.data && 'tags' in tagsResponse.data && tagsResponse.data.tags.length > 0) {
        const bestMatch = tagsResponse.data.tags[0];
        
        return {
          isValid: true,
          qlooTagId: bestMatch.id,
          confidence: this.calculateMatchConfidence(interestName, bestMatch.name),
          reasoning: `Found matching Qloo tag: ${bestMatch.name}`
        };
      }

      // If no tag found, try entity search
      const entityValidation = await this.validateWithEntitySearch(interestName, category);
      if (entityValidation.isValid) {
        return entityValidation;
      }

      return {
        isValid: false,
        confidence: 0.1,
        reasoning: `No matching Qloo tag or entity found for: ${interestName}`
      };

    } catch (error) {
      console.error(`❌ Failed to validate interest "${interestName}":`, error);
      return {
        isValid: false,
        confidence: 0.1,
        reasoning: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Validate with entity search as fallback
  private async validateWithEntitySearch(interestName: string, category: string): Promise<InterestValidation> {
    try {
      const entityType = this.mapCategoryToEntityType(category);
      
      if (!entityType) {
        return {
          isValid: false,
          confidence: 0.1,
          reasoning: `No entity type found for category: ${category}`
        };
      }

      // This would require entity search API - for now return false
      return {
        isValid: false,
        confidence: 0.1,
        reasoning: `Entity search validation not implemented yet - fallback validation method unavailable`
      };

    } catch (error) {
      return {
        isValid: false,
        confidence: 0.1,
        reasoning: `Entity validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  // Map category to Qloo tag type
  private mapCategoryToTagType(category: string): string | null {
    const mapping: Record<string, string> = {
      'brands': 'urn:tag:brand',
      'entertainment': 'urn:tag:entertainment',
      'lifestyle': 'urn:tag:lifestyle',
      'technology': 'urn:tag:technology',
      'activities': 'urn:tag:activity'
    };

    return mapping[category] || null;
  }

  // Map category to entity type
  private mapCategoryToEntityType(category: string): string | null {
    const mapping: Record<string, string> = {
      'brands': 'urn:entity:brand',
      'entertainment': 'urn:entity:movie',
      'lifestyle': 'urn:entity:restaurant',
      'technology': 'urn:entity:app',
      'activities': 'urn:entity:activity'
    };

    return mapping[category] || null;
  }

  // Calculate match confidence
  private calculateMatchConfidence(searchTerm: string, qlooName: string): number {
    const term = searchTerm.toLowerCase();
    const name = qlooName.toLowerCase();

    if (name === term) return 1.0;
    if (name.includes(term) || term.includes(name)) return 0.9;
    
    // Simple similarity check
    const termWords = term.split(' ');
    const nameWords = name.split(' ');
    const commonWords = termWords.filter(word => nameWords.includes(word));
    
    if (commonWords.length > 0) {
      return 0.7 + (commonWords.length / Math.max(termWords.length, nameWords.length)) * 0.2;
    }

    return 0.5;
  }

  // Extract interests from a single message
  async extractFromMessage(message: string): Promise<ExtractedInterest[]> {
    return this.extractFromConversation([{ role: 'user', content: message }]);
  }

  // Get all available tag types
  async getAvailableTagTypes(): Promise<any[]> {
    if (this.cachedTagTypes.length === 0) {
      await this.initialize();
    }
    return this.cachedTagTypes;
  }
} 