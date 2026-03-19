/**
 * Shared authentication utilities for Preact islands.
 *
 * Provides a single source for building auth headers from the
 * session token stored in localStorage.
 */

/**
 * Build authorization headers from the session token in localStorage.
 *
 * Returns an object with `Authorization` and `Content-Type` headers when
 * a token is present, or just `Content-Type` when unauthenticated.
 *
 * @returns Headers record suitable for `fetch()`.
 */
export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('sessionToken');
  return token
    ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    : { 'Content-Type': 'application/json' };
}
