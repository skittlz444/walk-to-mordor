// Community campaign API handlers. The list, detail, and community-progress
// endpoints are public: an absent or invalid Authorization header is not an
// error, it just means the response carries no personal overlay. A valid
// header adds the caller's participation/contribution. Joining is the only
// authenticated action and is registered behind the existing auth guard.
import { validateSession } from './auth-handlers';
import {
  CampaignConflictError,
  CampaignNotFoundError,
  CampaignValidationError,
  getCampaignDetail,
  getCommunityProgress,
  joinCampaignRun,
  listCampaigns,
} from './campaign-utils';
import type { DbClient } from './db';
import { createErrorResponse, createSuccessResponse } from './validators';

/**
 * Resolve the caller from the Authorization header, if one is present and
 * valid. Public campaign endpoints deliberately treat invalid auth as anonymous
 * so a stale token never hides public data.
 */
async function optionalUserId(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<number | undefined> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return undefined;

  try {
    const result = await validateSession(request, db, allowTestAuth);
    return result.valid ? result.userId : undefined;
  } catch (error: unknown) {
    console.error('Error validating optional campaign session:', error);
    return undefined;
  }
}

/** `GET /api/events` — enabled campaigns with their active run and history. */
export async function handleCampaignsList(
  request: Request,
  db: DbClient,
  allowTestAuth?: string,
): Promise<Response> {
  try {
    const userId = await optionalUserId(request, db, allowTestAuth);
    const campaigns = await listCampaigns(db, { userId });
    return createSuccessResponse({ campaigns });
  } catch (error: unknown) {
    console.error('Error listing campaigns:', error);
    return createErrorResponse('Internal server error while listing campaigns', 500);
  }
}

/** `GET /api/events/:id` — one campaign with every run summary. */
export async function handleCampaignDetail(
  request: Request,
  db: DbClient,
  campaignId: number,
  allowTestAuth?: string,
): Promise<Response> {
  try {
    const userId = await optionalUserId(request, db, allowTestAuth);
    const detail = await getCampaignDetail(db, campaignId, { userId });

    // The domain layer returns disabled campaigns so admin surfaces can inspect
    // them; the public endpoint treats them as absent.
    if (!detail || !detail.enabled) {
      return createErrorResponse('Campaign not found', 404);
    }

    return createSuccessResponse(detail);
  } catch (error: unknown) {
    console.error('Error loading campaign detail:', error);
    return createErrorResponse('Internal server error while loading campaign', 500);
  }
}

/** `GET /api/events/:id/community-progress` — public run progress and ranking. */
export async function handleCampaignCommunityProgress(
  request: Request,
  db: DbClient,
  campaignId: number,
  allowTestAuth?: string,
): Promise<Response> {
  try {
    const userId = await optionalUserId(request, db, allowTestAuth);
    const progress = await getCommunityProgress(db, campaignId, { userId });

    // Null covers both an unknown campaign and a disabled (frozen) campaign.
    if (!progress) {
      return createErrorResponse('Campaign not found', 404);
    }

    return createSuccessResponse(progress);
  } catch (error: unknown) {
    console.error('Error loading campaign community progress:', error);
    return createErrorResponse('Internal server error while loading community progress', 500);
  }
}

/** `POST /api/events/:id/join` — opt into the campaign's current run. */
export async function handleCampaignJoin(
  db: DbClient,
  campaignId: number,
  userId: number,
): Promise<Response> {
  try {
    const joined = await joinCampaignRun(db, campaignId, userId);

    return createSuccessResponse({
      joined: true,
      campaignId: joined.campaign.id,
      campaignSlug: joined.campaign.slug,
      runId: joined.run.id,
      runNumber: joined.run.run_number,
      participation: {
        participantId: joined.participant.id,
        status: joined.participant.status,
        joinedAt: joined.participant.joined_at,
        contributionDistance: joined.participant.progress_distance,
      },
    }, 201);
  } catch (error: unknown) {
    if (
      error instanceof CampaignNotFoundError
      || error instanceof CampaignValidationError
      || error instanceof CampaignConflictError
    ) {
      return createErrorResponse(error.message, error.status);
    }

    console.error('Error joining campaign run:', error);
    return createErrorResponse('Internal server error while joining campaign', 500);
  }
}
