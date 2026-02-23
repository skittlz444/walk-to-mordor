import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { GoalsSectionIsland } from './GoalsSectionIsland';
import {
  goals,
  currentDistance,
  loading,
  error,
  showFutureGoalsUnlocked,
} from '../stores/journeyStore';
import type { Goal } from '../types/goal';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

const sampleGoals: Goal[] = [
  { id: 1, distance: 10, title: 'Bag End' },
  { id: 2, distance: 20, title: 'Bucklebury Ferry', special: 'Milestone' },
  { id: 3, distance: 30, title: 'Bree' },
  { id: 4, distance: 50, title: 'Weathertop' },
  { id: 5, distance: 100, title: 'Rivendell', special: 'Major Milestone' },
];

function setupStore(opts: {
  distance?: number;
  goalsData?: Goal[];
  loadingState?: boolean;
  errorState?: string | null;
  prefUnlocked?: boolean;
} = {}) {
  goals.value = opts.goalsData ?? sampleGoals;
  currentDistance.value = opts.distance ?? 25;
  loading.value = opts.loadingState ?? false;
  error.value = opts.errorState ?? null;
  showFutureGoalsUnlocked.value = opts.prefUnlocked ?? true;
}

describe('GoalsSectionIsland', () => {
  beforeEach(() => {
    // Reset store
    goals.value = [];
    currentDistance.value = 0;
    loading.value = false;
    error.value = null;
    showFutureGoalsUnlocked.value = true;
    mockFetch.mockReset();

    // Setup window globals
    window.getAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test' }));
    window.userPreferences = undefined;

    // Create #last-goal element in the document
    const lastGoalEl = document.createElement('div');
    lastGoalEl.id = 'last-goal';
    document.body.appendChild(lastGoalEl);

    // Create #total-distance-value element
    const distEl = document.createElement('div');
    distEl.id = 'total-distance-value';
    distEl.textContent = '0';
    document.body.appendChild(distEl);
  });

  afterEach(() => {
    document.getElementById('last-goal')?.remove();
    document.getElementById('total-distance-value')?.remove();
    document.getElementById('goal-modal-container')?.remove();
  });

  it('renders nothing when goals are empty', () => {
    const { container } = render(<GoalsSectionIsland />);
    // Should have no completed goals or upcoming goals
    expect(container.querySelector('#completed-goals')).toBeNull();
    expect(container.querySelector('#upcoming-goals-list')).toBeNull();
  });

  it('renders completed and upcoming goals', () => {
    setupStore({ distance: 25 });
    const { container } = render(<GoalsSectionIsland />);

    // Should have completed goals (last 3: only 2 completed so both show)
    const completedItems = container.querySelectorAll('.completed-goal');
    expect(completedItems.length).toBe(2);

    // Should have upcoming goals
    expect(container.querySelector('#next-goal-mount')).not.toBeNull();
  });

  it('renders toggle buttons for completed goals', () => {
    setupStore({ distance: 25 });
    render(<GoalsSectionIsland />);

    const hideBtn = document.getElementById('toggle-completed-visibility');
    const showAllBtn = document.getElementById('toggle-completed');

    expect(hideBtn).not.toBeNull();
    expect(showAllBtn).not.toBeNull();
    expect(hideBtn!.textContent).toBe('Hide Completed');
    expect(showAllBtn!.textContent).toBe('Show All Completed');
  });

  it('toggles completed visibility', async () => {
    setupStore({ distance: 25 });
    render(<GoalsSectionIsland />);

    const hideBtn = document.getElementById('toggle-completed-visibility')!;
    const wrapper = document.getElementById('completed-goals-wrapper')!;

    expect(wrapper.style.display).toBe('block');

    fireEvent.click(hideBtn);
    expect(wrapper.style.display).toBe('none');
    expect(hideBtn.textContent).toBe('Show Completed');

    fireEvent.click(hideBtn);
    expect(wrapper.style.display).toBe('block');
    expect(hideBtn.textContent).toBe('Hide Completed');
  });

  it('toggles between last 3 and all completed', () => {
    setupStore({ distance: 60 }); // 4 completed goals
    render(<GoalsSectionIsland />);

    const toggleBtn = document.getElementById('toggle-completed')!;
    const last3List = document.getElementById('completed-goals')!;
    const allList = document.getElementById('all-completed-goals')!;

    expect(last3List.style.display).toBe('block');
    expect(allList.style.display).toBe('none');

    fireEvent.click(toggleBtn);
    expect(last3List.style.display).toBe('none');
    expect(allList.style.display).toBe('block');
    expect(toggleBtn.textContent).toBe('Show Last 3 Completed');
  });

  it('renders error state with retry button', () => {
    setupStore({ errorState: 'Server error loading goals' });
    render(<GoalsSectionIsland />);

    expect(screen.getByText('⚠️ Unable to load goals')).not.toBeNull();
    expect(screen.getByText('Retry')).not.toBeNull();
  });

  it('renders next goal with goal-next-target class', () => {
    setupStore({ distance: 25 });
    const { container } = render(<GoalsSectionIsland />);

    const nextGoalMount = container.querySelector('#next-goal-mount');
    expect(nextGoalMount).not.toBeNull();

    const targetEl = container.querySelector('.goal-next-target');
    expect(targetEl).not.toBeNull();
  });

  it('applies goal-locked class when preference is off', () => {
    setupStore({ distance: 25, prefUnlocked: false });
    const { container } = render(<GoalsSectionIsland />);

    const lockedEls = container.querySelectorAll('.goal-locked');
    expect(lockedEls.length).toBeGreaterThan(0);
  });

  it('opens GoalModal when completed goal is clicked', () => {
    setupStore({ distance: 25 });
    const { container } = render(<GoalsSectionIsland />);

    const completedGoal = container.querySelector('.completed-goal');
    expect(completedGoal).not.toBeNull();

    fireEvent.click(completedGoal!);

    // GoalModal should be mounted
    const modalContainer = document.getElementById('goal-modal-container');
    expect(modalContainer).not.toBeNull();
  });

  it('exposes window.goalsModule', () => {
    render(<GoalsSectionIsland />);

    expect(window.goalsModule).toBeDefined();
    expect(typeof window.goalsModule.showGoalModal).toBe('function');
    expect(typeof window.goalsModule.renderGoals).toBe('function');
    expect(typeof window.goalsModule.checkForNewlyPassedGoals).toBe('function');
    expect(typeof window.goalsModule.makeGoalClickable).toBe('function');
  });

  it('updates #last-goal header when completed goals exist', () => {
    setupStore({ distance: 25 });
    render(<GoalsSectionIsland />);

    const lastGoalEl = document.getElementById('last-goal')!;
    expect(lastGoalEl.innerHTML).toContain('Bucklebury Ferry');
  });

  it('renders all-completed-goal items in the all list', () => {
    setupStore({ distance: 60 }); // 4 goals completed
    const { container } = render(<GoalsSectionIsland />);

    const allItems = container.querySelectorAll('.all-completed-goal');
    expect(allItems.length).toBe(4);
  });

  it('renders upcoming goal cards for goals beyond next', () => {
    setupStore({ distance: 25 });
    const { container } = render(<GoalsSectionIsland />);

    // Upcoming: Bree (next), Weathertop, Rivendell
    // Remaining upcoming mounts: index 1 and 2
    const mount1 = container.querySelector('#upcoming-goal-mount-1');
    const mount2 = container.querySelector('#upcoming-goal-mount-2');
    expect(mount1).not.toBeNull();
    expect(mount2).not.toBeNull();
  });

  it('responds to preferenceChanged event', async () => {
    setupStore({ distance: 25 });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => sampleGoals,
    });

    render(<GoalsSectionIsland />);

    window.userPreferences = { showFutureGoalsUnlocked: false };
    window.dispatchEvent(new CustomEvent('preferenceChanged'));

    // Wait for async fetchGoals
    await vi.waitFor(() => {
      expect(showFutureGoalsUnlocked.value).toBe(false);
    });
  });
});
