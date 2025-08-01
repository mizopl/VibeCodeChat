// Configuration for QLOO AGENT system
export const config = {
  // API Keys
  googleApiKey: process.env.GOOGLE_API_KEY || '',
  qlooApiKey: process.env.QLOO_API_KEY || '',
  
  // URLs
  qlooApiUrl: 'https://hackathon.api.qloo.com',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  kvUrl: process.env.KV_URL || '',
  
  // Features
  debugMode: process.env.DEBUG_MODE === 'true',
  trackTokens: process.env.TRACK_TOKENS === 'true',
  
  // API Limits
  maxTokens: 4000,
  timeoutMs: 10000, // 10 seconds
  
  // Entity Types supported by Qloo
  entityTypes: [
    'urn:entity:place',
    'urn:entity:brand', 
    'urn:entity:artist',
    'urn:entity:movie',
    'urn:entity:book',
    'urn:entity:videogame',
    'urn:entity:podcast',
    'urn:entity:tvshow',
    'urn:entity:destination',
    'urn:entity:person'
  ] as const,
  
  // Default parameters
  defaultLimit: 3,
  defaultEntityType: 'urn:entity:place' as const,
} as const;

// Type exports
export type EntityType = typeof config.entityTypes[number];
export type DefaultEntityType = typeof config.defaultEntityType;

// Validation
export function validateConfig() {
  const errors: string[] = [];
  
  if (!config.googleApiKey) {
    errors.push('GOOGLE_API_KEY is required');
  }
  
  if (!config.qlooApiKey) {
    errors.push('QLOO_API_KEY is required');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration errors: ${errors.join(', ')}`);
  }
} 