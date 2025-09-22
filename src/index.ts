import { renderHtml, renderAuthHtml } from "./renderHtml";
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod, 
  createErrorResponse, 
  createSuccessResponse 
} from "./validators";
import { 
  handleProgressPost, 
  handleProgressPut, 
  handleProgressDelete, 
  handleProgressGet 
} from "./progress-handlers";
import { 
  handleGoalsGet, 
  calculateTotalDistance 
} from "./goals-handlers";
import {
  handleRegister,
  handleLogin,
  handleLogout,
  handleMe,
  handlePasswordResetRequest,
  requireAuth,
  getUserFromSession
} from "./auth-handlers";

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
      const allowedMethods = getAllowedMethods(url.pathname);
      if (!allowedMethods.includes(method)) {
        return new Response(JSON.stringify({ 
          error: `Method ${method} not allowed for ${url.pathname}`,
          allowedMethods
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
      url.pathname.startsWith("/wtm/api/") &&
      (method === "POST" || method === "PUT" || method === "DELETE") &&
      !url.pathname.includes("/logout") // logout doesn't need body
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

    // Authentication endpoints (no auth required)
    if (url.pathname === "/wtm/api/auth/register" && method === "POST") {
      return handleRegister(request, env, body);
    } else if (url.pathname === "/wtm/api/auth/login" && method === "POST") {
      return handleLogin(request, env, body);
    } else if (url.pathname === "/wtm/api/auth/logout" && method === "POST") {
      return handleLogout(request, env);
    } else if (url.pathname === "/wtm/api/auth/password-reset" && method === "POST") {
      return handlePasswordResetRequest(request, env, body);
    } else if (url.pathname === "/wtm/api/auth/me" && method === "GET") {
      return handleMe(request, env);
    }

    // Protected API endpoints - require authentication
    if (url.pathname.startsWith("/wtm/api/")) {
      const authResult = await requireAuth(request, env);
      if (authResult instanceof Response) {
        return authResult; // Return auth error
      }
      const user = authResult;

      // CRUD for calendar events (now with user isolation)
      if (url.pathname === "/wtm/api/calendar-progress" && method === "POST") {
        return handleProgressPost(request, env, body, user.id);
      } else if (url.pathname === "/wtm/api/calendar-progress" && method === "PUT") {
        return handleProgressPut(request, env, body, user.id);
      } else if (url.pathname === "/wtm/api/calendar-progress" && method === "DELETE") {
        return handleProgressDelete(request, env, body, user.id);
      } else if (url.pathname === "/wtm/api/calendar-progress") {
        return handleProgressGet(request, env, user.id);
      } else if (url.pathname === "/wtm/api/goals") {
        return handleGoalsGet(request, env);
      } else if (url.pathname === "/wtm/api/total-distance") {
        try {
          const totalDistance = await calculateTotalDistance(env, user.id);
          return new Response(JSON.stringify({ totalDistance }), {
            headers: { "content-type": "application/json" },
          });
        } catch (error: any) {
          console.error('Database error during total distance calculation:', error);
          return new Response(JSON.stringify({ 
            error: 'Internal server error while calculating total distance' 
          }), { 
            status: 500,
            headers: { "content-type": "application/json" }
          });
        }
      }
    }

    // Check if user is authenticated for main page
    const sessionId = getSessionFromRequest(request);
    if (sessionId) {
      try {
        const user = await getUserFromSession(sessionId, env);
        if (user) {
          // User is authenticated, show main page
          return new Response(renderHtml(), {
            headers: {
              "content-type": "text/html",
            },
          });
        }
      } catch (error) {
        console.error('Auth check error for main page:', error);
      }
    }
    
    // User not authenticated, show login page
    return new Response(renderAuthHtml(), {
      headers: {
        "content-type": "text/html",
      },
    });
  },
} satisfies ExportedHandler<Env>;

// Helper function to get allowed methods for API endpoints
function getAllowedMethods(pathname: string): string[] {
  switch (pathname) {
    case "/wtm/api/calendar-progress":
      return ['GET', 'POST', 'PUT', 'DELETE'];
    case "/wtm/api/auth/register":
    case "/wtm/api/auth/login":
    case "/wtm/api/auth/logout":
    case "/wtm/api/auth/password-reset":
      return ['POST'];
    case "/wtm/api/auth/me":
    case "/wtm/api/goals":
    case "/wtm/api/total-distance":
      return ['GET'];
    default:
      return ['GET'];
  }
}

// Extract session ID from request cookies
function getSessionFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie');
  if (!cookieHeader) return null;
  
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  return cookies.session || null;
}
