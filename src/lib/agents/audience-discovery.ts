import { getAllAudienceCategories, getAudienceTypes } from '../qloo/api';
import { broadcastDebugMessage } from '../utils/debug';

export interface AudienceMapping {
  audienceType: string;
  audienceId: string;
  name: string;
  confidence: number;
  reasoning: string;
}

export interface AudienceCategory {
  type: string;
  name: string;
  description: string;
  audiences: AudienceMapping[];
}

export class AudienceDiscovery {
  private cachedAudiences: Record<string, any[]> = {};
  private audienceTypes: any[] = [];

  // Initialize audience discovery
  async initialize(): Promise<void> {
    try {
      console.log('🔍 Initializing audience discovery...');
      
      // Get audience types
      const typesResponse = await getAudienceTypes();
      if (typesResponse.data && 'audienceTypes' in typesResponse.data) {
        this.audienceTypes = typesResponse.data.audienceTypes;
      }
      
      // Get all audience categories
      this.cachedAudiences = await getAllAudienceCategories();
      
      console.log('✅ Audience discovery initialized with', Object.keys(this.cachedAudiences).length, 'categories');
    } catch (error) {
      console.error('❌ Failed to initialize audience discovery:', error);
    }
  }

  // Map user interests to audience characteristics
  async mapInterestsToAudiences(interests: string[]): Promise<AudienceMapping[]> {
    const mappings: AudienceMapping[] = [];
    
    for (const interest of interests) {
      const interestMappings = await this.mapSingleInterest(interest);
      mappings.push(...interestMappings);
    }
    
    return mappings;
  }

  // Map a single interest to potential audiences
  private async mapSingleInterest(interest: string): Promise<AudienceMapping[]> {
    const mappings: AudienceMapping[] = [];
    const interestLower = interest.toLowerCase();
    
    // Define mapping rules
    const mappingRules = [
      // Professional interests
      {
        keywords: ['tech', 'programming', 'software', 'developer', 'engineer'],
        audienceType: 'urn:audience:professional_area',
        audienceName: 'Technology Professionals',
        confidence: 0.9
      },
      {
        keywords: ['health', 'medical', 'doctor', 'nurse', 'healthcare'],
        audienceType: 'urn:audience:professional_area',
        audienceName: 'Healthcare Professionals',
        confidence: 0.9
      },
      {
        keywords: ['finance', 'banking', 'investment', 'accounting'],
        audienceType: 'urn:audience:professional_area',
        audienceName: 'Finance Professionals',
        confidence: 0.9
      },
      
      // Lifestyle preferences
      {
        keywords: ['fitness', 'gym', 'workout', 'exercise', 'sports'],
        audienceType: 'urn:audience:lifestyle_preferences_beliefs',
        audienceName: 'Fitness Enthusiasts',
        confidence: 0.8
      },
      {
        keywords: ['yoga', 'meditation', 'wellness', 'mindfulness'],
        audienceType: 'urn:audience:lifestyle_preferences_beliefs',
        audienceName: 'Wellness & Mindfulness',
        confidence: 0.8
      },
      {
        keywords: ['sustainable', 'eco', 'green', 'environmental'],
        audienceType: 'urn:audience:lifestyle_preferences_beliefs',
        audienceName: 'Environmental Consciousness',
        confidence: 0.8
      },
      
      // Hobbies and interests
      {
        keywords: ['fishing', 'hunting', 'outdoor', 'camping'],
        audienceType: 'urn:audience:hobbies_and_interests',
        audienceName: 'Outdoor Recreation',
        confidence: 0.9
      },
      {
        keywords: ['cooking', 'food', 'culinary', 'chef'],
        audienceType: 'urn:audience:hobbies_and_interests',
        audienceName: 'Food & Cooking',
        confidence: 0.9
      },
      {
        keywords: ['photography', 'camera', 'photo'],
        audienceType: 'urn:audience:hobbies_and_interests',
        audienceName: 'Photography',
        confidence: 0.9
      },
      
      // Leisure activities
      {
        keywords: ['travel', 'vacation', 'tourism', 'adventure'],
        audienceType: 'urn:audience:leisure',
        audienceName: 'Travel & Adventure',
        confidence: 0.8
      },
      {
        keywords: ['gaming', 'video games', 'esports'],
        audienceType: 'urn:audience:leisure',
        audienceName: 'Gaming',
        confidence: 0.9
      },
      {
        keywords: ['music', 'concert', 'festival'],
        audienceType: 'urn:audience:leisure',
        audienceName: 'Music & Entertainment',
        confidence: 0.8
      },
      
      // Life stage indicators
      {
        keywords: ['student', 'college', 'university', 'school'],
        audienceType: 'urn:audience:life_stage',
        audienceName: 'Students',
        confidence: 0.9
      },
      {
        keywords: ['parent', 'family', 'children', 'kids'],
        audienceType: 'urn:audience:life_stage',
        audienceName: 'Parents',
        confidence: 0.8
      },
      {
        keywords: ['retired', 'senior', 'elderly'],
        audienceType: 'urn:audience:life_stage',
        audienceName: 'Retirees',
        confidence: 0.9
      },
      
      // Spending habits
      {
        keywords: ['luxury', 'premium', 'high-end', 'designer'],
        audienceType: 'urn:audience:spending_habits',
        audienceName: 'Luxury Consumers',
        confidence: 0.8
      },
      {
        keywords: ['budget', 'affordable', 'value', 'cheap'],
        audienceType: 'urn:audience:spending_habits',
        audienceName: 'Budget-Conscious',
        confidence: 0.8
      }
    ];
    
    // Apply mapping rules
    for (const rule of mappingRules) {
      const matches = rule.keywords.some(keyword => 
        interestLower.includes(keyword)
      );
      
      if (matches) {
        mappings.push({
          audienceType: rule.audienceType,
          audienceId: `${rule.audienceType}:${rule.audienceName.toLowerCase().replace(/\s+/g, '_')}`,
          name: rule.audienceName,
          confidence: rule.confidence,
          reasoning: `Interest "${interest}" matches keywords: ${rule.keywords.join(', ')}`
        });
      }
    }
    
    return mappings;
  }

