// Goals API handlers
import { validateSession } from "./auth-handlers";

export async function handleGoalsGet(request: Request, env: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  
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

export async function calculateTotalDistance(env: any, userId: number): Promise<number> {
  const { results } = await env.DB.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
  return Number(
    (results as Array<{ distance: number }>).reduce(
      (acc, row) => acc + row.distance,
      0
    ).toFixed(2)
  );
}