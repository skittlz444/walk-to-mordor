# Walk to Mordor 🧙‍♂️

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/d1-template)

![Walk to Mordor App Preview](https://github.com/user-attachments/assets/42f0fa4c-2d85-49be-a641-fd134ee55d5a)

## Project Description

**Walk to Mordor** is a fitness tracking Progressive Web App (PWA) inspired by J.R.R. Tolkien's *The Lord of the Rings*. This application gamifies your daily walking or running routine by mapping your exercise distances to the epic journey from Bag End to Mount Doom and back again.

Track your real-world exercise progress as you virtually follow in the footsteps of Frodo and Sam on their legendary quest. Every kilometer you walk in real life advances you along the 6,425 km (3,991 mile) round trip from the Shire to Mordor, complete with 191+ milestone markers from the books.

### Project Goals

- **Gamify Fitness**: Transform daily exercise into an epic adventure through Middle-earth
- **Long-term Motivation**: Provide a meaningful, story-driven goal that takes months or years to complete
- **Literary Connection**: Create an immersive experience that connects physical activity with beloved literature
- **Progress Visualization**: Offer clear milestones and progress tracking to maintain motivation
- **Accessibility**: Provide a modern, responsive web application that works on all devices

### What It Does

🚶‍♂️ **Daily Progress Tracking**: Log your daily walking/running distances through an intuitive calendar interface

📍 **Literary Milestones**: Unlock 191+ story locations from Bag End to Mount Doom with rich descriptions from the books

📊 **Visual Progress**: See your cumulative distance and track how far you've traveled on the epic journey

🏆 **Achievement System**: Reach major story milestones like crossing the Brandywine River, arriving at Rivendell, or entering Mordor

📱 **Progressive Web App**: Install on your phone or desktop for offline access and native app-like experience

🎯 **Goal Management**: View upcoming milestones and track your progress toward major story events

The complete journey covers **6,425 kilometers (3,991 miles)** - a substantial fitness goal that provides months or years of motivation while reliving one of literature's greatest adventures.

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
- 236 comprehensive test cases across unit, API, and UI testing
- 96%+ code coverage with automated validation
- Valid edge cases (zero values, decimals, large numbers)
- Invalid input validation (malformed JSON, wrong types, out of range)
- HTTP method validation and database error conditions
- Automatic test data cleanup and isolation

## Features

### 📅 Daily Progress Tracking
- **Calendar Interface**: Log daily walking/running distances with an intuitive calendar
- **Flexible Input**: Enter distances in kilometers with decimal precision (e.g., 5.25 km)
- **Edit & Delete**: Modify or remove entries as needed
- **Cumulative Tracking**: Automatic calculation of total distance traveled

### 🗺️ Interactive Journey Map
- **191+ Story Milestones**: From Bag End through Rivendell, Moria, Lothlórien, to Mount Doom and back
- **Rich Descriptions**: Each milestone includes detailed descriptions from Tolkien's writings
- **Progress Visualization**: See exactly where you are on the journey and what's coming next
- **Achievement System**: Unlock major story locations as you progress

### 🏆 Milestone Goals
The journey includes major checkpoints from the books:
- **Bag End to Rivendell**: 458 km (Challenge 1)
- **Rivendell to Lothlórien**: 684 km (Challenge 2) 
- **Through Moria and beyond**: Multiple story arcs
- **Mount Doom**: The ultimate destination at 1,779 km
- **Return Journey**: Complete the round trip back to Bag End (6,425 km total)

### 📱 Progressive Web App
- **Offline Support**: Works without internet connection once installed
- **Mobile Optimized**: Responsive design for phones, tablets, and desktop
- **App Installation**: Install directly to your device's home screen
- **Service Worker**: Automatic updates and background sync

### 🛡️ Robust Architecture
- **Error Handling**: Comprehensive validation for all user inputs
- **Data Safety**: Automatic backups and conflict resolution
- **Performance**: Serverless architecture with global edge distribution
- **Testing**: 236 automated tests ensuring reliability

## How to Use

1. **Start Tracking**: Click on any date in the calendar to log your daily walking distance
2. **View Progress**: See your total distance at the top of the screen
3. **Explore Milestones**: Click on upcoming goals to read about the next story locations
4. **Stay Motivated**: Watch your progress advance through Middle-earth's most famous locations
5. **Track Long-term**: The complete journey provides months or years of fitness motivation

Whether you're a casual walker aiming for 2-3 km per day or a dedicated runner covering 10+ km daily, the journey scales to your fitness level while providing consistent motivation through Tolkien's beloved story.

## Technology Stack

Built with modern web technologies for performance, reliability, and scalability:

- **Runtime**: Cloudflare Workers (serverless edge computing)
- **Database**: Cloudflare D1 (SQLite-based serverless SQL)
- **Frontend**: Progressive Web App with offline capabilities
- **Testing**: Jest (unit), Supertest (API), Playwright (E2E browser testing)
- **Deployment**: Automated CI/CD with GitHub Actions

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or pnpm package manager
- Cloudflare account (for deployment)

### Local Development Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Initialize local database**:
   ```bash
   npx wrangler d1 migrations apply DB --local
   ```
   This creates the local SQLite database with progress tracking tables and 191+ story milestones.

3. **Start development server**:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:8787/wtm/`

4. **Run tests** (optional):
   ```bash
   npm run test:unit      # Fast unit tests (3 seconds)
   npm run test:coverage  # Unit tests with coverage report
   ```

### Production Deployment

1. **Create Cloudflare D1 database**:
   ```bash
   npx wrangler d1 create walk-to-mordor-db
   ```
   Update the `database_id` in `wrangler.json` with the returned database ID.

2. **Initialize production database**:
   ```bash
   npx wrangler d1 migrations apply DB --remote
   ```

3. **Deploy to Cloudflare Workers**:
   ```bash
   npm run deploy
   ```
   This automatically updates the service worker cache version and deploys the application.

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
