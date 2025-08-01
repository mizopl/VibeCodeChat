'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreatePersonaPage() {
  const router = useRouter();
  const [personaForm, setPersonaForm] = useState({
    name: '',
    age: '',
    city: '',
    bio: ''
  });
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);

  const generateRandomBio = () => {
    const bios = [
      "A tech-savvy millennial who loves indie music, craft coffee, and sustainable fashion. Always exploring new restaurants and hidden gems in the city.",
      "A fitness enthusiast who's passionate about healthy living, outdoor adventures, and discovering new workout trends. Enjoys trying new cuisines and travel experiences.",
      "A creative professional who appreciates art, design, and culture. Loves attending concerts, visiting museums, and exploring trendy neighborhoods.",
      "A foodie who's always on the hunt for the best restaurants, wine bars, and culinary experiences. Enjoys cooking, wine tasting, and sharing meals with friends.",
      "A fashion-forward individual who stays ahead of trends, loves shopping, and has a keen eye for style. Enjoys beauty products, luxury brands, and personal care.",
      "A music lover who's always discovering new artists, attending concerts, and exploring different genres. Enjoys vinyl records, live performances, and music festivals.",
      "A wellness-focused person who prioritizes mental health, meditation, and holistic living. Enjoys yoga, organic food, and mindfulness practices.",
      "A social butterfly who loves networking, attending events, and meeting new people. Enjoys nightlife, entertainment, and cultural experiences."
    ];
    const randomBio = bios[Math.floor(Math.random() * bios.length)];
    setPersonaForm(prev => ({ ...prev, bio: randomBio }));
  };

  const handlePersonaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personaForm.name || !personaForm.age || !personaForm.city) {
      alert('Please fill in all required fields');
      return;
    }

    setIsCreatingPersona(true);

    try {
      // Create new session with persona data
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personaData: personaForm
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.success && result.data) {
          // Redirect to the chat interface with the new session
          router.push(`/?sessionId=${result.data.id}`);
        } else {
          console.error('Invalid session response format:', result);
          alert('Failed to create persona. Please try again.');
        }
      } else {
        const errorData = await response.json();
        console.error('Error creating persona:', errorData);
        alert(`Failed to create persona: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error creating persona:', error);
      alert('Failed to create persona. Please try again.');
    } finally {
      setIsCreatingPersona(false);
    }
  };

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
      <div className="absolute inset-0 bg-white/70"></div>
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6">
        <div className="max-w-2xl w-full mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-slate-900 mb-4">
              Create Your QLooTwin
            </h1>
            <p className="text-lg text-slate-700">
              Tell us about yourself to get personalized recommendations
            </p>
          </div>
          
          {/* Persona Creation Form */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-8 border border-white/50 shadow-2xl">
            <form onSubmit={handlePersonaSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Name *
                </label>
                <input
                  type="text"
                  value={personaForm.name}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500 bg-white/80"
                  placeholder="Enter your name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Age *
                </label>
                <input
                  type="number"
                  value={personaForm.age}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, age: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500 bg-white/80"
                  placeholder="Enter your age"
                  min="13"
                  max="100"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  City *
                </label>
                <input
                  type="text"
                  value={personaForm.city}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, city: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500 bg-white/80"
                  placeholder="Enter your city"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-900 mb-2">
                  Bio
                </label>
                <textarea
                  value={personaForm.bio}
                  onChange={(e) => setPersonaForm(prev => ({ ...prev, bio: e.target.value }))}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500 bg-white/80 resize-none"
                  placeholder="Tell us about your interests, lifestyle, and preferences..."
                  rows={4}
                />
                <button
                  type="button"
                  onClick={generateRandomBio}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-700 underline"
                >
                  🎲 Roll the dice to generate a random bio
                </button>
              </div>
              
              <div className="flex space-x-4 pt-4">
                <button
                  type="submit"
                  disabled={isCreatingPersona}
                  className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-105"
                >
                  {isCreatingPersona ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                      Creating Your Twin...
                    </div>
                  ) : (
                    'Create Your Twin'
                  )}
                </button>
                <button
                  type="button"
                  disabled={isCreatingPersona}
                  onClick={() => router.push('/')}
                  className="flex-1 bg-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold text-lg hover:bg-slate-300 transition-all duration-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 