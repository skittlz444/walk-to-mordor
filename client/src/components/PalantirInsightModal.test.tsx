import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, waitFor } from '@testing-library/preact';
import { PalantirInsightModal } from './PalantirInsightModal';
import type { WeeklyStatsData } from '../utils/palantir';

const STATS: WeeklyStatsData = {
  has_activity: true,
  this_week_km: 12,
  prev_week_km: 8,
  pace_trend: 'up',
  pace_change_pct: 50,
  projection: null,
  fellowships: [],
};

function addBlocker(): HTMLDivElement {
  const blocker = document.createElement('div');
  blocker.className = 'modal-overlay';
  blocker.setAttribute('role', 'dialog');
  blocker.setAttribute('aria-modal', 'true');
  document.body.appendChild(blocker);
  return blocker;
}

afterEach(() => {
  cleanup();
  document.querySelectorAll('.modal-overlay').forEach((element) => element.remove());
});

describe('PalantirInsightModal modal coordination', () => {
  it('defers while another modal dialog is open and appears when it closes', async () => {
    const blocker = addBlocker();

    render(<PalantirInsightModal initialStats={STATS} onDismiss={() => {}} />);

    await waitFor(() => {
      expect(document.querySelector('.palantir-dialog')).toBeNull();
    });

    blocker.remove();

    await waitFor(() => {
      expect(document.querySelector('.palantir-dialog')).not.toBeNull();
    });
    expect(document.querySelector('.palantir-overlay')).not.toBeNull();
  });

  it('renders immediately when no other modal is open', async () => {
    render(<PalantirInsightModal initialStats={STATS} onDismiss={() => {}} />);

    await waitFor(() => {
      expect(document.querySelector('.palantir-dialog')).not.toBeNull();
    });
  });

  it('ignores other modals in alwaysOpen inline mode', async () => {
    addBlocker();

    render(<PalantirInsightModal initialStats={STATS} alwaysOpen />);

    await waitFor(() => {
      expect(document.querySelector('.palantir-inline')).not.toBeNull();
    });
    expect(document.querySelector('.palantir-overlay')).toBeNull();
  });

  it('does not dismiss on Escape while deferred, then does after it appears', async () => {
    const onDismiss = vi.fn();
    const blocker = addBlocker();
    render(<PalantirInsightModal initialStats={STATS} onDismiss={onDismiss} />);

    await waitFor(() => {
      expect(document.querySelector('.palantir-dialog')).toBeNull();
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).not.toHaveBeenCalled();

    blocker.remove();
    await waitFor(() => {
      expect(document.querySelector('.palantir-dialog')).not.toBeNull();
    });
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
