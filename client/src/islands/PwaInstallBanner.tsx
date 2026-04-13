import { useEffect, useState, useRef } from 'preact/hooks';

const DISMISS_KEY = 'wtm_pwa_install_dismissed';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * How long to wait for a `beforeinstallprompt` event before falling back
 * to manual "Add to Home Screen" instructions.
 */
const NATIVE_PROMPT_WAIT_MS = 3000;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/** Banner mode: native prompt available vs manual instructions. */
export type BannerMode = 'native' | 'ios' | 'firefox' | 'manual';

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
 * Detect whether the user is on iOS (iPhone, iPad, iPod).
 */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Detect whether the user is on Firefox mobile.
 */
export function isFirefoxMobile(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Firefox/i.test(navigator.userAgent) && /Android|Mobile/i.test(navigator.userAgent);
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

/**
 * Determine the fallback banner mode when `beforeinstallprompt` is unavailable.
 * - iOS → show Share-based instructions
 * - Firefox mobile → show Menu → More instructions
 * - Other mobile → show generic menu-based instructions
 */
export function getFallbackMode(): BannerMode {
  if (isIOSDevice()) return 'ios';
  if (isFirefoxMobile()) return 'firefox';
  return 'manual';
}

export function PwaInstallBanner() {
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<BannerMode>('native');
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Gate: only mobile, not standalone, and cooldown expired
    if (!isMobileDevice() || isStandaloneMode() || isDismissCooldownActive()) {
      return;
    }

    let cancelled = false;

    function handleBeforeInstall(e: Event) {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      // Cancel fallback timer — native prompt is available
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
      if (!cancelled) {
        setMode('native');
        setVisible(true);
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    // Start fallback timer: if beforeinstallprompt doesn't fire within
    // NATIVE_PROMPT_WAIT_MS, show manual instructions instead.
    fallbackTimerRef.current = setTimeout(() => {
      if (!cancelled && !deferredPromptRef.current) {
        setMode(getFallbackMode());
        setVisible(true);
      }
    }, NATIVE_PROMPT_WAIT_MS);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      if (fallbackTimerRef.current !== null) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
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
        {mode === 'native' && (
          <span className="pwa-install-banner__text">
            Install Walk to Mordor for a better experience!
          </span>
        )}
        {mode === 'ios' && (
          <span className="pwa-install-banner__text">
            Tap <i className="fas fa-share-from-square" aria-hidden="true"></i> Share then &quot;Add to Home Screen&quot; to install
          </span>
        )}
        {mode === 'firefox' && (
          <span className="pwa-install-banner__text">
            Tap <i className="fas fa-ellipsis-vertical" aria-hidden="true"></i> Menu &rarr; More &rarr; &quot;Add to Home Screen&quot;
          </span>
        )}
        {mode === 'manual' && (
          <span className="pwa-install-banner__text">
            Tap <i className="fas fa-ellipsis-vertical" aria-hidden="true"></i> Menu then &quot;Install&quot; or &quot;Add to Home Screen&quot;
          </span>
        )}
      </div>
      <div className="pwa-install-banner__actions">
        {mode === 'native' && (
          <button
            type="button"
            className="pwa-install-banner__install"
            onClick={handleInstall}
          >
            Install
          </button>
        )}
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
