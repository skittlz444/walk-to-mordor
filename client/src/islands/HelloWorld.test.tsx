import { render, fireEvent, screen } from '@testing-library/preact';
import { describe, it, expect } from 'vitest';
import { HelloWorld } from './HelloWorld';

describe('HelloWorld Island', () => {
  it('renders correctly', () => {
    render(<HelloWorld />);
    expect(screen.getByText(/Preact Island: HelloWorld/i)).toBeTruthy();
  });

  it('increments counter when button is clicked', async () => {
    // Render the component
    render(<HelloWorld />);
    
    // Check initial state
    expect(screen.getByText(/Counter Signal:/i).parentElement?.textContent).toContain('0');
    
    // Click the button
    const button = screen.getByRole('button', { name: /Increment/i });
    await fireEvent.click(button);
    
    // Check updated state
    expect(screen.getByText(/Counter Signal:/i).parentElement?.textContent).toContain('1');
  });

  it('toggles local signal correctly', async () => {
    render(<HelloWorld />);
    
    // Initial state: OFF
    expect(screen.getByText(/Toggle Signal:/i).parentElement?.textContent).toContain('❌ OFF');
    
    // Click toggle
    const toggleBtn = screen.getByRole('button', { name: /Toggle/i });
    await fireEvent.click(toggleBtn);
    
    // Updated state: ON
    expect(screen.getByText(/Toggle Signal:/i).parentElement?.textContent).toContain('✅ ON');
  });
});
