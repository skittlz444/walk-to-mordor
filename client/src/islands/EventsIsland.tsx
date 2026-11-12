import { useCallback, useEffect, useState } from 'preact/hooks';
import { getAuthHeaders } from '../utils/auth';

/**
 * Public `/events` island.
 *
 * Renders enabled community campaigns (never personal challenges): campaign
 * imagery, one progress bar per active run, the top-five public contributors,
 * past-run outcomes, and a join affordance for authenticated visitors.
 *
 * Data comes from the public campaign API: `GET /api/events` for cards and
 * `GET /api/events/:id/community-progress` for the ranked contributor list and
 * the caller's own rank. Both endpoints are auth-optional, so anonymous
 * visitors render without ever being redirected to `/login`.
 */

type CampaignRunStatus = 'upcoming' | 'active' | 'completed' | 'expired';

interface CampaignRunSummary {
  id: number;
  runNumber: number;
  targetDistance: number;
  startDate: string;
  endDate: string;
  status: CampaignRunStatus;
  completedAt: string | null;
  announcedAt: string | null;
  participantCount: number;
  contributorCount: number;
  totalDistance: number;
  fromSnapshot: boolean;
}

interface CampaignParticipation {
  participantId: number;
  status: 'active' | 'removed';
  joinedAt: string;
  contributionDistance: number;
}

interface CampaignSummary {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageSlug: string | null;
  badgeSlug: string | null;
  enabled: boolean;
  activeRun: CampaignRunSummary | null;
  pastRuns: CampaignRunSummary[];
  participation: CampaignParticipation | null;
}

interface ContributorRankEntry {
  rank: number;
  userId: number;
  username: string;
  distance: number;
}

interface CommunityProgress {
  campaignId: number;
  campaignSlug: string;
  runId: number | null;
  runNumber: number | null;
  targetDistance: number | null;
  startDate: string | null;
  endDate: string | null;
  status: CampaignRunStatus | null;
  daysRemaining: number | null;
  totalDistance: number;
  participantCount: number;
  contributorCount: number;
  contributors: ContributorRankEntry[];
  you: { distance: number; rank: number } | null;
}

const IMAGE_SLUG_PATTERN = /^[a-z0-9-]+$/;
const VISIBLE_CONTRIBUTORS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const STATUS_LABELS: Record<CampaignRunStatus, string> = {
  upcoming: 'Upcoming',
  active: 'Active',
  completed: 'Completed',
  expired: 'Expired',
};

