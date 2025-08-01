'use client';

import React, { useState, useEffect } from 'react';

interface PersonaData {
  sessionId: string;
  persona: {
    id: string;
    name?: string;
    location?: string;
    confidence: number;
    demographics?: any;
    createdAt: string;
    updatedAt: string;
  };
  interests: {
    total: number;
    categories: string[];
    averageConfidence: number;
    items: Array<{
      id: string;
      category: string;
      name: string;
      confidence: number;
      source: string;
      entityId?: string;
      timestamp: string;
      metadata?: {
        qlooEntity?: {
          imageUrl?: string;
          description?: string;
        };
        imageUrl?: string;
        description?: string;
      };
    }>;
  };
  audiences: {
    recommendations: Array<{
      type: string;
      id: string;
      name: string;
      confidence: number;
      reasoning: string;
    }>;
    available: any[];
  };
  feedback: {
    analysis: {
      totalFeedback: number;
      averageRating: number;
      positiveFeedback: number;
      negativeFeedback: number;
      topRecommendations: string[];
      improvementAreas: string[];
    };
    trends: {
      recentFeedback: Array<{
        id: string;
        recommendationName: string;
        rating: number;
        feedback: string;
        comment: string;
        timestamp: string;
      }>;
      ratingTrend: number;
      satisfactionScore: number;
    };
    recent: Array<{
      id: string;
      recommendationName: string;
      rating: number;
      feedback: string;
      comment: string;
      timestamp: string;
    }>;
  };
  recommendations: {
    personalized: string[];
    topRated: string[];
    needsImprovement: string[];
  };
}

interface DatabaseData {
  apiCalls: Array<{
    id: string;
    endpoint: string;
    method: string;
    status: number;
    duration: number;
    timestamp: string;
    parameters: any;
    response: any;
  }>;
  entities: Array<{
    id: string;
    qlooId: string;
    name: string;
    type: string;
    description?: string;
    confidence: number;
    source: string;
    timestamp: string;
    metadata: any;
  }>;
  totalApiCalls: number;
  totalEntities: number;
}

interface PersonaSidebarProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function PersonaSidebar({ sessionId, isOpen, onClose }: PersonaSidebarProps) {
  const [personaData, setPersonaData] = useState<PersonaData | null>(null);
  const [databaseData, setDatabaseData] = useState<DatabaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [updatingPersona, setUpdatingPersona] = useState(false);
  const [activeTab, setActiveTab] = useState<'persona' | 'database'>('persona');
  const [showTagDetails, setShowTagDetails] = useState(false);

