import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// In-memory fallback storage
const memoryStorage = new Map();

// Ensure Prisma client is properly initialized with error handling
let prisma: PrismaClient;

try {
  prisma = globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
  });
  
  if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
  
  console.log('✅ DatabaseService initialized with Prisma client');
} catch (error) {
  console.error('❌ Failed to initialize Prisma client:', error);
  // Create a mock client for fallback
  prisma = {} as PrismaClient;
}

// Database service class with error handling and fallback
export class DatabaseService {
  private prisma: PrismaClient;
  private isConnected: boolean = false;
  private useFallback: boolean = false;

  constructor() {
    this.prisma = prisma;
    
    // Test connection
    this.testConnection();
  }

  private async testConnection() {
    try {
      await this.prisma.$connect();
      this.isConnected = true;
      console.log('🔧 DatabaseService singleton created');
      console.log('🔧 databaseService.prisma exists:', !!this.prisma);
      console.log('🔧 databaseService.prisma.persona exists:', !!this.prisma.persona);
    } catch (error) {
      console.error('❌ Database connection failed, using fallback storage:', error);
      this.isConnected = false;
      this.useFallback = true;
    }
  }

  private async ensureConnection() {
    if (!this.isConnected && !this.useFallback) {
      try {
        await this.prisma.$connect();
        this.isConnected = true;
      } catch (error) {
        console.error('❌ Database connection failed:', error);
        this.useFallback = true;
      }
    }
  }

