import { render, screen, fireEvent, waitFor } from '@testing-library/preact';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProfileModalIsland } from './ProfileModalIsland';

function mockFetchResponses(responses: Array<{ ok: boolean; data: Record<string, unknown> }>) {
  const queue = [...responses];
  return vi.fn(() => {
    const resp = queue.shift() || { ok: true, data: {} };
    return Promise.resolve({
      ok: resp.ok,
      json: () => Promise.resolve(resp.data),
    });
  });
}

describe('ProfileModalIsland', () => {
  const mockOnClose = vi.fn();
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    mockOnClose.mockClear();
    originalFetch = globalThis.fetch;

    // Set up window globals
    window.getAuthHeaders = vi.fn(() => ({ Authorization: 'Bearer test' }));
    window.logout = vi.fn();
    window.userPreferences = {};
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders form with user data from API', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com', showFutureGoalsUnlocked: true, defaultViewMap: false } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    await waitFor(() => {
      const usernameInput = document.getElementById('profile-username') as HTMLInputElement;
      expect(usernameInput.value).toBe('testuser');
    });

    const emailInput = document.getElementById('profile-email') as HTMLInputElement;
    expect(emailInput.value).toBe('test@example.com');

    const milestonesToggle = document.getElementById('preview-milestones-toggle') as HTMLInputElement;
    expect(milestonesToggle.checked).toBe(true);

    const defaultViewToggle = document.getElementById('default-view-toggle') as HTMLInputElement;
    expect(defaultViewToggle.checked).toBe(false);
  });

  it('save profile success', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com' } },
      { ok: true, data: { message: 'Profile updated successfully!' } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    await waitFor(() => {
      expect((document.getElementById('profile-username') as HTMLInputElement).value).toBe('testuser');
    });

    const saveBtn = document.getElementById('save-profile-btn') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Profile updated successfully!')).toBeTruthy();
    });
  });

  it('save profile error', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com' } },
      { ok: false, data: { error: 'Username already taken' } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    await waitFor(() => {
      expect((document.getElementById('profile-username') as HTMLInputElement).value).toBe('testuser');
    });

    const saveBtn = document.getElementById('save-profile-btn') as HTMLButtonElement;
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(screen.getByText('Username already taken')).toBeTruthy();
    });
  });

  it('preference toggle saves immediately', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com', showFutureGoalsUnlocked: true, defaultViewMap: false } },
      { ok: true, data: {} },
    ]) as unknown as typeof fetch;

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    render(<ProfileModalIsland onClose={mockOnClose} />);

    await waitFor(() => {
      expect((document.getElementById('preview-milestones-toggle') as HTMLInputElement).checked).toBe(true);
    });

    const toggle = document.getElementById('preview-milestones-toggle') as HTMLInputElement;
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    });

    // Verify the preference API was called with correct data
    const lastCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(lastCall[0]).toBe('/api/user/preferences');
    expect(JSON.parse(lastCall[1].body)).toEqual({ showFutureGoalsUnlocked: false });

    // Verify event was dispatched
    await waitFor(() => {
      const prefEvents = dispatchSpy.mock.calls.filter(
        (call) => call[0] instanceof CustomEvent && (call[0] as CustomEvent).type === 'preferenceChanged'
      );
      expect(prefEvents.length).toBeGreaterThan(0);
    });

    dispatchSpy.mockRestore();
  });

  it('preference save shows status messages', async () => {
    let resolvePreference: (value: unknown) => void;
    const prefPromise = new Promise((resolve) => { resolvePreference = resolve; });

    const fetchMock = vi.fn((url: string) => {
      if (url === '/api/session') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ username: 'testuser', email: 'test@example.com', showFutureGoalsUnlocked: true, defaultViewMap: false }),
        });
      }
      // For preference save, delay resolution
      return prefPromise.then(() => ({
        ok: true,
        json: () => Promise.resolve({}),
      }));
    });

    globalThis.fetch = fetchMock as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    await waitFor(() => {
      expect((document.getElementById('preview-milestones-toggle') as HTMLInputElement).checked).toBe(true);
    });

    const toggle = document.getElementById('preview-milestones-toggle') as HTMLInputElement;
    fireEvent.click(toggle);

    // Should show "Saving..."
    await waitFor(() => {
      const statusDiv = document.getElementById('preference-status');
      expect(statusDiv?.textContent).toBe('Saving...');
    });

    // Resolve the preference save
    resolvePreference!(undefined);

    // Should show "Saved"
    await waitFor(() => {
      const statusDiv = document.getElementById('preference-status');
      expect(statusDiv?.textContent).toBe('Saved');
    });
  });

  it('preference error reverts toggle', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com', showFutureGoalsUnlocked: true, defaultViewMap: false } },
      { ok: false, data: { error: 'Server error' } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    await waitFor(() => {
      expect((document.getElementById('preview-milestones-toggle') as HTMLInputElement).checked).toBe(true);
    });

    const toggle = document.getElementById('preview-milestones-toggle') as HTMLInputElement;
    fireEvent.click(toggle);

    // Toggle should revert to original value
    await waitFor(() => {
      expect(toggle.checked).toBe(true);
    });

    // Status should show error
    const statusDiv = document.getElementById('preference-status');
    expect(statusDiv?.textContent).toBe('Server error');
  });

  it('ESC closes modal', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com' } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(escapeEvent);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('backdrop click closes modal', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com' } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    const overlay = document.querySelector('.modal-overlay') as HTMLElement;
    fireEvent.click(overlay);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('logout calls window.logout', async () => {
    globalThis.fetch = mockFetchResponses([
      { ok: true, data: { username: 'testuser', email: 'test@example.com' } },
    ]) as unknown as typeof fetch;

    render(<ProfileModalIsland onClose={mockOnClose} />);

    const logoutBtn = document.getElementById('logout-modal-btn') as HTMLButtonElement;
    fireEvent.click(logoutBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(window.logout).toHaveBeenCalledTimes(1);
  });
});
