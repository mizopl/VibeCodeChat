import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
    hasGoogleApiKey: !!process.env.GOOGLE_API_KEY,
    hasQlooApiKey: !!process.env.QLOO_API_KEY,
    hasVercelOidcToken: !!process.env.VERCEL_OIDC_TOKEN,
    hasRedisUrl: !!process.env.REDIS_URL,
    googleApiKeyLength: process.env.GOOGLE_API_KEY?.length || 0,
    qlooApiKeyLength: process.env.QLOO_API_KEY?.length || 0,
  });
} 