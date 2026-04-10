import { useEffect, useState, useRef } from 'preact/hooks';

const DISMISS_KEY = 'wtm_pwa_install_dismissed';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/**
 * Detect whether the current browser is running on a mobile device.
 * Uses the User-Agent string as the primary signal.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

/**
 * Detect whether the app is already running in installed/standalone PWA mode.
 */
export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  // Standard check
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS Safari check
  if ((navigator as Record<string, unknown>).standalone === true) return true;
  return false;
}

/**
 * Check whether the dismiss cooldown (2 weeks) has elapsed.
 */
export function isDismissCooldownActive(): boolean {
  try {
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (!dismissed) return false;
    const dismissedAt = Number(dismissed);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < TWO_WEEKS_MS;
  } catch {
    return false;
  }
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Gate: only mobile, not standalone, and cooldown expired
    if (!isMobileDevice() || isStandaloneMode() || isDismissCooldownActive()) {
      return;
    }

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setVisible(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  function handleInstall() {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    prompt.prompt();
    prompt.userChoice.then((choice) => {
      if (choice.outcome === 'accepted') {
        setVisible(false);
      }
      deferredPromptRef.current = null;
    });
  }

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable — banner just hides for this session
    }
    setVisible(false);
    deferredPromptRef.current = null;
  }

  if (!visible) return null;

  return (
    <div className="pwa-install-banner" role="banner" aria-label="Install app">
      <div className="pwa-install-banner__content">
        <i className="fas fa-mobile-alt pwa-install-banner__icon" aria-hidden="true"></i>
        <span className="pwa-install-banner__text">
          Install Walk to Mordor for a better experience!
        </span>
      </div>
      <div className="pwa-install-banner__actions">
        <button
          type="button"
          className="pwa-install-banner__install"
          onClick={handleInstall}
        >
          Install
        </button>
        <button
          type="button"
          className="pwa-install-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss install prompt"
        >
          <i className="fas fa-times" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
