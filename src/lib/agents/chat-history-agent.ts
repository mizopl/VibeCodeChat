import { getDatabaseService } from '../database/database';
import { getEntity } from '../qloo/api';
import { QlooParameters } from '../../types';

export interface ChatHistoryQuery {
  query: string;
  sessionId: string;
  entityName?: string;
  entityType?: string;
  includeMessages?: boolean;
  includeEntities?: boolean;
}

export interface ChatHistoryResult {
  found: boolean;
  entities: any[];
  messages: any[];
  entityDetails?: any;
  source: 'database' | 'api' | 'not_found';
}

export class ChatHistoryAgent {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  async searchChatHistory(query: ChatHistoryQuery): Promise<ChatHistoryResult> {
    console.log('🔍 ChatHistoryAgent: Searching chat history for:', query);
    
    try {
      // Step 1: Search for entities in database
      const databaseEntities = await this.searchEntitiesInDatabase(query);
      
      if (databaseEntities.length > 0) {
        console.log('✅ Found entities in database:', databaseEntities.length);
        
        // If user is asking about a specific entity, get its details
        let entityDetails = null;
        if (query.entityName) {
          entityDetails = databaseEntities.find(e => 
            e.name.toLowerCase().includes(query.entityName!.toLowerCase())
          );
        }
        
        return {
          found: true,
          entities: databaseEntities,
          messages: query.includeMessages ? await this.getRelevantMessages(query.query) : [],
          entityDetails,
          source: 'database'
        };
      }
      
      // Step 2: If no entities found in database and user is asking about a specific entity,
      // try to fetch it from Qloo API
      if (query.entityName) {
        console.log('🔍 Entity not found in database, trying Qloo API for:', query.entityName);
        const apiEntity = await this.fetchEntityFromAPI(query.entityName, query.entityType);
        
        if (apiEntity) {
          console.log('✅ Found entity via API:', apiEntity.name);
          return {
            found: true,
            entities: [apiEntity],
            messages: query.includeMessages ? await this.getRelevantMessages(query.query) : [],
            entityDetails: apiEntity,
            source: 'api'
          };
        }
      }
      
      // Step 3: If still no results, return not found
      console.log('❌ No entities found in database or API');
      return {
        found: false,
        entities: [],
        messages: query.includeMessages ? await this.getRelevantMessages(query.query) : [],
        source: 'not_found'
      };
      
    } catch (error) {
      console.error('❌ ChatHistoryAgent error:', error);
      return {
        found: false,
        entities: [],
        messages: [],
        source: 'not_found'
      };
    }
  }

  private async searchEntitiesInDatabase(query: ChatHistoryQuery): Promise<any[]> {
    try {
      const sessionEntities = await databaseService.getSessionEntities(this.sessionId);
      
      if (!sessionEntities || sessionEntities.length === 0) {
        return [];
      }
      
      // Filter entities based on query
      const queryLower = query.query.toLowerCase();
      const entityNameLower = query.entityName?.toLowerCase();
      
      return sessionEntities.filter(entity => {
        // If user specified an entity name, prioritize exact matches
        if (entityNameLower) {
          return entity.name.toLowerCase().includes(entityNameLower) ||
                 entity.description?.toLowerCase().includes(entityNameLower);
        }
        
        // Otherwise, search in entity name, description, and type
        return entity.name.toLowerCase().includes(queryLower) ||
               entity.description?.toLowerCase().includes(queryLower) ||
               entity.type.toLowerCase().includes(queryLower);
      });
    } catch (error) {
      console.error('❌ Error searching entities in database:', error);
      return [];
    }
  }

  private async getRelevantMessages(query: string): Promise<any[]> {
    try {
      const session = await databaseService.getChatSession(this.sessionId);
      if (!session?.messages) {
        return [];
      }
      
      const queryLower = query.toLowerCase();
      
      // Filter messages that contain the query terms
      return session.messages.filter(message => 
        message.content.toLowerCase().includes(queryLower)
      ).slice(-10); // Return last 10 relevant messages
    } catch (error) {
      console.error('❌ Error getting relevant messages:', error);
      return [];
    }
  }

  private async fetchEntityFromAPI(entityName: string, entityType?: string): Promise<any | null> {
    try {
      console.log('🔍 Fetching entity from Qloo API:', entityName, entityType);
      
      const params: QlooParameters = {
        query: entityName,
        limit: 5,
        targetAPI: 'GETENTITY'
      };
      
      if (entityType) {
        params.entityType = entityType;
      }
      
      const response = await getEntity(params, this.sessionId, 'summary');
      
      if (response.success && response.data?.entities && response.data.entities.length > 0) {
        // Return the best match (first result)
        const entity = response.data.entities[0];
        console.log('✅ Successfully fetched entity from API:', entity.name);
        return entity;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error fetching entity from API:', error);
      return null;
    }
  }

  async getEntityDetails(entityName: string, entityType?: string): Promise<any | null> {
    try {
      // First try to find in database
      const sessionEntities = await databaseService.getSessionEntities(this.sessionId);
      const databaseEntity = sessionEntities.find(e => 
        e.name.toLowerCase().includes(entityName.toLowerCase())
      );
      
      if (databaseEntity) {
        console.log('✅ Found entity in database:', databaseEntity.name);
        return databaseEntity;
      }
      
      // If not in database, fetch from API
      console.log('🔍 Entity not in database, fetching from API:', entityName);
      return await this.fetchEntityFromAPI(entityName, entityType);
      
    } catch (error) {
      console.error('❌ Error getting entity details:', error);
      return null;
    }
  }
} 