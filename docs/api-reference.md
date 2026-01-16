# API Reference

The API is served from the same domain as the application. All dates are generally ISO 8601 formatting or `YYYY-MM-DD`.

## Authentication

### `POST /api/register`
Register a new user.
- **Body**: `{ username, email, password }`
- **Response**: User object or error.

### `POST /api/login`
Log in an existing user.
- **Body**: `{ username, password }`
- **Response**: Sets session cookie.

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

### `POST /api/password-reset`
Complete password reset with token.
- **Body**: `{ token, newPassword }`

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
Retrieve the list of journey goals.
- **Response**: List of goals.
