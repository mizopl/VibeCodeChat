import { EntityType } from '@/lib/config';

// QLOO AGENT Parameter Interface
export interface QlooParameters {
  // Core parameters
  query: string;           // Main search query
  entityType?: EntityType; // urn:entity:place, urn:entity:brand, etc.
  reason?: string;         // Why the user wants recommendations
  
  // Location parameters
  location?: {
    city?: string;
    country?: string;
  };
  
  // Filter parameters
  filterTags?: string[];   // Specific tags to filter by
  excludeTags?: string[];  // Tags to exclude
  
  // API selection
  targetAPI: 'GETINSIGHTS' | 'GETENTITY' | 'GETTAGS';
  
  // Additional parameters
  limit?: number;          // Number of results
  explainability?: boolean; // Whether to include explanations
  
  // Signal tags for enhanced recommendations
  signalTags?: string[];   // Tags for signal.interests.tags
  
  // Signal entities for Insights API
  signalEntities?: string[]; // Entity IDs for signal.interests.entities
  
  // Token saving parameters
  parsingLevel?: 'full' | 'summary' | 'tiny' | 'minimal'; // Response parsing level
}

// Qloo API Response Types
export interface QlooEntity {
  id: string;
  name: string;
  type: string;
  subtype?: string;
  description?: string;
  score?: number;
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

export interface QlooTag {
  id: string;
  name: string;
  type: string;
  parentId?: string;
  description?: string;
  relevanceScore?: number;
}

export interface QlooInsightsResponse {
  results: {
    entities: QlooEntity[];
    explanations?: Record<string, any>;
  };
  metadata?: {
    totalCount?: number;
    processingTime?: number;
  };
}

export interface QlooEntityResponse {
  results: QlooEntity[];
  metadata?: {
    totalCount?: number;
    processingTime?: number;
  };
}

export interface QlooTagsResponse {
  results: QlooTag[];
  metadata?: {
    totalCount?: number;
    processingTime?: number;
  };
}

// Agent Response Types
export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  parameters?: QlooParameters;
  apiUsed?: string;
  processingTime?: number;
}

// Debug and Logging Types
export interface DebugMessage {
  type: 'info' | 'error' | 'warning' | 'success';
  message: string;
  data?: any;
  timestamp: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: string;
  agent: string;
}

// Chat Message Types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: {
    parameters?: QlooParameters;
    apiResponse?: any;
    tokenUsage?: TokenUsage;
  };
}

// Agent Types
export interface AgentContext {
  sessionId?: string;
  persona?: {
    id: string;
    demographics?: {
      age?: number;
      gender?: string;
      location?: {
        city?: string;
        country?: string;
      };
    };
    interests?: string[];
    preferences?: Record<string, any>;
  };
  conversationHistory?: ChatMessage[];
  debugMode?: boolean;
  lastResponseMetadata?: {
    parameters?: QlooParameters;
    entities?: Array<{
      id: string;
      name: string;
      type: string;
      qlooId?: string;
      description?: string;
      metadata?: Record<string, any>;
      confidence?: number;
    }>;
    recommendations?: Array<{
      id: string;
      name: string;
      type: string;
      description?: string;
      confidence?: number;
      metadata?: Record<string, any>;
    }>;
    personaData?: any;
    intent?: string;
    source?: string;
    entityCount?: number;
  };
  isNewSession?: boolean;
}

// Tool Types
export interface QlooTool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

// Error Types
export class QlooAgentError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message);
    this.name = 'QlooAgentError';
  }
}

// Utility Types
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    processingTime?: number;
    tokenUsage?: TokenUsage;
    parsingLevel?: 'full' | 'summary' | 'tiny' | 'minimal';
  };
};

// Parameter Extraction Result
export interface ParameterExtractionResult {
  parameters: QlooParameters;
  confidence: number;
  reasoning: string;
  extractedFields: string[];
} 