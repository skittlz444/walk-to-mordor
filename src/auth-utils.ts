// Authentication utilities for password hashing, session management, and validation

/**
 * Generate a random salt for password hashing
 */
export async function generateSalt(): Promise<string> {
  const buffer = new Uint8Array(16);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Hash a password with a salt using PBKDF2
 */
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const passwordData = encoder.encode(password);
  const saltData = encoder.encode(salt);
  
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    passwordData,
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltData,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  
  return Array.from(new Uint8Array(derivedBits), byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, salt: string, hash: string): Promise<boolean> {
  const computedHash = await hashPassword(password, salt);
  return computedHash === hash;
}

/**
 * Generate a secure session ID
 */
export function generateSessionId(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Username/email predicates live in ./validators so the client bundle can
// import the exact same rules. Re-exported here so worker call sites are
// unchanged.
export { isValidEmail, isValidUsername } from './validators';

/**
 * Validate password requirements:
 * - At least 8 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number or symbol
 */
export function isValidPassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!password || typeof password !== 'string') {
    errors.push('Password is required');
    return { valid: false, errors };
  }
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  
  if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one number or symbol');
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Create a session that expires in 30 days
 */
export function getSessionExpiry(): string {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  return expiryDate.toISOString();
}

/**
 * Check if a session is expired
 */
export function isSessionExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Generate a secure password reset token
 */
export function generatePasswordResetToken(): string {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Array.from(buffer, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Get password reset token expiry (1 hour from now)
 */
export function getPasswordResetExpiry(): string {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 1);
  return expiryDate.toISOString();
}

/**
 * Check if a password reset token is expired
 */
export function isPasswordResetTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Generate a secure email confirmation token
 */
export function generateEmailConfirmationToken(): string {
  return crypto.randomUUID();
}

/**
 * Get email confirmation token expiry (24 hours from now)
 */
export function getEmailConfirmationExpiry(): string {
  const expiryDate = new Date();
  expiryDate.setHours(expiryDate.getHours() + 24);
  return expiryDate.toISOString();
}

/**
 * Check if an email confirmation token is expired
 */
export function isEmailConfirmationTokenExpired(expiresAt: string): boolean {
  return new Date(expiresAt) < new Date();
}

/**
 * Generate a cryptographically secure 8-character alphanumeric code.
 * Uses crypto.getRandomValues() for non-enumerable codes.
 * Shared by friend-code and invite-code generation.
 */
export function generateAlphanumericCode(): string {
  const length = 8;
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  // Generate more random bytes than needed to account for rejection
  const bufferSize = length * 2; // Extra to handle rejections
  const values = new Uint8Array(bufferSize);
  crypto.getRandomValues(values);
  let code = '';
  let idx = 0;
  while (code.length < length) {
    if (idx >= values.length) {
      // Need more random bytes
      crypto.getRandomValues(values);
      idx = 0;
    }
    // Rejection sampling: reject values that cause modulo bias
    if (values[idx] < 256 - (256 % charset.length)) {
      code += charset[values[idx] % charset.length];
    }
    idx++;
  }
  return code;
}

/**
 * Generate a unique friend code for a user.
 * Retries up to maxRetries times on uniqueness collisions.
 */
export async function generateUniqueFriendCode(
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { first: () => Promise<unknown> } } },
  maxRetries = 10
): Promise<string> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const code = generateAlphanumericCode();
    const existing = await db.prepare(
      'SELECT id FROM users WHERE friend_code = ?'
    ).bind(code).first();
    if (!existing) {
      return code;
    }
  }
  throw new Error('Failed to generate unique friend code after maximum retries');
}

/**
 * Backfill friend_code for all users who don't have one.
 * Uses crypto-strength generation with uniqueness verification.
 * Returns the number of users updated.
 */
export async function backfillFriendCodes(
  db: { prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown>; all: () => Promise<{ results: Array<{ id: number }> }>; first: () => Promise<unknown> } } }
): Promise<number> {
  const { results: usersWithoutCode } = await db.prepare(
    'SELECT id FROM users WHERE friend_code IS NULL'
  ).bind().all();

  let updated = 0;
  for (const user of usersWithoutCode) {
    const code = await generateUniqueFriendCode(db);
    await db.prepare(
      'UPDATE users SET friend_code = ? WHERE id = ? AND friend_code IS NULL'
    ).bind(code, user.id).run();
    updated++;
  }
  return updated;
}
