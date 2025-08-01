'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ChatInput } from './ChatInput';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import QlooEntityHyperlinks from '../QlooEntityHyperlinks';
import VisualChatElements from '../VisualChatElements';
import EntityScorePanel from '../EntityScorePanel';
import { PersonaSidebar } from '../PersonaSidebar';
import { TokenCounter } from '../TokenCounter/TokenCounter';
import { AGENT_CAPABILITIES } from '../../lib/agents/agent-capabilities';
import { ChatMessage } from '../../types';

interface Session {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  personaId?: string;
  personaName?: string;
  debugMode?: boolean;
  messageCount?: number;
  apiCallCount?: number;
  tokenUsageCount?: number;
  totalTokens?: number;
  totalCost?: number;
}

interface ChatGPTInterfaceProps {
  sessionId?: string;
  initialMessages?: ChatMessage[];
}

export default function ChatGPTInterface({ 
  sessionId, 
  initialMessages = [] 
}: ChatGPTInterfaceProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(sessionId || null);
  const [showCapabilities, setShowCapabilities] = useState(!sessionId);
  const [showPersonaSidebar, setShowPersonaSidebar] = useState(false);
  const [showPersonaCreation, setShowPersonaCreation] = useState(false);
  const [personaForm, setPersonaForm] = useState({
    name: '',
    age: '',
    city: '',
    bio: ''
  });
  const [isCreatingPersona, setIsCreatingPersona] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<any[]>(initialMessages);
  const [input, setInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || aiLoading) return;

    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      content: input.trim(),
      timestamp: new Date().toISOString(),
    };

    // Add user message to local state
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAiLoading(true);

    try {
      console.log('🚀 Sending chat request...');
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          sessionId: currentSessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      console.log('📡 Chat response received, reading text...');
      const assistantMessage = await response.text();
      console.log('✅ Chat response text length:', assistantMessage.length);
      
      // Reload messages from database to get proper IDs
      if (currentSessionId) {
        await loadSession(currentSessionId);
      } else {
        // Fallback to local state if no session
        console.log('⚠️ Chat interface: No session available, using local state fallback');
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'assistant' as const,
          content: assistantMessage,
          timestamp: new Date().toISOString(),
        }]);
      }

      console.log('✅ Chat message finished');
    } catch (error) {
      console.error('❌ Chat error:', error);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant' as const,
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setAiLoading(false);
    }
  };

  // Load sessions
  const fetchSessions = async () => {
    try {
      console.log('🔄 Fetching sessions...');
      const response = await fetch('/api/sessions');
      console.log('📡 Response status:', response.status);
      const result = await response.json();
      console.log('📦 Sessions response:', result);
      
      if (result.success && result.data && result.data.sessions) {
        console.log('✅ Found sessions:', result.data.sessions.length);
        setSessions(result.data.sessions);
      } else {
        console.error('❌ Invalid sessions response format:', result);
        setSessions([]);
      }
    } catch (error) {
      console.error('❌ Failed to fetch sessions:', error);
      setSessions([]);
    }
  };

  // Load session messages
  const loadSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success && result.data && result.data.session) {
        const session = result.data.session;
        setCurrentSessionId(sessionId);
        setShowCapabilities(false);

        // Convert messages to the format expected by useChat
        const chatMessages = session.messages.map((msg: any) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: msg.timestamp,
          usage: msg.usage,
          metadata: msg.metadata,
        }));

        // Set the messages in the chat state using setMessages from useChat
        setMessages(chatMessages);
        
        console.log('✅ Loaded session:', {
          sessionId,
          messageCount: session.messages.length,
          entityCount: session.entities?.length || 0,
          apiCallCount: session.apiCalls?.length || 0
        });
      } else {
        console.error('Invalid session response format:', result);
        throw new Error('Invalid session response format');
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      // Show user-friendly error message
      alert('Failed to load session. Please try again.');
    }
  };

  const loadNextAvailableSession = async () => {
    if (sessions.length > 0) {
      // Find the next session that's not the current one
      const currentIndex = sessions.findIndex(s => s.id === currentSessionId);
      const nextIndex = (currentIndex + 1) % sessions.length;
      await loadSession(sessions[nextIndex].id);
    }
  };

  const createNewChat = async () => {
    try {
      // Create a new session with the same persona as current session
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          personaData: {
            name: 'Guest',
            age: '25',
            city: 'Unknown',
            bio: 'New chat session'
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          // Load the new session
          await loadSession(result.data.id);
        }
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      // If creation fails, try to load the next available session
      await loadNextAvailableSession();
    }
  };

  const createNewPersona = () => {
    // Redirect to create persona page
    window.location.href = '/create-persona';
  };

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
          await loadSession(result.data.id);
          setShowPersonaCreation(false);
          setPersonaForm({ name: '', age: '', city: '', bio: '' });
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

  const deleteSession = async (sessionId: string) => {
    try {
      await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      await fetchSessions();
      if (currentSessionId === sessionId) {
        // If we deleted the current session, load the next available one
        await loadNextAvailableSession();
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  useEffect(() => {
    fetchSessions();
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const metadata = message.metadata;
    const entities = metadata?.entities || [];
    const lastResponseMetadata = metadata?.lastResponseMetadata;
    
    const deleteMessage = async (messageId: string) => {
      try {
        const response = await fetch(`/api/chat/messages/${messageId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: currentSessionId })
        });
        
        if (response.ok) {
          // Remove message from local state
          setMessages(prev => prev.filter(m => m.id !== messageId));
        } else {
          console.error('Failed to delete message');
        }
      } catch (error) {
        console.error('Error deleting message:', error);
      }
    };

    return (
      <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 group relative`}>
        <div className={`max-w-[80%] ${isUser ? 'bg-blue-600/80 backdrop-blur-sm text-white' : 'bg-transparent text-white'} rounded-none px-6 py-4 relative`}>
          {/* Delete button - only show on hover */}
          <button
            onClick={() => deleteMessage(message.id)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white/60 hover:text-red-400 text-sm"
            title="Delete message"
          >
            🗑️
          </button>
          
          <ChatMessageComponent message={message} />
          
          {/* Visual Elements for Recommendations - priority over hyperlinks */}
          {!isUser && (lastResponseMetadata?.entities || entities) && (lastResponseMetadata?.entities?.length > 0 || entities.length > 0) && (
            <VisualChatElements
              entities={lastResponseMetadata?.entities || entities}
              messageType="recommendation"
            />
          )}
          
          {/* Entity Hyperlinks for Assistant Messages - only show if no visual elements */}
          {!isUser && entities && entities.length > 0 && !lastResponseMetadata?.entities && (
            <QlooEntityHyperlinks
              text={message.content}
              entities={entities}
              onEntityClick={(entity) => {
                console.log('🎯 Entity clicked:', entity);
              }}
            />
          )}
          
          {/* Entity Score Panel */}
          {!isUser && (lastResponseMetadata?.entities || entities) && (lastResponseMetadata?.entities?.length > 0 || entities.length > 0) && (
            <EntityScorePanel
              entities={lastResponseMetadata?.entities || entities}
              messageId={message.id}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen text-white" style={{
      backgroundImage: 'url(/original.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      {/* Token Counter - Top Bar */}
      <TokenCounter />

      {/* Sidebar - Elegant Navigation */}
      <div className="w-80 bg-transparent border-r border-transparent flex flex-col mt-16">
        {/* Header */}
        <div className="p-4 border-b border-transparent bg-transparent flex flex-col items-center">
                          <img src="/QLooTwin.jpg" alt="QLooTwin - Your AI Cultural Intelligence Companion" className="w-3/4 h-auto mb-2" />
          {currentSessionId && (
            <div className="mt-4 space-y-2">
              <button
                onClick={() => setShowPersonaSidebar(!showPersonaSidebar)}
                className="w-full bg-red-600 text-white px-4 py-2 rounded-none hover:bg-red-700 transition-colors duration-200 font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {showPersonaSidebar ? 'Hide' : 'Show'} Persona
              </button>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-3 space-y-2 bg-transparent">
          <button
            onClick={createNewPersona}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-xl font-bold hover:from-blue-700 hover:to-purple-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create New Twin
          </button>
          
          <button
            onClick={createNewChat}
            className="w-full bg-white/20 text-white px-4 py-3 rounded-xl font-medium hover:bg-white/30 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            New Chat
          </button>
          
          <button
            onClick={fetchSessions}
            className="w-full bg-white/10 text-white px-3 py-2 rounded-lg text-sm hover:bg-white/20 transition-colors duration-200"
          >
            Refresh Sessions
          </button>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 space-y-2 bg-transparent m-4">
            {sessions && sessions.length > 0 ? (
              sessions.map((session) => (
                                  <div
                    key={session.id}
                    className={`group relative p-3 rounded-none border-transparent cursor-pointer transition-all duration-200 ${
                      currentSessionId === session.id
                        ? 'bg-white/20 border-white/30'
                        : 'bg-transparent border-transparent hover:bg-white/10 hover:border-white/20'
                    }`}
                  >
                                      <button
                      onClick={() => loadSession(session.id)}
                      className="w-full text-left text-sm text-white truncate"
                    >
                      <div className="font-medium text-white">
                        {session.personaName || 'Unknown Persona'}
                      </div>
                      <div className="text-xs text-white/90">
                        {new Date(session.updatedAt).toLocaleDateString()} - {session.messageCount || 0} messages
                      </div>
                    </button>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-white/60 hover:text-red-400"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center text-white/90 text-sm py-8">
                No chat sessions yet
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area - Chat */}
      <div className="flex-1 flex mt-16">
        {/* Main Chat Area */}
        <div className={`flex flex-col ${showPersonaSidebar ? 'flex-1' : 'w-full'}`}>
                  {/* Clear Chat Button - Upper Right */}
        <div className={`absolute top-20 z-10 ${showPersonaSidebar ? 'right-80' : 'right-4'}`}>
            <button
              onClick={() => {
                setMessages([]);
                setInput('');
              }}
              className="bg-transparent border border-white/30 text-white px-3 py-2 rounded-none text-sm hover:bg-white/10 transition-colors duration-200 flex items-center gap-1"
              title="Clear Chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear
            </button>
          </div>
          
          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-transparent">
            {showCapabilities && (
              <div className="max-w-4xl mx-auto">
                {/* Welcome Header */}
                <div className="text-center mb-12">
                  <h1 className="text-4xl font-bold text-white mb-4">{AGENT_CAPABILITIES.title}</h1>
                  <p className="text-xl text-white/80 mb-8">{AGENT_CAPABILITIES.subtitle}</p>
                  <p className="text-white/90 leading-relaxed max-w-2xl mx-auto">{AGENT_CAPABILITIES.description}</p>
                </div>

                {/* Capabilities Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  {AGENT_CAPABILITIES.capabilities.map((capability, index) => (
                    <div key={index} className="bg-transparent border border-white/30 p-6 rounded-none">
                      <h3 className="text-lg font-semibold text-white mb-3">{capability.category}</h3>
                      <p className="text-white/95 mb-4 text-sm leading-relaxed">{capability.description}</p>
                      <div className="space-y-2">
                        {capability.examples.map((example, idx) => (
                          <div key={idx} className="text-xs text-white/70 bg-white/10 px-3 py-2 rounded-none">
                            "{example}"
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Features */}
                <div className="bg-transparent border border-white/30 p-8 rounded-none">
                  <h2 className="text-2xl font-bold text-white mb-6 text-center">Why Choose QLooTwin?</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {AGENT_CAPABILITIES.features.map((feature, index) => (
                      <div key={index} className="text-center">
                        <div className="text-3xl mb-3">{feature.icon}</div>
                        <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                        <p className="text-sm text-white/95">{feature.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Chat Messages */}
            {messages.map(renderMessage)}

            {aiLoading && (
              <div className="max-w-4xl mx-auto w-full text-left">
                <div className="inline-block max-w-3xl px-6 py-4 rounded-none bg-white border border-slate-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Form */}
          <div className="border-t border-transparent bg-transparent p-6">
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="flex space-x-4">
                <input
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Ask me about restaurants, movies, brands, travel destinations, and more..."
                  className="flex-1 px-4 py-3 border border-white/30 rounded-none focus:outline-none focus:border-white focus:ring-0 text-white placeholder-white/60 bg-transparent"
                  disabled={aiLoading}
                />
                <button
                  type="submit"
                  disabled={aiLoading || !input.trim()}
                  className="px-6 py-3 bg-transparent border border-white/30 text-white rounded-none font-medium hover:bg-white/10 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Persona Dashboard */}
        {currentSessionId && showPersonaSidebar && (
          <PersonaSidebar
            sessionId={currentSessionId}
            isOpen={showPersonaSidebar}
            onClose={() => setShowPersonaSidebar(false)}
          />
        )}
      </div>

      {/* Persona Creation Modal */}
      {showPersonaCreation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            className="bg-white p-8 max-w-md w-full mx-4 rounded-none relative overflow-hidden"
            style={{
              backgroundImage: 'url(/original.jpg)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Overlay to ensure text readability */}
            <div className="absolute inset-0 bg-white/90"></div>
            
            {/* Content */}
            <div className="relative z-10">
              <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Persona</h2>
              
              <form onSubmit={handlePersonaSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Name *</label>
                  <input
                    type="text"
                    value={personaForm.name}
                    onChange={(e) => setPersonaForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-none focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500"
                    placeholder="Enter your name"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Age *</label>
                  <input
                    type="number"
                    value={personaForm.age}
                    onChange={(e) => setPersonaForm(prev => ({ ...prev, age: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-none focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500"
                    placeholder="Enter your age"
                    min="13"
                    max="100"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">City *</label>
                  <input
                    type="text"
                    value={personaForm.city}
                    onChange={(e) => setPersonaForm(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-none focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500"
                    placeholder="Enter your city"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-900 mb-2">Bio</label>
                  <textarea
                    value={personaForm.bio}
                    onChange={(e) => setPersonaForm(prev => ({ ...prev, bio: e.target.value }))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-none focus:outline-none focus:border-slate-900 focus:ring-0 text-slate-900 placeholder-slate-500"
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
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-none font-medium hover:bg-blue-700 transition-colors duration-200 disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isCreatingPersona ? (
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating...
                      </div>
                    ) : (
                      'Create Persona'
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingPersona}
                    onClick={() => {
                      setShowPersonaCreation(false);
                      setPersonaForm({ name: '', age: '', city: '', bio: '' });
                    }}
                    className="flex-1 bg-slate-200 text-slate-700 px-6 py-3 rounded-none font-medium hover:bg-slate-300 transition-colors duration-200 disabled:bg-slate-100 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 