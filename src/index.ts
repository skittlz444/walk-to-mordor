import { renderHtml } from "./renderHtml";
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  isValidMethod, 
  createErrorResponse, 
  createSuccessResponse 
} from "./validators";

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
          "INSERT INTO progress (date, distance) VALUES (?, ?)"
        )
          .bind(start, Number(title))
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
          "UPDATE progress SET distance = ? WHERE date = ?"
        )
          .bind(Number(title), start)
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
        const result = await env.DB.prepare("DELETE FROM progress WHERE date = ?")
          .bind(start)
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
        const { results } = await env.DB.prepare("SELECT * FROM progress").all();
        const calendarData = (results as Array<{ date: string; distance: number }>).map(row => ({
          start: row.date,
          title: row.distance.toString(),
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
      const { results } = await env.DB.prepare("SELECT * FROM progress").all();
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
