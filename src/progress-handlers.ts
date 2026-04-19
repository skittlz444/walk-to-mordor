// Progress API handlers
import { 
  isValidDateFormat, 
  isValidDistance, 
} from "./validators";
import { validateSession } from "./auth-handlers";
import type { DbClient } from "./db";

/** Row shape returned by active party membership query */
interface ActiveMembershipRow {
  party_id: number;
}

/**
 * Sync a walk log entry to party_progress_log for all of the user's active party memberships.
 * Graceful degradation: errors are logged but never propagated (walk is the primary operation).
 */
export async function syncPartyProgressLog(
  db: DbClient,
  userId: number,
  date: string,
  distance: number,
  operation: 'insert' | 'update' | 'delete'
): Promise<void> {
  try {
    const { results: memberships } = await db.read.prepare(
      'SELECT party_id FROM party_members WHERE user_id = ? AND status = ?'
    ).bind(userId, 'active').all<ActiveMembershipRow>();

    if (!memberships || memberships.length === 0) return;

    const now = new Date().toISOString();

    if (operation === 'insert') {
      const stmts = memberships.map((m) =>
        db.write.prepare(
          'INSERT OR REPLACE INTO party_progress_log (party_id, logged_by_user_id, distance, date, logged_at) VALUES (?, ?, ?, ?, ?)'
        ).bind(m.party_id, userId, distance, date, now)
      );
      await db.write.batch(stmts);
    } else if (operation === 'update') {
      const updateStmts = memberships.map((m) =>
        db.write.prepare(
          'UPDATE party_progress_log SET distance = ? WHERE party_id = ? AND logged_by_user_id = ? AND date = ?'
        ).bind(distance, m.party_id, userId, date)
      );
      await db.write.batch(updateStmts);
    } else if (operation === 'delete') {
      const deleteStmts = memberships.map((m) =>
        db.write.prepare(
          'DELETE FROM party_progress_log WHERE party_id = ? AND logged_by_user_id = ? AND date = ?'
        ).bind(m.party_id, userId, date)
      );
      await db.write.batch(deleteStmts);
    }
  } catch (error) {
    console.error('Error syncing party_progress_log:', error);
  }
}

export async function handleProgressPost(request: Request, db: DbClient, body: Record<string, unknown>, allowTestAuth?: string) {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
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
  if (typeof start !== 'string' || !isValidDateFormat(start)) {
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
    await db.write.prepare("INSERT INTO progress (date, distance, user_id) VALUES (?, ?, ?)"
    )
      .bind(start, Number(title), userId)
      .run();

    // Sync to party_progress_log for all active memberships (graceful degradation)
    await syncPartyProgressLog(db, userId!, start, Number(title), 'insert');

    // Reset re-engagement tier on new walk (not on PUT/DELETE)
    try {
      await db.write.prepare(
        'UPDATE users SET reengage_tier_sent = 0 WHERE id = ? AND reengage_tier_sent > 0'
      ).bind(userId).run();
    } catch (resetError: unknown) {
      console.error('Failed to reset reengage_tier_sent:', resetError);
    }

    return new Response(JSON.stringify({ 
      message: "Created successfully",
      date: start,
      distance: Number(title)
    }), { 
      status: 201,
      headers: { "content-type": "application/json" }
    });
  } catch (error: unknown) {
    // Handle database errors
    console.error('Database error during INSERT:', error);
    const message = error instanceof Error ? error.message : String(error);
    const causeMessage = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';
    if (message.includes('UNIQUE constraint failed') || 
        message.includes('UNIQUE constraint') ||
        causeMessage.includes('UNIQUE constraint') ||
        String(error).includes('UNIQUE constraint')) {
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

export async function handleProgressPut(request: Request, db: DbClient, body: Record<string, unknown>, allowTestAuth?: string) {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
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
  if (typeof start !== 'string' || !isValidDateFormat(start)) {
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
    const result = await db.write.prepare("UPDATE progress SET distance = ? WHERE date = ? AND user_id = ?"
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
    await syncPartyProgressLog(db, userId!, start, Number(title), 'update');
    
    return new Response(JSON.stringify({ 
      message: "Updated successfully",
      date: start,
      distance: Number(title)
    }), { 
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error: unknown) {
    console.error('Database error during UPDATE:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error while updating entry' 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

export async function handleProgressDelete(request: Request, db: DbClient, body: Record<string, unknown>, allowTestAuth?: string) {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
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
  if (typeof start !== 'string' || !isValidDateFormat(start)) {
    return new Response(JSON.stringify({ 
      error: 'Invalid date format. Expected format: YYYY-MM-DD (e.g., 2024-01-15)' 
    }), { 
      status: 400,
      headers: { "content-type": "application/json" }
    });
  }

  try {
    const result = await db.write.prepare("DELETE FROM progress WHERE date = ? AND user_id = ?")
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
    await syncPartyProgressLog(db, userId!, start, 0, 'delete');
    
    return new Response(JSON.stringify({ 
      message: "Deleted successfully",
      date: start
    }), { 
      status: 200,
      headers: { "content-type": "application/json" }
    });
  } catch (error: unknown) {
    console.error('Database error during DELETE:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error while deleting entry' 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

export async function handleProgressGet(request: Request, db: DbClient, allowTestAuth?: string) {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId;
  
  try {
    const { results } = await db.read.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
    const calendarData = (results as Array<{ date: string; distance: number }>).map(row => ({
      start: row.date,
      title: row.distance.toString(),
    }));
    return new Response(JSON.stringify(calendarData), {
      headers: { "content-type": "application/json" },
    });
  } catch (error: unknown) {
    console.error('Database error during SELECT (calendar-progress):', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error while retrieving calendar progress' 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}