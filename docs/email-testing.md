# Manual Email Testing Guide

This document describes how to manually test the email functionality after migrating to Resend.

## Prerequisites

1. Resend API key configured (see [email-setup.md](./email-setup.md))
2. Development environment running (`npm run dev`)
3. Access to the test email inbox

## Test Scenarios

### 1. Password Reset Email Flow

**Objective**: Verify that password reset emails are sent and received correctly.

**Steps**:
1. Navigate to the login page
2. Click "Forgot Password?" or navigate to `/reset-password`
3. Enter a valid email address (one you have access to)
4. Click "Submit" or "Send Reset Email"
5. Check the email inbox for the password reset email
6. Verify the email contains:
   - Correct recipient email
   - Subject: "Password Reset Request - Walk to Mordor"
   - HTML formatted content with Walk to Mordor branding
   - Working reset link
   - Expiration warning (1 hour)
7. Click the reset link and verify it navigates to the password reset form
8. Enter a new password and submit
9. Verify the password was successfully reset

**Expected Results**:
- Email delivered within 1-2 minutes
- HTML email displays correctly (test in multiple email clients if possible)
- Plain text fallback available (check in text-only email clients)
- Reset link is valid and functional
- Password reset completes successfully

**Error Cases to Test**:
- Invalid email address format (should show validation error)
- Non-existent user email (should not reveal if user exists - same success message)
- Expired reset token (should show appropriate error message)

### 2. Email Confirmation Flow

**Objective**: Verify the full registration → email confirmation → account activation flow.

**Steps**:
1. Create a test route or use existing registration flow
2. Trigger the `sendConfirmationEmail` function
3. Check the email inbox
4. Verify the email contains:
   - Subject: "Confirm Your Email - Walk to Mordor"
   - Welcome message
   - Confirmation link
   - HTML formatting with branding

**Expected Results**:
- Email delivered successfully
- Confirmation link present and functional
- HTML displays correctly

### 3. Rate Limiting

**Objective**: Verify rate limiting is handled gracefully.

**Steps**:
1. Attempt to send multiple password reset emails rapidly (5+ requests in quick succession)
2. Observe the behavior and error messages
3. Check console logs for rate limit warnings

**Expected Results**:
- If Resend rate limit is hit (429 response), user sees: "Too many email requests. Please try again later."
- Error is logged to console
- Application doesn't crash

### 4. Error Handling

**Objective**: Verify graceful error handling for various failure scenarios.

**Test Cases**:

#### Missing API Key
1. Temporarily remove or unset `RESEND_API_KEY`
2. Attempt to send an email
3. **Expected**: Error message "Email service not configured. Please contact administrator."
4. Application continues to function

#### Network Failure
1. Use browser dev tools to simulate offline mode
2. Attempt to send an email
3. **Expected**: Error message "Failed to send email. Please try again later."

#### Invalid Email Address
1. Attempt to send to an invalid email format (handled by Resend)
2. **Expected**: Appropriate error message from Resend API

## Testing Checklist

Use this checklist for each testing session:

- [ ] Password reset email sends successfully
- [ ] Email received in inbox (not spam)
- [ ] HTML email displays correctly in:
  - [ ] Gmail (web)
  - [ ] Gmail (mobile)
  - [ ] Outlook (web)
  - [ ] Apple Mail (if available)
- [ ] Plain text fallback works
- [ ] Reset link is clickable and functional
- [ ] Reset link contains correct token
- [ ] Password reset completes successfully
- [ ] Rate limiting handled gracefully
- [ ] Missing API key handled gracefully
- [ ] Network errors handled gracefully
- [ ] Console logs show appropriate messages
- [ ] No secrets visible in logs

## Email Content Validation

### HTML Email Checklist
- [ ] Subject line is correct
- [ ] Sender shows as "Walk to Mordor <noreply@haydencarson.com>"
- [ ] Logo/branding displays (🧙‍♂️ emoji visible)
- [ ] Colors match brand (header: #0f3460, button: #e94560)
- [ ] All text is readable
- [ ] Reset button is clickable
- [ ] Fallback link is provided and works
- [ ] Footer includes "Walk to Mordor Team"
- [ ] No broken images
- [ ] Responsive design works on mobile

### Plain Text Email Checklist
- [ ] Subject line is correct
- [ ] Sender is correct
- [ ] All important information present
- [ ] Link is copy-pasteable
- [ ] Formatting is readable

## Browser Console Checks

Monitor the browser console for:
- [ ] No errors related to email sending
- [ ] Appropriate success messages
- [ ] No exposed secrets or API keys
- [ ] Proper error handling messages

## Server Logs Checks

Monitor Cloudflare Workers logs for:
- [ ] Successful email send logged
- [ ] No stack traces for expected errors
- [ ] API key not logged
- [ ] Rate limit warnings (if triggered)

## Performance Testing

- [ ] Email sending doesn't block UI
- [ ] Response time is acceptable (<2 seconds for API response)
- [ ] Multiple concurrent requests handled properly

## Cross-Browser Testing

Test in multiple browsers:
- [ ] Chrome/Chromium
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Edge

## Security Checks

- [ ] API key never visible in:
  - [ ] Browser console
  - [ ] Network tab
  - [ ] Response bodies
  - [ ] Error messages
- [ ] Email content doesn't expose sensitive data
- [ ] Reset tokens are properly formatted and secure

## Troubleshooting Guide

If emails aren't being received:

1. **Check Resend Dashboard**
   - Log in to Resend dashboard
   - Check "Logs" section for sent emails
   - Verify email status (sent, delivered, bounced)

2. **Check Spam Folder**
   - Test emails often go to spam
   - Mark as "Not Spam" to train filters

3. **Verify Domain**
   - Ensure sending domain is verified in Resend
   - Check SPF and DKIM records

4. **Check API Key**
   - Verify `RESEND_API_KEY` is set correctly
   - Try regenerating the API key

5. **Check Logs**
   - Review Cloudflare Workers logs
   - Look for error messages or stack traces

6. **Test with Different Email Providers**
   - Try Gmail, Outlook, Yahoo
   - Some providers have stricter filters

## Test Report Template

After testing, document results:

```
## Test Session Report

**Date**: [Date]
**Tester**: [Name]
**Environment**: [Production/Development]
**Resend Account**: [Account email]

### Test Results

#### Password Reset Flow
- Status: [Pass/Fail]
- Notes: [Any issues or observations]

#### Email Delivery
- Gmail Web: [Pass/Fail]
- Gmail Mobile: [Pass/Fail]
- Outlook: [Pass/Fail]
- Spam Detection: [Pass/Fail]

#### Error Handling
- Missing API Key: [Pass/Fail]
- Rate Limiting: [Pass/Fail]
- Network Errors: [Pass/Fail]

#### Security
- No secrets exposed: [Pass/Fail]
- Logs appropriate: [Pass/Fail]

### Issues Found
1. [Description of issue]
2. [Description of issue]

### Recommendations
1. [Recommendation]
2. [Recommendation]
```

## Automated Testing Considerations

For future automated testing:

1. **Mock Resend API** in tests
2. **Test template generation** without sending
3. **Validate email format** (RFC 5322 compliance)
4. **Test error handling paths**
5. **Verify rate limit logic**

## Additional Resources

- [Resend Email Testing](https://resend.com/docs/knowledge-base/email-testing)
- [Email on Acid](https://www.emailonacid.com/) - Email client testing
- [Mail-Tester](https://www.mail-tester.com/) - Spam score testing
