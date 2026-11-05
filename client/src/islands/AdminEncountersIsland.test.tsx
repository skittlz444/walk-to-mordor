import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, waitFor, within } from '@testing-library/preact';
import { AdminEncountersIsland } from './AdminEncountersIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

interface TestBadge {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  image_slug: string | null;
  badge_type: string;
  is_repeatable: boolean;
  metadata: string | null;
}

interface TestEncounter {
  id: number;
  slug: string;
  name: string;
  description: string;
  image_slug: string | null;
  badge_slug: string | null;
  duration_days: number;
  target_stretch_multiplier: number;
  target_min_distance: number;
  target_max_distance: number;
  is_repeatable: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
  badge: TestBadge | null;
  badge_name: string | null;
}

function makeEncounter(overrides: Partial<TestEncounter> = {}): TestEncounter {
  return {
    id: 1,
    slug: 'nazgul-pursuit',
    name: 'Nazgul Pursuit',
    description: 'The Nazgul are hunting you.',
    image_slug: 'nazgul',
    badge_slug: 'nazgul-pursuit-badge',
    duration_days: 3,
    target_stretch_multiplier: 1.5,
    target_min_distance: 5,
    target_max_distance: 15,
    is_repeatable: true,
    enabled: true,
    created_at: '2026-06-01 00:00:00',
    updated_at: '2026-06-01 00:00:00',
    badge: {
      id: 11,
      slug: 'nazgul-pursuit-badge',
      name: 'Nazgul Pursuit Badge',
      description: 'Escaped the Nazgul.',
      image_slug: 'nazgul-badge',
      badge_type: 'challenge',
      is_repeatable: true,
      metadata: null,
    },
    badge_name: null,
    ...overrides,
  };
}

