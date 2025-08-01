import { getDatabaseService } from '@/lib/database/database';
import { getEntity } from '@/lib/qloo/api';
import { QlooParameters } from '@/types';

export interface EntityRetrievalResult {
  success: boolean;
  entity?: {
    id: string;
    qlooId: string;
    name: string;
    type: string;
    description?: string;
    confidence: number;
    source: string;
    timestamp: string;
    metadata: any;
  };
  answer?: string;
  error?: string;
  source: 'database' | 'api' | 'not_found';
}

export class EntityRetrievalTool {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Retrieve entity information and answer questions about it
   */
  async retrieveAndAnswer(
    entityName: string,
    question?: string
  ): Promise<EntityRetrievalResult> {
    try {
      console.log('🔍 EntityRetrievalTool: Searching for entity:', entityName);
      
      // First, try to find the entity in the database
      const dbEntity = await this.findEntityInDatabase(entityName);
      
      if (dbEntity) {
        console.log('✅ Found entity in database:', dbEntity.name);
        const answer = this.generateAnswer(dbEntity, question);
        return {
          success: true,
          entity: dbEntity,
          answer,
          source: 'database'
        };
      }

      // If not found in database, search via Qloo API
      console.log('🔍 Entity not found in database, searching via Qloo API');
      const apiEntity = await this.searchEntityViaAPI(entityName);
      
      if (apiEntity) {
        console.log('✅ Found entity via API:', apiEntity.name);
        const answer = this.generateAnswer(apiEntity, question);
        return {
          success: true,
          entity: apiEntity,
          answer,
          source: 'api'
        };
      }

      // Entity not found anywhere
      console.log('❌ Entity not found:', entityName);
      return {
        success: false,
        error: `I couldn't find any information about "${entityName}". This entity might not exist in our database or the Qloo API.`,
        source: 'not_found'
      };

    } catch (error) {
      console.error('❌ Error in EntityRetrievalTool:', error);
      return {
        success: false,
        error: `I encountered an error while searching for "${entityName}". Please try again.`,
        source: 'not_found'
      };
    }
  }

  /**
   * Search for entity in the database
   */
  private async findEntityInDatabase(entityName: string) {
    try {
      const databaseService = getDatabaseService();
      const entities = await databaseService.getSessionEntities(this.sessionId);
      
      // Find the best match by name similarity
      const bestMatch = entities.find(entity => 
        entity.name.toLowerCase().includes(entityName.toLowerCase()) ||
        entityName.toLowerCase().includes(entity.name.toLowerCase())
      );

      if (bestMatch) {
        return {
          id: bestMatch.id,
          qlooId: bestMatch.qlooId,
          name: bestMatch.name,
          type: bestMatch.type || 'unknown',
          description: bestMatch.description,
          confidence: bestMatch.confidence,
          source: bestMatch.source,
          timestamp: bestMatch.timestamp.toISOString(),
          metadata: bestMatch.metadata
        };
      }

      return null;
    } catch (error) {
      console.error('❌ Error searching database:', error);
      return null;
    }
  }

