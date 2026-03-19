import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor } from '@testing-library/preact';
import { ProfileIsland } from './ProfileIsland';

const mockFetch = vi.fn();
const mockServiceWorkerPostMessage = vi.fn();

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.stubGlobal('fetch', mockFetch);
  Object.defineProperty(navigator, 'serviceWorker', {
    value: {
      controller: {
        postMessage: mockServiceWorkerPostMessage,
      },
    },
    configurable: true,
  });

  const store: Record<string, string> = { sessionToken: 'test-token' };
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
  });

  Object.defineProperty(window, 'location', {
    value: { href: '/profile', origin: 'http://localhost', pathname: '/profile' },
    writable: true,
    configurable: true,
  });

  mockFetch.mockReset();
  mockServiceWorkerPostMessage.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  cleanup();
});

function mockSessionAndAvatars(
  session: { username?: string; email?: string; showFutureGoalsUnlocked?: boolean; defaultViewMap?: boolean; avatarId?: string | null } = {},
  avatars: string[] = []
) {
  mockFetch
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        username: 'testuser',
        email: 'test@example.com',
        showFutureGoalsUnlocked: true,
        defaultViewMap: false,
        avatarId: null,
        ...session,
      }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(avatars),
    });
}

describe('ProfileIsland', () => {
  describe('loading state', () => {
    it('shows loading message initially', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<ProfileIsland />);
      expect(container.textContent).toContain('Loading profile');
    });
  });

  describe('loaded state', () => {
    it('renders profile form with session data', async () => {
      mockSessionAndAvatars({ username: 'hobbit', email: 'frodo@shire.com' });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        const usernameInput = container.querySelector('#profile-username') as HTMLInputElement;
        expect(usernameInput).toBeTruthy();
        expect(usernameInput.value).toBe('hobbit');
      });

      const emailInput = container.querySelector('#profile-email') as HTMLInputElement;
      expect(emailInput.value).toBe('frodo@shire.com');
    });

    it('renders save, logout, and back buttons', async () => {
      mockSessionAndAvatars();
      const { getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(getByText('Save Changes')).toBeTruthy();
      });
      expect(getByText('Logout')).toBeTruthy();
      expect(getByText('Back')).toBeTruthy();
    });

    it('renders toggle switches for preferences', async () => {
      mockSessionAndAvatars({ showFutureGoalsUnlocked: true, defaultViewMap: false });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        const previewToggle = container.querySelector('#preview-milestones-toggle') as HTMLInputElement;
        expect(previewToggle).toBeTruthy();
        expect(previewToggle.checked).toBe(true);
      });

      const mapToggle = container.querySelector('#default-view-toggle') as HTMLInputElement;
      expect(mapToggle.checked).toBe(false);
    });

    it('renders avatar gallery when avatars are available', async () => {
      mockSessionAndAvatars({}, ['aragorn', 'gandalf', 'legolas']);
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        const gallery = container.querySelector('#avatar-gallery');
        expect(gallery).toBeTruthy();
        const buttons = gallery!.querySelectorAll('.avatar-option');
        expect(buttons.length).toBe(3);
      });
    });

    it('marks current avatar as selected in gallery', async () => {
      mockSessionAndAvatars({ avatarId: 'gandalf' }, ['aragorn', 'gandalf', 'legolas']);
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        const selected = container.querySelector('.avatar-option.selected') as HTMLElement;
        expect(selected).toBeTruthy();
        expect(selected.dataset.slug).toBe('gandalf');
      });
    });
  });

  describe('save profile', () => {
    it('sends PUT /api/profile with updated fields', async () => {
      mockSessionAndAvatars({ username: 'oldname', email: 'old@mail.com' });
      const { container, getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#profile-username')).toBeTruthy();
      });

      const usernameInput = container.querySelector('#profile-username') as HTMLInputElement;
      fireEvent.input(usernameInput, { target: { value: 'newname' } });

      // Mock the save response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Profile updated successfully!' }),
      });

      fireEvent.click(getByText('Save Changes'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/profile', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ username: 'newname', email: 'old@mail.com' }),
        }));
      });
    });

    it('clears the SWR cache after a successful profile save', async () => {
      mockSessionAndAvatars({ username: 'oldname', email: 'old@mail.com' });
      const { container, getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#profile-username')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Profile updated successfully!' }),
      });

      fireEvent.click(getByText('Save Changes'));

      await waitFor(() => {
        expect(mockServiceWorkerPostMessage).toHaveBeenCalledWith({ type: 'sw-clear-cache' });
      });
    });

    it('shows success message after save', async () => {
      mockSessionAndAvatars();
      const { container, getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#profile-username')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ message: 'Profile updated successfully!' }),
      });

      fireEvent.click(getByText('Save Changes'));

      await waitFor(() => {
        expect(container.querySelector('#profile-success')).toBeTruthy();
        expect(container.querySelector('#profile-success')!.textContent).toContain('Profile updated successfully!');
      });
    });

    it('shows error when save fails', async () => {
      mockSessionAndAvatars();
      const { container, getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#profile-username')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Invalid username' }),
      });

      fireEvent.click(getByText('Save Changes'));

      await waitFor(() => {
        expect(container.querySelector('#profile-error')).toBeTruthy();
        expect(container.querySelector('#profile-error')!.textContent).toContain('Invalid username');
      });
    });

    it('shows error when both fields are empty', async () => {
      mockSessionAndAvatars({ username: '', email: '' });
      const { container, getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#profile-username')).toBeTruthy();
      });

      fireEvent.click(getByText('Save Changes'));

      await waitFor(() => {
        expect(container.querySelector('#profile-error')).toBeTruthy();
        expect(container.querySelector('#profile-error')!.textContent).toContain('at least one field');
      });
    });
  });

  describe('avatar selection', () => {
    it('saves avatar choice on click', async () => {
      mockSessionAndAvatars({ avatarId: null }, ['aragorn', 'gandalf']);
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#avatar-gallery')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

      const aragornBtn = container.querySelector('[data-slug="aragorn"]') as HTMLElement;
      fireEvent.click(aragornBtn);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ avatarId: 'aragorn' }),
        }));
      });

      await waitFor(() => {
        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
          type: 'preferenceChanged',
        }));
      });

      dispatchSpy.mockRestore();
    });

    it('resets avatar with initials button', async () => {
      mockSessionAndAvatars({ avatarId: 'gandalf' }, ['aragorn', 'gandalf']);
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#avatar-reset-btn')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      fireEvent.click(container.querySelector('#avatar-reset-btn')!);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          body: JSON.stringify({ avatarId: null }),
        }));
      });
    });
  });

  describe('preference toggles', () => {
    it('saves preview milestones toggle change', async () => {
      mockSessionAndAvatars({ showFutureGoalsUnlocked: true });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#preview-milestones-toggle')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const toggle = container.querySelector('#preview-milestones-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: false } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          body: JSON.stringify({ showFutureGoalsUnlocked: false }),
        }));
      });
    });

    it('clears the SWR cache after a successful preference save', async () => {
      mockSessionAndAvatars({ showFutureGoalsUnlocked: true });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#preview-milestones-toggle')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const toggle = container.querySelector('#preview-milestones-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: false } });

      await waitFor(() => {
        expect(mockServiceWorkerPostMessage).toHaveBeenCalledWith({ type: 'sw-clear-cache' });
      });
    });

    it('updates window.userPreferences on successful preference save', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test: setting bridge global
      (window as any).userPreferences = { showFutureGoalsUnlocked: true, defaultViewMap: false };
      mockSessionAndAvatars({ showFutureGoalsUnlocked: true });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#preview-milestones-toggle')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const toggle = container.querySelector('#preview-milestones-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: false } });

      await waitFor(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test: reading bridge global
        expect((window as any).userPreferences.showFutureGoalsUnlocked).toBe(false);
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test: cleanup bridge global
      delete (window as any).userPreferences;
    });

    it('saves default view toggle change', async () => {
      mockSessionAndAvatars({ defaultViewMap: false });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#default-view-toggle')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      });

      const toggle = container.querySelector('#default-view-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: true } });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/user/preferences', expect.objectContaining({
          body: JSON.stringify({ defaultViewMap: true }),
        }));
      });
    });

    it('reverts toggle on save failure', async () => {
      mockSessionAndAvatars({ defaultViewMap: false });
      const { container } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(container.querySelector('#default-view-toggle')).toBeTruthy();
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: 'Server error' }),
      });

      const toggle = container.querySelector('#default-view-toggle') as HTMLInputElement;
      fireEvent.change(toggle, { target: { checked: true } });

      await waitFor(() => {
        const statusEl = container.querySelector('#preference-status');
        expect(statusEl!.textContent).toContain('Server error');
      });
    });
  });

  describe('logout', () => {
    it('calls window.logout when logout button clicked', async () => {
      mockSessionAndAvatars();
      const mockLogout = vi.fn();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test: setting bridge global
      (window as any).logout = mockLogout;

      const { getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(getByText('Logout')).toBeTruthy();
      });

      fireEvent.click(getByText('Logout'));
      expect(mockLogout).toHaveBeenCalled();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test: cleanup bridge global
      delete (window as any).logout;
    });
  });

  describe('back button', () => {
    it('calls history.back when back button clicked', async () => {
      mockSessionAndAvatars();
      const mockBack = vi.fn();
      vi.stubGlobal('history', { ...window.history, back: mockBack });

      const { getByText } = render(<ProfileIsland />);

      await waitFor(() => {
        expect(getByText('Back')).toBeTruthy();
      });

      fireEvent.click(getByText('Back'));
      expect(mockBack).toHaveBeenCalled();
    });
  });
});
