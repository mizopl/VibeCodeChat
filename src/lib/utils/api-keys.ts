// Utility to get API keys from localStorage (client-side only)
export function getApiKeys() {
  if (typeof window === 'undefined') {
    return { googleApiKey: '', qlooApiKey: '' };
  }

  return {
    googleApiKey: localStorage.getItem('google_api_key') || '',
    qlooApiKey: localStorage.getItem('qloo_api_key') || '',
  };
}

// Utility to set API keys in localStorage
export function setApiKeys(googleApiKey: string, qlooApiKey: string) {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem('google_api_key', googleApiKey);
  localStorage.setItem('qloo_api_key', qlooApiKey);
}

// Utility to clear API keys from localStorage
export function clearApiKeys() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('google_api_key');
  localStorage.removeItem('qloo_api_key');
} 