/** Keep whole distances whole and fractional distances to one decimal. */
function formatKm(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** Parse a UTC `YYYY-MM-DD` date without shifting it into a local day. */
function parseUtcDate(value: string): Date | null {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = parseUtcDate(value);
  if (!date) return value;
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Whole days left, counting today as the boundary. Null for invalid dates. */
function daysLeft(endDate: string): number | null {
  const end = parseUtcDate(endDate);
  if (!end) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.max(0, Math.round((end.getTime() - todayUtc) / MS_PER_DAY));
}

function progressPercent(totalDistance: number, targetDistance: number): number {
  if (!Number.isFinite(totalDistance) || !Number.isFinite(targetDistance) || targetDistance <= 0) {
    return 0;
  }
  return Math.min(100, Math.max(0, Math.round((totalDistance / targetDistance) * 100)));
}

function readSessionToken(): string | null {
  try {
    return localStorage.getItem('sessionToken');
  } catch {
    return null;
  }
}

function statusClass(status: CampaignRunStatus): string {
  return `event-status event-status--${status}`;
}

function CampaignArtwork({ imageSlug, name }: { imageSlug: string | null; name: string }) {
  const [highResFailed, setHighResFailed] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  if (!imageSlug || !IMAGE_SLUG_PATTERN.test(imageSlug)) return null;

  const showHighRes = !highResFailed;
  const showThumb = !thumbFailed;
  if (!showHighRes && !showThumb) return null;

  const alt = `${name} campaign artwork`;

  return (
    <div className="event-card__art">
      {showThumb && (
        <img
          className="event-card__thumb"
          src={`/img/thumbs/${imageSlug}-thumb.webp`}
          alt={showHighRes ? '' : alt}
          aria-hidden={showHighRes ? 'true' : undefined}
          loading="lazy"
          onError={() => setThumbFailed(true)}
        />
      )}
      {showHighRes && (
        <img
          className="event-card__image"
          src={`/img/highres/${imageSlug}.webp`}
          alt={alt}
          loading="lazy"
          onError={() => setHighResFailed(true)}
        />
      )}
    </div>
  );
}

interface CampaignCardProps {
  campaign: CampaignSummary;
  progress: CommunityProgress | null;
  authenticated: boolean;
  joining: boolean;
  joinError: string | null;
  onJoin: (campaignId: number) => void;
}

function CampaignCard({
  campaign,
  progress,
  authenticated,
  joining,
  joinError,
  onJoin,
}: CampaignCardProps) {
  const run = campaign.activeRun;
  if (!run) return null;

  const participation = campaign.participation;
  const percent = progressPercent(run.totalDistance, run.targetDistance);
  const contributors = progress?.contributors ?? [];
  const visibleContributors = contributors.slice(0, VISIBLE_CONTRIBUTORS);
  const remainingContributors = Math.max(0, run.contributorCount - visibleContributors.length);
  const remainingDays = run.status === 'active' ? daysLeft(run.endDate) : null;
  const ownRank = progress?.you?.rank ?? null;

  return (
    <article className="event-card" data-campaign={campaign.slug}>
      <CampaignArtwork imageSlug={campaign.imageSlug} name={campaign.name} />

      <div className="event-card__body">
        <div className="event-card__header">
          <h3 className="event-card__title">{campaign.name}</h3>
          <span className={statusClass(run.status)}>{STATUS_LABELS[run.status]}</span>
        </div>

        <p className="event-card__description">{campaign.description}</p>

        <div className="event-progress">
          <div className="event-progress__labels">
            <span>
              <strong>{formatKm(run.totalDistance)} km</strong> of {formatKm(run.targetDistance)} km
            </span>
            <span>{percent}%</span>
          </div>
          <div
            className="event-progress__track"
            role="progressbar"
            aria-label={`${campaign.name} community progress`}
            aria-valuemin={0}
            aria-valuemax={run.targetDistance}
            aria-valuenow={run.totalDistance}
          >
            <div className="event-progress__fill" style={{ width: `${percent}%` }} />
          </div>
          <p className="event-progress__meta">
            {run.participantCount} {run.participantCount === 1 ? 'walker' : 'walkers'}
            {' · '}
            {run.contributorCount} {run.contributorCount === 1 ? 'contributor' : 'contributors'}
            {' · '}run {run.runNumber}
          </p>
        </div>

        <p className="event-card__window">
          {run.status === 'upcoming' ? 'Starts ' : 'Ends '}
          <time dateTime={run.startDate}>{formatDate(run.startDate)}</time>
          {' – '}
          <time dateTime={run.endDate}>{formatDate(run.endDate)}</time>
          {remainingDays !== null && (
            <> · {remainingDays} {remainingDays === 1 ? 'day' : 'days'} left</>
          )}
        </p>

        <p className="event-card__which-days">
          Walks dated <time dateTime={run.startDate}>{formatDate(run.startDate)}</time>
          {'–'}
          <time dateTime={run.endDate}>{formatDate(run.endDate)}</time> count toward this campaign.
        </p>

        {visibleContributors.length > 0 && (
          <div className="event-contributors">
            <p className="event-contributors__title">Top contributors</p>
            <ol className="event-contributors__list">
              {visibleContributors.map((entry) => (
                <li className="event-contributors__item" key={entry.userId}>
                  <span className="event-contributors__name">
                    #{entry.rank} {entry.username}
                  </span>
                  <span className="event-contributors__distance">{formatKm(entry.distance)} km</span>
                </li>
              ))}
            </ol>
            {remainingContributors > 0 && (
              <p className="event-contributors__more">and {remainingContributors} more</p>
            )}
          </div>
        )}

        <div className="event-join">
          {participation && participation.status === 'active' ? (
            run.status === 'upcoming' ? (
              <p className="event-join__joined">
                You're in — starts <time dateTime={run.startDate}>{formatDate(run.startDate)}</time>
              </p>
            ) : (
              <p className="event-join__contribution">
                You're in — your contribution:{' '}
                <strong>{formatKm(participation.contributionDistance)} km</strong>
                {ownRank !== null && <> · rank #{ownRank}</>}
              </p>
            )
          ) : participation ? (
            <p className="event-join__removed">
              Your participation in this run has been removed.
            </p>
          ) : authenticated ? (
            <button
              type="button"
              className="event-join__button"
              onClick={() => onJoin(campaign.id)}
              disabled={joining}
            >
              {joining ? 'Joining…' : 'Join campaign'}
            </button>
          ) : (
            <a className="event-join__signin" href="/login">
              Sign in to join
            </a>
          )}

          {!participation && (
            <p className="event-join__notice">
              Your username and contribution distance will be publicly visible.
            </p>
          )}

          {joinError && (
            <p className="event-join__error" role="alert">
              {joinError}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function PastRunCard({ campaign, run }: { campaign: CampaignSummary; run: CampaignRunSummary }) {
  const percent = progressPercent(run.totalDistance, run.targetDistance);

  return (
    <article className="event-past-card" data-campaign={campaign.slug} data-run={run.runNumber}>
      <div className="event-past-card__header">
        <h3 className="event-past-card__title">
          {campaign.name}
          <span className="event-card__run">Run {run.runNumber}</span>
        </h3>
        <span className={statusClass(run.status)}>{STATUS_LABELS[run.status]}</span>
      </div>
      <p className="event-past-card__progress">
        Final progress: <strong>{formatKm(run.totalDistance)} km</strong> of{' '}
        {formatKm(run.targetDistance)} km ({percent}%)
      </p>
      <p className="event-past-card__meta">
        {run.participantCount} {run.participantCount === 1 ? 'walker' : 'walkers'}
        {' · '}
        {run.contributorCount} {run.contributorCount === 1 ? 'contributor' : 'contributors'}
        {' · '}
        <time dateTime={run.startDate}>{formatDate(run.startDate)}</time>
        {'–'}
        <time dateTime={run.endDate}>{formatDate(run.endDate)}</time>
      </p>
    </article>
  );
}

export function EventsIsland() {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [progressByCampaign, setProgressByCampaign] = useState<Record<number, CommunityProgress>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [joinError, setJoinError] = useState<{ campaignId: number; message: string } | null>(null);
  const [authenticated] = useState<boolean>(() => readSessionToken() !== null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/events', { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Failed to load campaigns');

      const body = await response.json() as { campaigns?: CampaignSummary[] };
      const list = Array.isArray(body.campaigns) ? body.campaigns : [];

      // Contributor rankings live on the per-campaign progress endpoint; a
      // failed or slow progress call must not hide the campaign card itself.
      const progressEntries = await Promise.all(
        list
          .filter((campaign) => campaign.activeRun !== null)
          .map(async (campaign): Promise<[number, CommunityProgress | null]> => {
            try {
              const progressResponse = await fetch(
                `/api/events/${campaign.id}/community-progress`,
                { headers: getAuthHeaders() },
              );
              if (!progressResponse.ok) return [campaign.id, null];
              return [campaign.id, await progressResponse.json() as CommunityProgress];
            } catch {
              return [campaign.id, null];
            }
          }),
      );

      const nextProgress: Record<number, CommunityProgress> = {};
      for (const [campaignId, progress] of progressEntries) {
        if (progress) nextProgress[campaignId] = progress;
      }

      setCampaigns(list);
      setProgressByCampaign(nextProgress);
    } catch (loadError) {
      console.error('EventsIsland: failed to load campaigns', loadError);
      setError('We could not load the community campaigns. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleJoin = useCallback(async (campaignId: number) => {
    setJoiningId(campaignId);
    setJoinError(null);
    try {
      const response = await fetch(`/api/events/${campaignId}/join`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || 'We could not join this campaign. Please try again.');
      }
      await load();
    } catch (joinFailure) {
      console.error('EventsIsland: failed to join campaign', joinFailure);
      setJoinError({
        campaignId,
        message: joinFailure instanceof Error
          ? joinFailure.message
          : 'We could not join this campaign. Please try again.',
      });
    } finally {
      setJoiningId(null);
    }
  }, [load]);

  if (loading) {
    return (
      <div className="events-page">
        <div className="events-loading">
          <i className="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading campaigns…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="events-page">
        <div className="events-error">
          <p>{error}</p>
          <button type="button" onClick={() => { void load(); }}>Retry</button>
        </div>
      </div>
    );
  }

  const current = campaigns.filter((campaign) => campaign.activeRun !== null);
  const past = campaigns.flatMap((campaign) =>
    campaign.pastRuns.map((run) => ({ campaign, run })),
  );

  if (current.length === 0 && past.length === 0) {
    return (
      <div className="events-page">
        <div className="events-empty">
          <i className="fas fa-flag" aria-hidden="true"></i> No community campaigns are running right now. Check back soon.
        </div>
      </div>
    );
  }

  return (
    <div className="events-page">
      {current.length > 0 && (
        <section className="events-current">
          <h2>Community Campaigns</h2>
          <div className="events-grid">
            {current.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                progress={progressByCampaign[campaign.id] ?? null}
                authenticated={authenticated}
                joining={joiningId === campaign.id}
                joinError={joinError?.campaignId === campaign.id ? joinError.message : null}
                onJoin={(id) => { void handleJoin(id); }}
              />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="events-past">
          <h2>Past Campaigns</h2>
          <div className="event-past-list">
            {past.map(({ campaign, run }) => (
              <PastRunCard key={`${campaign.id}-${run.id}`} campaign={campaign} run={run} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
