import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('push-client', () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockControllerPostMessage: ReturnType<typeof vi.fn>;
  let mockActivePostMessage: ReturnType<typeof vi.fn>;
  let mockGetSubscription: ReturnType<typeof vi.fn>;
  let mockSubscribe: ReturnType<typeof vi.fn>;
  let mockUnsubscribe: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    mockFetch = vi.fn();
    mockControllerPostMessage = vi.fn();
    mockActivePostMessage = vi.fn();
    mockGetSubscription = vi.fn();
    mockSubscribe = vi.fn();
    mockUnsubscribe = vi.fn();

    const registration = {
      active: { postMessage: mockActivePostMessage },
      pushManager: {
        getSubscription: mockGetSubscription,
        subscribe: mockSubscribe,
      },
    };

    vi.stubGlobal('fetch', mockFetch);

    Object.defineProperty(window, 'PushManager', {
      value: function PushManager() {},
      configurable: true,
    });

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: vi.fn().mockResolvedValue('granted'),
      },
      configurable: true,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        controller: { postMessage: mockControllerPostMessage },
        ready: Promise.resolve(registration),
      },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('converts a base64url string to a Uint8Array', async () => {
    const pushClient = await import('./push-client');
    const bytes = pushClient.urlBase64ToUint8Array('SGVsbG8');
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(bytes)).toEqual([72, 101, 108, 108, 111]);
  });

  it('caches the VAPID key after the first fetch', async () => {
    const pushClient = await import('./push-client');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'success',
        data: { vapidPublicKey: 'SGVsbG8' },
      }),
    });

    const first = await pushClient.fetchVapidKey();
    const second = await pushClient.fetchVapidKey();

    expect(first).toBe('SGVsbG8');
    expect(second).toBe('SGVsbG8');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('subscribes with the service worker and posts the subscription to the API', async () => {
    const pushClient = await import('./push-client');
    const mockSubscription = {
      endpoint: 'https://push.example/sub-1',
      toJSON: () => ({
        endpoint: 'https://push.example/sub-1',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      }),
    };

    mockGetSubscription.mockResolvedValueOnce(null);
    mockSubscribe.mockResolvedValue(mockSubscription);
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          data: { vapidPublicKey: 'SGVsbG8' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'success' }),
      });

    await pushClient.subscribeToPush('test-token');

    expect(mockControllerPostMessage).toHaveBeenCalledWith({
      type: 'sw-set-push-auth',
      sessionToken: 'test-token',
    });
    expect(mockSubscribe).toHaveBeenCalledWith(expect.objectContaining({
      userVisibleOnly: true,
      applicationServerKey: expect.any(Uint8Array),
    }));
    expect(mockFetch).toHaveBeenNthCalledWith(2, '/api/push/subscribe', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });

  it('removes the current device subscription and clears stored service worker auth', async () => {
    const pushClient = await import('./push-client');
    const mockSubscription = {
      endpoint: 'https://push.example/sub-2',
      toJSON: () => ({
        endpoint: 'https://push.example/sub-2',
        keys: { auth: 'auth-key', p256dh: 'p256dh-key' },
      }),
      unsubscribe: mockUnsubscribe.mockResolvedValue(true),
    };

    mockGetSubscription.mockResolvedValue(mockSubscription);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success' }),
    });

    const unsubscribed = await pushClient.unsubscribeFromPush('test-token');

    expect(unsubscribed).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith('/api/push/subscribe', expect.objectContaining({
      method: 'DELETE',
      body: JSON.stringify({ endpoint: 'https://push.example/sub-2' }),
    }));
    expect(mockUnsubscribe).toHaveBeenCalled();
    expect(mockControllerPostMessage).toHaveBeenLastCalledWith({ type: 'sw-clear-push-auth' });
  });

  it('returns the authenticated push status payload', async () => {
    const pushClient = await import('./push-client');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        status: 'success',
        data: {
          hasSubscriptions: true,
          subscriptionCount: 3,
          notificationsEnabled: true,
        },
      }),
    });

    await expect(pushClient.getPushStatus('test-token')).resolves.toEqual({
      hasSubscriptions: true,
      subscriptionCount: 3,
      notificationsEnabled: true,
    });
  });

  it('sends global notification settings updates', async () => {
    const pushClient = await import('./push-client');
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ status: 'success' }),
    });

    await pushClient.updateNotificationSettings('test-token', false);

    expect(mockFetch).toHaveBeenCalledWith('/api/push/settings', expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      body: JSON.stringify({ notificationsEnabled: false }),
    }));
  });
});