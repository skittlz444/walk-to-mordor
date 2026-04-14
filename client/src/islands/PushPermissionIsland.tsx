import { useCallback, useEffect, useState } from 'preact/hooks';
import { sessionToken } from '../stores/appStore';
import {
  getDevicePushSubscription,
  getPushStatus,
  subscribeToPush,
  supportsPushMessaging,
  syncPushAuthContext,
  unsubscribeFromPush,
  updateNotificationSettings,
} from '../utils/push-client';

type NotificationAction = 'enable-device' | 'disable-device' | 'toggle-global' | null;

function getPermissionLabel(permission: NotificationPermission): string {
  if (permission === 'granted') {
    return 'Allowed';
  }

  if (permission === 'denied') {
    return 'Blocked';
  }

  return 'Not requested';
}

export function PushPermissionIsland() {
  const token = sessionToken.value;
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [subscriptionCount, setSubscriptionCount] = useState(0);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [action, setAction] = useState<NotificationAction>(null);

  const refreshState = useCallback(async () => {
    const pushSupported = supportsPushMessaging();
    setSupported(pushSupported);

    if (!pushSupported || !token) {
      setLoading(false);
      return;
    }

    setPermission(Notification.permission);

    try {
      await syncPushAuthContext(token);

      const [status, deviceSubscription] = await Promise.all([
        getPushStatus(token),
        getDevicePushSubscription(),
      ]);

      setDeviceSubscribed(Boolean(deviceSubscription));
      setSubscriptionCount(status.subscriptionCount);
      setNotificationsEnabled(status.notificationsEnabled);
      setErrorMessage('');
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to load push notification settings');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void refreshState();
  }, [refreshState]);

  useEffect(() => {
    if (!supported || !token || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    function handleServiceWorkerMessage(event: MessageEvent): void {
      if (event.data?.type === 'sw-push-resubscribe-required') {
        setStatusMessage('This device needs to re-sync its push subscription. Use the enable button to refresh it.');
      }
    }

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
  }, [supported, token]);

  const handleEnableOnDevice = useCallback(async () => {
    if (!token) {
      return;
    }

    setAction('enable-device');
    setStatusMessage('');
    setErrorMessage('');

    try {
      const nextPermission = await Notification.requestPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'granted') {
        setErrorMessage(nextPermission === 'denied'
          ? 'Browser notifications are blocked for this site.'
          : 'Notification permission was not granted.');
        return;
      }

      await subscribeToPush(token);
      setStatusMessage('Push notifications are enabled on this device.');
      await refreshState();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to enable push notifications on this device');
    } finally {
      setAction(null);
    }
  }, [refreshState, token]);

  const handleDisableOnDevice = useCallback(async () => {
    if (!token) {
      return;
    }

    setAction('disable-device');
    setStatusMessage('');
    setErrorMessage('');

    try {
      await unsubscribeFromPush(token);
      setStatusMessage('Push notifications are disabled on this device.');
      await refreshState();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to disable push notifications on this device');
    } finally {
      setAction(null);
    }
  }, [refreshState, token]);

  const handleGlobalToggle = useCallback(async (event: Event) => {
    if (!token) {
      return;
    }

    const nextValue = (event.currentTarget as HTMLInputElement).checked;
    setAction('toggle-global');
    setStatusMessage('');
    setErrorMessage('');

    try {
      await updateNotificationSettings(token, nextValue);
      setNotificationsEnabled(nextValue);
      setStatusMessage(nextValue
        ? 'Notifications are enabled for all of your devices.'
        : 'Notifications are paused for all of your devices.');
      await refreshState();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to update notification settings');
      await refreshState();
    } finally {
      setAction(null);
    }
  }, [refreshState, token]);

  if (!token) {
    return null;
  }

  if (loading) {
    return (
      <section className="profile-card push-permission-card">
        <div className="profile-card-body">
          <div className="party-loading">Loading notification settings...</div>
        </div>
      </section>
    );
  }

  if (!supported) {
    return (
      <section className="profile-card push-permission-card">
        <div className="profile-card-body push-permission-body">
          <div className="push-permission-header">
            <div>
              <h2>Push Notifications</h2>
              <p className="push-permission-muted">
                Your browser does not support the Push API on this device.
              </p>
            </div>
            <span className="push-permission-pill unsupported">Unsupported</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="profile-card push-permission-card">
      <div className="profile-card-body push-permission-body">
        <div className="push-permission-header">
          <div>
            <h2>Push Notifications</h2>
            <p className="push-permission-muted">
              Manage the server-side reminder toggle for your account and the browser subscription for this device.
            </p>
          </div>
          <span className={`push-permission-pill ${deviceSubscribed ? 'active' : 'inactive'}`}>
            {deviceSubscribed ? 'Enabled on this device' : 'Not enabled on this device'}
          </span>
        </div>

        <div className="push-permission-grid">
          <div className="push-permission-metric">
            <span className="push-permission-metric-label">Browser permission</span>
            <strong>{getPermissionLabel(permission)}</strong>
          </div>
          <div className="push-permission-metric">
            <span className="push-permission-metric-label">Registered devices</span>
            <strong>{subscriptionCount}</strong>
          </div>
        </div>

        <div className="form-group push-setting-group">
          <div className="toggle-group">
            <div className="toggle-label">
              <label htmlFor="push-global-toggle">Allow notifications for my account</label>
              <small className="field-hint">
                This global toggle affects server-side delivery for all devices, but it does not change browser permissions.
              </small>
            </div>
            <label className="toggle-switch">
              <input
                id="push-global-toggle"
                type="checkbox"
                checked={notificationsEnabled}
                disabled={action === 'toggle-global'}
                onChange={handleGlobalToggle}
              />
              <span className="toggle-slider" />
            </label>
          </div>
        </div>

        <div className="push-permission-actions">
          <button
            type="button"
            className="push-action-button primary"
            disabled={action !== null || permission === 'denied' || deviceSubscribed}
            onClick={handleEnableOnDevice}
          >
            {action === 'enable-device' ? 'Enabling...' : 'Enable on this device'}
          </button>

          <button
            type="button"
            className="push-action-button secondary"
            disabled={action !== null || !deviceSubscribed}
            onClick={handleDisableOnDevice}
          >
            {action === 'disable-device' ? 'Disabling...' : 'Disable on this device'}
          </button>
        </div>

        {permission === 'denied' ? (
          <p className="push-permission-muted">
            This browser has blocked notifications for the site. Re-enable them from your browser settings to subscribe again.
          </p>
        ) : null}

        <p className="push-permission-muted">
          Each browser or device keeps its own subscription. If you use multiple devices, enable push separately on each one.
        </p>

        <div id="push-status" className="success-message">{statusMessage}</div>
        <div id="push-error" className="error-message">{errorMessage}</div>
      </div>
    </section>
  );
}