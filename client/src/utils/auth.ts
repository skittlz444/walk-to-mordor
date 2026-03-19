/**
 * Shared authentication utilities for Preact islands.
 *
 * Provides a single `getAuthHeaders()` that reads the session token
 * from localStorage and returns an Authorization header object.
 *
 * Islands should import this instead of inlining localStorage reads.
 */

/**
 * Build an Authorization header from the stored session token.
 *
 * @returns Record with `Authorization` and `Content-Type` headers,
 *          or just `Content-Type` when no token is present.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}

/**
 * Retrieve the raw session token (or null) from localStorage.
 */
export function getSessionToken(): string | null {
  return localStorage.getItem('sessionToken');
}