  const fetchPersonaData = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/persona?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setPersonaData(data.data);
      } else {
        setError('Failed to fetch persona data');
      }
    } catch (err) {
      setError('Failed to fetch persona data');
    } finally {
      setLoading(false);
    }
  };

  const fetchDatabaseData = async () => {
    try {
      const response = await fetch(`/api/qloo-responses?sessionId=${sessionId}`);
      if (response.ok) {
        const data = await response.json();
        setDatabaseData(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch database data:', err);
    }
  };



  const updatePersonaFromChat = async () => {
    try {
      setUpdatingPersona(true);
      
      // Get chat messages for this session
      const messagesResponse = await fetch(`/api/chat/messages?sessionId=${sessionId}`);
      if (!messagesResponse.ok) {
        throw new Error('Failed to fetch messages');
      }
      
      const messagesData = await messagesResponse.json();
      const messages = messagesData.messages || [];

      // Update persona using Smart Persona Agent
      const response = await fetch('/api/persona/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          messages
        })
      });

      if (response.ok) {
        await fetchPersonaData();
        console.log('✅ Persona updated from chat messages');
      } else {
        throw new Error('Failed to update persona');
      }
    } catch (error) {
      console.error('Error updating persona from chat:', error);
    } finally {
      setUpdatingPersona(false);
    }
  };

  useEffect(() => {
    if (isOpen && sessionId) {
      fetchPersonaData();
      fetchDatabaseData();
    }
  }, [isOpen, sessionId]);

  // Listen for persona location updates
  useEffect(() => {
    const handleLocationUpdate = (event: CustomEvent) => {
      if (event.detail.sessionId === sessionId) {
        console.log('🔄 Persona location updated, refreshing data...');
        fetchPersonaData();
      }
    };

    window.addEventListener('persona-location-updated', handleLocationUpdate as EventListener);
    
    return () => {
      window.removeEventListener('persona-location-updated', handleLocationUpdate as EventListener);
    };
  }, [sessionId]);

  if (!isOpen) return null;

  if (loading) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 shadow-lg overflow-y-auto">
        <div className="p-6">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded mb-4"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-96 bg-white border-l border-gray-200 shadow-lg overflow-y-auto">
        <div className="p-6">
          <div className="text-red-600">Error: {error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-96 bg-white border-l border-gray-200 shadow-lg overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {personaData?.persona.name ? personaData.persona.name.charAt(0).toUpperCase() : 'P'}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {personaData?.persona.name || 'Persona'}
              </h2>
              {personaData?.persona.gender && (
                <p className="text-xs text-gray-700">
                  {personaData.persona.gender === 'male' ? '👨' : personaData.persona.gender === 'female' ? '👩' : '👤'} {personaData.persona.gender}
                </p>
              )}
              <p className="text-xs text-gray-600">Session: {sessionId.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex mt-3 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('persona')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'persona'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {personaData?.persona.name || 'Persona'}
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === 'database'
                ? 'text-gray-900 border-b-2 border-gray-900'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            Database ({databaseData?.totalEntities || 0} entities, {databaseData?.totalApiCalls || 0} calls)
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {activeTab === 'persona' ? (
          <>
            {/* User Info */}
            {personaData?.persona.name && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900 text-sm">👤 {personaData.persona.name}</h3>
                  <button
                    onClick={fetchPersonaData}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    🔄 Refresh
                  </button>
                </div>
                {personaData.persona.location && (
                  <p className="text-xs text-gray-700">📍 {personaData.persona.location}</p>
                )}
                {personaData.persona.demographics?.age && (
                  <p className="text-xs text-gray-700">🎂 {personaData.persona.demographics.age} years old</p>
                )}
                <div className="mt-2">
                  <div className="text-xs text-gray-600">Confidence</div>
                  <div className="w-full bg-gray-200 rounded-full h-1 mt-1">
                    <div
                      className="bg-gray-800 h-1 rounded-full"
                      style={{ width: `${personaData.persona.confidence * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Smart Persona Update */}
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
              <h3 className="font-medium text-gray-900 mb-2 text-sm">🤖 Smart Persona Agent</h3>
              <p className="text-xs text-gray-700 mb-3">
                Extract persona data from chat messages and resolve interests to QLOO entities
              </p>
              <button
                onClick={updatePersonaFromChat}
                disabled={updatingPersona}
                className="w-full px-3 py-2 bg-blue-600 text-white rounded text-xs hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updatingPersona ? '🔄 Updating...' : '🔍 Update from Chat'}
              </button>
            </div>

            {/* Interests */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-gray-900 text-sm">Interests ({personaData?.interests.total || 0})</h3>
                <button
                  onClick={() => setShowTagDetails(!showTagDetails)}
                  className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded text-gray-600"
                >
                  {showTagDetails ? '🔽 Hide' : '🔼 Show'} Tag Details
                </button>
              </div>
              <div className="space-y-2">
                {personaData?.interests.items.map((interest) => (
                  <div key={interest.id} className="p-2 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {/* QLOO Entity Image */}
                        {(interest.metadata?.imageUrl || interest.metadata?.qlooEntity?.imageUrl) && (
                          <img 
                            src={interest.metadata?.imageUrl || interest.metadata?.qlooEntity?.imageUrl}
                            alt={interest.name}
                            className="w-8 h-8 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div>
                          <div className="font-medium text-xs">{interest.name}</div>
                          <div className="text-xs text-gray-600">{interest.category}</div>
                          {interest.entityId && (
                            <div className="text-xs text-blue-600">✓ QLOO Entity</div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-xs text-gray-500">
                          {Math.round(interest.confidence * 100)}%
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              const response = await fetch(`/api/persona/${sessionId}/interests/${interest.id}`, {
                                method: 'DELETE'
                              });
                              if (response.ok) {
                                fetchPersonaData();
                              }
                            } catch (error) {
                              console.error('Failed to delete interest:', error);
                            }
                          }}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    {/* Tag Details (shown when toggle is on) */}
                    {showTagDetails && (
                      <div className="mt-2 pt-2 border-t border-gray-200">
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Interest ID:</span>
                            <span className="font-mono text-gray-800">{interest.id}</span>
                          </div>
                          {interest.entityId && (
                            <div className="flex justify-between">
                              <span className="text-gray-600">QLOO Entity ID:</span>
                              <span className="font-mono text-blue-600">{interest.entityId}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span className="text-gray-600">Category:</span>
                            <span className="font-mono text-gray-800">{interest.category}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Source:</span>
                            <span className="font-mono text-gray-800">{interest.source}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">Timestamp:</span>
                            <span className="font-mono text-gray-800">
                              {new Date(interest.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Entity Results */}
            <div>
              <h3 className="font-medium text-gray-900 mb-3 text-sm">Recent Entities</h3>
              <div className="space-y-2">
                {databaseData?.entities.slice(0, 5).map((entity) => (
                  <div key={entity.id} className="flex items-start space-x-3 p-2 bg-gray-50 rounded-lg">
                    {/* Entity Image */}
                    {entity.metadata?.imageUrl && (
                      <img 
                        src={entity.metadata.imageUrl}
                        alt={entity.name}
                        className="w-8 h-8 rounded object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="text-xs font-medium">{entity.name}</div>
                      <div className="text-xs text-gray-600">{entity.type.replace('urn:entity:', '')}</div>
                      {entity.description && (
                        <div className="text-xs text-gray-700 mt-1 line-clamp-2">{entity.description}</div>
                      )}
                      <div className="flex items-center justify-between mt-1">
                        <div className="text-xs text-gray-500">
                          {Math.round(entity.confidence * 100)}%
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(entity.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!databaseData?.entities || databaseData.entities.length === 0) && (
                  <div className="text-xs text-gray-600 text-center py-4">
                    No entities discovered yet
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Database Viewer */}
            <div className="space-y-4">
              {/* API Calls */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 text-sm">
                  API Calls ({databaseData?.totalApiCalls || 0})
                </h3>
                <div className="space-y-2">
                  {databaseData?.apiCalls.map((apiCall) => (
                    <div key={apiCall.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-xs font-medium text-gray-900">{apiCall.method} {apiCall.endpoint.split('?')[0]}</div>
                        <div className={`text-xs px-2 py-1 rounded ${
                          apiCall.status === 200 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {apiCall.status}
                        </div>
                      </div>
                      <div className="text-xs text-gray-600 mb-1">
                        Duration: {apiCall.duration}ms
                      </div>
                      <div className="text-xs text-gray-600">
                        {new Date(apiCall.timestamp).toLocaleString()}
                      </div>
                      {apiCall.parameters && (
                        <details className="mt-2">
                          <summary className="text-xs text-blue-600 cursor-pointer">View Parameters</summary>
                          <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto text-gray-800">
                            {JSON.stringify(apiCall.parameters, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Entities */}
              <div>
                <h3 className="font-medium text-gray-900 mb-3 text-sm">
                  Discovered Entities ({databaseData?.totalEntities || 0})
                </h3>
                <div className="space-y-2">
                  {databaseData?.entities.map((entity) => (
                    <div key={entity.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-start space-x-3">
                        {/* Entity Image */}
                        {entity.metadata?.imageUrl && (
                          <img 
                            src={entity.metadata.imageUrl}
                            alt={entity.name}
                            className="w-12 h-12 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium text-sm">{entity.name}</div>
                          <div className="text-xs text-gray-600 mb-1">{entity.type || 'unknown'}</div>
                          {entity.description && (
                            <div className="text-xs text-gray-700 mb-2">{entity.description}</div>
                          )}
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-gray-600">
                              Source: {entity.source}
                            </div>
                            <div className="text-xs text-gray-500">
                              {Math.round(entity.confidence * 100)}%
                            </div>
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {new Date(entity.timestamp).toLocaleString()}
                          </div>
                          {entity.metadata && (
                            <details className="mt-2">
                              <summary className="text-xs text-blue-600 cursor-pointer">View Metadata</summary>
                              <pre className="text-xs bg-gray-100 p-2 rounded mt-1 overflow-x-auto max-h-32 overflow-y-auto text-gray-800">
                                {JSON.stringify(entity.metadata, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refresh Button */}
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <button
                  onClick={() => {
                    fetchDatabaseData();
                    fetchPersonaData();
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-none text-sm font-medium hover:bg-red-700 transition-colors duration-200"
                >
                  Refresh
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 