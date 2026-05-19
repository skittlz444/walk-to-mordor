// Goals API handlers
import { validateSession } from "./auth-handlers";
import type { DbClient } from "./db";

export async function handleGoalsGet(request: Request, db: DbClient, allowTestAuth?: string) {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  
  try {
    const { results } = await db.read.prepare("SELECT * FROM goals ORDER BY distance ASC").all();
    // Return all goals as array of {distance, title, special, image_id}
    return new Response(JSON.stringify(results), {
      headers: { "content-type": "application/json" },
    });
  } catch (error: unknown) {
    console.error('Database error during SELECT (goals):', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error while retrieving goals' 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

export async function calculateTotalDistance(db: DbClient, userId: number): Promise<number> {
  // Read the user's cumulative distance on their currently-active storyline.
  // This is the single "personal total" the UI shows — the value is kept in
  // sync with the `progress` table on every walk insert/update/delete and
  // adjusts on storyline switches (keep carries it over, discard zeroes it).
  // See migration 0132 and progress-handlers.syncActiveStorylineDistance.
  const row = await db.read
    .prepare('SELECT active_storyline_distance_km AS total FROM users WHERE id = ?')
    .bind(userId)
    .first<{ total: number | null }>();
  const total = row?.total ?? 0;
  return Number(Number(total).toFixed(2));
}