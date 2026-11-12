import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/preact';
import { AdminCommunityCampaignsIsland } from './AdminCommunityCampaignsIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

function utcDateOffset(days: number): string {
  return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

function addUtcDays(date: string, days: number): string {
  const base = new Date(`${date}T00:00:00.000Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

interface TestRun {
  id: number;
  campaign_id: number;
  run_number: number;
  target_distance: number;
  start_date: string;
  end_date: string;
  status: 'upcoming' | 'active' | 'completed' | 'expired';
  completed_at: string | null;
  announced_at: string | null;
  participant_count: number | null;
  contributor_count: number | null;
  total_distance: number | null;
  created_at: string;
  updated_at: string;
}

interface TestCampaign {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  badge: {
    id: number;
    slug: string;
    name: string;
    description: string | null;
    image_slug: string | null;
    badge_type: string;
    is_repeatable: boolean;
    metadata: string | null;
  } | null;
  badge_name: string | null;
  activeRun: TestRun | null;
  latestRun: TestRun | null;
  activeParticipantCount: number;
}

function makeRun(overrides: Partial<TestRun> = {}): TestRun {
  return {
    id: 1,
    campaign_id: 1,
    run_number: 1,
    target_distance: 581,
    start_date: '2026-06-01',
    end_date: '2026-06-14',
    status: 'upcoming',
    completed_at: null,
    announced_at: null,
    participant_count: null,
    contributor_count: null,
    total_distance: null,
    created_at: '2026-06-01 00:00:00',
    updated_at: '2026-06-01 00:00:00',
    ...overrides,
  };
}

function makeCampaign(overrides: Partial<TestCampaign> = {}): TestCampaign {
  return {
    id: 1,
    slug: 'beacon-watch',
    name: 'Beacon Watch',
    description: 'Light the beacons of Gondor together.',
    image_slug: 'beacon-watch',
    badge_slug: 'community-beacon-watch',
    enabled: true,
    created_at: '2026-06-01 00:00:00',
    updated_at: '2026-06-01 00:00:00',
    badge: {
      id: 11,
      slug: 'community-beacon-watch',
      name: 'Beacon Warden',
      description: 'Complete a Beacon Watch community campaign.',
      image_slug: 'community-beacon-watch',
      badge_type: 'community',
      is_repeatable: true,
      metadata: '{"rank_thresholds":[1,3,7,15],"unit":"campaigns"}',
    },
    badge_name: 'Beacon Warden',
    activeRun: makeRun(),
    latestRun: makeRun(),
    activeParticipantCount: 3,
    ...overrides,
  };
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function withList(
  handler: (url: string, init?: RequestInit) => Promise<unknown> | undefined,
  campaigns: TestCampaign[],
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/admin/campaigns' && method === 'GET') {
      return jsonResponse({ campaigns });
    }
    const handled = handler(url, init);
    return handled ?? jsonResponse({ error: 'Not found' }, 404);
  };
}

function rowFor(container: HTMLElement, index: number): HTMLElement {
  const rows = container.querySelectorAll<HTMLElement>('.admin-campaigns-row');
  expect(rows[index]).toBeTruthy();
  return rows[index];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  savedLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { href: '' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: savedLocation,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AdminCommunityCampaignsIsland', () => {
  it('renders campaign rows with run state, badge, participants, and status', async () => {
    const completed = makeCampaign({
      id: 2,
      slug: 'old-campaign',
      name: 'Old Campaign',
      enabled: false,
      activeRun: null,
      latestRun: makeRun({ id: 2, campaign_id: 2, status: 'completed', target_distance: 120 }),
      activeParticipantCount: 0,
      badge: null,
      badge_name: null,
      badge_slug: null,
    });
    mockFetch.mockImplementation(withList(() => undefined, [makeCampaign(), completed]));

    const { container, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    expect(getByText('beacon-watch')).toBeTruthy();
    expect(getByText('581 km')).toBeTruthy();
    expect(getByText('upcoming')).toBeTruthy();
    expect(getByText('Beacon Warden')).toBeTruthy();
    expect(getByText('Enabled')).toBeTruthy();
    expect(getByText('Disabled')).toBeTruthy();
    expect(getByText('completed')).toBeTruthy();

    const firstRow = rowFor(container, 0);
    expect(within(firstRow).getByText('2026-06-01 – 2026-06-14')).toBeTruthy();
    expect(within(firstRow).getByText('3')).toBeTruthy();
    expect(within(firstRow).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(firstRow).getByRole('button', { name: 'Disable' })).toBeTruthy();
    expect(within(firstRow).queryByRole('button', { name: 'Start next run' })).toBeNull();

    const secondRow = rowFor(container, 1);
    expect(within(secondRow).getByRole('button', { name: 'Enable' })).toBeTruthy();
    expect(within(secondRow).queryByRole('button', { name: 'Start next run' })).toBeNull();
  });

  it('renders a loading state while the list request is pending', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { getByText } = render(<AdminCommunityCampaignsIsland />);

    expect(getByText(/Loading campaigns/)).toBeTruthy();
  });

  it('opens the create form with badge fields, repeatability, thresholds, and suggestions', async () => {
    mockFetch.mockImplementation(withList(() => undefined, [makeCampaign()]));

    const { getAllByRole, getByLabelText, getByRole, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(getAllByRole('button', { name: /New Campaign/ })[0]);

    for (const label of [
      'Slug',
      'Name',
      'Description',
      'Image slug',
      'Target distance (km)',
      'Start date',
      'End date',
      'Badge slug',
      'Badge name',
      'Badge description',
      'Badge image slug',
      'Rank thresholds',
    ]) {
      expect(getByLabelText(label)).toBeTruthy();
    }

    expect(getByLabelText('Repeatable badge')).toBeTruthy();
    expect(getByRole('button', { name: /Get Suggestions/ })).toBeTruthy();
  });

  it('pre-fills create fields from suggestions and submits them', async () => {
    const campaigns = [makeCampaign()];
    const created = makeCampaign({
      id: 3,
      slug: 'minas-tirith',
      name: 'Minas Tirith',
      activeRun: makeRun({ id: 3, campaign_id: 3, target_distance: 123 }),
      latestRun: makeRun({ id: 3, campaign_id: 3, target_distance: 123 }),
    });
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/suggestions') {
        return jsonResponse({
          suggestedTargetDistance: 123,
          suggestedDurationDays: 10,
          suggestedParticipantCount: 12,
          thirtyDayTotalDistance: 400,
          thirtyDayActiveUsers: 12,
        });
      }
      if (url === '/api/admin/campaigns' && init?.method === 'POST') {
        campaigns.push(created);
        return jsonResponse({ campaign: created }, 201);
      }
      return undefined;
    }, campaigns));

    const { container, getAllByRole, getByLabelText, getByRole, getByText } = render(
      <AdminCommunityCampaignsIsland />,
    );

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(getAllByRole('button', { name: /New Campaign/ })[0]);
    fireEvent.click(getByRole('button', { name: /Get Suggestions/ }));

    await waitFor(() => {
      expect((getByLabelText('Target distance (km)') as HTMLInputElement).value).toBe('123');
    });

    const startDate = (getByLabelText('Start date') as HTMLInputElement).value;
    const endDate = (getByLabelText('End date') as HTMLInputElement).value;
    expect(startDate).toBe(utcDateOffset(1));
    expect(endDate).toBe(addUtcDays(startDate, 9));

    fireEvent.input(getByLabelText('Slug'), { target: { value: 'minas-tirith' } });
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Minas Tirith' } });
    fireEvent.input(getByLabelText('Description'), { target: { value: 'Defend the white city.' } });
    fireEvent.input(getByLabelText('Image slug'), { target: { value: 'minas-tirith' } });
    fireEvent.input(getByLabelText('Badge slug'), { target: { value: 'community-minas-tirith' } });
    fireEvent.input(getByLabelText('Badge name'), { target: { value: 'White City Badge' } });
    fireEvent.input(getByLabelText('Badge description'), { target: { value: 'Held the gate.' } });
    fireEvent.input(getByLabelText('Badge image slug'), { target: { value: 'community-minas-tirith' } });

    fireEvent.submit(container.querySelector('form.admin-campaign-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Campaign created')).toBeTruthy();
    });

    const postCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/campaigns'
        && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    expect(JSON.parse(((postCall?.[1] as RequestInit).body) as string)).toMatchObject({
      slug: 'minas-tirith',
      name: 'Minas Tirith',
      target_distance: 123,
      start_date: startDate,
      end_date: endDate,
      badge_slug: 'community-minas-tirith',
      badge_name: 'White City Badge',
      repeatable: true,
      rank_thresholds: [1, 3, 7, 15],
    });
  });

  it('shows field-level validation errors without clearing input', async () => {
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns' && init?.method === 'POST') {
        return jsonResponse({
          error: 'validation',
          fields: {
            slug: 'Slug is already in use',
            badge_name: 'Badge name is required for a new badge',
          },
        }, 400);
      }
      return undefined;
    }, [makeCampaign()]));

    const { container, getAllByRole, getByLabelText, getByText } = render(
      <AdminCommunityCampaignsIsland />,
    );

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(getAllByRole('button', { name: /New Campaign/ })[0]);
    fireEvent.input(getByLabelText('Slug'), { target: { value: 'beacon-watch' } });
    fireEvent.submit(container.querySelector('form.admin-campaign-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Slug is already in use')).toBeTruthy();
    });
    expect(getByText('Badge name is required for a new badge')).toBeTruthy();
    expect((getByLabelText('Slug') as HTMLInputElement).value).toBe('beacon-watch');
  });

  it('edits an existing campaign and refreshes the list', async () => {
    const campaigns = [makeCampaign()];
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/1' && init?.method === 'PUT') {
        const updated = { ...campaigns[0], name: 'Beacon Watch Revised' };
        campaigns[0] = updated;
        return jsonResponse({ campaign: updated });
      }
      return undefined;
    }, campaigns));

    const { container, getByLabelText, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Edit' }));
    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Beacon Watch');
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Beacon Watch Revised' } });
    fireEvent.submit(container.querySelector('form.admin-campaign-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Campaign updated')).toBeTruthy();
    });
    await waitFor(() => {
      expect(getByText('Beacon Watch Revised')).toBeTruthy();
    });

    const putCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/campaigns/1'
        && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse(((putCall?.[1] as RequestInit).body) as string)).toMatchObject({
      name: 'Beacon Watch Revised',
      target_distance: 581,
      start_date: '2026-06-01',
      end_date: '2026-06-14',
    });
  });

  it('disables frozen run fields once the current run leaves upcoming', async () => {
    const active = makeCampaign({
      activeRun: makeRun({ status: 'active' }),
      latestRun: makeRun({ status: 'active' }),
    });
    mockFetch.mockImplementation(withList(() => undefined, [active]));

    const { container, getByLabelText, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Edit' }));

    expect((getByLabelText('Target distance (km)') as HTMLInputElement).disabled).toBe(true);
    expect((getByLabelText('Start date') as HTMLInputElement).disabled).toBe(true);
    expect((getByLabelText('Badge slug') as HTMLInputElement).disabled).toBe(true);
    expect((getByLabelText('End date') as HTMLInputElement).disabled).toBe(false);
  });

  it('enables and disables a campaign without participants', async () => {
    let campaign = makeCampaign({ enabled: false, activeRun: makeRun(), latestRun: makeRun() });
    const campaigns = [campaign];
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/1/enable' && init?.method === 'PUT') {
        campaign = { ...campaign, enabled: true };
        campaigns[0] = campaign;
        return jsonResponse({ campaign });
      }
      if (url === '/api/admin/campaigns/1/disable' && init?.method === 'PUT') {
        campaign = { ...campaign, enabled: false };
        campaigns[0] = campaign;
        return jsonResponse({ campaign });
      }
      return undefined;
    }, campaigns));

    const { container, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Disabled')).toBeTruthy();
    });

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Enable' }));
    await waitFor(() => {
      expect(getByText('Enabled')).toBeTruthy();
    });
    expect(getByText('Enabled Beacon Watch')).toBeTruthy();

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Disable' }));
    await waitFor(() => {
      expect(getByText('Disabled')).toBeTruthy();
    });
    expect(getByText('Disabled Beacon Watch')).toBeTruthy();
  });

  it('shows the disable confirmation modal and cancels active participants on request', async () => {
    let campaign = makeCampaign({ enabled: true, activeParticipantCount: 2 });
    const campaigns = [campaign];
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/1/disable' && init?.method === 'PUT') {
        const body = init.body ? JSON.parse(init.body as string) as { cancelActive?: boolean } : null;
        if (!body) {
          return jsonResponse({ activeParticipants: 2, requiresConfirmation: true }, 400);
        }
        campaign = { ...campaign, enabled: false, activeParticipantCount: 0 };
        campaigns[0] = campaign;
        return jsonResponse({ campaign });
      }
      return undefined;
    }, campaigns));

    const { container, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Disable' }));

    const dialog = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    expect(within(dialog).getByText(/2 participants are active/)).toBeTruthy();
    expect(within(dialog).getByText(/earned badges are always kept/)).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel all' }));

    await waitFor(() => {
      expect(getByText('Campaign disabled. 2 active participants cancelled.')).toBeTruthy();
    });
    expect(getByText('Disabled')).toBeTruthy();

    const disableCalls = mockFetch.mock.calls.filter(
      ([url, init]) => String(url) === '/api/admin/campaigns/1/disable'
        && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(disableCalls).toHaveLength(2);
    expect((disableCalls[0][1] as RequestInit).body).toBeUndefined();
    expect(JSON.parse(((disableCalls[1][1] as RequestInit).body) as string)).toEqual({ cancelActive: true });
  });

  it('leaves active participants untouched when the admin declines cancellation', async () => {
    const campaign = makeCampaign({ enabled: true, activeParticipantCount: 1 });
    const campaigns = [campaign];
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/1/disable' && init?.method === 'PUT') {
        const body = init.body ? JSON.parse(init.body as string) as { cancelActive?: boolean } : null;
        if (!body) {
          return jsonResponse({ activeParticipants: 1, requiresConfirmation: true }, 400);
        }
        campaigns[0] = { ...campaign, enabled: false };
        return jsonResponse({ campaign: campaigns[0] });
      }
      return undefined;
    }, campaigns));

    const { container, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Beacon Watch')).toBeTruthy();
    });

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Disable' }));

    const dialog = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[role="dialog"]');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave active' }));

    await waitFor(() => {
      expect(getByText('Disabled Beacon Watch')).toBeTruthy();
    });

    const disableCalls = mockFetch.mock.calls.filter(
      ([url, init]) => String(url) === '/api/admin/campaigns/1/disable'
        && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(JSON.parse(((disableCalls[1][1] as RequestInit).body) as string)).toEqual({ cancelActive: false });
  });

  it('shows the retrigger action only for a terminal run on an enabled campaign', async () => {
    const upcoming = makeCampaign({ id: 1, name: 'Upcoming Campaign' });
    const active = makeCampaign({
      id: 2,
      slug: 'active-campaign',
      name: 'Active Campaign',
      activeRun: makeRun({ id: 2, campaign_id: 2, status: 'active' }),
      latestRun: makeRun({ id: 2, campaign_id: 2, status: 'active' }),
    });
    const disabled = makeCampaign({
      id: 3,
      slug: 'disabled-campaign',
      name: 'Disabled Campaign',
      enabled: false,
      activeRun: null,
      latestRun: makeRun({ id: 3, campaign_id: 3, status: 'completed' }),
    });
    mockFetch.mockImplementation(withList(() => undefined, [upcoming, active, disabled]));

    const { container, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Upcoming Campaign')).toBeTruthy();
    });

    expect(within(rowFor(container, 0)).queryByRole('button', { name: 'Start next run' })).toBeNull();
    expect(within(rowFor(container, 1)).queryByRole('button', { name: 'Start next run' })).toBeNull();
    expect(within(rowFor(container, 2)).queryByRole('button', { name: 'Start next run' })).toBeNull();
  });

  it('opens the retrigger form pre-filled from suggestions and submits overrides', async () => {
    const terminal = makeCampaign({
      id: 7,
      slug: 'done-campaign',
      name: 'Done Campaign',
      enabled: true,
      activeRun: null,
      latestRun: makeRun({ id: 7, campaign_id: 7, status: 'completed' }),
    });
    const campaigns = [terminal];
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/suggestions') {
        return jsonResponse({
          suggestedTargetDistance: 0,
          suggestedDurationDays: 14,
          suggestedParticipantCount: 0,
          thirtyDayTotalDistance: 0,
          thirtyDayActiveUsers: 0,
        });
      }
      if (url === '/api/admin/campaigns/7/retrigger' && init?.method === 'POST') {
        return jsonResponse({
          campaign: { ...terminal, activeRun: makeRun({ id: 8, run_number: 2 }), latestRun: makeRun({ id: 8, run_number: 2 }) },
          run: makeRun({ id: 8, run_number: 2 }),
        }, 201);
      }
      return undefined;
    }, campaigns));

    const { container, getByText, getByLabelText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Done Campaign')).toBeTruthy();
    });

    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Start next run' }));

    const dialog = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Start next run"]');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    expect(within(dialog).getByText(/zero participants and zero progress/)).toBeTruthy();
    expect(within(dialog).getByText(/earned badge is kept unchanged/)).toBeTruthy();

    await waitFor(() => {
      expect((getByLabelText('Target distance (km)') as HTMLInputElement).value).toBe('1');
    });
    const startDate = (getByLabelText('Start date') as HTMLInputElement).value;
    const endDate = (getByLabelText('End date') as HTMLInputElement).value;
    expect(startDate).toBe(utcDateOffset(1));
    expect(endDate).toBe(addUtcDays(startDate, 13));

    fireEvent.input(getByLabelText('Target distance (km)'), { target: { value: '250' } });
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Started run 2')).toBeTruthy();
    });

    const postCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/campaigns/7/retrigger'
        && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    expect(JSON.parse(((postCall?.[1] as RequestInit).body) as string)).toMatchObject({
      target_distance: 250,
      start_date: startDate,
      end_date: endDate,
    });
  });

  it('shows retrigger 400 errors inline and keeps the form open', async () => {
    const terminal = makeCampaign({
      id: 7,
      name: 'Done Campaign',
      activeRun: null,
      latestRun: makeRun({ id: 7, campaign_id: 7, status: 'expired' }),
    });
    mockFetch.mockImplementation(withList((url, init) => {
      if (url === '/api/admin/campaigns/suggestions') {
        return jsonResponse({ suggestedTargetDistance: 10, suggestedDurationDays: 14 });
      }
      if (url === '/api/admin/campaigns/7/retrigger' && init?.method === 'POST') {
        return jsonResponse({ error: 'A current run already exists for this campaign' }, 400);
      }
      return undefined;
    }, [terminal]));

    const { container, getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(getByText('Done Campaign')).toBeTruthy();
    });
    fireEvent.click(within(rowFor(container, 0)).getByRole('button', { name: 'Start next run' }));

    const dialog = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('[role="dialog"][aria-label="Start next run"]');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    fireEvent.submit(dialog.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(within(dialog).getByText('A current run already exists for this campaign')).toBeTruthy();
    });
    expect(document.querySelector('[role="dialog"][aria-label="Start next run"]')).toBeTruthy();
  });

  it('redirects to login on 401 and shows the unauthorized state', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ error: 'unauthorized' }, 401));

    const { getByText } = render(<AdminCommunityCampaignsIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
    expect(getByText(/session has expired/i)).toBeTruthy();
  });
});