const nazgul = makeEncounter();
const moria = makeEncounter({
  id: 2,
  slug: 'moria-chase',
  name: 'Moria Chase',
  description: 'Something stirs in the dark.',
  image_slug: 'moria',
  badge_slug: 'moria-chase-badge',
  duration_days: 2,
  enabled: false,
  badge: null,
  badge_name: 'Moria Chase Badge',
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

function listAnd(
  handler: (url: string, init?: RequestInit) => Promise<unknown> | undefined,
  encounters: TestEncounter[] = [nazgul, moria],
) {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (url === '/api/admin/encounters' && method === 'GET') {
      return jsonResponse({ encounters });
    }
    const handled = handler(url, init);
    return handled ?? jsonResponse({ error: 'Not found' }, 404);
  };
}

function openCreateForm(getAllByRole: (role: 'button', options: { name: RegExp }) => HTMLElement[]) {
  fireEvent.click(getAllByRole('button', { name: /New Encounter/ })[0]);
}

function mockDisableConfirmation() {
  mockFetch.mockImplementation(listAnd((url, init) => {
    if (url === '/api/admin/encounters/1/disable' && init?.method === 'PUT' && !init.body) {
      return jsonResponse({ activeOccurrences: 3, requiresConfirmation: true }, 400);
    }
    return undefined;
  }));
}

async function openDisableDialog(container: HTMLElement): Promise<{ dialog: HTMLElement; trigger: HTMLElement }> {
  const row = await waitFor(() => {
    const element = container.querySelector<HTMLElement>('.admin-encounters-row');
    expect(element).toBeTruthy();
    return element as HTMLElement;
  });
  const trigger = within(row).getByRole('button', { name: 'Disable' });
  trigger.focus();
  fireEvent.click(trigger);

  const dialog = await waitFor(() => {
    const element = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(element).toBeTruthy();
    return element as HTMLElement;
  });

  return { dialog, trigger };
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
  mockFetch.mockImplementation(listAnd(() => undefined));
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

describe('AdminEncountersIsland', () => {
  it('renders definition rows with duration, badge name, status, and actions', async () => {
    const { container, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });

    expect(getByText('nazgul-pursuit')).toBeTruthy();
    expect(getByText('3 days')).toBeTruthy();
    expect(getByText('Nazgul Pursuit Badge')).toBeTruthy();
    expect(getByText('Moria Chase Badge')).toBeTruthy();
    expect(getByText('Enabled')).toBeTruthy();
    expect(getByText('Disabled')).toBeTruthy();

    const rows = container.querySelectorAll<HTMLElement>('.admin-encounters-row');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(rows[0]).getByRole('button', { name: 'Disable' })).toBeTruthy();
    expect(within(rows[1]).getByRole('button', { name: 'Edit' })).toBeTruthy();
    expect(within(rows[1]).getByRole('button', { name: 'Enable' })).toBeTruthy();
  });

  it('renders a loading state while the list request is pending', () => {
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const { getByText } = render(<AdminEncountersIsland />);

    expect(getByText(/Loading encounters/)).toBeTruthy();
  });

  it('renders an empty state with a New Encounter action', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ encounters: [] }));

    const { getAllByRole, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('No personal encounters yet.')).toBeTruthy();
    });

    expect(getAllByRole('button', { name: /New Encounter/ }).length).toBeGreaterThan(0);
  });

  it('shows a load error and retries', async () => {
    let calls = 0;
    mockFetch.mockImplementation(() => {
      calls += 1;
      return calls === 1
        ? jsonResponse({ error: 'boom' }, 500)
        : jsonResponse({ encounters: [nazgul] });
    });

    const { getByRole, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Failed to load encounters')).toBeTruthy();
    });

    fireEvent.click(getByRole('button', { name: /Retry/ }));

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });
  });

  it('redirects to login and shows the unauthorized state on 401', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ error: 'unauthorized' }, 401));

    const { getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
    expect(getByText(/session has expired/i)).toBeTruthy();
  });

  it('redirects to journey and shows the forbidden state on 403', async () => {
    mockFetch.mockImplementation(() => jsonResponse({ error: 'forbidden' }, 403));

    const { getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/journey');
    });
    expect(getByText(/Admin access is required/i)).toBeTruthy();
  });

  it('opens the create form with encounter and inline badge fields', async () => {
    const { getAllByRole, getByLabelText, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });

    openCreateForm(getAllByRole);

    for (const label of [
      'Slug',
      'Name',
      'Description',
      'Image slug',
      'Duration (days)',
      'Target stretch multiplier',
      'Target minimum distance (km)',
      'Target maximum distance (km)',
      'Badge slug',
      'Badge name',
      'Badge description',
      'Badge image slug',
    ]) {
      expect(getByLabelText(label)).toBeTruthy();
    }
  });

  it('submits valid create data and refreshes the list', async () => {
    const encounters = [nazgul, moria];
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters' && init?.method === 'POST') {
        const created = makeEncounter({
          id: 3,
          slug: 'minas-tirith-defence',
          name: 'Minas Tirith Defence',
          image_slug: 'minas-tirith',
          badge_slug: 'minas-tirith-defence-badge',
          duration_days: 4,
          target_stretch_multiplier: 2,
          target_min_distance: 20,
          target_max_distance: 40,
          enabled: false,
          badge: null,
          badge_name: 'Minas Tirith Badge',
        });
        encounters.push(created);
        return jsonResponse({ encounter: created }, 201);
      }
      return undefined;
    }, encounters));

    const { container, getAllByRole, getByLabelText, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });

    openCreateForm(getAllByRole);
    fireEvent.input(getByLabelText('Slug'), { target: { value: 'minas-tirith-defence' } });
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Minas Tirith Defence' } });
    fireEvent.input(getByLabelText('Description'), { target: { value: 'Defend the white city.' } });
    fireEvent.input(getByLabelText('Image slug'), { target: { value: 'minas-tirith' } });
    fireEvent.input(getByLabelText('Duration (days)'), { target: { value: '4' } });
    fireEvent.input(getByLabelText('Target stretch multiplier'), { target: { value: '2' } });
    fireEvent.input(getByLabelText('Target minimum distance (km)'), { target: { value: '20' } });
    fireEvent.input(getByLabelText('Target maximum distance (km)'), { target: { value: '40' } });
    fireEvent.input(getByLabelText('Badge slug'), { target: { value: 'minas-tirith-defence-badge' } });
    fireEvent.input(getByLabelText('Badge name'), { target: { value: 'Minas Tirith Badge' } });
    fireEvent.input(getByLabelText('Badge description'), { target: { value: 'Held the gate.' } });
    fireEvent.input(getByLabelText('Badge image slug'), { target: { value: 'minas-tirith-badge' } });

    fireEvent.submit(container.querySelector('form.admin-encounter-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Encounter created')).toBeTruthy();
    });
    await waitFor(() => {
      expect(getByText('Minas Tirith Defence')).toBeTruthy();
    });

    const postCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/encounters' && (init as RequestInit | undefined)?.method === 'POST',
    );
    expect(postCall).toBeTruthy();
    const body = JSON.parse(((postCall?.[1] as RequestInit).body) as string);
    expect(body).toMatchObject({
      slug: 'minas-tirith-defence',
      name: 'Minas Tirith Defence',
      description: 'Defend the white city.',
      image_slug: 'minas-tirith',
      badge_slug: 'minas-tirith-defence-badge',
      badge_name: 'Minas Tirith Badge',
      badge_description: 'Held the gate.',
      badge_image_slug: 'minas-tirith-badge',
      duration_days: 4,
      target_stretch_multiplier: 2,
      target_min_distance: 20,
      target_max_distance: 40,
      is_repeatable: true,
    });
  });

  it('edits an existing definition and refreshes the list', async () => {
    const encounters = [nazgul, moria];
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters/1' && init?.method === 'PUT') {
        const updated = { ...nazgul, name: 'Nazgul Pursuit Revised' };
        encounters[0] = updated;
        return jsonResponse({ encounter: updated });
      }
      return undefined;
    }, encounters));

    const { container, getByLabelText, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });

    const firstRow = container.querySelector<HTMLElement>('.admin-encounters-row');
    expect(firstRow).toBeTruthy();
    fireEvent.click(within(firstRow as HTMLElement).getByRole('button', { name: 'Edit' }));

    expect((getByLabelText('Name') as HTMLInputElement).value).toBe('Nazgul Pursuit');
    fireEvent.input(getByLabelText('Name'), { target: { value: 'Nazgul Pursuit Revised' } });
    fireEvent.submit(container.querySelector('form.admin-encounter-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Encounter updated')).toBeTruthy();
    });
    await waitFor(() => {
      expect(getByText('Nazgul Pursuit Revised')).toBeTruthy();
    });

    const putCall = mockFetch.mock.calls.find(
      ([url, init]) => String(url) === '/api/admin/encounters/1' && (init as RequestInit | undefined)?.method === 'PUT',
    );
    expect(putCall).toBeTruthy();
    expect(JSON.parse(((putCall?.[1] as RequestInit).body) as string)).toMatchObject({
      name: 'Nazgul Pursuit Revised',
      duration_days: 3,
      target_min_distance: 5,
      target_max_distance: 15,
    });
  });

  it('shows field-level validation errors from the API without clearing input', async () => {
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters' && init?.method === 'POST') {
        return jsonResponse({
          error: 'validation',
          fields: {
            slug: 'Slug is already in use',
            badge_name: 'Badge name is required for a new badge',
          },
        }, 400);
      }
      return undefined;
    }));

    const { container, getAllByRole, getByLabelText, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });

    openCreateForm(getAllByRole);
    fireEvent.input(getByLabelText('Slug'), { target: { value: 'nazgul-pursuit' } });
    fireEvent.submit(container.querySelector('form.admin-encounter-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Slug is already in use')).toBeTruthy();
    });
    expect(getByText('Badge name is required for a new badge')).toBeTruthy();
    expect((getByLabelText('Slug') as HTMLInputElement).value).toBe('nazgul-pursuit');
  });

  it('enables and disables a definition without a confirmation when there are no active challenges', async () => {
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters/2/enable' && init?.method === 'PUT') {
        return jsonResponse({ encounter: { ...moria, enabled: true } });
      }
      if (url === '/api/admin/encounters/2/disable' && init?.method === 'PUT') {
        return jsonResponse({ encounter: { ...moria, enabled: false } });
      }
      return undefined;
    }));

    const { container, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Moria Chase')).toBeTruthy();
    });
    const row = container.querySelectorAll<HTMLElement>('.admin-encounters-row')[1];
    expect(within(row).getByText('Disabled')).toBeTruthy();

    fireEvent.click(within(row).getByRole('button', { name: 'Enable' }));

    await waitFor(() => {
      expect(within(row).getByText('Enabled')).toBeTruthy();
    });
    expect(mockFetch).toHaveBeenCalledWith('/api/admin/encounters/2/enable', expect.objectContaining({ method: 'PUT' }));

    fireEvent.click(within(row).getByRole('button', { name: 'Disable' }));

    await waitFor(() => {
      expect(within(row).getByText('Disabled')).toBeTruthy();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/encounters/2/disable',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('shows a disable confirmation modal with the active challenge count and keeps them active', async () => {
    const encounters = [nazgul, moria];
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters/1/disable' && init?.method === 'PUT') {
        if (!init.body) {
          return jsonResponse({ activeOccurrences: 3, requiresConfirmation: true }, 400);
        }
        const disabled = { ...nazgul, enabled: false };
        encounters[0] = disabled;
        return jsonResponse({ encounter: disabled });
      }
      return undefined;
    }, encounters));

    const { container, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });
    const row = container.querySelector<HTMLElement>('.admin-encounters-row');
    expect(row).toBeTruthy();
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Disable' }));

    const dialog = await waitFor(() => {
      const element = document.querySelector('[role="dialog"]');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    expect(within(dialog).getByText(/3 users have active challenges/)).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Keep active challenges' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Cancel all active challenges' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep active challenges' }));

    await waitFor(() => {
      expect(document.querySelector('[role="dialog"]')).toBeNull();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/encounters/1/disable',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ cancelActive: false }) }),
    );
  });

  it('cancels active challenges from the disable confirmation modal', async () => {
    const encounters = [nazgul, moria];
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters/1/disable' && init?.method === 'PUT') {
        if (!init.body) {
          return jsonResponse({ activeOccurrences: 3, requiresConfirmation: true }, 400);
        }
        const disabled = { ...nazgul, enabled: false };
        encounters[0] = disabled;
        return jsonResponse({ encounter: disabled });
      }
      return undefined;
    }, encounters));

    const { container, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });
    const row = container.querySelector<HTMLElement>('.admin-encounters-row');
    expect(row).toBeTruthy();
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: 'Disable' }));

    const dialog = await waitFor(() => {
      const element = document.querySelector('[role="dialog"]');
      expect(element).toBeTruthy();
      return element as HTMLElement;
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel all active challenges' }));

    await waitFor(() => {
      expect(getByText(/3 active challenges cancelled/)).toBeTruthy();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/encounters/1/disable',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ cancelActive: true }) }),
    );
    await waitFor(() => {
      expect(within(row as HTMLElement).getByText('Disabled')).toBeTruthy();
    });
  });

  it('focuses the safe action and makes the page behind the disable confirmation inert', async () => {
    mockDisableConfirmation();
    const { container } = render(<AdminEncountersIsland />);

    const { dialog } = await openDisableDialog(container);

    await waitFor(() => {
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Keep active challenges' }));
    });
    expect((container.querySelector('section.admin-encounters') as HTMLElement).hasAttribute('inert')).toBe(true);
  });

  it('keeps Tab focus inside the disable confirmation', async () => {
    mockDisableConfirmation();
    const { container } = render(<AdminEncountersIsland />);

    const { dialog } = await openDisableDialog(container);
    const keep = within(dialog).getByRole('button', { name: 'Keep active challenges' });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    await waitFor(() => expect(document.activeElement).toBe(keep));

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(keep);
  });

  it('closes on Escape, restores focus to the Disable control, and clears inert', async () => {
    mockDisableConfirmation();
    const { container } = render(<AdminEncountersIsland />);

    const { trigger } = await openDisableDialog(container);
    const section = container.querySelector<HTMLElement>('section.admin-encounters');
    await waitFor(() => expect(section?.hasAttribute('inert')).toBe(true));

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    await waitFor(() => expect(section?.hasAttribute('inert')).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('closes on backdrop activation but stays open when the dialog content is clicked', async () => {
    mockDisableConfirmation();
    const { container } = render(<AdminEncountersIsland />);

    const { dialog } = await openDisableDialog(container);

    fireEvent.click(dialog.querySelector('.admin-encounters-modal__content') as HTMLElement);
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();

    fireEvent.click(dialog);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
  });

  it('associates validation errors with their inputs through aria-describedby', async () => {
    mockFetch.mockImplementation(listAnd((url, init) => {
      if (url === '/api/admin/encounters' && init?.method === 'POST') {
        return jsonResponse({
          error: 'validation',
          fields: {
            slug: 'Slug is already in use',
            badge_name: 'Badge name is required for a new badge',
          },
        }, 400);
      }
      return undefined;
    }));

    const { container, getAllByRole, getByLabelText, getByText } = render(<AdminEncountersIsland />);

    await waitFor(() => {
      expect(getByText('Nazgul Pursuit')).toBeTruthy();
    });

    openCreateForm(getAllByRole);
    fireEvent.input(getByLabelText('Slug'), { target: { value: 'nazgul-pursuit' } });
    fireEvent.submit(container.querySelector('form.admin-encounter-form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Slug is already in use')).toBeTruthy();
    });

    const slugInput = getByLabelText('Slug');
    const slugErrorId = slugInput.getAttribute('aria-describedby');
    expect(slugInput.getAttribute('aria-invalid')).toBe('true');
    expect(slugErrorId).toBe('create-encounter-slug-error');
    const slugError = document.getElementById(slugErrorId as string);
    expect(slugError?.textContent).toBe('Slug is already in use');
    expect(slugError?.getAttribute('role')).toBe('alert');

    const badgeNameInput = getByLabelText('Badge name');
    expect(badgeNameInput.getAttribute('aria-describedby')).toBe('create-encounter-badge-name-error');
    expect(document.getElementById('create-encounter-badge-name-error')?.textContent)
      .toBe('Badge name is required for a new badge');
    expect(getByLabelText('Name').getAttribute('aria-describedby')).toBeNull();

    fireEvent.input(slugInput, { target: { value: 'nazgul-pursuit-2' } });
    await waitFor(() => {
      expect(slugInput.getAttribute('aria-describedby')).toBeNull();
    });
  });
});