  // Chat Session Management with fallback
  async createChatSession(personaId?: string, debugMode: boolean = false) {
    try {
      if (this.useFallback) {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const session = {
          id: sessionId,
          personaId,
          debugMode,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        memoryStorage.set(sessionId, session);
        return session;
      }

      await this.ensureConnection();
      return await this.prisma.chatSession.create({
        data: {
          personaId,
          debugMode,
        },
      });
    } catch (error) {
      console.error('❌ Failed to create chat session:', error);
      throw new Error('Failed to create chat session');
    }
  }

  async getChatSession(sessionId: string) {
    try {
      if (this.useFallback) {
        return memoryStorage.get(sessionId) || null;
      }

      await this.ensureConnection();
      return await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: { orderBy: { timestamp: 'asc' } },
          apiCalls: { orderBy: { timestamp: 'desc' } },
          tokenUsage: { orderBy: { timestamp: 'desc' } },
        },
      });
    } catch (error) {
      console.error('❌ Failed to get chat session:', error);
      return null;
    }
  }

  async deleteChatSession(sessionId: string) {
    try {
      if (this.useFallback) {
        memoryStorage.delete(sessionId);
        return true;
      }
      await this.ensureConnection();
      return await this.prisma.chatSession.delete({
        where: { id: sessionId },
      });
    } catch (error) {
      console.error('❌ Failed to delete chat session:', error);
      return false;
    }
  }

  async updateChatSession(sessionId: string, data: { personaId?: string; debugMode?: boolean }) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (session) {
          Object.assign(session, data);
          session.updatedAt = new Date();
          memoryStorage.set(sessionId, session);
          return session;
        }
        return null;
      }
      await this.ensureConnection();
      return await this.prisma.chatSession.update({
        where: { id: sessionId },
        data,
      });
    } catch (error) {
      console.error('❌ Failed to update chat session:', error);
      return null;
    }
  }

  // Message Management
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string, usage?: any, metadata?: any) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        const messageId = `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const message = {
          id: messageId,
          sessionId,
          role,
          content,
          timestamp: new Date(),
          usage: usage ? JSON.parse(JSON.stringify(usage)) : null,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        };
        session.messages = (session.messages || []).concat(message);
        memoryStorage.set(sessionId, session);
        return message;
      }
      await this.ensureConnection();
      return await this.prisma.message.create({
        data: {
          sessionId,
          role,
          content,
          usage: usage ? JSON.parse(JSON.stringify(usage)) : null,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });
    } catch (error) {
      console.error('❌ Failed to add message:', error);
      throw new Error('Failed to add message');
    }
  }

  async getMessages(sessionId: string, limit?: number) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.messages || []).slice(0, limit || 100);
      }
      await this.ensureConnection();
      return await this.prisma.message.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'asc' },
        take: limit,
      });
    } catch (error) {
      console.error('❌ Failed to get messages:', error);
      return [];
    }
  }

  async deleteMessage(messageId: string, sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return false;
        }
        const initialMessageCount = session.messages?.length || 0;
        session.messages = (session.messages || []).filter(msg => msg.id !== messageId);
        memoryStorage.set(sessionId, session);
        return initialMessageCount > (session.messages || []).length;
      }
      await this.ensureConnection();
      return await this.prisma.message.delete({
        where: { 
          id: messageId,
          sessionId: sessionId // Ensure the message belongs to the session
        },
      });
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
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
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
          timestamp: new Date(),
          error,
        };
        session.apiCalls = (session.apiCalls || []).concat(apiCall);
        memoryStorage.set(sessionId, session);
        return apiCall;
      }
      await this.ensureConnection();
      return await this.prisma.apiCall.create({
        data: {
          sessionId,
          endpoint,
          method,
          parameters: JSON.parse(JSON.stringify(parameters)),
          response: response ? JSON.parse(JSON.stringify(response)) : null,
          status,
          duration,
          error,
        },
      });
    } catch (error) {
      console.error('❌ Failed to log API call:', error);
      throw new Error('Failed to log API call');
    }
  }

  async getApiCalls(sessionId: string, limit?: number) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.apiCalls || []).slice(0, limit || 100);
      }
      await this.ensureConnection();
      return await this.prisma.apiCall.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
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
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
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
          timestamp: new Date(),
        };
        session.tokenUsage = (session.tokenUsage || []).concat(tokenUsage);
        memoryStorage.set(sessionId, session);
        return tokenUsage;
      }
      await this.ensureConnection();
      return await this.prisma.tokenUsage.create({
        data: {
          promptTokens,
          completionTokens,
          totalTokens,
          cost,
          source,
          session: {
            connect: { id: sessionId }
          }
        },
      });
    } catch (error) {
      console.error('❌ Failed to log token usage:', error);
      throw new Error('Failed to log token usage');
    }
  }

  async getTokenUsage(sessionId: string, limit?: number) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.tokenUsage || []).slice(0, limit || 100);
      }
      await this.ensureConnection();
      return await this.prisma.tokenUsage.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.error('❌ Failed to get token usage:', error);
      return [];
    }
  }

  async getTotalTokenUsage(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
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
      }
      await this.ensureConnection();
      const usage = await this.prisma.tokenUsage.aggregate({
        where: { sessionId },
        _sum: {
          promptTokens: true,
          completionTokens: true,
          totalTokens: true,
          cost: true,
        },
      });

      return {
        totalPromptTokens: usage._sum.promptTokens || 0,
        totalCompletionTokens: usage._sum.completionTokens || 0,
        totalTokens: usage._sum.totalTokens || 0,
        totalCost: usage._sum.cost || 0,
      };
    } catch (error) {
      console.error('❌ Failed to get total token usage:', error);
      return { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 };
    }
  }

  // Structured Extraction Tracking
  async logStructuredExtraction(
    sessionId: string,
    query: string,
    parameters: any,
    confidence: number,
    reasoning: string,
    extractedFields: string[]
  ) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
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
          timestamp: new Date(),
        };
        session.structuredExtractions = (session.structuredExtractions || []).concat(extraction);
        memoryStorage.set(sessionId, session);
        return extraction;
      }
      await this.ensureConnection();
      return await this.prisma.structuredExtraction.create({
        data: {
          sessionId,
          query,
          parameters: JSON.parse(JSON.stringify(parameters)),
          confidence,
          reasoning,
          extractedFields: JSON.parse(JSON.stringify(extractedFields)),
        },
      });
    } catch (error) {
      console.error('❌ Failed to log structured extraction:', error);
      throw new Error('Failed to log structured extraction');
    }
  }

  async getStructuredExtractions(sessionId: string, limit?: number) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.structuredExtractions || []).slice(0, limit || 100);
      }
      await this.ensureConnection();
      return await this.prisma.structuredExtraction.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });
    } catch (error) {
      console.error('❌ Failed to get structured extractions:', error);
      return [];
    }
  }

  // Analytics and Reporting
  async getSessionAnalytics(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
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
      }
      const session = await this.getChatSession(sessionId);
      const totalUsage = await this.getTotalTokenUsage(sessionId);
      const apiCalls = await this.getApiCalls(sessionId);
      const extractions = await this.getStructuredExtractions(sessionId);

      return {
        session,
        totalUsage,
        apiCallCount: apiCalls.length,
        extractionCount: extractions.length,
        messageCount: session?.messages.length || 0,
        averageConfidence: extractions.length > 0 
          ? extractions.reduce((sum, ext) => sum + ext.confidence, 0) / extractions.length 
          : 0,
      };
    } catch (error) {
      console.error('❌ Failed to get session analytics:', error);
      return { session: null, totalUsage: { totalPromptTokens: 0, totalCompletionTokens: 0, totalTokens: 0, totalCost: 0 }, apiCallCount: 0, extractionCount: 0, messageCount: 0, averageConfidence: 0 };
    }
  }

  // Global token usage management
  async saveTokenUsage(tokenUsage: any) {
    // Store in database instead of KV
    try {
      // Create a global token usage record
      await this.prisma.globalTokenUsage.upsert({
        where: { id: 'global' },
        update: {
          totalPromptTokens: tokenUsage.totalPromptTokens,
          totalCompletionTokens: tokenUsage.totalCompletionTokens,
          totalTokens: tokenUsage.totalTokens,
          sessionTokens: tokenUsage.sessionTokens,
          lastUpdated: new Date(),
          costEstimate: tokenUsage.costEstimate,
        },
        create: {
          id: 'global',
          totalPromptTokens: tokenUsage.totalPromptTokens,
          totalCompletionTokens: tokenUsage.totalCompletionTokens,
          totalTokens: tokenUsage.totalTokens,
          sessionTokens: tokenUsage.sessionTokens,
          lastUpdated: new Date(),
          costEstimate: tokenUsage.costEstimate,
        },
      });
      console.log('✅ Global token usage saved to database');
    } catch (error) {
      console.error('❌ Failed to save global token usage:', error);
      // Try to create the record if it doesn't exist
      try {
        await this.prisma.globalTokenUsage.create({
          data: {
            id: 'global',
            totalPromptTokens: tokenUsage.totalPromptTokens,
            totalCompletionTokens: tokenUsage.totalCompletionTokens,
            totalTokens: tokenUsage.totalTokens,
            sessionTokens: tokenUsage.sessionTokens,
            lastUpdated: new Date(),
            costEstimate: tokenUsage.costEstimate,
          },
        });
        console.log('✅ Created new global token usage record');
      } catch (createError) {
        console.error('❌ Failed to create global token usage record:', createError);
      }
    }
  }

  async getGlobalTokenUsage(): Promise<any> {
    try {
      const globalUsage = await this.prisma.globalTokenUsage.findUnique({
        where: { id: 'global' },
      });
      return globalUsage;
    } catch (error) {
      console.log('⚠️ No global token usage found');
      return null;
    }
  }

  // Store discovered entities with full metadata
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
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
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
          timestamp: new Date(),
        };
        session.entities = (session.entities || []).concat(entity);
        memoryStorage.set(sessionId, session);
        return entity;
      }
      await this.ensureConnection();
      return await this.prisma.entity.create({
        data: {
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
        },
      });
    } catch (error) {
      console.error('❌ Failed to store entity:', error);
    }
  }

  // Store multiple entities from API response
  async storeEntitiesFromResponse(sessionId: string, entities: any[], source: string) {
    for (const entity of entities) {
      await this.storeEntity(sessionId, {
        qlooId: entity.id || entity.qlooId || `entity-${Date.now()}`,
        name: entity.name,
        type: entity.type || entity.subtype || 'urn:entity:unknown',
        subtype: entity.subtype,
        description: entity.description,
        metadata: entity, // Store full entity data
        tags: entity.tags || [],
        location: entity.location,
        confidence: entity.confidence || 0.8,
        source,
      });
    }
  }

  // Store entities discovered from API responses
  async storeEntitiesFromResponse(
    sessionId: string, 
    entities: any[], 
    source: string
  ): Promise<void> {
    try {
      console.log(`💾 Storing ${entities.length} entities from ${source}`);
      
      for (const entity of entities) {
        // Check if entity already exists
        const existingEntity = await this.prisma.entity.findFirst({
          where: {
            sessionId,
            qlooId: entity.entity_id || entity.id
          }
        });

        if (existingEntity) {
          // Update existing entity
          await this.prisma.entity.update({
            where: { id: existingEntity.id },
            data: {
              name: entity.name,
              type: entity.type,
              subtype: entity.subtype,
              description: entity.description,
              metadata: entity,
              tags: entity.tags,
              location: entity.location,
              confidence: entity.confidence || 0.5,
              source: source,
              timestamp: new Date()
            }
          });
        } else {
          // Create new entity
          await this.prisma.entity.create({
            data: {
              sessionId,
              qlooId: entity.entity_id || entity.id,
              name: entity.name,
              type: entity.type || 'unknown',
              subtype: entity.subtype,
              description: entity.description,
              metadata: entity,
              tags: entity.tags,
              location: entity.location,
              confidence: entity.confidence || 0.5,
              source: source
            }
          });
        }
      }
      
      console.log(`✅ Stored ${entities.length} entities for session ${sessionId}`);
    } catch (error) {
      console.error('❌ Failed to store entities:', error);
    }
  }

  // Get entities for a session
  async getSessionEntities(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.entities || []).slice(0, 100); // Limit for fallback
      }
      await this.ensureConnection();
      return await this.prisma.entity.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
      });
    } catch (error) {
      console.error('❌ Failed to get session entities:', error);
      return [];
    }
  }

  // Search entities by name or description
  async searchEntities(sessionId: string, searchTerm: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        const searchLower = searchTerm.toLowerCase();
        return (session.entities || []).filter(entity => 
          entity.name.toLowerCase().includes(searchLower) || 
          entity.description?.toLowerCase().includes(searchLower) || 
          entity.type.toLowerCase().includes(searchLower)
        );
      }
      await this.ensureConnection();
      const searchLower = searchTerm.toLowerCase();
      
      return await this.prisma.entity.findMany({
        where: {
          sessionId,
          OR: [
            { name: { contains: searchLower, mode: 'insensitive' } },
            { description: { contains: searchLower, mode: 'insensitive' } },
            { type: { contains: searchLower, mode: 'insensitive' } }
          ]
        },
        orderBy: { timestamp: 'desc' },
      });
    } catch (error) {
      console.error('❌ Failed to search entities:', error);
      return [];
    }
  }

  // Get session with all details including entities
  async getSessionWithDetails(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
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
      }
      return await this.prisma.chatSession.findUnique({
        where: { id: sessionId },
        include: {
          messages: {
            orderBy: { timestamp: 'asc' },
            select: {
              id: true,
              role: true,
              content: true,
              timestamp: true,
              usage: true,
              metadata: true,
            }
          },
          apiCalls: {
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              endpoint: true,
              method: true,
              parameters: true,
              response: true,
              status: true,
              duration: true,
              timestamp: true,
              error: true,
            }
          },
          tokenUsage: {
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              promptTokens: true,
              completionTokens: true,
              totalTokens: true,
              cost: true,
              source: true,
              timestamp: true,
            }
          },
          structuredExtractions: {
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              query: true,
              parameters: true,
              confidence: true,
              reasoning: true,
              extractedFields: true,
              timestamp: true,
            }
          },
          entities: {
            orderBy: { timestamp: 'desc' },
            select: {
              id: true,
              qlooId: true,
              name: true,
              type: true,
              subtype: true,
              description: true,
              metadata: true,
              tags: true,
              location: true,
              confidence: true,
              source: true,
              timestamp: true,
            }
          },
        },
      });
    } catch (error) {
      console.error('❌ Failed to get session with details:', error);
      return null;
    }
  }

  // Get all sessions with entity counts
  async getSessionsWithEntityCounts() {
    try {
      if (this.useFallback) {
        const sessions = Array.from(memoryStorage.values()).map(session => ({
          id: session.id,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          personaId: session.personaId,
          personaName: 'Unknown Persona', // Fallback
          personaLocation: 'Unknown Location', // Fallback
          debugMode: session.debugMode,
          messageCount: (session.messages || []).length,
          apiCallCount: (session.apiCalls || []).length,
          tokenUsageCount: (session.tokenUsage || []).length,
          entityCount: (session.entities || []).length,
          lastMessage: (session.messages || [])[0]?.content || '',
          totalTokens: (session.tokenUsage || []).reduce((sum, usage) => sum + usage.totalTokens, 0),
          totalCost: (session.tokenUsage || []).reduce((sum, usage) => sum + usage.cost, 0),
          recentEntities: (session.entities || []).map(e => e.name).slice(0, 5),
        }));
        return sessions.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      const sessions = await this.prisma.chatSession.findMany({
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              messages: true,
              apiCalls: true,
              tokenUsage: true,
              structuredExtractions: true,
            }
          },
          persona: {
            select: {
              name: true,
              location: true,
            }
          },
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: {
              content: true,
              timestamp: true,
            }
          },
          tokenUsage: {
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: {
              totalTokens: true,
              cost: true,
            }
          },
          entities: {
            orderBy: { timestamp: 'desc' },
            take: 5,
            select: {
              name: true,
              type: true,
              source: true,
            }
          },
        },
      });

      return sessions.map(session => ({
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        personaId: session.personaId,
        personaName: session.persona?.name || 'Unknown Persona',
        personaLocation: session.persona?.location,
        debugMode: session.debugMode,
        messageCount: session._count.messages,
        apiCallCount: session._count.apiCalls,
        tokenUsageCount: session._count.tokenUsage,
        entityCount: session.entities.length,
        lastMessage: session.messages[0]?.content || '',
        totalTokens: session.tokenUsage[0]?.totalTokens || 0,
        totalCost: session.tokenUsage[0]?.cost || 0,
        recentEntities: session.entities.map(e => e.name),
      }));
    } catch (error) {
      console.error('❌ Failed to get sessions with entity counts:', error);
      return [];
    }
  }

  // Cleanup old sessions (for maintenance)
  async cleanupOldSessions(daysOld: number = 30) {
    try {
      if (this.useFallback) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        const sessionsToDelete = Array.from(memoryStorage.values()).filter(session => session.createdAt < cutoffDate);
        sessionsToDelete.forEach(session => memoryStorage.delete(session.id));
        console.log(`🧹 Cleanup: Deleted ${sessionsToDelete.length} sessions from fallback storage.`);
        return sessionsToDelete.length;
      }
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      return await this.prisma.chatSession.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate,
          },
        },
      });
    } catch (error) {
      console.error('❌ Failed to cleanup old sessions:', error);
      return 0;
    }
  }

  // Personal Interests Management
  async storePersonalInterest(
    sessionId: string,
    category: string,
    name: string,
    entityId?: string,
    confidence: number = 0.5,
    source: string = 'inferred',
    metadata?: any
  ) {
    // Ensure persona exists first
    await this.getOrCreatePersona(sessionId);
    
    try {
      if (this.useFallback) {
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.personalInterests = (session.personalInterests || []).concat(interest);
        memoryStorage.set(sessionId, session);
        return interest;
      }
      await this.ensureConnection();
      return await this.prisma.personalInterest.create({
        data: {
          sessionId,
          category,
          name,
          entityId,
          confidence,
          source,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });
    } catch (error) {
      console.error('❌ Failed to store personal interest:', error);
      throw new Error('Failed to store personal interest');
    }
  }

  async getPersonalInterests(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.personalInterests || []).slice(0, 100); // Limit for fallback
      }
      await this.ensureConnection();
      return await this.prisma.personalInterest.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('❌ Failed to get personal interests:', error);
      return [];
    }
  }

  async updatePersonalInterestEntityId(interestId: string, entityId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(interestId.split('_')[0]); // Assuming interestId is sessionId_interestId
        if (!session) {
          throw new Error(`Session with ID ${interestId.split('_')[0]} not found in fallback storage.`);
        }
        const interest = (session.personalInterests || []).find(i => i.id === interestId);
        if (interest) {
          interest.entityId = entityId;
          memoryStorage.set(session.id, session);
          return interest;
        }
        return null;
      }
      await this.ensureConnection();
      return await this.prisma.personalInterest.update({
        where: { id: interestId },
        data: { entityId },
      });
    } catch (error) {
      console.error('❌ Failed to update personal interest entity ID:', error);
      return null;
    }
  }

  async updatePersonalInterestConfidence(sessionId: string, interestName: string, delta: number) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        const interest = (session.personalInterests || []).find(i => i.name === interestName);
        if (interest) {
          interest.confidence = Math.max(0, Math.min(1, interest.confidence + delta));
          memoryStorage.set(session.id, session);
          return interest;
        }
        return null;
      }
      await this.ensureConnection();
      const interest = await this.prisma.personalInterest.findFirst({
        where: { 
          sessionId,
          name: interestName 
        },
      });

      if (interest) {
        const newConfidence = Math.max(0, Math.min(1, interest.confidence + delta));
        return await this.prisma.personalInterest.update({
          where: { id: interest.id },
          data: { confidence: newConfidence },
        });
      }
      return null;
    } catch (error) {
      console.error('❌ Failed to update personal interest confidence:', error);
      return null;
    }
  }

  // Audience Characteristics Management
  async storeAudienceCharacteristic(
    sessionId: string,
    audienceType: string,
    audienceId: string,
    name: string,
    confidence: number = 0.5,
    metadata?: any
  ) {
    try {
      if (this.useFallback) {
        const characteristicId = `characteristic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const characteristic = {
          id: characteristicId,
          sessionId,
          audienceType,
          audienceId,
          name,
          confidence,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.audienceCharacteristics = (session.audienceCharacteristics || []).concat(characteristic);
        memoryStorage.set(session.id, session);
        return characteristic;
      }
      await this.ensureConnection();
      return await this.prisma.audienceCharacteristic.create({
        data: {
          sessionId,
          audienceType,
          audienceId,
          name,
          confidence,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });
    } catch (error) {
      console.error('❌ Failed to store audience characteristic:', error);
      throw new Error('Failed to store audience characteristic');
    }
  }

  async getAudienceCharacteristics(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.audienceCharacteristics || []).slice(0, 100); // Limit for fallback
      }
      await this.ensureConnection();
      return await this.prisma.audienceCharacteristic.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      console.error('❌ Failed to get audience characteristics:', error);
      return [];
    }
  }

  // Persona Management
  async createPersona(sessionId: string, demographics?: any, name?: string, location?: string, gender?: string) {
    console.log('🔍 createPersona called with sessionId:', sessionId);
    
    // First, ensure the chat session exists
    let chatSession = await this.prisma.chatSession.findUnique({
      where: { id: sessionId }
    });
    
    if (!chatSession) {
      console.log('🔍 Creating chat session for persona...');
      chatSession = await this.prisma.chatSession.create({
        data: { id: sessionId }
      });
      console.log('🔍 Chat session created:', chatSession.id);
    }
    
    // Now create the persona
    console.log('🔍 Creating persona...');
    try {
      if (this.useFallback) {
        const personaId = `persona_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const persona = {
          id: personaId,
          sessionId,
          name,
          location,
          gender,
          demographics: demographics ? JSON.parse(JSON.stringify(demographics)) : null,
          confidence: 0.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.persona = persona;
        memoryStorage.set(session.id, session);
        return persona;
      }
      await this.ensureConnection();
      return await this.prisma.persona.create({
        data: {
          sessionId,
          name,
          location,
          gender,
          demographics: demographics ? JSON.parse(JSON.stringify(demographics)) : null,
          confidence: 0.5,
        },
      });
    } catch (error) {
      console.error('❌ Failed to create persona:', error);
      throw new Error('Failed to create persona');
    }
  }

  async updatePersonaDemographics(sessionId: string, demographics: any) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.persona = { ...session.persona, demographics: JSON.parse(JSON.stringify(demographics)) };
        memoryStorage.set(session.id, session);
        return session.persona;
      }
      await this.ensureConnection();
      return await this.prisma.persona.update({
        where: { sessionId },
        data: { demographics: JSON.parse(JSON.stringify(demographics)) },
      });
    } catch (error) {
      console.error('❌ Failed to update persona demographics:', error);
      return null;
    }
  }

  async getPersona(sessionId: string) {
    console.log('🔍 getPersona called with sessionId:', sessionId);
    console.log('🔍 this.prisma exists:', !!this.prisma);
    console.log('🔍 this.prisma.persona exists:', !!this.prisma?.persona);
    
    if (!this.prisma) {
      console.error('❌ this.prisma is undefined in getPersona');
      throw new Error('Prisma client not initialized');
    }
    
    if (!this.prisma.persona) {
      console.error('❌ this.prisma.persona is undefined - schema issue?');
      throw new Error('Persona model not found in Prisma client');
    }
    
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
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
      }
      return await this.prisma.persona.findUnique({
        where: { sessionId },
        include: {
          personalInterests: true,
          audienceCharacteristics: true,
        },
      });
    } catch (error) {
      console.error('❌ Failed to get persona:', error);
      return null;
    }
  }

  async getOrCreatePersona(sessionId: string, demographics?: any, name?: string, location?: string, gender?: string) {
    console.log('🔍 getOrCreatePersona called with sessionId:', sessionId);
    
    let persona = await this.getPersona(sessionId);
    console.log('🔍 getPersona returned:', !!persona);
    
    if (!persona) {
      console.log('🔍 Creating new persona...');
      persona = await this.createPersona(sessionId, demographics, name, location, gender);
      console.log('🔍 createPersona completed, persona:', !!persona);
    }
    
    return persona;
  }

  async updatePersonaConfidence(sessionId: string, confidence: number) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.persona = { ...session.persona, confidence: confidence };
        memoryStorage.set(session.id, session);
        return session.persona;
      }
      await this.ensureConnection();
      return await this.prisma.persona.update({
        where: { sessionId },
        data: { confidence },
      });
    } catch (error) {
      console.error('❌ Failed to update persona confidence:', error);
      return null;
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
      if (this.useFallback) {
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
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.recommendationFeedback = (session.recommendationFeedback || []).concat(feedback);
        memoryStorage.set(session.id, session);
        return feedback;
      }
      await this.ensureConnection();
      return await this.prisma.recommendationFeedback.create({
        data: {
          sessionId,
          recommendationId,
          recommendationType,
          recommendationName,
          rating,
          feedback,
          comment,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        },
      });
    } catch (error) {
      console.error('❌ Failed to store recommendation feedback:', error);
      throw new Error('Failed to store recommendation feedback');
    }
  }

  async getRecommendationFeedback(sessionId: string) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          return [];
        }
        return (session.recommendationFeedback || []).slice(0, 100); // Limit for fallback
      }
      await this.ensureConnection();
      return await this.prisma.recommendationFeedback.findMany({
        where: { sessionId },
        orderBy: { timestamp: 'desc' },
      });
    } catch (error) {
      console.error('❌ Failed to get recommendation feedback:', error);
      return [];
    }
  }

  // Add explicit interest (convenience method)
  async addExplicitInterest(
    sessionId: string,
    category: string,
    name: string,
    confidence: number = 0.9
  ) {
    return await this.storePersonalInterest(
      sessionId,
      category,
      name,
      undefined,
      confidence,
      'explicit'
    );
  }

  // Update persona
  async updatePersona(sessionId: string, data: any) {
    try {
      if (this.useFallback) {
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.persona = { ...session.persona, ...data };
        memoryStorage.set(session.id, session);
        return session.persona;
      }
      await this.ensureConnection();
      return await this.prisma.persona.update({
        where: { sessionId },
        data,
      });
    } catch (error) {
      console.error('❌ Failed to update persona:', error);
      return null;
    }
  }

  // Add personal interest with enhanced metadata
  async addPersonalInterest(sessionId: string, data: {
    category: string;
    name: string;
    entityId?: string;
    confidence: number;
    source: string;
    metadata?: any;
  }) {
    try {
      if (this.useFallback) {
        const interestId = `interest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const interest = {
          id: interestId,
          sessionId,
          category: data.category,
          name: data.name,
          entityId: data.entityId,
          confidence: data.confidence,
          source: data.source,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.personalInterests = (session.personalInterests || []).concat(interest);
        memoryStorage.set(session.id, session);
        return interest;
      }
      await this.ensureConnection();
      return await this.prisma.personalInterest.create({
        data: {
          sessionId,
          category: data.category,
          name: data.name,
          entityId: data.entityId,
          confidence: data.confidence,
          source: data.source,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        },
      });
    } catch (error) {
      console.error('❌ Failed to add personal interest:', error);
      throw new Error('Failed to add personal interest');
    }
  }

  // Add audience characteristic
  async addAudienceCharacteristic(sessionId: string, data: {
    type: string;
    name: string;
    confidence: number;
    metadata?: any;
  }) {
    try {
      if (this.useFallback) {
        const characteristicId = `characteristic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const characteristic = {
          id: characteristicId,
          sessionId,
          audienceType: data.type,
          audienceId: `audience_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: data.name,
          confidence: data.confidence,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        const session = memoryStorage.get(sessionId);
        if (!session) {
          throw new Error(`Session with ID ${sessionId} not found in fallback storage.`);
        }
        session.audienceCharacteristics = (session.audienceCharacteristics || []).concat(characteristic);
        memoryStorage.set(session.id, session);
        return characteristic;
      }
      await this.ensureConnection();
      return await this.prisma.audienceCharacteristic.create({
        data: {
          sessionId,
          audienceType: data.type,
          audienceId: `audience_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: data.name,
          confidence: data.confidence,
          metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        },
      });
    } catch (error) {
      console.error('❌ Failed to add audience characteristic:', error);
      throw new Error('Failed to add audience characteristic');
    }
  }
}

// Export singleton instance
export const databaseService = new DatabaseService(); 