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
      { id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3 },
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

  it('does not render banner (removed for cleaner UI)', async () => {
    userParties.value = [
      { id: 1, name: 'The Shire Walkers', role: 'member', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 4 },
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

    const banner = container.querySelector('.party-selector__banner');
    expect(banner).toBeNull();
  });

  it('does not render banner in personal view (banner removed)', () => {
    userParties.value = [
      { id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 2 },
    ];
    selectedView.value = 'personal';

    const { container } = render(<PartySelector />);

    // Banner should not exist regardless of view (removed for cleaner UI)
    expect(container.querySelector('.party-selector__banner')).toBeNull();
  });

  it('applies journey variant class', () => {
    userParties.value = [
      { id: 1, name: 'Test', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1 },
    ];

    const { container } = render(<PartySelector variant="journey" />);

    expect(container.querySelector('.party-selector--journey')).toBeTruthy();
  });

  it('applies map variant class', () => {
    userParties.value = [
      { id: 1, name: 'Test', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1 },
    ];

    const { container } = render(<PartySelector variant="map" />);

    expect(container.querySelector('.party-selector--map')).toBeTruthy();
  });

  it('shows loading spinner when progress is loading', () => {
    userParties.value = [
      { id: 1, name: 'Test', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1 },
    ];
    progressLoading.value = true;

    const { container } = render(<PartySelector />);

    expect(container.querySelector('.party-selector__loading')).toBeTruthy();
  });

  it('does not render member text in banner (banner removed)', () => {
    userParties.value = [
      { id: 1, name: 'Solo', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1 },
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

    expect(container.querySelector('.party-selector__banner')).toBeNull();
  });
});
