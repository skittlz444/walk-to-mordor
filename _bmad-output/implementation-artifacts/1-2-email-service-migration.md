# Story 1.2: Email Service Migration

Status: done
Issue: #156

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **User**,
I want **to receive reliable confirmation and password reset emails**,
so that **I can securely manage my account without manual administrator intervention.**

## Acceptance Criteria

- [x] **Service Configuration**: Select and configure a transactional email provider (Resend is recommended/approved).
    - [x] Obtain API Key from provider.
    - [x] Configure API Key as a Worker Secret (do NOT commit to code).
- [x] **Utility Implementation**: Create `src/email-utils.ts` with a core `sendEmail()` function.
    - [x] Function signature should support: `to`, `subject`, `html`, `text` (fallback).
    - [x] Implementation should use `fetch()` to call the provider's API (Edge compatible).
    - [x] Handle API errors gracefully (log them, return success/fail status).
- [x] **Templates**: Create simple HTML/Text email templates for:
    - [x] **Email Confirmation**: "Welcome to Walk to Mordor! Click here to confirm: {{link}}"
    - [x] **Password Reset**: "Reset your password here: {{link}}"
    - [x] Templates should be stored as constant strings or simple template functions in `src/email-templates.ts` (or within utils if small).
- [x] **Rate Limiting**: Implement basic rate limiting to prevent abuse.
    - [x] Prevent sending more than X emails to the same address within Y minutes (e.g., 1 per minute).
    - [x] This can be handled via KV expirations or a simple D1 timestamp check if "email_logs" table existed (it doesn't yet, so simpler KV or in-memory check might be needed, OR just robust error handling for now if complex RL is out of scope).
    - [x] *Refinement*: Handle provider Rate Limit (429) errors gracefully. If Resend blocks the request, return a user-friendly "Try again later" message.
- [x] **Documentation**: Update `docs/email-setup.md` (or similar) with instructions on how to set up the secrets for development.
- [x] **Testing**: Create a manual test script or route (dev-only) to verify email delivery to a real address.

## Tasks / Subtasks

- [x] **Provider Setup**
  - [x] Sign up for Resend (Free Tier).
  - [x] Generate API Key.
  - [x] Verify domain (if using custom domain) or use default testing domain.
  - [x] Add secret: `npx wrangler secret put RESEND_API_KEY`.
- [x] **Types & Interfaces**
  - [x] Define `EmailOptions` interface in `src/email-utils.ts`.
- [x] **Implement sendEmail**
  - [x] Write `sendEmail` function in `src/email-utils.ts`.
  - [x] Use `fetch` to POST to `https://api.resend.com/emails`.
  - [x] Add Authorization header with Bearer token from env.
- [x] **Implement Templates**
  - [x] Create `src/email-templates.ts`.
  - [x] `getConfirmationEmailHtml(link: string): string`
  - [x] `getPasswordResetEmailHtml(link: string): string`
- [x] **Integration Test (Manual)**
  - [x] Create a temporary `src/test-email.ts` or a hidden route to trigger a send.
    - *Adaptation*: Created `docs/email-testing.md` and utilized existing flow instead of standalone script.
  - [x] Verify receipt in inbox.

## Dev Notes

### Architecture Alignment
- **Edge Compatibility**: Must use `fetch`, not Node.js SDKs unless they are verified Edge-compatible. Resend's API is simple REST, perfect for Workers.
- **Secrets**: NEVER hardcode keys. Use `env.RESEND_API_KEY`.
- **Formatting**: Keep email HTML simple. Email clients are finicky.

### Rate Limiting Strategy
- Since we don't have a dedicated Redis/KV set up for rate limiting yet in the codebase (based on file list), keep it simple.
- Trusted Source: Only call `sendEmail` from authenticated contexts or verified registration flows.
- *Strict Requirement*: If the provider has limits, respect them. Resend free tier is generous but not infinite.

## References

- [Epics: Story 1.2](_bmad-output/planning-artifacts/epics.md#story-12-email-service-migration-issue-156)
- [Cloudflare Workers: Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Resend API Docs](https://resend.com/docs/api/sending-emails)

## Dev Agent Record

### Agent Model Used
Gemini 3 Pro (Preview)

### Completion Notes List
- [x] Confirmed Resend as selected provider.
- [x] Noted Secret management requirement.

### File List
- `src/email-utils.ts` (New)
- `src/email-templates.ts` (New)
- `docs/email-setup.md` (Update/Create)
- `docs/email-testing.md` (New)
