import { render, screen } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoalModal } from './GoalModal';

describe('GoalModal', () => {
  const mockGoal = {
    id: 1,
    distance: 100.5,
    title: 'Test Goal',
    special: null,
    description: 'A test goal description',
    image_id: '1',
  };

  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders modal with goal information', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Goal')).toBeTruthy();
    expect(screen.getByText('100.50 km')).toBeTruthy();
    expect(screen.getByText('50.50 km to go')).toBeTruthy();
    expect(screen.getByText('A test goal description')).toBeTruthy();
  });

  it('shows congratulations message when isCongratulations is true', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={true}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText(/Congratulations! You've passed a new goal!/)).toBeTruthy();
  });

  it('displays special text when goal has special field', () => {
    const specialGoal = { ...mockGoal, special: 'Special Achievement!' };
    
    render(
      <GoalModal
        goal={specialGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Special Achievement!')).toBeTruthy();
  });

  it('applies strikethrough style for completed goals', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const distanceElement = screen.getByText('100.50 km');
    expect(distanceElement.getAttribute('style')).toContain('text-decoration: line-through');
  });

  it('does not show "to go" text for completed goals', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={150}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText(/km to go/)).toBeFalsy();
  });

  it('renders images with correct src paths', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const highResImages = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    expect(highResImages[0].src).toContain('/img/thumbs/1-thumb.jpg');
    expect(highResImages[1].src).toContain('/img/highres/1.jpg');
  });

  it('does not render images when image_id is null', () => {
    const goalWithoutImage = { ...mockGoal, image_id: null };
    
    render(
      <GoalModal
        goal={goalWithoutImage}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByAltText('Goal image')).toBeFalsy();
  });

  it('calls onClose when Close button is clicked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByText('Close');
    closeButton.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when overlay is clicked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    overlay.click();

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when modal content is clicked', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const modalContent = document.querySelector('.modal-content') as HTMLElement;
    modalContent.click();

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('handles goals without description', () => {
    const goalWithoutDescription = { ...mockGoal, description: null };
    
    render(
      <GoalModal
        goal={goalWithoutDescription}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Test Goal')).toBeTruthy();
    expect(screen.queryByText('A test goal description')).toBeFalsy();
  });

  it('calculates distance to go correctly', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={30.25}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('70.25 km to go')).toBeTruthy();
  });

  it('applies correct gold color for non-completed goals', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const distanceElement = screen.getByText('100.50 km');
    expect(distanceElement.getAttribute('style')).toContain('color: #FFD700');
  });
});
