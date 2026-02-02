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
    expect(highResImages[0].src).toContain('/img/thumbs/1-thumb.webp');
    expect(highResImages[1].src).toContain('/img/highres/1.webp');
  });

  it('renders placeholder image when image_id is null', () => {
    const goalWithoutImage = { ...mockGoal, image_id: null };
    
    render(
      <GoalModal
        goal={goalWithoutImage}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    // Should render images with placeholder (id='0') in webp format first
    const images = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    expect(images.length).toBe(2);
    expect(images[0].src).toContain('/img/thumbs/0-thumb.webp');
    expect(images[1].src).toContain('/img/highres/0.webp');
  });

  it('falls back to .jpg when .webp fails to load', () => {
    const goalWithWebpUnavailable = { ...mockGoal, image_id: '999' };
    
    render(
      <GoalModal
        goal={goalWithWebpUnavailable}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const images = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    
    // Initially loads .webp
    expect(images[0].src).toContain('/img/thumbs/999-thumb.webp');
    expect(images[1].src).toContain('/img/highres/999.webp');
    
    // Trigger error on thumbnail - should try .jpg
    const thumbImage = images[0];
    const errorEvent = new Event('error');
    thumbImage.dispatchEvent(errorEvent);
    expect(thumbImage.src).toContain('/img/thumbs/999-thumb.jpg');
    
    // Trigger error on high-res - should try .jpg
    const highResImage = images[1];
    highResImage.dispatchEvent(errorEvent);
    expect(highResImage.src).toContain('/img/highres/999.jpg');
  });

  it('falls back to placeholder when both .webp and .jpg fail to load', () => {
    const goalWithBadImage = { ...mockGoal, image_id: '999' };
    
    render(
      <GoalModal
        goal={goalWithBadImage}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    const images = screen.getAllByAltText('Goal image') as HTMLImageElement[];
    
    // Trigger first error on thumbnail (.webp fails, tries .jpg)
    const thumbImage = images[0];
    const errorEvent = new Event('error');
    thumbImage.dispatchEvent(errorEvent);
    expect(thumbImage.src).toContain('/img/thumbs/999-thumb.jpg');
    
    // Trigger second error on thumbnail (.jpg fails, goes to placeholder)
    thumbImage.dispatchEvent(errorEvent);
    expect(thumbImage.src).toContain('/img/thumbs/0-thumb.webp');
    
    // Trigger first error on high-res (.webp fails, tries .jpg)
    const highResImage = images[1];
    highResImage.dispatchEvent(errorEvent);
    expect(highResImage.src).toContain('/img/highres/999.jpg');
    
    // Trigger second error on high-res (.jpg fails, goes to placeholder)
    highResImage.dispatchEvent(errorEvent);
    expect(highResImage.src).toContain('/img/highres/0.webp');
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

  it('calls onClose when Escape key is pressed', () => {
    render(
      <GoalModal
        goal={mockGoal}
        currentDistance={50}
        isCongratulations={false}
        onClose={mockOnClose}
      />
    );

    // Simulate Escape key press
    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escapeEvent);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
