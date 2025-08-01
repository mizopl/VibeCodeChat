import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database/database';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    
    if (!sessionId) {
      return NextResponse.json({
        success: false,
        error: 'Session ID is required',
      }, { status: 400 });
    }

    // Get session messages
    const messages = await databaseService.getMessages(sessionId);
    
    if (!messages || messages.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No messages found for this session',
      }, { status: 404 });
    }

    // Convert to chat format
    const chatMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
      usage: msg.usage,
      metadata: msg.metadata,
    }));

    return NextResponse.json({
      success: true,
      data: {
        sessionId,
        messages: chatMessages,
        messageCount: chatMessages.length,
      },
    });

  } catch (error) {
    console.error('❌ Session messages retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 