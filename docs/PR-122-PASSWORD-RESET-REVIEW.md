# PR 122 Password Reset Implementation Review

## Plan: Fix Email Whitelist & Security Issues in Password Reset

The PR implements password reset functionality via Cloudflare Email Routing. While core security practices are solid (crypto tokens, single-use, session invalidation), **the email binding configuration is incorrect** - it currently allows sending to ANY email address instead of using an allowlist for your small friend group. Additionally, several maintenance and configuration issues should be addressed.

### Critical Issue: Email Binding Misconfiguration

**Current State** in [wrangler.json](../wrangler.json#L17-L21):
```json
"send_email": [
  {
    "name": "EMAIL"
  }
]
```

**Problem**: When no `destination_address` or `allowed_destination_addresses` is specified, the binding has **no restrictions** and can send emails to any verified Email Routing destination address. This is not the correct whitelist approach for a small group of friends.

**Required Fix**: Use `allowed_destination_addresses` to explicitly whitelist your friends' email addresses:
```json
"send_email": [
  {
    "name": "EMAIL",
    "allowed_destination_addresses": [
      "friend1@example.com",
      "friend2@example.com",
      "friend3@example.com"
    ]
  }
]
```

---

### Steps

1. **Fix email whitelist binding** in [wrangler.json](../wrangler.json#L17-L21) - Add `allowed_destination_addresses` array with explicit list of your friends' email addresses to properly restrict who can receive password reset emails.

2. **Make reset URL configurable** in [src/email-utils.ts](../src/email-utils.ts#L21) - The domain `wtm.haydencarson.com` is hardcoded; extract to an environment variable (e.g., `env.SITE_URL` or `env.RESET_BASE_URL`) for flexibility across environments.

3. **Add basic rate limiting** in [src/auth-handlers.ts](../src/auth-handlers.ts) `handlePasswordResetRequest` - Implement simple IP-based or email-based throttling (e.g., max 3 reset requests per email per hour) to prevent abuse; can use a simple D1 table or in-memory counter.

4. **Add expired token cleanup** - Create a scheduled cleanup function (Cloudflare Cron Trigger) or add cleanup logic when new tokens are created to remove expired/used tokens from `password_reset_tokens` table.

5. **Update documentation** in [EMAIL_SETUP.md](EMAIL_SETUP.md) - Document the `allowed_destination_addresses` configuration and explain how to add new users to the whitelist.

---

### Further Considerations

1. **Should all users' emails be pre-added to wrangler.json?** Yes, for a small friend group - add their emails to `allowed_destination_addresses` and re-deploy when new friends join. Alternatively, consider if you want an unrestricted binding and rely on Email Routing's verified destinations instead.

2. **Rate limiting storage mechanism?** Option A: Simple D1 table tracking reset attempts / Option B: Use Cloudflare KV with TTL / Option C: Accept risk for small user base and skip rate limiting.

3. **Token cleanup frequency?** Option A: Cron trigger running daily / Option B: Lazy cleanup on each new token creation / Option C: Manual cleanup as needed for small user base.

---

## Detailed Analysis

### What's Working Well ✅

| Feature | Status | Location |
|---------|--------|----------|
| Cryptographic token generation (32-byte) | ✅ Good | [src/auth-utils.ts](../src/auth-utils.ts) `generatePasswordResetToken()` |
| Token expiration (1 hour) | ✅ Good | `getTokenExpirationTime()` |
| Single-use token enforcement | ✅ Good | `used` column in DB |
| Email enumeration protection | ✅ Good | Same response for valid/invalid emails |
| Session invalidation on reset | ✅ Good | `handlePasswordReset()` deletes all sessions |
| Password hashing (PBKDF2, 100k iterations) | ✅ Good | `hashPassword()` |
| Comprehensive test coverage | ✅ Good | API, unit, and UI tests all passing |

### Issues Identified ⚠️

| Issue | Severity | Description |
|-------|----------|-------------|
| **No email whitelist** | 🔴 High | `wrangler.json` has unrestricted `send_email` binding |
| **Hardcoded domain** | 🟡 Medium | Reset URL hardcoded to `wtm.haydencarson.com` |
| **No rate limiting** | 🟡 Medium | Unlimited reset requests possible |
| **No token cleanup** | 🟠 Low | Expired tokens accumulate in database |
| **No CSRF protection** | 🟠 Low | Forms lack CSRF tokens (acceptable for this use case) |

### Files Modified by PR 122

- [src/email-utils.ts](../src/email-utils.ts) - Email sending implementation
- [src/auth-handlers.ts](../src/auth-handlers.ts) - Reset request/reset handlers
- [src/auth-utils.ts](../src/auth-utils.ts) - Token generation utilities
- [src/renderPasswordResetPage.ts](../src/renderPasswordResetPage.ts) - UI rendering
- [src/index.ts](../src/index.ts) - API routes
- [migrations/0010_create_password_reset_tokens.sql](../migrations/0010_create_password_reset_tokens.sql) - DB schema
- [wrangler.json](../wrangler.json) - Email binding configuration
- [EMAIL_SETUP.md](EMAIL_SETUP.md) - Setup documentation
- [AUTHENTICATION.md](AUTHENTICATION.md) - Auth documentation
