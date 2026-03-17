---
name: email-setup
description: Resend email integration setup, domain verification, and delivery configuration.
updated: 2026-03-17
---

# Email Setup

## Architecture Decision

- **Provider**: Resend (replaced Cloudflare Email Routing).
- **Why**: Standard `fetch()` API — no `mimetext` dependency, no `cloudflare:email` module. Simpler, testable, and free tier covers current volume.
- **Pattern**: All email functions return `{ success, error?, messageId? }`. Callers check `success`; errors are logged and surfaced as user-friendly messages.

## Code Locations

| Concern | Path |
|---|---|
| Send helpers & Resend API call | `src/email-utils.ts` |
| HTML + plain-text templates | `src/email-templates.ts` |
| Email-related tests | `src/__tests__/email-*` |
| Testing guide | `docs/email-testing.md` |

## Secret & Config Management

- **`RESEND_API_KEY`** — the only secret required for email.
- **Production**: store via `npx wrangler secret put RESEND_API_KEY`. Never in `wrangler.json`.
- **Local dev**: add to `.dev.vars` (gitignored): `RESEND_API_KEY=re_...`
- Never commit API keys. Use separate keys for dev and production.
- Production keys should have **Sending access only**; rotate every 6–12 months.
- Sender address and name constants live in `src/email-utils.ts` — update them when the verified domain changes.

## Domain Verification

- Resend test domains work for development; **production requires a verified custom domain**.
- Verification is done in the Resend dashboard by adding DNS records (SPF, DKIM).
- The sending address in `src/email-utils.ts` must match the verified domain.

## Rate Limits & Constraints

- Free tier: **100 emails/day**, **3,000/month**.
- The service handles `429` responses and returns: `"Too many email requests. Please try again later."`
- Upgrade the Resend plan before any feature that could exceed these limits.

## Error Handling Conventions

- All send functions return a result object (see `EmailResult` in `src/email-utils.ts`).
- Missing API key → `"Email service not configured"` error.
- Network failures, invalid addresses, and Resend API errors are caught, logged, and returned as user-friendly strings.
- Never throw from email functions; always return the result object.

## Gotchas

- Email templates must use inline CSS — most email clients strip `<style>` blocks.
- Always provide both HTML and plain-text versions of every template.
- Check spam/junk folders when testing; emails from new domains are often flagged initially.
