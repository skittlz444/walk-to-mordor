import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/preact';
import { fireEvent, waitFor } from '@testing-library/preact';

// Utility helpers are exported from the component file
import {
  PwaInstallBanner,
  isMobileDevice,
  isIOSDevice,
  isFirefoxMobile,
  isStandaloneMode,
  isDismissCooldownActive,
  getFallbackMode,
} from './PwaInstallBanner';
import type { BannerMode } from './PwaInstallBanner';

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

function stubFirefoxMobile() {
  Object.defineProperty(navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (Android 13; Mobile; rv:120.0) Gecko/120.0 Firefox/120.0',
    configurable: true,
  });
}

function stubIOSSafari() {
  Object.defineProperty(navigator, 'userAgent', {
    value:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
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
  const userChoice = Promise.resolve({ outcome: 'accepted' as const, platform: '' });
  const event = new Event('beforeinstallprompt', { cancelable: true });
  Object.assign(event, { prompt, userChoice });
  window.dispatchEvent(event);
  return { prompt, userChoice, event };
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();

  // Default: mobile Chrome, not standalone, no dismiss
  stubMobile();
  stubStandalone(false);

  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── Utility function tests ──────────────────────────────────────────────────

describe('isMobileDevice', () => {
  it('returns true for Android Chrome', () => {
    stubMobile();
    expect(isMobileDevice()).toBe(true);
  });

  it('returns true for Firefox on Android', () => {
    stubFirefoxMobile();
    expect(isMobileDevice()).toBe(true);
  });

  it('returns true for iOS Safari', () => {
    stubIOSSafari();
    expect(isMobileDevice()).toBe(true);
  });

  it('returns false for desktop user agents', () => {
    stubDesktop();
    expect(isMobileDevice()).toBe(false);
  });
});

describe('isIOSDevice', () => {
  it('returns true for iPhone Safari', () => {
    stubIOSSafari();
    expect(isIOSDevice()).toBe(true);
  });

  it('returns false for Android Chrome', () => {
    stubMobile();
    expect(isIOSDevice()).toBe(false);
  });

  it('returns false for Firefox on Android', () => {
    stubFirefoxMobile();
    expect(isIOSDevice()).toBe(false);
  });
});

describe('isFirefoxMobile', () => {
  it('returns true for Firefox on Android', () => {
    stubFirefoxMobile();
    expect(isFirefoxMobile()).toBe(true);
  });

  it('returns false for Android Chrome', () => {
    stubMobile();
    expect(isFirefoxMobile()).toBe(false);
  });

  it('returns false for iOS Safari', () => {
    stubIOSSafari();
    expect(isFirefoxMobile()).toBe(false);
  });

  it('returns false for desktop Firefox', () => {
    Object.defineProperty(navigator, 'userAgent', {
      value: 'Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0',
      configurable: true,
    });
    expect(isFirefoxMobile()).toBe(false);
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

describe('getFallbackMode', () => {
  it('returns "ios" on iOS devices', () => {
    stubIOSSafari();
    expect(getFallbackMode()).toBe<BannerMode>('ios');
  });

  it('returns "firefox" on Firefox mobile', () => {
    stubFirefoxMobile();
    expect(getFallbackMode()).toBe<BannerMode>('firefox');
  });

  it('returns "manual" on Android Chrome (non-iOS, non-Firefox)', () => {
    stubMobile();
    expect(getFallbackMode()).toBe<BannerMode>('manual');
  });
});

// ── Component rendering tests ───────────────────────────────────────────────

describe('PwaInstallBanner — Chromium native prompt', () => {
  it('renders nothing initially (before any event or timeout)', () => {
    const { container } = render(<PwaInstallBanner />);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('shows native install banner after beforeinstallprompt event', async () => {
    const { container, getByText } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
      expect(getByText('Install')).toBeTruthy();
      expect(getByText(/Install Walk to Mordor/)).toBeTruthy();
    });
  });

  it('does not show on desktop', () => {
    stubDesktop();
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    vi.advanceTimersByTime(5000);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('does not show in standalone mode', () => {
    stubStandalone(true);
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    vi.advanceTimersByTime(5000);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('does not show when recently dismissed', () => {
    const recentTimestamp = String(Date.now() - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(recentTimestamp);
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    vi.advanceTimersByTime(5000);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });

  it('shows banner if dismiss was more than 2 weeks ago', async () => {
    const oldTimestamp = String(Date.now() - TWO_WEEKS_MS - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(oldTimestamp);
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
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
    fireBeforeInstallPrompt();
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
    const installBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(installBtn);
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).toBeNull();
    });
  });

  it('cancels fallback timer when native prompt arrives', async () => {
    const { container } = render(<PwaInstallBanner />);
    // Native prompt arrives before timeout
    fireBeforeInstallPrompt();
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
    // Advance past the fallback timer
    vi.advanceTimersByTime(5000);
    // Should be in native mode (has Install button)
    expect(container.querySelector('.pwa-install-banner__install')).not.toBeNull();
  });
});

describe('PwaInstallBanner — fallback for non-Chromium browsers', () => {
  it('shows Firefox-specific instructions after timeout on Firefox mobile', async () => {
    stubFirefoxMobile();
    const { container } = render(<PwaInstallBanner />);
    // No beforeinstallprompt fires on Firefox
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
    // Advance past the fallback timer
    vi.advanceTimersByTime(3500);
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
    // Should show Firefox menu instructions, no Install button
    expect(container.querySelector('.pwa-install-banner__install')).toBeNull();
    expect(container.textContent).toContain('Menu');
    expect(container.textContent).toContain('More');
    expect(container.textContent).toContain('Add to Home Screen');
  });

  it('shows iOS Safari instructions after timeout on iPhone', async () => {
    stubIOSSafari();
    const { container } = render(<PwaInstallBanner />);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
    vi.advanceTimersByTime(3500);
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
    // Should show Share instructions, no Install button
    expect(container.querySelector('.pwa-install-banner__install')).toBeNull();
    expect(container.textContent).toContain('Share');
    expect(container.textContent).toContain('Add to Home Screen');
  });

  it('does not show fallback on desktop even after timeout', () => {
    stubDesktop();
    const { container } = render(<PwaInstallBanner />);
    vi.advanceTimersByTime(5000);
    expect(container.querySelector('.pwa-install-banner')).toBeNull();
  });
});

describe('PwaInstallBanner — dismiss', () => {
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

  it('dismisses fallback banner on Firefox', async () => {
    stubFirefoxMobile();
    const { container } = render(<PwaInstallBanner />);
    vi.advanceTimersByTime(3500);
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).not.toBeNull();
    });
    const dismissBtn = container.querySelector('.pwa-install-banner__dismiss') as HTMLButtonElement;
    fireEvent.click(dismissBtn);
    await waitFor(() => {
      expect(container.querySelector('.pwa-install-banner')).toBeNull();
    });
    expect(localStorage.setItem).toHaveBeenCalledWith(DISMISS_KEY, expect.stringMatching(/^\d+$/));
  });
});

describe('PwaInstallBanner — accessibility', () => {
  it('has role="banner" and aria-label', async () => {
    const { container } = render(<PwaInstallBanner />);
    fireBeforeInstallPrompt();
    await waitFor(() => {
      const banner = container.querySelector('.pwa-install-banner');
      expect(banner).not.toBeNull();
      expect(banner!.getAttribute('role')).toBe('banner');
      expect(banner!.getAttribute('aria-label')).toBe('Install app');
    });
  });

  it('dismiss button has aria-label', async () => {
    stubFirefoxMobile();
    const { container } = render(<PwaInstallBanner />);
    vi.advanceTimersByTime(3500);
    await waitFor(() => {
      const dismiss = container.querySelector('.pwa-install-banner__dismiss');
      expect(dismiss).not.toBeNull();
      expect(dismiss!.getAttribute('aria-label')).toBe('Dismiss install prompt');
    });
  });
});
