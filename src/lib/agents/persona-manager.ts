import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { getDatabaseService } from '../database/database';
import { getEntity } from '../qloo/api';
import { broadcastDebugMessage } from '../utils/debug';
import { SmartInterestExtractor, ExtractedInterest } from './smart-interest-extractor';
import { NameLocationExtractor, ExtractedNameLocation } from './name-location-extractor';

export interface PersonalInterest {
  id: string;
  category: string;
  name: string;
  entityId?: string;
  confidence: number;
  source: 'explicit' | 'inferred' | 'interaction';
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface AudienceCharacteristic {
  id: string;
  audienceType: string;
  audienceId: string;
  name: string;
  confidence: number;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface Persona {
  id: string;
  sessionId: string;
  interests: PersonalInterest[];
  audiences: AudienceCharacteristic[];
  demographics?: {
    age?: number;
    gender?: string;
    location?: {
      city?: string;
      country?: string;
    };
    income?: string;
    education?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  confidence: number;
}

export class PersonaManager {
  private sessionId?: string;
  private smartExtractor: SmartInterestExtractor;
  private nameLocationExtractor: NameLocationExtractor;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
    this.smartExtractor = new SmartInterestExtractor();
    this.nameLocationExtractor = new NameLocationExtractor();
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
    this.smartExtractor.setSessionId(sessionId);
    this.nameLocationExtractor.setSessionId(sessionId);
  }

    // Extract interests from text using smart extraction
  async extractInterestsFromText(text: string): Promise<PersonalInterest[]> {
    if (!this.sessionId) return [];

    try {
      // Use smart interest extractor with single text input
      const extractedInterests = await this.smartExtractor.extractFromText(text);
      
      // Convert to PersonalInterest format
      const newPersonalInterests: PersonalInterest[] = [];
      
      for (const interest of extractedInterests) {
        const personalInterest: PersonalInterest = {
          id: `${this.sessionId}-${Date.now()}-${Math.random()}`,
          category: interest.category,
          name: interest.name,
          confidence: interest.confidence,
          source: 'bio-analysis',
          entityId: interest.qlooEntityId,
          timestamp: new Date(),
          metadata: {
            extractedFrom: 'bio',
            originalText: text
          }
        };
        
        newPersonalInterests.push(personalInterest);
      }
      
      console.log(`🎯 Extracted ${newPersonalInterests.length} interests from text`);
      return newPersonalInterests;
      
    } catch (error) {
      console.error('❌ Error extracting interests from text:', error);
      return [];
    }
  }

  // Extract interests from user conversation using smart extraction
  async extractInterestsFromConversation(messages: any[]): Promise<PersonalInterest[]> {
    if (!this.sessionId) return [];

    try {
      // Get existing interests to avoid duplicates
      const existingInterests = await this.getStoredInterests();
      const existingInterestNames = new Set(existingInterests.map(interest => interest.name.toLowerCase()));
      
      // Use smart interest extractor
      const extractedInterests = await this.smartExtractor.extractFromConversation(messages);
      
      // Filter out duplicates and convert to PersonalInterest format
      const newPersonalInterests: PersonalInterest[] = [];
      
      for (const interest of extractedInterests) {
        const interestNameLower = interest.name.toLowerCase();
        
        // Skip if interest already exists
        if (existingInterestNames.has(interestNameLower)) {
          console.log(`🔄 Skipping duplicate interest: ${interest.name}`);
          continue;
        }
        
        // Add to new interests list
        const personalInterest: PersonalInterest = {
          id: `${this.sessionId}-${Date.now()}-${Math.random()}`,
          category: interest.category,
          name: interest.name,
          confidence: interest.confidence,
          source: interest.source,
          entityId: interest.qlooEntityId,
          timestamp: new Date(),
          metadata: {
            qlooTagId: interest.qlooTagId,
            context: interest.context,
            originalExtraction: interest
          }
        };
        
        newPersonalInterests.push(personalInterest);
        existingInterestNames.add(interestNameLower); // Prevent duplicates within this batch
      }

      // Store only new interests in database
      if (newPersonalInterests.length > 0) {
        await this.storeInterests(newPersonalInterests);
        console.log(`✅ Stored ${newPersonalInterests.length} new interests`);
      } else {
        console.log('ℹ️ No new interests to store');
      }

      return newPersonalInterests;
    } catch (error) {
      console.error('❌ Failed to extract interests:', error);
      return [];
    }
  }

  // Store interests in database
  async storeInterests(interests: PersonalInterest[]): Promise<void> {
    if (!this.sessionId) return;

    try {
      const databaseService = getDatabaseService();
      for (const interest of interests) {
        await databaseService.storePersonalInterest(
          this.sessionId,
          interest.category,
          interest.name,
          interest.entityId,
          interest.confidence,
          interest.source,
          interest.metadata
        );
      }
    } catch (error) {
      console.error('❌ Failed to store interests:', error);
    }
  }

  // Get stored interests for a session
  async getStoredInterests(): Promise<PersonalInterest[]> {
    if (!this.sessionId) return [];

    try {
      const databaseService = getDatabaseService();
      const interests = await databaseService.getPersonalInterests(this.sessionId);
      return interests.map(interest => ({
        id: interest.id,
        category: interest.category,
        name: interest.name,
        entityId: interest.entityId,
        confidence: interest.confidence,
        source: interest.source as 'explicit' | 'inferred' | 'interaction',
        timestamp: new Date(interest.createdAt),
        metadata: interest.metadata
      }));
    } catch (error) {
      console.error('❌ Failed to get stored interests:', error);
      return [];
    }
  }

  // Resolve interests to entity IDs
  async resolveInterestEntities(interests: PersonalInterest[], targetEntityType?: string): Promise<string[]> {
    const entityIds: string[] = [];

    for (const interest of interests) {
      // If we already have a valid Qloo entity ID, check if it matches the target entity type
      if (interest.entityId && (interest.entityId.startsWith('urn:entity:') || interest.entityId.startsWith('E'))) {
        // Only use existing entity ID if it matches the target entity type or if no target specified
        if (!targetEntityType || this.isEntityTypeCompatible(interest.entityId, targetEntityType)) {
          entityIds.push(interest.entityId);
          console.log(`✅ Using existing entity ID for ${interest.name}: ${interest.entityId}`);
          continue;
        } else {
          console.log(`⚠️ Skipping ${interest.name} - existing entity ID doesn't match target type ${targetEntityType}`);
        }
      }

      try {
        console.log(`🔍 Resolving entity for interest: ${interest.name} (target: ${targetEntityType})`);
        
        // Determine the appropriate entity type to search for based on the target
        let searchEntityType = targetEntityType;
        if (!searchEntityType) {
          // Enhanced entity type mapping for common interests
          const entityTypeMap: Record<string, string> = {
            'movie': 'urn:entity:movie',
            'film': 'urn:entity:movie',
            'cinema': 'urn:entity:movie',
            'restaurant': 'urn:entity:place',
            'food': 'urn:entity:place',
            'dining': 'urn:entity:place',
            'cafe': 'urn:entity:place',
            'pizza': 'urn:entity:place',
            'music': 'urn:entity:artist',
            'artist': 'urn:entity:artist',
            'musician': 'urn:entity:artist',
            'band': 'urn:entity:artist',
            'singer': 'urn:entity:artist',
            'book': 'urn:entity:book',
            'novel': 'urn:entity:book',
            'literature': 'urn:entity:book',
            'author': 'urn:entity:person',
            'writer': 'urn:entity:person',
            'place': 'urn:entity:place',
            'destination': 'urn:entity:destination',
            'travel': 'urn:entity:destination',
            'city': 'urn:entity:destination',
            'country': 'urn:entity:destination',
            'person': 'urn:entity:person',
            'celebrity': 'urn:entity:person',
            'actor': 'urn:entity:person',
            'podcast': 'urn:entity:podcast',
            'tv': 'urn:entity:tv_show',
            'show': 'urn:entity:tv_show',
            'series': 'urn:entity:tv_show',
            'game': 'urn:entity:video_game',
            'gaming': 'urn:entity:video_game',
            'video game': 'urn:entity:video_game'
          };
          
          // Try to match interest name to entity type
          const interestLower = interest.name.toLowerCase();
          for (const [key, entityType] of Object.entries(entityTypeMap)) {
            if (interestLower.includes(key)) {
              searchEntityType = entityType;
              console.log(`🎯 Mapped interest "${interest.name}" to entity type: ${entityType}`);
              break;
            }
          }
        }
        
        // Try to resolve entity with the determined entity type
        let resolved = false;
        let entityId = null;
        
        try {
          const response = await Promise.race([
            getEntity({
              query: interest.name,
              targetAPI: 'GETENTITY',
              limit: 2, // Ensure at least 2 as required by Qloo API
              entityType: searchEntityType
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Entity resolution timeout')), 5000)
            )
          ]);

          if (response.data && 'entities' in response.data && response.data.entities.length > 0) {
            const entity = response.data.entities[0];
            entityId = entity.entity_id || entity.id;
            resolved = true;
          } else if (response.data && 'results' in response.data && response.data.results.length > 0) {
            // Handle the search API response format
            const entity = response.data.results[0];
            entityId = entity.entity_id || entity.id;
            resolved = true;
          }
        } catch (error) {
          console.log(`⚠️ Failed to resolve ${interest.name} with entity type ${searchEntityType}:`, error);
        }
        
        // If first attempt failed and we have a target entity type, try without entity type constraint
        if (!resolved && targetEntityType && searchEntityType !== targetEntityType) {
          console.log(`🔄 Retrying ${interest.name} without entity type constraint...`);
          try {
            const response = await Promise.race([
              getEntity({
                query: interest.name,
                targetAPI: 'GETENTITY',
                limit: 2
              }),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Entity resolution timeout')), 5000)
              )
            ]);

            if (response.data && 'entities' in response.data && response.data.entities.length > 0) {
              const entity = response.data.entities[0];
              entityId = entity.entity_id || entity.id;
              resolved = true;
            } else if (response.data && 'results' in response.data && response.data.results.length > 0) {
              const entity = response.data.results[0];
              entityId = entity.entity_id || entity.id;
              resolved = true;
            }
          } catch (error) {
            console.log(`⚠️ Failed to resolve ${interest.name} without entity type constraint:`, error);
          }
        }
        
        if (resolved && entityId) {
          // Only add if the resolved entity type is compatible with target
          if (!targetEntityType || this.isEntityTypeCompatible(entityId, targetEntityType)) {
            entityIds.push(entityId);
            console.log(`✅ Resolved ${interest.name} to entity: ${entityId}`);
            await this.updateInterestEntityId(interest.id, entityId);
          } else {
            console.log(`⚠️ Skipping ${interest.name} - resolved entity type doesn't match target`);
          }
        } else {
          console.log(`⚠️ No entity found for interest: ${interest.name}`);
        }
      } catch (error) {
        console.error(`❌ Failed to resolve entity for ${interest.name}:`, error);
      }
    }
    console.log(`🎯 Total resolved entities: ${entityIds.length}`);
    return entityIds;
  }

  // Helper method to check if an entity ID is compatible with a target entity type
  private isEntityTypeCompatible(entityId: string, targetEntityType: string): boolean {
    // If entity ID starts with urn:entity:, extract the type and compare
    if (entityId.startsWith('urn:entity:')) {
      const entityType = entityId.split(':')[2]; // Extract type from urn:entity:type
      return entityType === targetEntityType.split(':')[2];
    }
    
    // For UUID entity IDs, we can't determine the type from the ID alone
    // Since the Qloo API will handle type validation on its end, we'll be permissive
    // and let the API decide if the entity is compatible with the target type
    return true;
  }

  // Resolve interests to tag IDs using Qloo Tags API
  async resolveInterestTags(interests: PersonalInterest[]): Promise<string[]> {
    // Temporarily disable tag signals since the Insights API is rejecting even valid tag IDs
    // The entity signals work perfectly, so we'll focus on those
    console.log('⚠️ Temporarily skipping tag signals - using entity signals only');
    return [];
  }

  // Update interest with entity ID
  async updateInterestEntityId(interestId: string, entityId: string): Promise<void> {
    if (!this.sessionId) return;

    try {
      const databaseService = getDatabaseService();
      await databaseService.updatePersonalInterestEntityId(interestId, entityId);
    } catch (error) {
      console.error('❌ Failed to update interest entity ID:', error);
    }
  }

  // Generate signals for Insights API
  async generateSignals(targetEntityType?: string): Promise<{
    entitySignals: string[];
    audienceSignals: string[];
    tagSignals: string[];
  }> {
    try {
      const interests = await this.getStoredInterests();
      console.log('🎯 Generating signals from interests:', interests.map(i => i.name));
      console.log('🎯 Target entity type:', targetEntityType);
      
      // Only try to resolve entities if we have interests
      if (interests.length === 0) {
        console.log('ℹ️ No interests found, returning empty signals');
        return {
          entitySignals: [],
          audienceSignals: [],
          tagSignals: []
        };
      }
      
      const entityIds = await this.resolveInterestEntities(interests, targetEntityType);
      console.log('🎯 Resolved entity signals:', entityIds);
      
      // Generate tag signals for interests that are likely tags
      const tagSignals = await this.resolveInterestTags(interests);
      console.log('🎯 Resolved tag signals:', tagSignals);
      
      return {
        entitySignals: entityIds,
        audienceSignals: [],
        tagSignals: tagSignals
      };
    } catch (error) {
      console.error('❌ Error generating signals:', error);
      // Return empty signals on error to prevent API failures
      return {
        entitySignals: [],
        audienceSignals: [],
        tagSignals: []
      };
    }
  }

  // Add explicit interest
  async addExplicitInterest(category: string, name: string, confidence: number = 0.9): Promise<void> {
    const interest: PersonalInterest = {
      id: `${this.sessionId}-${Date.now()}-${Math.random()}`,
      category,
      name,
      confidence,
      source: 'explicit',
      timestamp: new Date()
    };

    await this.storeInterests([interest]);
  }

  // Update interest confidence based on user feedback
  async updateInterestConfidence(interestName: string, feedback: 'positive' | 'negative'): Promise<void> {
    if (!this.sessionId) return;

    try {
      const delta = feedback === 'positive' ? 0.1 : -0.1;
      const databaseService = getDatabaseService();
      await databaseService.updatePersonalInterestConfidence(this.sessionId, interestName, delta);
    } catch (error) {
      console.error('❌ Failed to update interest confidence:', error);
    }
  }

  // Extract and update name/location/gender from conversation
  async extractAndUpdateNameLocation(messages: any[]): Promise<ExtractedNameLocation> {
    if (!this.sessionId) {
      return { name: undefined, location: undefined, gender: undefined, confidence: 0, reasoning: 'No session ID' };
    }

    try {
      const extraction = await this.nameLocationExtractor.extractFromConversation(messages);
      
      if (extraction.name || extraction.location || extraction.gender) {
        // Ensure persona exists first
        const databaseService = getDatabaseService();
        await databaseService.getOrCreatePersona(this.sessionId, undefined, extraction.name, extraction.location, extraction.gender);
        
        console.log('✅ Updated persona name/location/gender:', { name: extraction.name, location: extraction.location, gender: extraction.gender });
      }

      return extraction;
    } catch (error) {
      console.error('Failed to extract name/location/gender:', error);
      return { name: undefined, location: undefined, gender: undefined, confidence: 0, reasoning: 'Extraction failed' };
    }
  }

  // Extract name/location/gender from single message
  async extractFromMessage(message: string): Promise<ExtractedNameLocation> {
    if (!this.sessionId) {
      return { name: undefined, location: undefined, gender: undefined, confidence: 0, reasoning: 'No session ID' };
    }

    try {
      const extraction = await this.nameLocationExtractor.extractFromMessage(message);
      
      if (extraction.name || extraction.location || extraction.gender) {
        // Ensure persona exists first
        const databaseService = getDatabaseService();
        await databaseService.getOrCreatePersona(this.sessionId, undefined, extraction.name, extraction.location, extraction.gender);
        
        console.log('✅ Updated persona name/location/gender from message:', { name: extraction.name, location: extraction.location, gender: extraction.gender });
      }

      return extraction;
    } catch (error) {
      console.error('Failed to extract name/location/gender from message:', error);
      return { name: undefined, location: undefined, gender: undefined, confidence: 0, reasoning: 'Extraction failed' };
    }
  }

  // Get persona summary
  async getPersonaSummary(): Promise<{
    interests: PersonalInterest[];
    topCategories: string[];
    confidence: number;
  }> {
    const interests = await this.getStoredInterests();
    
    // Group by category
    const categoryCounts: Record<string, number> = {};
    interests.forEach(interest => {
      categoryCounts[interest.category] = (categoryCounts[interest.category] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);

    const averageConfidence = interests.length > 0 
      ? interests.reduce((sum, interest) => sum + interest.confidence, 0) / interests.length
      : 0;

    return {
      interests,
      topCategories,
      confidence: averageConfidence
    };
  }

  // Get comprehensive persona details
  async getPersonaDetails(): Promise<{
    name?: string;
    location?: string;
    gender?: string;
    demographics?: any;
    confidence: number;
  }> {
    if (!this.sessionId) {
      return { confidence: 0 };
    }

    try {
      const databaseService = getDatabaseService();
      const persona = await databaseService.getPersona(this.sessionId);
      if (!persona) {
        return { confidence: 0 };
      }

      return {
        name: persona.name || undefined,
        location: persona.location || undefined,
        gender: persona.gender || undefined,
        demographics: persona.demographics || undefined,
        confidence: persona.confidence || 0
      };
    } catch (error) {
      console.error('❌ Failed to get persona details:', error);
      return { confidence: 0 };
    }
  }
} 