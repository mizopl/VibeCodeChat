import { google } from '@ai-sdk/google';
import { generateText } from 'ai';

export interface ParameterEvaluation {
  parameter: string;
  isRelevant: boolean;
  confidence: number;
  reasoning: string;
  value?: any;
}

export interface InsightsParameters {
  signalInterestsEntities?: string[];
  filterLocation?: any;
  filterType?: string;
  take?: number;
  reason?: string;
  featureExplainability?: boolean;
}

export class ParameterEvaluator {
  private readonly parameterDescriptions = {
    'signal.interests.entities': 'Entity IDs that represent user interests or preferences. Used to find recommendations based on similar tastes.',
    'filter.location': 'Geographic location filter to find location-specific recommendations.',
    'filter.type': 'Entity type filter (e.g., movie, brand, artist) to narrow down results.',
    'take': 'Number of results to return (limit).',
    'reason': 'Explanation of why this query is being made.',
    'feature.explainability': 'Whether to include explanations for why recommendations were made.'
  };

  async evaluateParameters(userQuery: string, entityType: string): Promise<InsightsParameters> {
    const evaluations = await Promise.all([
      this.evaluateParameter('signal.interests.entities', userQuery, entityType),
      this.evaluateParameter('filter.location', userQuery, entityType),
      this.evaluateParameter('filter.type', userQuery, entityType),
      this.evaluateParameter('take', userQuery, entityType),
      this.evaluateParameter('reason', userQuery, entityType),
      this.evaluateParameter('feature.explainability', userQuery, entityType)
    ]);

    const parameters: InsightsParameters = {};
    
    for (const evaluation of evaluations) {
      if (evaluation.isRelevant) {
        switch (evaluation.parameter) {
          case 'signal.interests.entities':
            // This will be populated by entity search
            parameters.signalInterestsEntities = [];
            break;
          case 'filter.location':
            parameters.filterLocation = eval.value;
            break;
          case 'filter.type':
            parameters.filterType = entityType;
            break;
          case 'take':
            parameters.take = 3;
            break;
          case 'reason':
            parameters.reason = userQuery;
            break;
          case 'feature.explainability':
            parameters.featureExplainability = true;
            break;
        }
      }
    }

    return parameters;
  }

  private async evaluateParameter(
    parameter: string, 
    userQuery: string, 
    entityType: string
  ): Promise<ParameterEvaluation> {
    const description = this.parameterDescriptions[parameter as keyof typeof this.parameterDescriptions];
    
    const prompt = `Evaluate if this parameter is relevant for the user query:

Parameter: ${parameter}
Description: ${description}
User Query: "${userQuery}"
Entity Type: ${entityType}

Answer with JSON:
{
  "isRelevant": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "value": "specific value if applicable"
}`;

    // Configure Google AI with API key from localStorage
    configureGoogleAI();
    
    const result = await generateText({
      model: google('gemini-2.5-flash'),
      prompt,
      maxTokens: 200
    });

    try {
      const evaluation = JSON.parse(result.text);
      return {
        parameter,
        isRelevant: evaluation.isRelevant,
        confidence: evaluation.confidence,
        reasoning: evaluation.reasoning,
        value: evaluation.value
      };
    } catch (error) {
      // Fallback evaluation
      console.log('⚠️ Parameter evaluation failed: AI parsing error, using fallback evaluation');
      return this.fallbackEvaluation(parameter, userQuery, entityType);
    }
  }

  private fallbackEvaluation(
    parameter: string, 
    userQuery: string, 
    entityType: string
  ): ParameterEvaluation {
    const query = userQuery.toLowerCase();
    
    switch (parameter) {
      case 'signal.interests.entities':
        return {
          parameter,
          isRelevant: query.includes('similar') || query.includes('like') || query.includes('recommend'),
          confidence: 0.8,
          reasoning: 'User is asking for recommendations, so entity interests are relevant'
        };
      
      case 'filter.location':
        const hasLocation = query.includes('in ') || query.includes('near ') || query.includes('location');
        return {
          parameter,
          isRelevant: hasLocation,
          confidence: hasLocation ? 0.9 : 0.1,
          reasoning: hasLocation ? 'Query mentions location' : 'No location mentioned'
        };
      
      case 'filter.type':
        return {
          parameter,
          isRelevant: true,
          confidence: 1.0,
          reasoning: 'Entity type is always relevant',
          value: entityType
        };
      
      case 'take':
        return {
          parameter,
          isRelevant: true,
          confidence: 1.0,
          reasoning: 'Always need to specify result limit',
          value: 3
        };
      
      case 'reason':
        return {
          parameter,
          isRelevant: true,
          confidence: 1.0,
          reasoning: 'Always need to provide query reason',
          value: userQuery
        };
      
      case 'feature.explainability':
        return {
          parameter,
          isRelevant: true,
          confidence: 0.9,
          reasoning: 'Explanations help users understand recommendations',
          value: true
        };
      
      default:
        return {
          parameter,
          isRelevant: false,
          confidence: 0.1,
          reasoning: 'Unknown parameter'
        };
    }
  }
} 