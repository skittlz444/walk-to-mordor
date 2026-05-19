// Storyline API handlers — multi-storyline foundation
//
// Implements the personal switch endpoint (PUT /api/user/active-storyline)
// per the "Keep carries personal progress forward" delta, and the fellowship
// admin switch endpoint (PUT /api/party/:partyId/storyline) per the previous
// plan's keep/reset semantics.
//
// Key invariants:
//   * `users.active_storyline_distance_km` is the single personal total.
//     - Switch "keep"    => carry the existing value onto the new storyline.
//     - Switch "discard" => set to 0.
//   * `progress` is never touched on switch (raw activity log).
//   * Fellowship contributions live in `party_progress_log`.
//     - Storyline change "keep"  => existing rows stay live.
//     - Storyline change "reset" => existing live rows stamped `superseded_at`,
//                                   and active members' `distance_at_join` is
//                                   bumped to their current total so
//                                   "incremental"-mode fellowship totals start
//                                   from 0 going forward.
//   * Goal-completion detection on personal "keep": any storyline_goals
//     thresholds the user has now crossed on the new storyline are returned
//     so the UI / push pipeline can emit "goal reached" notifications, just
//     like a regular walk.

import { validateSession } from './auth-handlers';
import { createErrorResponse, createSuccessResponse } from './validators';
import type { DbClient } from './db';

/** Row shape for the storylines table. */
interface StorylineRow {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
}

/** Goal threshold row for completion detection. */
interface StorylineGoalThresholdRow {
  goal_id: number;
  distance: number;
  is_challenge_end: number;
  title: string;
  special: string | null;
}

/**
 * GET /api/storylines — list available storylines (ordered).
 *
 * Public to authenticated users; the multi-storyline UI uses this to populate
 * the storyline picker / keep-or-discard modal.
 */
export async function handleGetStorylines(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }

  try {
    const { results } = await db.read
      .prepare(
        'SELECT id, slug, name, description, sort_order FROM storylines ORDER BY sort_order ASC, id ASC',
      )
      .all<StorylineRow>();
    return createSuccessResponse({ storylines: results });
  } catch (error) {
    console.error('Database error while listing storylines:', error);
    return createErrorResponse('Internal server error while listing storylines', 500);
  }
}

/**
 * PUT /api/user/active-storyline
 *   Body: { storylineSlug: string, onSwitch: 'keep' | 'discard' }
 *
 * Switches the authenticated user's active storyline. "Keep" carries the
 * current personal distance total onto the new storyline; "discard" resets it
 * to 0. The raw `progress` activity log is never touched. Fellowship state
 * (parties.*, party_progress_log.*) is never touched.
 *
 * On "keep", any storyline_goals thresholds on the new storyline that the
 * carried-over distance now equals or exceeds — and that haven't already been
 * crossed on the previous active storyline — are returned in
 * `goalsReached` so the UI / push pipeline can emit notifications, just like
 * a regular walk that crossed those thresholds. On "discard" the personal
 * total resets to 0 so no thresholds fire from the switch itself.
 *
 * Idempotent when the user is already on the requested storyline (returns
 * 200 with no goalsReached).
 */
