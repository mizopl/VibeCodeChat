'use client';

import React from 'react';

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

interface VisualChatElementsProps {
  entities: Entity[];
  messageType: 'recommendation' | 'discovery' | 'general';
}

export default function VisualChatElements({ entities, messageType }: VisualChatElementsProps) {
  if (!entities || entities.length === 0) {
    return null;
  }

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
    // Try multiple possible image sources
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
      details.push(`${properties.cuisine || properties.food_type} cuisine`);
    }
    if (properties.rating) {
      details.push(`⭐ ${properties.rating}`);
    }
    if (properties.price_range) {
      details.push(`💰 ${properties.price_range}`);
    }
    if (properties.release_year) {
      details.push(`📅 ${properties.release_year}`);
    }
    if (properties.director) {
      details.push(`🎬 ${properties.director}`);
    }
    if (properties.genre) {
      details.push(`🎭 ${properties.genre}`);
    }
    if (properties.category || properties.industry) {
      details.push(`🏷️ ${properties.category || properties.industry}`);
    }

    return details;
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2 text-sm text-white/90">
        <span className="font-medium">
          {messageType === 'recommendation' && '🎯 Personalized Recommendations'}
          {messageType === 'discovery' && '🔍 Discovered Entities'}
          {messageType === 'general' && '📋 Related Items'}
        </span>
        <span className="text-white/70">({entities.length} items)</span>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((entity) => {
          const imageUrl = getEntityImageUrl(entity);
          const entityType = getEntityTypeLabel(entity);
          const details = getEntityDetails(entity);
          
          return (
            <div key={entity.id} className="bg-transparent border border-white/30 rounded-lg p-4 hover:shadow-md transition-shadow duration-200">
              {/* Image Section */}
              {imageUrl && (
                <div className="mb-3 flex justify-center">
                  <div className="w-full h-48 flex items-center justify-center bg-transparent rounded-md overflow-hidden">
                    <img 
                      src={imageUrl} 
                      alt={entity.name} 
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                </div>
              )}
              
              {/* Content Section */}
              <div className="space-y-2 bg-transparent">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="text-lg">{getEntityIcon(entity.type)}</span>
                  <div className="flex-1">
                    <h4 className="font-semibold text-white text-sm">{entity.name}</h4>
                    <p className="text-xs text-white/80">{getEntityTypeLabel(entity)}</p>
                  </div>
                </div>
                
                {/* Description */}
                {entity.description && (
                  <p className="text-xs text-white/90 line-clamp-2">{entity.description}</p>
                )}
                
                {/* Details */}
                {details.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {details.slice(0, 3).map((detail, index) => (
                      <span key={index} className="inline-block px-2 py-1 text-xs bg-white/20 text-white rounded">
                        {detail}
                      </span>
                    ))}
                    {details.length > 3 && (
                      <span className="text-xs text-white/70">+{details.length - 3} more</span>
                    )}
                  </div>
                )}
                
                {/* Score */}
                {entity.score && (
                  <div className="flex items-center gap-1">
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                      <div 
                        className="bg-blue-500 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(entity.score * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-white/80">{Math.round(entity.score * 100)}%</span>
                  </div>
                )}
                
                {/* Tags removed to prevent duplication with QlooEntityHyperlinks */}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 