  // Get available audience categories
  async getAvailableAudienceCategories(): Promise<AudienceCategory[]> {
    const categories: AudienceCategory[] = [];
    
    const categoryDescriptions = {
      'urn:audience:communities': 'Social groups and communities',
      'urn:audience:global_issues': 'Environmental and social causes',
      'urn:audience:hobbies_and_interests': 'Personal activities and passions',
      'urn:audience:investing_interests': 'Financial and investment preferences',
      'urn:audience:leisure': 'Entertainment and relaxation activities',
      'urn:audience:life_stage': 'Current life phase and demographics',
      'urn:audience:lifestyle_preferences_beliefs': 'Personal values and lifestyle choices',
      'urn:audience:political_preferences': 'Political affiliations and views',
      'urn:audience:professional_area': 'Career field and professional interests',
      'urn:audience:spending_habits': 'Consumer behavior and purchasing patterns'
    };
    
    for (const [type, audiences] of Object.entries(this.cachedAudiences)) {
      categories.push({
        type,
        name: type.split(':').pop()?.replace(/_/g, ' ') || type,
        description: categoryDescriptions[type as keyof typeof categoryDescriptions] || 'Audience category',
        audiences: audiences.map((audience: any) => ({
          audienceType: type,
          audienceId: audience.id || audience.audienceId,
          name: audience.name || audience.audienceName,
          confidence: 0.5,
          reasoning: 'Available audience option'
        }))
      });
    }
    
    return categories;
  }

  // Search audiences by keyword
  async searchAudiences(keyword: string): Promise<AudienceMapping[]> {
    const results: AudienceMapping[] = [];
    
    for (const [type, audiences] of Object.entries(this.cachedAudiences)) {
      for (const audience of audiences) {
        const audienceName = audience.name || audience.audienceName;
        if (audienceName.toLowerCase().includes(keyword.toLowerCase())) {
          results.push({
            audienceType: type,
            audienceId: audience.id || audience.audienceId,
            name: audienceName,
            confidence: 0.7,
            reasoning: `Matches keyword: ${keyword}`
          });
        }
      }
    }
    
    return results;
  }

  // Get audience recommendations based on user profile
  async getAudienceRecommendations(userInterests: string[], demographics?: any): Promise<AudienceMapping[]> {
    const recommendations: AudienceMapping[] = [];
    
    // Map interests to audiences
    const interestMappings = await this.mapInterestsToAudiences(userInterests);
    recommendations.push(...interestMappings);
    
    // Add demographic-based recommendations
    if (demographics) {
      const demographicMappings = this.mapDemographicsToAudiences(demographics);
      recommendations.push(...demographicMappings);
    }
    
    // Remove duplicates and sort by confidence
    const uniqueRecommendations = this.removeDuplicateAudiences(recommendations);
    return uniqueRecommendations.sort((a, b) => b.confidence - a.confidence);
  }

  // Map demographics to audiences
  private mapDemographicsToAudiences(demographics: any): AudienceMapping[] {
    const mappings: AudienceMapping[] = [];
    
    // Age-based mappings
    if (demographics.age) {
      if (demographics.age < 25) {
        mappings.push({
          audienceType: 'urn:audience:life_stage',
          audienceId: 'urn:audience:life_stage:young_adults',
          name: 'Young Adults',
          confidence: 0.8,
          reasoning: `Age: ${demographics.age}`
        });
      } else if (demographics.age > 65) {
        mappings.push({
          audienceType: 'urn:audience:life_stage',
          audienceId: 'urn:audience:life_stage:seniors',
          name: 'Seniors',
          confidence: 0.8,
          reasoning: `Age: ${demographics.age}`
        });
      }
    }
    
    // Location-based mappings
    if (demographics.location) {
      if (demographics.location.city) {
        mappings.push({
          audienceType: 'urn:audience:communities',
          audienceId: 'urn:audience:communities:urban',
          name: 'Urban Communities',
          confidence: 0.6,
          reasoning: `Location: ${demographics.location.city}`
        });
      }
    }
    
    return mappings;
  }

  // Remove duplicate audiences
  private removeDuplicateAudiences(audiences: AudienceMapping[]): AudienceMapping[] {
    const seen = new Set<string>();
    return audiences.filter(audience => {
      const key = `${audience.audienceType}:${audience.audienceId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
} 