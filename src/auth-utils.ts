// Authentication utilities for password hashing and session management
import { createErrorResponse, createSuccessResponse } from "./validators";

// Use Web Crypto API available in Cloudflare Workers
declare const crypto: Crypto;

// Generate a random salt
export function generateSalt(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Hash password with salt using PBKDF2
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256"
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  const exported = await crypto.subtle.exportKey("raw", key);
  return Array.from(new Uint8Array(exported as ArrayBuffer), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Verify password against hash
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

// Generate a session ID
export function generateSessionId(): string {
  return crypto.randomUUID();
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate username (alphanumeric, underscores, hyphens, 3-20 characters)
export function isValidUsername(username: string): boolean {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
}

// Validate password strength (at least 8 characters, contains letter and number)
export function isValidPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (password.length > 128) return false; // Reasonable upper limit
  if (!/[a-zA-Z]/.test(password)) return false; // Must contain at least one letter
  if (!/[0-9]/.test(password)) return false; // Must contain at least one number
  return true;
}

// Extract user from session
export async function getUserFromSession(sessionId: string, env: any): Promise<{id: number, username: string, email: string} | null> {
  try {
    const { results } = await env.DB.prepare(`
      SELECT u.id, u.username, u.email 
      FROM users u 
      JOIN sessions s ON u.id = s.user_id 
      WHERE s.id = ? AND s.expires_at > datetime('now')
    `).bind(sessionId).all();
    
    return results.length > 0 ? results[0] as {id: number, username: string, email: string} : null;
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

// Clean up expired sessions
export async function cleanupExpiredSessions(env: any): Promise<void> {
  try {
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at <= datetime('now')").run();
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

// Create session for user
export async function createSession(userId: number, env: any): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
  
  await env.DB.prepare(`
    INSERT INTO sessions (id, user_id, expires_at) 
    VALUES (?, ?, ?)
  `).bind(sessionId, userId, expiresAt.toISOString()).run();
  
  return sessionId;
}

// Destroy session
export async function destroySession(sessionId: string, env: any): Promise<void> {
  try {
    await env.DB.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
  } catch (error) {
    console.error('Error destroying session:', error);
  }
}