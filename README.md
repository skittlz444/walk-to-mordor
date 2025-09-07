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
