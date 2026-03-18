// Goals API handlers
import { validateSession } from "./auth-handlers";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy Env typing; to be refactored
export async function handleGoalsGet(request: Request, env: any) {
  // Validate session
  const sessionValidation = await validateSession(request, env);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  
  try {
    const { results } = await env.DB.prepare("SELECT * FROM goals ORDER BY distance ASC").all();
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy Env typing; to be refactored
export async function calculateTotalDistance(env: any, userId: number): Promise<number> {
  const { results } = await env.DB.prepare("SELECT * FROM progress WHERE user_id = ?").bind(userId).all();
  return Number(
    (results as Array<{ distance: number }>).reduce(
      (acc, row) => acc + row.distance,
      0
    ).toFixed(2)
  );
}