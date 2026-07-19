import { getAuthHeaders } from './auth';

export type GoalContentEventType = 'teaser_impression' | 'content_open';

interface GoalContentEventOptions {
  goalId: number;
  eventType: GoalContentEventType;
  partyId?: number | null;
  contentId?: number | null;
}

export function recordGoalContentEvent({ goalId, eventType, partyId, contentId }: GoalContentEventOptions): void {
  try {
    const body: Record<string, string | number> = {
      event_type: eventType,
      context_type: partyId ? 'fellowship' : 'personal',
    };
    if (partyId) body.partyId = partyId;
    if (contentId) body.content_id = contentId;

    void fetch(`/api/goals/${goalId}/content/events`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(body),
    }).catch(() => undefined);
  } catch {
    // Best-effort analytics must never affect UI.
  }
}
