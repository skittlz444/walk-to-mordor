import { cleanup, render, waitFor } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PalantirIsland } from './PalantirIsland';
import { resetAppStore, sessionToken, storeInitialized, userId } from '../stores/appStore';
import { fetchPalantirWeeklyStats } from '../utils/palantir';

vi.mock('../utils/palantir', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/palantir')>();
  return {
    ...actual,
    fetchPalantirWeeklyStats: vi.fn(),
  };
});

vi.mock('../components/PalantirInsightModal', () => ({
  PalantirInsightModal: ({ initialStats }: { initialStats?: { has_activity?: boolean } | null }) => (
    <div data-testid="palantir-modal">{String(initialStats?.has_activity)}</div>
  ),
}));

describe('PalantirIsland', () => {
  beforeEach(() => {
    resetAppStore();
    storeInitialized.value = true;
    sessionToken.value = 'test-token';
    userId.value = 42;
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    resetAppStore();
  });

  it('does not fetch or render when the user is unauthenticated', () => {
    sessionToken.value = null;
    userId.value = null;

    const { queryByTestId } = render(<PalantirIsland />);

    expect(fetchPalantirWeeklyStats).not.toHaveBeenCalled();
    expect(queryByTestId('palantir-modal')).toBeNull();
  });

  it('does not render the popup when there is no recent activity', async () => {
    vi.mocked(fetchPalantirWeeklyStats).mockResolvedValue({ has_activity: false });

    const { queryByTestId } = render(<PalantirIsland />);

    await waitFor(() => {
      expect(fetchPalantirWeeklyStats).toHaveBeenCalledTimes(1);
    });
    expect(queryByTestId('palantir-modal')).toBeNull();
  });

  it('renders the popup when the user has recent activity', async () => {
    vi.mocked(fetchPalantirWeeklyStats).mockResolvedValue({ has_activity: true });

    const { getByTestId } = render(<PalantirIsland />);

    await waitFor(() => {
      expect(getByTestId('palantir-modal').textContent).toBe('true');
    });
  });
});