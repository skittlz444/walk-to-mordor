// Authentication API handlers
import {
  generateSalt,
  hashPassword,
  verifyPassword,
  generateSessionId,
  isValidEmail,
  isValidPassword,
  isValidUsername,
  getSessionExpiry,
  isSessionExpired
} from './auth-utils';
import { createErrorResponse, createSuccessResponse } from './validators';

/**
 * Handle user registration
 */
export async function handleRegister(request: Request, env: any, body: any) {
  const { username, email, password } = body || {};

  // Validate required fields
  if (!username) {
    return createErrorResponse('Missing required field: username', 400);
  }
  if (!email) {
    return createErrorResponse('Missing required field: email', 400);
  }
  if (!password) {
    return createErrorResponse('Missing required field: password', 400);
  }

  // Validate username
  if (!isValidUsername(username)) {
    return createErrorResponse('Invalid username. Must be 3-30 characters and contain only letters, numbers, and underscores', 400);
  }

  // Validate email
  if (!isValidEmail(email)) {
    return createErrorResponse('Invalid email format', 400);
  }

  // Validate password
  const passwordValidation = isValidPassword(password);
  if (!passwordValidation.valid) {
    return createErrorResponse(passwordValidation.errors.join('; '), 400);
  }

  try {
    // Check if this is the first user
    const { results: existingUsers } = await env.DB.prepare(
      'SELECT COUNT(*) as count FROM users'
    ).all();
    const isFirstUser = existingUsers[0].count === 0;

    // Generate salt and hash password
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Insert new user (first user is automatically approved)
    const result = await env.DB.prepare(
      'INSERT INTO users (username, email, password_hash, salt, approved) VALUES (?, ?, ?, ?, ?)'
    ).bind(username, email, passwordHash, salt, isFirstUser ? 1 : 0).run();

    // If this is the first user, link existing progress entries to them
    if (isFirstUser) {
      await env.DB.prepare(
        'UPDATE progress SET user_id = ? WHERE user_id IS NULL'
      ).bind(result.meta.last_row_id).run();
    }

    return createSuccessResponse({
      message: isFirstUser 
        ? 'Registration successful! You are the first user and have been automatically approved.'
        : 'Registration successful! Please wait for approval from the site owner before you can access the application.',
      requiresApproval: !isFirstUser,
      username
    }, 201);
  } catch (error: any) {
    console.error('Database error during registration:', error);
    
    // Handle unique constraint violations
    if (error.message?.includes('UNIQUE constraint') || 
        error.cause?.message?.includes('UNIQUE constraint')) {
      if (error.message?.includes('username') || error.cause?.message?.includes('username')) {
        return createErrorResponse('Username already exists', 409);
      }
      if (error.message?.includes('email') || error.cause?.message?.includes('email')) {
        return createErrorResponse('Email already registered', 409);
      }
      return createErrorResponse('Username or email already exists', 409);
    }
    
    return createErrorResponse('Internal server error during registration', 500);
  }
}

/**
 * Handle user login
 */
export async function handleLogin(request: Request, env: any, body: any) {
  const { username, password } = body || {};

  // Validate required fields
  if (!username) {
    return createErrorResponse('Missing required field: username', 400);
  }
  if (!password) {
    return createErrorResponse('Missing required field: password', 400);
  }

  try {
    // Get user from database
    const { results } = await env.DB.prepare(
      'SELECT id, username, email, password_hash, salt, approved FROM users WHERE username = ?'
    ).bind(username).all();

    if (results.length === 0) {
      return createErrorResponse('Invalid username or password', 401);
    }

    const user = results[0] as any;

    // Verify password
    const passwordValid = await verifyPassword(password, user.salt, user.password_hash);
    if (!passwordValid) {
      return createErrorResponse('Invalid username or password', 401);
    }

    // Check if user is approved
    if (!user.approved) {
      return createErrorResponse('Your account is pending approval by the site owner', 403);
    }

    // Create session
    const sessionId = generateSessionId();
    const expiresAt = getSessionExpiry();

    await env.DB.prepare(
      'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
    ).bind(sessionId, user.id, expiresAt).run();

    return createSuccessResponse({
      message: 'Login successful',
      sessionId,
      expiresAt,
      username: user.username,
      email: user.email
    }, 200);
  } catch (error: any) {
    console.error('Database error during login:', error);
    return createErrorResponse('Internal server error during login', 500);
  }
}

/**
 * Handle user logout
 */
export async function handleLogout(request: Request, env: any, body: any) {
  const { sessionId } = body || {};

  if (!sessionId) {
    return createErrorResponse('Missing required field: sessionId', 400);
  }

  try {
    const result = await env.DB.prepare(
      'DELETE FROM sessions WHERE id = ?'
    ).bind(sessionId).run();

    if (result.meta.changes === 0) {
      return createErrorResponse('Session not found', 404);
    }

    return createSuccessResponse({ message: 'Logout successful' }, 200);
  } catch (error: any) {
    console.error('Database error during logout:', error);
    return createErrorResponse('Internal server error during logout', 500);
  }
}

