// Samsung Health API integration utilities

export interface SamsungHealthStepData {
  date: string;
  steps: number;
  distance: number; // in meters
}

export interface SamsungHealthTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

// Convert Samsung Health authorization code to access token
export async function exchangeSamsungHealthCode(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<SamsungHealthTokens | null> {
  try {
    const response = await fetch('https://account.samsung.com/mobile/account/check.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      console.error('Samsung Health token exchange failed:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error exchanging Samsung Health code:', error);
    return null;
  }
}

// Refresh Samsung Health access token
export async function refreshSamsungHealthToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<SamsungHealthTokens | null> {
  try {
    const response = await fetch('https://account.samsung.com/mobile/account/check.do', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    });

    if (!response.ok) {
      console.error('Samsung Health token refresh failed:', response.status, response.statusText);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error refreshing Samsung Health token:', error);
    return null;
  }
}

// Fetch step data from Samsung Health for a specific date
export async function fetchSamsungHealthSteps(
  accessToken: string,
  date: string
): Promise<SamsungHealthStepData | null> {
  try {
    // Samsung Health Web API endpoint for step data
    const startTime = new Date(date + 'T00:00:00Z').getTime();
    const endTime = new Date(date + 'T23:59:59Z').getTime();
    
    const response = await fetch(
      `https://shealth.samsung.com/shealth-web-api/v1.0/steps/daily-totals?start_time=${startTime}&end_time=${endTime}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Samsung Health API request failed:', response.status, response.statusText);
      return null;
    }

    const data: any = await response.json();
    
    // Extract step count and calculate approximate distance
    if (data && data.data && data.data.length > 0) {
      const stepData = data.data[0];
      const steps = stepData.count || 0;
      // Rough approximation: 1 step ≈ 0.8 meters
      const distanceMeters = steps * 0.8;
      const distanceKm = distanceMeters / 1000;

      return {
        date: date,
        steps: steps,
        distance: Math.round(distanceKm * 100) / 100, // Round to 2 decimal places
      };
    }

    return {
      date: date,
      steps: 0,
      distance: 0,
    };
  } catch (error) {
    console.error('Error fetching Samsung Health data:', error);
    return null;
  }
}

// Store Samsung Health tokens for a user
export async function storeSamsungHealthTokens(
  env: any,
  userId: number,
  tokens: SamsungHealthTokens
): Promise<boolean> {
  try {
    // In a real app, encrypt these tokens before storing
    const result = await env.DB.prepare(
      `UPDATE users 
       SET samsung_health_token = ?, 
           samsung_health_refresh_token = ?, 
           samsung_health_linked = TRUE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(tokens.access_token, tokens.refresh_token || null, userId).run();

    return result.success;
  } catch (error) {
    console.error('Error storing Samsung Health tokens:', error);
    return false;
  }
}

// Get Samsung Health tokens for a user
export async function getSamsungHealthTokens(
  env: any,
  userId: number
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const result = await env.DB.prepare(
      `SELECT samsung_health_token, samsung_health_refresh_token 
       FROM users 
       WHERE id = ? AND samsung_health_linked = TRUE`
    ).bind(userId).first();

    if (!result || !result.samsung_health_token) {
      return null;
    }

    return {
      access_token: result.samsung_health_token,
      refresh_token: result.samsung_health_refresh_token || undefined,
    };
  } catch (error) {
    console.error('Error getting Samsung Health tokens:', error);
    return null;
  }
}

// Remove Samsung Health link for a user
export async function unlinkSamsungHealth(env: any, userId: number): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      `UPDATE users 
       SET samsung_health_token = NULL, 
           samsung_health_refresh_token = NULL, 
           samsung_health_linked = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(userId).run();

    return result.success;
  } catch (error) {
    console.error('Error unlinking Samsung Health:', error);
    return false;
  }
}

// Convert steps to approximate walking distance in kilometers
export function stepsToDistance(steps: number): number {
  // Average step length: 0.762 meters (2.5 feet)
  const metersPerStep = 0.762;
  const distanceMeters = steps * metersPerStep;
  const distanceKm = distanceMeters / 1000;
  return Math.round(distanceKm * 100) / 100; // Round to 2 decimal places
}