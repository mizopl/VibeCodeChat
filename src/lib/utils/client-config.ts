import { getApiKeys } from './api-keys';

// Client-side configuration that can use localStorage API keys
export function getClientConfig() {
  const apiKeys = getApiKeys();
  
  return {
    googleApiKey: apiKeys.googleApiKey || process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
    qlooApiKey: apiKeys.qlooApiKey || process.env.NEXT_PUBLIC_QLOO_API_KEY || '',
  };
}

// Function to check if API keys are available
export function hasApiKeys() {
  const config = getClientConfig();
  return !!(config.googleApiKey || config.qlooApiKey);
}

// Function to get Google API key for client-side use
export function getGoogleApiKey() {
  const config = getClientConfig();
  return config.googleApiKey;
}

// Function to get Qloo API key for client-side use
export function getQlooApiKey() {
  const config = getClientConfig();
  return config.qlooApiKey;
} 