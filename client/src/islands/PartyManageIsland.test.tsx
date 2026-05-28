import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { PartyManageIsland } from './PartyManageIsland';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);

  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
  });

  Object.defineProperty(window, 'location', {
    value: {
      href: '/party/1/manage',
      pathname: '/party/1/manage',
      origin: 'http://localhost',
    },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
});

function mockManageResponses(avatarsPayload: unknown) {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        parties: [{
          id: 1,
          name: 'Fellowship of Testers',
          role: 'leader',
          leave_distance_behavior: 'keep',
          avatar_id: null,
        }],
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ storylines: [] }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(avatarsPayload),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        current_user_id: 1,
        members: [
          {
            user_id: 1,
            display_name: 'leader',
            contribution: 12,
            status: 'active',
            color: 0,
            avatar_id: null,
          },
        ],
      }),
    });
}

describe('PartyManageIsland', () => {
  it('renders avatar options when /api/avatars returns a raw array', async () => {
    mockManageResponses(['aragorn', 'gandalf-grey']);

    const { getByRole, getByTitle } = render(<PartyManageIsland />);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Change Icon' })).toBeTruthy();
    });

    fireEvent.click(getByRole('button', { name: 'Change Icon' }));

    await waitFor(() => {
      expect(getByTitle('aragorn')).toBeTruthy();
      expect(getByTitle('gandalf-grey')).toBeTruthy();
    });
  });

  it('still supports the legacy wrapped avatar payload shape', async () => {
    mockManageResponses({ avatars: ['frodo'] });

    const { getByRole, getByTitle } = render(<PartyManageIsland />);

    await waitFor(() => {
      expect(getByRole('button', { name: 'Change Icon' })).toBeTruthy();
    });

    fireEvent.click(getByRole('button', { name: 'Change Icon' }));

    await waitFor(() => {
      expect(getByTitle('frodo')).toBeTruthy();
    });
  });
});