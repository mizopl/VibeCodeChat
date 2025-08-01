export const AGENT_CAPABILITIES = {
  title: "QLooTwin",
  subtitle: "Your AI Cultural Intelligence Companion",
  
  description: `I'm your sophisticated AI concierge, powered by Qloo's advanced taste intelligence. I help you discover personalized recommendations across all your interests - from dining and entertainment to travel and lifestyle.

My expertise spans 10 curated categories, each with deep insights and personalized suggestions tailored to your unique preferences.`,

  capabilities: [
    {
      category: "🍽️ Dining & Cuisine",
      description: "Discover exceptional restaurants, cafes, and culinary experiences. From Michelin-starred dining to hidden neighborhood gems, I'll find the perfect spot for any occasion.",
      examples: [
        "Find romantic Italian restaurants in Paris",
        "Best sushi places in San Francisco",
        "Vegan fine dining in London",
        "Casual brunch spots in New York"
      ]
    },
    {
      category: "🎬 Entertainment & Media",
      description: "Get personalized movie, TV show, and podcast recommendations based on your taste profile and current mood.",
      examples: [
        "Movies like The Matrix set in New York",
        "TV shows for fans of Breaking Bad",
        "Podcasts about sustainable living",
        "Action movies with strong female leads"
      ]
    },
    {
      category: "🛍️ Brands & Shopping",
      description: "Discover brands and products that match your lifestyle and values, from luxury fashion to sustainable alternatives.",
      examples: [
        "Luxury brands similar to Patagonia",
        "Sustainable fashion alternatives",
        "Tech brands for outdoor enthusiasts",
        "Premium coffee brands"
      ]
    },
    {
      category: "🎨 Arts & Culture",
      description: "Explore artists, books, and cultural experiences that resonate with your artistic sensibilities.",
      examples: [
        "Books similar to The Alchemist",
        "Artists like Banksy",
        "Museums in Barcelona",
        "Contemporary art galleries"
      ]
    },
    {
      category: "🎮 Gaming & Interactive",
      description: "Find video games and interactive experiences that match your gaming preferences and interests.",
      examples: [
        "RPG games like Skyrim",
        "Strategy games for beginners",
        "Indie games with unique art styles",
        "Multiplayer games for friends"
      ]
    },
    {
      category: "🎵 Music & Audio",
      description: "Discover musicians, bands, and audio content that align with your musical taste and lifestyle.",
      examples: [
        "Artists similar to Radiohead",
        "Jazz musicians in New Orleans",
        "Podcasts about technology",
        "Classical music for relaxation"
      ]
    },
    {
      category: "🌍 Travel & Destinations",
      description: "Get personalized travel recommendations for destinations, activities, and experiences that match your travel style.",
      examples: [
        "Hidden gems in Tokyo",
        "Adventure destinations in South America",
        "Luxury resorts in the Caribbean",
        "Cultural experiences in Europe"
      ]
    },
    {
      category: "👥 People & Influencers",
      description: "Discover thought leaders, influencers, and personalities who share your interests and values.",
      examples: [
        "Tech influencers in Silicon Valley",
        "Sustainability advocates",
        "Fashion bloggers in Paris",
        "Fitness experts for beginners"
      ]
    },
    {
      category: "📺 Television & Streaming",
      description: "Find TV shows and streaming content that match your viewing preferences and current mood.",
      examples: [
        "Netflix shows like Stranger Things",
        "Documentaries about nature",
        "Comedy series for families",
        "Drama series with strong plots"
      ]
    },
    {
      category: "🎧 Podcasts & Audio",
      description: "Discover podcasts and audio content that align with your interests, from education to entertainment.",
      examples: [
        "Business podcasts for entrepreneurs",
        "True crime podcasts",
        "Educational content about science",
        "Comedy podcasts for road trips"
      ]
    }
  ],

  features: [
    {
      icon: "🎯",
      title: "Precision Matching",
      description: "Advanced algorithms analyze your preferences to deliver spot-on recommendations"
    },
    {
      icon: "🔍",
      title: "Deep Insights",
      description: "Get detailed explanations of why each recommendation matches your taste profile"
    },
    {
      icon: "⚡",
      title: "Real-time Intelligence",
      description: "Access to the latest trends and emerging preferences across all categories"
    },
    {
      icon: "🎨",
      title: "Personalized Experience",
      description: "Every interaction builds your unique taste profile for increasingly accurate suggestions"
    },
    {
      icon: "🌍",
      title: "Global Coverage",
      description: "Discover hidden gems and local favorites from around the world"
    },
    {
      icon: "📊",
      title: "Transparent Process",
      description: "See exactly how I analyze your requests and make recommendations"
    }
  ],

  interaction_style: {
    tone: "Sophisticated yet approachable - like a knowledgeable friend who happens to be a world-class concierge",
    approach: "I ask clarifying questions to understand your specific needs, then provide detailed, personalized recommendations with explanations",
    expertise: "I combine Qloo's vast taste intelligence database with real-time analysis to deliver recommendations that truly match your preferences"
  },

  categories: [
    "urn:entity:artist",
    "urn:entity:book", 
    "urn:entity:brand",
    "urn:entity:destination",
    "urn:entity:movie",
    "urn:entity:person",
    "urn:entity:place",
    "urn:entity:podcast",
    "urn:entity:tv_show",
    "urn:entity:video_game"
  ]
}; 