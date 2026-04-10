import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/preact';
import { fireEvent, waitFor } from '@testing-library/preact';

// Utility helpers are exported from the component file
import {
  PwaInstallBanner,
  isMobileDevice,
  isStandaloneMode,
  isDismissCooldownActive,
} from './PwaInstallBanner';

const DISMISS_KEY = 'wtm_pwa_install_dismissed';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function stubMobile() {
  Object.defineProperty(navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    configurable: true,
  });
}

function stubDesktop() {
  Object.defineProperty(navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    configurable: true,
  });
}

function stubStandalone(standalone: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(display-mode: standalone)' ? standalone : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

/** Fire a fake `beforeinstallprompt` event and return the mock prompt object. */
function fireBeforeInstallPrompt() {
  const prompt = vi.fn().mockResolvedValue(undefined);
  const userChoice = Promise.resolve({ outcome: 'accepted' as const });
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt, userChoice });
  window.dispatchEvent(event);
  return { prompt, userChoice, event };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();

  // Default: mobile, not standalone, no dismiss
  stubMobile();
  stubStandalone(false);

  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Utility function tests ──────────────────────────────────────────────────

describe('isMobileDevice', () => {
  it('returns true for mobile user agents', () => {
    stubMobile();
    expect(isMobileDevice()).toBe(true);
  });

  it('returns false for desktop user agents', () => {
    stubDesktop();
    expect(isMobileDevice()).toBe(false);
  });
});

describe('isStandaloneMode', () => {
  it('returns true when display-mode is standalone', () => {
    stubStandalone(true);
    expect(isStandaloneMode()).toBe(true);
  });

  it('returns false when not in standalone mode', () => {
    stubStandalone(false);
    expect(isStandaloneMode()).toBe(false);
  });

  it('returns true when iOS navigator.standalone is true', () => {
    stubStandalone(false);
    Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    expect(isStandaloneMode()).toBe(true);
    Object.defineProperty(navigator, 'standalone', { value: undefined, configurable: true });
  });
});

describe('isDismissCooldownActive', () => {
  it('returns false when no dismiss timestamp exists', () => {
    expect(isDismissCooldownActive()).toBe(false);
  });

  it('returns true when dismissed less than 2 weeks ago', () => {
    const recentTimestamp = String(Date.now() - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(recentTimestamp);
    expect(isDismissCooldownActive()).toBe(true);
  });

  it('returns false when dismissed more than 2 weeks ago', () => {
    const oldTimestamp = String(Date.now() - TWO_WEEKS_MS - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(oldTimestamp);
    expect(isDismissCooldownActive()).toBe(false);
  });

  it('returns false for invalid stored value', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-a-number');
    expect(isDismissCooldownActive()).toBe(false);
  });
});

// ── Component rendering tests ───────────────────────────────────────────────

describe('PwaInstallBanner', () => {
  it('renders nothing initially (no beforeinstallprompt event)', () => {
    const { container } = render(<PwaInstallBanner />);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('shows the banner after beforeinstallprompt event on mobile', async () => {
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
  });

  it('does not show the banner on desktop', () => {
    stubDesktop();
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('does not show the banner in standalone mode', () => {
    stubStandalone(true);
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('does not show the banner when recently dismissed', () => {
    const recentTimestamp = String(Date.now() - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(recentTimestamp);

    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('shows the banner if dismiss was more than 2 weeks ago', async () => {
    const oldTimestamp = String(Date.now() - TWO_WEEKS_MS - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(oldTimestamp);

    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
  });

  it('dismisses and stores timestamp in localStorage', async () => {
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();

    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });

    const dismissBtn = container.querySelector('.pwa-install-banner__dismiss') as HTMLButtonElement;
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).toBeNull();
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      DISMISS_KEY,
      expect.stringMatching(/^\d+$/),
    );
  });

  it('triggers the native install prompt on install click', async () => {
    const { container } = render(<PwaInstallBanner />);
    const { prompt } = fireBeforeInstallPrompt();

    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });

    const installBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(installBtn);

    expect(prompt).toHaveBeenCalled();
  });

  it('hides the banner when install is accepted', async () => {
    const { container } = render(<PwaInstallBanner />);

    const prompt = vi.fn().mockResolvedValue(undefined);
    const userChoice = Promise.resolve({ outcome: 'accepted' as const });
    const event = new Event('beforeinstallprompt', { cancelable: true });
    Object.assign(event, { prompt, userChoice });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });

    const installBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(installBtn);

    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).toBeNull();
    });
  });

  it('contains expected text content', async () => {
    const { getByText } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();

    await waitFor(() => {
      expect(getByText('Install Walk to Mordor for a better experience!')).toBeTruthy();
      expect(getByText('Install')).toBeTruthy();
    });
  });

  it('has role="banner" and aria-label for accessibility', async () => {
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();

    await waitFor(() => {
      const banner = container.querySelector('.pwa-install-banner');
      expect(banner).not.toBeNull();
      expect(banner!.getAttribute('role')).toBe('banner');
      expect(banner!.getAttribute('aria-label')).toBe('Install app');
    });
  });
});
