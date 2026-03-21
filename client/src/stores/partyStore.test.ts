import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  userParties,
  selectedView,
  partyProgress,
  partiesLoading,
  progressLoading,
  partyError,
  hasParties,
  isPartyView,
  selectedParty,
  viewDistance,
  fetchUserParties,
  fetchPartyProgress,
  selectView,
  hasTriggeredMilestones,
  markMilestoneTriggered,
  consumeNewlyPassedMilestones,
} from './partyStore';

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
  partyError.value = null;

  // Mock localStorage
  const store: Record<string, string> = {};
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('partyStore computed signals', () => {
  it('hasParties is false when no parties', () => {
    expect(hasParties.value).toBe(false);
  });

  it('hasParties is true when parties exist', () => {
    userParties.value = [{ id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3 }];
    expect(hasParties.value).toBe(true);
  });

  it('isPartyView reflects selection', () => {
    expect(isPartyView.value).toBe(false);
    selectedView.value = 5;
    expect(isPartyView.value).toBe(true);
    selectedView.value = 'personal';
    expect(isPartyView.value).toBe(false);
  });

  it('selectedParty returns matching party', () => {
    const party = { id: 7, name: 'Shire Walkers', role: 'member', distance_mode: 'cumulative', leave_distance_behavior: 'remove', dissolved_at: null, active_member_count: 2 };
    userParties.value = [party];
    selectedView.value = 7;
    expect(selectedParty.value).toEqual(party);
  });

  it('selectedParty returns null for personal view', () => {
    userParties.value = [{ id: 1, name: 'Test', role: 'member', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 1 }];
    selectedView.value = 'personal';
    expect(selectedParty.value).toBeNull();
  });

  it('viewDistance returns party total when party selected', () => {
    selectedView.value = 1;
    partyProgress.value = {
      total_distance: 42.5,
      user_total_distance: 20,
      member_count: 3,
      calculated_position: null,
      distance_mode: 'incremental',
      leave_distance_behavior: 'keep',
      members: [],
      newly_passed_milestones: [],
    };
    expect(viewDistance.value).toBe(42.5);
  });

  it('viewDistance returns null for personal view', () => {
    selectedView.value = 'personal';
    expect(viewDistance.value).toBeNull();
  });
});

describe('fetchUserParties', () => {
  it('fetches and stores parties', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ parties: [{ id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3 }] }),
    });

    await fetchUserParties();

    expect(userParties.value).toHaveLength(1);
    expect(userParties.value[0].name).toBe('Fellowship');
    expect(partiesLoading.value).toBe(false);
  });

  it('clears stale persisted selection when party not found', async () => {
    selectedView.value = 999;
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ parties: [{ id: 1, name: 'Fellowship', role: 'leader', distance_mode: 'incremental', leave_distance_behavior: 'keep', dissolved_at: null, active_member_count: 3 }] }),
    });

    await fetchUserParties();

    expect(selectedView.value).toBe('personal');
  });

  it('handles fetch errors gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    await fetchUserParties();

    expect(partyError.value).toBe('Network error');
    expect(partiesLoading.value).toBe(false);
  });
});

describe('fetchPartyProgress', () => {
  it('fetches and stores progress', async () => {
    const progressData = {
      total_distance: 100.5,
      member_count: 2,
      calculated_position: { id: 1, title: 'Bag End', distance: 0 },
      distance_mode: 'incremental',
      leave_distance_behavior: 'keep',
      members: [{ user_id: 1, display_name: 'Frodo', contribution: 60.5, status: 'active', color: 1 }],
      newly_passed_milestones: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(progressData),
    });

    const result = await fetchPartyProgress(1);

    expect(result).toEqual(progressData);
    expect(partyProgress.value).toEqual(progressData);
    expect(progressLoading.value).toBe(false);
  });

  it('falls back to personal on 403', async () => {
    selectedView.value = 5;
    mockFetch.mockResolvedValueOnce({ ok: false, status: 403 });

    const result = await fetchPartyProgress(5);

    expect(result).toBeNull();
    expect(selectedView.value).toBe('personal');
    expect(partyProgress.value).toBeNull();
  });

  it('falls back to personal on 404', async () => {
    selectedView.value = 5;
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });

    const result = await fetchPartyProgress(5);

    expect(result).toBeNull();
    expect(selectedView.value).toBe('personal');
  });
});

describe('selectView', () => {
  it('sets personal view and clears progress', async () => {
    partyProgress.value = { total_distance: 50, user_total_distance: 20, member_count: 2, calculated_position: null, distance_mode: 'incremental', leave_distance_behavior: 'keep', members: [], newly_passed_milestones: [] };

    const result = await selectView('personal');

    expect(result).toBeNull();
    expect(selectedView.value).toBe('personal');
    expect(partyProgress.value).toBeNull();
  });

  it('fetches progress when party is selected', async () => {
    const progressData = {
      total_distance: 75.0,
      member_count: 3,
      calculated_position: null,
      distance_mode: 'incremental',
      leave_distance_behavior: 'keep',
      members: [],
      newly_passed_milestones: [],
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(progressData),
    });

    const result = await selectView(2);

    expect(selectedView.value).toBe(2);
    expect(result).toEqual(progressData);
  });
});

describe('milestone tracking', () => {
  it('tracks triggered milestones per party', () => {
    expect(hasTriggeredMilestones(1, 100)).toBe(false);
    markMilestoneTriggered(1, 100);
    expect(hasTriggeredMilestones(1, 100)).toBe(true);
    expect(hasTriggeredMilestones(1, 200)).toBe(false);
    expect(hasTriggeredMilestones(2, 100)).toBe(false);
  });
});

describe('consumeNewlyPassedMilestones', () => {
  const milestones = [
    { id: 1, title: 'Bag End', distance: 10 },
    { id: 2, title: 'The Prancing Pony', distance: 50 },
    { id: 3, title: 'Rivendell', distance: 100 },
  ];

  it('returns all milestones when none have been triggered', () => {
    const result = consumeNewlyPassedMilestones(10, milestones);
    expect(result).toHaveLength(3);
    expect(result.map(m => m.id)).toEqual([1, 2, 3]);
  });

  it('marks returned milestones as triggered', () => {
    consumeNewlyPassedMilestones(20, [{ id: 5, title: 'Test', distance: 77 }]);
    expect(hasTriggeredMilestones(20, 77)).toBe(true);
  });

  it('filters out already-triggered milestones', () => {
    markMilestoneTriggered(30, 10);
    const result = consumeNewlyPassedMilestones(30, milestones);
    expect(result).toHaveLength(2);
    expect(result.map(m => m.distance)).toEqual([50, 100]);
  });

  it('returns empty array when all milestones already triggered', () => {
    milestones.forEach(m => markMilestoneTriggered(40, m.distance));
    const result = consumeNewlyPassedMilestones(40, milestones);
    expect(result).toHaveLength(0);
  });

  it('returns empty array for empty milestones input', () => {
    const result = consumeNewlyPassedMilestones(50, []);
    expect(result).toHaveLength(0);
  });

  it('isolates triggered state per party', () => {
    markMilestoneTriggered(60, 10);
    // Party 61 should not be affected by party 60's triggered state
    const result = consumeNewlyPassedMilestones(61, [{ id: 1, title: 'Bag End', distance: 10 }]);
    expect(result).toHaveLength(1);
  });
});
