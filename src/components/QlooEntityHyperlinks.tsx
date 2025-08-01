'use client';

import React, { useState } from 'react';

interface Entity {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  description?: string;
  score?: number;
  relevanceScore?: number;
  tags?: string[];
  metadata?: any;
  imageUrl?: string;
  entityType?: string;
  properties?: any;
}

interface QlooEntityHyperlinksProps {
  text: string;
  entities: Entity[];
  onEntityClick?: (entity: Entity) => void;
}

export default function QlooEntityHyperlinks({ text, entities, onEntityClick }: QlooEntityHyperlinksProps) {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  const renderTextWithLinks = () => {
    if (!entities || entities.length === 0) {
      return text;
    }

    let processedText = text;
    
    // Sort entities by name length (longest first) to avoid partial matches
    const sortedEntities = [...entities].sort((a, b) => b.name.length - a.name.length);
    
    for (const entity of sortedEntities) {
      const regex = new RegExp(`\\b${entity.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      processedText = processedText.replace(regex, (match) => {
        return `<button class="entity-link inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm font-medium hover:bg-blue-200 transition-colors duration-200" data-entity-id="${entity.id}">${match}</button>`;
      });
    }
    
    return processedText;
  };

  const getEntityIcon = (type: string) => {
    if (!type) return '🎯';
    if (type.includes('place') || type.includes('restaurant')) return '🍽️';
    if (type.includes('movie') || type.includes('film')) return '🎬';
    if (type.includes('brand') || type.includes('company')) return '🏢';
    if (type.includes('music') || type.includes('artist')) return '🎵';
    if (type.includes('book') || type.includes('author')) return '📚';
    if (type.includes('game')) return '🎮';
    if (type.includes('fashion') || type.includes('clothing')) return '👗';
    if (type.includes('travel') || type.includes('destination')) return '✈️';
    return '🎯';
  };

  const getEntityImageUrl = (entity: Entity) => {
    return entity.imageUrl || 
           entity.metadata?.image?.url ||
           entity.metadata?.image_url ||
           entity.properties?.image?.url ||
           entity.properties?.image_url;
  };

  const getEntityTypeLabel = (entity: Entity) => {
    const type = entity.type || entity.entityType || 'unknown';
    if (!type || type === 'unknown') return 'Recommendation';
    if (type.includes('place') || type.includes('restaurant')) return 'Restaurant';
    if (type.includes('movie') || type.includes('film')) return 'Movie';
    if (type.includes('brand') || type.includes('company')) return 'Brand';
    if (type.includes('music') || type.includes('artist')) return 'Music';
    if (type.includes('book') || type.includes('author')) return 'Book';
    return 'Recommendation';
  };

  const getEntityDetails = (entity: Entity) => {
    const properties = entity.properties || {};
    const details = [];

    if (properties.cuisine || properties.food_type) {
      details.push({ label: 'Cuisine', value: properties.cuisine || properties.food_type });
    }
    if (properties.rating) {
      details.push({ label: 'Rating', value: `⭐ ${properties.rating}` });
    }
    if (properties.price_range) {
      details.push({ label: 'Price', value: `💰 ${properties.price_range}` });
    }
    if (properties.address) {
      details.push({ label: 'Address', value: properties.address });
    }
    if (properties.phone) {
      details.push({ label: 'Phone', value: properties.phone });
    }
    if (properties.website) {
      details.push({ label: 'Website', value: properties.website });
    }
    if (properties.release_year) {
      details.push({ label: 'Year', value: properties.release_year });
    }
    if (properties.director) {
      details.push({ label: 'Director', value: properties.director });
    }
    if (properties.runtime) {
      details.push({ label: 'Runtime', value: properties.runtime });
    }
    if (properties.genre) {
      details.push({ label: 'Genre', value: properties.genre });
    }
    if (properties.category || properties.industry) {
      details.push({ label: 'Category', value: properties.category || properties.industry });
    }
    if (properties.founded_year) {
      details.push({ label: 'Founded', value: properties.founded_year });
    }

    return details;
  };

  React.useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.classList.contains('entity-link')) {
        const entityId = target.getAttribute('data-entity-id');
        const entity = entities.find(e => e.id === entityId);
        if (entity) {
          setSelectedEntity(entity);
          onEntityClick?.(entity);
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [entities, onEntityClick]);

  return (
    <div className="relative">
      <div 
                    className="text-white leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderTextWithLinks() }}
      />
      
      {selectedEntity && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getEntityIcon(selectedEntity.type || '')}</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{selectedEntity.name}</h2>
                    <p className="text-sm text-gray-500">{getEntityTypeLabel(selectedEntity)}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEntity(null)}
                  className="text-gray-400 hover:text-gray-600 text-2xl"
                >
                  ×
                </button>
              </div>

              {/* Image */}
              {getEntityImageUrl(selectedEntity) && (
                <div className="mb-4 flex justify-center">
                  <div className="w-full h-48 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                    <img
                      src={getEntityImageUrl(selectedEntity)}
                      alt={selectedEntity.name}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              {selectedEntity.description && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                  <p className="text-gray-700">{selectedEntity.description}</p>
                </div>
              )}

              {/* Details */}
              {getEntityDetails(selectedEntity).length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {getEntityDetails(selectedEntity).map((detail, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="text-gray-600 font-medium">{detail.label}:</span>
                        <span className="text-white">{detail.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Score */}
              {selectedEntity.score && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Relevance Score</h3>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min(selectedEntity.score * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-600">{Math.round(selectedEntity.score * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedEntity.tags && selectedEntity.tags.length > 0 && (
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900 mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntity.tags.map((tag, index) => (
                      <span key={index} className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Metadata (for debugging) */}
              {process.env.NODE_ENV === 'development' && selectedEntity.metadata && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Full Metadata</h3>
                  <pre className="text-xs text-gray-600 overflow-auto">
                    {JSON.stringify(selectedEntity.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 