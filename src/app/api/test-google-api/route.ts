import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json();

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    // Test the Google API key by making a simple request
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Invalid Google API key' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Google API key is valid'
    });

  } catch (error) {
    console.error('❌ Google API test error:', error);
    return NextResponse.json(
      { error: 'Failed to test Google API key' },
      { status: 500 }
    );
  }
} 