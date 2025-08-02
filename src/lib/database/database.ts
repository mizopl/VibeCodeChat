import { createClient } from 'redis';

// Database service class using Redis directly
export class DatabaseService {
  private redisClient: any;
  private redisUrl: string | undefined;

  constructor() {
    this.redisUrl = process.env.REDIS_URL;
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      if (!this.redisUrl) {
        throw new Error('REDIS_URL is required');
      }

      this.redisClient = createClient({
        url: this.redisUrl
      });

      this.redisClient.on('error', (err: any) => {
        console.error('❌ Redis Client Error:', err);
      });

      await this.redisClient.connect();
      console.log('✅ DatabaseService initialized with Redis');
    } catch (error) {
      console.error('❌ Failed to initialize Redis:', error);
      throw error;
    }
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
        qlooResponses: []
      };

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      console.log(`✅ Created chat session: ${sessionId}`);
      return session;
    } catch (error) {
      console.error('❌ Failed to create chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  async getChatSession(sessionId: string) {
    try {
      const sessionData = await this.redisClient.get(`session:${sessionId}`);
      if (!sessionData) {
        console.log(`❌ Session not found: ${sessionId}`);
        return null;
      }
      const session = JSON.parse(sessionData);
      console.log(`✅ Retrieved session: ${sessionId}`);
      return session;
    } catch (error) {
      console.error('❌ Failed to get chat session:', error);
      return null;
    }
  }

  async updateChatSession(sessionId: string, updates: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const updatedSession = {
        ...session,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(updatedSession));
      console.log(`✅ Updated session: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      console.error('❌ Failed to update chat session:', error);
      throw error;
    }
  }

  // Message Management
  async addMessage(sessionId: string, role: string, content: string, message?: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const messageWithId = {
        id: messageId,
        role,
        content,
        timestamp: new Date().toISOString(),
        ...message
      };

      session.messages.push(messageWithId);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`message:${messageId}`, JSON.stringify(messageWithId));
      
      console.log(`✅ Added message to session: ${sessionId}`);
      return messageWithId;
    } catch (error) {
      console.error('❌ Failed to add message:', error);
      throw error;
    }
  }

  async getMessages(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      return session?.messages || [];
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  // Persona Management
  async createPersona(
    sessionId: string, 
    personaData: any, 
    name?: string, 
    location?: string, 
    gender?: string
  ) {
    try {
      const personaId = `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const persona = {
        id: personaId,
        sessionId,
        name: name || personaData.name || 'Unknown',
        location: location || personaData.location || 'Unknown',
        gender: gender || personaData.gender || 'Unknown',
        demographics: personaData.demographics || personaData,
        confidence: personaData.confidence || 0.5,
        ...personaData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.redisClient.set(`persona:${personaId}`, JSON.stringify(persona));
      await this.redisClient.set(`session:${sessionId}:persona`, JSON.stringify(persona));
      
      console.log(`✅ Created persona: ${personaId}`);
      return persona;
    } catch (error) {
      console.error('❌ Failed to create persona:', error);
      throw error;
    }
  }

  async getPersona(sessionId: string) {
    try {
      const personaData = await this.redisClient.get(`session:${sessionId}:persona`);
      if (!personaData) {
        return null;
      }
      return JSON.parse(personaData);
    } catch (error) {
      console.error('❌ Failed to get persona:', error);
      return null;
    }
  }

  async updatePersona(sessionId: string, updates: any) {
    try {
      const persona = await this.getPersona(sessionId);
      if (!persona) {
        throw new Error('Persona not found');
      }

      const updatedPersona = {
        ...persona,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await this.redisClient.set(`persona:${persona.id}`, JSON.stringify(updatedPersona));
      await this.redisClient.set(`session:${sessionId}:persona`, JSON.stringify(updatedPersona));
      
      console.log(`✅ Updated persona: ${persona.id}`);
      return updatedPersona;
    } catch (error) {
      console.error('❌ Failed to update persona:', error);
      throw error;
    }
  }

  // Token Usage Tracking
  async addTokenUsage(sessionId: string, usage: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const usageId = `usage_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const usageWithId = {
        ...usage,
        id: usageId,
        sessionId,
        timestamp: new Date().toISOString()
      };

      session.tokenUsage.push(usageWithId);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`usage:${usageId}`, JSON.stringify(usageWithId));
      
      console.log(`✅ Added token usage: ${usageId}`);
      return usageWithId;
    } catch (error) {
      console.error('❌ Failed to add token usage:', error);
      throw error;
    }
  }

  async getGlobalTokenUsage() {
    try {
      const usageData = await this.redisClient.get('global:token_usage');
      return usageData ? JSON.parse(usageData) : { totalTokens: 0, totalCost: 0, lastUpdated: null };
    } catch (error) {
      console.error('❌ Failed to get global token usage:', error);
      return { totalTokens: 0, totalCost: 0, lastUpdated: null };
    }
  }

  async updateGlobalTokenUsage(usage: any) {
    try {
      await this.redisClient.set('global:token_usage', JSON.stringify({
        ...usage,
        lastUpdated: new Date().toISOString()
      }));
      console.log('✅ Updated global token usage');
    } catch (error) {
      console.error('❌ Failed to update global token usage:', error);
    }
  }

  // Entity Management
  async addEntity(sessionId: string, entity: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const entityWithId = {
        ...entity,
        id: entityId,
        sessionId,
        timestamp: new Date().toISOString()
      };

      session.entities.push(entityWithId);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`entity:${entityId}`, JSON.stringify(entityWithId));
      
      console.log(`✅ Added entity: ${entityId}`);
      return entityWithId;
    } catch (error) {
      console.error('❌ Failed to add entity:', error);
      throw error;
    }
  }

  // Structured Extraction Management
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
        throw new Error('Session not found');
      }

      const extractionId = `extraction_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const extraction = {
        id: extractionId,
        sessionId,
        query,
        parameters,
        confidence,
        reasoning,
        extractedFields,
        timestamp: new Date().toISOString()
      };

      session.structuredExtractions.push(extraction);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`extraction:${extractionId}`, JSON.stringify(extraction));
      
      console.log(`✅ Logged structured extraction: ${extractionId}`);
      return extraction;
    } catch (error) {
      console.error('❌ Failed to log structured extraction:', error);
      throw error;
    }
  }

  // Personal Interest Management
  async addPersonalInterest(sessionId: string, interestData: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const interestId = `interest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const interest = {
        id: interestId,
        sessionId,
        ...interestData,
        timestamp: new Date().toISOString()
      };

      session.personalInterests.push(interest);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`interest:${interestId}`, JSON.stringify(interest));
      
      console.log(`✅ Added personal interest: ${interestId}`);
      return interest;
    } catch (error) {
      console.error('❌ Failed to add personal interest:', error);
      throw error;
    }
  }

  // Recommendation Feedback Management
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
        throw new Error('Session not found');
      }

      const feedbackId = `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const feedbackData = {
        id: feedbackId,
        sessionId,
        recommendationId,
        recommendationType,
        recommendationName,
        rating,
        feedback,
        comment,
        metadata,
        timestamp: new Date().toISOString()
      };

      session.recommendationFeedback = session.recommendationFeedback || [];
      session.recommendationFeedback.push(feedbackData);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`feedback:${feedbackId}`, JSON.stringify(feedbackData));
      
      console.log(`✅ Stored recommendation feedback: ${feedbackId}`);
      return feedbackData;
    } catch (error) {
      console.error('❌ Failed to store recommendation feedback:', error);
      throw error;
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

  async addExplicitInterest(sessionId: string, category: string, name: string, confidence: number = 0.9) {
    return await this.addPersonalInterest(sessionId, {
      category,
      name,
      confidence,
      source: 'explicit'
    });
  }

  // Message Management
  async getMessages(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      return session?.messages || [];
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  async deleteMessage(messageId: string, sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }
      
      session.messages = session.messages.filter(m => m.id !== messageId);
      session.updatedAt = new Date().toISOString();
      
      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.del(`message:${messageId}`);
      
      console.log(`✅ Deleted message: ${messageId}`);
    } catch (error) {
      console.error('❌ Failed to delete message:', error);
      throw error;
    }
  }

  // Session Management
  async getSessionsWithEntityCounts() {
    try {
      const sessions = await this.redisClient.keys('session:*');
      const sessionData = await Promise.all(
        sessions.map(async (key) => {
          const sessionData = await this.redisClient.get(key);
          if (!sessionData) return null;
          const session = JSON.parse(sessionData);
          
          // Get persona data for this session
          const personaData = await this.redisClient.get(`session:${session.id}:persona`);
          const persona = personaData ? JSON.parse(personaData) : null;
          
          return {
            ...session,
            entityCount: session?.entities?.length || 0,
            personaName: persona?.name || 'Unknown Persona',
            personaLocation: persona?.location || 'Unknown',
            messageCount: session?.messages?.length || 0
          };
        })
      );
      return sessionData.filter(Boolean);
    } catch (error) {
      console.error('❌ Failed to get sessions with entity counts:', error);
      return [];
    }
  }

  async deleteChatSession(sessionId: string) {
    try {
      // Delete the main session
      await this.redisClient.del(`session:${sessionId}`);
      
      // Delete associated persona data
      await this.redisClient.del(`session:${sessionId}:persona`);
      
      // Delete all messages for this session
      const session = await this.getChatSession(sessionId);
      if (session?.messages) {
        for (const message of session.messages) {
          await this.redisClient.del(`message:${message.id}`);
        }
      }
      
      console.log(`✅ Deleted chat session: ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to delete chat session:', error);
      throw error;
    }
  }

  async getSessionWithDetails(sessionId: string) {
    return await this.getChatSession(sessionId);
  }

  // API Call Management
  async getApiCalls(sessionId: string, limit: number = 10) {
    try {
      const session = await this.getChatSession(sessionId);
      return session?.apiCalls?.slice(-limit) || [];
    } catch (error) {
      console.error('❌ Failed to get API calls:', error);
      return [];
    }
  }

  async logApiCall(sessionId: string, callData: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const callId = `api_call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const apiCall = {
        id: callId,
        sessionId,
        ...callData,
        timestamp: new Date().toISOString()
      };

      session.apiCalls = session.apiCalls || [];
      session.apiCalls.push(apiCall);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`api_call:${callId}`, JSON.stringify(apiCall));
      
      console.log(`✅ Logged API call: ${callId}`);
      return apiCall;
    } catch (error) {
      console.error('❌ Failed to log API call:', error);
      throw error;
    }
  }

  // Entity Management
  async getSessionEntities(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      return session?.entities || [];
    } catch (error) {
      console.error('❌ Failed to get session entities:', error);
      return [];
    }
  }

  async storeEntitiesFromResponse(sessionId: string, entities: any[]) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      session.entities = session.entities || [];
      session.entities.push(...entities);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      
      console.log(`✅ Stored ${entities.length} entities from response`);
      return entities;
    } catch (error) {
      console.error('❌ Failed to store entities from response:', error);
      throw error;
    }
  }

  // Persona Management
  async getOrCreatePersona(sessionId: string, personaId?: string, name?: string, location?: string, gender?: string) {
    try {
      let persona = await this.getPersona(sessionId);
      
      if (!persona) {
        persona = await this.createPersona(sessionId, {
          name: name || 'Unknown',
          location: location || 'Unknown',
          gender: gender || 'Unknown',
          interests: [],
          audiences: []
        });
      }
      
      return persona;
    } catch (error) {
      console.error('❌ Failed to get or create persona:', error);
      throw error;
    }
  }

  async getPersonalInterests(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      return session?.personalInterests || [];
    } catch (error) {
      console.error('❌ Failed to get personal interests:', error);
      return [];
    }
  }

  async getAudienceCharacteristics(sessionId: string) {
    try {
      const session = await this.getChatSession(sessionId);
      return session?.audienceCharacteristics || [];
    } catch (error) {
      console.error('❌ Failed to get audience characteristics:', error);
      return [];
    }
  }

  async updatePersonaConfidence(sessionId: string, confidence: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      session.persona = session.persona || {};
      session.persona.confidence = confidence;
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      
      console.log(`✅ Updated persona confidence: ${confidence}`);
    } catch (error) {
      console.error('❌ Failed to update persona confidence:', error);
      throw error;
    }
  }

  async storePersonalInterest(sessionId: string, interestData: any) {
    return await this.addPersonalInterest(sessionId, interestData);
  }

  async updatePersonalInterestEntityId(interestId: string, entityId: string) {
    try {
      const interestData = await this.redisClient.get(`interest:${interestId}`);
      if (interestData) {
        const interest = JSON.parse(interestData);
        interest.entityId = entityId;
        await this.redisClient.set(`interest:${interestId}`, JSON.stringify(interest));
        console.log(`✅ Updated personal interest entity ID: ${interestId}`);
      }
    } catch (error) {
      console.error('❌ Failed to update personal interest entity ID:', error);
      throw error;
    }
  }

  async updatePersonalInterestConfidence(sessionId: string, interestName: string, delta: number) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const interest = session.personalInterests?.find(i => i.name === interestName);
      if (interest) {
        interest.confidence = Math.max(0, Math.min(1, (interest.confidence || 0) + delta));
        session.updatedAt = new Date().toISOString();
        await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
        console.log(`✅ Updated personal interest confidence: ${interestName}`);
      }
    } catch (error) {
      console.error('❌ Failed to update personal interest confidence:', error);
      throw error;
    }
  }

  // Token Usage Management
  async saveTokenUsage(usage: any) {
    try {
      await this.redisClient.set('global_token_usage', JSON.stringify(usage));
      console.log('✅ Saved token usage');
    } catch (error) {
      console.error('❌ Failed to save token usage:', error);
      throw error;
    }
  }

  // Audience Characteristic Management
  async addAudienceCharacteristic(sessionId: string, characteristicData: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const characteristicId = `characteristic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const characteristic = {
        id: characteristicId,
        sessionId,
        ...characteristicData,
        timestamp: new Date().toISOString()
      };

      session.audienceCharacteristics.push(characteristic);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`characteristic:${characteristicId}`, JSON.stringify(characteristic));
      
      console.log(`✅ Added audience characteristic: ${characteristicId}`);
      return characteristic;
    } catch (error) {
      console.error('❌ Failed to add audience characteristic:', error);
      throw error;
    }
  }

  // Qloo Response Management
  async addQlooResponse(sessionId: string, response: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const responseId = `qloo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const responseWithId = {
        ...response,
        id: responseId,
        sessionId,
        timestamp: new Date().toISOString()
      };

      session.qlooResponses.push(responseWithId);
      session.updatedAt = new Date().toISOString();

      await this.redisClient.set(`session:${sessionId}`, JSON.stringify(session));
      await this.redisClient.set(`qloo:${responseId}`, JSON.stringify(responseWithId));
      
      console.log(`✅ Added Qloo response: ${responseId}`);
      return responseWithId;
    } catch (error) {
      console.error('❌ Failed to add Qloo response:', error);
      throw error;
    }
  }

  // Cleanup
  async cleanup() {
    try {
      if (this.redisClient) {
        await this.redisClient.quit();
        console.log('✅ DatabaseService cleanup completed');
      }
    } catch (error) {
      console.error('❌ Failed to cleanup database service:', error);
    }
  }
}

// Singleton instance
let databaseServiceInstance: DatabaseService | null = null;

export function getDatabaseService(): DatabaseService {
  if (!databaseServiceInstance) {
    databaseServiceInstance = new DatabaseService();
  }
  return databaseServiceInstance;
} 