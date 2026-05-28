import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/preact';
import { AdminStorylinesIsland } from './AdminStorylinesIsland';

const mockFetch = vi.fn();

const frodoStoryline = {
  id: 1,
  slug: 'frodo-sam',
  title: 'Frodo & Sam',
  description: 'The road to Mount Doom.',
  path_key: 'fellowship',
  sort_order: 10,
  is_active: true,
  admin_only: false,
  goal_count: 2,
  min_distance: 0,
  max_distance: 10,
};

const pippinStoryline = {
  id: 2,
  slug: 'pippin',
  title: 'Pippin',
  description: 'A guarded route through Gondor.',
  path_key: 'pippin',
  sort_order: 20,
  is_active: true,
  admin_only: true,
  goal_count: 1,
  min_distance: 3,
  max_distance: 3,
};

function jsonResponse(data: unknown) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

  mockFetch.mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);

    if (url === '/api/admin/storylines') {
      return jsonResponse({ storylines: [frodoStoryline, pippinStoryline] });
    }

    if (url === '/api/admin/storylines/1') {
      return jsonResponse({
        storyline: frodoStoryline,
        goals: [
          { storyline_goal_id: 11, goal_id: 101, title: 'Bag End', distance: 0, sort_order: 1 },
          { storyline_goal_id: 12, goal_id: 102, title: 'The Green Dragon', distance: 10, sort_order: 2 },
        ],
      });
    }

    if (url === '/api/admin/storylines/2') {
      return jsonResponse({
        storyline: pippinStoryline,
        goals: [
          { storyline_goal_id: 21, goal_id: 201, title: 'Minas Tirith', distance: 3, sort_order: 1 },
        ],
      });
    }

    if (url.startsWith('/api/admin/goals')) {
      return jsonResponse({
        goals: [
          { id: 101, title: 'Bag End', distance: 0 },
          { id: 102, title: 'The Green Dragon', distance: 10 },
          { id: 103, title: 'Weathertop', distance: 45 },
          { id: 201, title: 'Minas Tirith', distance: 3 },
        ],
        page: 1,
        totalPages: 1,
      });
    }

    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('AdminStorylinesIsland', () => {
  it('renders storylines with the shared admin panel and table layout', async () => {
    const { container, getByText } = render(<AdminStorylinesIsland />);

    await waitFor(() => {
      expect(getByText('Goal Distances')).toBeTruthy();
    });

    expect(container.querySelector('.admin-storylines')).toBeTruthy();
    expect(container.querySelector('.admin-panel.admin-storyline-list-panel')).toBeTruthy();
    expect(container.querySelector('.admin-panel.admin-storyline-panel')).toBeTruthy();
    expect(container.querySelector('.admin-goals-table')).toBeTruthy();

    const activeRow = container.querySelector('.admin-storyline-row--active');
    expect(activeRow?.getAttribute('aria-selected')).toBe('true');
    expect(activeRow?.textContent).toContain('Frodo & Sam');
  });

  it('supports keyboard selection without breaking the detail panel', async () => {
    const { container, getByText } = render(<AdminStorylinesIsland />);

    await waitFor(() => {
      expect(getByText('Frodo & Sam')).toBeTruthy();
    });

    const rows = container.querySelectorAll<HTMLTableRowElement>('.admin-storyline-row');
    expect(rows).toHaveLength(2);

    fireEvent.keyDown(rows[1], { key: 'Enter' });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/admin/storylines/2', expect.any(Object));
    });

    const activeRow = container.querySelector('.admin-storyline-row--active');
    expect(activeRow?.textContent).toContain('Pippin');
    expect(getByText('Minas Tirith')).toBeTruthy();
  });

  it('filters goal distances and edits the matching mapped goal', async () => {
    const { container, getByLabelText, getByText, queryByText } = render(<AdminStorylinesIsland />);

    await waitFor(() => {
      expect(getByText('The Green Dragon')).toBeTruthy();
    });

    fireEvent.input(getByLabelText('Search mapped and addable goals') as HTMLInputElement, { target: { value: 'green' } });

    expect(getByText('1 of 2 mapped goals')).toBeTruthy();
    expect(getByText('The Green Dragon')).toBeTruthy();
    expect(queryByText('Bag End')).toBeNull();

    const filteredDistanceInput = container.querySelector<HTMLInputElement>('.admin-storyline-goal-row input');
    expect(filteredDistanceInput).toBeTruthy();
    fireEvent.input(filteredDistanceInput as HTMLInputElement, { target: { value: '12.5' } });

    fireEvent.input(getByLabelText('Search mapped and addable goals') as HTMLInputElement, { target: { value: '' } });

    const distanceInputs = container.querySelectorAll<HTMLInputElement>('.admin-storyline-goal-row input');
    expect(distanceInputs).toHaveLength(2);
    expect(distanceInputs[0].value).toBe('0');
    expect(distanceInputs[1].value).toBe('12.5');
  });

  it('uses the goal search to filter the add-goal dropdown', async () => {
    const { container, getByLabelText, getByText, queryByText } = render(<AdminStorylinesIsland />);

    await waitFor(() => {
      expect(getByText('The Green Dragon')).toBeTruthy();
    });

    fireEvent.input(getByLabelText('Search mapped and addable goals') as HTMLInputElement, { target: { value: 'weath' } });

    const addGoalSelect = container.querySelector<HTMLSelectElement>('.admin-storyline-goal-add select');
    expect(addGoalSelect).toBeTruthy();

    await waitFor(() => {
      expect(addGoalSelect?.disabled).toBe(false);
      expect(addGoalSelect?.value).toBe('103');
    });

    expect(addGoalSelect?.textContent).toContain('Weathertop');
    expect(addGoalSelect?.textContent).not.toContain('Minas Tirith');
    expect(queryByText('Bag End')).toBeNull();

    fireEvent.click(getByText('Add Goal'));

    await waitFor(() => {
      expect(getByText('1 of 3 mapped goals')).toBeTruthy();
    });

    expect(getByText('Weathertop')).toBeTruthy();
  });
});