export async function handleSetActiveStoryline(
  request: Request,
  db: DbClient,
  body: Record<string, unknown> | undefined,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId!;

  const storylineSlug = body && typeof body.storylineSlug === 'string' ? body.storylineSlug : null;
  const onSwitch = body && typeof body.onSwitch === 'string' ? body.onSwitch : null;

  if (!storylineSlug) {
    return createErrorResponse('Missing required field: storylineSlug', 400);
  }
  if (onSwitch !== 'keep' && onSwitch !== 'discard') {
    return createErrorResponse("onSwitch must be 'keep' or 'discard'", 400);
  }

  try {
    // 1. Resolve the requested storyline.
    const target = await db.read
      .prepare('SELECT id, slug, name FROM storylines WHERE slug = ?')
      .bind(storylineSlug)
      .first<{ id: number; slug: string; name: string }>();
    if (!target) {
      return createErrorResponse('Storyline not found', 404);
    }

    // 2. Read the user's current storyline + cumulative distance.
    const userRow = await db.read
      .prepare(
        'SELECT active_storyline_id, active_storyline_distance_km FROM users WHERE id = ?',
      )
      .bind(userId)
      .first<{ active_storyline_id: number | null; active_storyline_distance_km: number }>();
    if (!userRow) {
      return createErrorResponse('User not found', 404);
    }

    const previousStorylineId = userRow.active_storyline_id;
    const previousDistance = Number(userRow.active_storyline_distance_km ?? 0);

    // Idempotent: already on this storyline.
    if (previousStorylineId === target.id) {
      return createSuccessResponse({
        storyline: target,
        distanceKm: previousDistance,
        carriedOver: true,
        goalsReached: [],
        unchanged: true,
      });
    }

    // 3. Determine the new distance per keep/discard semantics.
    const carryOver = onSwitch === 'keep';
    const newDistance = carryOver ? previousDistance : 0;

    // 4. Audit-log the switch (optional table; failure is non-fatal).
    if (previousStorylineId !== null) {
      try {
        const nowIso = new Date().toISOString();
        await db.write
          .prepare(
            `UPDATE user_storyline_history
             SET ended_at = ?, distance_at_end_km = ?, carry_over = ?
             WHERE user_id = ? AND storyline_id = ? AND ended_at IS NULL`,
          )
          .bind(nowIso, previousDistance, carryOver ? 1 : 0, userId, previousStorylineId)
          .run();
      } catch (err) {
        console.error('Failed to close user_storyline_history row:', err);
      }
    }

    // 5. Update the user's active storyline + distance counter.
    await db.write
      .prepare(
        'UPDATE users SET active_storyline_id = ?, active_storyline_distance_km = ? WHERE id = ?',
      )
      .bind(target.id, newDistance, userId)
      .run();

    // 6. Append a new open user_storyline_history row for the new storyline.
    try {
      await db.write
        .prepare(
          'INSERT INTO user_storyline_history (user_id, storyline_id, carry_over) VALUES (?, ?, ?)',
        )
        .bind(userId, target.id, carryOver ? 1 : 0)
        .run();
    } catch (err) {
      console.error('Failed to append user_storyline_history row:', err);
    }

    // 7. Goal-completion detection on "keep". When discarding to 0, no
    //    thresholds fire from the switch itself.
    let goalsReached: Array<{
      goal_id: number;
      distance: number;
      title: string;
      special: string | null;
      is_challenge_end: boolean;
    }> = [];
    if (carryOver && newDistance > 0) {
      const { results } = await db.read
        .prepare(
          `SELECT sg.goal_id AS goal_id,
                  sg.distance AS distance,
                  sg.is_challenge_end AS is_challenge_end,
                  g.title AS title,
                  g.special AS special
           FROM storyline_goals sg
           JOIN goals g ON g.id = sg.goal_id
           WHERE sg.storyline_id = ? AND sg.distance <= ? AND sg.distance > 0
           ORDER BY sg.distance ASC`,
        )
        .bind(target.id, newDistance)
        .all<StorylineGoalThresholdRow>();
      goalsReached = results.map((row) => ({
        goal_id: row.goal_id,
        distance: Number(row.distance),
        title: row.title,
        special: row.special,
        is_challenge_end: row.is_challenge_end === 1,
      }));
    }

    return createSuccessResponse({
      storyline: target,
      distanceKm: newDistance,
      carriedOver: carryOver,
      goalsReached,
    });
  } catch (error) {
    console.error('Database error while switching active storyline:', error);
    return createErrorResponse('Internal server error while switching storyline', 500);
  }
}

/**
 * PUT /api/party/:partyId/storyline
 *   Body: { storylineSlug: string, onSwitch: 'keep' | 'reset' }
 *
 * Only the party leader may call this. "Keep" continues counting existing
 * fellowship distance against the new storyline's goals. "Reset" stamps
 * `superseded_at` on every currently-live party_progress_log row for this
 * party and bumps each active member's `distance_at_join` to their current
 * total — so the fellowship's incremental total restarts at 0 going forward
 * while preserving the audit trail.
 *
 * Idempotent when the party is already on the requested storyline.
 */
