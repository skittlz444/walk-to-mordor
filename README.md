# Worker + D1 Database

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/d1-template)

![Worker + D1 Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/cb7cb0a9-6102-4822-633c-b76b7bb25900/public)

## Walk to Mordor Progress Tracker

This is a calendar-based progress tracking application built on Cloudflare Workers + D1. It features robust API error handling and validation.

## API Error Handling Features

The API now includes comprehensive error handling for all endpoints:

### Date Format Validation
- **Format**: Strictly validates `YYYY-MM-DD` format (e.g., `2024-01-15`)
- **Date Validation**: Ensures dates are real (handles leap years, month lengths, etc.)
- **Range Validation**: Year must be between 1000-9999
- **Error Response**: Returns specific error messages for invalid date formats

### Input Validation
- **Required Fields**: Validates all required fields are present
- **Distance Values**: Must be non-negative numbers with upper limit (< 1 billion)
- **JSON Parsing**: Handles malformed JSON with descriptive error messages
- **Empty Requests**: Rejects empty request bodies
- **Object Structure**: Ensures request body is a valid JSON object
- **HTTP Methods**: Validates allowed methods per endpoint (405 Method Not Allowed)

### Database Error Handling
- **Duplicate Entries**: POST returns 409 when entry already exists (with unique constraint)
- **Missing Entries**: PUT/DELETE return 404 when entry doesn't exist
- **Database Failures**: All database operations wrapped in try-catch with fallbacks
- **Transaction Safety**: Proper error responses for constraint violations

### Enhanced Error Messages
- **Specific Validation**: Different error messages for different validation failures
  - Invalid numbers vs negative numbers vs too large numbers
  - Missing fields vs invalid format vs malformed JSON
- **Helpful Context**: Error messages include examples and expected formats
- **HTTP Status Codes**: Proper status codes for different error types

### HTTP Status Codes
- `200`: Successful operations
- `201`: Successfully created new entry
- `400`: Invalid request data (validation errors)
- `404`: Entry not found (PUT/DELETE operations)
- `405`: Method not allowed
- `409`: Conflict (duplicate entry on POST)
- `500`: Internal server errors

### Response Format
All API responses return JSON with consistent structure:
```json
{
  "message": "Success message",
  "date": "2024-01-15",
  "distance": 42.5
}
```

Error responses:
```json
{
  "error": "Descriptive error message"
}
```

### Test Coverage
- 27 comprehensive test cases covering all error scenarios
- Valid edge cases (zero values, decimals, large numbers)
- Invalid input validation (malformed JSON, wrong types, out of range)
- HTTP method validation
- Database error conditions
- Automatic test data cleanup

<!-- dash-content-start -->

D1 is Cloudflare's native serverless SQL database ([docs](https://developers.cloudflare.com/d1/)). This project demonstrates using a Worker with a D1 binding to execute a SQL statement. A simple frontend displays the result of this query:

```SQL
SELECT * FROM comments LIMIT 3;
```

The D1 database is initialized with a `comments` table and this data:

```SQL
INSERT INTO comments (author, content)
VALUES
    ('Kristian', 'Congrats!'),
    ('Serena', 'Great job!'),
    ('Max', 'Keep up the good work!')
;
```

> [!IMPORTANT]
> When using C3 to create this project, select "no" when it asks if you want to deploy. You need to follow this project's [setup steps](https://github.com/cloudflare/templates/tree/main/d1-template#setup-steps) before deploying.

<!-- dash-content-end -->

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```
npm create cloudflare@latest -- --template=cloudflare/templates/d1-template
```

