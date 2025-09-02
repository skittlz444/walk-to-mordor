import { renderHtml } from "./renderHtml";

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

    // Only read body for calendar-progress API and relevant methods
    if (
      url.pathname === "/wtm/api/calendar-progress" &&
      (method === "POST" || method === "PUT" || method === "DELETE")
    ) {
      body = await request.json();
    }

    // CRUD for calendar events
    if (url.pathname === "/wtm/api/calendar-progress" && method === "POST") {
      const { start, title } = body || {};
      if (!start || typeof title === 'undefined') {
        return new Response('Invalid payload', { status: 400 });
      }
      await env.DB.prepare(
        "INSERT INTO progress (date, distance) VALUES (?, ?)"
      )
        .bind(start, Number(title))
        .run();
      return new Response("Created", { status: 201 });
    } else if (url.pathname === "/wtm/api/calendar-progress" && method === "PUT") {
      const { start, title } = body || {};
      if (!start || typeof title === 'undefined') {
        return new Response('Invalid payload', { status: 400 });
      }
      await env.DB.prepare(
        "UPDATE progress SET distance = ? WHERE date = ?"
      )
        .bind(Number(title), start)
        .run();
      return new Response("Updated", { status: 200 });
    } else if (url.pathname === "/wtm/api/calendar-progress" && method === "DELETE") {
      const { start } = body || {};
      if (!start) {
        return new Response('Invalid payload', { status: 400 });
      }
      console.log("Deleting date:", start);
      await env.DB.prepare("DELETE FROM progress WHERE date = ?")
        .bind(start)
        .run();
      return new Response("Deleted", { status: 200 });
    } else if (url.pathname === "/wtm/api/calendar-progress") {
      const { results } = await env.DB.prepare("SELECT * FROM progress").all();
      const calendarData = (results as Array<{ date: string; distance: number }>).map(row => ({
        start: row.date,
        title: row.distance.toString(),
      }));
      return new Response(JSON.stringify(calendarData), {
        headers: { "content-type": "application/json" },
      });
    } else if (url.pathname === "/wtm/api/goals") {
      const { results } = await env.DB.prepare("SELECT * FROM goals").all();
      // Return all goals as array of {distance, title, special}
      return new Response(JSON.stringify(results), {
        headers: { "content-type": "application/json" },
      });
    }

    // Render main HTML page
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
  },
} satisfies ExportedHandler<Env>;
