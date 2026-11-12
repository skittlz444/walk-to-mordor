import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { EventsIsland } from './EventsIsland';

const mockFetch = vi.fn();
let sessionToken: string | null = null;

interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
}

interface RunFixture {
  id: number;
  runNumber: number;
  targetDistance: number;
  startDate: string;
  endDate: string;
  status: 'upcoming' | 'active' | 'completed' | 'expired';
  completedAt: string | null;
  announcedAt: string | null;
  participantCount: number;
  contributorCount: number;
  totalDistance: number;
  fromSnapshot: boolean;
}

interface CampaignFixture {
  id: number;
  slug: string;
  name: string;
  description: string;
  imageSlug: string | null;
  badgeSlug: string | null;
  enabled: boolean;
  activeRun: RunFixture | null;
  pastRuns: RunFixture[];
  participation: {
    participantId: number;
    status: 'active' | 'removed';
    joinedAt: string;
    contributionDistance: number;
  } | null;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  };
}

function makeRun(overrides: Partial<RunFixture> = {}): RunFixture {
  return {
    id: 10,
    runNumber: 1,
    targetDistance: 581,
    startDate: '2026-11-01',
    endDate: '2026-11-14',
    status: 'active',
    completedAt: null,
    announcedAt: null,
    participantCount: 12,
    contributorCount: 3,
    totalDistance: 320.5,
    fromSnapshot: false,
    ...overrides,
  };
}

function makeCampaign(overrides: Partial<CampaignFixture> = {}): CampaignFixture {
  return {
    id: 1,
    slug: 'beacon-watch',
    name: 'Beacon Watch',
    description: 'Light the beacons of Gondor one hilltop at a time.',
    imageSlug: 'beacon-watch',
    badgeSlug: 'community-beacon-watch',
    enabled: true,
    activeRun: makeRun(),
    pastRuns: [],
    participation: null,
    ...overrides,
  };
}

function makeProgress(campaign: CampaignFixture, overrides: Record<string, unknown> = {}) {
  const run = campaign.activeRun;
  return {
    campaignId: campaign.id,
    campaignSlug: campaign.slug,
    runId: run?.id ?? null,
    runNumber: run?.runNumber ?? null,
    targetDistance: run?.targetDistance ?? null,
    startDate: run?.startDate ?? null,
    endDate: run?.endDate ?? null,
    status: run?.status ?? null,
    daysRemaining: 3,
    totalDistance: run?.totalDistance ?? 0,
    participantCount: run?.participantCount ?? 0,
    contributorCount: run?.contributorCount ?? 0,
    contributors: [] as Array<{ rank: number; userId: number; username: string; distance: number }>,
    you: null,
    ...overrides,
  };
}

/**
 * Stub the two public campaign endpoints. Campaigns without an active run
 * never request community progress, mirroring the island.
 */
