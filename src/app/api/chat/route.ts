import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { MainAgent } from '@/lib/agents/main-agent';
import { validateConfig } from '@/lib/config';
import { getDatabaseService } from '@/lib/database/database';
import { broadcastDebugMessage, trackTokenUsage } from '@/lib/utils/debug';
import { z } from 'zod';
import { AgentContext, ChatMessage } from '@/types';
import { config } from '@/lib/config';

const ChatRequestSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string()
  })),
  sessionId: z.string().optional()
});

export async function POST(request: NextRequest) {
  console.log('🚀 POST /api/chat - Starting request processing');
  
  try {
    // Validate configuration
    validateConfig();
    console.log('✅ Configuration validation passed');

    // Parse request
    const body = await request.json();
    const { messages, sessionId: existingSessionId } = ChatRequestSchema.parse(body);
    
    const userMessage = messages[messages.length - 1];
    if (userMessage.role !== 'user') {
      return NextResponse.json({ error: 'Last message must be from user' }, { status: 400 });
    }

    // Session Management: Get existing session or create new one
    let currentSessionId: string;
    let isNewSession = false;
    
    const databaseService = getDatabaseService();
    
    if (existingSessionId) {
      // Check if session exists
      const existingSession = await databaseService.getChatSession(existingSessionId);
      if (existingSession) {
        currentSessionId = existingSessionId;
        console.log('📝 Using existing chat session:', currentSessionId);
      } else {
        // Session doesn't exist, create new one
        const session = await databaseService.createChatSession();
        currentSessionId = session.id;
        isNewSession = true;
        console.log('📝 Created new chat session (invalid sessionId provided):', currentSessionId);
      }
    } else {
      // No session provided, create new one
      const session = await databaseService.createChatSession();
      currentSessionId = session.id;
      isNewSession = true;
      console.log('📝 Created new chat session:', currentSessionId);
    }

    // Add user message to database
    await databaseService.addMessage(currentSessionId, 'user', userMessage.content);

    // Initialize agent context
    const agentContext: AgentContext = {
      sessionId: currentSessionId,
      conversationHistory: messages as ChatMessage[],
      debugMode: true,
      isNewSession: isNewSession
    };

    // Initialize agent
    const agent = new MainAgent(agentContext);
    
    // Update agent context with conversation history
    agent.updateContext({
      conversationHistory: messages as ChatMessage[],
      sessionId: currentSessionId,
      isNewSession: isNewSession
    });
    
    // Track steps for debugging
    const steps: Array<{ step: string; details: Record<string, unknown>; timestamp: string }> = [];
    const onStep = async (step: string, details: Record<string, unknown>) => {
      steps.push({ step, details, timestamp: new Date().toISOString() });
      console.log(`🔧 Step: ${step}`, details);
      
      // Log structured extraction if this is parameter extraction
      if (step === 'parameter-extraction' && details.status === 'completed') {
        try {
          await databaseService.logStructuredExtraction(
            currentSessionId,
            userMessage.content,
            details.parameters,
            details.confidence || 0.8,
            details.reasoning || 'Parameter extraction completed',
            Object.keys(details.parameters || {})
          );
        } catch (error) {
          console.error('Failed to log structured extraction:', error);
        }
      }
      
      // Log API call if this is an API call
      if (step === 'api-call' && details.status === 'completed') {
        try {
          await databaseService.logApiCall(
            currentSessionId,
            details.method,
            details.method,
            details.parameters || {},
            details.response || null,
            200, // Use 200 as default status
            details.duration || 0,
            details.error || null
          );
        } catch (error) {
          console.error('Failed to log API call:', error);
        }
      }
      
      broadcastDebugMessage('agent-step', { step, details });
    };

    // Process query with step-by-step logging and timeout
    console.log('🎯 Starting agent processing with timeout...');
    const response = await Promise.race([
      agent.processQuery(
        userMessage.content,
        currentSessionId,
        onStep,
        messages
      ),
      new Promise<string>((_, reject) => 
        setTimeout(() => reject(new Error('Agent processing timeout after 30 seconds')), 30000)
      )
    ]);
    console.log('✅ Agent processing completed');

    // Get metadata from agent context for visual components
    const responseMetadata = agent.context.lastResponseMetadata;

    // Add assistant message to database with metadata
    await databaseService.addMessage(
      currentSessionId, 
      'assistant', 
      response,
      undefined, // usage will be tracked separately
      responseMetadata
    );

    // Return the response as plain text
    return new Response(response, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('❌ Chat API error:', error);
    
    // Provide informative error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const isTimeout = errorMessage.includes('timeout');
    
    const errorResponse = isTimeout 
      ? '❌ **Request Timeout**: The request took too long to process.\n\n**What happened:**\n• The API call exceeded the 30-second timeout\n• This could be due to slow Qloo API responses or complex processing\n\n**Suggestions:**\n• Try a simpler query\n• Check your internet connection\n• Try again in a few moments'
      : `❌ **System Error**: I encountered a technical problem.\n\n**What failed:**\n• ${errorMessage}\n\n**Suggestions:**\n• Try rephrasing your request\n• Check your internet connection\n• Try again in a few moments`;
    
    return new Response(errorResponse, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

// Streaming chat endpoint
export async function PUT(request: NextRequest) {
  try {
    // Validate configuration
    validateConfig();

    // Parse and validate request
    const body = await request.json();
    const { messages, sessionId: existingSessionId } = ChatRequestSchema.parse(body);

    // Get the latest user message
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || latestMessage.role !== 'user') {
      return NextResponse.json({
        success: false,
        error: 'No user message found',
      }, { status: 400 });
    }

    // Create agent context
    const agentContext: AgentContext = {
      sessionId: existingSessionId,
      conversationHistory: messages as ChatMessage[],
      debugMode: true,
    };

    // Initialize main agent
    const mainAgent = new MainAgent(agentContext);

    // Process query
    const response = await mainAgent.processQuery(
      latestMessage.content,
      existingSessionId
    );

    // Return the response as plain text
    return new Response(response, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('Streaming chat API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
} 