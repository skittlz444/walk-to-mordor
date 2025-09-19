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
  verifyGoogleToken,
  getOrCreateUser,
  createSession,
  getUserFromSession,
  deleteSession,
  getSessionToken,
  requireAuth,
  createSessionCookie,
  createLogoutCookie,
  User
} from "./auth";
import {
  exchangeSamsungHealthCode,
  fetchSamsungHealthSteps,
  storeSamsungHealthTokens,
  getSamsungHealthTokens,
  unlinkSamsungHealth,
  stepsToDistance
} from "./samsung-health";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const method = request.method;
    let body: any = undefined;

    // Only serve static assets for GET/HEAD requests
    if (method === "GET" || method === "HEAD") {
      const assetResponse = await env.ASSETS.fetch(request);
      if (assetResponse.status !== 404) {
        return assetResponse;
      }
    }

    // Validate HTTP method for API endpoints
    if (url.pathname.startsWith("/wtm/api/")) {
      // Define allowed methods for each endpoint
      const endpointMethods: { [key: string]: string[] } = {
        "/wtm/api/calendar-progress": ['GET', 'POST', 'PUT', 'DELETE'],
        "/wtm/api/goals": ['GET'],
        "/wtm/api/auth/google": ['POST'],
        "/wtm/api/auth/logout": ['POST'],
        "/wtm/api/auth/refresh": ['POST'],
        "/wtm/api/auth/status": ['GET'],
        "/wtm/api/samsung-health/link": ['POST'],
        "/wtm/api/samsung-health/unlink": ['POST'],
        "/wtm/api/samsung-health/status": ['GET'],
        "/wtm/api/sync/samsung-health": ['POST']
      };

      const allowedMethods = endpointMethods[url.pathname];
      if (allowedMethods && !allowedMethods.includes(method)) {
        return new Response(JSON.stringify({ 
          error: `Method ${method} not allowed for ${url.pathname}`,
          allowedMethods: allowedMethods
        }), { 
          status: 405,
          headers: { 
            "content-type": "application/json",
            "Allow": allowedMethods.join(", ")
          }
        });
      }
    }

    // Only read body for API endpoints that need it
    if (
      (url.pathname === "/wtm/api/calendar-progress" && (method === "POST" || method === "PUT" || method === "DELETE")) ||
      (url.pathname === "/wtm/api/auth/google" && method === "POST") ||
      (url.pathname === "/wtm/api/auth/logout" && method === "POST") ||
      (url.pathname === "/wtm/api/auth/refresh" && method === "POST") ||
      (url.pathname === "/wtm/api/samsung-health/link" && method === "POST") ||
      (url.pathname === "/wtm/api/samsung-health/unlink" && method === "POST") ||
      (url.pathname === "/wtm/api/sync/samsung-health" && method === "POST")
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

    // Authentication endpoints
    if (url.pathname === "/wtm/api/auth/google" && method === "POST") {
      const { token } = body || {};
      
      if (!token) {
        return createErrorResponse('Missing Google access token', 400);
      }

      // Verify Google token and get user info
      const googleUser = await verifyGoogleToken(token);
      if (!googleUser) {
        return createErrorResponse('Invalid Google token', 401);
      }

      // Get or create user in database
      const user = await getOrCreateUser(env, googleUser);
      if (!user) {
        return createErrorResponse('Failed to create user account', 500);
      }

      // Create session
      const sessionToken = await createSession(env, user);
      if (!sessionToken) {
        return createErrorResponse('Failed to create session', 500);
      }

      // Return success with session cookie
      return new Response(JSON.stringify({
        message: 'Login successful',
        user: {
          id: user.id,
          email: user.email,
          samsung_health_linked: user.samsung_health_linked
        }
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Set-Cookie": createSessionCookie(sessionToken)
        }
      });
    } else if (url.pathname === "/wtm/api/auth/logout" && method === "POST") {
      const sessionToken = getSessionToken(request);
      
      if (sessionToken) {
        await deleteSession(env, sessionToken);
      }

      return new Response(JSON.stringify({
        message: 'Logged out successfully'
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "Set-Cookie": createLogoutCookie()
        }
      });
    } else if (url.pathname === "/wtm/api/auth/status" && method === "GET") {
      const sessionToken = getSessionToken(request);
      
      if (!sessionToken) {
        return new Response(JSON.stringify({
          authenticated: false
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      const user = await getUserFromSession(env, sessionToken);
      if (!user) {
        return new Response(JSON.stringify({
          authenticated: false
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        authenticated: true,
        user: {
          id: user.id,
          email: user.email,
          samsung_health_linked: user.samsung_health_linked
        }
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    } else if (url.pathname === "/wtm/api/samsung-health/link" && method === "POST") {
      const authResult = await requireAuth(env, request);
      if (authResult instanceof Response) {
        return authResult; // Return error response
      }
      const { user } = authResult;

      const { code, client_id, client_secret, redirect_uri } = body || {};
      
      if (!code || !client_id || !client_secret || !redirect_uri) {
        return createErrorResponse('Missing required parameters for Samsung Health linking', 400);
      }

      // Exchange authorization code for access token
      const tokens = await exchangeSamsungHealthCode(code, client_id, client_secret, redirect_uri);
      if (!tokens) {
        return createErrorResponse('Failed to exchange Samsung Health authorization code', 400);
      }

      // Store tokens in database
      const success = await storeSamsungHealthTokens(env, user.id, tokens);
      if (!success) {
        return createErrorResponse('Failed to store Samsung Health tokens', 500);
      }

      return createSuccessResponse({
        message: 'Samsung Health linked successfully',
        linked: true
      });
    } else if (url.pathname === "/wtm/api/samsung-health/unlink" && method === "POST") {
      const authResult = await requireAuth(env, request);
      if (authResult instanceof Response) {
        return authResult; // Return error response
      }
      const { user } = authResult;

      const success = await unlinkSamsungHealth(env, user.id);
      if (!success) {
        return createErrorResponse('Failed to unlink Samsung Health', 500);
      }

      return createSuccessResponse({
        message: 'Samsung Health unlinked successfully',
        linked: false
      });
    } else if (url.pathname === "/wtm/api/samsung-health/status" && method === "GET") {
      const authResult = await requireAuth(env, request);
      if (authResult instanceof Response) {
        return authResult; // Return error response
      }
      const { user } = authResult;

      return new Response(JSON.stringify({
        linked: user.samsung_health_linked
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    } else if (url.pathname === "/wtm/api/sync/samsung-health" && method === "POST") {
      const authResult = await requireAuth(env, request);
      if (authResult instanceof Response) {
        return authResult; // Return error response
      }
      const { user } = authResult;

      const { date } = body || {};
      if (!date) {
        return createErrorResponse('Missing date parameter', 400);
      }

      if (!isValidDateFormat(date)) {
        return createErrorResponse('Invalid date format. Expected format: YYYY-MM-DD', 400);
      }

      // Get Samsung Health tokens
      const tokens = await getSamsungHealthTokens(env, user.id);
      if (!tokens) {
        return createErrorResponse('Samsung Health not linked or tokens expired', 400);
      }

      // Fetch step data from Samsung Health
      const stepData = await fetchSamsungHealthSteps(tokens.access_token, date);
      if (!stepData) {
        return createErrorResponse('Failed to fetch Samsung Health data', 500);
      }

      if (stepData.distance === 0) {
        return new Response(JSON.stringify({
          message: 'No step data found for this date',
          date: date,
          distance: 0,
          steps: 0
        }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      return new Response(JSON.stringify({
        message: 'Samsung Health data retrieved successfully',
        date: date,
        distance: stepData.distance,
        steps: stepData.steps
      }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }

    // CRUD for calendar events
    if (url.pathname === "/wtm/api/calendar-progress" && method === "POST") {
      // Check if user is authenticated - if not, use anonymous user (backward compatibility)
      const sessionToken = getSessionToken(request);
      let user: User | null = null;
      
      if (sessionToken) {
        user = await getUserFromSession(env, sessionToken);
      }
      
      // Default to anonymous user if not authenticated (for backward compatibility)
      const userId = user?.id || 1;

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
          "INSERT INTO progress (user_id, date, distance, synced_from_samsung, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"
        )
          .bind(userId, start, Number(title), false)
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
      // Check if user is authenticated - if not, use anonymous user (backward compatibility)
      const sessionToken = getSessionToken(request);
      let user: User | null = null;
      
      if (sessionToken) {
        user = await getUserFromSession(env, sessionToken);
      }
      
      // Default to anonymous user if not authenticated (for backward compatibility)
      const userId = user?.id || 1;

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
          "UPDATE progress SET distance = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND date = ?"
        )
          .bind(Number(title), userId, start)
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
      // Check if user is authenticated - if not, use anonymous user (backward compatibility)
      const sessionToken = getSessionToken(request);
      let user: User | null = null;
      
      if (sessionToken) {
        user = await getUserFromSession(env, sessionToken);
      }
      
      // Default to anonymous user if not authenticated (for backward compatibility)
      const userId = user?.id || 1;

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
        console.log("Deleting date:", start, "for user:", userId);
        const result = await env.DB.prepare("DELETE FROM progress WHERE user_id = ? AND date = ?")
          .bind(userId, start)
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
      // Check if user is authenticated - if not, use anonymous user (backward compatibility)
      const sessionToken = getSessionToken(request);
      let user: User | null = null;
      
      if (sessionToken) {
        user = await getUserFromSession(env, sessionToken);
      }
      
      // Default to anonymous user if not authenticated (for backward compatibility)
      const userId = user?.id || 1;

      try {
        const { results } = await env.DB.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
        const calendarData = (results as Array<{ date: string; distance: number; synced_from_samsung: boolean }>).map(row => ({
          start: row.date,
          title: row.distance.toString(),
          synced_from_samsung: row.synced_from_samsung || false
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
      // Check if user is authenticated - if not, use anonymous user (backward compatibility)
      const sessionToken = getSessionToken(request);
      let user: User | null = null;
      
      if (sessionToken) {
        user = await getUserFromSession(env, sessionToken);
      }
      
      // Default to anonymous user if not authenticated (for backward compatibility)
      const userId = user?.id || 1;

      const { results } = await env.DB.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
      const totalDistance = Number(
        (results as Array<{ distance: number }>).reduce(
          (acc, row) => acc + row.distance,
          0
        ).toFixed(2)
      );
      return new Response(renderHtml(totalDistance), {
        headers: {
          "content-type": "text/html",
        },
      });
    } catch (error: any) {
      console.error('Database error during SELECT (main page):', error);
      // Return a fallback HTML page with 0 distance if database fails
      return new Response(renderHtml(0), {
        headers: {
          "content-type": "text/html",
        },
      });
    }
  },
} satisfies ExportedHandler<Env>;