export async function handleSetPartyStoryline(
  request: Request,
  db: DbClient,
  partyId: number,
  body: Record<string, unknown> | undefined,
  allowTestAuth?: string,
): Promise<Response> {
  const sessionValidation = await validateSession(request, db, allowTestAuth);
  if (!sessionValidation.valid) {
    return sessionValidation.error;
  }
  const userId = sessionValidation.userId!;

  const storylineSlug = body && typeof body.storylineSlug === 'string' ? body.storylineSlug : null;
  const onSwitch = body && typeof body.onSwitch === 'string' ? body.onSwitch : null;

  if (!storylineSlug) {
    return createErrorResponse('Missing required field: storylineSlug', 400);
  }
  if (onSwitch !== 'keep' && onSwitch !== 'reset') {
    return createErrorResponse("onSwitch must be 'keep' or 'reset'", 400);
  }

  try {
    // 1. Verify the party exists and the caller is its leader.
    const party = await db.read
      .prepare(
        'SELECT id, leader_id, dissolved_at, storyline_id FROM parties WHERE id = ?',
      )
      .bind(partyId)
      .first<{
        id: number;
        leader_id: number;
        dissolved_at: string | null;
        storyline_id: number | null;
      }>();

    if (!party) {
      return createErrorResponse('Party not found', 404);
    }
    if (party.dissolved_at !== null) {
      return createErrorResponse('This party has been dissolved', 400);
    }
    if (party.leader_id !== userId) {
      return createErrorResponse(
        "Only the party leader can change the fellowship's storyline",
        403,
      );
    }

    // 2. Resolve the requested storyline.
    const target = await db.read
      .prepare('SELECT id, slug, name FROM storylines WHERE slug = ?')
      .bind(storylineSlug)
      .first<{ id: number; slug: string; name: string }>();
    if (!target) {
      return createErrorResponse('Storyline not found', 404);
    }

    // Idempotent if already on this storyline.
    if (party.storyline_id === target.id) {
      return createSuccessResponse({
        storyline: target,
        reset: false,
        unchanged: true,
      });
    }

    // 3. Update the party's storyline.
    await db.write
      .prepare('UPDATE parties SET storyline_id = ? WHERE id = ?')
      .bind(target.id, partyId)
      .run();

    // 4. On "reset": stamp all currently-live log rows for this party and
    //    bump active members' distance_at_join so incremental totals start
    //    fresh at 0.
    if (onSwitch === 'reset') {
      const nowIso = new Date().toISOString();
      try {
        await db.write
          .prepare(
            'UPDATE party_progress_log SET superseded_at = ? WHERE party_id = ? AND superseded_at IS NULL',
          )
          .bind(nowIso, partyId)
          .run();
      } catch (err) {
        console.error('Failed to stamp superseded_at on party_progress_log:', err);
      }

      try {
        // For each active member, set distance_at_join = their current
        // active_storyline_distance_km if available, else SUM(progress).
        // Using active_storyline_distance_km matches the new "personal total"
        // semantics and ensures the fellowship's incremental contribution for
        // each member resets to 0 immediately after the reset.
        await db.write
          .prepare(
            `UPDATE party_members
             SET distance_at_join = COALESCE(
                   (SELECT u.active_storyline_distance_km FROM users u WHERE u.id = party_members.user_id),
                   (SELECT COALESCE(SUM(p.distance), 0) FROM progress p WHERE p.user_id = party_members.user_id),
                   0
                 ),
                 last_viewed_distance = 0
             WHERE party_id = ? AND status = 'active'`,
          )
          .bind(partyId)
          .run();
      } catch (err) {
        console.error('Failed to reset party_members.distance_at_join:', err);
      }
    }

    return createSuccessResponse({
      storyline: target,
      reset: onSwitch === 'reset',
    });
  } catch (error) {
    console.error("Database error while switching party storyline:", error);
    return createErrorResponse(
      "Internal server error while switching party storyline",
      500,
    );
  }
}
