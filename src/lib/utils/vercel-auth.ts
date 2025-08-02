import { config } from '../config';

export interface VercelAuthOptions {
  token?: string;
  headers?: Record<string, string>;
}

export class VercelAuth {
  private token: string;

  constructor(options: VercelAuthOptions = {}) {
    this.token = options.token || config.vercelOidcToken;
  }

  /**
   * Get authentication headers for Vercel API requests
   */
  getAuthHeaders(): Record<string, string> {
    if (!this.token) {
      throw new Error('VERCEL_OIDC_TOKEN is required for Vercel authentication');
    }

    return {
      'Authorization': `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Make an authenticated request to Vercel API
   */
  async makeRequest(endpoint: string, options: RequestInit = {}): Promise<Response> {
    const headers = {
      ...this.getAuthHeaders(),
      ...options.headers,
    };

    const url = `https://api.vercel.com${endpoint}`;
    
    return fetch(url, {
      ...options,
      headers,
    });
  }

  /**
   * Get project information from Vercel
   */
  async getProject(projectId: string) {
    const response = await this.makeRequest(`/v9/projects/${projectId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get project: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get environment variables for a project
   */
  async getEnvironmentVariables(projectId: string, environment: string = 'production') {
    const response = await this.makeRequest(`/v9/projects/${projectId}/env?target=${environment}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get environment variables: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Create or update environment variable
   */
  async setEnvironmentVariable(
    projectId: string, 
    key: string, 
    value: string, 
    environment: string = 'production'
  ) {
    const response = await this.makeRequest(`/v9/projects/${projectId}/env`, {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        target: [environment],
        type: 'encrypted'
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Failed to set environment variable: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get deployment information
   */
  async getDeployment(deploymentId: string) {
    const response = await this.makeRequest(`/v13/deployments/${deploymentId}`);
    
    if (!response.ok) {
      throw new Error(`Failed to get deployment: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Get user information
   */
  async getUser() {
    const response = await this.makeRequest('/v2/user');
    
    if (!response.ok) {
      throw new Error(`Failed to get user: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Validate the OIDC token
   */
  async validateToken(): Promise<boolean> {
    try {
      await this.getUser();
      return true;
    } catch (error) {
      console.error('❌ Vercel OIDC token validation failed:', error);
      return false;
    }
  }
}

// Singleton instance
let vercelAuthInstance: VercelAuth | null = null;

export function getVercelAuth(): VercelAuth {
  if (!vercelAuthInstance) {
    vercelAuthInstance = new VercelAuth();
  }
  return vercelAuthInstance;
} 