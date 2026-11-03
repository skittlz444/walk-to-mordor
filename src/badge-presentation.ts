// Presentation resolution for achievement badge definitions.
//
// Rank, collection position, and storyline scope live in the free-form
// `achievement_definitions.metadata` JSON column. This module parses that
// payload defensively: null, malformed JSON, wrong types, and out-of-range
// values are all treated as absent, so a bad definition can never break the
// achievements endpoint.

export type BadgeRank = 1 | 2 | 3 | 4;
export type BadgeRankLabel = 'bronze' | 'silver' | 'gold' | 'mithril';

/** Numbered position of a badge within an ordered collection. */
export interface BadgeCollection {
  slug: string;
  label: string;
  index: number;
  size: number;
}

/** Validated presentation metadata. Every field is optional. */
export interface BadgeMetadata {
  /** Fixed rank for definitions whose rank does not vary with repeat count. */
  rank?: BadgeRank;
  /** Ascending earn counts that select ranks 1-4; used when `rank` is absent. */
  rank_thresholds?: [number, number, number, number];
  /** Storyline scope; absent means the badge is global. */
  storyline?: string;
  /** Collection membership; absent for standalone badges. */
  collection?: BadgeCollection;
}

/** Server-resolved presentation block returned by the achievements API. */
export interface BadgePresentation {
  rank: BadgeRank;
  rank_label: BadgeRankLabel;
  storyline: string | null;
  collection: BadgeCollection | null;
}

const RANK_LABELS: Record<BadgeRank, BadgeRankLabel> = {
  1: 'bronze',
  2: 'silver',
  3: 'gold',
  4: 'mithril',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function isBadgeRank(value: unknown): value is BadgeRank {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

function parseRankThresholds(value: unknown): [number, number, number, number] | undefined {
  if (!Array.isArray(value) || value.length !== 4) return undefined;
  if (!value.every((entry) => typeof entry === 'number' && Number.isInteger(entry) && entry > 0)) {
    return undefined;
  }
  for (let i = 1; i < value.length; i++) {
    if ((value[i] as number) <= (value[i - 1] as number)) return undefined;
  }
  return value as [number, number, number, number];
}

function parseCollection(value: unknown): BadgeCollection | undefined {
  if (!isPlainObject(value)) return undefined;
  const { slug, label, index, size } = value;
  if (
    !isNonEmptyString(slug) ||
    !isNonEmptyString(label) ||
    !isPositiveInteger(index) ||
    !isPositiveInteger(size) ||
    index > size
  ) {
    return undefined;
  }
  return { slug, label, index, size };
}

/** Validate an already-decoded metadata value. */
function readMetadata(value: unknown): BadgeMetadata {
  if (!isPlainObject(value)) return {};

  const metadata: BadgeMetadata = {};

  if (isBadgeRank(value.rank)) metadata.rank = value.rank;
  if (isNonEmptyString(value.storyline)) metadata.storyline = value.storyline;

  const thresholds = parseRankThresholds(value.rank_thresholds);
  if (thresholds) metadata.rank_thresholds = thresholds;

  const collection = parseCollection(value.collection);
  if (collection) metadata.collection = collection;

  return metadata;
}

/**
 * Decode the raw metadata column into a plain object without validating fields.
 * Never throws; null, blank, malformed JSON, and non-object JSON return `{}`.
 */
export function parseBadgeMetadataObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw.trim() === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isPlainObject(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Parse the raw `metadata` column (or an already-decoded object) into validated
 * presentation metadata. Never throws; anything unusable collapses to an empty
 * object.
 */
export function parseBadgeMetadata(raw: unknown): BadgeMetadata {
  if (typeof raw === 'string') return readMetadata(parseBadgeMetadataObject(raw));
  return readMetadata(raw);
}

/** Accept either raw metadata JSON or an already-parsed metadata object. */
function normalizeMetadata(metadata: unknown): BadgeMetadata {
  return parseBadgeMetadata(metadata);
}

/**
 * Resolve a badge rank (1-4).
 *
 * A fixed `rank` wins. Otherwise `rank_thresholds` maps earn counts onto ranks:
 * `earnedCount >= rank_thresholds[i]` selects rank `i + 1`, so exact
 * boundaries count, below the first threshold stays rank 1, and above the last
 * stays rank 4. With neither, rank 1.
 */
export function resolveBadgeRank(metadata: unknown, earnedCount: number): BadgeRank {
  const parsed = normalizeMetadata(metadata);
  if (parsed.rank !== undefined) return parsed.rank;

  const thresholds = parsed.rank_thresholds;
  if (!thresholds) return 1;

  const count = Number.isFinite(earnedCount) ? earnedCount : 0;
  let rank: BadgeRank = 1;
  for (let i = 0; i < thresholds.length; i++) {
    if (count >= thresholds[i]) rank = (i + 1) as BadgeRank;
  }
  return rank;
}

/** Resolve the complete presentation block for one summary entry. */
export function resolveBadgePresentation(metadata: unknown, earnedCount: number): BadgePresentation {
  const parsed = normalizeMetadata(metadata);
  const rank = resolveBadgeRank(parsed, earnedCount);
  return {
    rank,
    rank_label: RANK_LABELS[rank],
    storyline: parsed.storyline ?? null,
    collection: parsed.collection ?? null,
  };
}
