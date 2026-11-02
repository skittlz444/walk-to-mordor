import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/preact';
import { BadgeDisplayIsland } from './BadgeDisplayIsland';
import type { BadgeAchievement, BadgeCollection } from './BadgeDisplayIsland';

const mockFetch = vi.fn();
let awardEventSpy: ReturnType<typeof vi.fn>;

const OPEN_EVENT = 'wtm:open-badge-modal';

function setPath(pathname: string) {
  Object.defineProperty(window, 'location', {
    value: { href: pathname, pathname, origin: 'http://localhost' },
    writable: true,
    configurable: true,
  });
}

function achievementsResponse(achievements: BadgeAchievement[]) {
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve({ achievements }),
  };
}

function makeCollection(overrides: Partial<BadgeCollection> = {}): BadgeCollection {
  return {
    slug: 'frodo-sam-journey',
    label: 'The Road to Mordor',
    index: 1,
    size: 8,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<BadgeAchievement> = {}): BadgeAchievement {
  return {
    slug: 'journey-frodo-sam-buckleberry-ferry',
    name: 'Across the Buckleberry Ferry',
    image_slug: 'journey-frodo-sam-buckleberry-ferry',
    is_repeatable: false,
    earned_count: 1,
    presentation: {
      rank: 1,
      rank_label: 'bronze',
      storyline: 'frodo-sam',
      collection: makeCollection(),
    },
    ...overrides,
  };
}

function sectionNames(section: Element): Array<string | null> {
  return Array.from(section.querySelectorAll('.badge-card__name')).map((name) => name.textContent);
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe('BadgeDisplayIsland', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);

    awardEventSpy = vi.fn();
    document.addEventListener(OPEN_EVENT, awardEventSpy as EventListener);

    const store: Record<string, string> = { sessionToken: 'test-token' };
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
    });

    setPath('/profile');
  });

  afterEach(() => {
    document.removeEventListener(OPEN_EVENT, awardEventSpy as EventListener);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('page modes', () => {
    it('fetches the signed-in user summary on /profile', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([makeEntry()]));

      const { findByText } = render(<BadgeDisplayIsland />);

      expect(await findByText('Across the Buckleberry Ferry')).toBeTruthy();
      expect(mockFetch).toHaveBeenCalledWith('/api/achievements', {
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      });
    });

    it('fetches the friend summary with the userId from /friends/<id>', async () => {
      setPath('/friends/42');
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({ slug: 'friend-badge', name: "Friend's Badge", image_slug: 'friend-badge' }),
      ]));

      const { findByText } = render(<BadgeDisplayIsland />);

      expect(await findByText("Friend's Badge")).toBeTruthy();
      expect(mockFetch).toHaveBeenCalledWith('/api/achievements?userId=42', {
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      });
    });

    it('does not request anything on an unrelated page', async () => {
      setPath('/journey');

      const { container } = render(<BadgeDisplayIsland />);

      await wait(220);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
    });
  });

  describe('grouping', () => {
    it('groups by collection in collection order and trails standalone badges in "Other"', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({ slug: 'standalone', name: 'Newest standalone', presentation: { collection: null } }),
        makeEntry({
          slug: 'weathertop',
          name: 'Weathertop',
          presentation: { rank_label: 'bronze', collection: makeCollection({ index: 2 }) },
        }),
        makeEntry({
          slug: 'home',
          name: 'Home Again',
          presentation: { rank_label: 'mithril', collection: makeCollection({ label: 'The Return', slug: 'return', index: 2 }) },
        }),
        makeEntry({
          slug: 'ferry',
          name: 'Buckleberry Ferry',
          presentation: { rank_label: 'bronze', collection: makeCollection({ index: 1 }) },
        }),
        makeEntry({
          slug: 'khazad-dum',
          name: 'Through Khazad-dûm',
          presentation: { rank_label: 'silver', collection: makeCollection({ index: 3 }) },
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Newest standalone');

      const sections = container.querySelectorAll('.badge-collection');
      expect(Array.from(sections).map((section) => section.querySelector('.badge-collection__label')?.textContent))
        .toEqual(['The Road to Mordor', 'The Return', 'Other']);

      expect(sectionNames(sections[0])).toEqual(['Buckleberry Ferry', 'Weathertop', 'Through Khazad-dûm']);
      expect(sectionNames(sections[1])).toEqual(['Home Again']);
      expect(sectionNames(sections[2])).toEqual(['Newest standalone']);
    });

    it('shows the earned count over the collection size in the section header', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({ slug: 'ferry', name: 'Buckleberry Ferry' }),
        makeEntry({ slug: 'weathertop', name: 'Weathertop', presentation: { collection: makeCollection({ index: 2 }) } }),
        makeEntry({ slug: 'khazad-dum', name: 'Through Khazad-dûm', presentation: { collection: makeCollection({ index: 3 }) } }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Weathertop');

      const header = container.querySelector('.badge-collection__header');
      expect(header?.textContent).toBe('The Road to Mordor · 3/8');
    });
  });

  describe('badge cards', () => {
    it('shows the name, rank label and collection position', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          name: 'The Glittering Caves',
          presentation: {
            rank: 4,
            rank_label: 'mithril',
            collection: makeCollection({ index: 7, size: 8 }),
          },
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('The Glittering Caves');

      expect(container.querySelector('.badge-card__name')?.textContent).toBe('The Glittering Caves');
      expect(container.querySelector('.badge-rank')?.textContent).toBe('mithril');
      expect(container.querySelector('.badge-position')?.textContent).toBe('7/8');
      expect(container.querySelector('button.badge-card__button')).toBeTruthy();
    });

    it('shows a repeat-count chip only when earned_count is greater than one', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'habit-faithful-walker',
          name: 'Faithful Walker',
          image_slug: 'habit-faithful-walker',
          is_repeatable: true,
          earned_count: 5,
          presentation: { rank: 2, rank_label: 'silver', collection: null },
        }),
        makeEntry({ slug: 'once', name: 'Earned Once', image_slug: 'once', presentation: { collection: null } }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Faithful Walker');

      const chips = container.querySelectorAll('.badge-repeat');
      expect(chips).toHaveLength(1);
      expect(chips[0].textContent).toBe('×5');
      expect(chips[0].getAttribute('aria-label')).toBe('Earned 5 times');
    });

    it('exposes rank, collection position and repeat count to assistive technology', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'habit-faithful-walker',
          name: 'Faithful Walker',
          image_slug: 'habit-faithful-walker',
          is_repeatable: true,
          earned_count: 12,
          presentation: {
            rank: 3,
            rank_label: 'gold',
            collection: makeCollection({ index: 4, size: 8 }),
          },
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Faithful Walker');

      expect(container.querySelector('.badge-rank')?.getAttribute('aria-label')).toBe('Rank: gold');
      expect(container.querySelector('.badge-position')?.getAttribute('aria-label')).toBe('Collection position 4 of 8');
      expect(container.querySelector('.badge-repeat')?.getAttribute('aria-label')).toBe('Earned 12 times');
    });
  });

  describe('artwork', () => {
    it('uses the plain slug for fixed-rank badges', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([makeEntry()]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Across the Buckleberry Ferry');

      const image = container.querySelector('img');
      expect(image?.getAttribute('src')).toBe('/img/achievements/journey-frodo-sam-buckleberry-ferry.webp');
    });

    it('uses the rank variant for repeatable badges', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'habit-faithful-walker',
          name: 'Faithful Walker',
          image_slug: 'habit-faithful-walker',
          is_repeatable: true,
          earned_count: 12,
          presentation: { rank: 3, rank_label: 'gold', collection: null },
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Faithful Walker');

      expect(container.querySelector('img')?.getAttribute('src'))
        .toBe('/img/achievements/habit-faithful-walker--gold.webp');
    });

    it('retries the base image and then hides the image when both fail', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'habit-faithful-walker',
          name: 'Faithful Walker',
          image_slug: 'habit-faithful-walker',
          is_repeatable: true,
          earned_count: 12,
          presentation: { rank: 3, rank_label: 'gold', collection: null },
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Faithful Walker');

      fireEvent.error(container.querySelector('img') as HTMLImageElement);

      await waitFor(() => {
        expect(container.querySelector('img')?.getAttribute('src'))
          .toBe('/img/achievements/habit-faithful-walker.webp');
      });

      fireEvent.error(container.querySelector('img') as HTMLImageElement);

      await waitFor(() => {
        expect(container.querySelector('img')).toBeNull();
      });
      expect(container.querySelector('.badge-card__placeholder')).toBeTruthy();
      expect(container.querySelector('.badge-card__name')?.textContent).toBe('Faithful Walker');
    });

    it('shows the placeholder when a fixed-rank image fails to load', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'fixed-badge',
          name: 'Fixed Badge',
          image_slug: 'fixed-badge',
          is_repeatable: false,
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Fixed Badge');

      fireEvent.error(container.querySelector('img') as HTMLImageElement);

      await waitFor(() => {
        expect(container.querySelector('img')).toBeNull();
      });
      expect(container.querySelector('.badge-card__placeholder')).toBeTruthy();
      expect(container.querySelector('.badge-card__name')?.textContent).toBe('Fixed Badge');
    });

    it.each([
      ['null', null],
      ['path traversal', '../secrets/badge'],
      ['disallowed characters', 'Badge Slug!'],
    ])('renders a placeholder and makes no image request for a %s slug', async (_label, imageSlug) => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'placeholder-badge',
          name: 'Placeholder Badge',
          image_slug: imageSlug,
          presentation: { collection: null },
        }),
      ]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Placeholder Badge');

      expect(container.querySelector('img')).toBeNull();
      expect(container.querySelector('.badge-card__placeholder')).toBeTruthy();
    });
  });

  describe('activation', () => {
    it('dispatches the open event with the badge payload from the profile grid', async () => {
      const entry = makeEntry({
        slug: 'habit-faithful-walker',
        name: 'Faithful Walker',
        image_slug: 'habit-faithful-walker',
        is_repeatable: true,
        earned_count: 4,
        last_earned_at: '2026-10-01T12:00:00.000Z',
        presentation: {
          rank: 2,
          rank_label: 'silver',
          collection: makeCollection({ index: 3, size: 8 }),
        },
      });
      mockFetch.mockResolvedValue(achievementsResponse([entry]));

      const { findByRole } = render(<BadgeDisplayIsland />);
      const button = await findByRole('button', { name: /Faithful Walker/ });

      fireEvent.click(button);

      expect(awardEventSpy).toHaveBeenCalledTimes(1);
      const event = awardEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toMatchObject({
        slug: 'habit-faithful-walker',
        name: 'Faithful Walker',
        image_slug: 'habit-faithful-walker',
        is_repeatable: true,
        earned_count: 4,
        last_earned_at: '2026-10-01T12:00:00.000Z',
        presentation: entry.presentation,
      });
    });

    it('dispatches the same event from the friend profile grid', async () => {
      setPath('/friends/42');
      const entry = makeEntry({
        slug: 'friend-badge',
        name: "Friend's Badge",
        image_slug: 'friend-badge',
        presentation: { rank: 4, rank_label: 'mithril', collection: null },
      });
      mockFetch.mockResolvedValue(achievementsResponse([entry]));

      const { findByRole } = render(<BadgeDisplayIsland />);
      const button = await findByRole('button', { name: /Friend's Badge/ });

      fireEvent.click(button);

      expect(awardEventSpy).toHaveBeenCalledTimes(1);
      const event = awardEventSpy.mock.calls[0][0] as CustomEvent;
      expect(event.detail).toMatchObject({
        slug: 'friend-badge',
        name: "Friend's Badge",
        presentation: { rank: 4, rank_label: 'mithril', collection: null },
      });
      expect(mockFetch.mock.calls).toHaveLength(1);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/achievements?userId=42');
    });

    it('opens from Enter key activation', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([makeEntry()]));

      const { findByRole } = render(<BadgeDisplayIsland />);
      const button = await findByRole('button', { name: /Across the Buckleberry Ferry/ });

      fireEvent.keyDown(button, { key: 'Enter' });

      expect(awardEventSpy).toHaveBeenCalledTimes(1);
    });

    it('opens from Space key activation', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([makeEntry()]));

      const { findByRole } = render(<BadgeDisplayIsland />);
      const button = await findByRole('button', { name: /Across the Buckleberry Ferry/ });

      fireEvent.keyDown(button, { key: ' ' });

      expect(awardEventSpy).toHaveBeenCalledTimes(1);
    });

    it('exposes the badge name, rank, collection position and repeat count to assistive technology', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([
        makeEntry({
          slug: 'habit-faithful-walker',
          name: 'Faithful Walker',
          is_repeatable: true,
          earned_count: 12,
          presentation: {
            rank: 3,
            rank_label: 'gold',
            collection: makeCollection({ index: 4, size: 8 }),
          },
        }),
      ]));

      const { findByRole } = render(<BadgeDisplayIsland />);
      await findByRole('button', {
        name: 'Faithful Walker. Rank: gold. Collection position 4 of 8. Earned 12 times',
      });
    });

    it('issues no acknowledge request when a card is activated', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([makeEntry()]));

      const { findByRole } = render(<BadgeDisplayIsland />);
      fireEvent.click(await findByRole('button', { name: /Across the Buckleberry Ferry/ }));

      expect(mockFetch.mock.calls).toHaveLength(1);
      expect(mockFetch.mock.calls[0][0]).toBe('/api/achievements');
    });
  });

  describe('loading, empty and error states', () => {
    it('shows circular skeletons only after a short delay', async () => {
      mockFetch.mockReturnValue(new Promise(() => {}));

      const { container } = render(<BadgeDisplayIsland />);

      expect(container.querySelector('.badge-skeleton')).toBeNull();

      await waitFor(() => {
        expect(container.querySelectorAll('.badge-skeleton').length).toBeGreaterThan(0);
      });
    });

    it('does not flash skeletons when the response arrives quickly', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([makeEntry()]));

      const { container, findByText } = render(<BadgeDisplayIsland />);
      await findByText('Across the Buckleberry Ferry');

      await wait(220);

      expect(container.querySelector('.badge-skeleton')).toBeNull();
      expect(container.querySelector('.badge-grid')).toBeTruthy();
    });

    it('renders nothing for an empty summary', async () => {
      mockFetch.mockResolvedValue(achievementsResponse([]));

      const { container } = render(<BadgeDisplayIsland />);

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      await wait(220);

      expect(container.innerHTML).toBe('');
    });

    it('renders nothing and does not log on 401', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({ ok: false, status: 401 });

      const { container } = render(<BadgeDisplayIsland />);

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());
      await wait(220);

      expect(container.innerHTML).toBe('');
      expect(consoleError).not.toHaveBeenCalled();
    });

    it.each([404, 500])('logs and renders nothing on a %i response', async (status) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockResolvedValue({ ok: false, status });

      const { container } = render(<BadgeDisplayIsland />);

      await waitFor(() => expect(consoleError).toHaveBeenCalled());
      expect(container.innerHTML).toBe('');
    });

    it('logs and renders nothing when the request rejects', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error('network down'));

      const { container } = render(<BadgeDisplayIsland />);

      await waitFor(() => expect(consoleError).toHaveBeenCalled());
      expect(container.innerHTML).toBe('');
    });
  });
});
