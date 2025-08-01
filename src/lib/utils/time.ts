// Utility function for consistent time formatting to prevent hydration mismatches
export function formatTimeConsistent(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  // Use a more stable format that doesn't change every second
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
    // Removed seconds to prevent hydration mismatches
  });
}

// Utility function for display-only time formatting (no seconds)
export function formatDisplayTime(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Utility function for consistent date formatting
export function formatDateConsistent(timestamp: string | Date): string {
  const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
} 