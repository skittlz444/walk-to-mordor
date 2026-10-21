/**
 * Worker secrets that are not declared in `wrangler.json`.
 *
 * `wrangler types` only generates bindings from the Wrangler config and
 * `.dev.vars`; secrets created with `wrangler secret put` are invisible to it.
 * Declare them here so `Env` stays complete without committing secret values.
 *
 * Keep this list in sync with the secrets configured for the worker.
 */
interface Env {
  RESEND_API_KEY?: string;
}
