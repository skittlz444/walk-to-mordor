import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup, waitFor, act } from '@testing-library/preact';
import { useState } from 'preact/hooks';
import { AvatarPickerModal } from './AvatarPickerModal';

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

interface HarnessProps {
  initialAvatarId?: string | null;
  onChange?: (slug: string | null) => void;
}

function Harness({ initialAvatarId = 'frodo', onChange }: HarnessProps) {
  const [open, setOpen] = useState(false);
  const [avatarId, setAvatarId] = useState<string | null>(initialAvatarId);

  return (
    <div>
      <button type="button" data-testid="avatar-trigger" onClick={() => setOpen(true)}>
        Change avatar
      </button>
      {open && (
        <AvatarPickerModal
          username="FrodoBaggins"
          avatarId={avatarId}
          onChange={(slug) => {
            setAvatarId(slug);
            onChange?.(slug);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function mockGallery(avatars: string[] = ['frodo', 'samwise', 'gandalf']) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve(avatars),
  });
}

function mockSaveOk() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
  });
}

async function openPicker(initialAvatarId: string | null = 'frodo') {
  const onChange = vi.fn();
  const view = render(<Harness initialAvatarId={initialAvatarId} onChange={onChange} />);
  fireEvent.click(view.getByTestId('avatar-trigger'));

  await waitFor(() => {
    expect(view.container.querySelector('.picker-dialog')).toBeTruthy();
  });

  return { ...view, onChange };
}

