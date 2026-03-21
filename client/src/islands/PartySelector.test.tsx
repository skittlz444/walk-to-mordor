import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/preact';
import { PartySelector } from './PartySelector';
import {
  userParties,
  selectedView,
  partyProgress,
  partiesLoading,
  progressLoading,
} from '../stores/partyStore';

// Mock fetch
const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockClear();
  vi.stubGlobal('fetch', mockFetch);
  // Reset signals
  userParties.value = [];
  selectedView.value = 'personal';
  partyProgress.value = null;
  partiesLoading.value = false;
  progressLoading.value = false;

  // Mock localStorage
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });

  // Default: return empty parties
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ parties: [] }),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PartySelector', () => {
  it('renders nothing when no parties exist', async () => {
    const { container } = render(<PartySelector />);

    await waitFor(() => {
      expect(container.querySelector('.party-selector')).toBeNull();
    });
  });

  it('renders selector when parties exist', async () => {
    userParties.value = [
      { id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3, avatar_id: null },
    ];

    const { container } = render(<PartySelector />);

    expect(container.querySelector('.party-selector')).toBeTruthy();
    expect(container.querySelector('.party-selector__dropdown')).toBeTruthy();

    // Should have Personal + Fellowship options
    const options = container.querySelectorAll('option');
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe('Personal');
    expect(options[1].textContent).toBe('Fellowship');
  });

  it('shows member count inline when party is selected', async () => {
    userParties.value = [
      { id: 1, name: 'The Shire Walkers', role: 'member', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 4, avatar_id: null },
    ];
    selectedView.value = 1;
    partyProgress.value = {
      total_distance: 42.5,
      member_count: 4,
      calculated_position: null,
      distance_mode: 'incremental',
      leave_distance_behavior: 'keep',
      members: [],
      newly_passed_milestones: [],
    };

    const { container } = render(<PartySelector />);

    const members = container.querySelector('.party-selector__members');
    expect(members).toBeTruthy();
    expect(members?.textContent).toContain('4 members');
  });

  it('hides member count in personal view', () => {
    userParties.value = [
      { id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 2, avatar_id: null },
    ];
    selectedView.value = 'personal';

    const { container } = render(<PartySelector />);

    expect(container.querySelector('.party-selector__members')).toBeNull();
  });

  it('applies journey variant class', () => {
    userParties.value = [
      { id: 1, name: 'Test', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1, avatar_id: null },
    ];

    const { container } = render(<PartySelector variant="journey" />);

    expect(container.querySelector('.party-selector--journey')).toBeTruthy();
  });

  it('applies map variant class', () => {
    userParties.value = [
      { id: 1, name: 'Test', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1, avatar_id: null },
    ];

    const { container } = render(<PartySelector variant="map" />);

    expect(container.querySelector('.party-selector--map')).toBeTruthy();
  });

  it('shows loading spinner when progress is loading', () => {
    userParties.value = [
      { id: 1, name: 'Test', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1, avatar_id: null },
    ];
    progressLoading.value = true;

    const { container } = render(<PartySelector />);

    expect(container.querySelector('.party-selector__loading')).toBeTruthy();
  });

  it('shows singular member text for 1 member', () => {
    userParties.value = [
      { id: 1, name: 'Solo', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1, avatar_id: null },
    ];
    selectedView.value = 1;
    partyProgress.value = {
      total_distance: 10.0,
      member_count: 1,
      calculated_position: null,
      distance_mode: 'incremental',
      leave_distance_behavior: 'keep',
      members: [],
      newly_passed_milestones: [],
    };

    const { container } = render(<PartySelector />);

    expect(container.querySelector('.party-selector__members')?.textContent).toContain('1 member');
  });

  it('auto-applies persisted party view after parties load', async () => {
    const partyList = [
      { id: 5, name: 'Shire Walkers', role: 'member', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3, avatar_id: null },
    ];

    const progressData = {
      total_distance: 80.0,
      member_count: 3,
      calculated_position: null,
      distance_mode: 'incremental',
      leave_distance_behavior: 'keep',
      members: [],
      newly_passed_milestones: [],
    };

    // Simulate persisted party selection from a previous session
    selectedView.value = 5;

    // First call: fetchUserParties, second call: fetchPartyProgress (auto-triggered)
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ parties: partyList }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(progressData),
      });

    const onViewChange = vi.fn();
    render(<PartySelector onViewChange={onViewChange} />);

    // After parties load with persisted selection, should auto-fetch progress
    // and invoke the onViewChange callback with the fellowship data
    await waitFor(() => {
      expect(onViewChange).toHaveBeenCalledWith(5, progressData);
    });

    // The progress fetch should have been for the persisted party
    const progressCall = mockFetch.mock.calls.find(
      (call: unknown[]) => typeof call[0] === 'string' && (call[0] as string).includes('/api/party/5/progress')
    );
    expect(progressCall).toBeTruthy();
  });
});
