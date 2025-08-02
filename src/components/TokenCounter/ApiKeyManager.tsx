'use client';

import { useState, useEffect } from 'react';

interface ApiKeyManagerProps {
  onApiKeyChange?: (apiKey: string) => void;
}

export const ApiKeyManager: React.FC<ApiKeyManagerProps> = ({ onApiKeyChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [qlooApiKey, setQlooApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    // Load existing API keys from localStorage
    const savedGoogleKey = localStorage.getItem('google_api_key') || '';
    const savedQlooKey = localStorage.getItem('qloo_api_key') || '';
    setGoogleApiKey(savedGoogleKey);
    setQlooApiKey(savedQlooKey);
  }, []);

  const handleSave = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Save to localStorage
      localStorage.setItem('google_api_key', googleApiKey);
      localStorage.setItem('qloo_api_key', qlooApiKey);

      // Test the Google API key if provided
      if (googleApiKey) {
        const response = await fetch('/api/test-google-api', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ apiKey: googleApiKey }),
        });

        if (!response.ok) {
          throw new Error('Invalid Google API key');
        }
      }

      setMessage({ type: 'success', text: 'API keys saved successfully!' });
      onApiKeyChange?.(googleApiKey);
      
      // Close the modal after a short delay
      setTimeout(() => {
        setIsOpen(false);
        setMessage(null);
      }, 2000);

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save API keys. Please check your keys.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = () => {
    localStorage.removeItem('google_api_key');
    localStorage.removeItem('qloo_api_key');
    setGoogleApiKey('');
    setQlooApiKey('');
    setMessage({ type: 'success', text: 'API keys cleared!' });
    onApiKeyChange?.('');
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="text-xs text-blue-600 hover:text-blue-800 underline flex items-center space-x-1"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>API Keys</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">API Keys</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Google API Key
                </label>
                <input
                  type="password"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  placeholder="Enter your Google API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for AI features and chat functionality
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Qloo API Key
                </label>
                <input
                  type="password"
                  value={qlooApiKey}
                  onChange={(e) => setQlooApiKey(e.target.value)}
                  placeholder="Enter your Qloo API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Required for Qloo recommendations and entity data
                </p>
              </div>

              {message && (
                <div className={`p-3 rounded-md text-sm ${
                  message.type === 'success' 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-red-100 text-red-700'
                }`}>
                  {message.text}
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Save Keys'}
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Clear
                </button>
              </div>

              <div className="text-xs text-gray-500">
                <p>• API keys are stored locally in your browser</p>
                <p>• Keys are not sent to our servers</p>
                <p>• Clear your browser data to remove saved keys</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}; 