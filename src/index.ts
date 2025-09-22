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
  handleProgressPost, 
  handleProgressPut, 
  handleProgressDelete, 
  handleProgressGet 
} from "./progress-handlers";
import { 
  handleGoalsGet, 
  calculateTotalDistance 
} from "./goals-handlers";

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
      if (!isValidMethod(url.pathname, method)) {
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

    // Only read body for calendar-progress API and relevant methods
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

    // CRUD for calendar events
    if (url.pathname === "/wtm/api/calendar-progress" && method === "POST") {
      return handleProgressPost(request, env, body);
    } else if (url.pathname === "/wtm/api/calendar-progress" && method === "PUT") {
      return handleProgressPut(request, env, body);
    } else if (url.pathname === "/wtm/api/calendar-progress" && method === "DELETE") {
      return handleProgressDelete(request, env, body);
    } else if (url.pathname === "/wtm/api/calendar-progress") {
      return handleProgressGet(request, env);
    } else if (url.pathname === "/wtm/api/goals") {
      return handleGoalsGet(request, env);
    } else if (url.pathname === "/wtm/api/total-distance") {
      try {
        const totalDistance = await calculateTotalDistance(env);
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

    // Render main HTML page
    return new Response(renderHtml(), {
      headers: {
        "content-type": "text/html",
      },
    });
  },
} satisfies ExportedHandler<Env>;
