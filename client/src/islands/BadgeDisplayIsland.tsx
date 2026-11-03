import { useEffect, useState } from 'preact/hooks';
import { getAuthHeaders } from '../utils/auth';

const IMAGE_SLUG_PATTERN = /^[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const RANK_LABEL_PATTERN = /^[a-z0-9-]+$/;
const SKELETON_DELAY_MS = 175;
const SKELETON_COUNT = 8;
const OTHER_SECTION_LABEL = 'Other';
const BADGE_AWARD_EVENT = 'wtm:open-badge-modal';

export interface BadgeCollection {
  slug: string;
  label: string;
  index: number;
  size: number;
}

export interface BadgePresentation {
  rank?: number;
  rank_label?: string;
  storyline?: string | null;
  collection?: BadgeCollection | null;
}

export interface BadgeAchievement {
  slug: string;
  name: string;
  description?: string;
  image_slug: string | null;
  badge_type?: string;
  is_repeatable: boolean;
  earned_count: number;
  first_earned_at?: string;
  last_earned_at?: string;
  presentation?: BadgePresentation | null;
}

interface BadgeSection {
  key: string;
  label: string;
  progress: string | null;
  entries: BadgeAchievement[];
}

function parseAchievementsTarget(pathname: string): string | null {
  if (pathname === '/profile') return '/api/achievements';

  const friendMatch = /^\/friends\/(\d+)$/.exec(pathname);
  if (friendMatch) return `/api/achievements?userId=${friendMatch[1]}`;

  return null;
}

function isCollection(value: BadgeCollection | null | undefined): value is BadgeCollection {
  return value != null
    && typeof value.slug === 'string' && value.slug.length > 0
    && typeof value.label === 'string' && value.label.length > 0
    && Number.isFinite(value.index)
    && Number.isFinite(value.size) && value.size > 0;
}

function collectionIndexOf(entry: BadgeAchievement): number {
  return entry.presentation?.collection?.index ?? 0;
}

/**
 * One section per collection that has at least one earned badge, ordered by
 * collection index. Everything without a collection trails in "Other" in API
 * (newest-earned first) order.
 */
function groupBadges(entries: BadgeAchievement[]): BadgeSection[] {
  const collections = new Map<string, { info: BadgeCollection; entries: BadgeAchievement[] }>();
  const other: BadgeAchievement[] = [];

  for (const entry of entries) {
    const collection = entry.presentation?.collection;
    if (isCollection(collection)) {
      const group = collections.get(collection.slug);
      if (group) {
        group.entries.push(entry);
      } else {
        collections.set(collection.slug, { info: collection, entries: [entry] });
      }
    } else {
      other.push(entry);
    }
  }

  const sections: BadgeSection[] = Array.from(collections.values())
    .sort((a, b) => {
      // collection.index is the badge's position, so a collection sorts by its
      // earliest earned position rather than by API (newest-first) arrival.
      const aIndex = Math.min(...a.entries.map(collectionIndexOf));
      const bIndex = Math.min(...b.entries.map(collectionIndexOf));
      return aIndex - bIndex || a.info.label.localeCompare(b.info.label);
    })
    .map(({ info, entries: members }) => ({
      key: `collection:${info.slug}`,
      label: info.label,
      progress: `${members.length}/${info.size}`,
      entries: [...members].sort((a, b) => collectionIndexOf(a) - collectionIndexOf(b)),
    }));

  if (other.length > 0) {
    sections.push({
      key: 'other',
      label: OTHER_SECTION_LABEL,
      progress: null,
      entries: other,
    });
  }

  return sections;
}

/**
 * Artwork name used for the card image. Repeatables select their rank variant;
 * fixed-rank badges use the plain slug. Null or malformed slugs return null so
 * no request is made.
 */
function imageNameFor(entry: BadgeAchievement): string | null {
  const slug = entry.image_slug;
  if (!slug || !IMAGE_SLUG_PATTERN.test(slug)) return null;

  if (entry.is_repeatable) {
    const rankLabel = entry.presentation?.rank_label;
    if (rankLabel && RANK_LABEL_PATTERN.test(rankLabel)) {
      return `${slug}--${rankLabel}`;
    }
  }

  return slug;
}

/** Accessible name for the activatable card; includes rank, position and repeats. */
function badgeAccessibleName(entry: BadgeAchievement): string {
  const parts = [entry.name];
  const rankLabel = entry.presentation?.rank_label;
  if (rankLabel) parts.push(`Rank: ${rankLabel}`);

  const collection = entry.presentation?.collection;
  if (isCollection(collection)) {
    parts.push(`Collection position ${collection.index} of ${collection.size}`);
  }

  // Only repeatables can be earned more than once; a stray duplicate count on a
  // non-repeatable badge must never be announced as a repeat.
  if (entry.is_repeatable && entry.earned_count > 1) {
    parts.push(`Earned ${entry.earned_count} times`);
  }

  return parts.join('. ');
}

function openBadgeModal(entry: BadgeAchievement): void {
  document.dispatchEvent(new CustomEvent(BADGE_AWARD_EVENT, {
    detail: { ...entry, presentation: entry.presentation ?? null },
  }));
}

function BadgeCard({ entry }: { entry: BadgeAchievement }) {
  const [imageState, setImageState] = useState<'primary' | 'base' | 'failed'>('primary');

  const imageName = imageNameFor(entry);
  const primarySrc = imageName ? `/img/achievements/${imageName}.webp` : null;
  const baseSrc = entry.image_slug ? `/img/achievements/${entry.image_slug}.webp` : null;

  const imageSrc = imageName === null || imageState === 'failed'
    ? null
    : imageState === 'base'
      ? baseSrc
      : primarySrc;

  const collection = entry.presentation?.collection;
  const hasCollection = isCollection(collection);
  const rankLabel = entry.presentation?.rank_label;

  const handleImageError = () => {
    if (imageState === 'primary' && baseSrc && baseSrc !== primarySrc) {
      setImageState('base');
    } else {
      setImageState('failed');
    }
  };

  // Native buttons activate on Enter/Space in browsers; handling keydown here
  // keeps that contract in the test DOM and preventDefault suppresses the
  // native click so the event fires once per activation.
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openBadgeModal(entry);
  };

  return (
    <li className="badge-card">
      <button
        type="button"
        className="badge-card__button"
        aria-label={badgeAccessibleName(entry)}
        onClick={() => openBadgeModal(entry)}
        onKeyDown={handleKeyDown}
      >
        <span className="badge-card__art">
          {imageSrc ? (
            <img
              className="badge-card__image"
              src={imageSrc}
              alt=""
              width={512}
              height={512}
              loading="lazy"
              onError={handleImageError}
            />
          ) : (
            <span className="badge-card__placeholder" aria-hidden="true"></span>
          )}
        </span>

        <span className="badge-card__name">{entry.name}</span>

        <span className="badge-card__meta">
          {rankLabel && (
            <span className="badge-rank" role="img" aria-label={`Rank: ${rankLabel}`}>
              {rankLabel}
            </span>
          )}
          {hasCollection && (
            <span
              className="badge-position"
              role="img"
              aria-label={`Collection position ${collection.index} of ${collection.size}`}
            >
              {collection.index}/{collection.size}
            </span>
          )}
          {entry.is_repeatable && entry.earned_count > 1 && (
            <span className="badge-repeat" role="img" aria-label={`Earned ${entry.earned_count} times`}>
              ×{entry.earned_count}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

export function BadgeDisplayIsland() {
  const [entries, setEntries] = useState<BadgeAchievement[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    const endpoint = parseAchievementsTarget(window.location.pathname);
    if (!endpoint) return;

    let cancelled = false;
    const skeletonTimer = setTimeout(() => {
      if (!cancelled) setShowSkeleton(true);
    }, SKELETON_DELAY_MS);

    const load = async () => {
      try {
        const response = await fetch(endpoint, { headers: getAuthHeaders() });
        if (cancelled) return;

        if (response.status === 401) {
          setEntries([]);
          return;
        }

        if (response.status === 404) {
          console.error('BadgeDisplayIsland: achievements were not found');
          setFailed(true);
          return;
        }

        if (!response.ok) {
          console.error(`BadgeDisplayIsland: failed to load achievements (${response.status})`);
          setFailed(true);
          return;
        }

        const data = await response.json() as { achievements?: unknown };
        if (cancelled) return;

        setEntries(Array.isArray(data.achievements) ? data.achievements as BadgeAchievement[] : []);
      } catch (error) {
        if (cancelled) return;
        console.error('BadgeDisplayIsland: failed to load achievements', error);
        setFailed(true);
      } finally {
        if (!cancelled) {
          clearTimeout(skeletonTimer);
          setShowSkeleton(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
      clearTimeout(skeletonTimer);
    };
  }, []);

  if (failed) return null;

  if (entries === null) {
    if (!showSkeleton) return null;
    return (
      <div className="badge-display" aria-hidden="true">
        <div className="badge-display__skeletons">
          {Array.from({ length: SKELETON_COUNT }, (_, index) => (
            <span key={index} className="badge-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  if (entries.length === 0) return null;

  const sections = groupBadges(entries);

  return (
    <div className="badge-display">
      {sections.map((section) => (
        <section key={section.key} className="badge-collection">
          <h3 className="badge-collection__header">
            <span className="badge-collection__label">{section.label}</span>
            {section.progress && (
              <span className="badge-collection__progress"> · {section.progress}</span>
            )}
          </h3>
          <ul className="badge-grid">
            {section.entries.map((entry) => (
              <BadgeCard key={entry.slug} entry={entry} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
