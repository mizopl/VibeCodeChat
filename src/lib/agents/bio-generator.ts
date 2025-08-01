import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { broadcastDebugMessage } from '../utils/debug';

export interface PersonaBio {
  title: string;
  subtitle: string;
  bio: string;
  signature: string;
  style: 'michelin' | 'creative' | 'professional';
}

export interface PersonaData {
  name: string;
  location: string;
  age?: number;
  interests: Array<{
    name: string;
    category: string;
    confidence: number;
  }>;
  demographics?: any;
  feedback?: any;
}

export class BioGenerator {
  private sessionId?: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

    async generateBio(personaData: PersonaData, style: 'michelin' | 'creative' | 'professional' = 'michelin'): Promise<PersonaBio> {
    // Using fallback bio generator - AI bio generation is currently disabled
    console.log('⚠️ Bio generation: Using fallback generator - AI bio generation is disabled');
    return this.createFallbackBio(personaData, style);
  }

    private createFallbackBio(personaData: PersonaData, style: 'michelin' | 'creative' | 'professional'): PersonaBio {
      const { name, location, age, interests } = personaData;
      
      let title = 'Persona Profile';
      let subtitle = 'Discovering personalized tastes';
      let bio = '';
      let signature = '';

      if (style === 'michelin') {
        title = `${name} - A Connoisseur's Journey`;
        subtitle = `Where passion meets precision in the art of taste discovery`;
        bio = `${name}${age ? `, a ${age}-year-old` : ''} from ${location}, embodies the spirit of refined discovery. With interests spanning ${interests.length} distinct categories, ${name} represents the modern connoisseur who seeks excellence in every experience. Their journey through the world of taste and preference reveals a sophisticated palate that appreciates both tradition and innovation.`;
        signature = `"In the pursuit of excellence, every detail matters."`;
      } else if (style === 'creative') {
        title = `${name} - The Explorer`;
        subtitle = `A vibrant soul navigating the colorful landscape of personal taste`;
        bio = `Meet ${name}, a ${age ? `${age}-year-old` : ''} adventurer from ${location} whose interests paint a vivid tapestry of personality. Like a master artist, ${name} blends different passions into a unique masterpiece of personal taste. Their journey is one of discovery, where each interest adds a new color to their life's canvas.`;
        signature = `"Every interest is a new adventure waiting to unfold."`;
      } else {
        title = `${name} - Profile Summary`;
        subtitle = `A comprehensive overview of personal preferences and characteristics`;
        bio = `${name}${age ? `, age ${age}` : ''}, based in ${location}, demonstrates a diverse range of interests across ${interests.length} categories. This profile reflects a well-rounded individual with clear preferences and a structured approach to personal taste development.`;
        signature = `"Data-driven insights for personalized experiences."`;
      }

      return {
        title,
        subtitle,
        bio,
        signature,
        style
      };
  }

  async regenerateBio(personaData: PersonaData, currentStyle: string): Promise<PersonaBio> {
    // Cycle through styles or generate a new one
    const styles: Array<'michelin' | 'creative' | 'professional'> = ['michelin', 'creative', 'professional'];
    const currentIndex = styles.indexOf(currentStyle as any);
    const nextStyle = styles[(currentIndex + 1) % styles.length];
    
    return await this.generateBio(personaData, nextStyle);
  }
} 