// Authentication API handlers
import { 
  generateSalt, 
  hashPassword, 
  verifyPassword, 
  isValidEmail, 
  isValidUsername, 
  isValidPassword,
  createSession,
  destroySession,
  getUserFromSession,
  cleanupExpiredSessions
} from "./auth-utils";
import { createErrorResponse, createSuccessResponse } from "./validators";

// Register new user
export async function handleRegister(request: Request, env: any, body: any) {
  const { username, email, password } = body || {};
  
  // Validate required fields
  if (!username || !email || !password) {
    return createErrorResponse('Missing required fields: username, email, password', 400);
  }
  
  // Validate input formats
  if (!isValidUsername(username)) {
    return createErrorResponse('Invalid username. Must be 3-20 characters, alphanumeric, underscores, or hyphens only', 400);
  }
  
  if (!isValidEmail(email)) {
    return createErrorResponse('Invalid email format', 400);
  }
  
  if (!isValidPassword(password)) {
    return createErrorResponse('Invalid password. Must be at least 8 characters and contain both letters and numbers', 400);
  }
  
  try {
    // Check if username or email already exists
    const existingUser = await env.DB.prepare(`
      SELECT id FROM users WHERE username = ? OR email = ?
    `).bind(username, email).first();
    
    if (existingUser) {
      return createErrorResponse('Username or email already exists', 409);
    }
    
    // Hash password
    const salt = generateSalt();
    const passwordHash = await hashPassword(password, salt);
    
    // Create user
    const result = await env.DB.prepare(`
      INSERT INTO users (username, email, password_hash, salt)
      VALUES (?, ?, ?, ?)
    `).bind(username, email, passwordHash, salt).run();
    
    const userId = result.meta.last_row_id;
    
    // Create session
    const sessionId = await createSession(userId as number, env);
    
    return new Response(JSON.stringify({
      message: 'User registered successfully',
      user: { id: userId, username, email },
      sessionId
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${sessionId}; HttpOnly; SameSite=Strict; Max-Age=604800; Path=/` // 7 days
      }
    });
    
  } catch (error: any) {
    console.error('Registration error:', error);
    return createErrorResponse('Internal server error during registration', 500);
  }
}

// Login user
export async function handleLogin(request: Request, env: any, body: any) {
  const { username, password } = body || {};
  
  // Validate required fields
  if (!username || !password) {
    return createErrorResponse('Missing required fields: username, password', 400);
  }
  
  try {
    // Clean up expired sessions first
    await cleanupExpiredSessions(env);
    
    // Find user by username or email
    const user = await env.DB.prepare(`
      SELECT id, username, email, password_hash, salt 
      FROM users 
      WHERE username = ? OR email = ?
    `).bind(username, username).first();
    
    if (!user) {
      return createErrorResponse('Invalid username or password', 401);
    }
    
    // Verify password
    const isValidPassword = await verifyPassword(password, user.password_hash, user.salt);
    if (!isValidPassword) {
      return createErrorResponse('Invalid username or password', 401);
    }
    
    // Create session
    const sessionId = await createSession(user.id, env);
    
    return new Response(JSON.stringify({
      message: 'Login successful',
      user: { id: user.id, username: user.username, email: user.email },
      sessionId
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `session=${sessionId}; HttpOnly; SameSite=Strict; Max-Age=604800; Path=/` // 7 days
      }
    });
    
  } catch (error: any) {
    console.error('Login error:', error);
    return createErrorResponse('Internal server error during login', 500);
  }
}

// Logout user
export async function handleLogout(request: Request, env: any) {
  const sessionId = getSessionFromRequest(request);
  
  if (sessionId) {
    try {
      await destroySession(sessionId, env);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
  
  return new Response(JSON.stringify({
    message: 'Logout successful'
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/' // Clear cookie
    }
  });
}

// Get current user info
export async function handleMe(request: Request, env: any) {
  const sessionId = getSessionFromRequest(request);
  
  if (!sessionId) {
    return createErrorResponse('Not authenticated', 401);
  }
  
  try {
    const user = await getUserFromSession(sessionId, env);
    
    if (!user) {
      return createErrorResponse('Session invalid or expired', 401);
    }
    
    return createSuccessResponse({
      user: { id: user.id, username: user.username, email: user.email }
    });
    
  } catch (error: any) {
    console.error('Me endpoint error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

// Password reset request (simplified - just returns success for now)
export async function handlePasswordResetRequest(request: Request, env: any, body: any) {
  const { email } = body || {};
  
  if (!email) {
    return createErrorResponse('Missing required field: email', 400);
  }
  
  if (!isValidEmail(email)) {
    return createErrorResponse('Invalid email format', 400);
  }
  
  // In a real implementation, you would:
  // 1. Check if email exists
  // 2. Generate a reset token
  // 3. Send reset email
  // For now, we'll just return success to prevent email enumeration
  
  return createSuccessResponse({
    message: 'If an account with that email exists, a password reset link has been sent'
  });
}

// Extract session ID from request cookies
function getSessionFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return cookies.session || null;
}

// Authentication middleware - check if user is authenticated
export async function requireAuth(request: Request, env: any): Promise<{id: number, username: string, email: string} | Response> {
  const sessionId = getSessionFromRequest(request);
  
  if (!sessionId) {
    return createErrorResponse('Authentication required', 401);
  }
  
  try {
    const user = await getUserFromSession(sessionId, env);
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Session invalid or expired' }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'session=; HttpOnly; SameSite=Strict; Max-Age=0; Path=/' // Clear invalid session
        }
      });
    }
    
    return user;
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    return createErrorResponse('Internal server error', 500);
  }
}

// Re-export for convenience
export { getUserFromSession } from "./auth-utils";