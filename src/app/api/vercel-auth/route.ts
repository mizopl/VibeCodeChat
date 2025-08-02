import { NextRequest, NextResponse } from 'next/server';
import { getVercelAuth } from '@/lib/utils/vercel-auth';

export async function GET(request: NextRequest) {
  try {
    const vercelAuth = getVercelAuth();
    
    // Validate the token
    const isValid = await vercelAuth.validateToken();
    
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid Vercel OIDC token' },
        { status: 401 }
      );
    }

    // Get user information
    const user = await vercelAuth.getUser();
    
    return NextResponse.json({
      success: true,
      message: 'Vercel authentication successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username
      }
    });
  } catch (error) {
    console.error('❌ Vercel auth error:', error);
    return NextResponse.json(
      { error: 'Vercel authentication failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const vercelAuth = getVercelAuth();
    const body = await request.json();
    const { action, projectId, environment = 'production' } = body;

    switch (action) {
      case 'getProject':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }
        const project = await vercelAuth.getProject(projectId);
        return NextResponse.json({ success: true, project });

      case 'getEnvironmentVariables':
        if (!projectId) {
          return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
        }
        const envVars = await vercelAuth.getEnvironmentVariables(projectId, environment);
        return NextResponse.json({ success: true, environmentVariables: envVars });

      case 'setEnvironmentVariable':
        const { key, value } = body;
        if (!projectId || !key || !value) {
          return NextResponse.json(
            { error: 'projectId, key, and value are required' },
            { status: 400 }
          );
        }
        const result = await vercelAuth.setEnvironmentVariable(projectId, key, value, environment);
        return NextResponse.json({ success: true, result });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Supported actions: getProject, getEnvironmentVariables, setEnvironmentVariable' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Vercel API error:', error);
    return NextResponse.json(
      { error: 'Vercel API request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 