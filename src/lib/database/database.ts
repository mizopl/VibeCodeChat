import { kv } from '@vercel/kv';

// Database service class using Vercel KV with Redis fallback
export class DatabaseService {
  private kv: typeof kv;
  private redisUrl: string | undefined;

  constructor() {
    this.kv = kv;
    this.redisUrl = process.env.REDIS_URL;
    console.log('✅ DatabaseService initialized with Vercel KV/Redis');
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

      await this.kv.set(`session:${sessionId}`, session);
      console.log(`✅ Created chat session: ${sessionId}`);
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
        console.log(`❌ Session not found: ${sessionId}`);
        return null;
      }
      console.log(`✅ Retrieved session: ${sessionId}`);
      return session as any;
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

      await this.kv.set(`session:${sessionId}`, updatedSession);
      console.log(`✅ Updated session: ${sessionId}`);
      return updatedSession;
    } catch (error) {
      console.error('❌ Failed to update chat session:', error);
      throw error;
    }
  }

  // Message Management
  async addMessage(sessionId: string, message: any) {
    try {
      const session = await this.getChatSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const messageWithId = {
        ...message,
        id: messageId,
        timestamp: new Date().toISOString()
      };

      session.messages.push(messageWithId);
      session.updatedAt = new Date().toISOString();

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`message:${messageId}`, messageWithId);
      
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
  async createPersona(sessionId: string, personaData: any) {
    try {
      const personaId = `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const persona = {
        id: personaId,
        sessionId,
        ...personaData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await this.kv.set(`persona:${personaId}`, persona);
      await this.kv.set(`session:${sessionId}:persona`, persona);
      
      console.log(`✅ Created persona: ${personaId}`);
      return persona;
    } catch (error) {
      console.error('❌ Failed to create persona:', error);
      throw error;
    }
  }

  async getPersona(sessionId: string) {
    try {
      const persona = await this.kv.get(`session:${sessionId}:persona`);
      return persona as any;
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

      await this.kv.set(`persona:${persona.id}`, updatedPersona);
      await this.kv.set(`session:${sessionId}:persona`, updatedPersona);
      
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`usage:${usageId}`, usageWithId);
      
      console.log(`✅ Added token usage: ${usageId}`);
      return usageWithId;
    } catch (error) {
      console.error('❌ Failed to add token usage:', error);
      throw error;
    }
  }

  async getGlobalTokenUsage() {
    try {
      const usage = await this.kv.get('global:token_usage');
      return usage as any || { totalTokens: 0, totalCost: 0, lastUpdated: null };
    } catch (error) {
      console.error('❌ Failed to get global token usage:', error);
      return { totalTokens: 0, totalCost: 0, lastUpdated: null };
    }
  }

  async updateGlobalTokenUsage(usage: any) {
    try {
      await this.kv.set('global:token_usage', {
        ...usage,
        lastUpdated: new Date().toISOString()
      });
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`entity:${entityId}`, entityWithId);
      
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`extraction:${extractionId}`, extraction);
      
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`interest:${interestId}`, interest);
      
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`feedback:${feedbackId}`, feedbackData);
      
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`characteristic:${characteristicId}`, characteristic);
      
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

      await this.kv.set(`session:${sessionId}`, session);
      await this.kv.set(`qloo:${responseId}`, responseWithId);
      
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
      // Close any open connections if needed
      console.log('✅ DatabaseService cleanup completed');
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