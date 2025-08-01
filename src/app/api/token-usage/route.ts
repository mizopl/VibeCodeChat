import { NextRequest, NextResponse } from 'next/server';
import { tokenTracker } from '@/lib/utils/token-tracker';

// Simple in-memory cache for token usage
let cachedUsage: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 30000; // 30 seconds

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Return cached data if available and fresh
    if (cachedUsage && (now - lastCacheTime) < CACHE_DURATION) {
      return NextResponse.json(cachedUsage);
    }
    
    // Get fresh data
    const usage = tokenTracker.getCurrentUsage();
    
    // Update cache
    cachedUsage = usage;
    lastCacheTime = now;
    
    return NextResponse.json(usage);
  } catch (error) {
    console.error('Token usage API error:', error);
    
    // Return cached data if available, even if stale
    if (cachedUsage) {
      return NextResponse.json(cachedUsage);
    }
    
    // Fallback response - token tracking failed
    console.log('⚠️ Token usage API: Using fallback response - token tracking failed');
    return NextResponse.json({
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      totalTokens: 0,
      sessionTokens: 0,
      lastUpdated: new Date().toISOString(),
      costEstimate: 0,
      error: 'Token tracking unavailable - using fallback data'
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, promptTokens, completionTokens } = body;
    
    await tokenTracker.updateSessionUsage(sessionId, promptTokens, completionTokens);
    
    // Invalidate cache when usage is updated
    cachedUsage = null;
    lastCacheTime = 0;
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Token usage update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update token usage' }, { status: 500 });
  }
} 