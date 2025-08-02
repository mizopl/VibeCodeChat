import { getApiKeys } from './api-keys';

// Get Google API key for AI operations, prioritizing localStorage
export function getGoogleApiKeyForAI(): string {
  const apiKeys = getApiKeys();
  return apiKeys.googleApiKey || process.env.GOOGLE_API_KEY || '';
}

// Check if Google API key is available for AI operations
export function hasGoogleApiKeyForAI(): boolean {
  return !!getGoogleApiKeyForAI();
}

// Set Google API key for AI SDK (this needs to be called before using Google AI)
export function configureGoogleAI() {
  const apiKey = getGoogleApiKeyForAI();
  if (!apiKey) {
    throw new Error('Google API key is required for AI operations. Please set it in the API Keys modal.');
  }
  
  // Set the environment variable for the AI SDK
  process.env.GOOGLE_GENERATIVE_AI_API_KEY = apiKey;
  return apiKey;
} 