  /**
   * Search for entity via Qloo API and store in database
   */
  private async searchEntityViaAPI(entityName: string) {
    try {
      const params: QlooParameters = {
        query: entityName,
        limit: 5, // Get multiple results to find the best match
        entityType: undefined, // Let the API determine the type
        explainability: true
      };

      const response = await getEntity(params, this.sessionId);
      
      if (response.data && response.data.entities && response.data.entities.length > 0) {
        // Find the best match from API results
        const bestMatch = response.data.entities.find(entity => 
          entity.name.toLowerCase().includes(entityName.toLowerCase()) ||
          entityName.toLowerCase().includes(entity.name.toLowerCase())
        );

        if (bestMatch) {
          // The entity will be automatically stored in database by the getEntity function
          return {
            id: bestMatch.entity_id || bestMatch.id,
            qlooId: bestMatch.entity_id || bestMatch.id,
            name: bestMatch.name,
            type: bestMatch.type || 'unknown',
            description: bestMatch.description || bestMatch.properties?.description,
            confidence: bestMatch.confidence || 0.8,
            source: 'entity-search',
            timestamp: new Date().toISOString(),
            metadata: {
              ...bestMatch.properties,
              imageUrl: bestMatch.properties?.image?.url || bestMatch.properties?.image_url,
              originalData: bestMatch
            }
          };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error searching via API:', error);
      return null;
    }
  }

  /**
   * Generate an answer about the entity based on the question
   */
  private generateAnswer(entity: any, question?: string): string {
    const questionLower = question?.toLowerCase() || '';
    
    // Extract key information from entity
    const name = entity.name;
    const type = entity.type || 'entity';
    const description = entity.description || entity.metadata?.description;
    const imageUrl = entity.metadata?.imageUrl;
    const confidence = entity.confidence;
    const source = entity.source;
    const timestamp = new Date(entity.timestamp).toLocaleDateString();

    // Generate different answers based on the question type
    if (questionLower.includes('what') || questionLower.includes('tell me about') || questionLower.includes('describe')) {
      let answer = `**${name}** is a ${type}`;
      
      if (description) {
        answer += `: ${description}`;
      }
      
      if (imageUrl) {
        answer += `\n\n📸 [View Image](${imageUrl})`;
      }
      
      answer += `\n\n📊 **Details:**`;
      answer += `\n• Type: ${type}`;
      answer += `\n• Confidence: ${Math.round(confidence * 100)}%`;
      answer += `\n• Source: ${source}`;
      answer += `\n• Discovered: ${timestamp}`;
      
      return answer;
    }
    
    if (questionLower.includes('when') || questionLower.includes('time')) {
      return `**${name}** was discovered on ${timestamp} through our ${source} system.`;
    }
    
    if (questionLower.includes('where') || questionLower.includes('location')) {
      if (entity.metadata?.location) {
        return `**${name}** is located in ${entity.metadata.location}.`;
      } else {
        return `I don't have specific location information for **${name}**, but it was discovered through our ${source} system.`;
      }
    }
    
    if (questionLower.includes('how') || questionLower.includes('confidence')) {
      return `**${name}** has a confidence score of ${Math.round(confidence * 100)}%, which indicates how reliable this information is. It was discovered through our ${source} system.`;
    }
    
    if (questionLower.includes('why') || questionLower.includes('reason')) {
      return `**${name}** was discovered because it matches your interests and preferences. Our system found it through ${source} and determined it's relevant to you with ${Math.round(confidence * 100)}% confidence.`;
    }
    
    // Default answer
    return `**${name}** is a ${type} that was discovered through our ${source} system with ${Math.round(confidence * 100)}% confidence. ${description ? `\n\n${description}` : ''}`;
  }

  /**
   * Get all entities from database for this session
   */
  async getAllEntities() {
    try {
      const databaseService = getDatabaseService();
      const entities = await databaseService.getSessionEntities(this.sessionId);
      return entities.map(entity => ({
        id: entity.id,
        qlooId: entity.qlooId,
        name: entity.name,
        type: entity.type || 'unknown',
        description: entity.description,
        confidence: entity.confidence,
        source: entity.source,
        timestamp: entity.timestamp.toISOString(),
        metadata: entity.metadata
      }));
    } catch (error) {
      console.error('❌ Error getting all entities:', error);
      return [];
    }
  }

  /**
   * Search for entities by type
   */
  async searchByType(entityType: string) {
    try {
      const allEntities = await this.getAllEntities();
      return allEntities.filter(entity => 
        entity.type.toLowerCase().includes(entityType.toLowerCase()) ||
        entityType.toLowerCase().includes(entity.type.toLowerCase())
      );
    } catch (error) {
      console.error('❌ Error searching by type:', error);
      return [];
    }
  }
} 