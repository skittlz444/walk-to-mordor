import { cleanup, render, fireEvent } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatsIsland } from './StatsIsland';
import {
  resetAppStore,
  sessionToken,
  storeInitialized,
  userId,
  isAdmin,
} from '../stores/appStore';

vi.mock('../components/PalantirInsightModal', () => ({
  PalantirInsightModal: () => <div data-testid="palantir-modal">Palantir</div>,
}));

vi.mock('../components/HeatmapCalendar', () => ({
  HeatmapCalendar: () => <div data-testid="heatmap-calendar">Heatmap</div>,
}));

vi.mock('./WrappedIsland', () => ({
  WrappedIsland: () => <div data-testid="wrapped-island">Wrapped</div>,
}));

describe('StatsIsland', () => {
  beforeEach(() => {
    resetAppStore();
    storeInitialized.value = true;
    sessionToken.value = 'test-token';
    userId.value = 42;
    vi.clearAllMocks();
    // Reset hash
    if (typeof window !== 'undefined') {
      window.location.hash = '';
    }
  });

  afterEach(() => {
    cleanup();
    resetAppStore();
  });

  it('renders palantir tab by default', () => {
    const { getByTestId, queryByTestId } = render(<StatsIsland />);
    expect(getByTestId('palantir-modal')).toBeTruthy();
    expect(queryByTestId('heatmap-calendar')).toBeNull();
  });

  it('does not show Year in Review tab for non-admin users', () => {
    isAdmin.value = false;

    const { queryByTestId } = render(<StatsIsland />);
    expect(queryByTestId('wrapped-tab')).toBeNull();
  });

  it('shows Year in Review tab for admin users', () => {
    isAdmin.value = true;

    const { getByTestId } = render(<StatsIsland />);
    expect(getByTestId('wrapped-tab')).toBeTruthy();
  });

  it('renders wrapped island when admin clicks Year in Review tab', () => {
    isAdmin.value = true;

    const { getByTestId, queryByTestId } = render(<StatsIsland />);
    fireEvent.click(getByTestId('wrapped-tab'));

    // After clicking the tab, the wrapped island should render
    expect(queryByTestId('wrapped-island')).toBeTruthy();
  });

  it('does not render wrapped island for non-admin even if hash is #wrapped', () => {
    isAdmin.value = false;
    window.location.hash = '#wrapped';

    const { getByTestId, queryByTestId } = render(<StatsIsland />);
    // The wrapped tab shouldn't exist for non-admins
    expect(queryByTestId('wrapped-tab')).toBeNull();
    expect(queryByTestId('wrapped-island')).toBeNull();
    expect(getByTestId('palantir-modal')).toBeTruthy();
  });
});
