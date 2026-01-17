# Email Service Setup Guide

This guide explains how to set up the email service for Walk to Mordor using Resend.

## Overview

Walk to Mordor uses [Resend](https://resend.com) as its transactional email provider for sending:
- Password reset emails
- Email confirmation links (future feature)
- Other account-related notifications

## Prerequisites

- A Resend account (Free tier is sufficient for most use cases)
- Access to configure Cloudflare Workers secrets
- (Optional) A verified sending domain if you want to use a custom domain

## Setup Instructions

### 1. Create a Resend Account

1. Go to [https://resend.com](https://resend.com)
2. Sign up for a free account
3. Verify your email address

### 2. Generate an API Key

1. Log in to your Resend dashboard
2. Navigate to **API Keys** in the sidebar
3. Click **Create API Key**
4. Give it a descriptive name (e.g., "Walk to Mordor Production")
5. Select the appropriate permissions:
   - For production: **Sending access** only
   - For development: **Full access** (if you need to test other features)
6. Click **Create**
7. **Important**: Copy the API key immediately - you won't be able to see it again!

### 3. Configure the API Key in Cloudflare Workers

The API key must be stored as a Cloudflare Workers secret for security. **Never commit API keys to your repository.**

#### For Production (Remote)

```bash
npx wrangler secret put RESEND_API_KEY
```

When prompted, paste your Resend API key and press Enter.

#### For Local Development

For local development with `wrangler dev`, you have two options:

**Option 1: Use a `.dev.vars` file (Recommended)**

Create a `.dev.vars` file in the project root (this file is gitignored):

```
RESEND_API_KEY=re_your_api_key_here
```

**Option 2: Set an environment variable**

```bash
export RESEND_API_KEY=re_your_api_key_here
npx wrangler dev
```

### 4. (Optional) Verify a Sending Domain

By default, Resend allows you to send emails from their test domains during development. For production:

1. Go to the **Domains** section in Resend dashboard
2. Click **Add Domain**
3. Enter your domain name (e.g., `haydencarson.com`)
4. Follow the instructions to add DNS records to verify ownership
5. Once verified, update the `EMAIL_SENDER_ADDRESS` in `src/email-utils.ts` if needed

## Configuration

The email service is configured in `src/email-utils.ts`:

```typescript
const EMAIL_SENDER_ADDRESS = 'noreply@haydencarson.com';
const EMAIL_SENDER_NAME = 'Walk to Mordor';
```

Update these constants to match your verified sending domain.

## Usage

The email service provides several functions:

### Send Password Reset Email

```typescript
import { sendPasswordResetEmail } from './email-utils';

const result = await sendPasswordResetEmail(
  env,
  'user@example.com',
  'John Doe',
  'reset-token-here',
  'https://your-domain.com'
);

if (result.success) {
  console.log('Password reset email sent successfully');
} else {
  console.error('Failed to send email:', result.error);
}
```

### Send Confirmation Email

```typescript
import { sendConfirmationEmail } from './email-utils';

const result = await sendConfirmationEmail(
  env,
  'user@example.com',
  'https://your-domain.com/confirm?token=abc123'
);
```

### Send Custom Email

```typescript
import { sendEmail } from './email-utils';

const result = await sendEmail(env, {
  to: 'user@example.com',
  subject: 'Your Subject',
  html: '<p>HTML content</p>',
  text: 'Plain text fallback' // optional
});
```

## Email Templates

Email templates are defined in `src/email-templates.ts`. Each template provides both HTML and plain text versions:

- `getPasswordResetEmailHtml(resetLink)` / `getPasswordResetEmailText(resetLink)`
- `getConfirmationEmailHtml(confirmLink)` / `getConfirmationEmailText(confirmLink)`

The templates use simple, email-client-friendly HTML and CSS.

## Rate Limiting

The email service includes basic rate limit handling:

- Resend's free tier allows 100 emails per day and 3,000 per month
- The service handles 429 (Too Many Requests) responses gracefully
- Rate limit errors return user-friendly messages: "Too many email requests. Please try again later."

For production with high email volume, consider upgrading your Resend plan.

## Error Handling

All email functions return a result object:

```typescript
interface EmailResult {
  success: boolean;
  error?: string;
  messageId?: string;
}
```

Common error scenarios handled:
- Missing API key configuration
- Rate limiting (429 responses)
- Network failures
- Invalid email addresses
- Resend API errors

All errors are logged to the console and return user-friendly error messages.

## Testing

### Manual Testing

To test email delivery:

1. Set up your API key as described above
2. Start the development server: `npm run dev`
3. Trigger a password reset flow in the application
4. Check the recipient inbox for the email

### Testing with Different Email Clients

Test your emails in various email clients:
- Gmail (web and mobile)
- Outlook (web and desktop)
- Apple Mail
- Mobile devices (iOS Mail, Android Gmail)

[Litmus](https://litmus.com) and [Email on Acid](https://www.emailonacid.com) provide email testing services if needed.

## Troubleshooting

### Email not received

1. **Check spam/junk folder** - Test emails may be flagged as spam
2. **Verify API key** - Ensure `RESEND_API_KEY` is correctly set
3. **Check Resend dashboard** - View sent emails and delivery status
4. **Verify sending domain** - Ensure your domain is verified in Resend
5. **Check logs** - Look for error messages in Cloudflare Workers logs

### Rate limit errors

If you're hitting rate limits:
1. Upgrade your Resend plan for higher limits
2. Implement additional application-level rate limiting
3. Queue emails for batch sending during off-peak hours

### API key not found

Error: "Email service not configured"

Solution:
```bash
# For production
npx wrangler secret put RESEND_API_KEY

# For local dev
echo "RESEND_API_KEY=your_key_here" >> .dev.vars
```

## Security Best Practices

1. **Never commit secrets** - API keys should only be in Cloudflare Workers secrets or `.dev.vars` (gitignored)
2. **Use separate API keys** - Different keys for development and production
3. **Rotate keys periodically** - Generate new API keys every 6-12 months
4. **Restrict permissions** - Use "Sending access" only for production keys
5. **Monitor usage** - Check Resend dashboard for unusual activity

## Migration Notes

This application previously used Cloudflare Email Routing. Key changes:

- Removed dependency on `mimetext` package
- Removed `cloudflare:email` module usage
- Now using standard `fetch()` API for Resend
- Email templates extracted to separate module
- Added TypeScript interfaces for better type safety

## Support

- **Resend Documentation**: [https://resend.com/docs](https://resend.com/docs)
- **Resend API Reference**: [https://resend.com/docs/api-reference/emails/send-email](https://resend.com/docs/api-reference/emails/send-email)
- **Cloudflare Workers Secrets**: [https://developers.cloudflare.com/workers/configuration/secrets/](https://developers.cloudflare.com/workers/configuration/secrets/)

## Additional Resources

- [Resend Pricing](https://resend.com/pricing)
- [Email Best Practices](https://resend.com/docs/knowledge-base/email-best-practices)
- [SPF and DKIM Setup](https://resend.com/docs/dashboard/domains/introduction)
