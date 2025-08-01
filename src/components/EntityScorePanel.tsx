'use client';

import React from 'react';

interface Entity {
  id: string;
  name: string;
  type: string;
  score?: number;
  relevanceScore?: number;
  properties?: any;
  metadata?: any;
}

interface EntityScorePanelProps {
  entities: Entity[];
  messageId: string;
}

export default function EntityScorePanel({ entities, messageId }: EntityScorePanelProps) {
  if (!entities || entities.length === 0) {
    return null;
  }

  // Filter entities that have scores
  const scoredEntities = entities.filter(entity => 
    entity.score !== undefined || 
    entity.relevanceScore !== undefined ||
    entity.properties?.rating !== undefined
  );

  if (scoredEntities.length === 0) {
    return null;
  }

  const getScoreDisplay = (entity: Entity) => {
    const score = entity.score || entity.relevanceScore || entity.properties?.rating;
    if (!score) return null;

    // Convert to percentage if it's a decimal
    const displayScore = score <= 1 ? Math.round(score * 100) : Math.round(score);
    
    // Determine color based on score
    let colorClass = 'text-gray-600';
    if (displayScore >= 80) colorClass = 'text-green-600';
    else if (displayScore >= 60) colorClass = 'text-yellow-600';
    else if (displayScore >= 40) colorClass = 'text-orange-600';
    else colorClass = 'text-red-600';

    return { displayScore, colorClass };
  };

  const getScoreLabel = (entity: Entity) => {
    if (entity.properties?.rating) return 'Rating';
    if (entity.score) return 'Relevance';
    if (entity.relevanceScore) return 'Match';
    return 'Score';
  };

  return (
    <div className="mt-3 p-3 bg-transparent rounded-lg border border-white/30">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-white">📊 Scores</span>
        <span className="text-xs text-white/70">({scoredEntities.length} items)</span>
      </div>
      
      <div className="space-y-2">
        {scoredEntities.map((entity) => {
          const scoreInfo = getScoreDisplay(entity);
          if (!scoreInfo) return null;

          const { displayScore, colorClass } = scoreInfo;
          const label = getScoreLabel(entity);

          return (
            <div key={entity.id} className="flex items-center justify-between p-2 bg-transparent rounded border border-white/30">
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{entity.name}</div>
                <div className="text-xs text-white/80">{entity.type.replace('urn:entity:', '')}</div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className={`text-sm font-semibold ${colorClass}`}>
                    {displayScore}%
                  </div>
                  <div className="text-xs text-white/80">{label}</div>
                </div>
                {/* Score bar */}
                <div className="w-16 h-2 bg-white/20 rounded-full">
                  <div 
                    className={`h-2 rounded-full ${
                      displayScore >= 80 ? 'bg-green-500' :
                      displayScore >= 60 ? 'bg-yellow-500' :
                      displayScore >= 40 ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${displayScore}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 