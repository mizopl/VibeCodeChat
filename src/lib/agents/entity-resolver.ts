import { getEntity } from '../qloo/api';
import { QlooParameters } from '@/types';
import { broadcastDebugMessage } from '../utils/debug';

export interface EntitySearchResult {
  entityId: string;
  entityName: string;
  entityType: string;
  confidence: number;
  metadata?: any;
}

export class EntityResolver {
  async resolveEntities(userQuery: string, entityType: string, limit: number = 5): Promise<EntitySearchResult[]> {
    console.log('🔍 Resolving entities for query:', userQuery);
    
    broadcastDebugMessage('api', {
      type: 'entity-resolution',
      method: 'RESOLVE_ENTITIES',
      parameters: { userQuery, entityType, limit },
      status: 'calling'
    });

    try {
      // Extract key terms from the query for entity search
      const searchTerms = this.extractSearchTerms(userQuery);
      
      const results: EntitySearchResult[] = [];
      
      for (const term of searchTerms) {
        const params: QlooParameters = {
          query: term,
          entityType: entityType,
          targetAPI: 'GETENTITY',
          limit: limit
        };

        const response = await getEntity(params);
        
        if (response.data && 'entities' in response.data && Array.isArray(response.data.entities)) {
          for (const entity of response.data.entities) {
            if (entity.id && entity.name) {
              results.push({
                entityId: entity.id,
                entityName: entity.name,
                entityType: entity.type || entityType,
                confidence: this.calculateConfidence(term, entity.name),
                metadata: entity
              });
            }
          }
        }
      }

      // Sort by confidence and remove duplicates
      const uniqueResults = this.removeDuplicates(results);
      const sortedResults = uniqueResults.sort((a, b) => b.confidence - a.confidence);

      console.log('✅ Resolved entities:', sortedResults.map(r => `${r.entityName} (${r.entityId})`));
      
      broadcastDebugMessage('api', {
        type: 'entity-resolution',
        method: 'RESOLVE_ENTITIES',
        parameters: { userQuery, entityType, limit },
        response: sortedResults,
        status: 'completed'
      });

      return sortedResults.slice(0, limit);

    } catch (error) {
      console.error('❌ Entity resolution failed:', error);
      
      broadcastDebugMessage('error', {
        type: 'entity-resolution',
        method: 'RESOLVE_ENTITIES',
        parameters: { userQuery, entityType, limit },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });

      return [];
    }
  }

  private extractSearchTerms(userQuery: string): string[] {
    const query = userQuery.toLowerCase();
    const terms: string[] = [];

    // Extract brand names, movie titles, etc.
    const patterns = [
      /\b(nike|adidas|puma|under armour|new balance)\b/g,
      /\b(star wars|marvel|disney|netflix|hbo)\b/g,
      /\b(mcdonalds|starbucks|apple|google|microsoft)\b/g,
      /\b(action|comedy|drama|horror|sci-fi)\b/g,
      /\b(restaurant|cafe|bar|hotel)\b/g
    ];

    for (const pattern of patterns) {
      const matches = query.match(pattern);
      if (matches) {
        terms.push(...matches);
      }
    }

    // If no specific terms found, use the whole query
    if (terms.length === 0) {
      terms.push(userQuery.trim());
    }

    return [...new Set(terms)]; // Remove duplicates
  }

  private calculateConfidence(searchTerm: string, entityName: string): number {
    const term = searchTerm.toLowerCase();
    const name = entityName.toLowerCase();
    
    if (name.includes(term) || term.includes(name)) {
      return 0.9;
    }
    
    // Simple similarity check
    const termWords = term.split(' ');
    const nameWords = name.split(' ');
    const commonWords = termWords.filter(word => nameWords.includes(word));
    
    if (commonWords.length > 0) {
      return 0.7;
    }
    
    return 0.5;
  }

  private removeDuplicates(results: EntitySearchResult[]): EntitySearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.entityId)) {
        return false;
      }
      seen.add(result.entityId);
      return true;
    });
  }

  async resolveSpecificEntity(entityName: string, entityType: string): Promise<EntitySearchResult | null> {
    const results = await this.resolveEntities(entityName, entityType, 1);
    return results.length > 0 ? results[0] : null;
  }
} 