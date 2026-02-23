import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/preact';
import { DistanceModal } from './DistanceModal';

describe('DistanceModal', () => {
  it('renders add state controls', () => {
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue=""
        isEdit={false}
      />,
    );

    expect(container.querySelector('#distance-input')).toBeTruthy();
    expect(container.querySelector('#quick-add-1')?.textContent).toBe('+1 km');
    expect(container.querySelector('#quick-add-5')?.textContent).toBe('+5 km');
    expect(container.querySelector('#quick-reset')?.textContent).toBe('Reset');
    expect(container.querySelector('#save-btn')?.textContent).toBe('Add');
    expect(container.querySelector('#delete-btn')).toBeNull();
  });

  it('renders edit state controls', () => {
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue="12.34"
        isEdit={true}
      />,
    );

    expect(container.querySelector('#save-btn')?.textContent).toBe('Save');
    expect(container.querySelector('#delete-btn')?.textContent).toBe('Delete');
  });
});
