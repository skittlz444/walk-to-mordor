// Samsung Health API handlers
import { 
  SamsungHealthService, 
  TokenEncryption, 
  SamsungHealthUser,
  SamsungHealthDayData 
} from "./samsung-health-service";
import { createErrorResponse, createSuccessResponse, isValidDateFormat } from "./validators";

let samsungHealthService: SamsungHealthService | null = null;

// Initialize Samsung Health service with API keys
export function initializeSamsungHealthService(clientId: string, clientSecret: string, encryptionKey: string) {
  samsungHealthService = new SamsungHealthService(clientId, clientSecret);
  return TokenEncryption.initializeKey(encryptionKey);
}

// Get Samsung Health service instance
function getSamsungHealthService(): SamsungHealthService {
  if (!samsungHealthService) {
    // Use mock credentials for development
    samsungHealthService = new SamsungHealthService('mock_client_id', 'mock_client_secret');
  }
  return samsungHealthService;
}

// Generate Samsung Health authorization URL
export async function handleSamsungHealthAuthUrl(request: Request, env: any, user: {id: number, username: string}) {
  try {
    const service = getSamsungHealthService();
    const state = `user_${user.id}_${Date.now()}`;
    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.host}`;
    const authUrl = service.generateAuthUrl(state, baseUrl);

    return createSuccessResponse({
      authUrl: authUrl,
      state: state
    });
  } catch (error: any) {
    console.error('Error generating Samsung Health auth URL:', error);
    return createErrorResponse('Failed to generate authorization URL', 500);
  }
}

// Handle Samsung Health OAuth callback and link account
export async function handleSamsungHealthCallback(request: Request, env: any, body: any, user: {id: number, username: string}) {
  const { authCode, state } = body || {};

  if (!authCode) {
    return createErrorResponse('Missing authorization code', 400);
  }

  if (!state || !state.startsWith(`user_${user.id}_`)) {
    return createErrorResponse('Invalid or missing state parameter', 400);
  }

  try {
    const service = getSamsungHealthService();
    const tokenData = await service.exchangeCodeForTokens(authCode);

    if (!tokenData) {
      return createErrorResponse('Failed to exchange authorization code for tokens', 400);
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = await TokenEncryption.encrypt(tokenData.access_token);
    const encryptedRefreshToken = await TokenEncryption.encrypt(tokenData.refresh_token);

    // Store encrypted tokens in database
    await env.DB.prepare(`
      UPDATE users 
      SET samsung_health_token = ?, 
          samsung_health_refresh_token = ?, 
          samsung_health_linked_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(encryptedAccessToken, encryptedRefreshToken, user.id).run();

    return createSuccessResponse({
      message: 'Samsung Health account linked successfully',
      linkedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error linking Samsung Health account:', error);
    return createErrorResponse('Failed to link Samsung Health account', 500);
  }
}

// Unlink Samsung Health account
export async function handleSamsungHealthUnlink(request: Request, env: any, user: {id: number, username: string}) {
  try {
    // Get user's current Samsung Health tokens
    const userRecord = await env.DB.prepare(`
      SELECT samsung_health_token, samsung_health_refresh_token 
      FROM users 
      WHERE id = ?
    `).bind(user.id).first() as SamsungHealthUser | null;

    if (!userRecord?.samsung_health_token) {
      return createErrorResponse('Samsung Health account not linked', 400);
    }

    // Decrypt access token and revoke it
    try {
      const accessToken = await TokenEncryption.decrypt(userRecord.samsung_health_token);
      const service = getSamsungHealthService();
      await service.revokeToken(accessToken);
    } catch (error) {
      console.warn('Failed to revoke Samsung Health token, continuing with unlink:', error);
    }

    // Remove Samsung Health data from database
    await env.DB.prepare(`
      UPDATE users 
      SET samsung_health_token = NULL, 
          samsung_health_refresh_token = NULL, 
          samsung_health_linked_at = NULL,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(user.id).run();

    return createSuccessResponse({
      message: 'Samsung Health account unlinked successfully'
    });

  } catch (error: any) {
    console.error('Error unlinking Samsung Health account:', error);
    return createErrorResponse('Failed to unlink Samsung Health account', 500);
  }
}

// Get Samsung Health link status
export async function handleSamsungHealthStatus(request: Request, env: any, user: {id: number, username: string}) {
  try {
    const userRecord = await env.DB.prepare(`
      SELECT samsung_health_linked_at 
      FROM users 
      WHERE id = ?
    `).bind(user.id).first() as SamsungHealthUser | null;

    const isLinked = !!(userRecord?.samsung_health_linked_at);
    
    return createSuccessResponse({
      isLinked: isLinked,
      linkedAt: userRecord?.samsung_health_linked_at || null
    });

  } catch (error: any) {
    console.error('Error checking Samsung Health status:', error);
    return createErrorResponse('Failed to check Samsung Health status', 500);
  }
}

// Sync walking distance from Samsung Health for a specific date
export async function handleSamsungHealthSync(request: Request, env: any, body: any, user: {id: number, username: string}) {
  const { date } = body || {};

  if (!date || !isValidDateFormat(date)) {
    return createErrorResponse('Valid date (YYYY-MM-DD) is required', 400);
  }

  try {
    // Get user's Samsung Health tokens
    const userRecord = await env.DB.prepare(`
      SELECT samsung_health_token, samsung_health_refresh_token 
      FROM users 
      WHERE id = ?
    `).bind(user.id).first() as SamsungHealthUser | null;

    if (!userRecord?.samsung_health_token) {
      return createErrorResponse('Samsung Health account not linked', 400);
    }

    // Decrypt access token
    let accessToken: string;
    try {
      accessToken = await TokenEncryption.decrypt(userRecord.samsung_health_token);
    } catch (error) {
      console.error('Failed to decrypt Samsung Health token:', error);
      return createErrorResponse('Invalid Samsung Health token, please relink your account', 401);
    }

    // Fetch walking distance from Samsung Health
    const service = getSamsungHealthService();
    let walkingData = await service.getWalkingDistance(accessToken, date);

    // If API call failed with access token, try refreshing
    if (!walkingData && userRecord.samsung_health_refresh_token) {
      try {
        const refreshToken = await TokenEncryption.decrypt(userRecord.samsung_health_refresh_token);
        const newTokenData = await service.refreshAccessToken(refreshToken);
        
        if (newTokenData) {
          // Update stored tokens
          const newEncryptedAccessToken = await TokenEncryption.encrypt(newTokenData.access_token);
          await env.DB.prepare(`
            UPDATE users 
            SET samsung_health_token = ?, 
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(newEncryptedAccessToken, user.id).run();

          // Retry fetching data with new token
          walkingData = await service.getWalkingDistance(newTokenData.access_token, date);
        }
      } catch (refreshError) {
        console.error('Failed to refresh Samsung Health token:', refreshError);
      }
    }

    if (!walkingData) {
      return createErrorResponse('Failed to fetch walking data from Samsung Health', 503);
    }

    // Validate distance
    if (walkingData.distance < 0) {
      return createErrorResponse('Invalid distance data from Samsung Health', 400);
    }

    return createSuccessResponse({
      date: walkingData.date,
      distance: walkingData.distance,
      syncedAt: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Error syncing Samsung Health data:', error);
    return createErrorResponse('Failed to sync Samsung Health data', 500);
  }
}

// Helper function to refresh tokens when needed
async function refreshTokensIfNeeded(userRecord: SamsungHealthUser, env: any): Promise<string | null> {
  if (!userRecord.samsung_health_refresh_token) {
    return null;
  }

  try {
    const refreshToken = await TokenEncryption.decrypt(userRecord.samsung_health_refresh_token);
    const service = getSamsungHealthService();
    const newTokenData = await service.refreshAccessToken(refreshToken);
    
    if (newTokenData) {
      // Update stored tokens
      const newEncryptedAccessToken = await TokenEncryption.encrypt(newTokenData.access_token);
      const newEncryptedRefreshToken = await TokenEncryption.encrypt(newTokenData.refresh_token);
      
      await env.DB.prepare(`
        UPDATE users 
        SET samsung_health_token = ?, 
            samsung_health_refresh_token = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(newEncryptedAccessToken, newEncryptedRefreshToken, userRecord.id).run();

      return newTokenData.access_token;
    }

    return null;
  } catch (error) {
    console.error('Error refreshing Samsung Health tokens:', error);
    return null;
  }
}