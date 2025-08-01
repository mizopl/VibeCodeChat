import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database/database';

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

    const databaseService = getDatabaseService();
    const session = await databaseService.getSessionWithDetails(sessionId);
    
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'Session not found',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        session,
        messageCount: session.messages.length,
        apiCallCount: session.apiCalls.length,
        tokenUsageCount: session.tokenUsage.length,
        extractionCount: session.structuredExtractions.length,
      },
    });

  } catch (error) {
    console.error('❌ Session retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function DELETE(
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

    const databaseService = getDatabaseService();
    await databaseService.deleteChatSession(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session deleted successfully',
    });

  } catch (error) {
    console.error('❌ Session deletion error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 