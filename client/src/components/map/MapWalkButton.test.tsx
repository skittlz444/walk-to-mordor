/**
 * MapWalkButton Unit Tests
 *
 * @see Story 2.8 - Map Walk Logging
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { MapWalkButton } from './MapWalkButton';

describe('MapWalkButton', () => {
  describe('Rendering', () => {
    it('renders FAB with walking icon by default', () => {
      render(<MapWalkButton onClick={() => {}} />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      expect(button).toBeTruthy();
      
      // Should have SVG icon
      const svg = button.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('renders with calendar icon when configured', () => {
      render(<MapWalkButton onClick={() => {}} icon="calendar" />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      const svg = button.querySelector('svg');
      expect(svg).toBeTruthy();
      // Calendar icon has a different path structure
      expect(svg?.innerHTML).toContain('path');
    });

    it('renders with plus icon when configured', () => {
      render(<MapWalkButton onClick={() => {}} icon="plus" />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      const svg = button.querySelector('svg');
      expect(svg).toBeTruthy();
    });

    it('applies additional className when provided', () => {
      render(<MapWalkButton onClick={() => {}} className="custom-class" />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      expect(button.className).toContain('map-walk-button');
      expect(button.className).toContain('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('has correct aria-label', () => {
      render(<MapWalkButton onClick={() => {}} />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      expect(button.getAttribute('aria-label')).toBe('Log a walk');
    });

    it('is a button element', () => {
      render(<MapWalkButton onClick={() => {}} />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      expect(button.tagName).toBe('BUTTON');
      expect(button.getAttribute('type')).toBe('button');
    });

    it('svg icons are hidden from assistive technology', () => {
      render(<MapWalkButton onClick={() => {}} />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      const svg = button.querySelector('svg');
      expect(svg?.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', () => {
      const handleClick = vi.fn();
      render(<MapWalkButton onClick={handleClick} />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not call onClick when not clicked', () => {
      const handleClick = vi.fn();
      render(<MapWalkButton onClick={handleClick} />);
      
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('Touch target size', () => {
    it('has map-walk-button class for CSS touch target sizing', () => {
      render(<MapWalkButton onClick={() => {}} />);
      
      const button = screen.getByRole('button', { name: 'Log a walk' });
      expect(button.className).toContain('map-walk-button');
      // CSS enforces min-width: 48px and min-height: 48px
    });
  });
});
