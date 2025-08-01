import { NextRequest, NextResponse } from 'next/server';
import { SmartPersonaAgent } from '../../../../lib/agents/smart-persona-agent';
import { getDatabaseService } from '../../../../lib/database/database';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, messages } = await request.json();

    if (!sessionId || !messages) {
      return NextResponse.json(
        { success: false, error: 'Missing sessionId or messages' },
        { status: 400 }
      );
    }

    console.log(`🔍 Persona Update API: Processing ${messages.length} messages for session ${sessionId}`);

    // Create Smart Persona Agent
    const smartPersonaAgent = new SmartPersonaAgent(sessionId);

    // Process messages and update persona
    await smartPersonaAgent.processChatMessages(messages);

    // Get updated persona data
    const persona = await databaseService.getPersona(sessionId);
    const interests = await databaseService.getPersonalInterests(sessionId);
    const audiences = await databaseService.getAudienceCharacteristics(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Persona updated successfully',
      data: {
        persona,
        interests,
        audiences
      }
    });

  } catch (error) {
    console.error('❌ Persona update error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 