# Story 1.3: Email Confirmation Flow

Status: ready-for-dev
Issue: #149

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a **New User**,
I want **to confirm my email address addresses after registration**,
so that **I can activate my account autonomously without waiting for manual administrator approval.**

## Acceptance Criteria

- [ ] **Database Schema**:
    - [ ] Create `email_confirmation_tokens` table (id, user_id, token, expires_at, created_at).
    - [ ] Add `email_verified` column (INTEGER/BOOLEAN) to `users` table (Default: 0).
    - [ ] Create migration file `migrations/xxxx_add_email_confirmation.sql`.
- [ ] **Registration Flow Update**:
    - [ ] Update `POST /api/register` to:
        - [ ] Create user with `email_verified = 0`.
        - [ ] Generate secure token (UUID).
        - [ ] Insert into `email_confirmation_tokens`.
        - [ ] Send confirmation email using `sendEmail` (from Story 1.2).
        - [ ] Return specific success message ("Account created, please check email").
- [ ] **Confirmation Endpoint**:
    - [ ] Create `GET /api/auth/confirm-email?token=...` (or POST).
    - [ ] Verify token exists and is not expired.
    - [ ] Set `users.email_verified = 1`.
    - [ ] Delete token (or mark used).
    - [ ] Redirect user to login page with success toast/parameter (`?verified=true`).
- [ ] **Login Restriction**:
    - [ ] Update `POST /api/login` to check `email_verified`.
    - [ ] If 0, return 403 Forbidden with message "Email not verified".
    - [ ] Provide option/link to resend confirmation email.
- [ ] **Resend Functionality**:
    - [ ] Create `POST /api/auth/resend-confirmation` (rate limited).
    - [ ] Accepts email address.
    - [ ] If user exists and not verified, generate new token & send.
- [ ] **UI Updates (Preact Migration)**:
    - [ ] **Refactor**: Replace the legacy `public/js/auth.js` form handling with new Preact Island components (`AuthRegister`, `AuthLogin`).
    - [ ] Update Registration component to show success state.
    - [ ] Login component handles `?verified=true` to show "Email verified! You can now log in."
    - [ ] Login component handles "Email not verified" error.

## Tasks / Subtasks

- [ ] **Database Migration**
  - [ ] Write SQL migration for new table and column.
  - [ ] Apply migration locally/D1.
- [ ] **Backend: Registration**
  - [ ] Modify `src/auth-handlers.ts` `register` function.
  - [ ] Add token generation and DB insertion.
  - [ ] Integrate `email-utils.ts`.
- [ ] **Backend: Confirmation**
  - [ ] Add `confirmEmail` handler in `src/auth-handlers.ts`.
  - [ ] Add route to `src/router.ts` (or index).
- [ ] **Backend: Login & Resend**
  - [ ] Add verification check to `login`.
  - [ ] Add `resendConfirmation` handler.
- [ ] **Frontend: Auth Pages (Preact Migration)**
  - [ ] Create `client/src/islands/AuthForms.tsx` (or similar components for Login/Register).
  - [ ] Migrate the legacy vanilla JS logic from `public/js/auth.js` to these new Preact components.
  - [ ] Implement the UI for "Email Verification Pending", "Success", and "Resend Confirmation".
  - [ ] Mount these islands in `public/login.html` (or appropriate container), replacing the old static forms.
- [ ] **Testing**
  - [ ] Manual test of full flow: Register -> Receive Email -> Click Link -> Login.
  - [ ] Negative tests: Login before verify (Fail), Verify expired token (Fail).

## Dev Notes

### Security
- **Token Expiry**: Set to 24 hours.
- **Token Security**: Use `crypto.randomUUID()` or `crypto.getRandomValues()`.
- **Cleanup**: Recommendation: Add a scheduled trigger (CRON) to delete expired tokens, OR delete on access. For MVP, lazy cleanup (delete on successful use) is acceptable, but strict cleanup is better.

### Backward Compatibility
- Existing users (if any) should be migrated to `email_verified = 1`. Include this in the migration SQL (`UPDATE users SET email_verified = 1 WHERE email_verified IS NULL` or default value logic).
- Since `approved` column exists, align logic. If avoiding breaking changes, maybe keep `approved` but set it to 1 by default, and rely on `email_verified`. Or logically OR them?
    - *Decision*: Deprecate manual `approved` workflow. All new users are `approved=1` (or ignored) but `email_verified=0`.

## References

- [Story 1.2: Email Service Migration](_bmad-output/implementation-artifacts/1-2-email-service-migration.md)
- [Architecture: Auth](docs/archive/AUTHENTICATION.md)

## Dev Agent Record

### Agent Model Used
Gemini 3 Pro (Preview)

### Completion Notes List
- [ ] Migration strategy defined.
- [ ] Dependencies on Story 1.2 noted.

### File List
- `migrations/xxxx_add_email_confirmation.sql`
- `src/auth-handlers.ts`
- `public/js/auth.js` (Legacy frontend) OR `client/src/...` if ready.
