'use client';

import React from 'react';

interface Entity {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  description?: string;
  metadata: any;
  tags?: any[];
  location?: any;
  confidence: number;
  source: string;
  timestamp: string;
}

interface EntityDisplayProps {
  entities: Entity[];
  title?: string;
}

export function EntityDisplay({ entities, title = "Discovered Entities" }: EntityDisplayProps) {
  if (!entities || entities.length === 0) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title} ({entities.length})</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entities.map((entity) => (
          <div key={entity.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            {/* Entity Image */}
            {entity.metadata?.imageUrl && (
              <div className="mb-3 flex justify-center">
                <div className="w-full h-32 flex items-center justify-center bg-gray-50 rounded-lg overflow-hidden">
                  <img
                    src={entity.metadata.imageUrl}
                    alt={entity.name}
                    className="max-w-full max-h-full object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}
            
            {/* Entity Info */}
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">{entity.name}</h4>
              
              {entity.description && (
                <p className="text-sm text-gray-600 line-clamp-2">{entity.description}</p>
              )}
              
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span className="bg-gray-100 px-2 py-1 rounded">{entity.type}</span>
                <span>{Math.round(entity.confidence * 100)}%</span>
              </div>
              
              {/* Tags */}
              {entity.tags && entity.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {entity.tags.slice(0, 3).map((tag: any, index: number) => (
                    <span
                      key={index}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                    >
                      {tag.name || tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Location */}
              {entity.location && (
                <div className="text-xs text-gray-500">
                  📍 {entity.location.city || entity.location.country || 'Location'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {/* Raw Data Toggle */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
          Show Raw Response Data
        </summary>
        <div className="mt-2 p-3 bg-gray-50 rounded text-xs font-mono overflow-x-auto">
          <pre>{JSON.stringify(entities, null, 2)}</pre>
        </div>
      </details>
    </div>
  );
} 