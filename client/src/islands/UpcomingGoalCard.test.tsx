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

    const card = container.querySelector('.upcoming-goal');
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

    const card = container.querySelector('.upcoming-goal');
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
    const { container } = render(
      <UpcomingGoalCard
        goal={mockGoal}
        currentDistance={50.555}
        onClick={() => {}}
      />
    );

    // Distance should show 2 decimal places
    expect(container.textContent).toContain('200.00 km');
    // Distance to go should also show 2 decimal places (200 - 50.555 = 149.445 -> 149.44)
    expect(container.textContent).toContain('149.44 km to go');
  });
});
