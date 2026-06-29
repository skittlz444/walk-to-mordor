// Journal data-access helpers and types for milestone journals
import type { DbClient } from './db';
import { resolveUserStoryline, resolvePartyStoryline } from './storyline-utils';
import { computePartyTotalDistance } from './party-distance-utils';

// ── Types ──────────────────────────────────────────────────────────────────

/** Row shape from milestone_journals table */
export interface MilestoneJournalRow {
  id: number;
  user_id: number;
  goal_id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

/** Own journal entry returned to the client */
export interface OwnJournalEntry {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
}

/** A friend's journal entry returned to the client */
export interface FriendJournalEntry {
  userId: number;
  username: string;
  avatarId: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

/** Permission flags for GoalModal journal actions */
export interface JournalPermissions {
  canWrite: boolean;
  canEditOwn: boolean;
  canDeleteOwn: boolean;
  canReadFriends: boolean;
}

/** Full goal-scoped journal state returned by the read handler */
export interface GoalJournalState {
  ownEntry: OwnJournalEntry | null;
  friendEntries: FriendJournalEntry[];
  permissions: JournalPermissions;
}

/** Row shape for accepted friendship check */
interface AcceptedFriendRow {
  friend_id: number;
}

/** Row shape for user preference lookup */
interface UserPrefsRow {
  show_future_goals_unlocked: number;
}

/** Row shape for storyline goal distance */
interface StorylineGoalDistanceRow {
  distance: number;
}

/** Row shape for party member check */
interface PartyMemberRow {
  role: string;
}

// ── Data-Access Helpers ────────────────────────────────────────────────────

/** Convert a MilestoneJournalRow to the client-facing OwnJournalEntry */
function toOwnEntry(row: MilestoneJournalRow): OwnJournalEntry {
  return {
    id: row.id,
    body: row.body,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

/**
 * Fetch the current user's own journal entry for a canonical goal.
 * Returns null if no entry exists.
 */
export async function getOwnJournalEntry(
  db: DbClient,
  userId: number,
  goalId: number,
): Promise<OwnJournalEntry | null> {
  const row = await db.read.prepare(
    `SELECT id, user_id, goal_id, body, created_at, updated_at
     FROM milestone_journals
     WHERE user_id = ? AND goal_id = ?`,
  ).bind(userId, goalId).first<MilestoneJournalRow>();

  return row ? toOwnEntry(row) : null;
}

/**
 * Get all accepted friend IDs for a user.
 * A friendship is accepted regardless of which user was the requester.
 */
export async function getAcceptedFriendIds(
  db: DbClient,
  userId: number,
): Promise<number[]> {
  const { results } = await db.read.prepare(
    `SELECT CASE
       WHEN requester_id = ? THEN addressee_id
       ELSE requester_id
     END as friend_id
     FROM friendships
     WHERE (requester_id = ? OR addressee_id = ?)
       AND status = 'accepted'`,
  ).bind(userId, userId, userId).all<AcceptedFriendRow>();

  return (results || []).map((r) => r.friend_id);
}

/**
 * Check if two users are accepted friends (bidirectional check).
 */
export async function areAcceptedFriends(
  db: DbClient,
  userA: number,
  userB: number,
): Promise<boolean> {
  const row = await db.read.prepare(
    `SELECT 1 as exists_
     FROM friendships
     WHERE ((requester_id = ? AND addressee_id = ?)
         OR (requester_id = ? AND addressee_id = ?))
       AND status = 'accepted'
     LIMIT 1`,
  ).bind(userA, userB, userB, userA).first<{ exists_: number }>();

  return row !== null;
}

/**
 * Get the viewer's milestone preview preference.
 * Returns true if previews are enabled (show future goals unlocked).
 */
export async function getMilestonePreviewsEnabled(
  db: DbClient,
  userId: number,
): Promise<boolean> {
  const row = await db.read.prepare(
    `SELECT show_future_goals_unlocked
     FROM users
     WHERE id = ?`,
  ).bind(userId).first<UserPrefsRow>();

  return row?.show_future_goals_unlocked === 1;
}

/**
 * Get the distance of a canonical goal on a specific storyline.
 * Returns null if the goal is not on that storyline.
 */
export async function getGoalStorylineDistance(
  db: DbClient,
  goalId: number,
  storylineId: number,
): Promise<number | null> {
  const row = await db.read.prepare(
    `SELECT distance
     FROM storyline_goals
     WHERE goal_id = ? AND storyline_id = ?`,
  ).bind(goalId, storylineId).first<StorylineGoalDistanceRow>();

  return row ? row.distance : null;
}

/**
 * Check if a user has personally reached a canonical goal in their active storyline.
 * A user has reached a goal when their storyline-aware total distance >= the goal's distance on that storyline.
 */
export async function hasUserReachedGoal(
  db: DbClient,
  userId: number,
  goalId: number,
): Promise<boolean> {
  // Get user's storyline context
  const context = await resolveUserStoryline(db, userId);

  // Get the goal's distance on this storyline
  const goalDistance = await getGoalStorylineDistance(db, goalId, context.storyline.id);
  if (goalDistance === null) return false;

  // Compute user's total raw distance
  const { results } = await db.read.prepare(
    `SELECT COALESCE(SUM(distance), 0) as total
     FROM progress
     WHERE user_id = ?`,
  ).bind(userId).all<{ total: number }>();

  const rawTotal = results?.[0]?.total ?? 0;
  const totalDistance = Math.max(0, rawTotal + context.distanceOffset);

  return Number(totalDistance.toFixed(2)) >= goalDistance;
}

/**
 * Check if a user is an active member of a fellowship (party).
 */
export async function isActivePartyMember(
  db: DbClient,
  userId: number,
  partyId: number,
): Promise<boolean> {
  const row = await db.read.prepare(
    `SELECT role
     FROM party_members
     WHERE party_id = ? AND user_id = ? AND status = 'active'`,
  ).bind(partyId, userId).first<PartyMemberRow>();

  return row !== null;
}

/**
 * Check if a fellowship has reached a canonical goal on its storyline.
 * Uses the same computation as the party detail page: progress table per member,
 * respects distance_mode, accounts for departed members, and applies storyline offset.
 */
export async function hasFellowshipReachedGoal(
  db: DbClient,
  partyId: number,
  goalId: number,
): Promise<boolean> {
  // Resolve the party's storyline, falling back to default if unset
  const context = await resolvePartyStoryline(db, partyId);

  // Get the goal's distance on this storyline
  const goalDistance = await getGoalStorylineDistance(db, goalId, context.storyline.id);
  if (goalDistance === null) return false;

  // Get the party's distance_mode
  const partyRow = await db.read.prepare(
    `SELECT distance_mode FROM parties WHERE id = ?`,
  ).bind(partyId).first<{ distance_mode: string }>();

  if (!partyRow) return false;

  // Compute party's total distance using the same logic as the party detail page
  const totalDistance = await computePartyTotalDistance(
    db,
    partyId,
    partyRow.distance_mode,
  );

  return Number(totalDistance.toFixed(2)) >= goalDistance;
}

/**
 * Check if any of the user's active parties (fellowships) have reached a goal.
 * Used as a fallback when no specific partyId is provided — the user shouldn't
 * lose journal access just because they haven't selected a party view on the map.
 */
export async function hasAnyFellowshipReachedGoal(
  db: DbClient,
  userId: number,
  goalId: number,
): Promise<boolean> {
  // Get all active parties the user belongs to
  const { results: memberships } = await db.read.prepare(
    `SELECT party_id FROM party_members WHERE user_id = ? AND status = 'active'`,
  ).bind(userId).all<{ party_id: number }>();

  if (!memberships || memberships.length === 0) return false;

  for (const m of memberships) {
    if (await hasFellowshipReachedGoal(db, m.party_id, goalId)) {
      return true;
    }
  }
  return false;
}

/**
 * Get visible friend journal entries for a goal.
 *
 * @param friendIds - Pre-computed list of accepted friend IDs (for batching)
 * @param goalId - The canonical goal ID to look up journal entries for
 */
export async function getFriendJournalEntries(
  db: DbClient,
  friendIds: number[],
  goalId: number,
): Promise<FriendJournalEntry[]> {
  if (friendIds.length === 0) return [];

  // Build parameterized query with the correct number of placeholders
  const placeholders = friendIds.map(() => '?').join(', ');

  const { results } = await db.read.prepare(
    `SELECT mj.body, mj.created_at, mj.updated_at,
            u.id as user_id, u.username, u.avatar_id
     FROM milestone_journals mj
     JOIN users u ON u.id = mj.user_id
     WHERE mj.goal_id = ?
       AND mj.user_id IN (${placeholders})
     ORDER BY mj.created_at DESC`,
  ).bind(goalId, ...friendIds).all<{
    body: string;
    created_at: string;
    updated_at: string;
    user_id: number;
    username: string;
    avatar_id: string | null;
  }>();

  return (results || []).map((r) => ({
    userId: r.user_id,
    username: r.username,
    avatarId: r.avatar_id,
    body: r.body,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/**
 * Create or update a journal entry for a user + goal pair.
 * Uses INSERT OR REPLACE with the UNIQUE(user_id, goal_id) constraint.
 */
export async function upsertJournalEntry(
  db: DbClient,
  userId: number,
  goalId: number,
  body: string,
): Promise<MilestoneJournalRow> {
  const now = new Date().toISOString();

  // Check if an entry already exists for this user+goal
  const existing = await db.read.prepare(
    `SELECT id FROM milestone_journals WHERE user_id = ? AND goal_id = ?`,
  ).bind(userId, goalId).first<{ id: number }>();

  if (existing) {
    // Read the original created_at before updating
    const originalRow = await db.read.prepare(
      `SELECT created_at FROM milestone_journals WHERE id = ?`,
    ).bind(existing.id).first<{ created_at: string }>();

    // Update existing entry
    await db.write.prepare(
      `UPDATE milestone_journals
       SET body = ?, updated_at = ?
       WHERE id = ?`,
    ).bind(body, now, existing.id).run();

    return {
      id: existing.id,
      user_id: userId,
      goal_id: goalId,
      body,
      created_at: originalRow?.created_at ?? now,
      updated_at: now,
    };
  } else {
    // Insert new entry
    const result = await db.write.prepare(
      `INSERT INTO milestone_journals (user_id, goal_id, body)
       VALUES (?, ?, ?)`,
    ).bind(userId, goalId, body).run();

    return {
      id: result.meta.last_row_id as number,
      user_id: userId,
      goal_id: goalId,
      body,
      created_at: now,
      updated_at: now,
    };
  }
}

/**
 * Delete a user's journal entry for a given goal.
 * Returns true if an entry was deleted, false if none existed.
 */
export async function deleteJournalEntry(
  db: DbClient,
  userId: number,
  goalId: number,
): Promise<boolean> {
  const result = await db.write.prepare(
    `DELETE FROM milestone_journals WHERE user_id = ? AND goal_id = ?`,
  ).bind(userId, goalId).run();

  return result.meta.changes > 0;
}

/**
 * Determine if the viewer should be able to read a specific friend's journal entry.
 * Rules:
 * 1. Must be accepted friends
 * 2. If milestone previews are locked, viewer must also have reached the goal
 * 3. If milestone previews are enabled, friendship alone is sufficient
 */
export async function canReadFriendEntry(
  db: DbClient,
  viewerId: number,
  authorId: number,
  goalId: number,
): Promise<boolean> {
  // Check friendship
  const areFriends = await areAcceptedFriends(db, viewerId, authorId);
  if (!areFriends) return false;

  // Check preview preference
  const previewsEnabled = await getMilestonePreviewsEnabled(db, viewerId);
  if (previewsEnabled) return true;

  // Previews locked: viewer must have reached the goal
  return hasUserReachedGoal(db, viewerId, goalId);
}

/**
 * Compute the full permission state for a viewer on a goal.
 * Does NOT require friendship checks for canWrite/canEditOwn/canDeleteOwn.
 * canReadFriends is computed from whether the viewer has any accepted friends.
 *
 * @param hasPersonalReach - Whether viewer has personally reached the goal
 * @param hasFellowshipReach - Whether an active fellowship context has reached the goal
 * @param hasOwnEntry - Whether the viewer already has a journal entry for this goal
 * @param hasFriends - Whether the viewer has any accepted friends
 */
export function computeJournalPermissions(params: {
  hasPersonalReach: boolean;
  hasFellowshipReach: boolean;
  hasOwnEntry: boolean;
  hasFriends: boolean;
}): JournalPermissions {
  const canWrite = params.hasPersonalReach || params.hasFellowshipReach;
  return {
    canWrite: canWrite && !params.hasOwnEntry,
    canEditOwn: params.hasOwnEntry && canWrite,
    canDeleteOwn: params.hasOwnEntry,
    canReadFriends: params.hasFriends,
  };
}
