import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/preact';
import { NextGoalCard } from './NextGoalCard';

describe('NextGoalCard', () => {
  const mockGoal = {
    id: 1,
    distance: 100,
    title: 'Weathertop',
    special: 'Amon Sûl',
    description: 'Ancient watchtower',
    image_id: 'test-image'
  };

  it('renders goal information correctly', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    // Check for special name
    expect(container.textContent).toContain('Amon Sûl');
    // Check for goal title
    expect(container.textContent).toContain('Weathertop');
    // Check for distance
    expect(container.textContent).toContain('100.00 km');
    // Check for distance to go
    expect(container.textContent).toContain('25.00 km to go');
  });

  it('calculates segment progress correctly', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    // Segment: 50km -> 100km (50km total)
    // Current: 75km
    // Progress: (75-50)/(100-50) = 25/50 = 50%
    const progressFill = container.querySelector('.goal-progress-fill');
    expect(progressFill?.getAttribute('style')).toContain('width: 50.0%');
  });

  it('handles edge case: at start of segment (0% progress)', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={50}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    const progressFill = container.querySelector('.goal-progress-fill');
    expect(progressFill?.getAttribute('style')).toContain('width: 0.0%');
  });

  it('handles edge case: nearly complete segment (95% progress)', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={97.5}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    // (97.5-50)/(100-50) = 47.5/50 = 95%
    const progressFill = container.querySelector('.goal-progress-fill');
    expect(progressFill?.getAttribute('style')).toContain('width: 95.0%');
  });

  it('applies next-goal class for styling', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    const card = container.querySelector('.upcoming-goal.next-goal');
    expect(card).toBeTruthy();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        onClick={handleClick}
      />
    );

    const card = container.querySelector('.upcoming-goal.next-goal');
    card?.click();
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders without special name if not provided', () => {
    const goalWithoutSpecial = { ...mockGoal, special: null };
    const { container } = render(
      <NextGoalCard
        goal={goalWithoutSpecial}
        currentDistance={75}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    // Should still render title
    expect(container.textContent).toContain('Weathertop');
    // Should not have special name span
    expect(container.textContent).not.toContain('Amon Sûl');
  });

  it('handles first goal (previousDistance = 0)', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={25}
        previousDistance={0}
        onClick={() => {}}
      />
    );

    // Progress: (25-0)/(100-0) = 25/100 = 25%
    const progressFill = container.querySelector('.goal-progress-fill');
    expect(progressFill?.getAttribute('style')).toContain('width: 25.0%');
  });

  it('includes progress bar elements', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    const progressTrack = container.querySelector('.goal-progress-track');
    const progressFill = container.querySelector('.goal-progress-fill');
    
    expect(progressTrack).toBeTruthy();
    expect(progressFill).toBeTruthy();
  });

  // --- Story 9.1: Locked Milestone Card Previews ---

  it('locked=true applies goal-locked-interactive class', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        locked={true}
        onClick={() => {}}
      />
    );

    const card = container.querySelector('.upcoming-goal.next-goal.goal-locked-interactive');
    expect(card).toBeTruthy();
  });

  it('locked=true shows lock icon', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
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
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        locked={true}
        onClick={handleClick}
      />
    );

    const card = container.querySelector('.upcoming-goal.next-goal');
    card?.click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('locked=false (default) has no lock icon', () => {
    const { container } = render(
      <NextGoalCard
        goal={mockGoal}
        currentDistance={75}
        previousDistance={50}
        onClick={() => {}}
      />
    );

    const lockIcon = container.querySelector('.fas.fa-lock');
    expect(lockIcon).toBeNull();
  });
});
