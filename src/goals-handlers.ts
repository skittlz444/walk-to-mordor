// Goals API handlers
import { validateSession } from "./auth-handlers";
import {
  applyStorylineOffset,
  isUserAdmin,
  listStorylineGoals,
  requireActiveStoryline,
  resolveUserStoryline,
  toStorylineResponse,
} from "./storyline-utils";
import type { DbClient } from "./db";

export async function handleGoalsGet(request: Request, db: DbClient, allowTestAuth?: string) {
  // Validate session
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  
  try {
    const url = new URL(request.url);
    const requestedStorylineId = url.searchParams.get("storylineId");
    let storylineId: number;

    if (requestedStorylineId !== null) {
      const parsedStorylineId = Number(requestedStorylineId);
      if (!Number.isInteger(parsedStorylineId) || parsedStorylineId <= 0) {
        return new Response(JSON.stringify({ error: "Invalid storylineId" }), {
          status: 400,
          headers: { "content-type": "application/json" },
        });
      }
      const includeAdminOnly = await isUserAdmin(db, sessionValidation.userId);
      storylineId = (await requireActiveStoryline(db, parsedStorylineId, { includeAdminOnly })).id;
    } else {
      storylineId = (await resolveUserStoryline(db, sessionValidation.userId)).storyline.id;
    }

    const results = await listStorylineGoals(db, storylineId);
    // Return all goals as array of {distance, title, special, image_id}
    return new Response(JSON.stringify(results), {
      headers: { "content-type": "application/json" },
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "Storyline not found") {
      return new Response(JSON.stringify({ error: "Storyline not found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }
    console.error('Database error during SELECT (goals):', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error while retrieving goals' 
    }), { 
      status: 500,
      headers: { "content-type": "application/json" }
    });
  }
}

export async function calculateUserStorylineDistance(db: DbClient, userId: number) {
  const rawTotalDistance = await calculateTotalDistance(db, userId);
  const context = await resolveUserStoryline(db, userId);
  const totalDistance = applyStorylineOffset(rawTotalDistance, context.distanceOffset);

  return {
    totalDistance,
    rawTotalDistance,
    activeStoryline: toStorylineResponse(context),
  };
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