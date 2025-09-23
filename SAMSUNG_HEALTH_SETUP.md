# Samsung Health Integration Setup Guide

This guide explains how to set up and configure the Samsung Health integration for the Walk to Mordor application.

## Overview

The Samsung Health integration allows users to automatically sync their daily walking distances from Samsung Health into the Walk to Mordor tracking system. This feature includes:

- OAuth-based secure authentication with Samsung Health
- Encrypted storage of user tokens
- Manual sync of walking data for specific dates
- Visual indicators for Samsung Health synced entries
- Complete account unlinking functionality

## Prerequisites

1. **Samsung Health Developer Account** - Required for production use
2. **Samsung Health App Registration** - Register your app with Samsung Health
3. **SSL Certificate** - Samsung Health requires HTTPS endpoints for production

## Development vs Production Setup

### Development Mode (Current Implementation)

The current implementation includes a **mock Samsung Health service** that simulates the Samsung Health API for development and testing purposes.

**Mock Features:**
- Simulated OAuth flow with demo authorization
- Deterministic walking distance generation based on dates
- No actual Samsung Health API calls
- Perfect for development and testing

### Production Setup

For production deployment, you'll need to:

1. Register with Samsung Health Developer Program
2. Obtain real API credentials
3. Configure production environment variables
4. Replace mock service calls with real API calls

## Configuration

### Environment Variables

Set the following environment variables in your Cloudflare Workers environment:

```bash
# Samsung Health API Credentials (Production)
SAMSUNG_HEALTH_CLIENT_ID=your_samsung_health_client_id
SAMSUNG_HEALTH_CLIENT_SECRET=your_samsung_health_client_secret

# Encryption Key for Token Storage (32 characters minimum)
SAMSUNG_HEALTH_ENCRYPTION_KEY=your_32_character_encryption_key_here
```

**For development**, these default to mock values:
- `SAMSUNG_HEALTH_CLIENT_ID`: `mock_client_id`
- `SAMSUNG_HEALTH_CLIENT_SECRET`: `mock_client_secret`
- `SAMSUNG_HEALTH_ENCRYPTION_KEY`: `default_encryption_key_32_chars`

### Cloudflare Workers Configuration

In your `wrangler.toml`, add the environment variables:

```toml
[env.production.vars]
SAMSUNG_HEALTH_CLIENT_ID = "your_production_client_id"
SAMSUNG_HEALTH_CLIENT_SECRET = "your_production_client_secret"
SAMSUNG_HEALTH_ENCRYPTION_KEY = "your_secure_32_character_key"

[env.staging.vars]
SAMSUNG_HEALTH_CLIENT_ID = "your_staging_client_id"
SAMSUNG_HEALTH_CLIENT_SECRET = "your_staging_client_secret"
SAMSUNG_HEALTH_ENCRYPTION_KEY = "your_secure_32_character_key"
```

## Samsung Health Developer Setup (Production)

### Step 1: Samsung Health Developer Registration

