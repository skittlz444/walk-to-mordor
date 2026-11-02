import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, waitFor, within } from '@testing-library/preact';
import { BadgeAwardModal } from './BadgeAwardModal';
import { resetBadgeAwardModalStore } from '../stores/badgeAwardModalStore';
import type { BadgeAwardEntry, PendingAward } from '../stores/badgeAwardModalStore';
import { resetAppStore, sessionToken } from '../stores/appStore';

const mockFetch = vi.fn();
let storage: Record<string, string>;

const OPEN_EVENT = 'wtm:open-badge-modal';

function setPath(pathname: string) {
  Object.defineProperty(window, 'location', {
    value: { href: pathname, pathname, origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
}

function makePending(overrides: Partial<PendingAward> = {}): PendingAward {
  return {
    instance_id: 1,
    earned_at: '2026-10-01T12:00:00.000Z',
    earned_count: 1,
    slug: 'journey-frodo-sam-buckleberry-ferry',
    name: 'Across the Buckleberry Ferry',
    description: 'You crossed the ferry.',
    image_slug: 'journey-frodo-sam-buckleberry-ferry',
    is_repeatable: false,
    presentation: { rank: 1, rank_label: 'bronze', collection: null },
    ...overrides,
  };
}

function makeRepeatable(overrides: Partial<PendingAward> = {}): PendingAward {
  return makePending({
    slug: 'habit-faithful-walker',
    name: 'Faithful Walker',
    description: 'A steady walking habit.',
    image_slug: 'habit-faithful-walker',
    is_repeatable: true,
    earned_count: 4,
    presentation: { rank: 2, rank_label: 'silver', collection: null },
    ...overrides,
  });
}

function pendingResponse(pending: PendingAward[]) {
  return { ok: true, status: 200, json: () => Promise.resolve({ pending }) };
}

function okResponse() {
  return { ok: true, status: 200, json: () => Promise.resolve({ acknowledged: 1 }) };
}

function acknowledgeCalls() {
  return mockFetch.mock.calls.filter(([url]) => url === '/api/achievements/acknowledge');
}

function acknowledgeBodies() {
  return acknowledgeCalls().map(([, init]) => JSON.parse(init.body as string) as { instance_ids: number[] });
}

function tick(milliseconds = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function dispatchViewOnly(detail: BadgeAwardEntry) {
  document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail }));
}

describe('BadgeAwardModal', () => {
  beforeEach(() => {
    resetBadgeAwardModalStore();
    resetAppStore();
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);

    storage = { sessionToken: 'test-token' };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => { storage[key] = value; },
      removeItem: (key: string) => { delete storage[key]; },
    });

    sessionToken.value = 'test-token';
    setPath('/profile');
  });

  afterEach(() => {
    cleanup();
    resetBadgeAwardModalStore();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('pending fetch branches', () => {
    it('issues no request and renders nothing without a session token', async () => {
      storage = {};
      sessionToken.value = null;

      const { container } = render(<BadgeAwardModal />);
      await tick(20);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
    });

    it('renders nothing and does not retry on 401', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const { container } = render(<BadgeAwardModal />);
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      await tick(20);

      expect(container.innerHTML).toBe('');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(consoleError).not.toHaveBeenCalled();
    });

    it('renders nothing and does not retry when the request rejects', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('network down'));

      const { container } = render(<BadgeAwardModal />);
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      await tick(20);

      expect(container.innerHTML).toBe('');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('renders nothing for an empty pending list, with no retry', async () => {
      mockFetch.mockResolvedValue(pendingResponse([]));

      const { container } = render(<BadgeAwardModal />);
      await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
      await tick(20);

      expect(container.innerHTML).toBe('');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('defers opening when another modal dialog is already open, then opens after it closes', async () => {
      const award = makePending({ name: 'Deferred Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const blocker = document.createElement('div');
      blocker.className = 'modal-overlay';
      document.body.appendChild(blocker);

      try {
        const { findByRole, queryByRole } = render(<BadgeAwardModal />);
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
        await tick(30);

        expect(queryByRole('dialog')).toBeNull();

        blocker.remove();
        expect(await findByRole('dialog', { name: 'Deferred Badge' })).toBeTruthy();
      } finally {
        blocker.remove();
      }
    });

    it('ignores a hidden modal overlay', async () => {
      const award = makePending({ name: 'Hidden Blocker Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const blocker = document.createElement('div');
      blocker.className = 'modal-overlay';
      blocker.style.display = 'none';
      document.body.appendChild(blocker);

      try {
        const { findByRole } = render(<BadgeAwardModal />);
        expect(await findByRole('dialog', { name: 'Hidden Blocker Badge' })).toBeTruthy();
      } finally {
        blocker.remove();
      }
    });

    it('re-checks when the blocking dialog is hidden via style', async () => {
      const award = makePending({ name: 'Style Blocker Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const blocker = document.createElement('div');
      blocker.className = 'modal-overlay';
      document.body.appendChild(blocker);

      try {
        const { findByRole, queryByRole } = render(<BadgeAwardModal />);
        await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
        expect(queryByRole('dialog')).toBeNull();

        blocker.style.display = 'none';
        expect(await findByRole('dialog', { name: 'Style Blocker Badge' })).toBeTruthy();
      } finally {
        blocker.remove();
      }
    });

    it('opens immediately on the map page because the map is not a modal', async () => {
      setPath('/map');
      const award = makePending({ name: 'Map Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const map = document.createElement('div');
      map.id = 'map';
      document.body.appendChild(map);

      try {
        const { findByRole } = render(<BadgeAwardModal />);
        expect(await findByRole('dialog', { name: 'Map Badge' })).toBeTruthy();
      } finally {
        map.remove();
      }
    });
  });

  describe('acknowledge queue', () => {
    it('advances through the queue with position text and closes after the last award', async () => {
      const first = makePending({ instance_id: 11, slug: 'first', name: 'First Badge' });
      const second = makePending({ instance_id: 12, slug: 'second', name: 'Second Badge' });
      mockFetch.mockResolvedValue(pendingResponse([first, second]));

      const { findByRole, findByText, queryByRole } = render(<BadgeAwardModal />);

      const firstDialog = await findByRole('dialog', { name: 'First Badge' });
      expect((await findByText('Badge 1 of 2')).getAttribute('role')).toBe('status');
      expect(firstDialog.querySelector('time')?.getAttribute('datetime'))
        .toBe('2026-10-01T12:00:00.000Z');

      fireEvent.click(await findByRole('button', { name: 'Continue' }));

      expect(await findByRole('dialog', { name: 'Second Badge' })).toBeTruthy();
      expect(await findByText('Badge 2 of 2')).toBeTruthy();

      fireEvent.click(await findByRole('button', { name: 'Collect badge' }));

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      await tick(20);
      expect(queryByRole('dialog')).toBeNull();
      expect(acknowledgeBodies()).toEqual([
        { instance_ids: [11] },
        { instance_ids: [12] },
      ]);
    });

    it('holds the same badge with retry when an acknowledgement fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const first = makePending({ instance_id: 21, slug: 'first', name: 'First Badge' });
      const second = makePending({ instance_id: 22, slug: 'second', name: 'Second Badge' });

      let acknowledgeAttempts = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/achievements/pending') return Promise.resolve(pendingResponse([first, second]));
        if (url === '/api/achievements/acknowledge') {
          acknowledgeAttempts += 1;
          return Promise.resolve(acknowledgeAttempts === 1
            ? { ok: false, status: 500 }
            : okResponse());
        }
        return Promise.reject(new Error(`Unexpected fetch ${url}`));
      });

      const { findByRole, findByText, queryByRole } = render(<BadgeAwardModal />);

      await findByRole('dialog', { name: 'First Badge' });
      fireEvent.click(await findByRole('button', { name: 'Continue' }));

      expect(await findByRole('alert')).toBeTruthy();
      expect(await findByText('Badge 1 of 2')).toBeTruthy();
      expect(queryByRole('button', { name: 'Continue' })).toBeNull();

      fireEvent.click(await findByRole('button', { name: 'Retry' }));

      expect(await findByRole('dialog', { name: 'Second Badge' })).toBeTruthy();
      expect(acknowledgeAttempts).toBe(2);
    });
  });

  describe('dismiss semantics', () => {
    it('closes a one-off without acknowledging it', async () => {
      const award = makePending({ name: 'One-off Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'One-off Badge' });

      fireEvent.click(await findByRole('button', { name: 'Close award' }));

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      expect(acknowledgeCalls()).toHaveLength(0);
    });

    it('acknowledges a repeatable award when dismissed', async () => {
      const award = makeRepeatable({ instance_id: 31 });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Faithful Walker' });

      fireEvent.click(await findByRole('button', { name: 'Close award' }));

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      expect(acknowledgeBodies()).toEqual([{ instance_ids: [31] }]);
    });

    it('keeps a repeatable badge open with retry when close-acknowledgement fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const award = makeRepeatable({ instance_id: 41 });

      let acknowledgeAttempts = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url === '/api/achievements/pending') return Promise.resolve(pendingResponse([award]));
        if (url === '/api/achievements/acknowledge') {
          acknowledgeAttempts += 1;
          return Promise.resolve(acknowledgeAttempts === 1
            ? { ok: false, status: 500 }
            : okResponse());
        }
        return Promise.reject(new Error(`Unexpected fetch ${url}`));
      });

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Faithful Walker' });

      fireEvent.click(await findByRole('button', { name: 'Close award' }));

      expect(await findByRole('alert')).toBeTruthy();
      expect(await findByRole('dialog', { name: 'Faithful Walker' })).toBeTruthy();

      fireEvent.click(await findByRole('button', { name: 'Retry' }));

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      expect(acknowledgeAttempts).toBe(2);
    });

    it('closes a one-off award on Escape without acknowledging', async () => {
      mockFetch.mockResolvedValue(pendingResponse([makePending({ name: 'Escape Badge' })]));

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Escape Badge' });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      expect(acknowledgeCalls()).toHaveLength(0);
    });

    it('closes a repeatable award on Escape and acknowledges it', async () => {
      const award = makeRepeatable({ instance_id: 52 });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Faithful Walker' });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      expect(acknowledgeBodies()).toEqual([{ instance_ids: [52] }]);
    });

    it('closes a repeatable award on overlay activation and acknowledges it', async () => {
      const award = makeRepeatable({ instance_id: 51 });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      const dialog = await findByRole('dialog', { name: 'Faithful Walker' });

      // A click inside the dialog must not close it.
      fireEvent.click(dialog);
      expect(queryByRole('dialog')).not.toBeNull();

      fireEvent.click(dialog.parentElement as HTMLElement);

      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
      expect(acknowledgeBodies()).toEqual([{ instance_ids: [51] }]);
    });
  });

  describe('dialog behavior', () => {
    it('keeps Tab focus inside the dialog', async () => {
      mockFetch.mockResolvedValue(pendingResponse([makePending({ name: 'Trapped Badge' })]));

      const { findByRole } = render(<BadgeAwardModal />);
      const dialog = await findByRole('dialog', { name: 'Trapped Badge' });

      await waitFor(() => {
        expect(document.activeElement?.textContent).toBe('Collect badge');
      });

      fireEvent.keyDown(document, { key: 'Tab' });
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close award' }));

      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Collect badge' }));
    });
  });

  describe('view-only mode', () => {
    it('renders the badge payload with the current rank and no acknowledge control', async () => {
      storage = {};
      sessionToken.value = null;

      const entry: BadgeAwardEntry = {
        slug: 'habit-faithful-walker',
        name: 'Faithful Walker',
        description: 'A steady walking habit.',
        image_slug: 'habit-faithful-walker',
        is_repeatable: true,
        earned_count: 12,
        last_earned_at: '2026-09-20 08:00:00',
        presentation: { rank: 4, rank_label: 'mithril', collection: null },
      };

      const { findByRole, queryByRole, container } = render(<BadgeAwardModal />);
      dispatchViewOnly(entry);

      const dialog = await findByRole('dialog', { name: 'Faithful Walker' });
      expect(dialog.querySelector('time')?.getAttribute('datetime'))
        .toBe('2026-09-20T08:00:00Z');
      expect(within(dialog).getByText('Rank: mithril')).toBeTruthy();
      expect(within(dialog).getByText('Earned 12 times')).toBeTruthy();
      expect(within(dialog).getByText('A steady walking habit.')).toBeTruthy();
      expect(container.querySelector('.badge-award__full')?.getAttribute('src'))
        .toBe('/img/achievements/full/habit-faithful-walker--mithril.webp');
      expect(queryByRole('button', { name: /continue|collect badge/i })).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
      expect(acknowledgeCalls()).toHaveLength(0);
    });

    it('preserves the pending queue and resumes it after closing view-only', async () => {
      const award = makePending({ instance_id: 61, name: 'Pending Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Pending Badge' });

      dispatchViewOnly({
        slug: 'viewed',
        name: 'Viewed Badge',
        image_slug: 'viewed',
        is_repeatable: false,
        earned_count: 1,
        presentation: { rank: 1, rank_label: 'bronze', collection: null },
      });

      expect(await findByRole('dialog', { name: 'Viewed Badge' })).toBeTruthy();

      fireEvent.click(await findByRole('button', { name: 'Close award' }));

      expect(await findByRole('dialog', { name: 'Pending Badge' })).toBeTruthy();
      expect(queryByRole('button', { name: 'Collect badge' })).toBeTruthy();
      expect(acknowledgeCalls()).toHaveLength(0);
    });

    it('returns focus to the activating element on close', async () => {
      storage = {};
      sessionToken.value = null;

      const trigger = document.createElement('button');
      trigger.textContent = 'Open badge';
      document.body.appendChild(trigger);

      try {
        const { findByRole, queryByRole } = render(<BadgeAwardModal />);
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        dispatchViewOnly({
          slug: 'viewed',
          name: 'Focused Badge',
          image_slug: 'viewed',
          is_repeatable: false,
          earned_count: 1,
          presentation: { rank: 1, rank_label: 'bronze', collection: null },
        });

        const dialog = await findByRole('dialog', { name: 'Focused Badge' });
        await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));

        fireEvent.click(await findByRole('button', { name: 'Close award' }));

        await waitFor(() => expect(queryByRole('dialog')).toBeNull());
        await waitFor(() => expect(document.activeElement).toBe(trigger));
      } finally {
        trigger.remove();
      }
    });
  });

  describe('artwork', () => {
    it('uses each pending instance awarding rank, including across a threshold crossing', async () => {
      const silverOne = makeRepeatable({ instance_id: 71, presentation: { rank: 2, rank_label: 'silver', collection: null } });
      const silverTwo = makeRepeatable({ instance_id: 72, presentation: { rank: 2, rank_label: 'silver', collection: null } });
      const gold = makeRepeatable({ instance_id: 73, presentation: { rank: 3, rank_label: 'gold', collection: null } });

      mockFetch.mockResolvedValue(pendingResponse([silverOne, silverTwo, gold]));

      const { findByRole, container, queryByRole } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Faithful Walker' });

      expect(container.querySelector('.badge-award__full')?.getAttribute('src'))
        .toBe('/img/achievements/full/habit-faithful-walker--silver.webp');

      fireEvent.click(await findByRole('button', { name: 'Continue' }));

      await waitFor(() => expect(container.querySelector('.badge-award__position')?.textContent).toBe('Badge 2 of 3'));
      expect(container.querySelector('.badge-award__full')?.getAttribute('src'))
        .toBe('/img/achievements/full/habit-faithful-walker--silver.webp');

      fireEvent.click(await findByRole('button', { name: 'Continue' }));

      await waitFor(() => expect(container.querySelector('.badge-award__position')?.textContent).toBe('Badge 3 of 3'));
      expect(container.querySelector('.badge-award__full')?.getAttribute('src'))
        .toBe('/img/achievements/full/habit-faithful-walker--gold.webp');

      fireEvent.click(await findByRole('button', { name: 'Collect badge' }));
      await waitFor(() => expect(queryByRole('dialog')).toBeNull());
    });

    it('never requests a malformed slug and keeps the text details', async () => {
      const award = makePending({ name: 'No Art Badge', image_slug: '../secrets/badge', description: 'Text only.' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, container } = render(<BadgeAwardModal />);
      const dialog = await findByRole('dialog', { name: 'No Art Badge' });

      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('.badge-award__art')).toBeNull();
      expect(within(dialog).getByText('Text only.')).toBeTruthy();
      expect(within(dialog).getByText('Rank: bronze')).toBeTruthy();
    });

    it('retries the base image after a rank-variant failure and hides the art after two failures', async () => {
      const award = makeRepeatable({ name: 'Art Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, container } = render(<BadgeAwardModal />);
      const dialog = await findByRole('dialog', { name: 'Art Badge' });

      const fullImage = () => container.querySelector('.badge-award__full') as HTMLImageElement | null;

      expect(fullImage()?.getAttribute('src'))
        .toBe('/img/achievements/full/habit-faithful-walker--silver.webp');

      fireEvent.error(fullImage() as HTMLImageElement);

      await waitFor(() => {
        expect(fullImage()?.getAttribute('src'))
          .toBe('/img/achievements/full/habit-faithful-walker.webp');
      });

      fireEvent.error(fullImage() as HTMLImageElement);

      await waitFor(() => expect(container.querySelector('.badge-award__art')).toBeNull());
      expect(within(dialog).getByText('Art Badge')).toBeTruthy();
      expect(within(dialog).getByText('Rank: silver')).toBeTruthy();
      expect(within(dialog).getByText('A steady walking habit.')).toBeTruthy();
      expect(dialog.querySelector('.badge-award__date time')).toBeTruthy();
    });

    it('shows the thumbnail before the full image and falls back when it fails', async () => {
      const award = makeRepeatable({ name: 'Thumb Badge' });
      mockFetch.mockResolvedValue(pendingResponse([award]));

      const { findByRole, container } = render(<BadgeAwardModal />);
      await findByRole('dialog', { name: 'Thumb Badge' });

      const thumb = () => container.querySelector('.badge-award__thumb') as HTMLImageElement | null;
      const full = () => container.querySelector('.badge-award__full') as HTMLImageElement | null;

      expect(thumb()?.getAttribute('src'))
        .toBe('/img/achievements/habit-faithful-walker--silver-thumb.webp');
      expect(full()?.getAttribute('src'))
        .toBe('/img/achievements/full/habit-faithful-walker--silver.webp');
      expect(full()?.className).not.toContain('is-loaded');

      fireEvent.load(full() as HTMLImageElement);
      await waitFor(() => expect(full()?.className).toContain('is-loaded'));

      fireEvent.error(thumb() as HTMLImageElement);
      await waitFor(() => {
        expect(thumb()?.getAttribute('src'))
          .toBe('/img/achievements/habit-faithful-walker-thumb.webp');
      });

      fireEvent.error(thumb() as HTMLImageElement);
      await waitFor(() => expect(thumb()).toBeNull());
    });
  });
});
