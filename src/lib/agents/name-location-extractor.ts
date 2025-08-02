import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { broadcastDebugMessage } from '../utils/debug';
import { configureGoogleAI } from '../utils/ai-config';

export interface ExtractedNameLocation {
  name?: string;
  location?: string;
  gender?: string;
  confidence: number;
  reasoning: string;
}

export class NameLocationExtractor {
  private sessionId?: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  async extractFromMessage(message: string): Promise<ExtractedNameLocation> {
    try {
      // Configure Google AI with API key from localStorage
      configureGoogleAI();
      
      const result = await generateText({
        model: google('gemini-2.5-flash'),
      // Configure Google AI with API key from localStorage
      configureGoogleAI();
        prompt: `Extract the user's name, location, and gender from this message. If no name, location, or gender is mentioned, return null for that field.

Message: "${message}"

Return a JSON object with:
- name: The person's name (or null if not mentioned)
- location: The location mentioned (or null if not mentioned)
- gender: The person's gender (male, female, non-binary, etc.) or null if not mentioned
- confidence: Confidence score 0-1
- reasoning: Brief explanation

Only return valid JSON.`,
      });

      // Clean the response and parse JSON
      const cleanedResponse = result.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedResponse);
        return {
          name: parsed.name || undefined,
          location: parsed.location || undefined,
          gender: parsed.gender || undefined,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || 'Extracted from message'
        };
      } catch (parseError) {
        console.error('Failed to parse name/location extraction:', parseError);
        return {
          name: undefined,
          location: undefined,
          confidence: 0.3,
          reasoning: 'Failed to parse extraction result'
        };
      }

    } catch (error) {
      console.error('Name/location extraction failed:', error);
      
      broadcastDebugMessage('error', {
        type: 'name-location-extraction',
        method: 'EXTRACT_FROM_MESSAGE',
        parameters: { message },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });

      return {
        name: undefined,
        location: undefined,
        gender: undefined,
        confidence: 0.1,
        reasoning: 'Extraction failed'
      };
    }
  }

  async extractFromConversation(messages: any[]): Promise<ExtractedNameLocation> {
    if (messages.length === 0) {
      return {
        name: undefined,
        location: undefined,
        gender: undefined,
        confidence: 0,
        reasoning: 'No messages to analyze'
      };
    }

    try {
      const conversationText = messages
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .join('\n');

      // Configure Google AI with API key from localStorage
      configureGoogleAI();
      
      const result = await generateText({
        model: google('gemini-2.5-flash'),
      // Configure Google AI with API key from localStorage
      configureGoogleAI();
        prompt: `Analyze this conversation and extract the user's name, location, and gender.

Conversation:
${conversationText}

Return a JSON object with:
- name: The person's name (or null if not mentioned)
- location: The most recent/relevant location mentioned (or null if not mentioned)
- gender: The person's gender (male, female, non-binary, etc.) or null if not mentioned
- confidence: Confidence score 0-1
- reasoning: Brief explanation

Only return valid JSON.`,
      });

      // Clean the response and parse JSON
      const cleanedResponse = result.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      try {
        const parsed = JSON.parse(cleanedResponse);
        return {
          name: parsed.name || undefined,
          location: parsed.location || undefined,
          gender: parsed.gender || undefined,
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || 'Extracted from conversation'
        };
      } catch (parseError) {
        console.error('Failed to parse conversation extraction:', parseError);
        return {
          name: undefined,
          location: undefined,
          confidence: 0.3,
          reasoning: 'Failed to parse extraction result'
        };
      }

    } catch (error) {
      console.error('Conversation name/location extraction failed:', error);
      
      broadcastDebugMessage('error', {
        type: 'name-location-extraction',
        method: 'EXTRACT_FROM_CONVERSATION',
        parameters: { messageCount: messages.length },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });

      return {
        name: undefined,
        location: undefined,
        confidence: 0.1,
        reasoning: 'Extraction failed'
      };
    }
  }
} 