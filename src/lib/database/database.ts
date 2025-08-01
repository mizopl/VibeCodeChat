import { kv } from '@vercel/kv';

// Database service class using Vercel KV
export class DatabaseService {
  private kv: typeof kv;

  constructor() {
    this.kv = kv;
    console.log('✅ DatabaseService initialized with Vercel KV');
  }

  // Chat Session Management
  async createChatSession(personaId?: string, debugMode: boolean = false) {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const session = {
        id: sessionId,
        personaId,
        debugMode,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        apiCalls: [],
        tokenUsage: [],
        entities: [],
        structuredExtractions: [],
        personalInterests: [],
        audienceCharacteristics: [],
        recommendationFeedback: [],
      };

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Created chat session:', sessionId);
      return session;
    } catch (error) {
      console.error('❌ Failed to create chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  async getChatSession(sessionId: string) {
    try {
      const session = await this.kv.get(`session:${sessionId}`);
      if (!session) {
        console.log('⚠️ Session not found:', sessionId);
        return null;
      }
      return session as any;
    } catch (error) {
      console.error('❌ Failed to get chat session:', error);
      return null;
    }
  }

  async deleteChatSession(sessionId: string) {
    try {
      await this.kv.del(`session:${sessionId}`);
      console.log('✅ Deleted chat session:', sessionId);
      return true;
    } catch (error) {
      console.error('❌ Failed to delete chat session:', error);
      return false;
    }
  }

  async updateChatSession(sessionId: string, data: { personaId?: string; debugMode?: boolean }) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return null;
      }

      const updatedSession = {
        ...session,
        ...data,
        updatedAt: new Date().toISOString(),
      };

