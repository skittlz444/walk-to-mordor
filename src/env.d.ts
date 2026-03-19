/**
 * Augments the auto-generated Env interface (from worker-configuration.d.ts)
 * with secret bindings and test-only variables that are NOT declared in
 * wrangler.json but are set at runtime via `wrangler secret` or test harnesses.
 */

interface Env {
  /** Resend email-service API key – set via `wrangler secret put`. */
  RESEND_API_KEY?: string;

  /** When `"true"`, enables mock-token authentication for integration tests. */
  ALLOW_TEST_AUTH?: string;
}
