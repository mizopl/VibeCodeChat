import { getDatabaseService } from '../database/database';
import { broadcastDebugMessage } from '../utils/debug';

export interface RecommendationFeedback {
  id: string;
  sessionId: string;
  recommendationId: string;
  recommendationType: 'brand' | 'movie' | 'music' | 'restaurant' | 'other';
  recommendationName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  feedback: 'positive' | 'negative' | 'neutral';
  comment?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface FeedbackAnalysis {
  totalFeedback: number;
  averageRating: number;
  positiveFeedback: number;
  negativeFeedback: number;
  topRecommendations: string[];
  improvementAreas: string[];
}

export class FeedbackSystem {
  private sessionId?: string;

  constructor(sessionId?: string) {
    this.sessionId = sessionId;
  }

  setSessionId(sessionId: string) {
    this.sessionId = sessionId;
  }

  // Automatically record implicit feedback based on user interactions
  async recordImplicitFeedback(
    recommendationName: string,
    interactionType: 'view' | 'click' | 'share' | 'search',
    metadata?: Record<string, any>
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      // Determine feedback based on interaction type
      let feedback: 'positive' | 'negative' | 'neutral' = 'neutral';
      let rating = 3;

      switch (interactionType) {
        case 'click':
        case 'share':
          feedback = 'positive';
          rating = 4;
          break;
        case 'view':
          feedback = 'neutral';
          rating = 3;
          break;
        case 'search':
          feedback = 'positive';
          rating = 4;
          break;
      }

      await databaseService.storeRecommendationFeedback(
        this.sessionId,
        `implicit-${Date.now()}`,
        'implicit',
        recommendationName,
        rating,
        feedback,
        `Implicit feedback: ${interactionType}`,
        metadata
      );

      // Update persona based on implicit feedback
      await this.updatePersonaFromFeedback(recommendationName, feedback, rating);

      console.log('✅ Implicit feedback recorded:', { recommendationName, interactionType, feedback });
      
      broadcastDebugMessage('api', {
        type: 'implicit-feedback',
        method: 'RECORD_IMPLICIT_FEEDBACK',
        parameters: { recommendationName, interactionType, feedback },
        status: 'completed'
      });

    } catch (error) {
      console.error('❌ Failed to record implicit feedback:', error);
      
      broadcastDebugMessage('error', {
        type: 'implicit-feedback',
        method: 'RECORD_IMPLICIT_FEEDBACK',
        parameters: { recommendationName, interactionType },
        error: error instanceof Error ? error.message : 'Unknown error',
        status: 'error'
      });
    }
  }

  // Update persona based on feedback
  private async updatePersonaFromFeedback(
    recommendationName: string,
    feedback: 'positive' | 'negative' | 'neutral',
    rating: number
  ): Promise<void> {
    if (!this.sessionId) return;

    try {
      // Ensure persona exists
      await databaseService.getOrCreatePersona(this.sessionId);
      
      // Determine interest category based on recommendation type
      const category = this.determineInterestCategory(recommendationName);
      
      if (feedback === 'positive' && rating >= 4) {
        // Strengthen interest
        await databaseService.addExplicitInterest(
          this.sessionId,
          category,
          recommendationName,
          0.9
        );
        console.log('✅ Strengthened interest:', recommendationName);
      } else if (feedback === 'negative' && rating <= 2) {
        // Weaken interest or add to dislikes
        await databaseService.updatePersonalInterestConfidence(
          this.sessionId,
          recommendationName,
          -0.2
        );
        console.log('✅ Weakened interest:', recommendationName);
      }
    } catch (error) {
      console.error('❌ Failed to update persona from feedback:', error);
    }
  }

