import { renderHtml } from "./renderHtml";
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod, 
  createErrorResponse, 
  createSuccessResponse 
} from "./validators";
import { 
  requiresAuth, 
  authenticateRequest, 
  createAuthError, 
  createSessionCookie, 
  createLogoutCookie 
} from "./auth/middleware";
import { 
  User, 
  getUserBySession, 
  extractSessionId, 
  createSession, 
  deleteSession 
} from "./auth/session";
import { 
  getOAuthProvider, 
  generateAuthUrl, 
  completeOAuthFlow 
} from "./auth/oauth";
import { 
  getSamsungHealthConfig, 
  generateSamsungHealthAuthUrl, 
  exchangeSamsungHealthCode, 
  linkSamsungHealthAccount, 
  syncSamsungHealthData 
} from "./auth/samsung-health";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    let body: any = undefined;
    let user: User | null = null;

    // Only serve static assets for GET/HEAD requests
    if (method === "GET" || method === "HEAD") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    // Check if endpoint requires authentication
    if (requiresAuth(url.pathname, method)) {
      const authResult = await authenticateRequest(request, env.DB);
      if (!authResult.user) {
        return createAuthError(authResult.error || 'Authentication required');
      }
      user = authResult.user;
    } else if (url.pathname.startsWith("/wtm/api/")) {
      // For non-protected API endpoints, try to get user if available (for context)
      const authResult = await authenticateRequest(request, env.DB);
      user = authResult.user; // May be null, which is fine
    }

    // Updated method validation to include new endpoints
    if (url.pathname.startsWith("/wtm/api/")) {
      const validEndpoints = [
        '/wtm/api/calendar-progress',
        '/wtm/api/goals',
        '/wtm/api/auth/google',
        '/wtm/api/auth/callback',
        '/wtm/api/auth/logout',
        '/wtm/api/auth/refresh',
        '/wtm/api/samsung-health/link',
        '/wtm/api/samsung-health/callback',
        '/wtm/api/sync/samsung-health'
      ];
      
      if (!isValidMethod(url.pathname, method) && !validEndpoints.includes(url.pathname)) {
        return new Response(JSON.stringify({ 
          error: `Method ${method} not allowed for ${url.pathname}`,
          allowedMethods: url.pathname === "/wtm/api/calendar-progress" 
            ? ['GET', 'POST', 'PUT', 'DELETE'] 
            : ['GET']
        }), { 
          status: 405,
          headers: { 
            "content-type": "application/json",
            "Allow": url.pathname === "/wtm/api/calendar-progress" 
              ? "GET, POST, PUT, DELETE" 
              : "GET"
          }
        });
      }
    }

    // Only read body for API endpoints that need it
    if (
      url.pathname === "/wtm/api/calendar-progress" &&
      (method === "POST" || method === "PUT" || method === "DELETE")
    ) {
      const parseResult = await safeJsonParse(request);
      if (!parseResult.success) {
        return new Response(JSON.stringify({ 
          error: parseResult.error || 'Invalid request body' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      body = parseResult.data;
    }

    // OAuth Authentication Endpoints
    if (url.pathname === "/wtm/api/auth/google" && method === "GET") {
      const provider = 'google';
      const oauthProvider = getOAuthProvider(provider, env);
      
      if (!oauthProvider || !oauthProvider.clientId) {
        return new Response(JSON.stringify({ 
          error: `${provider} OAuth not configured` 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }

      const state = crypto.randomUUID(); // Anti-CSRF state parameter
      const authUrl = generateAuthUrl(oauthProvider, state);
      
      // Store state in session or return it to frontend to handle
      return new Response(JSON.stringify({ 
        authUrl,
        state 
      }), {
        headers: { "content-type": "application/json" }
      });
    }

    // OAuth Callback Endpoint
    if (url.pathname === "/wtm/api/auth/callback" && method === "POST") {
      const parseResult = await safeJsonParse(request);
      if (!parseResult.success) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request body' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      const { provider, code, state } = parseResult.data;
      
      if (!provider || !code) {
        return new Response(JSON.stringify({ 
          error: 'Missing provider or authorization code' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      try {
        const result = await completeOAuthFlow(env.DB, provider, code, env);
        
        if (!result) {
          return new Response(JSON.stringify({ 
            error: 'OAuth authentication failed' 
          }), { 
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }

        const { user, sessionId } = result;
        const isSecure = url.protocol === 'https:';
        
        return new Response(JSON.stringify({ 
          success: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            samsung_health_linked: !!user.samsung_health_linked_at
          }
        }), {
          status: 200,
          headers: { 
            "content-type": "application/json",
            "Set-Cookie": createSessionCookie(sessionId, isSecure)
          }
        });
      } catch (error) {
        console.error('OAuth callback error:', error);
        return new Response(JSON.stringify({ 
          error: 'Authentication failed' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    // Logout Endpoint
    if (url.pathname === "/wtm/api/auth/logout" && method === "POST") {
      const sessionId = extractSessionId(request);
      if (sessionId) {
        await deleteSession(env.DB, sessionId);
      }
      
      return new Response(JSON.stringify({ 
        success: true 
      }), {
        status: 200,
        headers: { 
          "content-type": "application/json",
          "Set-Cookie": createLogoutCookie()
        }
      });
    }

    // Refresh Session Endpoint
    if (url.pathname === "/wtm/api/auth/refresh" && method === "POST") {
      const sessionId = extractSessionId(request);
      const currentUser = sessionId ? await getUserBySession(env.DB, sessionId) : null;
      
      if (!currentUser) {
        return createAuthError('Invalid session');
      }

      return new Response(JSON.stringify({ 
        user: {
          id: currentUser.id,
          email: currentUser.email,
          name: currentUser.name,
          samsung_health_linked: !!currentUser.samsung_health_linked_at
        }
      }), {
        headers: { "content-type": "application/json" }
      });
    }

    // Samsung Health Link Endpoint
    if (url.pathname === "/wtm/api/samsung-health/link" && method === "GET") {
      if (!user) {
        return createAuthError('Authentication required');
      }

      const config = getSamsungHealthConfig(env);
      if (!config.clientId) {
        return new Response(JSON.stringify({ 
          error: 'Samsung Health not configured' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }

      const state = crypto.randomUUID();
      const authUrl = generateSamsungHealthAuthUrl(config, state);
      
      return new Response(JSON.stringify({ 
        authUrl,
        state 
      }), {
        headers: { "content-type": "application/json" }
      });
    }

    // Samsung Health Callback Endpoint
    if (url.pathname === "/wtm/api/samsung-health/callback" && method === "POST") {
      if (!user) {
        return createAuthError('Authentication required');
      }

      const parseResult = await safeJsonParse(request);
      if (!parseResult.success) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request body' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      const { code } = parseResult.data;
      if (!code) {
        return new Response(JSON.stringify({ 
          error: 'Missing authorization code' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      try {
        const config = getSamsungHealthConfig(env);
        const tokenResult = await exchangeSamsungHealthCode(config, code);
        
        if (!tokenResult) {
          return new Response(JSON.stringify({ 
            error: 'Failed to exchange authorization code' 
          }), { 
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }

        const success = await linkSamsungHealthAccount(
          env.DB,
          user.id,
          tokenResult.access_token,
          tokenResult.refresh_token
        );

        if (!success) {
          return new Response(JSON.stringify({ 
            error: 'Failed to link Samsung Health account' 
          }), { 
            status: 500,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          message: 'Samsung Health account linked successfully'
        }), {
          headers: { "content-type": "application/json" }
        });
      } catch (error) {
        console.error('Samsung Health callback error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to link Samsung Health account' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    // Samsung Health Sync Endpoint
    if (url.pathname === "/wtm/api/sync/samsung-health" && method === "POST") {
      if (!user) {
        return createAuthError('Authentication required');
      }

      const parseResult = await safeJsonParse(request);
      if (!parseResult.success) {
        return new Response(JSON.stringify({ 
          error: 'Invalid request body' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      const { date } = parseResult.data;
      if (!date || !isValidDateFormat(date)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid or missing date. Expected format: YYYY-MM-DD' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      try {
        const config = getSamsungHealthConfig(env);
        const result = await syncSamsungHealthData(env.DB, user, date, config);
        
        if (!result.success) {
          return new Response(JSON.stringify({ 
            error: result.error || 'Sync failed' 
          }), { 
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }

        return new Response(JSON.stringify({ 
          success: true,
          distance: result.distance,
          message: `Synced ${result.distance} km from Samsung Health`
        }), {
          headers: { "content-type": "application/json" }
        });
      } catch (error) {
        console.error('Samsung Health sync error:', error);
        return new Response(JSON.stringify({ 
          error: 'Sync failed' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    // CRUD for calendar events
    if (url.pathname === "/wtm/api/calendar-progress" && method === "POST") {
      const { start, title } = body || {};
      
      // Validate required fields
      if (!start) {
        return new Response(JSON.stringify({ 
          error: 'Missing required field: start (date)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      
      if (typeof title === 'undefined') {
        return new Response(JSON.stringify({ 
          error: 'Missing required field: title (distance)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Validate date format
      if (!isValidDateFormat(start)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Validate distance value with specific error messages
      if (!isValidDistance(title)) {
        const num = Number(title);
        if (isNaN(num) || !isFinite(num)) {
          return new Response(JSON.stringify({ 
            error: 'Invalid distance value. Must be a valid number' 
          }), { 
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }
        if (num < 0) {
          return new Response(JSON.stringify({ 
            error: 'Invalid distance value. Must be non-negative (0 or greater)' 
          }), { 
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }
        if (num > 999999999) {
          return new Response(JSON.stringify({ 
            error: 'Invalid distance value. Must be less than 1 billion' 
          }), { 
            status: 400,
            headers: { "content-type": "application/json" }
          });
        }
        return new Response(JSON.stringify({ 
          error: 'Invalid distance value. Must be a non-negative number' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      try {
        await env.DB.prepare(
          "INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)"
        )
          .bind(start, Number(title), user?.id || null)
          .run();
        return new Response(JSON.stringify({ 
          message: "Created successfully",
          date: start,
          distance: Number(title)
        }), { 
          status: 201,
          headers: { "content-type": "application/json" }
        });
      } catch (error: any) {
        // Handle database errors
        console.error('Database error during INSERT:', error);
        if (error.message?.includes('UNIQUE constraint failed') || 
            error.message?.includes('UNIQUE constraint') ||
            error.cause?.message?.includes('UNIQUE constraint') ||
            error.toString().includes('UNIQUE constraint')) {
          return new Response(JSON.stringify({ 
            error: 'An entry for this date already exists. Use PUT to update instead.' 
          }), { 
            status: 409,
            headers: { "content-type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({ 
          error: 'Internal server error while creating entry' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    } else if (url.pathname === "/wtm/api/calendar-progress" && method === "PUT") {
      const { start, title } = body || {};
      
      // Validate required fields
      if (!start) {
        return new Response(JSON.stringify({ 
          error: 'Missing required field: start (date)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }
      
      if (typeof title === 'undefined') {
        return new Response(JSON.stringify({ 
          error: 'Missing required field: title (distance)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Validate date format
      if (!isValidDateFormat(start)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Validate distance value
      if (!isValidDistance(title)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid distance value. Must be a non-negative number' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      try {
        const result = await env.DB.prepare(
          "UPDATE progress SET distance = ?, updated_at = datetime('now') WHERE date = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))"
        )
          .bind(Number(title), start, user?.id || null, user?.id || null)
          .run();
          
        if (result.meta.changes === 0) {
          return new Response(JSON.stringify({ 
            error: 'No entry found for the specified date. Use POST to create a new entry.' 
          }), { 
            status: 404,
            headers: { "content-type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({ 
          message: "Updated successfully",
          date: start,
          distance: Number(title)
        }), { 
          status: 200,
          headers: { "content-type": "application/json" }
        });
      } catch (error: any) {
        console.error('Database error during UPDATE:', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error while updating entry' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    } else if (url.pathname === "/wtm/api/calendar-progress" && method === "DELETE") {
      const { start } = body || {};
      
      // Validate required field
      if (!start) {
        return new Response(JSON.stringify({ 
          error: 'Missing required field: start (date)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      // Validate date format
      if (!isValidDateFormat(start)) {
        return new Response(JSON.stringify({ 
          error: 'Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)' 
        }), { 
          status: 400,
          headers: { "content-type": "application/json" }
        });
      }

      try {
        console.log("Deleting date:", start);
        const result = await env.DB.prepare(
          "DELETE FROM progress WHERE date = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))"
        )
          .bind(start, user?.id || null, user?.id || null)
          .run();
          
        if (result.meta.changes === 0) {
          return new Response(JSON.stringify({ 
            error: 'No entry found for the specified date' 
          }), { 
            status: 404,
            headers: { "content-type": "application/json" }
          });
        }
        
        return new Response(JSON.stringify({ 
          message: "Deleted successfully",
          date: start
        }), { 
          status: 200,
          headers: { "content-type": "application/json" }
        });
      } catch (error: any) {
        console.error('Database error during DELETE:', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error while deleting entry' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    } else if (url.pathname === "/wtm/api/calendar-progress") {
      try {
        // Return progress entries for the current user, or all anonymous entries if no user
        let query: string;
        let bind: any[];
        if (user) {
          query = "SELECT * FROM progress WHERE user_id = ? ORDER BY date";
          bind = [user.id];
        } else {
          query = "SELECT * FROM progress WHERE user_id IS NULL ORDER BY date";
          bind = [];
        }
        
        const { results } = await env.DB.prepare(query).bind(...bind).all();
        const calendarData = (results as Array<{ 
          date: string; 
          distance: number; 
          synced_from_samsung?: boolean 
        }>).map(row => ({
          start: row.date,
          title: row.distance.toString(),
          synced: row.synced_from_samsung || false
        }));
        return new Response(JSON.stringify(calendarData), {
          headers: { "content-type": "application/json" },
        });
      } catch (error: any) {
        console.error('Database error during SELECT (calendar-progress):', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error while retrieving calendar progress' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    } else if (url.pathname === "/wtm/api/goals") {
      try {
        const { results } = await env.DB.prepare("SELECT * FROM goals").all();
        // Return all goals as array of {distance, title, special}
        return new Response(JSON.stringify(results), {
          headers: { "content-type": "application/json" },
        });
      } catch (error: any) {
        console.error('Database error during SELECT (goals):', error);
        return new Response(JSON.stringify({ 
          error: 'Internal server error while retrieving goals' 
        }), { 
          status: 500,
          headers: { "content-type": "application/json" }
        });
      }
    }

    // Render main HTML page
    try {
      // Calculate total distance for the current user (or anonymous if no user)
      let query: string;
      let bind: any[];
      if (user) {
        query = "SELECT * FROM progress WHERE user_id = ?";
        bind = [user.id];
      } else {
        query = "SELECT * FROM progress WHERE user_id IS NULL";
        bind = [];
      }
      
      const { results } = await env.DB.prepare(query).bind(...bind).all();
      const totalDistance = Number(
        (results as Array<{ distance: number }>).reduce(
          (acc, row) => acc + row.distance,
          0
        ).toFixed(2)
      );
      return new Response(renderHtml(totalDistance, user), {
        headers: {
          "content-type": "text/html",
        },
      });
    } catch (error: any) {
      console.error('Database error during SELECT (main page):', error);
      // Return a fallback HTML page with 0 distance if database fails
      return new Response(renderHtml(0, user), {
        headers: {
          "content-type": "text/html",
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
