import { PrismaClient } from '@prisma/client';

// Global Prisma client instance
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Ensure Prisma client is properly initialized
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Database service class
export class DatabaseService {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
    // Add debugging to ensure prisma is initialized
    if (!this.prisma) {
      console.error('❌ Prisma client is undefined in DatabaseService constructor');
      throw new Error('Prisma client not initialized');
    }
    console.log('✅ DatabaseService initialized with Prisma client');
  }

  // Chat Session Management
  async createChatSession(personaId?: string, debugMode: boolean = false) {
    return await this.prisma.chatSession.create({
      data: {
        personaId,
        debugMode,
      },
    });
  }

  async getChatSession(sessionId: string) {
    return await this.prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        messages: { orderBy: { timestamp: 'asc' } },
        apiCalls: { orderBy: { timestamp: 'desc' } },
        tokenUsage: { orderBy: { timestamp: 'desc' } },
      },
    });
  }

  async deleteChatSession(sessionId: string) {
    return await this.prisma.chatSession.delete({
      where: { id: sessionId },
    });
  }

  async updateChatSession(sessionId: string, data: { personaId?: string; debugMode?: boolean }) {
    return await this.prisma.chatSession.update({
      where: { id: sessionId },
      data,
    });
  }

  // Message Management
  async addMessage(sessionId: string, role: 'user' | 'assistant', content: string, usage?: any, metadata?: any) {
    return await this.prisma.message.create({
      data: {
        sessionId,
        role,
        content,
        usage: usage ? JSON.parse(JSON.stringify(usage)) : null,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
      },
    });
  }

  async getMessages(sessionId: string, limit?: number) {
    return await this.prisma.message.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'asc' },
      take: limit,
    });
  }

  async deleteMessage(messageId: string, sessionId: string) {
    return await this.prisma.message.delete({
      where: { 
        id: messageId,
        sessionId: sessionId // Ensure the message belongs to the session
      },
    });
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
  }

  async getApiCalls(sessionId: string, limit?: number) {
    return await this.prisma.apiCall.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
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
  }

  async getTokenUsage(sessionId: string, limit?: number) {
    return await this.prisma.tokenUsage.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async getTotalTokenUsage(sessionId: string) {
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
  }

  async getStructuredExtractions(sessionId: string, limit?: number) {
    return await this.prisma.structuredExtraction.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  // Analytics and Reporting
  async getSessionAnalytics(sessionId: string) {
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
      await this.prisma.entity.create({
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
      console.log('✅ Stored entity:', entityData.name);
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
    return await this.prisma.entity.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
    });
  }

  // Search entities by name or description
  async searchEntities(sessionId: string, searchTerm: string) {
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
  }

  // Get session with all details including entities
  async getSessionWithDetails(sessionId: string) {
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
  }

  // Get all sessions with entity counts
  async getSessionsWithEntityCounts() {
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
  }

  // Cleanup old sessions (for maintenance)
  async cleanupOldSessions(daysOld: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    return await this.prisma.chatSession.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });
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
  }

  async getPersonalInterests(sessionId: string) {
    return await this.prisma.personalInterest.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePersonalInterestEntityId(interestId: string, entityId: string) {
    return await this.prisma.personalInterest.update({
      where: { id: interestId },
      data: { entityId },
    });
  }

  async updatePersonalInterestConfidence(sessionId: string, interestName: string, delta: number) {
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
  }

  async getAudienceCharacteristics(sessionId: string) {
    return await this.prisma.audienceCharacteristic.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
    });
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
  }

  async updatePersonaDemographics(sessionId: string, demographics: any) {
    return await this.prisma.persona.update({
      where: { sessionId },
      data: { demographics: JSON.parse(JSON.stringify(demographics)) },
    });
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
    
    return await this.prisma.persona.findUnique({
      where: { sessionId },
      include: {
        personalInterests: true,
        audienceCharacteristics: true,
      },
    });
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
    return await this.prisma.persona.update({
      where: { sessionId },
      data: { confidence },
    });
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
  }

  async getRecommendationFeedback(sessionId: string) {
    return await this.prisma.recommendationFeedback.findMany({
      where: { sessionId },
      orderBy: { timestamp: 'desc' },
    });
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
    return await this.prisma.persona.update({
      where: { sessionId },
      data,
    });
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
  }

  // Add audience characteristic
  async addAudienceCharacteristic(sessionId: string, data: {
    type: string;
    name: string;
    confidence: number;
    metadata?: any;
  }) {
    return await this.prisma.audienceCharacteristic.create({
      data: {
        sessionId,
        audienceType: data.type,
        audienceId: `audience_${Date.now()}`,
        name: data.name,
        confidence: data.confidence,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
      },
    });
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();

// Add debugging to ensure singleton is properly initialized
console.log('🔧 DatabaseService singleton created');
console.log('🔧 databaseService.prisma exists:', !!databaseService.prisma);
console.log('🔧 databaseService.prisma.persona exists:', !!databaseService.prisma?.persona); 