import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/preact';
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

  it('calls onSave with parsed distance', () => {
    const onSave = vi.fn();
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue="5.5"
        isEdit={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(container.querySelector('#save-btn')!);
    expect(onSave).toHaveBeenCalledWith(5.5);
  });

  it('calls onDelete when delete button clicked', () => {
    const onDelete = vi.fn();
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue="10"
        isEdit={true}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(container.querySelector('#delete-btn')!);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue=""
        isEdit={false}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(container.querySelector('#cancel-btn')!);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('quick-add +1 increments distance by 1', () => {
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue="2"
        isEdit={false}
      />,
    );

    fireEvent.click(container.querySelector('#quick-add-1')!);
    const input = container.querySelector('#distance-input') as HTMLInputElement;
    expect(input.value).toBe('3.00');
  });

  it('quick-add +5 increments distance by 5', () => {
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue="1"
        isEdit={false}
      />,
    );

    fireEvent.click(container.querySelector('#quick-add-5')!);
    const input = container.querySelector('#distance-input') as HTMLInputElement;
    expect(input.value).toBe('6.00');
  });

  it('quick-reset sets distance to 0.00', () => {
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue="10"
        isEdit={false}
      />,
    );

    fireEvent.click(container.querySelector('#quick-reset')!);
    const input = container.querySelector('#distance-input') as HTMLInputElement;
    expect(input.value).toBe('0.00');
  });

  it('alerts on invalid distance and does not call onSave', () => {
    const onSave = vi.fn();
    window.alert = vi.fn();
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue=""
        isEdit={false}
        onSave={onSave}
      />,
    );

    fireEvent.click(container.querySelector('#save-btn')!);
    expect(window.alert).toHaveBeenCalledWith('Please enter a valid distance');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('preserves CSS classes and IDs for test compatibility', () => {
    const { container } = render(
      <DistanceModal
        selectedDate="2026-02-23"
        distanceValue=""
        isEdit={true}
      />,
    );

    expect(container.querySelector('.modal-dialog')).toBeTruthy();
    expect(container.querySelector('.modal-content')).toBeTruthy();
    expect(container.querySelector('.modal-body')).toBeTruthy();
    expect(container.querySelector('.modal-footer')).toBeTruthy();
    expect(container.querySelector('.quick-entry-group')).toBeTruthy();
    expect(container.querySelector('.quick-btn')).toBeTruthy();
    expect(container.querySelector('.input-with-suffix')).toBeTruthy();
    expect(container.querySelector('.km-suffix')).toBeTruthy();
  });
});