  // Determine interest category from recommendation name
  private determineInterestCategory(recommendationName: string): string {
    const name = recommendationName.toLowerCase();
    
    // Brand categories
    if (name.includes('nike') || name.includes('adidas') || name.includes('puma')) {
      return 'brands';
    }
    
    // Movie categories
    if (name.includes('movie') || name.includes('film') || name.includes('action') || name.includes('comedy')) {
      return 'entertainment';
    }
    
    // Music categories
    if (name.includes('music') || name.includes('song') || name.includes('artist')) {
      return 'entertainment';
    }
    
    // Restaurant categories
    if (name.includes('restaurant') || name.includes('food') || name.includes('cafe')) {
      return 'lifestyle';
    }
    
    // Default to brands
    return 'brands';
  }

  // Get feedback analysis for a session
  async getFeedbackAnalysis(): Promise<FeedbackAnalysis> {
    if (!this.sessionId) {
      return {
        totalFeedback: 0,
        averageRating: 0,
        positiveFeedback: 0,
        negativeFeedback: 0,
        topRecommendations: [],
        improvementAreas: []
      };
    }

    try {
      const feedback = await databaseService.getRecommendationFeedback(this.sessionId);
      
      if (feedback.length === 0) {
        return {
          totalFeedback: 0,
          averageRating: 0,
          positiveFeedback: 0,
          negativeFeedback: 0,
          topRecommendations: [],
          improvementAreas: []
        };
      }

      const totalFeedback = feedback.length;
      const averageRating = feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback;
      const positiveFeedback = feedback.filter(f => f.feedback === 'positive').length;
      const negativeFeedback = feedback.filter(f => f.feedback === 'negative').length;

      // Get top recommendations (highest rated)
      const topRecommendations = feedback
        .filter(f => f.rating >= 4)
        .map(f => f.recommendationName)
        .slice(0, 5);

      // Get improvement areas (lowest rated)
      const improvementAreas = feedback
        .filter(f => f.rating <= 2)
        .map(f => f.recommendationName)
        .slice(0, 5);

      return {
        totalFeedback,
        averageRating,
        positiveFeedback,
        negativeFeedback,
        topRecommendations,
        improvementAreas
      };

    } catch (error) {
      console.error('❌ Failed to get feedback analysis:', error);
      return {
        totalFeedback: 0,
        averageRating: 0,
        positiveFeedback: 0,
        negativeFeedback: 0,
        topRecommendations: [],
        improvementAreas: []
      };
    }
  }

  // Get personalized recommendations based on feedback
  async getPersonalizedRecommendations(): Promise<string[]> {
    const analysis = await this.getFeedbackAnalysis();
    
    // Return top recommendations that received positive feedback
    return analysis.topRecommendations;
  }

  // Track user interaction with recommendation
  async trackInteraction(
    recommendationName: string,
    interactionType: 'view' | 'click' | 'share' | 'search'
  ): Promise<void> {
    await this.recordImplicitFeedback(recommendationName, interactionType);
  }

  // Get feedback trends over time
  async getFeedbackTrends(): Promise<{
    recentFeedback: RecommendationFeedback[];
    ratingTrend: number;
    satisfactionScore: number;
  }> {
    if (!this.sessionId) {
      return {
        recentFeedback: [],
        ratingTrend: 0,
        satisfactionScore: 0
      };
    }

    try {
      const feedback = await databaseService.getRecommendationFeedback(this.sessionId);
      
      // Get recent feedback (last 10)
      const recentFeedback = feedback
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 10);

      // Calculate rating trend (simple: recent average vs overall average)
      const overallAverage = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
      const recentAverage = recentFeedback.reduce((sum, f) => sum + f.rating, 0) / recentFeedback.length;
      const ratingTrend = recentAverage - overallAverage;

      // Calculate satisfaction score (percentage of positive feedback)
      const satisfactionScore = feedback.filter(f => f.feedback === 'positive').length / feedback.length;

      return {
        recentFeedback,
        ratingTrend,
        satisfactionScore
      };

    } catch (error) {
      console.error('❌ Failed to get feedback trends:', error);
      return {
        recentFeedback: [],
        ratingTrend: 0,
        satisfactionScore: 0
      };
    }
  }
} 