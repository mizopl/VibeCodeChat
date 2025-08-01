import { NextRequest, NextResponse } from 'next/server';
import { ChatHistoryAgent } from '@/lib/agents/chat-history-agent';
import { getDatabaseService } from '@/lib/database/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, sessionId, entityName, entityType } = body;

    if (!query || !sessionId) {
      return NextResponse.json({ 
        error: 'Missing required parameters: query and sessionId' 
      }, { status: 400 });
    }

    console.log('🔍 Chat history query:', { query, sessionId, entityName, entityType });

    // Verify session exists
    const databaseService = getDatabaseService();
    const session = await databaseService.getChatSession(sessionId);
    if (!session) {
      return NextResponse.json({ 
        error: 'Session not found' 
      }, { status: 404 });
    }

    // Search chat history
    const chatHistoryAgent = new ChatHistoryAgent(sessionId);
    const result = await chatHistoryAgent.searchChatHistory({
      query,
      sessionId,
      entityName,
      entityType,
      includeMessages: true,
      includeEntities: true
    });

    return NextResponse.json({
      success: true,
      result,
      sessionId
    });

  } catch (error) {
    console.error('❌ Chat history API error:', error);
    return NextResponse.json({ 
      error: 'Chat history search failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 