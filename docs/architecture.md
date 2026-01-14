# Architecture Overview

## System Architecture

The "Walk to Mordor" application adopts a **Serverless Monolith** architecture hosted on Cloudflare's edge network.

```mermaid
graph TD
    User[User Browser] <-->|HTTPS| CF[Cloudflare Worker];
    CF <-->|SQL| D1[(D1 Database)];
    CF -->|Serve| Static[Static Assets (KV/Assets)];
    CF -->|Render| SSR[SSR HTML];
```

### Components

1.  **Cloudflare Worker (`src/index.ts`)**:
    -   Serves as the main entry point.
    -   Handles HTTP routing for both API and Page requests.
    -   Performs Server-Side Rendering (SSR) for initial HTML content.
    -   Manages authentication and session validation.

2.  **Database (D1)**:
    -   SQLite-based serverless database.
    -   Stores Users, Sessions, Progress logs, and Goals.
    -   Managed via SQL migrations in `migrations/`.

3.  **Frontend (SSR + Hydration)**:
    -   **SSR**: The Worker generates the initial HTML shell (head, body structure) populated with dynamic data where possible.
    -   **Hydration**: Vanilla JavaScript modules (`public/js/*.js`) attach event listeners and handle dynamic interactions (calendar updates, modals) on the client side.

4.  **Static Assets**:
    -   Images, CSS, and Client-side JS are served from the `public/` directory via Cloudflare Assets.

## Security Architecture

-   **Authentication**: Custom username/password auth.
    -   Passwords hashed using PBKDF2 (likely, based on `salt` and `password_hash` fields).
    -   Session-based auth using `sessions` table and cookies.
-   **Authorization**: Endpoint protection ensuring users can only access/modify their own data (User Isolation).
-   **Input Validation**: Server-side validation using `validators.ts`.

## Deployment

-   Deployed via `wrangler`.
-   Configuration: `wrangler.json`.
