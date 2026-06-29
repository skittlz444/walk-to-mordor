// Shared party distance computation helpers
import type { DbClient } from './db';
import { applyStorylineOffset, resolvePartyStoryline } from './storyline-utils';

/** D1 result row for party_members table */
interface PartyMemberRow {
  id: number;
  party_id: number;
  user_id: number;
  joined_at: string;
  distance_at_join: number;
  role: string;
  status: string;
  last_viewed_distance: number;
  departed_at: string | null;
  distance_kept: number | null;
  contribution_at_departure: number | null;
}

/** Row shape for active member distance query */
interface ActiveMemberDistanceRow {
  user_id: number;
  display_name: string;
  distance_at_join: number;
  joined_at: string;
  avatar_id: string | null;
  total_distance: number;
}

/** Row shape for departed member query */
interface DepartedMemberRow {
  user_id: number;
  display_name: string;
  status: string;
  contribution_at_departure: number | null;
  joined_at: string;
  avatar_id: string | null;
}

/**
 * Compute the total distance for a party, matching the logic in handlePartyProgress.
 * This accounts for:
 * - Distance mode (incremental vs cumulative)
 * - Departed members with distance_kept=1
 * - Storyline offset
 * - Pre-join history via distance_at_join
 */
export async function computePartyTotalDistance(
  db: DbClient,
  partyId: number,
  distanceMode: string,
  userId?: number,
): Promise<number> {
  // Get active members with their total distances from the progress table
  const { results: activeMembers } = await db.read.prepare(
    `SELECT pm.user_id, u.username as display_name, pm.distance_at_join, pm.joined_at,
            u.avatar_id,
            COALESCE((SELECT SUM(p.distance) FROM progress p WHERE p.user_id = pm.user_id), 0) as total_distance
     FROM party_members pm
     JOIN users u ON pm.user_id = u.id
     WHERE pm.party_id = ? AND pm.status = ?
     ORDER BY pm.joined_at ASC, pm.user_id ASC`,
  ).bind(partyId, 'active').all<ActiveMemberDistanceRow>();

  // Calculate active member contributions
  let rawTotalDistance = 0;

  for (const member of activeMembers) {
    let contribution: number;
    if (distanceMode === 'incremental') {
      contribution = Math.max(0, member.total_distance - member.distance_at_join);
    } else {
      contribution = member.total_distance;
    }
    rawTotalDistance += contribution;
  }

  // Handle departed members with kept contributions
  const { results: departedMembers } = await db.read.prepare(
    `SELECT pm.user_id, u.username as display_name, pm.status, pm.contribution_at_departure, pm.joined_at,
            u.avatar_id
     FROM party_members pm
     JOIN users u ON pm.user_id = u.id
     WHERE pm.party_id = ? AND pm.status IN ('left', 'kicked') AND pm.distance_kept = 1
     ORDER BY pm.joined_at ASC, pm.user_id ASC`,
  ).bind(partyId).all<DepartedMemberRow>();

  for (const departed of departedMembers) {
    const contribution = departed.contribution_at_departure ?? 0;
    rawTotalDistance += contribution;
  }

  // Round to 2 decimal places to avoid floating point drift
  rawTotalDistance = Number(rawTotalDistance.toFixed(2));

  // Apply storyline offset
  const storylineContext = await resolvePartyStoryline(db, partyId, userId);
  const totalDistance = applyStorylineOffset(rawTotalDistance, storylineContext.distanceOffset);

  return totalDistance;
}
