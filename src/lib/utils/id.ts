// Utility function for generating unique IDs
let idCounter = 0;

export function generateUniqueId(): string {
  idCounter++;
  return `${Date.now()}-${idCounter}-${Math.random().toString(36).substr(2, 9)}`;
}

// Alternative function for generating IDs with a prefix
export function generateIdWithPrefix(prefix: string): string {
  return `${prefix}-${generateUniqueId()}`;
}

// Test function to verify uniqueness (for development only)
export function testUniqueIdGeneration(count: number = 10): string[] {
  const ids = new Set<string>();
  for (let i = 0; i < count; i++) {
    ids.add(generateUniqueId());
  }
  return Array.from(ids);
} 