      await this.kv.set(`session:${sessionId}`, updatedSession);
      return updatedSession;
    } catch (error) {
      console.error('❌ Failed to update chat session:', error);
      return null;
    }
  }

  // Message Management
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string, usage?: any, metadata?: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const messageId = `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        id: messageId,
        sessionId,
        role,
        content,
        timestamp: new Date().toISOString(),
        usage: usage ? JSON.parse(JSON.stringify(usage)) : null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      };

      session.messages = (session.messages || []).concat(message);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Added message to session:', sessionId);
      return message;
    } catch (error) {
      console.error('❌ Failed to add message:', error);
      throw new Error('Failed to add message');
    }
  }

  async getMessages(sessionId: string, limit?: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      const messages = session.messages || [];
      return limit ? messages.slice(-limit) : messages;
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  async deleteMessage(messageId: string, sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return false;
      }

      const initialMessageCount = session.messages?.length || 0;
      session.messages = (session.messages || []).filter(msg => msg.id !== messageId);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      return initialMessageCount > (session.messages || []).length;
    } catch (error) {
      console.error('❌ Failed to delete message:', error);
      return false;
    }
  }

  // API Call Tracking
  async logApiCall(
    sessionId: string,
    endpoint: string,
    method: string,
    parameters: any,
    response?: any,
    status: number = 200,
    duration: number = 0,
    error?: string
  ) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const apiCallId = `api_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const apiCall = {
        id: apiCallId,
        sessionId,
        endpoint,
        method,
        parameters: JSON.parse(JSON.stringify(parameters)),
        response: response ? JSON.parse(JSON.stringify(response)) : null,
        status,
        duration,
        timestamp: new Date().toISOString(),
        error,
      };

      session.apiCalls = (session.apiCalls || []).concat(apiCall);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Logged API call:', endpoint);
      return apiCall;
    } catch (error) {
      console.error('❌ Failed to log API call:', error);
      throw new Error('Failed to log API call');
    }
  }

  async getApiCalls(sessionId: string, limit?: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      const apiCalls = session.apiCalls || [];
      return limit ? apiCalls.slice(-limit) : apiCalls;
    } catch (error) {
      console.error('❌ Failed to get API calls:', error);
      return [];
    }
  }

  // Token Usage Tracking
  async logTokenUsage(
    sessionId: string,
    promptTokens: number,
    completionTokens: number,
    totalTokens: number,
    cost: number,
    source: 'chat' | 'api_call' | 'structured_extraction'
  ) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const tokenUsageId = `token_usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const tokenUsage = {
        id: tokenUsageId,
        sessionId,
        promptTokens,
        completionTokens,
        totalTokens,
        cost,
        source,
        timestamp: new Date().toISOString(),
      };

      session.tokenUsage = (session.tokenUsage || []).concat(tokenUsage);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Logged token usage:', totalTokens);
      return tokenUsage;
    } catch (error) {
      console.error('❌ Failed to log token usage:', error);
      throw new Error('Failed to log token usage');
    }
  }

  async getTokenUsage(sessionId: string, limit?: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      const tokenUsage = session.tokenUsage || [];
      return limit ? tokenUsage.slice(-limit) : tokenUsage;
    } catch (error) {
      console.error('❌ Failed to get token usage:', error);
      return [];
    }
  }

  async getTotalTokenUsage(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 };
      }

      const usage = (session.tokenUsage || []).reduce((sum, usage) => ({
        totalPromptTokens: sum.totalPromptTokens + usage.promptTokens,
        totalCompletionTokens: sum.totalCompletionTokens + usage.completionTokens,
        totalTokens: sum.totalTokens + usage.totalTokens,
        totalCost: sum.totalCost + usage.cost,
      }), { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 });

      return usage;
    } catch (error) {
      console.error('❌ Failed to get total token usage:', error);
      return { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 };
    }
  }

  // Structured Extraction Results
  async logStructuredExtraction(
    sessionId: string,
    query: string,
    parameters: any,
    confidence: number,
    reasoning: string,
    extractedFields: string[]
  ) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const extractionId = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const extraction = {
        id: extractionId,
        sessionId,
        query,
        parameters: JSON.parse(JSON.stringify(parameters)),
        confidence,
        reasoning,
        extractedFields: JSON.parse(JSON.stringify(extractedFields)),
        timestamp: new Date().toISOString(),
      };

      session.structuredExtractions = (session.structuredExtractions || []).concat(extraction);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Logged structured extraction');
      return extraction;
    } catch (error) {
      console.error('❌ Failed to log structured extraction:', error);
      throw new Error('Failed to log structured extraction');
    }
  }

  async getStructuredExtractions(sessionId: string, limit?: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      const extractions = session.structuredExtractions || [];
      return limit ? extractions.slice(-limit) : extractions;
    } catch (error) {
      console.error('❌ Failed to get structured extractions:', error);
      return [];
    }
  }

  // Analytics and Reporting
  async getSessionAnalytics(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return { session: null, totalUsage: { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 }, apiCallCount: 0, extractionCount: 0, messageCount: 0, averageConfidence: 0 };
      }

      const totalUsage = await this.getTotalTokenUsage(sessionId);
      const apiCalls = await this.getApiCalls(sessionId);
      const extractions = await this.getStructuredExtractions(sessionId);

      return {
        session,
        totalUsage,
        apiCallCount: apiCalls.length,
        extractionCount: extractions.length,
        messageCount: session.messages?.length || 0,
        averageConfidence: extractions.length > 0 
          ? extractions.reduce((sum, ext) => sum + ext.confidence, 0) / extractions.length 
          : 0,
      };
    } catch (error) {
      console.error('❌ Failed to get session analytics:', error);
      return { session: null, totalUsage: { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 }, apiCallCount: 0, extractionCount: 0, messageCount: 0, averageConfidence: 0 };
    }
  }

  // Global token usage tracking
  async saveTokenUsage(tokenUsage: any) {
    try {
      const globalKey = 'global_token_usage';
      let globalUsage = await this.kv.get(globalKey) as any;

      if (!globalUsage) {
        globalUsage = {
          id: 'global',
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalTokens: 0,
          sessionTokens: 0,
          lastUpdated: new Date().toISOString(),
          costEstimate: 0,
        };
      }

      globalUsage.totalPromptTokens += tokenUsage.totalPromptTokens || 0;
      globalUsage.totalCompletionTokens += tokenUsage.totalCompletionTokens || 0;
      globalUsage.totalTokens += tokenUsage.totalTokens || 0;
      globalUsage.sessionTokens += tokenUsage.totalTokens || 0;
      globalUsage.costEstimate += tokenUsage.cost || 0;
      globalUsage.lastUpdated = new Date().toISOString();

      await this.kv.set(globalKey, globalUsage);
      console.log('✅ Updated global token usage');
      return globalUsage;
    } catch (error) {
      console.error('❌ Failed to save global token usage:', error);
      return null;
    }
  }

  async getGlobalTokenUsage(): Promise<any> {
    try {
      const globalUsage = await this.kv.get('global_token_usage');
      if (!globalUsage) {
        console.log('⚠️ No global token usage found');
        return {
          id: 'global',
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          totalTokens: 0,
          sessionTokens: 0,
          lastUpdated: new Date().toISOString(),
          costEstimate: 0,
        };
      }
      return globalUsage;
    } catch (error) {
      console.error('❌ Failed to get global token usage:', error);
      return {
        id: 'global',
        totalPromptTokens: 0,
        totalCompletionTokens: 0,
        totalTokens: 0,
        sessionTokens: 0,
        lastUpdated: new Date().toISOString(),
        costEstimate: 0,
      };
    }
  }

  // Entity Management
  async storeEntity(sessionId: string, entityData: {
    qlooId: string;
    name: string;
    type: string;
    subtype?: string;
    description?: string;
    metadata: any;
    tags?: any[];
    location?: any;
    confidence: number;
    source: string;
  }) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const entity = {
        id: entityId,
        sessionId,
        qlooId: entityData.qlooId,
        name: entityData.name,
        type: entityData.type,
        subtype: entityData.subtype,
        description: entityData.description,
        metadata: entityData.metadata,
        tags: entityData.tags || [],
        location: entityData.location,
        confidence: entityData.confidence,
        source: entityData.source,
        timestamp: new Date().toISOString(),
      };

      // Check if entity already exists
      const existingEntity = (session.entities || []).find(e => e.qlooId === entityData.qlooId);
      if (existingEntity) {
        console.log('✅ Entity already exists:', entityData.name);
        return existingEntity;
      }

      session.entities = (session.entities || []).concat(entity);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Stored entity:', entityData.name);
      return entity;
    } catch (error) {
      console.error('❌ Failed to store entity:', error);
      throw new Error('Failed to store entity');
    }
  }

  async storeEntitiesFromResponse(sessionId: string, entities: any[], source: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const storedEntities = [];
      for (const entity of entities) {
        try {
          const storedEntity = await this.storeEntity(sessionId, {
            qlooId: entity.id || entity.qlooId || `entity_${Date.now()}`,
            name: entity.name || entity.title || 'Unknown Entity',
            type: entity.type || entity.entityType || 'unknown',
            subtype: entity.subtype,
            description: entity.description || entity.summary,
            metadata: entity,
            tags: entity.tags || [],
            location: entity.location,
            confidence: entity.confidence || 0.5,
            source,
          });
          storedEntities.push(storedEntity);
        } catch (error) {
          console.error('❌ Failed to store individual entity:', error);
        }
      }

      console.log(`✅ Stored ${storedEntities.length} entities from ${source}`);
      return storedEntities;
    } catch (error) {
      console.error('❌ Failed to store entities from response:', error);
      throw new Error('Failed to store entities from response');
    }
  }

  // Get entities for a session
  async getSessionEntities(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      return session.entities || [];
    } catch (error) {
      console.error('❌ Failed to get session entities:', error);
      return [];
    }
  }

  // Search entities by name or description
  async searchEntities(sessionId: string, searchTerm: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }

      const searchLower = searchTerm.toLowerCase();
      return (session.entities || []).filter(entity => 
        entity.name.toLowerCase().includes(searchLower) || 
        entity.description?.toLowerCase().includes(searchLower) || 
        entity.type.toLowerCase().includes(searchLower)
      );
    } catch (error) {
      console.error('❌ Failed to search entities:', error);
      return [];
    }
  }

  // Get session with all details including entities
  async getSessionWithDetails(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return null;
      }

      return {
        ...session,
        messages: (session.messages || []).map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          usage: msg.usage,
          metadata: msg.metadata,
        })),
        apiCalls: (session.apiCalls || []).map(call => ({
          id: call.id,
          endpoint: call.endpoint,
          method: call.method,
          parameters: call.parameters,
          response: call.response,
          status: call.status,
          duration: call.duration,
          timestamp: call.timestamp,
          error: call.error,
        })),
        tokenUsage: (session.tokenUsage || []).map(usage => ({
          id: usage.id,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
          cost: usage.cost,
          source: usage.source,
          timestamp: usage.timestamp,
        })),
        structuredExtractions: (session.structuredExtractions || []).map(ext => ({
          id: ext.id,
          query: ext.query,
          parameters: ext.parameters,
          confidence: ext.confidence,
          reasoning: ext.reasoning,
          extractedFields: ext.extractedFields,
          timestamp: ext.timestamp,
        })),
        entities: (session.entities || []).map(e => ({
          id: e.id,
          qlooId: e.qlooId,
          name: e.name,
          type: e.type,
          subtype: e.subtype,
          description: e.description,
          metadata: e.metadata,
          tags: e.tags,
          location: e.location,
          confidence: e.confidence,
          source: e.source,
          timestamp: e.timestamp,
        })),
      };
    } catch (error) {
      console.error('❌ Failed to get session with details:', error);
      return null;
    }
  }

  // Get all sessions with entity counts
  async getSessionsWithEntityCounts() {
    try {
      const sessionKeys = await this.kv.keys('session:*');
      const sessions = [];

      for (const key of sessionKeys) {
        const sessionId = key.replace('session:', '');
        const session = await this.getChatSession(sessionId);
        if (session) {
          sessions.push({
            id: session.id,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            personaId: session.personaId,
            personaName: session.persona?.name || 'Unknown Persona',
            personaLocation: session.persona?.location,
            debugMode: session.debugMode,
            messageCount: (session.messages || []).length,
            apiCallCount: (session.apiCalls || []).length,
            tokenUsageCount: (session.tokenUsage || []).length,
            entityCount: (session.entities || []).length,
            lastMessage: (session.messages || [])[0]?.content || '',
            totalTokens: (session.tokenUsage || []).reduce((sum, usage) => sum + usage.totalTokens, 0),
            totalCost: (session.tokenUsage || []).reduce((sum, usage) => sum + usage.cost, 0),
            recentEntities: (session.entities || []).map(e => e.name).slice(0, 5),
          });
        }
      }

      return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    } catch (error) {
      console.error('❌ Failed to get sessions with entity counts:', error);
      return [];
    }
  }

  // Cleanup old sessions (for maintenance)
  async cleanupOldSessions(daysOld: number = 30) {
    try {
      const sessionKeys = await this.kv.keys('session:*');
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      let deletedCount = 0;

      for (const key of sessionKeys) {
        const sessionId = key.replace('session:', '');
        const session = await this.getChatSession(sessionId);
        if (session && new Date(session.createdAt) < cutoffDate) {
          await this.kv.del(key);
          deletedCount++;
        }
      }

      console.log(`🧹 Cleanup: Deleted ${deletedCount} sessions from KV storage.`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to cleanup old sessions:', error);
      return 0;
    }
  }

  // Personal Interests
  async storePersonalInterest(
    sessionId: string,
    category: string,
    name: string,
    entityId?: string,
    confidence: number = 0.5,
    source: string = 'inferred',
    metadata?: any
  ) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      // Ensure persona exists
      await this.getOrCreatePersona(sessionId);
      
      const interestId = `interest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const interest = {
        id: interestId,
        sessionId,
        category,
        name,
        entityId,
        confidence,
        source,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      session.personalInterests = (session.personalInterests || []).concat(interest);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Stored personal interest:', name);
      return interest;
    } catch (error) {
      console.error('❌ Failed to store personal interest:', error);
      throw new Error('Failed to store personal interest');
    }
  }

  async getPersonalInterests(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      return session.personalInterests || [];
    } catch (error) {
      console.error('❌ Failed to get personal interests:', error);
      return [];
    }
  }

  async updatePersonalInterestEntityId(interestId: string, entityId: string) {
    try {
      const sessionId = interestId.split('_')[0];
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }
      const interest = (session.personalInterests || []).find(i => i.id === interestId);
      if (interest) {
        interest.entityId = entityId;
        session.updatedAt = new Date().toISOString();
        await this.kv.set(`session:${sessionId}`, session);
        return interest;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to update personal interest entity ID:', error);
      return null;
    }
  }

  async updatePersonalInterestConfidence(sessionId: string, interestName: string, delta: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }
      const interest = (session.personalInterests || []).find(i => i.name === interestName);
      if (interest) {
        interest.confidence = Math.max(0, Math.min(1, interest.confidence + delta));
        session.updatedAt = new Date().toISOString();
        await this.kv.set(`session:${sessionId}`, session);
        return interest;
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to update personal interest confidence:', error);
      return null;
    }
  }

  // Audience Characteristics
  async storeAudienceCharacteristic(
    sessionId: string,
    audienceType: string,
    audienceId: string,
    name: string,
    confidence: number = 0.5,
    metadata?: any
  ) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const characteristicId = `characteristic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const characteristic = {
        id: characteristicId,
        sessionId,
        audienceType,
        audienceId,
        name,
        confidence,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      session.audienceCharacteristics = (session.audienceCharacteristics || []).concat(characteristic);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Stored audience characteristic:', name);
      return characteristic;
    } catch (error) {
      console.error('❌ Failed to store audience characteristic:', error);
      throw new Error('Failed to store audience characteristic');
    }
  }

  async getAudienceCharacteristics(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      return session.audienceCharacteristics || [];
    } catch (error) {
      console.error('❌ Failed to get audience characteristics:', error);
      return [];
    }
  }

  // Persona Management
  async createPersona(sessionId: string, demographics?: any, name?: string, location?: string, gender?: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const personaId = `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const persona = {
        id: personaId,
        sessionId,
        name,
        location,
        gender,
        demographics: demographics ? JSON.parse(JSON.stringify(demographics)) : null,
        confidence: 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      session.persona = persona;
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Created persona for session:', sessionId);
      return persona;
    } catch (error) {
      console.error('❌ Failed to create persona:', error);
      throw new Error('Failed to create persona');
    }
  }

  async updatePersonaDemographics(sessionId: string, demographics: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      session.persona = { ...session.persona, demographics: JSON.parse(JSON.stringify(demographics)) };
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      return session.persona;
    } catch (error) {
      console.error('❌ Failed to update persona demographics:', error);
      return null;
    }
  }

  async getPersona(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return null;
      }

      if (!session.persona) {
        return null;
      }

      return {
        ...session.persona,
        personalInterests: (session.personalInterests || []).map(i => ({
          ...i,
          metadata: i.metadata ? JSON.parse(JSON.stringify(i.metadata)) : null,
        })),
        audienceCharacteristics: (session.audienceCharacteristics || []).map(c => ({
          ...c,
          metadata: c.metadata ? JSON.parse(JSON.stringify(c.metadata)) : null,
        })),
      };
    } catch (error) {
      console.error('❌ Failed to get persona:', error);
      return null;
    }
  }

  async getOrCreatePersona(sessionId: string, demographics?: any, name?: string, location?: string, gender?: string) {
    try {
      let persona = await this.getPersona(sessionId);
      
      if (!persona) {
        console.log('🔍 Creating persona...');
        persona = await this.createPersona(sessionId, demographics, name, location, gender);
      }
      
      return persona;
    } catch (error) {
      console.error('❌ Failed to get or create persona:', error);
      throw new Error('Failed to get or create persona');
    }
  }

  async updatePersonaConfidence(sessionId: string, confidence: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      session.persona = { ...session.persona, confidence: confidence };
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      return session.persona;
    } catch (error) {
      console.error('❌ Failed to update persona confidence:', error);
      return null;
    }
  }

  // Recommendation Feedback
  async storeRecommendationFeedback(
    sessionId: string,
    recommendationId: string,
    recommendationType: string,
    recommendationName: string,
    rating: number,
    feedback: string,
    comment?: string,
    metadata?: any
  ) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const feedback = {
        id: feedbackId,
        sessionId,
        recommendationId,
        recommendationType,
        recommendationName,
        rating,
        feedback,
        comment,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      session.recommendationFeedback = (session.recommendationFeedback || []).concat(feedback);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      console.log('✅ Stored recommendation feedback');
      return feedback;
    } catch (error) {
      console.error('❌ Failed to store recommendation feedback:', error);
      throw new Error('Failed to store recommendation feedback');
    }
  }

  async getRecommendationFeedback(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        return [];
      }
      return session.recommendationFeedback || [];
    } catch (error) {
      console.error('❌ Failed to get recommendation feedback:', error);
      return [];
    }
  }

  // Utility methods
  async addExplicitInterest(sessionId: string, category: string, name: string, confidence: number = 0.9) {
    return await this.storePersonalInterest(sessionId, category, name, undefined, confidence, 'explicit');
  }

  async updatePersona(sessionId: string, data: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found.`);
      }

      session.persona = { ...session.persona, ...data };
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      return session.persona;
    } catch (error) {
      console.error('❌ Failed to update persona:', error);
      return null;
    }
  }

  async addPersonalInterest(sessionId: string, data: {
    category: string;
    name: string;
    entityId?: string;
    confidence: number;
    source: string;
    metadata?: any;
  }) {
    return await this.storePersonalInterest(
      sessionId,
      data.category,
      data.name,
      data.entityId,
      data.confidence,
      data.source,
      data.metadata
    );
  }

  async addAudienceCharacteristic(sessionId: string, data: {
    type: string;
    name: string;
    confidence: number;
    metadata?: any;
  }) {
    return await this.storeAudienceCharacteristic(
      sessionId,
      data.type,
      `audience_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      data.name,
      data.confidence,
      data.metadata
    );
  }
}

// Export singleton instance
export const databaseService = new DatabaseService(); 