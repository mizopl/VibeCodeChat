import { NextRequest, NextResponse } from 'next/server';
import { databaseService } from '@/lib/database/database';
import { PersonaManager } from '@/lib/agents/persona-manager';
import { AudienceDiscovery } from '@/lib/agents/audience-discovery';
import { FeedbackSystem } from '@/lib/agents/feedback-system';
import { BioGenerator } from '@/lib/agents/bio-generator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Persona API called with sessionId:', sessionId);
    console.log('🔍 databaseService exists:', !!databaseService);
    console.log('🔍 databaseService.prisma exists:', !!databaseService?.prisma);

    // Initialize persona components
    const personaManager = new PersonaManager(sessionId);
    const audienceDiscovery = new AudienceDiscovery();
    const feedbackSystem = new FeedbackSystem(sessionId);

    // Get or create persona data
    console.log('🔍 Calling getOrCreatePersona...');
    const persona = await databaseService.getOrCreatePersona(sessionId);
    console.log('🔍 getOrCreatePersona completed, persona:', !!persona);
    const interests = await personaManager.getStoredInterests();
    const personaSummary = await personaManager.getPersonaSummary();
    const feedbackAnalysis = await feedbackSystem.getFeedbackAnalysis();
    const feedbackTrends = await feedbackSystem.getFeedbackTrends();

    // Get audience recommendations
    const userInterests = interests.map(interest => interest.name);
    const audienceRecommendations = await audienceDiscovery.getAudienceRecommendations(
      userInterests,
      persona?.demographics
    );

    // Get available audience categories
    const availableAudiences = await audienceDiscovery.getAvailableAudienceCategories();

    // Get recent feedback
    const recentFeedback = await databaseService.getRecommendationFeedback(sessionId);

    // Generate bio
    const bioGenerator = new BioGenerator(sessionId);
    const personaData = {
      name: persona?.name || 'Unknown',
      location: persona?.location || 'Unknown',
      age: persona?.demographics?.age,
      interests: interests.map(interest => ({
        name: interest.name,
        category: interest.category,
        confidence: interest.confidence
      })),
      demographics: persona?.demographics,
      feedback: feedbackAnalysis
    };
    
    const bio = await bioGenerator.generateBio(personaData, 'michelin');

    const dashboardData = {
      sessionId,
      persona: {
        id: persona?.id,
        name: persona?.name,
        location: persona?.location,
        confidence: persona?.confidence || 0,
        demographics: persona?.demographics,
        createdAt: persona?.createdAt,
        updatedAt: persona?.updatedAt
      },
      interests: {
        total: interests.length,
        categories: personaSummary.topCategories,
        averageConfidence: personaSummary.confidence,
        items: interests.map(interest => ({
          id: interest.id,
          category: interest.category,
          name: interest.name,
          confidence: interest.confidence,
          source: interest.source,
          entityId: interest.entityId,
          timestamp: interest.timestamp
        }))
      },
      audiences: {
        recommendations: audienceRecommendations.map(audience => ({
          type: audience.audienceType,
          id: audience.audienceId,
          name: audience.name,
          confidence: audience.confidence,
          reasoning: audience.reasoning
        })),
        available: availableAudiences.map(category => ({
          type: category.type,
          name: category.name,
          description: category.description,
          audienceCount: category.audiences.length
        }))
      },
      feedback: {
        analysis: feedbackAnalysis,
        trends: feedbackTrends,
        recent: recentFeedback.slice(0, 10).map(feedback => ({
          id: feedback.id,
          recommendationName: feedback.recommendationName,
          rating: feedback.rating,
          feedback: feedback.feedback,
          comment: feedback.comment,
          timestamp: feedback.timestamp
        }))
      },
      recommendations: {
        personalized: await feedbackSystem.getPersonalizedRecommendations(),
        topRated: feedbackAnalysis.topRecommendations,
        needsImprovement: feedbackAnalysis.improvementAreas
      },
      bio: bio
    };

    return NextResponse.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error('❌ Persona dashboard error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to load persona dashboard',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, data } = body;

    if (!sessionId || !action) {
      return NextResponse.json(
        { error: 'Session ID and action are required' },
        { status: 400 }
      );
    }

    const personaManager = new PersonaManager(sessionId);
    const feedbackSystem = new FeedbackSystem(sessionId);

    switch (action) {
      case 'addInterest':
        const { category, name, confidence = 0.9 } = data;
        await personaManager.addExplicitInterest(category, name, confidence);
        return NextResponse.json({ success: true, message: 'Interest added successfully' });

      case 'trackInteraction':
        const { recommendationName, interactionType } = data;
        await feedbackSystem.trackInteraction(recommendationName, interactionType);
        return NextResponse.json({ success: true, message: 'Interaction tracked successfully' });

                   case 'updateDemographics':
               const { demographics } = data;
               await databaseService.updatePersona(sessionId, { demographics });
               return NextResponse.json({ success: true, message: 'Demographics updated successfully' });

             case 'regenerateBio':
               const bioGenerator = new BioGenerator(sessionId);
               const persona = await databaseService.getPersona(sessionId);
               const interests = await personaManager.getStoredInterests();
               const feedbackAnalysis = await feedbackSystem.getFeedbackAnalysis();
               
               const personaData = {
                 name: persona?.name || 'Unknown',
                 location: persona?.location || 'Unknown',
                 age: persona?.demographics?.age,
                 interests: interests.map(interest => ({
                   name: interest.name,
                   category: interest.category,
                   confidence: interest.confidence
                 })),
                 demographics: persona?.demographics,
                 feedback: feedbackAnalysis
               };
               
               const newBio = await bioGenerator.regenerateBio(personaData, data.currentStyle || 'michelin');
               return NextResponse.json({ success: true, bio: newBio });

             default:
               return NextResponse.json(
                 { error: 'Invalid action' },
                 { status: 400 }
               );
           }

  } catch (error) {
    console.error('❌ Persona action error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to perform persona action',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 