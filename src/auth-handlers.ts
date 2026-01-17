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
  isSessionExpired,
  generatePasswordResetToken,
  getPasswordResetExpiry,
  isPasswordResetTokenExpired,
  generateEmailConfirmationToken,
  getEmailConfirmationExpiry,
  isEmailConfirmationTokenExpired
} from './auth-utils';
import { createErrorResponse, createSuccessResponse } from './validators';
import { sendPasswordResetEmail, sendConfirmationEmail } from './email-utils';

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

    // Insert new user (first user is automatically approved and verified)
    const result = await env.DB.prepare(
      'INSERT INTO users (username, email, password_hash, salt, approved, email_verified) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(username, email, passwordHash, salt, isFirstUser ? 1 : 1, isFirstUser ? 1 : 0).run();

    const userId = result.meta.last_row_id;

    // If this is the first user, link existing progress entries to them
    if (isFirstUser) {
      await env.DB.prepare(
        'UPDATE progress SET user_id = ? WHERE user_id IS NULL'
      ).bind(userId).run();
      
      return createSuccessResponse({
        message: 'Registration successful! You are the first user and have been automatically approved.',
        requiresApproval: false,
        username
      }, 201);
    }

    // For non-first users, generate email confirmation token and send email
    const token = generateEmailConfirmationToken();
    const expiresAt = getEmailConfirmationExpiry();

    await env.DB.prepare(
      'INSERT INTO email_confirmation_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(userId, token, expiresAt).run();

    // Send confirmation email
    const origin = new URL(request.url).origin;
    const confirmLink = `${origin}/api/auth/confirm-email?token=${token}`;
    const emailResult = await sendConfirmationEmail(env, email, confirmLink);

    if (!emailResult.success) {
      console.error('Failed to send confirmation email:', emailResult.error);
      // Continue anyway - user can request resend later
    }

    return createSuccessResponse({
      message: 'Account created! Please check your email to confirm your account.',
      requiresEmailConfirmation: true,
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
      'SELECT id, username, email, password_hash, salt, approved, email_verified FROM users WHERE username = ?'
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

    // Check if email is verified
    if (!user.email_verified) {
      return createErrorResponse('Email not verified. Please check your email for the confirmation link.', 403);
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
      
      // Validate username to prevent potential misuse
      if (!isValidUsername(username)) {
        return createErrorResponse('Invalid username format in test token', 400);
      }
      
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
        
        // Fetch the created user to ensure we have the correct ID
        const createdUser = await env.DB.prepare(
          'SELECT id, username, email, approved FROM users WHERE username = ?'
        ).bind(username).first();
        
        user = createdUser;
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
      
      // Validate username to prevent potential misuse
      if (!isValidUsername(username)) {
        return { 
          valid: false, 
          error: createErrorResponse('Invalid username format in test token', 400) 
        };
      }
      
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
        
        // Fetch the created user to ensure we have the correct ID
        const createdUser = await env.DB.prepare(
          'SELECT id, username, email, approved FROM users WHERE username = ?'
        ).bind(username).first();
        
        user = createdUser;
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

/**
 * Handle user profile update (username and/or email)
 */
export async function handleUpdateProfile(request: Request, env: any, body: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  const { username, email } = body || {};

  // At least one field must be provided
  if (!username && !email) {
    return createErrorResponse('At least one field (username or email) must be provided', 400);
  }

  // Validate username if provided
  if (username && !isValidUsername(username)) {
    return createErrorResponse('Invalid username. Must be 3-30 characters and contain only letters, numbers, and underscores', 400);
  }

  // Validate email if provided
  if (email && !isValidEmail(email)) {
    return createErrorResponse('Invalid email format', 400);
  }

  try {
    const userId = sessionValidation.userId;

    // Build update query dynamically based on provided fields
    const updates: string[] = [];
    const values: any[] = [];

    if (username) {
      updates.push('username = ?');
      values.push(username);
    }

    if (email) {
      updates.push('email = ?');
      values.push(email);
    }

    // Add updated_at timestamp
    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId); // Add userId for WHERE clause

    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    
    const result = await env.DB.prepare(query).bind(...values).run();

    if (result.meta.changes === 0) {
      return createErrorResponse('User not found', 404);
    }

    // Get updated user info
    const { results } = await env.DB.prepare(
      'SELECT id, username, email FROM users WHERE id = ?'
    ).bind(userId).all();

    const updatedUser = results[0] as any;

    return createSuccessResponse({
      message: 'Profile updated successfully',
      username: updatedUser.username,
      email: updatedUser.email
    }, 200);
  } catch (error: any) {
    console.error('Database error during profile update:', error);
    
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
    
    return createErrorResponse('Internal server error during profile update', 500);
  }
}

/**
 * Handle password reset request - generates a reset token
 */
export async function handlePasswordResetRequest(request: Request, env: any, body: any) {
  const { email } = body || {};

  // Validate required field
  if (!email) {
    return createErrorResponse('Missing required field: email', 400);
  }

  // Validate email format
  if (!isValidEmail(email)) {
    return createErrorResponse('Invalid email format', 400);
  }

  try {
    // Get user from database
    const { results } = await env.DB.prepare(
      'SELECT id, username, email FROM users WHERE email = ?'
    ).bind(email).all();

    // For security, return success even if user doesn't exist
    // This prevents email enumeration attacks
    if (results.length === 0) {
      return createSuccessResponse({
        message: 'If an account with that email exists, a password reset link has been sent to your email address.'
      }, 200);
    }

    const user = results[0] as any;

    // Rate limiting: Check recent reset requests (max 3 per hour)
    const { results: recentRequests } = await env.DB.prepare(
      `SELECT count(*) as count FROM password_reset_tokens 
       WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`
    ).bind(user.id).all();

    if (recentRequests && recentRequests[0] && (recentRequests[0] as any).count >= 3) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      // Return success to hide this failure to prevent enumeration
      return createSuccessResponse({
        message: 'If an account with that email exists, a password reset link has been sent to your email address.'
      }, 200);
    }

    // Cleanup expired/used tokens
    try {
      await env.DB.prepare(
        'DELETE FROM password_reset_tokens WHERE expires_at < ? OR used = 1'
      ).bind(new Date().toISOString()).run();
    } catch (cleanupError) {
      console.warn('Failed to cleanup expired tokens:', cleanupError);
      // Continue execution
    }

    // Generate reset token
    const token = generatePasswordResetToken();
    const expiresAt = getPasswordResetExpiry();

    // Store reset token in database
    await env.DB.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run();

    // Send password reset email
    const origin = new URL(request.url).origin;
    const emailResult = await sendPasswordResetEmail(
      env,
      user.email,
      user.username,
      token,
      origin
    );

    if (!emailResult.success) {
      console.error('Failed to send password reset email:', emailResult.error);
      // Still return success to prevent email enumeration
      // The token is stored in DB, so user can potentially reset via direct link if they have it
    }

    return createSuccessResponse({
      message: 'If an account with that email exists, a password reset link has been sent to your email address.'
    }, 200);
  } catch (error: any) {
    console.error('Database error during password reset request:', error);
    return createErrorResponse('Internal server error during password reset request', 500);
  }
}

/**
 * Handle password reset - verify token and set new password
 */
export async function handlePasswordReset(request: Request, env: any, body: any) {
  const { token, password } = body || {};

  // Validate required fields
  if (!token) {
    return createErrorResponse('Missing required field: token', 400);
  }
  if (!password) {
    return createErrorResponse('Missing required field: password', 400);
  }

  // Validate password
  const passwordValidation = isValidPassword(password);
  if (!passwordValidation.valid) {
    return createErrorResponse(passwordValidation.errors.join('; '), 400);
  }

  try {
    // Get token from database
    const { results } = await env.DB.prepare(
      'SELECT id, user_id, expires_at, used FROM password_reset_tokens WHERE token = ?'
    ).bind(token).all();

    if (results.length === 0) {
      return createErrorResponse('Invalid password reset token', 400);
    }

    const resetToken = results[0] as any;

    // Check if token has already been used
    if (resetToken.used) {
      return createErrorResponse('This password reset token has already been used', 400);
    }

    // Check if token is expired
    if (isPasswordResetTokenExpired(resetToken.expires_at)) {
      return createErrorResponse('This password reset token has expired', 400);
    }

    // Generate new salt and hash password
    const salt = await generateSalt();
    const passwordHash = await hashPassword(password, salt);

    // Update user's password
    await env.DB.prepare(
      'UPDATE users SET password_hash = ?, salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(passwordHash, salt, resetToken.user_id).run();

    // Mark token as used
    await env.DB.prepare(
      'UPDATE password_reset_tokens SET used = 1 WHERE id = ?'
    ).bind(resetToken.id).run();

    // Invalidate all existing sessions for this user (force re-login)
    await env.DB.prepare(
      'DELETE FROM sessions WHERE user_id = ?'
    ).bind(resetToken.user_id).run();

    return createSuccessResponse({
      message: 'Password has been reset successfully. Please log in with your new password.'
    }, 200);
  } catch (error: any) {
    console.error('Database error during password reset:', error);
    return createErrorResponse('Internal server error during password reset', 500);
  }
}

/**
 * Handle email confirmation - verify token and activate account
 */
export async function handleConfirmEmail(request: Request, env: any) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(
      'Missing confirmation token. Please use the link from your email.',
      { 
        status: 400,
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  }

  try {
    // Get token from database
    const { results } = await env.DB.prepare(
      'SELECT id, user_id, expires_at FROM email_confirmation_tokens WHERE token = ?'
    ).bind(token).all();

    if (results.length === 0) {
      return new Response(
        'Invalid or expired confirmation token. Please request a new confirmation email.',
        { 
          status: 400,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }

    const confirmToken = results[0] as any;

    // Check if token is expired
    if (isEmailConfirmationTokenExpired(confirmToken.expires_at)) {
      // Clean up expired token
      await env.DB.prepare(
        'DELETE FROM email_confirmation_tokens WHERE id = ?'
      ).bind(confirmToken.id).run();
      
      return new Response(
        'Confirmation token has expired. Please request a new confirmation email.',
        { 
          status: 400,
          headers: { 'Content-Type': 'text/plain' }
        }
      );
    }

    // Update user's email_verified status
    await env.DB.prepare(
      'UPDATE users SET email_verified = 1 WHERE id = ?'
    ).bind(confirmToken.user_id).run();

    // Delete used token
    await env.DB.prepare(
      'DELETE FROM email_confirmation_tokens WHERE id = ?'
    ).bind(confirmToken.id).run();

    // Redirect to login page with verified parameter
    const origin = new URL(request.url).origin;
    return Response.redirect(`${origin}/login.html?verified=true`, 302);
  } catch (error: any) {
    console.error('Database error during email confirmation:', error);
    return new Response(
      'Internal server error during email confirmation. Please try again later.',
      { 
        status: 500,
        headers: { 'Content-Type': 'text/plain' }
      }
    );
  }
}

/**
 * Handle resend confirmation email
 */
export async function handleResendConfirmation(request: Request, env: any, body: any) {
  const { email } = body || {};

  if (!email) {
    return createErrorResponse('Missing required field: email', 400);
  }

  if (!isValidEmail(email)) {
    return createErrorResponse('Invalid email format', 400);
  }

  try {
    // Get user from database
    const { results } = await env.DB.prepare(
      'SELECT id, username, email, email_verified FROM users WHERE email = ?'
    ).bind(email).all();

    // For security, return success even if user doesn't exist or is already verified
    // This prevents email enumeration attacks
    if (results.length === 0 || (results[0] as any).email_verified === 1) {
      return createSuccessResponse({
        message: 'If your email is registered and not yet verified, a new confirmation link has been sent.'
      }, 200);
    }

    const user = results[0] as any;

    // Rate limiting: Check recent confirmation requests (max 3 per hour)
    const { results: recentRequests } = await env.DB.prepare(
      `SELECT count(*) as count FROM email_confirmation_tokens 
       WHERE user_id = ? AND created_at > datetime('now', '-1 hour')`
    ).bind(user.id).all();

    if (recentRequests && recentRequests[0] && (recentRequests[0] as any).count >= 3) {
      console.warn(`Rate limit exceeded for user ${user.id}`);
      // Return success to hide this failure
      return createSuccessResponse({
        message: 'If your email is registered and not yet verified, a new confirmation link has been sent.'
      }, 200);
    }

    // Delete old confirmation tokens for this user
    await env.DB.prepare(
      'DELETE FROM email_confirmation_tokens WHERE user_id = ?'
    ).bind(user.id).run();

    // Generate new confirmation token
    const token = generateEmailConfirmationToken();
    const expiresAt = getEmailConfirmationExpiry();

    await env.DB.prepare(
      'INSERT INTO email_confirmation_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).bind(user.id, token, expiresAt).run();

    // Send confirmation email
    const origin = new URL(request.url).origin;
    const confirmLink = `${origin}/api/auth/confirm-email?token=${token}`;
    const emailResult = await sendConfirmationEmail(env, email, confirmLink);

    if (!emailResult.success) {
      console.error('Failed to send confirmation email:', emailResult.error);
    }

    return createSuccessResponse({
      message: 'If your email is registered and not yet verified, a new confirmation link has been sent.'
    }, 200);
  } catch (error: any) {
    console.error('Database error during resend confirmation:', error);
    return createErrorResponse('Internal server error during resend confirmation', 500);
  }
}
