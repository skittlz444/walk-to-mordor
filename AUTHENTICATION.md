# Authentication Implementation

## Overview
This implementation adds user authentication to the Walk to Mordor application, transforming it from a single-user app to a multi-user system with user registration, login, and session management.

## Features Implemented

### 1. User Registration
- **Endpoint**: `POST /api/register`
- **Required Fields**: username, email, password
- **Validation**:
  - Username: 3-30 characters, alphanumeric and underscores only
  - Email: Valid email format
  - Password: Minimum 8 characters with uppercase, lowercase, and number/symbol
- **First User**: Automatically approved and assigned all existing progress data
- **Subsequent Users**: Require manual approval via database before they can log in

### 2. User Login
- **Endpoint**: `POST /api/login`
- **Returns**: Session token, expiration date, user info
- **Session Duration**: 30 days
- **Storage**: Session token stored in localStorage for persistent login

### 3. Session Management
- **Validation**: All protected API endpoints require `Authorization: Bearer <token>` header
- **Automatic Redirect**: Unauthenticated users redirected to `/login` page
- **Session Check**: App validates session on page load

### 4. User Isolation
- **Progress Data**: Each user can only see and modify their own progress entries
- **Data Filtering**: All queries filtered by `user_id`
- **First User Migration**: Existing progress data automatically linked to first registered user

### 5. Security Features
- **Password Hashing**: PBKDF2 with 100,000 iterations and SHA-256
- **Unique Salts**: Each password gets a unique 16-byte salt
- **Secure Sessions**: 32-byte random session IDs
- **Protected Endpoints**: All data APIs require valid session token

## Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    approved INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);
```

### Progress Table (Updated)
```sql
CREATE TABLE progress (
    id INTEGER PRIMARY KEY,
    date DATE NOT NULL,
    distance REAL NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(date, user_id)
);
```

## API Endpoints

### Public Endpoints (No Authentication Required)
- `POST /api/register` - Register new user
- `POST /api/login` - Login and get session token
- `GET /login` - Login/registration page

### Protected Endpoints (Require Authentication)
- `GET /api/session` - Validate current session
- `POST /api/logout` - Logout and invalidate session
- `GET /api/calendar-progress` - Get user's progress entries
- `POST /api/calendar-progress` - Create progress entry
- `PUT /api/calendar-progress` - Update progress entry
- `DELETE /api/calendar-progress` - Delete progress entry
- `GET /api/goals` - Get goals list
- `GET /api/total-distance` - Get user's total distance

## Frontend Changes

### Login/Registration Page (`/login`)
- Clean, responsive UI with form validation
- Password strength indicator
- Toggle between login and registration forms
- Real-time validation feedback

### Main App Updates
- Session check on page load
- Automatic redirect to login if not authenticated
- Logout button in header
- Auth headers included in all API requests

### Client-Side Files
- `public/js/auth.js` - Login/registration logic
- `public/css/auth.css` - Authentication page styles
- `public/js/main.js` - Session validation and auth utilities

## Manual Approval Workflow

New users (except the first) require approval before they can log in:

1. User registers via `/login` page
2. System shows message: "Please wait for approval from the site owner"
3. Admin manually approves user in database:
   ```sql
   UPDATE users SET approved = 1 WHERE username = 'username';
   ```
4. User can now log in successfully

## Testing

### Manual Testing Completed ✓
- First user registration with auto-approval
- Subsequent user registration requiring approval
- Login with valid/invalid credentials
- Session validation
- Protected endpoint access
- Password/email/username validation
- User data isolation

### Unit Tests
- Password hashing and verification
- Session ID generation
- Email/password/username validation
- Session expiry checking

### API Tests
- Registration flow
- Login flow
- Session validation
- Protected endpoint access control

## Security Considerations

### Implemented
- PBKDF2 password hashing (100k iterations)
- Unique salts per password
- Secure session token generation (32 bytes)
- Server-side input validation
- 30-day session expiration
- Bearer token authentication

### Future Enhancements
- Rate limiting for login/registration
- Account lockout after failed attempts
- Password reset functionality
- Two-factor authentication
- Session refresh tokens
- HTTPS enforcement (handled at infrastructure level)

## Migration Path

The system handles migration automatically:
1. Run migration 0008: Creates users, sessions tables and adds user_id to progress
2. First user registration: Automatically links all existing progress data
3. New users: Start with empty progress

## Usage

### For End Users
1. Navigate to the app
2. If not logged in, redirected to `/login`
3. Register with username, email, password
4. Wait for approval (unless first user)
5. Login and start tracking progress

### For Administrators
1. Monitor new registrations
2. Approve users via database:
   ```sql
   SELECT id, username, email, approved, created_at FROM users WHERE approved = 0;
   UPDATE users SET approved = 1 WHERE id = <user_id>;
   ```

## Files Modified/Created

### Backend
- `src/auth-utils.ts` - Authentication utilities
- `src/auth-handlers.ts` - Auth API handlers
- `src/renderAuthPage.ts` - Login page HTML
- `src/index.ts` - Updated with auth routes
- `src/progress-handlers.ts` - Added user isolation
- `src/goals-handlers.ts` - Added user isolation
- `migrations/0008_create_authentication.sql` - Database schema
- `migrations/0009_link_existing_progress.sql` - Migration placeholder

### Frontend
- `public/js/auth.js` - Login/registration JavaScript
- `public/js/main.js` - Session management
- `public/js/progress.js` - Auth headers added
- `public/js/calendar.js` - Auth headers added
- `public/js/goals.js` - Auth headers added
- `public/css/auth.css` - Authentication styles
- `public/css/main.css` - Logout button styles

### Tests
- `tests/auth-utils.test.ts` - Unit tests for auth utilities
- `tests/api.auth.test.js` - API tests for auth endpoints
- `tests/goals-handlers.test.ts` - Updated for auth

## Known Limitations

1. No password reset functionality
2. No email verification
3. No rate limiting on login attempts
4. Manual approval process requires database access
5. Some existing unit tests need updating for auth context

## Future Improvements

1. Add password reset via email
2. Implement email verification
3. Add rate limiting
4. Create admin UI for user approval
5. Add user profile management
6. Implement password strength meter improvements
7. Add remember-me functionality
8. Support social login (OAuth)
