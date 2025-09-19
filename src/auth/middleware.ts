// Authentication middleware
import { User, getUserBySession, extractSessionId } from './session';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

// Check if endpoint requires authentication
export function requiresAuth(pathname: string, method: string): boolean {
  // Endpoints that require authentication
  const protectedEndpoints = [
    '/wtm/api/calendar-progress', // POST, PUT, DELETE operations
    '/wtm/api/samsung-health/link',
    '/wtm/api/sync/samsung-health'
  ];

  // Auth endpoints don't require existing authentication
  if (pathname.startsWith('/wtm/api/auth/')) {
    return false;
  }

  // Check if this is a protected endpoint
  for (const endpoint of protectedEndpoints) {
    if (pathname === endpoint) {
      // For calendar-progress, only POST, PUT, DELETE require auth
      if (endpoint === '/wtm/api/calendar-progress') {
        return ['POST', 'PUT', 'DELETE'].includes(method);
      }
      return true;
    }
  }

  return false;
}

// Authenticate request and return user
export async function authenticateRequest(
  request: Request,
  db: any
): Promise<{ user: User | null; error?: string }> {
  const sessionId = extractSessionId(request);
  
  if (!sessionId) {
    return { user: null, error: 'No session found' };
  }

  const user = await getUserBySession(db, sessionId);
  
  if (!user) {
    return { user: null, error: 'Invalid or expired session' };
  }

  return { user };
}

// Create authentication error response
export function createAuthError(error: string): Response {
  return new Response(JSON.stringify({ 
    error: 'Authentication required',
    details: error 
  }), { 
    status: 401,
    headers: { 
      'content-type': 'application/json',
      'WWW-Authenticate': 'Bearer'
    }
  });
}

// Create session cookie
export function createSessionCookie(sessionId: string, secure: boolean = true): string {
  const maxAge = 30 * 24 * 60 * 60; // 30 days in seconds
  const securePart = secure ? '; Secure' : '';
  return `session=${sessionId}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}; Path=/${securePart}`;
}

// Create logout cookie (clears session)
export function createLogoutCookie(): string {
  return 'session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/';
}