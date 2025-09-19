import { createErrorResponse, createSuccessResponse } from "./validators";

// Authentication and session management utilities

export interface User {
  id: number;
  email: string;
  oauth_provider: string;
  oauth_id: string;
  samsung_health_linked: boolean;
}

export interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  picture: string;
}

export interface SessionData {
  user_id: number;
  email: string;
  expires_at: number;
}

// Generate a simple session token (in production, use a more secure method)
export function generateSessionToken(): string {
  return crypto.randomUUID();
}

// Verify Google OAuth token and get user info
export async function verifyGoogleToken(token: string): Promise<GoogleUserInfo | null> {
  try {
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/userinfo?access_token=${token}`);
    if (!response.ok) {
      return null;
    }
    return await response.json();
  } catch {
    return null;
  }
}

// Get or create user from Google OAuth data
export async function getOrCreateUser(env: any, googleUser: GoogleUserInfo): Promise<User | null> {
  try {
    // First, try to find existing user
    const existing = await env.DB.prepare(
      `SELECT id, email, oauth_provider, oauth_id, samsung_health_linked 
       FROM users 
       WHERE oauth_provider = 'google' AND oauth_id = ?`
    ).bind(googleUser.id).first();

    if (existing) {
      return existing as User;
    }

    // Create new user
    const result = await env.DB.prepare(
      `INSERT INTO users (email, oauth_provider, oauth_id, samsung_health_linked, created_at, updated_at)
       VALUES (?, 'google', ?, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(googleUser.email, googleUser.id).run();

    if (!result.success) {
      return null;
    }

    // Fetch the created user
    const newUser = await env.DB.prepare(
      `SELECT id, email, oauth_provider, oauth_id, samsung_health_linked 
       FROM users 
       WHERE oauth_provider = 'google' AND oauth_id = ?`
    ).bind(googleUser.id).first();

    return newUser as User;
  } catch (error) {
    console.error('Error getting or creating user:', error);
    return null;
  }
}

// Create a session for the user
export async function createSession(env: any, user: User): Promise<string | null> {
  try {
    const sessionToken = generateSessionToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session in KV (we'll use D1 for now since KV not configured)
    // In a real app, use Cloudflare KV or similar for session storage
    await env.DB.prepare(
      `INSERT OR REPLACE INTO user_sessions (token, user_id, expires_at, created_at)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
    ).bind(sessionToken, user.id, expiresAt).run();

    return sessionToken;
  } catch (error) {
    console.error('Error creating session:', error);
    return null;
  }
}

// Get user from session token
export async function getUserFromSession(env: any, sessionToken: string): Promise<User | null> {
  try {
    const sessionData = await env.DB.prepare(
      `SELECT us.user_id, us.expires_at, u.email, u.oauth_provider, u.oauth_id, u.samsung_health_linked
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.token = ? AND us.expires_at > ?`
    ).bind(sessionToken, Date.now()).first();

    if (!sessionData) {
      return null;
    }

    return {
      id: sessionData.user_id,
      email: sessionData.email,
      oauth_provider: sessionData.oauth_provider,
      oauth_id: sessionData.oauth_id,
      samsung_health_linked: sessionData.samsung_health_linked
    } as User;
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

// Delete a session (logout)
export async function deleteSession(env: any, sessionToken: string): Promise<boolean> {
  try {
    const result = await env.DB.prepare(
      `DELETE FROM user_sessions WHERE token = ?`
    ).bind(sessionToken).run();
    
    return result.success;
  } catch (error) {
    console.error('Error deleting session:', error);
    return false;
  }
}

// Get session token from request (cookie or header)
export function getSessionToken(request: Request): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Check cookies
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === 'session_token') {
        return value;
      }
    }
  }

  return null;
}

// Middleware to require authentication
export async function requireAuth(env: any, request: Request): Promise<{ user: User } | Response> {
  const sessionToken = getSessionToken(request);
  
  if (!sessionToken) {
    return createErrorResponse('Authentication required', 401);
  }

  const user = await getUserFromSession(env, sessionToken);
  if (!user) {
    return createErrorResponse('Invalid or expired session', 401);
  }

  return { user };
}

// Create session cookie response
export function createSessionCookie(sessionToken: string, maxAge: number = 7 * 24 * 60 * 60): string {
  return `session_token=${sessionToken}; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}; Path=/`;
}

// Create logout cookie response
export function createLogoutCookie(): string {
  return `session_token=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/`;
}