import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseService } from '@/lib/database/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');
    const limit = parseInt(searchParams.get('limit') || '10');
    const source = searchParams.get('source'); // 'insights-api', 'entity-search', etc.

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Get API calls for the session
    const databaseService = getDatabaseService();
  const apiCalls = await databaseService.getApiCalls(sessionId, limit);
    
    // Filter by source if specified
    const filteredCalls = source 
      ? apiCalls.filter(call => call.endpoint.includes(source))
      : apiCalls;

    // Get entities for the session
    const entities = await databaseService.getSessionEntities(sessionId);

    return NextResponse.json({
      success: true,
      data: {
        apiCalls: filteredCalls,
        entities: entities,
        totalApiCalls: filteredCalls.length,
        totalEntities: entities.length
      }
    });

  } catch (error) {
    console.error('❌ Error retrieving Qloo responses:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve Qloo responses' },
      { status: 500 }
    );
  }
} 