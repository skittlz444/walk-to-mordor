import { createErrorResponse, createSuccessResponse } from "./validators";

// Authentication and session management utilities

export interface User {
  id: number;
  username: string;
  email: string;
  samsung_health_linked: boolean;
}

export interface UserRegistration {
  username: string;
  email: string;
  password: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface SessionData {
  user_id: number;
  username: string;
  expires_at: number;
}

// Generate a simple session token (in production, use a more secure method)
export function generateSessionToken(): string {
  return crypto.randomUUID();
}

// Hash password using Web Crypto API (best practice for Cloudflare Workers)
export async function hashPassword(password: string): Promise<string> {
  // Generate a random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltString = Array.from(salt, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Create password hash using PBKDF2 (recommended for password hashing)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + saltString);
  
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(saltString),
      iterations: 100000, // OWASP recommended minimum
      hash: 'SHA-256'
    },
    key,
    256
  );
  
  const hashArray = new Uint8Array(hashBuffer);
  const hashString = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
  
  // Return salt + hash format for storage
  return `${saltString}:${hashString}`;
}

// Verify password against stored hash
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    const [saltString, hash] = storedHash.split(':');
    if (!saltString || !hash) {
      return false;
    }
    
    // Create the same hash with the stored salt
    const encoder = new TextEncoder();
    
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    
    const hashBuffer = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: encoder.encode(saltString),
        iterations: 100000,
        hash: 'SHA-256'
      },
      key,
      256
    );
    
    const hashArray = new Uint8Array(hashBuffer);
    const computedHash = Array.from(hashArray, byte => byte.toString(16).padStart(2, '0')).join('');
    
    return computedHash === hash;
  } catch (error) {
    console.error('Password verification error:', error);
    return false;
  }
}

// Validate password strength
export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }
  
  return { valid: errors.length === 0, errors };
}

// Validate username
export function validateUsername(username: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (username.length < 3) {
    errors.push('Username must be at least 3 characters long');
  }
  
  if (username.length > 30) {
    errors.push('Username must be no more than 30 characters long');
  }
  
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.push('Username can only contain letters, numbers, and underscores');
  }
  
  return { valid: errors.length === 0, errors };
}

// Validate email
export function validateEmail(email: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  }
  
  return { valid: errors.length === 0, errors };
}

// Register new user
export async function registerUser(env: any, userData: UserRegistration): Promise<User | { error: string; errors?: string[] }> {
  try {
    // Validate input
    const usernameValidation = validateUsername(userData.username);
    const emailValidation = validateEmail(userData.email);
    const passwordValidation = validatePassword(userData.password);
    
    const allErrors = [
      ...usernameValidation.errors,
      ...emailValidation.errors,
      ...passwordValidation.errors
    ];
    
    if (allErrors.length > 0) {
      return { error: 'Validation failed', errors: allErrors };
    }
    
    // Check if username or email already exists
    const existingUser = await env.DB.prepare(
      `SELECT id FROM users WHERE username = ? OR email = ?`
    ).bind(userData.username, userData.email).first();
    
    if (existingUser) {
      return { error: 'Username or email already exists' };
    }
    
    // Hash password
    const passwordHash = await hashPassword(userData.password);
    
    // Create new user
    const result = await env.DB.prepare(
      `INSERT INTO users (username, email, password_hash, samsung_health_linked, created_at, updated_at)
       VALUES (?, ?, ?, FALSE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).bind(userData.username, userData.email, passwordHash).run();

    if (!result.success) {
      return { error: 'Failed to create user account' };
    }

    // Fetch the created user
    const newUser = await env.DB.prepare(
      `SELECT id, username, email, samsung_health_linked 
       FROM users 
       WHERE username = ?`
    ).bind(userData.username).first();

    return newUser as User;
  } catch (error) {
    console.error('Error registering user:', error);
    return { error: 'Internal server error during registration' };
  }
}

// Authenticate user with username/password
export async function authenticateUser(env: any, loginData: UserLogin): Promise<User | null> {
  try {
    // Find user by username
    const user = await env.DB.prepare(
      `SELECT id, username, email, password_hash, samsung_health_linked 
       FROM users 
       WHERE username = ?`
    ).bind(loginData.username).first();

    if (!user) {
      return null;
    }

    // Verify password
    const isValid = await verifyPassword(loginData.password, user.password_hash);
    if (!isValid) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      samsung_health_linked: user.samsung_health_linked
    } as User;
  } catch (error) {
    console.error('Error authenticating user:', error);
    return null;
  }
}

// Create a session for the user
export async function createSession(env: any, user: User): Promise<string | null> {
  try {
    const sessionToken = generateSessionToken();
    const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days

    // Store session in database
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
      `SELECT us.user_id, us.expires_at, u.username, u.email, u.samsung_health_linked
       FROM user_sessions us
       JOIN users u ON us.user_id = u.id
       WHERE us.token = ? AND us.expires_at > ?`
    ).bind(sessionToken, Date.now()).first();

    if (!sessionData) {
      return null;
    }

    return {
      id: sessionData.user_id,
      username: sessionData.username,
      email: sessionData.email,
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