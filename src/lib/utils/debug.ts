// Debug utility for broadcasting messages to the debug panel
export interface DebugMessage {
  type: 'info' | 'error' | 'warning' | 'success' | 'api' | 'token' | 'agent-step' | 'agent-complete' | 'api-response' | 'chat-complete' | 'chat-error' | 'user-input' | 'component-mount' | 'sessions-fetched' | 'new-chat-created' | 'session-loaded' | 'session-deleted';
  message: string;
  data?: any;
  duration?: number;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost?: number;
}

// Broadcast debug message to the debug panel
export function broadcastDebugMessage(
  type: DebugMessage['type'],
  data?: any,
  duration?: number
) {
  // Only dispatch events in browser environment
  if (typeof window !== 'undefined') {
    const debugEvent = new CustomEvent('debug-message', {
      detail: {
        type,
        message: type,
        data,
        duration,
        timestamp: new Date().toISOString(),
      },
    });

    window.dispatchEvent(debugEvent);
  }
}

// Track token usage
export function trackTokenUsage(usage: TokenUsage) {
  // Calculate cost (approximate for Gemini 2.5 Flash)
  const costPer1KTokens = 0.00015; // $0.00015 per 1K tokens
  const cost = (usage.totalTokens / 1000) * costPer1KTokens;

  broadcastDebugMessage('token', {
    ...usage,
    cost,
  });
}

// API call tracking
export function trackApiCall(
  apiName: string,
  parameters: any,
  duration: number,
  success: boolean,
  error?: string
) {
  broadcastDebugMessage(
    success ? 'api' : 'error',
    {
      apiName,
      parameters,
      duration,
      success,
      error,
    },
    duration
  );
}

// Agent activity tracking
export function trackAgentActivity(
  agentName: string,
  action: string,
  data?: any,
  duration?: number
) {
  broadcastDebugMessage(
    'info',
    data,
    duration
  );
}

// Error tracking
export function trackError(error: Error, context?: any) {
  broadcastDebugMessage('error', {
    stack: error.stack,
    context,
  });
}

// Success tracking
export function trackSuccess(message: string, data?: any, duration?: number) {
  broadcastDebugMessage('success', data, duration);
}

// Warning tracking
export function trackWarning(message: string, data?: any) {
  broadcastDebugMessage('warning', data);
}

// Initialize debug system
export function initializeDebug() {
  if (typeof window !== 'undefined') {
    // Log that debug system is initialized
    broadcastDebugMessage('info', 'Debug system initialized');
    
    // Track page load
    broadcastDebugMessage('info', 'Page loaded', {
      url: window.location.href,
      userAgent: navigator.userAgent,
    });
  }
} 