A live public deployment of this template is available at [https://d1-template.templates.workers.dev](https://d1-template.templates.workers.dev)

## Setup Steps

1. Install the project dependencies with a package manager of your choice:
   ```bash
   npm install
   ```
2. Create a [D1 database](https://developers.cloudflare.com/d1/get-started/) with the name "d1-template-database":
   ```bash
   npx wrangler d1 create d1-template-database
   ```
   ...and update the `database_id` field in `wrangler.json` with the new database ID.
3. Run the following db migration to initialize the database (notice the `migrations` directory in this project):
   ```bash
   npx wrangler d1 migrations apply --remote d1-template-database
   ```
4. Deploy the project!
   ```bash
   npm run deploy
   ```
   
   This will automatically run the build process to update the service worker cache version before deploying.

## Build Process

The project includes an automated build process that updates the service worker cache name with the current build timestamp. This ensures that each deployment gets a fresh cache and prevents cache conflicts between versions.

### Build Commands

- **`npm run build`** - Updates service worker cache version to current timestamp
- **`npm run deploy`** - Runs build process and deploys to Cloudflare
- **`npm run build:sw`** - Manually update service worker cache version
- **`npm run build:sw:reset`** - Reset service worker to development placeholder

### Cache Versioning

The service worker cache name uses the format: `walk-to-mordor-YYYYMMDD-HHMMSS`

Example: `walk-to-mordor-20250907-162757`

This ensures:
- Fresh cache for each deployment
- No conflicts between development and production
- Automatic cache invalidation on updates
- Better cache management across versions

## Testing & CI/CD

The project includes comprehensive GitHub Actions workflows for automated testing on pull requests. The PR workflow includes unit tests, API integration tests, and UI end-to-end tests to ensure code quality and reliability.

## Authentication and Samsung Health Integration

This application supports OAuth social login with Google and Samsung Health integration for automatic distance sync.

### Prerequisites

- A deployed Cloudflare Workers application
- Access to Google Developer Console
- Samsung Developer account (for Samsung Health integration)

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

### Samsung Health Integration Setup

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

### Environment Variables Setup

Add environment variables to your `wrangler.json`:

```json
{
  "vars": {
    "GOOGLE_CLIENT_ID": "your_google_client_id",
    "OAUTH_REDIRECT_URI": "https://yourdomain.com/wtm/",
    "SAMSUNG_HEALTH_CLIENT_ID": "your_samsung_health_client_id",
    "SAMSUNG_HEALTH_REDIRECT_URI": "https://yourdomain.com/wtm/"
  }
}
```

For production, use Cloudflare Workers secrets for sensitive values:

```bash
# Set OAuth secrets
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put SAMSUNG_HEALTH_CLIENT_SECRET
```

### Authentication Features

#### For Anonymous Users
- Can view existing anonymous progress data
- See login prompts for enhanced features
- Cannot create/modify progress entries

#### For Authenticated Users  
- Personal progress tracking separated from anonymous data
- Can link Samsung Health for automatic sync
- Samsung Health sync button in distance entry popups
- User profile display with sync status

#### Samsung Health Integration
- One-click sync of daily walking/running distances
- Automatic conversion from meters to kilometers
- Overwrites manual entries when syncing
- Clear indication of synced vs manual entries

### API Endpoints

The following authentication API endpoints are available:

#### Authentication
- `GET /wtm/api/auth/google` - Get Google OAuth URL
- `POST /wtm/api/auth/callback` - Handle OAuth callback
- `POST /wtm/api/auth/logout` - Logout user
- `POST /wtm/api/auth/refresh` - Refresh user session

#### Samsung Health
- `GET /wtm/api/samsung-health/link` - Get Samsung Health OAuth URL
- `POST /wtm/api/samsung-health/callback` - Handle Samsung Health callback
- `POST /wtm/api/sync/samsung-health` - Sync daily distance data

#### Progress (Now User-Specific)
- `GET /wtm/api/calendar-progress` - Get user's progress (anonymous if not logged in)
- `POST /wtm/api/calendar-progress` - Create progress entry (requires auth)
- `PUT /wtm/api/calendar-progress` - Update progress entry (requires auth)
- `DELETE /wtm/api/calendar-progress` - Delete progress entry (requires auth)

### Security Considerations

1. **HTTPS Required**: OAuth flows require HTTPS in production
2. **Secrets Management**: Never commit OAuth secrets to version control
3. **Session Security**: Sessions are stored as HTTP-only cookies
4. **Token Encryption**: In production, encrypt stored OAuth tokens
5. **CSRF Protection**: OAuth state parameters prevent CSRF attacks
