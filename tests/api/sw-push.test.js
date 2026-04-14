const fs = require('fs');
const path = require('path');

const SW_PATH = path.join(__dirname, '..', '..', 'public', 'sw.js');

function loadSWModule() {
  const swSource = fs.readFileSync(SW_PATH, 'utf8');
  const mockClients = [];
  const mockCaches = {};
  let messageCallback = null;
  let notificationClickCallback = null;
  let pushCallback = null;
  let pushSubscriptionChangeCallback = null;

  function createMockCache() {
    const store = new Map();
    return {
      match: jest.fn(async (request) => {
        const key = typeof request === 'string' ? request : request.url;
        return store.get(key) || undefined;
      }),
      put: jest.fn(async (request, response) => {
        const key = typeof request === 'string' ? request : request.url;
        store.set(key, response);
      }),
      delete: jest.fn(async (request) => {
        const key = typeof request === 'string' ? request : request.url;
        return store.delete(key);
      }),
      keys: jest.fn(async () => Array.from(store.keys())),
      _store: store,
    };
  }

  const caches = {
    open: jest.fn(async (name) => {
      if (!mockCaches[name]) {
        mockCaches[name] = createMockCache();
      }
      return mockCaches[name];
    }),
    delete: jest.fn(async (name) => {
      delete mockCaches[name];
      return true;
    }),
    keys: jest.fn(async () => Object.keys(mockCaches)),
    match: jest.fn(async () => undefined),
  };

  const globalFetch = jest.fn();
  const mockShowNotification = jest.fn(async () => {});
  const mockSubscribe = jest.fn(async () => ({
    endpoint: 'https://push.example/subscription',
    toJSON: () => ({
      keys: {
        auth: 'auth-key',
        p256dh: 'p256dh-key',
      },
    }),
  }));

  const self = {
    location: { origin: 'https://example.com' },
    registration: {
      showNotification: mockShowNotification,
      pushManager: {
        subscribe: mockSubscribe,
      },
    },
    clients: {
      matchAll: jest.fn(async () => mockClients),
      openWindow: jest.fn(async () => {}),
    },
    addEventListener: jest.fn((event, cb) => {
      if (event === 'message') messageCallback = cb;
      if (event === 'notificationclick') notificationClickCallback = cb;
      if (event === 'push') pushCallback = cb;
      if (event === 'pushsubscriptionchange') pushSubscriptionChangeCallback = cb;
    }),
  };

  const fn = new Function(
    'self',
    'caches',
    'fetch',
    'Response',
    'Headers',
    'URL',
    'Date',
    'atob',
    'Uint8Array',
    swSource + '\n; return { readPushAuth, persistPushAuth, handlePushEvent, handleNotificationClick, handlePushSubscriptionChange };'
  );

  const exports = fn(self, caches, globalFetch, Response, Headers, URL, Date, atob, Uint8Array);

  return {
    self,
    caches,
    mockClients,
    mockCaches,
    globalFetch,
    mockShowNotification,
    mockSubscribe,
    messageCallback,
    notificationClickCallback,
    pushCallback,
    pushSubscriptionChangeCallback,
    ...exports,
  };
}

async function runServiceWorkerEvent(callback, event) {
  let pending = Promise.resolve();
  callback({
    ...event,
    waitUntil: (promise) => {
      pending = promise;
    },
  });
  await pending;
}

describe('Service Worker Push Handlers', () => {
  let sw;

  beforeEach(() => {
    jest.restoreAllMocks();
    sw = loadSWModule();
  });

  test('push events show a notification with the provided payload', async () => {
    await runServiceWorkerEvent(sw.pushCallback, {
      data: {
        json: jest.fn(async () => ({
          title: 'Time to walk',
          body: 'Take a lap around the Shire',
          url: '/journey',
          icon: '/icons/custom-icon.png',
        })),
      },
    });

    expect(sw.mockShowNotification).toHaveBeenCalledWith('Time to walk', {
      body: 'Take a lap around the Shire',
      icon: '/icons/custom-icon.png',
      data: { url: '/journey' },
    });
  });

  test('notification clicks open the target URL when no matching client exists', async () => {
    const close = jest.fn();

    await runServiceWorkerEvent(sw.notificationClickCallback, {
      notification: {
        data: { url: '/map' },
        close,
      },
    });

    expect(close).toHaveBeenCalled();
    expect(sw.self.clients.openWindow).toHaveBeenCalledWith('https://example.com/map');
  });

  test('message events persist push auth for later subscription refreshes', async () => {
    await runServiceWorkerEvent(sw.messageCallback, {
      data: {
        type: 'sw-set-push-auth',
        sessionToken: 'test-token',
      },
    });

    await expect(sw.readPushAuth()).resolves.toEqual({ sessionToken: 'test-token' });
  });

  test('pushsubscriptionchange re-subscribes and syncs the new subscription when auth is available', async () => {
    await sw.persistPushAuth('test-token');
    sw.globalFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({
        status: 'success',
        data: { vapidPublicKey: 'SGVsbG8' },
      }), { status: 200, headers: { 'content-type': 'application/json' } }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));

    await runServiceWorkerEvent(sw.pushSubscriptionChangeCallback, {});

    expect(sw.mockSubscribe).toHaveBeenCalled();
    expect(sw.globalFetch).toHaveBeenNthCalledWith(2, '/api/push/subscribe', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
    }));
  });

  test('pushsubscriptionchange asks pages to resubscribe when auth is unavailable', async () => {
    const postMessage = jest.fn();
    sw.mockClients.push({ postMessage });

    await runServiceWorkerEvent(sw.pushSubscriptionChangeCallback, {});

    expect(postMessage).toHaveBeenCalledWith({ type: 'sw-push-resubscribe-required' });
  });
});