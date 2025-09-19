// Samsung Health API integration
import { User } from './session';

export interface SamsungHealthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface SamsungHealthStep {
  count: number;
  distance: number; // in meters
  start_time: string;
  end_time: string;
  day_time: string; // YYYY-MM-DD format
}

// Get Samsung Health configuration
export function getSamsungHealthConfig(env: any): SamsungHealthConfig {
  return {
    clientId: env.SAMSUNG_HEALTH_CLIENT_ID || '',
    clientSecret: env.SAMSUNG_HEALTH_CLIENT_SECRET || '',
    redirectUri: env.SAMSUNG_HEALTH_REDIRECT_URI || ''
  };
}

// Generate Samsung Health authorization URL
export function generateSamsungHealthAuthUrl(config: SamsungHealthConfig, state: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'com.samsung.health.step_daily_trend.read',
    state: state
  });
  
  return `https://account.samsung.com/accounts/v1/oauth2/authorize?${params.toString()}`;
}

// Exchange authorization code for Samsung Health access token
export async function exchangeSamsungHealthCode(
  config: SamsungHealthConfig,
  code: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const response = await fetch('https://account.samsung.com/accounts/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: config.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      console.error('Samsung Health token exchange failed:', await response.text());
      return null;
    }

    const data = await response.json() as any;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
  } catch (error) {
    console.error('Error exchanging Samsung Health code:', error);
    return null;
  }
}

// Link Samsung Health account to user
export async function linkSamsungHealthAccount(
  db: any,
  userId: number,
  accessToken: string,
  refreshToken: string
): Promise<boolean> {
  try {
    await db.prepare(`
      UPDATE users 
      SET samsung_health_access_token = ?, 
          samsung_health_refresh_token = ?, 
          samsung_health_linked_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      accessToken, // In production, this should be encrypted
      refreshToken, // In production, this should be encrypted
      userId
    ).run();

    return true;
  } catch (error) {
    console.error('Error linking Samsung Health account:', error);
    return false;
  }
}

// Refresh Samsung Health access token
export async function refreshSamsungHealthToken(
  config: SamsungHealthConfig,
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  try {
    const response = await fetch('https://account.samsung.com/accounts/v1/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }).toString(),
    });

    if (!response.ok) {
      console.error('Samsung Health token refresh failed:', await response.text());
      return null;
    }

    const data = await response.json() as any;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token || refreshToken // Some providers don't return new refresh token
    };
  } catch (error) {
    console.error('Error refreshing Samsung Health token:', error);
    return null;
  }
}

// Get step data from Samsung Health for a specific date
export async function getSamsungHealthStepData(
  accessToken: string,
  date: string // YYYY-MM-DD format
): Promise<SamsungHealthStep | null> {
  try {
    const startTime = `${date}T00:00:00.000Z`;
    const endTime = `${date}T23:59:59.999Z`;
    
    const response = await fetch('https://shealth.samsung.com/shealth/v3.0/users/me/activities/steps', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        start_time: startTime,
        end_time: endTime,
        time_type: 'DAY'
      })
    });

    if (!response.ok) {
      console.error('Failed to get Samsung Health step data:', await response.text());
      return null;
    }

    const data = await response.json() as any;
    
    if (!data.data || data.data.length === 0) {
      return null; // No data for this date
    }

    // Samsung Health returns step data with distance in meters
    const stepData = data.data[0];
    return {
      count: stepData.count || 0,
      distance: stepData.distance || 0, // in meters
      start_time: stepData.start_time,
      end_time: stepData.end_time,
      day_time: date
    };
  } catch (error) {
    console.error('Error getting Samsung Health step data:', error);
    return null;
  }
}

// Sync Samsung Health data for a specific date
export async function syncSamsungHealthData(
  db: any,
  user: User,
  date: string,
  config: SamsungHealthConfig
): Promise<{ success: boolean; distance?: number; error?: string }> {
  try {
    if (!user.samsung_health_access_token) {
      return { success: false, error: 'Samsung Health not linked' };
    }

    // Try to get step data with current token
    let stepData = await getSamsungHealthStepData(user.samsung_health_access_token, date);
    
    // If failed and we have refresh token, try refreshing
    if (!stepData && user.samsung_health_refresh_token) {
      const tokenResult = await refreshSamsungHealthToken(config, user.samsung_health_refresh_token);
      if (tokenResult) {
        // Update user's tokens
        await db.prepare(`
          UPDATE users 
          SET samsung_health_access_token = ?, 
              samsung_health_refresh_token = ?, 
              updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          tokenResult.access_token,
          tokenResult.refresh_token,
          user.id
        ).run();

        // Try again with new token
        stepData = await getSamsungHealthStepData(tokenResult.access_token, date);
      }
    }

    if (!stepData) {
      return { success: false, error: 'No Samsung Health data available for this date' };
    }

    // Convert distance from meters to kilometers
    const distanceKm = stepData.distance / 1000;

    // Check if entry already exists for this user and date
    const existingEntry = await db.prepare(
      'SELECT * FROM progress WHERE user_id = ? AND date = ?'
    ).bind(user.id, date).first();

    if (existingEntry) {
      // Update existing entry
      await db.prepare(`
        UPDATE progress 
        SET distance = ?, 
            synced_from_samsung = TRUE, 
            samsung_sync_date = datetime('now'),
            updated_at = datetime('now')
        WHERE user_id = ? AND date = ?
      `).bind(distanceKm, user.id, date).run();
    } else {
      // Create new entry
      await db.prepare(`
        INSERT INTO progress (date, distance, user_id, synced_from_samsung, samsung_sync_date)
        VALUES (?, ?, ?, TRUE, datetime('now'))
      `).bind(date, distanceKm, user.id).run();
    }

    return { success: true, distance: distanceKm };
  } catch (error) {
    console.error('Error syncing Samsung Health data:', error);
    return { success: false, error: 'Failed to sync data' };
  }
}