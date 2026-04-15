import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/preact';
import { PushNudgeBanner, isPushNudgeDismissed } from './PushNudgeBanner';
import { resetAppStore, sessionToken } from '../stores/appStore';
import {
  getDevicePushSubscription,
  subscribeToPush,
  supportsPushMessaging,
} from '../utils/push-client';
import { isStandaloneMode } from './PwaInstallBanner';

vi.mock('../utils/push-client', () => ({
  getDevicePushSubscription: vi.fn(),
  subscribeToPush: vi.fn(),
  supportsPushMessaging: vi.fn(),
  syncPushAuthContext: vi.fn(),
}));

vi.mock('./PwaInstallBanner', () => ({
  isStandaloneMode: vi.fn(),
}));

const DISMISS_KEY = 'wtm_push_nudge_dismissed';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function stubStandalone(value: boolean) {
  vi.mocked(isStandaloneMode).mockReturnValue(value);
}

function setupDefaultMocks() {
  vi.mocked(supportsPushMessaging).mockReturnValue(true);
  stubStandalone(true);
  vi.mocked(getDevicePushSubscription).mockResolvedValue(null);

  Object.defineProperty(window, 'Notification', {
    value: {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    },
    configurable: true,
    writable: true,
  });
}

// ── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  resetAppStore();
  sessionToken.value = 'test-token';

  vi.stubGlobal('localStorage', {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });

  setupDefaultMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ── isPushNudgeDismissed ─────────────────────────────────────────────────────

describe('isPushNudgeDismissed', () => {
  it('returns false when no dismiss timestamp exists', () => {
    expect(isPushNudgeDismissed()).toBe(false);
  });

  it('returns true when dismissed less than 2 weeks ago', () => {
    const recent = String(Date.now() - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(recent);
    expect(isPushNudgeDismissed()).toBe(true);
  });

  it('returns false when dismissed more than 2 weeks ago', () => {
    const old = String(Date.now() - TWO_WEEKS_MS - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(old);
    expect(isPushNudgeDismissed()).toBe(false);
  });

  it('returns false for an invalid stored value', () => {
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue('not-a-number');
    expect(isPushNudgeDismissed()).toBe(false);
  });
});

// ── PushNudgeBanner — display gates ─────────────────────────────────────────

describe('PushNudgeBanner — display gates', () => {
  it('shows the banner when all conditions are met', async () => {
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });
  });

  it('does not show when not in standalone mode', async () => {
    stubStandalone(false);
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('does not show when push messaging is not supported', async () => {
    vi.mocked(supportsPushMessaging).mockReturnValue(false);
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('does not show when no session token', async () => {
    sessionToken.value = '';
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('does not show when push nudge was dismissed within 2 weeks', async () => {
    const recent = String(Date.now() - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(recent);
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('does not show when browser notification permission is denied', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'denied', requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    });
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('does not show when device already has a push subscription', async () => {
    vi.mocked(getDevicePushSubscription).mockResolvedValue({
      endpoint: 'https://push.example/sub',
    } as PushSubscription);
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('shows when nudge was dismissed more than 2 weeks ago', async () => {
    const old = String(Date.now() - TWO_WEEKS_MS - 1000);
    (localStorage.getItem as ReturnType<typeof vi.fn>).mockReturnValue(old);
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });
  });

  it('shows when permission is granted but no subscription exists', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    });
    vi.mocked(getDevicePushSubscription).mockResolvedValue(null);
    const { container } = render(<PushNudgeBanner />);
    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });
  });
});

// ── PushNudgeBanner — Enable button ─────────────────────────────────────────

describe('PushNudgeBanner — Enable button', () => {
  it('requests permission then subscribes when clicked', async () => {
    vi.mocked(subscribeToPush).mockResolvedValue({} as PushSubscription);
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const enableBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(window.Notification.requestPermission).toHaveBeenCalled();
      expect(vi.mocked(subscribeToPush)).toHaveBeenCalledWith('test-token');
    });
  });

  it('hides the banner after successful subscription', async () => {
    vi.mocked(subscribeToPush).mockResolvedValue({} as PushSubscription);
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const enableBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('hides the banner when permission is denied after requesting', async () => {
    (window.Notification.requestPermission as ReturnType<typeof vi.fn>).mockResolvedValue('denied');
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const enableBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });

    expect(vi.mocked(subscribeToPush)).not.toHaveBeenCalled();
  });

  it('skips requestPermission when already granted and subscribes directly', async () => {
    Object.defineProperty(window, 'Notification', {
      value: { permission: 'granted', requestPermission: vi.fn() },
      configurable: true,
      writable: true,
    });
    vi.mocked(subscribeToPush).mockResolvedValue({} as PushSubscription);
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const enableBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(vi.mocked(subscribeToPush)).toHaveBeenCalledWith('test-token');
    });

    expect(window.Notification.requestPermission).not.toHaveBeenCalled();
  });

  it('shows an error message when subscribing fails', async () => {
    vi.mocked(subscribeToPush).mockRejectedValue(new Error('Network error'));
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const enableBtn = container.querySelector('.pwa-install-banner__install') as HTMLButtonElement;
    fireEvent.click(enableBtn);

    await waitFor(() => {
      expect(container.textContent).toContain('Network error');
    });

    // Banner stays visible so user can dismiss it
    expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
  });
});

// ── PushNudgeBanner — Dismiss button ─────────────────────────────────────────

describe('PushNudgeBanner — Dismiss button', () => {
  it('hides the banner on dismiss', async () => {
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const dismissBtn = container.querySelector('.pwa-install-banner__dismiss') as HTMLButtonElement;
    fireEvent.click(dismissBtn);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).toBeNull();
    });
  });

  it('stores a 2-week cooldown timestamp in localStorage on dismiss', async () => {
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      expect(container.querySelector('.push-nudge-banner')).not.toBeNull();
    });

    const dismissBtn = container.querySelector('.pwa-install-banner__dismiss') as HTMLButtonElement;
    fireEvent.click(dismissBtn);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      DISMISS_KEY,
      expect.stringMatching(/^\d+$/),
    );
  });
});

// ── PushNudgeBanner — accessibility ─────────────────────────────────────────

describe('PushNudgeBanner — accessibility', () => {
  it('has role="banner" and aria-label on the container', async () => {
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      const banner = container.querySelector('.push-nudge-banner');
      expect(banner).not.toBeNull();
      expect(banner!.getAttribute('role')).toBe('banner');
      expect(banner!.getAttribute('aria-label')).toBe('Enable push notifications');
    });
  });

  it('dismiss button has aria-label', async () => {
    const { container } = render(<PushNudgeBanner />);

    await waitFor(() => {
      const dismiss = container.querySelector('.pwa-install-banner__dismiss');
      expect(dismiss).not.toBeNull();
      expect(dismiss!.getAttribute('aria-label')).toBe('Dismiss notification prompt');
    });
  });
});
