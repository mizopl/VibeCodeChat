'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import ChatGPTInterface from '@/components/ChatGPTInterface/ChatGPTInterface';

export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const sessionId = searchParams.get('sessionId');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setIsLoaded(true);
  }, []);

  const handleSkipToApp = async () => {
    try {
      // Create a new session without persona data
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personaData: {
            name: 'Guest',
            age: '25',
            city: 'Unknown',
            bio: 'Guest user who skipped persona creation'
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          router.push(`/?sessionId=${result.data.id}`);
        }
      }
    } catch (error) {
      console.error('Error creating guest session:', error);
      // Fallback: just go to the app without session
      router.push('/?sessionId=guest');
    }
  };

  // If there's a session ID, show the chat interface
  if (sessionId) {
    return (
      <main className="min-h-screen">
        <ChatGPTInterface sessionId={sessionId} />
      </main>
    );
  }

  // Otherwise, show the landing page
  return (
    <div 
      className="min-h-screen relative overflow-hidden"
      style={{
        backgroundImage: 'url(/original.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Overlay for better text readability */}
      <div className="absolute inset-0 bg-black/40"></div>
      
      {/* Skip to App Button */}
      <button
        onClick={handleSkipToApp}
        className="absolute top-6 right-6 z-20 w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110"
        title="Skip to app"
      >
        <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Logo/Title */}
          <div className="mb-8">
            <img 
              src="/QLooTwin.jpg" 
              alt="QLooTwin - Your AI Cultural Intelligence Companion" 
              className="w-32 h-32 mx-auto mb-6 rounded-full shadow-2xl"
            />
            <h1 className="text-5xl md:text-6xl font-bold text-white mb-4">
              QLooTwin
            </h1>
            <p className="text-xl md:text-2xl text-white/90 font-light">
              Your AI Cultural Intelligence Companion
            </p>
          </div>

          {/* App Description */}
          <div className="mb-12 space-y-6">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
              <h2 className="text-3xl font-bold text-white mb-6">
                Discover Your Perfect Matches
              </h2>
              <p className="text-lg text-white/90 leading-relaxed mb-6">
                QLooTwin uses advanced AI to understand your unique preferences and cultural tastes. 
                Get personalized recommendations for restaurants, movies, brands, travel destinations, and more.
              </p>
              
              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="text-center">
                  <div className="text-4xl mb-3">🍕</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Restaurants & Food</h3>
                  <p className="text-white/80">Find the perfect dining spots that match your taste</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-3">🎬</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Movies & Entertainment</h3>
                  <p className="text-white/80">Discover films and shows tailored to your preferences</p>
                </div>
                <div className="text-center">
                  <div className="text-4xl mb-3">🛍️</div>
                  <h3 className="text-xl font-semibold text-white mb-2">Brands & Shopping</h3>
                  <p className="text-white/80">Get recommendations for brands that align with your style</p>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="mb-8">
            <Link 
              href="/create-persona"
              className="inline-block bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white text-xl font-bold px-12 py-6 rounded-2xl shadow-2xl transform transition-all duration-300 hover:scale-105 hover:shadow-3xl"
            >
              Create Your First Twin
            </Link>
          </div>

          {/* Additional Info */}
          <div className="text-white/70 text-sm">
            <p>Powered by advanced AI • Privacy-focused • Personalized for you</p>
          </div>
        </div>
      </div>

      {/* Animated background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-20 w-32 h-32 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-24 h-24 bg-purple-500/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-10 w-16 h-16 bg-blue-500/20 rounded-full blur-xl animate-pulse delay-500"></div>
      </div>
    </div>
  );
}
