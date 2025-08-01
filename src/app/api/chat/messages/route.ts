import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '../../../../lib/database/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId parameter' },
        { status: 400 }
      );
    }

    console.log(`🔍 Get Messages API: Fetching messages for session ${sessionId}`);

    // Get messages for the session
    const messages = await databaseService.getMessages(sessionId);

    return NextResponse.json({
      success: true,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    });

  } catch (error) {
    console.error('❌ Get messages error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 