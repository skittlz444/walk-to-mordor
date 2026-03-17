---
name: email-testing
description: End-to-end email flow validation, test setup, and Resend integration testing patterns.
---

# Email Testing

> Last updated: 2026-03-17

## Email Flows to Test

| Flow | Handler | Template fn |
|---|---|---|
| Password reset | `src/auth-handlers.ts` | `sendPasswordResetEmail()` in `src/email-utils.ts` |
| Email confirmation | `src/auth-handlers.ts` | `sendConfirmationEmail()` in `src/email-utils.ts` |

## Testing Strategy

### What to mock

- **Always mock** the Resend API (`fetch` to `api.resend.com`) in unit/integration tests. Never send real emails in CI.
- **Test template generation** separately from sending — assert HTML output contains expected links, branding, and text without hitting the network.
- **Test error-handling paths** by mocking fetch to return 429 (rate limit), 500 (server error), and network failures.

### What to test live (manual only)

- Actual delivery and spam-folder behavior across providers (Gmail, Outlook).
- HTML rendering fidelity — automated tests can't catch email-client rendering quirks.
- SPF/DKIM alignment — check via Resend dashboard logs, not code.

## Key Rules for Email Tests

- Never reveal user existence: password-reset for unknown emails must return the same success response as known emails. Assert this in tests.
- Reset tokens expire after 1 hour. Time-sensitive tests should mock `Date.now()`.
- `RESEND_API_KEY` must never appear in logs, error messages, or HTTP responses. Validate this in error-path tests.
- Rate-limit responses (429 from Resend) must surface a user-friendly message, not raw API errors.

## Non-Obvious Setup Requirements

- The sending domain (`haydencarson.com`) must be verified in Resend with valid SPF + DKIM records before any emails will deliver. This is a Resend dashboard config, not a code change.
- `RESEND_API_KEY` is a Worker secret — set via `wrangler secret put`, not in `wrangler.json`. For local dev, add it to `.dev.vars`.
- Email setup details → [email-setup.md](./email-setup.md).

## Environment Gotchas

- **Local dev**: Resend sends real emails even in dev mode. Use a personal inbox or Resend's test key to avoid accidental sends.
- **CI**: Mock all Resend calls. There is no sandbox/test mode for Resend that suppresses delivery.
- **Spam filters**: Test emails from new domains frequently land in spam. Mark as "Not Spam" to train provider filters during initial setup.
- **Cloudflare Workers logs**: Use `wrangler tail` to inspect email-send logs in production. Resend dashboard shows delivery status (sent/delivered/bounced).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No email received | Domain not verified in Resend | Verify domain + SPF/DKIM in Resend dashboard |
| Email in spam | New sending domain, no reputation | Mark not-spam; wait for reputation to build |
| 401 from Resend | Invalid or missing API key | Regenerate key in Resend, re-set via `wrangler secret put` |
| 429 from Resend | Rate limit exceeded | Back off; check for runaway retry loops in code |
| Email sent but link broken | Wrong `BASE_URL` in env | Check `wrangler.json` vars or `.dev.vars` for correct base URL |