1. Visit [Samsung Health Developer Portal](https://developer.samsung.com/health)
2. Create a Samsung developer account
3. Apply for Samsung Health API access
4. Wait for approval (can take several days)

### Step 2: App Registration

1. Log in to Samsung Health Developer Console
2. Create a new app registration
3. Configure app details:
   - **App Name**: Walk to Mordor
   - **App Type**: Web Application
   - **Redirect URI**: `https://yourdomain.com/wtm/api/samsung-health/callback`
   - **Permissions**: Read health data (steps/distance)

### Step 3: API Credentials

After approval, you'll receive:
- **Client ID**: Used for OAuth authorization
- **Client Secret**: Used for token exchange
- **API Endpoints**: Samsung Health API base URLs

## Database Schema

The integration adds the following fields to the `users` table:

```sql
-- Samsung Health integration fields
ALTER TABLE users ADD COLUMN samsung_health_token TEXT;           -- Encrypted access token
ALTER TABLE users ADD COLUMN samsung_health_refresh_token TEXT;   -- Encrypted refresh token  
ALTER TABLE users ADD COLUMN samsung_health_linked_at DATETIME;   -- Link timestamp

-- Progress tracking sync source
ALTER TABLE progress ADD COLUMN sync_source TEXT DEFAULT 'manual' 
  CHECK (sync_source IN ('manual', 'samsung_health'));
```

## API Endpoints

### User Authentication Required

All Samsung Health endpoints require user authentication via session cookie.

### GET /wtm/api/samsung-health/status

Check if user has linked Samsung Health account.

**Response:**
```json
{
  "isLinked": false,
  "linkedAt": null
}
```

### GET /wtm/api/samsung-health/auth-url

Generate Samsung Health OAuth authorization URL.

**Response:**
```json
{
  "authUrl": "https://account.samsung.com/accounts/oauth/authorize?...",
  "state": "user_123_1640995200000"
}
```

### POST /wtm/api/samsung-health/callback

Complete OAuth flow and link account.

**Request:**
```json
{
  "authCode": "authorization_code_from_samsung",
  "state": "user_123_1640995200000"
}
```

**Response:**
```json
{
  "message": "Samsung Health account linked successfully",
  "linkedAt": "2024-01-15T10:30:00.000Z"
}
```

### POST /wtm/api/samsung-health/sync

Sync walking distance for a specific date.

**Request:**
```json
{
  "date": "2024-01-15"
}
```

**Response:**
```json
{
  "date": "2024-01-15",
  "distance": 5.2,
  "syncedAt": "2024-01-15T10:30:00.000Z"
}
```

### POST /wtm/api/samsung-health/unlink

Unlink Samsung Health account.

**Response:**
```json
{
  "message": "Samsung Health account unlinked successfully"
}
```

## Security Considerations

### Token Encryption

All Samsung Health tokens are encrypted using AES-GCM encryption before storage:

- **Algorithm**: AES-GCM with 256-bit keys
- **IV**: Randomly generated for each encryption
- **Storage**: Encrypted tokens stored in database
- **Key Management**: Encryption key via environment variable

### OAuth Security

- **State Parameter**: Prevents CSRF attacks
- **HTTPS Required**: Production requires SSL/TLS
- **Token Refresh**: Automatic token refresh when expired
- **Scope Limitation**: Only request necessary permissions

### Data Privacy

- **Minimal Data**: Only sync walking distance/steps
- **User Control**: Users can unlink at any time
- **No Storage**: Raw Samsung Health data not permanently stored
- **Encryption**: All tokens encrypted at rest

## User Flow

### Linking Account

1. User clicks "Link Samsung Health" in dropdown menu
2. System generates OAuth authorization URL
3. User shown linking modal with authorization info
4. User redirects to Samsung Health (or mock in development)
5. User authorizes access to walking data
6. Samsung Health redirects back with authorization code
7. System exchanges code for access/refresh tokens
8. Tokens encrypted and stored in database
9. User account marked as linked

### Syncing Data

1. User opens distance input modal for a date
2. If Samsung Health linked, sync button appears
3. User clicks "Sync from Samsung Health"
4. System calls Samsung Health API with date
5. Walking distance retrieved and populated in input
6. User can review/modify distance before saving
7. Entry saved with `sync_source: 'samsung_health'`
8. Calendar shows dot indicator for synced entries

### Unlinking Account

1. User clicks "Unlink Samsung Health" in dropdown
2. System revokes tokens with Samsung Health
3. Database tokens and link timestamp cleared
4. User can no longer sync data
5. Previous synced entries remain (with indicators)

## Troubleshooting

### Common Issues

#### "Samsung Health account not linked"
- User needs to complete linking process first
- Check if tokens were properly stored
- Verify encryption key is consistent

#### "Failed to sync data"
- Check if access token expired
- System should auto-refresh, but may fail
- User may need to re-link account

#### "Invalid Samsung Health token"
- Token decryption failed
- Encryption key may have changed  
- User should unlink and re-link account

### Development Issues

#### Mock Service Not Working
- Ensure development server restarted after changes
- Check console for initialization errors
- Verify mock credentials in use

#### API Tests Failing
- Ensure development server is running
- Check if database migrations applied
- Verify test user registration working

### Production Issues

#### OAuth Redirect Errors
- Verify redirect URI matches registered value
- Ensure HTTPS is used for production
- Check Samsung Health app configuration

#### API Rate Limiting
- Samsung Health may have rate limits
- Implement appropriate retry logic
- Consider caching strategies

## Testing

### Mock Testing (Development)

The mock service provides consistent testing data:

```javascript
// Test auth code
const authCode = 'mock_auth_code';

// Test distance data (deterministic based on date)
const date = '2024-01-15';
const expectedDistance = 3.8; // Based on date algorithm
```

### Integration Testing

Run the full test suite:

```bash
# Unit tests
npm run test:unit

# API tests (requires dev server)
npm run dev  # In one terminal
npm run test:api:all  # In another terminal

# Coverage report
npm run test:coverage
```

### Manual Testing

1. Start development server: `npm run dev`
2. Navigate to `http://localhost:8787/wtm/`
3. Register/login to user account
4. Click user dropdown → "Link Samsung Health"
5. Follow mock authorization flow
6. Try syncing data for different dates
7. Verify visual indicators on calendar
8. Test unlinking functionality

## Future Enhancements

### Planned Features

- **Automatic Daily Sync**: Background sync of daily distances
- **Bulk Sync**: Sync multiple days at once
- **Activity Types**: Support for different activity types
- **Sync History**: Track sync operations and conflicts
- **Data Validation**: Compare manual vs synced entries

### Technical Improvements

- **Real-time Sync**: WebSocket integration for live updates
- **Offline Support**: Queue sync operations when offline
- **Conflict Resolution**: Handle manual vs synced data conflicts  
- **Advanced Encryption**: Key rotation and enhanced security
- **Monitoring**: Usage analytics and error tracking

## Support

For issues with Samsung Health integration:

1. Check this documentation first
2. Review console logs for errors
3. Test with mock service in development
4. File issues with detailed reproduction steps
5. Include relevant log excerpts (sanitized)

For Samsung Health API issues:
- Consult Samsung Health Developer Documentation
- Check Samsung Developer Forums
- Contact Samsung Health API support