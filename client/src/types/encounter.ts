/**
 * Personal encounter contract shared by the popup island and its trigger.
 *
 * Server payloads are untrusted: both entry points narrow `unknown` through
 * the parsers here, so a malformed or absent offer never reaches the UI.
 */

/** Reusable encounter configuration returned with an offer. */
export interface EncounterDefinition {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  duration_days: number;
}

/** The `offer` object from `POST /api/events/daily-roll`. */
export interface EncounterOffer {
  status: 'offered';
  definition: EncounterDefinition;
  target: number;
  /** YYYY-MM-DD */
  coverageStart: string;
  /** YYYY-MM-DD */
  coverageEnd: string;
  /** YYYY-MM-DD */
  graceDeadline: string;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

/**
 * Narrow an offer object. Returns null for anything that is not a complete,
 * `status: 'offered'` payload.
 */
export function parseEncounterOffer(value: unknown): EncounterOffer | null {
  if (!isRecord(value) || value.status !== 'offered') return null;

  const definition = value.definition;
  if (!isRecord(definition)) return null;

  const { id, slug, name, description, image_slug, badge_slug, duration_days } = definition;
  if (!isFiniteNumber(id)) return null;
  if (typeof slug !== 'string' || typeof name !== 'string' || typeof description !== 'string') {
    return null;
  }
  if (image_slug !== null && typeof image_slug !== 'string') return null;
  if (badge_slug !== null && typeof badge_slug !== 'string') return null;
  if (!isFiniteNumber(duration_days)) return null;

  if (!isFiniteNumber(value.target)) return null;
  if (!isDateString(value.coverageStart) || !isDateString(value.coverageEnd) || !isDateString(value.graceDeadline)) {
    return null;
  }

  return {
    status: 'offered',
    definition: { id, slug, name, description, image_slug, badge_slug, duration_days },
    target: value.target,
    coverageStart: value.coverageStart,
    coverageEnd: value.coverageEnd,
    graceDeadline: value.graceDeadline,
  };
}

/**
 * Narrow the daily-roll response envelope (`{ offer: null | EncounterOffer }`).
 */
export function parseEncounterRollResponse(value: unknown): EncounterOffer | null {
  if (!isRecord(value)) return null;
  return parseEncounterOffer(value.offer);
}
