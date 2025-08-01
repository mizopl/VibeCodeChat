export interface LocationInfo {
  query: string;
  city?: string;
  country?: string;
  region?: string;
  radius?: number;
  multipleLocalities?: string[];
}

export interface ExtractedLocation {
  primaryLocation: string;
  localities: string[];
  radius: number;
  confidence: number;
  reasoning: string;
}

// Common location patterns and their Qloo equivalents
const LOCATION_ALIASES: Record<string, string> = {
  // US Cities
  'the big apple': 'New York City',
  'nyc': 'New York City',
  'new york': 'New York City',
  'la': 'Los Angeles',
  'los angeles': 'Los Angeles',
  'sf': 'San Francisco',
  'san francisco': 'San Francisco',
  'chicago': 'Chicago',
  'miami': 'Miami',
  'las vegas': 'Las Vegas',
  'boston': 'Boston',
  'seattle': 'Seattle',
  'portland': 'Portland',
  'austin': 'Austin',
  'nashville': 'Nashville',
  
  // European Cities
  'paris': 'Paris',
  'london': 'London',
  'rome': 'Rome',
  'madrid': 'Madrid',
  'barcelona': 'Barcelona',
  'amsterdam': 'Amsterdam',
  'berlin': 'Berlin',
  'munich': 'Munich',
  'vienna': 'Vienna',
  'prague': 'Prague',
  'budapest': 'Budapest',
  'krakow': 'Krakow',
  'cracow': 'Krakow',
  'milan': 'Milan',
  'florence': 'Florence',
  'venice': 'Venice',
  'athens': 'Athens',
  'dublin': 'Dublin',
  'edinburgh': 'Edinburgh',
  
  // Asian Cities
  'tokyo': 'Tokyo',
  'osaka': 'Osaka',
  'kyoto': 'Kyoto',
  'seoul': 'Seoul',
  'beijing': 'Beijing',
  'shanghai': 'Shanghai',
  'hong kong': 'Hong Kong',
  'singapore': 'Singapore',
  'bangkok': 'Bangkok',
  'manila': 'Manila',
  'jakarta': 'Jakarta',
  'kuala lumpur': 'Kuala Lumpur',
  'mumbai': 'Mumbai',
  'delhi': 'Delhi',
  'bangalore': 'Bangalore',
  
  // Other Major Cities
  'sydney': 'Sydney',
  'melbourne': 'Melbourne',
  'toronto': 'Toronto',
  'vancouver': 'Vancouver',
  'montreal': 'Montreal',
  'mexico city': 'Mexico City',
  'sao paulo': 'São Paulo',
  'rio de janeiro': 'Rio de Janeiro',
  'buenos aires': 'Buenos Aires',
  'santiago': 'Santiago',
  'lima': 'Lima',
  'bogota': 'Bogotá',
  'cairo': 'Cairo',
  'nairobi': 'Nairobi',
  'lagos': 'Lagos',
  'johannesburg': 'Johannesburg',
  'cape town': 'Cape Town',
};

// Location extraction patterns
const LOCATION_PATTERNS = [
  // "in [location]"
  /\b(?:in|at|near|around)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // "[location] restaurants"
  /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:restaurants?|places?|spots?|venues?)/gi,
  // "restaurants in [location]"
  /(?:restaurants?|places?|spots?|venues?)\s+(?:in|at|near)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
  // "find [location]"
  /\b(?:find|search|look\s+for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi,
];

export function extractLocationFromQuery(userQuery: string): ExtractedLocation {
  const query = userQuery.toLowerCase();
  let primaryLocation = '';
  let localities: string[] = [];
  let radius = 10; // Default radius for nearby entities
  let confidence = 0.5;
  let reasoning = '';

  // Check for explicit location mentions
  for (const pattern of LOCATION_PATTERNS) {
    const matches = [...userQuery.matchAll(pattern)];
    for (const match of matches) {
      const location = match[1]?.trim();
      if (location && location.length > 2) {
        primaryLocation = location;
        localities.push(location);
        confidence = 0.8;
        reasoning = `Found location mention: "${location}"`;
        break;
      }
    }
    if (primaryLocation) break;
  }

  // Check for location aliases
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (query.includes(alias)) {
      primaryLocation = canonical;
      localities = [canonical];
      confidence = 0.9;
      reasoning = `Matched location alias: "${alias}" → "${canonical}"`;
      break;
    }
  }

  // Check for strict boundary requests
  if (query.includes('strict') || query.includes('exact') || query.includes('only')) {
    radius = 0;
    reasoning += ' (strict boundaries requested)';
  }

  // Check for broader area requests
  if (query.includes('nearby') || query.includes('around') || query.includes('surrounding')) {
    radius = 25;
    reasoning += ' (broader area requested)';
  }

  // Multiple localities detection
  const multipleLocalityMatches = query.match(/\b(?:and|or|,\s*)\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi);
  if (multipleLocalityMatches && primaryLocation) {
    for (const match of multipleLocalityMatches) {
      const additionalLocation = match.replace(/\b(?:and|or|,)\s*/gi, '').trim();
      if (additionalLocation && additionalLocation !== primaryLocation) {
        localities.push(additionalLocation);
        reasoning += ` + additional locality: "${additionalLocation}"`;
      }
    }
  }

  // Fallback: try to extract any capitalized location-like terms
  if (!primaryLocation) {
    const potentialLocations = query.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g);
    if (potentialLocations) {
      // Filter out common non-location words
      const nonLocationWords = ['find', 'search', 'look', 'for', 'restaurants', 'places', 'food', 'pizza', 'coffee', 'bars'];
      const filteredLocations = potentialLocations.filter(loc => 
        !nonLocationWords.includes(loc.toLowerCase()) && loc.length > 2
      );
      
      if (filteredLocations.length > 0) {
        primaryLocation = filteredLocations[0];
        localities = [primaryLocation];
        confidence = 0.4;
        reasoning = `Fallback location extraction: Found potential location "${primaryLocation}" (low confidence - using pattern matching)`;
      }
    }
  }

  return {
    primaryLocation,
    localities: [...new Set(localities)], // Remove duplicates
    radius,
    confidence,
    reasoning: reasoning || 'No location detected'
  };
}

export function buildLocationFilter(location: ExtractedLocation): Record<string, any> {
  const filter: Record<string, any> = {};
  
  if (!location.primaryLocation) {
    return filter;
  }

  // Set location query
  if (location.localities.length === 1) {
    filter['filter.location.query'] = location.primaryLocation;
  } else if (location.localities.length > 1) {
    filter['filter.location.query'] = location.localities;
  }

  // Set radius if not default
  if (location.radius !== 10) {
    filter['filter.location.radius'] = location.radius;
  }

  return filter;
}

export function validateLocation(location: string): boolean {
  // Basic validation - check if it looks like a location
  const locationPattern = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*$/;
  return locationPattern.test(location) && location.length > 2;
}

export function getLocationSuggestions(partialLocation: string): string[] {
  const suggestions: string[] = [];
  const partial = partialLocation.toLowerCase();
  
  for (const [alias, canonical] of Object.entries(LOCATION_ALIASES)) {
    if (alias.includes(partial) || canonical.toLowerCase().includes(partial)) {
      suggestions.push(canonical);
    }
  }
  
  return suggestions.slice(0, 5); // Limit to 5 suggestions
} 