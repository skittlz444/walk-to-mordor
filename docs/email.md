---
name: email
description: Email delivery configuration, template patterns, and testing strategies for transactional emails.
---

# Email

> Last updated: 2026-03-17

## Architecture

- **Provider**: Resend (standard `fetch()` API — no `mimetext` or `cloudflare:email` dependency).
- **Pattern**: The core `sendEmail()` returns `{ success, error?, messageId? }`. Higher-level wrappers (`sendPasswordResetEmail`, `sendConfirmationEmail`) return `{ success, error? }`. Callers check `success`; errors are logged and surfaced as user-friendly messages. Never throw from email functions.

## Code Locations

| Concern | Path |
|---|---|
| Send helpers & Resend API call | `src/email-utils.ts` |
| HTML + plain-text templates | `src/email-templates.ts` |
| Email-related tests | `tests/api/email-utils.test.ts`, `tests/api/email-templates.test.ts` |

## Configuration

### Secret — `RESEND_API_KEY`

- **Production**: `npx wrangler secret put RESEND_API_KEY`. Never in `wrangler.json`.
- **Local dev**: add to `.dev.vars` (gitignored): `RESEND_API_KEY=re_...`
- Use separate keys for dev/prod. Production keys: **Sending access only**; rotate every 6–12 months.
- Must never appear in logs, error messages, or HTTP responses.

### Domain Verification

- Production requires a verified custom domain in the Resend dashboard (SPF + DKIM DNS records).
- Sender address in `src/email-utils.ts` must match the verified domain.
- Resend test domains work for development only.

### Rate Limits

- Free tier: **100 emails/day**, **3,000/month**. Upgrade before any feature that could exceed these.
- `429` responses surface: `"Too many email requests. Please try again later."`

## Email Flows

| Flow | Handler | Send function |
|---|---|---|
| Password reset | `src/auth-handlers.ts` | `sendPasswordResetEmail()` |
| Email confirmation | `src/auth-handlers.ts` | `sendConfirmationEmail()` |

## Template Rules

- Inline CSS only — most email clients strip `<style>` blocks.
- Always provide both HTML and plain-text versions.

## Testing Strategy

### Unit & Integration (always mock)

- Mock `fetch` to `api.resend.com` — never send real emails in CI.
- Test template generation separately: assert HTML contains expected links, branding, text.
- Test error paths: mock 429 (rate limit), 500 (server error), network failures.
- Never reveal user existence: password-reset for unknown emails must return same success response. Assert this.
- Reset tokens expire after 1 hour — mock `Date.now()` for time-sensitive tests.
- Rate-limit responses must surface user-friendly messages, not raw API errors.

### Manual Smoke Tests

- Verify delivery + spam-folder behavior across providers (Gmail, Outlook).
- Check HTML rendering fidelity (automated tests can't catch email-client quirks).
- Confirm SPF/DKIM alignment via Resend dashboard logs.

## Environment Gotchas

- **Local dev**: Resend sends real emails even in dev. Use a personal inbox or Resend's test key.
- **CI**: Mock all Resend calls — no sandbox mode exists.
- **Spam**: New-domain emails often land in spam. Mark "Not Spam" to build reputation.
- **Logs**: `wrangler tail` for production; Resend dashboard for delivery status.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| No email received | Domain not verified | Verify domain + SPF/DKIM in Resend dashboard |
| Email in spam | New domain, no reputation | Mark not-spam; wait for reputation |
| 401 from Resend | Invalid/missing API key | Regenerate in Resend, re-set via `wrangler secret put` |
| 429 from Resend | Rate limit exceeded | Back off; check for retry loops |
| Link broken in email | Wrong `BASE_URL` | Check `wrangler.json` vars or `.dev.vars` |
| `"Email service not configured"` | Missing `RESEND_API_KEY` | Set key in `.dev.vars` or via wrangler secret |
