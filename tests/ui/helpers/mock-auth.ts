// Mock authentication utilities for testing only
// This module provides test-only authentication bypass for API tests

import { generateSalt } from '../../src/auth-utils';
import { createSuccessResponse, createErrorResponse } from '../../src/validators';

/**
 * Handle mock authentication for testing
 * Accepts tokens in format: TEST_MOCK_TOKEN or TEST_MOCK_TOKEN_username
 */
export async function handleMockAuth(authHeader: string, env: any): Promise<any> {
  if (!authHeader || !authHeader.startsWith('Bearer TEST_MOCK_TOKEN')) {
    return null; // Not a mock auth request
  }

  const token = authHeader.substring(7);
  let username = 'testuser';
  
  // Extract username from token if present (TEST_MOCK_TOKEN_username)
  if (token.startsWith('TEST_MOCK_TOKEN_')) {
    username = token.substring('TEST_MOCK_TOKEN_'.length);
  }

  try {
    // Check if test user exists
    const { results } = await env.DB.prepare(
      'SELECT id, username, email, approved FROM users WHERE username = ?'
    ).bind(username).all();
    
    let user;
    
    if (results.length === 0) {
      // Create test user
      const salt = await generateSalt();
      // Use dummy hash for test users to avoid CPU intensive PBKDF2 during tests
      const passwordHash = 'dummy_hash_for_testing';
      const result = await env.DB.prepare(
        'INSERT INTO users (username, email, password_hash, salt, approved) VALUES (?, ?, ?, ?, ?)'
      ).bind(username, `${username}@example.com`, passwordHash, salt, 1).run();
      
      user = {
        id: result.meta.last_row_id,
        username: username,
        email: `${username}@example.com`,
        approved: 1
      };
    } else {
      user = results[0];
    }
    
    return {
      userId: user.id,
      username: user.username,
      email: user.email,
      approved: user.approved
    };
  } catch (error) {
    console.error('Error handling mock auth:', error);
    throw error;
  }
}

/**
 * Validate mock session for testing
 * Returns validation result compatible with validateSession function
 */
export async function validateMockSession(authHeader: string, env: any): Promise<
  | { valid: true; userId: number }
  | { valid: false; error: Response }
  | null
> {
  if (!authHeader || !authHeader.startsWith('Bearer TEST_MOCK_TOKEN')) {
    return null; // Not a mock auth request
  }

  try {
    const user = await handleMockAuth(authHeader, env);
    if (user) {
      return { valid: true, userId: user.userId };
    }
    return { 
      valid: false, 
      error: createErrorResponse('Mock auth failed', 500) 
    };
  } catch (error) {
    console.error('Error validating mock session:', error);
    return { 
      valid: false, 
      error: createErrorResponse('Internal server error during mock auth', 500) 
    };
  }
}

/**
 * Get mock session info for testing
 * Returns session info compatible with handleSessionValidation function
 */
export async function getMockSessionInfo(authHeader: string, env: any): Promise<Response | null> {
  if (!authHeader || !authHeader.startsWith('Bearer TEST_MOCK_TOKEN')) {
    return null; // Not a mock auth request
  }

  try {
    const user = await handleMockAuth(authHeader, env);
    if (user) {
      return createSuccessResponse({
        userId: user.userId,
        username: user.username,
        email: user.email,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      }, 200);
    }
    return createErrorResponse('Mock auth failed', 500);
  } catch (error) {
    console.error('Error getting mock session info:', error);
    return createErrorResponse('Internal server error during mock auth', 500);
  }
}