describe('AvatarPickerModal', () => {
  it('fetches the gallery and renders a radiogroup', async () => {
    mockGallery();

    const { container, getByRole } = await openPicker();

    await waitFor(() => {
      expect(container.querySelectorAll('.picker-option')).toHaveLength(3);
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/avatars',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    );

    const group = getByRole('radiogroup', { name: 'Choose avatar' });
    expect(group.querySelectorAll('[role="radio"]')).toHaveLength(3);
    expect(container.querySelector('[data-slug="frodo"]')!.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-slug="samwise"]')!.getAttribute('aria-checked')).toBe('false');
  });

  it('keeps the current avatar preview visible while the gallery loads', async () => {
    let resolveGallery: (value: unknown) => void = () => {};
    mockFetch.mockReturnValueOnce(new Promise((resolve) => {
      resolveGallery = resolve;
    }));

    const { container } = render(<Harness />);
    fireEvent.click(container.querySelector('[data-testid="avatar-trigger"]')!);

    await waitFor(() => {
      expect(container.querySelector('.picker-current')).toBeTruthy();
    });

    expect(container.querySelector('.picker-loading')).toBeTruthy();
    expect(container.querySelector('.picker-grid')).toBeNull();
    expect(
      container.querySelector('.picker-current img')!.getAttribute('src'),
    ).toContain('frodo.webp');

    resolveGallery({
      ok: true,
      status: 200,
      json: () => Promise.resolve(['frodo', 'samwise']),
    });

    await waitFor(() => {
      expect(container.querySelector('.picker-loading')).toBeNull();
    });
  });

  it('shows a gallery error with Retry and re-fetches', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    const { container, getByText } = await openPicker();

    await waitFor(() => {
      expect(container.querySelector('.picker-gallery-error')).toBeTruthy();
    });
    expect(container.querySelector('.picker-current')).toBeTruthy();

    mockGallery(['frodo', 'samwise']);
    fireEvent.click(getByText('Retry'));

    await waitFor(() => {
      expect(container.querySelectorAll('.picker-option')).toHaveLength(2);
    });
  });

  it('saves immediately on select via PUT and updates the parent', async () => {
    mockGallery();
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');

    const { container, onChange } = await openPicker();

    await waitFor(() => {
      expect(container.querySelector('[data-slug="samwise"]')).toBeTruthy();
    });

    mockSaveOk();
    fireEvent.click(container.querySelector('[data-slug="samwise"]')!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user/preferences',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ avatarId: 'samwise' }),
        }),
      );
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('samwise');
      expect(container.querySelector('[data-slug="samwise"]')!.getAttribute('aria-checked')).toBe('true');
      expect(container.querySelector('.picker-status')!.textContent).toBe('Saved');
    });

    expect(mockServiceWorkerPostMessage).toHaveBeenCalledWith({ type: 'sw-clear-cache' });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
      type: 'preferenceChanged',
    }));

    dispatchSpy.mockRestore();
  });

  it('resets to initials with a null avatar id', async () => {
    mockGallery();

    const { container, getByText, onChange } = await openPicker('frodo');

    await waitFor(() => {
      expect(container.querySelector('.picker-grid')).toBeTruthy();
    });

    mockSaveOk();
    fireEvent.click(getByText('Use initials'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/user/preferences',
        expect.objectContaining({ body: JSON.stringify({ avatarId: null }) }),
      );
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(null);
      expect(container.querySelector('.picker-current .avatar--initials')).toBeTruthy();
    });
  });

  it('clears the saved status after the timeout', async () => {
    mockGallery();

    const { container } = await openPicker();

    await waitFor(() => {
      expect(container.querySelector('[data-slug="samwise"]')).toBeTruthy();
    });

    mockSaveOk();
    fireEvent.click(container.querySelector('[data-slug="samwise"]')!);

    await waitFor(() => {
      expect(container.querySelector('.picker-status')!.textContent).toBe('Saved');
    });

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(container.querySelector('.picker-status')!.textContent).toBe('');
  });

  it('keeps the modal open with the prior selection on a non-401 save error', async () => {
    mockGallery();

    const { container, onChange } = await openPicker('frodo');

    await waitFor(() => {
      expect(container.querySelector('[data-slug="samwise"]')).toBeTruthy();
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Failed to save' }),
    });

    fireEvent.click(container.querySelector('[data-slug="samwise"]')!);

    await waitFor(() => {
      expect(container.querySelector('.picker-status')!.textContent).toBe('Failed to save');
    });

    expect(container.querySelector('.picker-dialog')).toBeTruthy();
    expect(container.querySelector('[data-slug="frodo"]')!.getAttribute('aria-checked')).toBe('true');
    expect(container.querySelector('[data-slug="samwise"]')!.getAttribute('aria-checked')).toBe('false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('closes on Escape and returns focus to the trigger', async () => {
    mockGallery();

    const { container, getByTestId } = render(<Harness />);
    const trigger = getByTestId('avatar-trigger') as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(container.querySelector('.picker-dialog')).toBeTruthy();
    });

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(container.querySelector('.picker-dialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('closes on backdrop click and returns focus to the trigger', async () => {
    mockGallery();

    const { container, getByTestId } = render(<Harness />);
    const trigger = getByTestId('avatar-trigger') as HTMLButtonElement;
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(container.querySelector('.profile-dialog-overlay')).toBeTruthy();
    });

    fireEvent.click(container.querySelector('.profile-dialog-overlay')!);

    await waitFor(() => {
      expect(container.querySelector('.picker-dialog')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    });
  });

  it('wraps Tab focus inside the dialog', async () => {
    mockGallery();

    const { container } = await openPicker();

    await waitFor(() => {
      expect(container.querySelector('.picker-grid')).toBeTruthy();
    });

    const dialog = container.querySelector('.picker-dialog') as HTMLElement;
    const focusables = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled])'));
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('closes and redirects to /login when the gallery fetch returns 401', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    const { container } = render(<Harness />);
    fireEvent.click(container.querySelector('[data-testid="avatar-trigger"]')!);

    await waitFor(() => {
      expect(container.querySelector('.picker-dialog')).toBeNull();
    });
    expect(window.location.href).toBe('/login');
  });

  it('closes and redirects to /login when the save returns 401', async () => {
    mockGallery();

    const { container, onChange } = await openPicker();

    await waitFor(() => {
      expect(container.querySelector('[data-slug="samwise"]')).toBeTruthy();
    });

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ error: 'Unauthorized' }),
    });

    fireEvent.click(container.querySelector('[data-slug="samwise"]')!);

    await waitFor(() => {
      expect(container.querySelector('.picker-dialog')).toBeNull();
    });
    expect(window.location.href).toBe('/login');
    expect(onChange).not.toHaveBeenCalled();
  });
});
