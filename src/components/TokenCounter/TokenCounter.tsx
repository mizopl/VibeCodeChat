'use client';

import { useState, useEffect } from 'react';

interface TokenUsage {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  costEstimate: number;
  lastUpdated: string;
}

export const TokenCounter: React.FC = () => {
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenUsage = async () => {
    try {
      const response = await fetch('/api/token-usage');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setUsage(data);
      setError(null);
    } catch (error) {
      console.error('Failed to fetch token usage:', error);
      setError('Failed to load usage data');
    }
  };

  useEffect(() => {
    // Only fetch once on component mount - no polling
    fetchTokenUsage().finally(() => setIsLoading(false));
  }, []);

  const handleRefresh = () => {
    setIsLoading(true);
    fetchTokenUsage().finally(() => setIsLoading(false));
  };

  const formatNumber = (num: number | undefined | null): string => {
    if (num === undefined || num === null) {
      return '0';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatCost = (cost: number | undefined | null): string => {
    if (cost === undefined || cost === null) {
      return '$0.000000';
    }
    return `$${cost.toFixed(6)}`;
  };

  if (isLoading) {
    return (
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-slate-300 rounded-full animate-pulse"></div>
                <span className="text-sm text-slate-600 font-medium">Loading usage...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!usage && error) {
    return (
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                <span className="text-sm text-red-600 font-medium">{error}</span>
                <button 
                  onClick={handleRefresh}
                  className="text-xs text-blue-600 hover:text-blue-800 underline"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!usage) {
    return (
      <div 
        className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 transition-opacity duration-300"
        style={{ opacity: isHovered ? 1 : 0.3 }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-2">
                <div className="w-3 h-3 bg-slate-400 rounded-full"></div>
                <span className="text-sm text-slate-600 font-medium">No usage data</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 transition-opacity duration-300"
      style={{ opacity: isHovered ? 1 : 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-sm text-slate-600 font-medium">Tokens:</span>
            </div>
            <div className="flex items-center space-x-4 text-sm">
              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Total:</span>
                <span className="font-mono font-medium text-slate-700">{formatNumber(usage.totalTokens)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Prompt:</span>
                <span className="font-mono font-medium text-slate-700">{formatNumber(usage.promptTokens)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Completion:</span>
                <span className="font-mono font-medium text-slate-700">{formatNumber(usage.completionTokens)}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-slate-500">Cost:</span>
                <span className="font-mono font-medium text-slate-700">{formatCost(usage.costEstimate)}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="text-xs text-slate-400">
              Last updated: {new Date(usage.lastUpdated).toLocaleTimeString()}
            </div>
            <button 
              onClick={handleRefresh}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 