import { useCallback, useEffect, useState } from 'preact/hooks';
import { sessionToken } from '../stores/appStore';
import { getDevicePushSubscription, subscribeToPush, supportsPushMessaging } from '../utils/push-client';
import { isStandaloneMode } from './PwaInstallBanner';

const DISMISS_KEY = 'wtm_push_nudge_dismissed';
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Check whether the push nudge dismiss cooldown (2 weeks) has elapsed.
 */
export function isPushNudgeDismissed(): boolean {
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
 * Banner that nudges users already running the installed PWA to enable push
 * notifications. Only shown when:
 *  - App is in standalone (PWA-installed) mode
 *  - Push messaging is supported by the browser
 *  - The user is authenticated
 *  - Browser notification permission is not 'denied'
 *  - This device has no existing push subscription
 *  - The user has not dismissed the nudge within the last 2 weeks
 */
export function PushNudgeBanner() {
  const token = sessionToken.value;
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!token) return undefined;
    if (!isStandaloneMode()) return undefined;
    if (!supportsPushMessaging()) return undefined;
    if (isPushNudgeDismissed()) return undefined;

    let cancelled = false;

    void (async () => {
      try {
        if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
          return;
        }

        const existing = await getDevicePushSubscription();
        if (existing) {
          return;
        }

        if (!cancelled) {
          setVisible(true);
        }
      } catch {
        // If subscription check fails, don't show the banner
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleEnable = useCallback(async () => {
    if (!token) return;

    setSubscribing(true);
    setErrorMessage('');

    try {
      if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          setVisible(false);
          return;
        }
      }

      await subscribeToPush(token);
      setVisible(false);
    } catch (error: unknown) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to enable push notifications',
      );
    } finally {
      setSubscribing(false);
    }
  }, [token]);

  const handleDismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // localStorage unavailable — banner just hides for this session
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className="pwa-install-banner push-nudge-banner" role="banner" aria-label="Enable push notifications">
      <div className="pwa-install-banner__content">
        <i className="fas fa-bell pwa-install-banner__icon" aria-hidden="true" />
        <span className="pwa-install-banner__text">
          {errorMessage || 'Get walking reminders and milestone alerts!'}
        </span>
      </div>
      <div className="pwa-install-banner__actions">
        {!errorMessage ? (
          <button
            type="button"
            className="pwa-install-banner__install"
            onClick={handleEnable}
            disabled={subscribing}
          >
            {subscribing ? 'Enabling…' : 'Enable'}
          </button>
        ) : null}
        <button
          type="button"
          className="pwa-install-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss notification prompt"
        >
          <i className="fas fa-times" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
