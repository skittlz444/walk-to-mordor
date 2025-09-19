// OAuth provider integrations
import { User, createSession } from './session';

export interface OAuthProvider {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

// OAuth provider configurations
export function getOAuthProvider(provider: string, env: any): OAuthProvider | null {
  switch (provider) {
    case 'google':
      return {
        clientId: env.GOOGLE_CLIENT_ID || '',
        clientSecret: env.GOOGLE_CLIENT_SECRET || '',
        redirectUri: env.OAUTH_REDIRECT_URI || '',
        authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenUrl: 'https://oauth2.googleapis.com/token',
        userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo'
      };
    default:
      return null;
  }
}

// Generate OAuth authorization URL
export function generateAuthUrl(provider: OAuthProvider, state: string): string {
  const params = new URLSearchParams({
    client_id: provider.clientId,
    redirect_uri: provider.redirectUri,
    response_type: 'code',
    scope: provider.authUrl.includes('google') ? 'openid email profile' : 'email',
    state: state
  });
  
  return `${provider.authUrl}?${params.toString()}`;
}

// Exchange authorization code for access token
export async function exchangeCodeForToken(
  provider: OAuthProvider, 
  code: string
): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const response = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
        code: code,
        grant_type: 'authorization_code',
        redirect_uri: provider.redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      console.error('Token exchange failed:', await response.text());
      return null;
    }

    const data = await response.json() as any;
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
  } catch (error) {
    console.error('Error exchanging code for token:', error);
    return null;
  }
}

// Get user info from OAuth provider
export async function getUserInfo(provider: OAuthProvider, accessToken: string): Promise<{
  id: string;
  email: string;
  name?: string;
} | null> {
  try {
    const response = await fetch(provider.userInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Failed to get user info:', await response.text());
      return null;
    }

    const data = await response.json() as any;
    
    // Normalize response format between providers
    if (provider.userInfoUrl.includes('google')) {
      return {
        id: data.id,
        email: data.email,
        name: data.name
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user info:', error);
    return null;
  }
}

// Create or update user in database
export async function createOrUpdateUser(
  db: any,
  providerName: string,
  userInfo: { id: string; email: string; name?: string },
  accessToken: string,
  refreshToken?: string
): Promise<User | null> {
  try {
    // Check if user already exists
    const existingUser = await db.prepare(
      'SELECT * FROM users WHERE oauth_provider = ? AND oauth_provider_id = ?'
    ).bind(providerName, userInfo.id).first();

    if (existingUser) {
      // Update existing user
      await db.prepare(`
        UPDATE users 
        SET email = ?, name = ?, oauth_access_token = ?, oauth_refresh_token = ?, updated_at = datetime('now')
        WHERE id = ?
      `).bind(
        userInfo.email,
        userInfo.name || null,
        accessToken, // In production, this should be encrypted
        refreshToken || null, // In production, this should be encrypted
        existingUser.id
      ).run();

      return existingUser as User;
    } else {
      // Create new user
      const result = await db.prepare(`
        INSERT INTO users (email, name, oauth_provider, oauth_provider_id, oauth_access_token, oauth_refresh_token)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(
        userInfo.email,
        userInfo.name || null,
        providerName,
        userInfo.id,
        accessToken, // In production, this should be encrypted
        refreshToken || null // In production, this should be encrypted
      ).run();

      if (!result.success) {
        console.error('Failed to create user:', result.error);
        return null;
      }

      // Get the created user
      const newUser = await db.prepare(
        'SELECT * FROM users WHERE id = ?'
      ).bind(result.meta.last_row_id).first();

      return newUser as User;
    }
  } catch (error) {
    console.error('Error creating/updating user:', error);
    return null;
  }
}

// Complete OAuth flow
export async function completeOAuthFlow(
  db: any,
  providerName: string,
  code: string,
  env: any
): Promise<{ user: User; sessionId: string } | null> {
  const provider = getOAuthProvider(providerName, env);
  if (!provider) {
    return null;
  }

  // Exchange code for token
  const tokenResult = await exchangeCodeForToken(provider, code);
  if (!tokenResult) {
    return null;
  }

  // Get user info
  const userInfo = await getUserInfo(provider, tokenResult.access_token);
  if (!userInfo) {
    return null;
  }

  // Create or update user
  const user = await createOrUpdateUser(
    db,
    providerName,
    userInfo,
    tokenResult.access_token,
    tokenResult.refresh_token
  );
  if (!user) {
    return null;
  }

  // Create session
  const sessionId = await createSession(db, user.id);

  return { user, sessionId };
}