// Samsung Health API service for fetching walking distance data
import { createErrorResponse, createSuccessResponse } from "./validators";

export interface SamsungHealthUser {
  id: number;
  username: string;
  samsung_health_token?: string;
  samsung_health_refresh_token?: string;
  samsung_health_linked_at?: string;
}

export interface SamsungHealthDayData {
  date: string; // YYYY-MM-DD format
  distance: number; // in kilometers
}

export interface SamsungHealthLinkData {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

// Mock Samsung Health API for development/testing
// In production, this would connect to actual Samsung Health API
export class SamsungHealthService {
  private clientId: string;
  private clientSecret: string;

  constructor(clientId: string, clientSecret: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
  }

  // Generate authorization URL for Samsung Health OAuth
  generateAuthUrl(state: string, baseUrl: string = 'http://localhost:8787'): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      scope: 'sami:read_health_data',
      state: state,
      redirect_uri: `${baseUrl}/wtm/api/samsung-health/callback`
    });
    
    return `https://account.samsung.com/accounts/oauth/authorize?${params.toString()}`;
  }

  // Exchange authorization code for access token
  async exchangeCodeForTokens(authCode: string): Promise<SamsungHealthLinkData | null> {
    try {
      // Mock implementation - in production, this would call Samsung Health API
      if (authCode === 'mock_auth_code' || authCode.startsWith('test_')) {
        return {
          access_token: `mock_access_token_${Date.now()}`,
          refresh_token: `mock_refresh_token_${Date.now()}`,
          expires_in: 3600
        };
      }

      // In production, make actual API call:
      /*
      const response = await fetch('https://account.samsung.com/accounts/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code: authCode,
          redirect_uri: `${process.env.BASE_URL}/wtm/api/samsung-health/callback`
        })
      });

      if (!response.ok) {
        throw new Error(`Samsung Health API error: ${response.status}`);
      }

      return await response.json();
      */

      return null;
    } catch (error) {
      console.error('Error exchanging Samsung Health auth code:', error);
      return null;
    }
  }

  // Refresh access token
  async refreshAccessToken(refreshToken: string): Promise<SamsungHealthLinkData | null> {
    try {
      // Mock implementation
      if (refreshToken.startsWith('mock_refresh_token')) {
        return {
          access_token: `mock_access_token_${Date.now()}`,
          refresh_token: refreshToken, // Keep same refresh token
          expires_in: 3600
        };
      }

      // In production, make actual API call:
      /*
      const response = await fetch('https://account.samsung.com/accounts/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          refresh_token: refreshToken
        })
      });

      if (!response.ok) {
        throw new Error(`Samsung Health token refresh error: ${response.status}`);
      }

      return await response.json();
      */

      return null;
    } catch (error) {
      console.error('Error refreshing Samsung Health token:', error);
      return null;
    }
  }

  // Fetch walking distance data for a specific date
  async getWalkingDistance(accessToken: string, date: string): Promise<SamsungHealthDayData | null> {
    try {
      // Mock implementation - returns realistic walking distances
      if (accessToken.startsWith('mock_access_token')) {
        // Validate date format for mock
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          return null; // Invalid date format
        }
        
        const dateObj = new Date(date);
        if (isNaN(dateObj.getTime())) {
          return null; // Invalid date
        }
        
        const dayOfYear = Math.floor((dateObj.getTime() - new Date(dateObj.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        
        // Generate deterministic but realistic distance based on date
        const seed = dayOfYear % 10;
        const distances = [0, 2.5, 5.2, 3.8, 7.1, 4.6, 6.3, 1.9, 8.4, 2.7];
        const distance = distances[seed];

        return {
          date: date,
          distance: distance
        };
      }

      // In production, make actual API call:
      /*
      const startTime = new Date(date + 'T00:00:00.000Z').getTime();
      const endTime = new Date(date + 'T23:59:59.999Z').getTime();

      const response = await fetch(`https://api.samsunghealth.com/v3/users/me/activities/steps/aggregate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          start_time: startTime,
          end_time: endTime,
          group_by: 'day'
        })
      });

      if (!response.ok) {
        throw new Error(`Samsung Health API error: ${response.status}`);
      }

      const data = await response.json();
      
      // Convert steps to distance (rough approximation: 1300 steps = 1 km)
      const steps = data.step_count || 0;
      const distance = Math.round((steps / 1300) * 100) / 100; // Round to 2 decimal places

      return {
        date: date,
        distance: distance
      };
      */

      return null;
    } catch (error) {
      console.error('Error fetching Samsung Health walking data:', error);
      return null;
    }
  }

  // Revoke access token (unlink account)
  async revokeToken(accessToken: string): Promise<boolean> {
    try {
      // Mock implementation
      if (accessToken.startsWith('mock_access_token')) {
        return true;
      }

      // In production, make actual API call:
      /*
      const response = await fetch('https://account.samsung.com/accounts/oauth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          token: accessToken,
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      });

      return response.ok;
      */

      return false;
    } catch (error) {
      console.error('Error revoking Samsung Health token:', error);
      return false;
    }
  }
}

// Encryption utilities for storing Samsung Health tokens securely
export class TokenEncryption {
  private static key: CryptoKey | null = null;

  // Initialize encryption key (should be called once at startup)
  static async initializeKey(keyMaterial: string): Promise<void> {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(keyMaterial.padEnd(32, '0').substring(0, 32));
    
    this.key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM' },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt token
  static async encrypt(text: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption key not initialized');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      this.key,
      data
    );

    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  }

  // Decrypt token
  static async decrypt(encryptedText: string): Promise<string> {
    if (!this.key) {
      throw new Error('Encryption key not initialized');
    }

    // Convert from base64
    const combined = new Uint8Array(
      atob(encryptedText).split('').map(char => char.charCodeAt(0))
    );

    // Extract IV and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      this.key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  }
}