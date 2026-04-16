interface PushStatusData {
  hasSubscriptions: boolean;
  subscriptionCount: number;
  notificationsEnabled: boolean;
  oneMoreMileEnabled: boolean;
}

interface PushStatusResponse {
  status: string;
  data: PushStatusData;
}

interface VapidKeyResponse {
  status: string;
  data: {
    vapidPublicKey: string;
  };
}

interface SerializedPushSubscription {
  endpoint?: string;
  keys?: {
    auth?: string;
    p256dh?: string;
  };
}

let vapidKeyPromise: Promise<string> | null = null;

function getAuthHeaders(sessionToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${sessionToken}`,
    'Content-Type': 'application/json',
  };
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const payload = await response.json() as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function postMessageToServiceWorker(message: Record<string, unknown>): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  if (navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage(message);
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage(message);
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser');
  }

  return navigator.serviceWorker.ready;
}

function requireSubscriptionPayload(subscription: PushSubscription): {
  endpoint: string;
  keys: {
    auth: string;
    p256dh: string;
  };
} {
  const json = subscription.toJSON() as SerializedPushSubscription;
  const endpoint = json.endpoint || subscription.endpoint;
  const auth = json.keys?.auth;
  const p256dh = json.keys?.p256dh;

  if (!endpoint || !auth || !p256dh) {
    throw new Error('Push subscription is missing required keys');
  }

  return {
    endpoint,
    keys: {
      auth,
      p256dh,
    },
  };
}

export function supportsPushMessaging(): boolean {
  return typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray;
}

export async function syncPushAuthContext(sessionToken: string): Promise<void> {
  await postMessageToServiceWorker({
    type: 'sw-set-push-auth',
    sessionToken,
  });
}

export async function clearPushAuthContext(): Promise<void> {
  await postMessageToServiceWorker({ type: 'sw-clear-push-auth' });
}

export async function getDevicePushSubscription(): Promise<PushSubscription | null> {
  if (!supportsPushMessaging()) {
    return null;
  }

  const registration = await getServiceWorkerRegistration();
  return registration.pushManager.getSubscription();
}

export async function fetchVapidKey(): Promise<string> {
  if (!vapidKeyPromise) {
    vapidKeyPromise = (async () => {
      const response = await fetch('/api/push/vapid-key');
      if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Unable to fetch VAPID key'));
      }

      const payload = await response.json() as VapidKeyResponse;
      const vapidPublicKey = payload.data?.vapidPublicKey;

      if (!vapidPublicKey) {
        throw new Error('Push notifications are not configured');
      }

      return vapidPublicKey;
    })().catch((error: unknown) => {
      vapidKeyPromise = null;
      throw error;
    });
  }

  return vapidKeyPromise;
}

export async function subscribeToPush(sessionToken: string): Promise<PushSubscription> {
  if (!supportsPushMessaging()) {
    throw new Error('Push messaging is not supported in this browser');
  }

  await syncPushAuthContext(sessionToken);

  const registration = await getServiceWorkerRegistration();
  const vapidPublicKey = await fetchVapidKey();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource;
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  const payload = requireSubscriptionPayload(subscription);
  const response = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: getAuthHeaders(sessionToken),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to save push subscription'));
  }

  return subscription;
}

export async function unsubscribeFromPush(sessionToken: string): Promise<boolean> {
  if (!supportsPushMessaging()) {
    throw new Error('Push messaging is not supported in this browser');
  }

  await syncPushAuthContext(sessionToken);

  const registration = await getServiceWorkerRegistration();
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    await clearPushAuthContext();
    return false;
  }

  const payload = requireSubscriptionPayload(subscription);
  const response = await fetch('/api/push/subscribe', {
    method: 'DELETE',
    headers: getAuthHeaders(sessionToken),
    body: JSON.stringify({ endpoint: payload.endpoint }),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to remove push subscription'));
  }

  try {
    return await subscription.unsubscribe();
  } finally {
    await clearPushAuthContext();
  }
}

export async function getPushStatus(sessionToken: string): Promise<PushStatusData> {
  const response = await fetch('/api/push/status', {
    headers: getAuthHeaders(sessionToken),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to load push notification status'));
  }

  const payload = await response.json() as PushStatusResponse;
  return payload.data;
}

export interface NotificationSettingsPayload {
  notificationsEnabled?: boolean;
  oneMoreMileEnabled?: boolean;
}

export async function updateNotificationSettings(
  sessionToken: string,
  enabledOrSettings: boolean | NotificationSettingsPayload,
): Promise<void> {
  const payload = typeof enabledOrSettings === 'boolean'
    ? { notificationsEnabled: enabledOrSettings }
    : enabledOrSettings;

  const response = await fetch('/api/push/settings', {
    method: 'PUT',
    headers: getAuthHeaders(sessionToken),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, 'Unable to update notification settings'));
  }
}