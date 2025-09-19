# Authentication and Samsung Health Setup Guide

This guide explains how to set up OAuth social login and Samsung Health integration for the Walk to Mordor application.

## Prerequisites

- A deployed Cloudflare Workers application
- Access to Google/Facebook Developer Console
- Samsung Developer account (for Samsung Health integration)

## OAuth Social Login Setup

### Google OAuth Setup

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure the OAuth consent screen
6. Set up the OAuth client:
   - Application type: Web application
   - Authorized redirect URIs: `https://yourdomain.com/wtm/` (where OAuth callback will be handled)

7. Set the following environment variables in your Cloudflare Workers:
   ```bash
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   OAUTH_REDIRECT_URI=https://yourdomain.com/wtm/
   ```

### Facebook OAuth Setup

1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Add "Facebook Login" product to your app
4. Configure OAuth redirect URIs: `https://yourdomain.com/wtm/`
5. Set the following environment variables in your Cloudflare Workers:
   ```bash
   FACEBOOK_CLIENT_ID=your_facebook_app_id
   FACEBOOK_CLIENT_SECRET=your_facebook_app_secret
   OAUTH_REDIRECT_URI=https://yourdomain.com/wtm/
   ```

## Samsung Health Integration Setup

### Samsung Developer Setup

1. Go to [Samsung Developers](https://developer.samsung.com/)
2. Create a Samsung account and complete developer registration
3. Create a new app in the Samsung Health section
4. Request access to the Samsung Health SDK
5. Configure your app permissions to include:
   - `com.samsung.health.step_daily_trend.read`

6. Set the following environment variables:
   ```bash
   SAMSUNG_HEALTH_CLIENT_ID=your_samsung_health_client_id
   SAMSUNG_HEALTH_CLIENT_SECRET=your_samsung_health_client_secret
   SAMSUNG_HEALTH_REDIRECT_URI=https://yourdomain.com/wtm/
   ```

## Environment Variables Setup

### Cloudflare Wrangler

Add environment variables to your `wrangler.json`:

```json
{
  "vars": {
    "GOOGLE_CLIENT_ID": "your_google_client_id",
    "GOOGLE_CLIENT_SECRET": "your_google_client_secret",
    "FACEBOOK_CLIENT_ID": "your_facebook_app_id", 
    "FACEBOOK_CLIENT_SECRET": "your_facebook_app_secret",
    "OAUTH_REDIRECT_URI": "https://yourdomain.com/wtm/",
    "SAMSUNG_HEALTH_CLIENT_ID": "your_samsung_health_client_id",
    "SAMSUNG_HEALTH_CLIENT_SECRET": "your_samsung_health_client_secret",
    "SAMSUNG_HEALTH_REDIRECT_URI": "https://yourdomain.com/wtm/"
  }
}
```

### Production Deployment

For production, use Cloudflare Workers secrets for sensitive values:

```bash
# Set OAuth secrets
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put FACEBOOK_CLIENT_SECRET
wrangler secret put SAMSUNG_HEALTH_CLIENT_SECRET

# Set non-sensitive environment variables
wrangler env put GOOGLE_CLIENT_ID "your_google_client_id"
wrangler env put FACEBOOK_CLIENT_ID "your_facebook_app_id"
wrangler env put OAUTH_REDIRECT_URI "https://yourdomain.com/wtm/"
```

## Database Migration

Apply the authentication database migrations:

```bash
# For local development
npx wrangler d1 migrations apply DB --local

# For production
npx wrangler d1 migrations apply DB --remote
```

## Testing the Integration

### Local Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Navigate to `http://localhost:8787/wtm/`

3. You should see the authentication buttons if not logged in

4. Test OAuth flow:
   - Click "Sign in with Google" or "Sign in with Facebook"
   - Complete the OAuth flow
   - Verify you're redirected back and logged in

5. Test Samsung Health (if configured):
   - Click "Link Samsung Health" after logging in
   - Complete Samsung Health authorization
   - Try syncing data in a distance entry popup

### Production Testing

1. Deploy your application:
   ```bash
   npm run deploy
   ```

2. Test the same flows on your production domain

## API Endpoints

The following new API endpoints are available:

### Authentication
- `GET /wtm/api/auth/google` - Get Google OAuth URL
- `GET /wtm/api/auth/facebook` - Get Facebook OAuth URL  
- `POST /wtm/api/auth/callback` - Handle OAuth callback
- `POST /wtm/api/auth/logout` - Logout user
- `POST /wtm/api/auth/refresh` - Refresh user session

### Samsung Health
- `GET /wtm/api/samsung-health/link` - Get Samsung Health OAuth URL
- `POST /wtm/api/samsung-health/callback` - Handle Samsung Health callback
- `POST /wtm/api/sync/samsung-health` - Sync daily distance data

### Progress (Now User-Specific)
- `GET /wtm/api/calendar-progress` - Get user's progress (anonymous if not logged in)
- `POST /wtm/api/calendar-progress` - Create progress entry (requires auth)
- `PUT /wtm/api/calendar-progress` - Update progress entry (requires auth)
- `DELETE /wtm/api/calendar-progress` - Delete progress entry (requires auth)

## Security Considerations

1. **HTTPS Required**: OAuth flows require HTTPS in production
2. **Secrets Management**: Never commit OAuth secrets to version control
3. **Session Security**: Sessions are stored as HTTP-only cookies
4. **Token Encryption**: In production, encrypt stored OAuth tokens
5. **CSRF Protection**: OAuth state parameters prevent CSRF attacks

## Troubleshooting

### Common Issues

1. **OAuth "Redirect URI Mismatch"**
   - Ensure redirect URI matches exactly in OAuth provider settings
   - Check that the domain matches (including www/non-www)

2. **Samsung Health "Permission Denied"**
   - Verify your Samsung Health app is approved
   - Check that required permissions are configured

3. **Session Not Persisting**
   - Verify cookies are being set correctly
   - Check that your domain supports cookies

4. **Database Errors**
   - Ensure migrations have been applied
   - Check D1 database bindings in wrangler.json

### Debug Mode

Add debug logging by setting:
```bash
wrangler secret put DEBUG_AUTH true
```

This will log additional authentication information to the console.

## User Experience

### For Anonymous Users
- Can view existing anonymous progress data
- See login prompts for enhanced features
- Cannot create/modify progress entries

### For Authenticated Users  
- Personal progress tracking separated from anonymous data
- Can link Samsung Health for automatic sync
- Samsung Health sync button in distance entry popups
- User profile display with sync status

### Samsung Health Integration
- One-click sync of daily walking/running distances
- Automatic conversion from meters to kilometers
- Overwrites manual entries when syncing
- Clear indication of synced vs manual entries