/**
 * Validate session and return user info
 */
export async function handleSessionValidation(request: Request, env: any) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return createErrorResponse('Missing or invalid authorization header', 401);
  }

  const sessionId = authHeader.substring(7);

  // Mock Authentication (TEST ONLY) - Guarded by environment variable
  if (env.ALLOW_TEST_AUTH === 'true' && sessionId.startsWith('TEST_MOCK_TOKEN_')) {
    try {
      const username = sessionId.replace('TEST_MOCK_TOKEN_', '');
      
      // Check if user exists
      let { results } = await env.DB.prepare(
        'SELECT id, username, email, approved FROM users WHERE username = ?'
      ).bind(username).all();

      let user;
      if (results.length === 0) {
        // Create test user
        const salt = 'test_salt';
        const passwordHash = 'dummy_hash_for_testing'; // Optimized for tests
        
        const result = await env.DB.prepare(
          'INSERT INTO users (username, email, password_hash, salt, approved) VALUES (?, ?, ?, ?, 1)'
        ).bind(username, `${username}@example.com`, passwordHash, salt).run();
        
        user = {
          id: result.meta.last_row_id,
          username,
          email: `${username}@example.com`,
          approved: 1
        };
      } else {
        user = results[0];
      }

      return createSuccessResponse({
        userId: user.id,
        username: user.username,
        email: user.email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
      }, 200);
    } catch (error: any) {
      console.error('Database error during mock auth:', error);
      return createErrorResponse('Internal server error during mock auth', 500);
    }
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT s.id, s.expires_at, u.id as user_id, u.username, u.email, u.approved FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?'
    ).bind(sessionId).all();

    if (results.length === 0) {
      return createErrorResponse('Invalid session', 401);
    }

    const session = results[0] as any;

    // Check if session is expired
    if (isSessionExpired(session.expires_at)) {
      // Delete expired session
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      return createErrorResponse('Session expired', 401);
    }

    // Check if user is still approved
    if (!session.approved) {
      return createErrorResponse('User account is no longer approved', 403);
    }

    return createSuccessResponse({
      userId: session.user_id,
      username: session.username,
      email: session.email,
      expiresAt: session.expires_at
    }, 200);
  } catch (error: any) {
    console.error('Database error during session validation:', error);
    return createErrorResponse('Internal server error during session validation', 500);
  }
}

/**
 * Middleware to extract and validate session from request
 */
export async function validateSession(request: Request, env: any): Promise<
  | { valid: true; userId: number }
  | { valid: false; error: Response }
> {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { 
      valid: false, 
      error: createErrorResponse('Missing or invalid authorization header', 401) 
    };
  }

  const sessionId = authHeader.substring(7);

  // Mock Authentication (TEST ONLY) - Guarded by environment variable
  if (env.ALLOW_TEST_AUTH === 'true' && sessionId.startsWith('TEST_MOCK_TOKEN_')) {
    try {
      const username = sessionId.replace('TEST_MOCK_TOKEN_', '');
      
      // Check if user exists
      let { results } = await env.DB.prepare(
        'SELECT id, username, email, approved FROM users WHERE username = ?'
      ).bind(username).all();

      let user;
      if (results.length === 0) {
        // Create test user
        const salt = 'test_salt';
        const passwordHash = 'dummy_hash_for_testing'; // Optimized for tests
        
        const result = await env.DB.prepare(
          'INSERT INTO users (username, email, password_hash, salt, approved) VALUES (?, ?, ?, ?, 1)'
        ).bind(username, `${username}@example.com`, passwordHash, salt).run();
        
        user = {
          id: result.meta.last_row_id,
          username,
          email: `${username}@example.com`,
          approved: 1
        };
      } else {
        user = results[0];
      }

      return { valid: true, userId: user.id };
    } catch (error: any) {
      console.error('Database error during mock auth:', error);
      return { 
        valid: false, 
        error: createErrorResponse('Internal server error during mock auth', 500) 
      };
    }
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT s.id, s.expires_at, u.id as user_id, u.approved FROM sessions s JOIN users u ON s.user_id = u.id WHERE s.id = ?'
    ).bind(sessionId).all();

    if (results.length === 0) {
      return { 
        valid: false, 
        error: createErrorResponse('Invalid session', 401) 
      };
    }

    const session = results[0] as any;

    // Check if session is expired
    if (isSessionExpired(session.expires_at)) {
      await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      return { 
        valid: false, 
        error: createErrorResponse('Session expired', 401) 
      };
    }

    // Check if user is approved
    if (!session.approved) {
      return { 
        valid: false, 
        error: createErrorResponse('User account is no longer approved', 403) 
      };
    }

    return { valid: true, userId: session.user_id };
  } catch (error: any) {
    console.error('Database error during session validation:', error);
    return { 
      valid: false, 
      error: createErrorResponse('Internal server error during session validation', 500) 
    };
  }
}
