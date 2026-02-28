// Progress API handlers
import { 
  isValidDateFormat, 
  isValidDistance, 
  safeJsonParse, 
  createErrorResponse, 
  createSuccessResponse 
} from "./validators";
import { validateSession } from "./auth-handlers";

/** Row shape returned by active party membership query */
interface ActiveMembershipRow {
  party_id: number;
}

/**
 * Sync a walk log entry to party_progress_log for all of the user's active party memberships.
 * Graceful degradation: errors are logged but never propagated (walk is the primary operation).
 */
export async function syncPartyProgressLog(
  env: { DB: D1Database },
  userId: number,
  date: string,
  distance: number,
  operation: 'insert' | 'update' | 'delete'
): Promise<void> {
  try {
    const { results: memberships } = await env.DB.prepare(
      'SELECT party_id FROM party_members WHERE user_id = ? AND status = ?'
    ).bind(userId, 'active').all<ActiveMembershipRow>();

    if (!memberships || memberships.length === 0) return;

    const now = new Date().toISOString();

    if (operation === 'insert') {
      const stmts = memberships.map((m) =>
        env.DB.prepare(
          'INSERT OR REPLACE INTO party_progress_log (party_id, logged_by_user_id, distance, date, logged_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(m.party_id, userId, distance, date, now)
      );
      await env.DB.batch(stmts);
    } else if (operation === 'update') {
      await env.DB.prepare(
        'UPDATE party_progress_log SET distance = ? WHERE logged_by_user_id = ? AND date = ?'
      ).bind(distance, userId, date).run();
    } else if (operation === 'delete') {
      await env.DB.prepare(
        'DELETE FROM party_progress_log WHERE logged_by_user_id = ? AND date = ?'
      ).bind(userId, date).run();
    }
  } catch (error) {
    console.error('Error syncing party_progress_log:', error);
  }
}

export async function handleProgressPost(request: Request, env: any, body: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;
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
      .bind(start, Number(title), userId)
      .run();

    // Sync to party_progress_log for all active memberships (graceful degradation)
    await syncPartyProgressLog(env, userId!, start, Number(title), 'insert');

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
}

export async function handleProgressPut(request: Request, env: any, body: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;
  
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
      "UPDATE progress SET distance = ? WHERE date = ? AND user_id = ?"
    )
      .bind(Number(title), start, userId)
      .run();
      
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        error: 'No entry found for the specified date. Use POST to create a new entry.' 
      }), { 
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    // Sync to party_progress_log for all active memberships (graceful degradation)
    await syncPartyProgressLog(env, userId!, start, Number(title), 'update');
    
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
}

export async function handleProgressDelete(request: Request, env: any, body: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;
  
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
    const result = await env.DB.prepare("DELETE FROM progress WHERE date = ? AND user_id = ?")
      .bind(start, userId)
      .run();
      
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ 
        error: 'No entry found for the specified date' 
      }), { 
        status: 404,
        headers: { "content-type": "application/json" }
      });
    }

    // Sync to party_progress_log for all active memberships (graceful degradation)
    await syncPartyProgressLog(env, userId!, start, 0, 'delete');
    
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
}

export async function handleProgressGet(request: Request, env: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;
  
  try {
    const { results } = await env.DB.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
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
}