function stubCampaignApi(
  campaigns: CampaignFixture[],
  progressFor: (campaign: CampaignFixture) => Record<string, unknown> = (campaign) => makeProgress(campaign),
) {
  mockFetch.mockImplementation((input: unknown) => {
    const url = String(input);

    if (url === '/api/events') {
      return Promise.resolve(jsonResponse({ campaigns }));
    }

    const progressMatch = /^\/api\/events\/(\d+)\/community-progress$/.exec(url);
    if (progressMatch) {
      const campaignId = Number(progressMatch[1]);
      const campaign = campaigns.find((entry) => entry.id === campaignId);
      if (!campaign) return Promise.resolve(jsonResponse({}, 404));
      return Promise.resolve(jsonResponse(progressFor(campaign)));
    }

    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

function fetchCalls(url: string): Array<[unknown, FetchInit | undefined]> {
  return mockFetch.mock.calls.filter((call) => String(call[0]) === url) as Array<[unknown, FetchInit | undefined]>;
}

beforeEach(() => {
  sessionToken = null;
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === 'sessionToken' ? sessionToken : null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EventsIsland', () => {
  it('shows a loading state while campaigns are fetched', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { container } = render(<EventsIsland />);

    expect(container.querySelector('.events-loading')).toBeTruthy();
    expect(container.textContent).toContain('Loading campaigns');
  });

  it('renders a campaign card with imagery, progress bar, participants, deadline, and which-days copy', async () => {
    const campaign = makeCampaign();
    stubCampaignApi([campaign]);

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-card')).toBeTruthy();
    });

    expect(container.textContent).toContain('Beacon Watch');
    expect(container.textContent).toContain('Light the beacons of Gondor');

    const highRes = container.querySelector('.event-card__image') as HTMLImageElement | null;
    const thumb = container.querySelector('.event-card__thumb') as HTMLImageElement | null;
    expect(highRes?.getAttribute('src')).toBe('/img/highres/beacon-watch.webp');
    expect(thumb?.getAttribute('src')).toBe('/img/thumbs/beacon-watch-thumb.webp');

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar?.getAttribute('aria-valuenow')).toBe('320.5');
    expect(progressBar?.getAttribute('aria-valuemax')).toBe('581');
    expect((container.querySelector('.event-progress__fill') as HTMLElement).style.width).toBe('55%');

    expect(container.textContent).toContain('12 walkers');
    expect(container.textContent).toContain('Active');

    // Deadline and the walk-window copy are dated, machine-readable elements.
    const times = Array.from(container.querySelectorAll('time')).map((time) => time.getAttribute('datetime'));
    expect(times).toContain('2026-11-01');
    expect(times).toContain('2026-11-14');
    expect(container.textContent).toMatch(/Walks dated/);
    expect(container.textContent).toContain('count toward this campaign');
  });

  it('renders copy-only when a campaign has no imagery', async () => {
    stubCampaignApi([makeCampaign({ imageSlug: null })]);

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-card')).toBeTruthy();
    });

    expect(container.querySelector('.event-card__art')).toBeNull();
    expect(container.querySelector('.event-card__image')).toBeNull();
    expect(container.textContent).toContain('Light the beacons of Gondor');
  });

  it('shows the top five contributors with an "and X more" indicator', async () => {
    const campaign = makeCampaign({
      activeRun: makeRun({ contributorCount: 7 }),
    });
    const contributors = [
      { rank: 1, userId: 1, username: 'samwise', distance: 120 },
      { rank: 2, userId: 2, username: 'frodo', distance: 90 },
      { rank: 3, userId: 3, username: 'merry', distance: 60 },
      { rank: 4, userId: 4, username: 'pippin', distance: 40 },
      { rank: 5, userId: 5, username: 'gandalf', distance: 10 },
      { rank: 6, userId: 6, username: 'aragorn', distance: 5 },
    ];
    stubCampaignApi([campaign], (entry) => makeProgress(entry, { contributors }));

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelectorAll('.event-contributors__item')).toHaveLength(5);
    });

    const names = Array.from(container.querySelectorAll('.event-contributors__name')).map((node) => node.textContent);
    expect(names).toEqual([
      '#1 samwise',
      '#2 frodo',
      '#3 merry',
      '#4 pippin',
      '#5 gandalf',
    ]);
    expect(container.querySelector('.event-contributors__more')?.textContent).toBe('and 2 more');
  });

  it('renders the past-runs section with final progress and outcome', async () => {
    const campaign = makeCampaign({
      activeRun: null,
      pastRuns: [
        makeRun({
          id: 8,
          runNumber: 1,
          status: 'completed',
          totalDistance: 600,
          participantCount: 30,
          contributorCount: 21,
          fromSnapshot: true,
        }),
        makeRun({
          id: 9,
          runNumber: 2,
          status: 'expired',
          totalDistance: 300,
          startDate: '2026-09-01',
          endDate: '2026-09-14',
          fromSnapshot: true,
        }),
      ],
    });
    stubCampaignApi([campaign]);

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelectorAll('.event-past-card')).toHaveLength(2);
    });

    expect(container.textContent).toContain('Past Campaigns');
    expect(container.textContent).toContain('Final progress: 600 km of 581 km');
    expect(container.textContent).toContain('Completed');
    expect(container.textContent).toContain('Expired');
    expect(container.textContent).toContain('Run 1');
    expect(container.textContent).toContain('Run 2');
  });

  it('shows anonymous visitors campaign data and a sign-in link instead of a join button', async () => {
    stubCampaignApi([makeCampaign()]);

    const { getByText, queryByRole, container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-card')).toBeTruthy();
    });

    const signIn = getByText('Sign in to join') as HTMLAnchorElement;
    expect(signIn.getAttribute('href')).toBe('/login');
    expect(queryByRole('button', { name: 'Join campaign' })).toBeNull();
    expect(container.textContent).toContain('Your username and contribution distance will be publicly visible.');
  });

  it('shows a join button and public-visibility disclosure for an authenticated user on an unjoined run', async () => {
    sessionToken = 'test-token';
    stubCampaignApi([makeCampaign()]);

    const { getByRole, container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Join campaign' })).toBeTruthy();
    });

    expect(container.textContent).toContain('Your username and contribution distance will be publicly visible.');
    expect(container.querySelector('.event-join__signin')).toBeNull();
  });

  it('shows the "starts" state for a joined upcoming run instead of a join button or contribution', async () => {
    sessionToken = 'test-token';
    const campaign = makeCampaign({
      activeRun: makeRun({ status: 'upcoming', startDate: '2099-01-05', endDate: '2099-01-18' }),
      participation: {
        participantId: 4,
        status: 'active',
        joinedAt: '2026-11-05T09:00:00.000Z',
        contributionDistance: 0,
      },
    });
    stubCampaignApi([campaign]);

    const { container, queryByRole } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-join__joined')).toBeTruthy();
    });

    expect(container.textContent).toMatch(/You're in — starts/);
    expect(container.querySelector('.event-join__contribution')).toBeNull();
    expect(queryByRole('button', { name: 'Join campaign' })).toBeNull();
  });

  it("shows a joined user's contribution and rank for an active run", async () => {
    sessionToken = 'test-token';
    const campaign = makeCampaign({
      participation: {
        participantId: 4,
        status: 'active',
        joinedAt: '2026-11-02T09:00:00.000Z',
        contributionDistance: 42.5,
      },
    });
    stubCampaignApi([campaign], (entry) => makeProgress(entry, {
      you: { distance: 42.5, rank: 3 },
    }));

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-join__contribution')).toBeTruthy();
    });

    expect(container.textContent).toMatch(/your contribution:/);
    expect(container.textContent).toContain('42.5 km');
    expect(container.textContent).toContain('rank #3');
  });

  it('shows a removed state instead of a join affordance when participation was cancelled', async () => {
    sessionToken = 'test-token';
    const campaign = makeCampaign({
      participation: {
        participantId: 4,
        status: 'removed',
        joinedAt: '2026-11-02T09:00:00.000Z',
        contributionDistance: 12,
      },
    });
    stubCampaignApi([campaign]);

    const { container, queryByRole } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-join__removed')).toBeTruthy();
    });

    expect(container.textContent).toContain('Your participation in this run has been removed.');
    expect(container.querySelector('.event-join__contribution')).toBeNull();
    expect(queryByRole('button', { name: 'Join campaign' })).toBeNull();
  });

  it('posts to the join endpoint with auth headers and refreshes participation', async () => {
    sessionToken = 'test-token';
    const campaign = makeCampaign();
    let joined = false;

    mockFetch.mockImplementation((input: unknown, init?: FetchInit) => {
      const url = String(input);

      if (url === '/api/events') {
        const participation = joined
          ? {
            participantId: 9,
            status: 'active',
            joinedAt: '2026-11-05T10:00:00.000Z',
            contributionDistance: 42.5,
          }
          : null;
        return Promise.resolve(jsonResponse({ campaigns: [{ ...campaign, participation }] }));
      }

      if (url === '/api/events/1/join' && init?.method === 'POST') {
        joined = true;
        return Promise.resolve(jsonResponse({ joined: true, campaignId: 1 }, 201));
      }

      if (url === '/api/events/1/community-progress') {
        return Promise.resolve(jsonResponse(makeProgress(campaign, {
          you: joined ? { distance: 42.5, rank: 3 } : null,
        })));
      }

      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const { getByRole, container } = render(<EventsIsland />);

    const joinButton = await waitFor(() => getByRole('button', { name: 'Join campaign' }));
    fireEvent.click(joinButton);

    await waitFor(() => {
      expect(fetchCalls('/api/events/1/join')).toHaveLength(1);
    });

    const [, init] = fetchCalls('/api/events/1/join')[0];
    expect(init?.method).toBe('POST');
    expect(init?.headers?.Authorization).toBe('Bearer test-token');

    await waitFor(() => {
      expect(container.querySelector('.event-join__contribution')).toBeTruthy();
    });
    expect(container.textContent).toContain('42.5 km');
  });

  it('shows a join error without losing the campaign card', async () => {
    sessionToken = 'test-token';
    const campaign = makeCampaign();

    mockFetch.mockImplementation((input: unknown, init?: FetchInit) => {
      const url = String(input);
      if (url === '/api/events') return Promise.resolve(jsonResponse({ campaigns: [campaign] }));
      if (url === '/api/events/1/community-progress') return Promise.resolve(jsonResponse(makeProgress(campaign)));
      if (url === '/api/events/1/join' && init?.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: 'Campaign already ended' }, 400));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const { getByRole, container } = render(<EventsIsland />);

    fireEvent.click(await waitFor(() => getByRole('button', { name: 'Join campaign' })));

    await waitFor(() => {
      expect(container.querySelector('.event-join__error')?.textContent).toBe('Campaign already ended');
    });
    expect(container.querySelector('.event-card')).toBeTruthy();
  });

  it('shows an error state and retries the campaign fetch', async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

    const { container, getByText } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.events-error')).toBeTruthy();
    });
    expect(container.textContent).toContain('could not load');

    stubCampaignApi([makeCampaign()]);
    fireEvent.click(getByText('Retry'));

    await waitFor(() => {
      expect(container.querySelector('.event-card')).toBeTruthy();
    });
  });

  it('shows an empty state when no campaigns exist', async () => {
    stubCampaignApi([]);

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.events-empty')).toBeTruthy();
    });
    expect(container.textContent).toContain('No community campaigns are running right now');
  });

  it('still renders a campaign card when the community-progress request fails', async () => {
    mockFetch.mockImplementation((input: unknown) => {
      const url = String(input);
      if (url === '/api/events') return Promise.resolve(jsonResponse({ campaigns: [makeCampaign()] }));
      return Promise.resolve(jsonResponse({ error: 'unavailable' }, 500));
    });

    const { container } = render(<EventsIsland />);

    await waitFor(() => {
      expect(container.querySelector('.event-card')).toBeTruthy();
    });
    expect(container.textContent).toContain('Beacon Watch');
    expect(container.querySelector('.event-contributors')).toBeNull();
  });
});
