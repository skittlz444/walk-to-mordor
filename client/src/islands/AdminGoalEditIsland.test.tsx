import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, fireEvent, screen } from '@testing-library/preact';
import { AdminGoalEditIsland } from './AdminGoalEditIsland';

const mockFetch = vi.fn();
let savedLocation: Location;

const mockGoalResponse = {
  id: 1,
  title: 'Rivendell',
  distance: 160.934,
  description: 'The Last Homely House.',
  special: null,
  image_id: 'rivendell',
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', mockFetch);
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => (key === 'sessionToken' ? 'admin-token' : null)),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  savedLocation = window.location;
  Object.defineProperty(window, 'location', {
    value: { href: '', pathname: '/admin/goals/1' },
    writable: true,
    configurable: true,
  });
  // Default: goal fetch succeeds
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve(mockGoalResponse),
  });
});

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: savedLocation,
    writable: true,
    configurable: true,
  });
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Wait for the initial goal load to complete (loading spinner disappears). */
async function waitForGoalLoaded(container: Element) {
  await waitFor(() => {
    expect(container.querySelector('.admin-loading')).toBeNull();
  });
}

describe('AdminGoalEditIsland', () => {
  it('renders the Edit Goal heading after loading', async () => {
    const { container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);
    expect(container.querySelector('h2')?.textContent).toContain('Edit Goal');
  });

  it('populates the distance field with the loaded value (multi-decimal km)', async () => {
    const { container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    const distInput = container.querySelector('#goal-distance') as HTMLInputElement;
    expect(distInput.value).toBe('160.934');
  });

  it('accepts a multi-decimal km distance (e.g. 160.934) without a validation error', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGoalResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...mockGoalResponse, distance: 160.934 }),
      });

    const { container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    // Submit with the pre-filled multi-decimal distance
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#distance-error')).toBeNull();
    });
  });

  it('shows validation error when distance is empty on submit', async () => {
    const { getByText, container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });
  });

  it('shows validation error when distance is zero', async () => {
    const { getByText, container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '0' },
    });

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });
  });

  it('shows validation error and does not clear it when distance is Infinity', async () => {
    const { getByText, container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    // First clear the distance to trigger the error
    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '' },
    });
    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });

    // Enter "Infinity" — isNaN(Infinity) is false and Infinity > 0 is true,
    // but !isFinite(Infinity) must catch it and keep the error
    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: 'Infinity' },
    });

    await waitFor(() => {
      expect(getByText('Distance must be a positive number')).toBeTruthy();
    });

    // Entering a real positive decimal clears the error
    fireEvent.input(container.querySelector('#goal-distance') as HTMLInputElement, {
      target: { value: '160.934' },
    });

    await waitFor(() => {
      expect(container.querySelector('#distance-error')).toBeNull();
    });
  });

  it('PUTs to /api/admin/goals/:id and shows success toast on valid submit', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGoalResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ ...mockGoalResponse, title: 'Updated Rivendell' }),
      });

    const { getByText, container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText(/Goal updated successfully/)).toBeTruthy();
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/admin/goals/1',
      expect.objectContaining({
        method: 'PUT',
        headers: expect.objectContaining({ Authorization: 'Bearer admin-token' }),
      }),
    );
  });

  it('shows error toast when PUT returns an error', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockGoalResponse),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ entries: [] }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Invalid distance' }),
      });

    const { getByText, container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => {
      expect(getByText('Invalid distance')).toBeTruthy();
    });
  });

  it('redirects to /login when goal fetch returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    render(<AdminGoalEditIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/login');
    });
  });

  it('redirects to /journey when goal fetch returns 403', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: () => Promise.resolve({}),
    });

    render(<AdminGoalEditIsland />);

    await waitFor(() => {
      expect(window.location.href).toBe('/journey');
    });
  });

  it('shows not-found state when goal fetch returns 404', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({}),
    });

    const { container } = render(<AdminGoalEditIsland />);

    await waitFor(() => {
      expect(container.querySelector('h2')?.textContent).toContain('Goal Not Found');
    });
  });

  it('distance input has step="any" to allow arbitrary decimal values', async () => {
    const { container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    const distInput = container.querySelector('#goal-distance') as HTMLInputElement;
    expect(distInput.step).toBe('any');
  });

  it('renders sanitized Markdown preview for goal content body', async () => {
    const { container } = render(<AdminGoalEditIsland />);
    await waitForGoalLoaded(container);

    fireEvent.input(container.querySelector('#new-content-title') as HTMLInputElement, {
      target: { value: 'Campfire tale' },
    });
    fireEvent.input(container.querySelector('#new-content-body') as HTMLTextAreaElement, {
      target: { value: '**Bold** <img src=x onerror="alert(1)">' },
    });

    const previewButtons = screen.getAllByText('Preview');
    fireEvent.click(previewButtons[previewButtons.length - 1]);

    await waitFor(() => {
      const preview = container.querySelector('.admin-goal-content__create .admin-goal-content-preview') as HTMLElement;
      expect(preview.querySelector('strong')?.textContent).toBe('Bold');
      expect(preview.innerHTML).not.toContain('onerror');
    });
  });
});
