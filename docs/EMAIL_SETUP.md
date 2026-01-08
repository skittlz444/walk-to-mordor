# Password Reset Email Configuration

This document explains how to configure Cloudflare Email Routing for password reset functionality.

## Prerequisites

1. A domain with Cloudflare Email Routing enabled
2. Verified destination email addresses in Cloudflare Email Routing

## Configuration Steps

### 1. Enable Email Routing on Your Domain

1. Go to your Cloudflare dashboard
2. Select your domain (`haydencarson.com` for this project)
3. Navigate to **Email** → **Email Routing**
4. Enable Email Routing
5. Add destination addresses that can receive emails

### 2. Configure Sender Address

The sender email address must be from your domain with Email Routing enabled. In this implementation:

- **Sender**: `noreply@haydencarson.com`
- **Domain**: `haydencarson.com`

To use a different sender address, update `src/email-utils.ts`:

```typescript
msg.setSender({ 
  name: 'Walk to Mordor', 
  addr: 'noreply@yourdomain.com'  // Change this
});
```

### 3. Wrangler Configuration

Update `wrangler.json` to configure the email binding with allowed destination addresses (whitelist):

```json
"send_email": [
  {
    "name": "EMAIL",
    "allowed_destination_addresses": [
      "friend1@example.com",
      "friend2@example.com",
      "friend3@example.com"
      // Add more emails here as needed
    ]
  }
]
```

This creates an `EMAIL` binding available in your Worker's `env` object and restricts email sending to only the listed addresses for security.

### 4. Deploy

Deploy your Worker with:

```bash
npm run deploy
```

The EMAIL binding will be automatically available in production.

## Testing

### Local Development

When running `npm run dev`, the EMAIL binding may not be available. The implementation handles this gracefully:

- If EMAIL binding is not available, the function logs a warning and returns `{ success: false }`
- The password reset handler still returns success to prevent email enumeration
- The reset token is stored in the database and can be used via direct URL

### Production Testing

1. Request a password reset for a registered user
2. Check the user's email inbox
3. Click the reset link or copy the token from the email
4. Complete the password reset process

## Email Template

The password reset email includes:

- **Subject**: "Password Reset Request - Walk to Mordor"
- **Plain text version**: For email clients that don't support HTML
- **HTML version**: Professionally formatted with:
  - Application branding
  - Clear call-to-action button
  - Manual link copy option
  - Expiration notice (1 hour)

### Customizing the Email Template

To customize the email template, edit `src/email-utils.ts`:

- Update the HTML in the `msg.addMessage()` call with `contentType: 'text/html'`
- Update colors, fonts, and layout as needed
- Keep the `${resetUrl}` variable to include the reset link

## Security Considerations

1. **Email Enumeration Protection**: The same success message is returned regardless of whether the email exists in the database
2. **Token Expiration**: Reset tokens expire after 1 hour
3. **Single-Use Tokens**: Tokens are marked as used after successful password reset
4. **Session Invalidation**: All user sessions are invalidated when password is reset
5. **Secure Token Generation**: 32-byte cryptographically secure random tokens

## Troubleshooting

### Email Not Received

1. **Check Email Routing Status**: Ensure Email Routing is enabled on your domain
2. **Verify Sender Address**: The sender must be from your domain with Email Routing
3. **Check Spam Folder**: Password reset emails may be filtered as spam
4. **Verify User Email**: Ensure the user's email address is correct in the database
5. **Check Worker Logs**: View logs in Cloudflare dashboard for any error messages

### EMAIL Binding Not Available

If you see "Email service not configured" errors:

1. Verify `send_email` is in `wrangler.json`
2. Run `npx wrangler types` to regenerate type definitions
3. Redeploy with `npm run deploy`
4. Check the Cloudflare dashboard to ensure Email Routing is active

## Alternative Configuration

If you need to send to specific verified addresses only, you can configure allowlists:

```json
"send_email": [
  {
    "name": "EMAIL",
    "destination_address": "verified@example.com"
  }
]
```

Or restrict to specific domains:

```json
"send_email": [
  {
    "name": "EMAIL",
    "allowed_destination_addresses": ["*@yourdomain.com"]
  }
]
```

## Cost

Cloudflare Email Routing is included with all Cloudflare plans at no additional cost for reasonable usage.

## Additional Resources

- [Cloudflare Email Routing Documentation](https://developers.cloudflare.com/email-routing/)
- [Send Email from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/)
- [Email Workers Runtime API](https://developers.cloudflare.com/email-routing/email-workers/runtime-api/)
