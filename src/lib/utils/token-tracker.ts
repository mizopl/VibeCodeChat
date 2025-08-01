import { config } from '../config';
import { getDatabaseService } from '../database/database';

export interface TokenUsage {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  sessionTokens: number;
  lastUpdated: string;
  costEstimate: number;
}

export interface SessionTokenUsage {
  sessionId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  timestamp: string;
}

class TokenTracker {
  private static instance: TokenTracker;
  private currentUsage: TokenUsage;
  private sessionUsage: Map<string, SessionTokenUsage>;
  private lastDatabaseLoad: number = 0;
  private cacheTimeout: number = 60000; // 1 minute cache

  private constructor() {
    this.currentUsage = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      sessionTokens: 0,
      lastUpdated: new Date().toISOString(),
      costEstimate: 0
    };
    this.sessionUsage = new Map();
    this.loadFromStorage();
  }

  public static getInstance(): TokenTracker {
    if (!TokenTracker.instance) {
      TokenTracker.instance = new TokenTracker();
    }
    return TokenTracker.instance;
  }

  // Update token usage for a session
  public async updateSessionUsage(
    sessionId: string,
    promptTokens: number,
    completionTokens: number
  ): Promise<void> {
    const totalTokens = promptTokens + completionTokens;
    
    // Update session usage
    this.sessionUsage.set(sessionId, {
      sessionId,
      promptTokens,
      completionTokens,
      totalTokens,
      timestamp: new Date().toISOString()
    });

    // Update global usage
    this.currentUsage.totalPromptTokens += promptTokens;
    this.currentUsage.totalCompletionTokens += completionTokens;
    this.currentUsage.totalTokens += totalTokens;
    this.currentUsage.sessionTokens += totalTokens;
    this.currentUsage.lastUpdated = new Date().toISOString();
    
    // Calculate cost estimate (rough approximation)
    // Gemini 2.5 Flash pricing: $0.000075 / 1K input tokens, $0.0003 / 1K output tokens
    const inputCost = (this.currentUsage.totalPromptTokens / 1000) * 0.000075;
    const outputCost = (this.currentUsage.totalCompletionTokens / 1000) * 0.0003;
    this.currentUsage.costEstimate = inputCost + outputCost;

    // Save to database (but don't wait for it to complete)
    this.saveToStorage().catch(error => {
      console.error('❌ Failed to save token usage:', error);
    });
    
    // Log for debugging
    console.log('💰 Token usage updated:', {
      sessionId,
      promptTokens,
      completionTokens,
      totalTokens,
      globalTotal: this.currentUsage.totalTokens,
      costEstimate: this.currentUsage.costEstimate
    });
  }

  // Get current token usage (cached)
  public getCurrentUsage(): TokenUsage {
    // Only reload from database if cache is expired
    const now = Date.now();
    if (now - this.lastDatabaseLoad > this.cacheTimeout) {
      this.loadFromStorage().catch(error => {
        console.error('❌ Failed to reload token usage:', error);
      });
    }
    
    return { ...this.currentUsage };
  }

  // Get session token usage
  public getSessionUsage(sessionId: string): SessionTokenUsage | undefined {
    return this.sessionUsage.get(sessionId);
  }

  // Get all session usage
  public getAllSessionUsage(): SessionTokenUsage[] {
    return Array.from(this.sessionUsage.values());
  }

  // Reset session usage
  public resetSessionUsage(sessionId: string): void {
    this.sessionUsage.delete(sessionId);
  }

  // Reset all usage
  public async resetAllUsage(): Promise<void> {
    this.currentUsage = {
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      sessionTokens: 0,
      lastUpdated: new Date().toISOString(),
      costEstimate: 0
    };
    this.sessionUsage.clear();
    await this.saveToStorage();
  }

  // Load from storage (with caching)
  private async loadFromStorage(): Promise<void> {
    try {
      const now = Date.now();
      if (now - this.lastDatabaseLoad < this.cacheTimeout) {
        // Use cached data if within timeout
        return;
      }
      
      const databaseService = getDatabaseService();
      const stored = await databaseService.getGlobalTokenUsage();
      if (stored) {
        this.currentUsage = {
          totalPromptTokens: stored.totalPromptTokens,
          totalCompletionTokens: stored.totalCompletionTokens,
          totalTokens: stored.totalTokens,
          sessionTokens: stored.sessionTokens,
          lastUpdated: stored.lastUpdated.toISOString(),
          costEstimate: stored.costEstimate
        };
        this.lastDatabaseLoad = now;
        console.log('📊 Token usage loaded from database');
      }
    } catch (error) {
      console.log('📊 No stored token usage found or error loading, using cached data');
    }
  }

  // Save to storage (non-blocking)
  private async saveToStorage(): Promise<void> {
    try {
      const databaseService = getDatabaseService();
      await databaseService.saveTokenUsage(this.currentUsage);
      console.log('✅ Global token usage saved to database');
    } catch (error) {
      console.error('❌ Failed to save token usage:', error);
    }
  }

  // Format token usage for display
  public formatUsage(): string {
    const usage = this.getCurrentUsage();
    return `Tokens: ${usage.totalTokens.toLocaleString()} | Cost: $${usage.costEstimate.toFixed(4)}`;
  }

  // Get detailed usage for debug panel
  public getDetailedUsage(): {
    current: TokenUsage;
    sessions: SessionTokenUsage[];
    summary: string;
  } {
    return {
      current: this.getCurrentUsage(),
      sessions: this.getAllSessionUsage(),
      summary: this.formatUsage()
    };
  }
}

export const tokenTracker = TokenTracker.getInstance(); 