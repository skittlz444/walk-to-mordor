# API Reference

The API is served from the same domain as the application. All dates use ISO 8601 formatting or `YYYY-MM-DD`.

## Authentication

### `POST /api/register`
Register a new user. Sends a confirmation email to activate the account.
- **Body**: `{ username, email, password }`
- **Response**: Success message prompting user to check email. Account is inactive until confirmed.
- **Rate Limit**: 3 confirmation emails per hour per user.

### `POST /api/login`
Log in an existing user.
- **Body**: `{ username, password }`
- **Response**: Sets session cookie.
- **Note**: Returns error if email is not yet verified.

### `POST /api/logout`
Log out the current user.
- **Response**: Clears session.

### `GET /api/session`
Validate current session.
- **Headers**: Requires Session Cookie.
- **Response**: `{ valid: boolean, user: { ... } }`

### `POST /api/password-reset-request`
Request a password reset email.
- **Body**: `{ email }`
- **Rate Limit**: 3 reset emails per hour.

### `POST /api/password-reset`
Complete password reset with token.
- **Body**: `{ token, newPassword }`

### `GET /confirm-email`
Confirm a user's email address via token (sent in confirmation email link).
- **Query**: `?token=<confirmation_token>`
- **Response**: Activates the account (sets `email_verified = 1`) and redirects to login.
- **Errors**: Returns error for expired or invalid tokens.

### `POST /api/resend-confirmation`
Resend the email confirmation link.
- **Body**: `{ email }`
- **Rate Limit**: 3 resend attempts per hour per user.

## User Profile

### `PUT /api/profile`
Update user profile details.
- **Headers**: Requires Auth.
- **Body**: Profile fields.

## Progress Tracking

### `GET /api/calendar-progress`
Get walking history.
- **Headers**: Requires Auth.
- **Response**: Array of progress entries.

### `POST /api/calendar-progress`
Log a new walking entry.
- **Headers**: Requires Auth.
- **Body**: `{ date, distance }`

### `PUT /api/calendar-progress`
Update an existing entry.
- **Headers**: Requires Auth.
- **Body**: `{ id, date, distance }`

### `DELETE /api/calendar-progress`
Remove an entry.
- **Headers**: Requires Auth.
- **Body**: `{ id }`

### `GET /api/total-distance`
Get the user's total calculated distance.
- **Headers**: Requires Auth.
- **Response**: `{ totalDistance: number }`

## Goals

### `GET /api/goals`
Retrieve the list of journey goals (milestones).
- **Response**: Array of goals with `id`, `distance`, `title`, `description`, `special`, `image_id`.
