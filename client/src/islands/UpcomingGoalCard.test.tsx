import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { UpcomingGoalCard } from './UpcomingGoalCard';

describe('UpcomingGoalCard', () => {
  const mockGoal = {
    id: 2,
    distance: 200,
    title: 'Rivendell',
    special: 'Imladris',
    description: 'The Last Homely House',
    image_id: 'test-image'
  };

  it('renders goal information correctly', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    // Check for special name
    expect(container.textContent).toContain('Imladris');
    // Check for goal title
    expect(container.textContent).toContain('Rivendell');
    // Check for distance
    expect(container.textContent).toContain('200.00 km');
    // Check for distance to go
    expect(container.textContent).toContain('150.00 km to go');
  });

  it('calculates distance to go correctly', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={75}
        onClick={() => {}}
      />
    );

    // Distance to go: 200 - 75 = 125 km
    expect(container.textContent).toContain('125.00 km to go');
  });

  it('handles near completion correctly', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={195}
        onClick={() => {}}
      />
    );

    // Distance to go: 200 - 195 = 5 km
    expect(container.textContent).toContain('5.00 km to go');
  });

  it('applies upcoming-goal class for styling', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    const card = container.querySelector('.upcoming-goal') as HTMLElement | null;
    expect(card).toBeTruthy();
  });

  it('does not have next-goal class', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    const card = container.querySelector('.next-goal');
    expect(card).toBeFalsy();
  });

  it('does not render progress bar', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    const progressTrack = container.querySelector('.goal-progress-track');
    const progressFill = container.querySelector('.goal-progress-fill');

    expect(progressTrack).toBeFalsy();
    expect(progressFill).toBeFalsy();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        onClick={handleClick}
      />
    );

    const card = container.querySelector('.upcoming-goal') as HTMLElement | null;
    card?.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders without special name if not provided', () => {
    const goalWithoutSpecial = { ...mockGoal, special: null };
    const { container } = render(
      <UpcomingGoalCard
        goal={goalWithoutSpecial}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    // Should still render title
    expect(container.textContent).toContain('Rivendell');
    // Should not have special name span
    expect(container.textContent).not.toContain('Imladris');
  });

  it('handles very large distances', () => {
    const distantGoal = { ...mockGoal, distance: 1000 };
    const { container } = render(
      <UpcomingGoalCard
        goal={distantGoal}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    expect(container.textContent).toContain('1000.00 km');
    expect(container.textContent).toContain('950.00 km to go');
  });

  it('handles zero current distance', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={0}
        onClick={() => {}}
      />
    );

    expect(container.textContent).toContain('200.00 km to go');
  });

  it('formats decimals consistently', () => {
    const currentDistance = 50.555;
    const expectedRemaining = (mockGoal.distance - currentDistance).toFixed(2);

    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={currentDistance}
        onClick={() => {}}
      />
    );

    // Distance should show 2 decimal places
    expect(container.textContent).toContain('200.00 km');
    // Distance to go should also show 2 decimal places using the same rounding logic as the component
    expect(container.textContent).toContain(`${expectedRemaining} km to go`);
  });

  // --- Story 9.1: Locked Milestone Card Previews ---

  it('locked=true adds goal-locked-interactive class', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        locked={true}
        onClick={() => {}}
      />
    );

    const card = container.querySelector('.goal-locked-interactive');
    expect(card).toBeTruthy();
  });

  it('locked=true shows lock icon', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        locked={true}
        onClick={() => {}}
      />
    );

    const lockIcon = container.querySelector('.fas.fa-lock');
    expect(lockIcon).toBeTruthy();
  });

  it('locked=true card is still clickable', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        locked={true}
        onClick={handleClick}
      />
    );

    const card = container.querySelector('.upcoming-goal') as HTMLElement | null;
    card?.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('locked=false (default) has no lock styling', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50}
        onClick={() => {}}
      />
    );

    const lockedCard = container.querySelector('.goal-locked-interactive');
    expect(lockedCard).toBeNull();

    const lockIcon = container.querySelector('.fas.fa-lock');
    expect(lockIcon).toBeNull();
  });

  it('locked goal with has_content=true shows lore teaser', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={{ ...mockGoal, has_content: true }}
        currentDistance={50}
        locked={true}
        onClick={() => {}}
      />
    );

    expect(container.textContent).toContain('Campfire lore waits beyond this milestone');
    expect(container.querySelector('.goal-content-teaser')).toBeTruthy();
  });

  it('locked goal without content does not show lore teaser', () => {
    const { container } = render(
      <UpcomingGoalCard
        goal={{ ...mockGoal, has_content: false }}
        currentDistance={50}
        locked={true}
        onClick={() => {}}
      />
    );

    expect(container.textContent).not.toContain('Campfire lore waits beyond this milestone');
    expect(container.querySelector('.goal-content-teaser')).toBeNull();
  });
});
