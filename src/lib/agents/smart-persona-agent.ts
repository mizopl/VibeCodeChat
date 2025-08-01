import { generateText, generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { getDatabaseService } from '../database/database';
import { getQlooTags, getEntity, getQlooTagTypes } from '../qloo/api';

export interface PersonaUpdate {
  name?: string;
  location?: string;
  gender?: string;
  age?: number;
  profession?: string;
  interests?: Array<{
    category: string;
    name: string;
    confidence: number;
    source: 'explicit' | 'inferred' | 'interaction';
  }>;
  audiences?: Array<{
    type: string;
    name: string;
    confidence: number;
  }>;
}

export interface QlooEntity {
  entityId: string;
  name: string;
  category: string;
  imageUrl?: string;
  description?: string;
  metadata?: any;
  confidence: number;
}

export class SmartPersonaAgent {
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }

  /**
   * Extract persona information from chat messages
   */
  async extractPersonaFromMessages(messages: Array<{ role: string; content: string }>): Promise<PersonaUpdate> {
    try {
      console.log('🔍 Smart Persona Agent: Extracting persona from messages');

      const userMessages = messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join('\n');

      const prompt = `Analyze the following user messages and extract persona information. Return a JSON object with the following structure:

{
  "name": "extracted name or null",
  "location": "extracted location or null", 
  "gender": "male/female/non-binary or null",
  "age": number or null,
  "profession": "extracted profession or null",
  "interests": [
    {
      "category": "brands/activities/food/entertainment/lifestyle/etc",
      "name": "interest name",
      "confidence": 0.0-1.0,
      "source": "explicit"
    }
  ],
  "audiences": [
    {
      "type": "urn:audience:communities/urn:audience:global_issues/etc",
      "name": "audience name", 
      "confidence": 0.0-1.0
    }
  ]
}

User messages:
${userMessages}

Extract all relevant persona information:`;

      const result = await generateText({
        model: google('gemini-1.5-flash'),
        prompt,
        maxTokens: 1000
      });

      // Parse the JSON response
      try {
        const jsonMatch = result.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]) as PersonaUpdate;
        } else {
          // Fallback: create basic persona from text
          console.log('⚠️ AI response parsing failed: No JSON found in response, using fallback extraction');
          return this.createFallbackPersona(userMessages);
        }
      } catch (parseError) {
        console.log('⚠️ AI response parsing failed: JSON parsing error, using fallback extraction');
        return this.createFallbackPersona(userMessages);
      }
    } catch (error) {
      console.error('❌ Smart Persona Agent: Extract persona error:', error);
      throw error;
    }
  }

  /**
   * Create fallback persona from text when AI parsing fails
   */
  private createFallbackPersona(text: string): PersonaUpdate {
    const persona: PersonaUpdate = {
      interests: [],
      audiences: []
    };

    // Extract name
    const nameMatch = text.match(/name is (\w+)/i);
    if (nameMatch) {
      persona.name = nameMatch[1];
    }

    // Extract location
    const locationMatch = text.match(/from ([^.]+)/i);
    if (locationMatch) {
      persona.location = locationMatch[1].trim();
    }

    // Extract gender
    if (text.includes('woman') || text.includes('female')) {
      persona.gender = 'female';
    } else if (text.includes('man') || text.includes('male')) {
      persona.gender = 'male';
    }

    // Extract age
    const ageMatch = text.match(/(\d+)-year-old/);
    if (ageMatch) {
      persona.age = parseInt(ageMatch[1]);
    }

    // Extract interests
    const interests: string[] = [];
    
    // Common interest patterns
    const interestPatterns = [
      /love ([\w\s]+)/gi,
      /like ([\w\s]+)/gi,
      /enjoy ([\w\s]+)/gi,
      /into ([\w\s]+)/gi,
      /favorite ([\w\s]+)/gi
    ];

    for (const pattern of interestPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const interest = match[1].trim();
        if (interest.length > 2 && !interests.includes(interest)) {
          interests.push(interest);
        }
      }
    }

    // Convert to structured interests
    persona.interests = interests.slice(0, 10).map(interest => ({
      category: 'general',
      name: interest,
      confidence: 0.7,
      source: 'explicit' as const
    }));

    return persona;
  }

  /**
   * Resolve interests to QLOO entities and tags
   */
  async resolveInterestsToQloo(interests: Array<{ category: string; name: string }>): Promise<QlooEntity[]> {
    try {
      console.log(`🔍 Smart Persona Agent: Processing ${interests.length} interests`);

      const qlooEntities: QlooEntity[] = [];

      for (const interest of interests) {
        // Try to find as QLOO entity first
        try {
          const entityResult = await getEntity({
            query: interest.name,
            limit: 2,
            targetAPI: 'GETENTITY'
          });
          
          if (entityResult.success && entityResult.data?.entities?.length > 0) {
            const entity = entityResult.data.entities[0];
            console.log(`✅ Found QLOO entity for "${interest.name}":`, {
              entityId: entity.entity_id,
              name: entity.name,
              imageUrl: entity.image_url,
              description: entity.description
            });
            qlooEntities.push({
              entityId: entity.entity_id,
              name: entity.name,
              category: interest.category,
              imageUrl: entity.image_url,
              description: entity.description,
              metadata: entity,
              confidence: 0.9
            });
          } else {
            // Try to find as QLOO tag
            const tagResult = await getQlooTags({
              tagType: 'all',
              query: interest.name,
              limit: 2
            });
            
            if (tagResult.success && tagResult.data?.tags?.length > 0) {
              const tag = tagResult.data.tags[0];
              qlooEntities.push({
                entityId: `tag_${tag.tag_id}`,
                name: tag.name,
                category: interest.category,
                description: tag.description,
                metadata: tag,
                confidence: 0.7
              });
            } else {
              // Store as unresolved interest
              qlooEntities.push({
                entityId: `interest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                name: interest.name,
                category: interest.category,
                confidence: 0.5,
                metadata: {
                  source: 'smart-persona-agent',
                  extractedAt: new Date().toISOString()
                }
              });
            }
          }
        } catch (error) {
          console.log(`⚠️ Failed to resolve interest "${interest.name}" to QLOO entity:`, error);
          // Store as unresolved interest
          qlooEntities.push({
            entityId: `interest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: interest.name,
            category: interest.category,
            confidence: 0.5,
            metadata: {
              source: 'smart-persona-agent',
              extractedAt: new Date().toISOString(),
              error: error instanceof Error ? error.message : 'Unknown error'
            }
          });
        }
      }

      return qlooEntities;
    } catch (error) {
      console.error('❌ Smart Persona Agent: Resolve interests error:', error);
      throw error;
    }
  }

  /**
   * Update persona with extracted data and QLOO entities
   */
  async updatePersona(personaUpdate: PersonaUpdate, qlooEntities: QlooEntity[]): Promise<void> {
    try {
      console.log(`🔍 Smart Persona Agent: Updating persona with ${personaUpdate.interests?.length || 0} interests, ${qlooEntities.length} QLOO entities`);

      // Update basic persona info
      if (personaUpdate.name || personaUpdate.location || personaUpdate.gender) {
        await databaseService.updatePersona(this.sessionId, {
          name: personaUpdate.name,
          location: personaUpdate.location,
          gender: personaUpdate.gender,
          demographics: {
            age: personaUpdate.age,
            profession: personaUpdate.profession
          }
        });
      }

      // Add interests with QLOO metadata
      for (const interest of personaUpdate.interests || []) {
        const qlooEntity = qlooEntities.find(e => e.name.toLowerCase() === interest.name.toLowerCase());
        
        await databaseService.addPersonalInterest(this.sessionId, {
          category: interest.category,
          name: interest.name,
          entityId: qlooEntity?.entityId,
          confidence: interest.confidence,
          source: interest.source,
          metadata: {
            qlooEntity: qlooEntity,
            imageUrl: qlooEntity?.imageUrl,
            description: qlooEntity?.description
          }
        });
      }

      // Add audience characteristics
      for (const audience of personaUpdate.audiences || []) {
        await databaseService.addAudienceCharacteristic(this.sessionId, {
          type: audience.type,
          name: audience.name,
          confidence: audience.confidence
        });
      }

    } catch (error) {
      console.error('❌ Smart Persona Agent: Update persona error:', error);
      throw error;
    }
  }

  /**
   * Main method to process chat messages and update persona
   */
  async processChatMessages(messages: Array<{ role: string; content: string }>): Promise<void> {
    try {
      console.log(`🔍 Smart Persona Agent: Processing ${messages.length} messages for session ${this.sessionId}`);

      // Extract persona data from messages
      const personaUpdate = await this.extractPersonaFromMessages(messages);
      
      // Resolve interests to QLOO entities
      const qlooEntities = await this.resolveInterestsToQloo(personaUpdate.interests || []);
      
      // Update persona in database
      await this.updatePersona(personaUpdate, qlooEntities);

      console.log(`✅ Smart Persona Agent updated persona for session ${this.sessionId}`);
      console.log(`📊 Extracted: ${personaUpdate.interests?.length || 0} interests, ${qlooEntities.length} QLOO entities`);

    } catch (error) {
      console.error('❌ Smart Persona Agent: Process messages error:', error);
      throw error;
    }
  }
} 