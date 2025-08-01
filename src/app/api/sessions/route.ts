import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '../../../lib/database/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get sessions with entity counts
    const sessions = await databaseService.getSessionsWithEntityCounts();
    
    // Apply pagination
    const paginatedSessions = sessions.slice(offset, offset + limit);
    
    return NextResponse.json({
      success: true,
      data: {
        sessions: paginatedSessions,
        pagination: {
          total: sessions.length,
          limit,
          offset,
          hasMore: offset + limit < sessions.length,
        },
      },
    });

  } catch (error) {
    console.error('❌ Sessions retrieval error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { personaId, debugMode = false, personaData } = body;

    // Create new session
    const session = await databaseService.createChatSession(personaId, debugMode);

    // If persona data is provided, create a persona with interests
    if (personaData) {
      console.log('🎯 Creating persona with data:', personaData);
      
      try {
        // Create persona with demographics
        const demographics = {
          age: parseInt(personaData.age),
          bio: personaData.bio,
          interests: [] // Will be populated from bio analysis
        };
        
        const persona = await databaseService.createPersona(
          session.id,
          demographics,
          personaData.name,
          personaData.city,
          undefined // gender will be inferred
        );
        
        // Create initial persona message and process it through chat
        if (personaData.bio) {
          try {
            // Create a comprehensive initial message with persona data
            const initialMessage = `Hi, I'm ${personaData.name}, I'm ${personaData.age} years old and I live in ${personaData.city}. ${personaData.bio}`;
            
            console.log('🎯 Processing persona data through chat:', initialMessage);
            
            // Add the initial message to the database
            await databaseService.addMessage(session.id, 'user', initialMessage);
            
            // Process the persona data directly to extract interests
            console.log('🎯 Processing persona data directly...');
            
            try {
              // Use the persona manager to extract interests from the initial message
              const { PersonaManager } = await import('../../../lib/agents/persona-manager');
              const personaManager = new PersonaManager();
              personaManager.setSessionId(session.id);
              
              // Extract interests from the conversation with timeout
              const extractedInterests = await Promise.race([
                personaManager.extractInterestsFromConversation([
                  { role: 'user', content: initialMessage }
                ]),
                new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('Interest extraction timeout')), 30000)
                )
              ]);
              
              console.log('🎯 Extracted interests from persona data:', extractedInterests.length);
              
              // Store each interest
              for (const interest of extractedInterests) {
                await databaseService.addPersonalInterest(session.id, {
                  category: interest.category,
                  name: interest.name,
                  confidence: interest.confidence || 0.8,
                  source: 'persona-creation',
                  metadata: { extractedFrom: 'persona-data' }
                });
                console.log(`✅ Stored interest: ${interest.name} (${interest.category})`);
              }
              
              // Update persona confidence based on extracted interests
              const confidence = Math.min(0.9, 0.5 + (extractedInterests.length * 0.1));
              await databaseService.updatePersonaConfidence(session.id, confidence);
              
              console.log(`✅ Persona confidence updated to: ${confidence}`);
            } catch (error) {
              console.error('❌ Error processing persona data:', error);
              // Continue with persona creation even if interest extraction fails
            }
            
            console.log('✅ Persona data processed through chat successfully');
            
          } catch (error) {
            console.error('⚠️ Error processing persona data through chat:', error);
          }
        }
        
        console.log('✅ Persona created successfully');
      } catch (error) {
        console.error('❌ Error creating persona:', error);
        // Continue with session creation even if persona creation fails
      }
    }

    return NextResponse.json({
      success: true,
      data: session,
    });

  } catch (error) {
    console.error('❌ Session creation error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 