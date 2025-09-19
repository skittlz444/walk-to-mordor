// Session management utilities for authentication

export interface User {
  id: number;
  email: string;
  name?: string;
  oauth_provider: string;
  oauth_provider_id: string;
  oauth_access_token?: string;
  oauth_refresh_token?: string;
  samsung_health_access_token?: string;
  samsung_health_refresh_token?: string;
  samsung_health_linked_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  created_at: string;
  expires_at: string;
  last_used_at: string;
}

// Generate a secure session ID (UUID v4)
export function generateSessionId(): string {
  return crypto.randomUUID();
}

// Create a new session for a user
export async function createSession(db: any, userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days from now
  
  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt.toISOString()).run();
  
  return sessionId;
}

// Get user by session ID
export async function getUserBySession(db: any, sessionId: string): Promise<User | null> {
  if (!sessionId) return null;
  
  const result = await db.prepare(`
    SELECT u.* FROM users u
    INNER JOIN sessions s ON u.id = s.user_id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionId).first();
  
  if (!result) return null;
  
  // Update last_used_at
  await db.prepare(
    'UPDATE sessions SET last_used_at = datetime(\'now\') WHERE id = ?'
  ).bind(sessionId).run();
  
  return result as User;
}

// Delete a session (logout)
export async function deleteSession(db: any, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

// Clean up expired sessions
export async function cleanupExpiredSessions(db: any): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE expires_at <= datetime(\'now\')').run();
}

// Extract session ID from request headers (cookie or Authorization header)
export function extractSessionId(request: Request): string | null {
  // Try Authorization header first (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Try cookie
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('session=')) {
        return cookie.substring(8);
      }
    }
  }
  
  return null;
}