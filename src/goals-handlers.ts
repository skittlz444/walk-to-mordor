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
  const { results } = await db.read.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
  return Number(
    (results as Array<{ distance: number }>).reduce(
      (acc, row) => acc + row.distance,
      0
    ).toFixed(2)
  );
}