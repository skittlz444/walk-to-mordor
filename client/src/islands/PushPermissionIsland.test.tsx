import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/preact';
import { PushPermissionIsland } from './PushPermissionIsland';
import { resetAppStore, sessionToken } from '../stores/appStore';
import {
  getDevicePushSubscription,
  getPushStatus,
  subscribeToPush,
  supportsPushMessaging,
  syncPushAuthContext,
  unsubscribeFromPush,
  updateNotificationSettings,
} from '../utils/push-client';

vi.mock('../utils/push-client', () => ({
  getDevicePushSubscription: vi.fn(),
  getPushStatus: vi.fn(),
  subscribeToPush: vi.fn(),
  supportsPushMessaging: vi.fn(),
  syncPushAuthContext: vi.fn(),
  unsubscribeFromPush: vi.fn(),
  updateNotificationSettings: vi.fn(),
}));

describe('PushPermissionIsland', () => {
  const mockRequestPermission = vi.fn();
  const mockServiceWorkerAddEventListener = vi.fn();
  const mockServiceWorkerRemoveEventListener = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAppStore();
    sessionToken.value = 'test-token';

    Object.defineProperty(window, 'Notification', {
      value: {
        permission: 'granted',
        requestPermission: mockRequestPermission,
      },
      configurable: true,
    });

    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        addEventListener: mockServiceWorkerAddEventListener,
        removeEventListener: mockServiceWorkerRemoveEventListener,
      },
      configurable: true,
    });

    vi.mocked(supportsPushMessaging).mockReturnValue(true);
    vi.mocked(syncPushAuthContext).mockResolvedValue(undefined);
    vi.mocked(getPushStatus).mockResolvedValue({
      hasSubscriptions: true,
      subscriptionCount: 2,
      notificationsEnabled: true,
    });
    vi.mocked(getDevicePushSubscription).mockResolvedValue({ endpoint: 'https://push.example/sub-1' } as PushSubscription);
    mockRequestPermission.mockResolvedValue('granted');
  });

  it('renders the current browser permission and registered device count', async () => {
    const { getByText } = render(<PushPermissionIsland />);

    await waitFor(() => {
      expect(getByText('Browser permission')).toBeTruthy();
    });

    expect(getByText('Allowed')).toBeTruthy();
    expect(getByText('Registered devices')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
  });

  it('shows an unsupported browser state when push messaging is unavailable', async () => {
    vi.mocked(supportsPushMessaging).mockReturnValue(false);

    const { getByText } = render(<PushPermissionIsland />);

    await waitFor(() => {
      expect(getByText('Unsupported')).toBeTruthy();
    });

    expect(getByText('Your browser does not support the Push API on this device.')).toBeTruthy();
  });

  it('requests permission and subscribes when enabling push on this device', async () => {
    vi.mocked(getDevicePushSubscription)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ endpoint: 'https://push.example/sub-2' } as PushSubscription);
    vi.mocked(subscribeToPush).mockResolvedValue({ endpoint: 'https://push.example/sub-2' } as PushSubscription);

    const { getByText } = render(<PushPermissionIsland />);

    await waitFor(() => {
      expect(getByText('Enable on this device')).toBeTruthy();
    });

    fireEvent.click(getByText('Enable on this device'));

    await waitFor(() => {
      expect(subscribeToPush).toHaveBeenCalledWith('test-token');
    });

    expect(getByText('Push notifications are enabled on this device.')).toBeTruthy();
  });

  it('shows an error when browser permission is denied', async () => {
    mockRequestPermission.mockResolvedValue('denied');
    vi.mocked(getDevicePushSubscription).mockResolvedValue(null);

    const { getByText } = render(<PushPermissionIsland />);

    await waitFor(() => {
      expect(getByText('Enable on this device')).toBeTruthy();
    });

    fireEvent.click(getByText('Enable on this device'));

    await waitFor(() => {
      expect(getByText('Browser notifications are blocked for this site.')).toBeTruthy();
    });

    expect(subscribeToPush).not.toHaveBeenCalled();
  });

  it('updates the global notification toggle', async () => {
    const { container } = render(<PushPermissionIsland />);

    await waitFor(() => {
      expect(container.querySelector('#push-global-toggle')).toBeTruthy();
    });

    const toggle = container.querySelector('#push-global-toggle') as HTMLInputElement;
    toggle.checked = false;
    fireEvent.change(toggle);

    await waitFor(() => {
      expect(updateNotificationSettings).toHaveBeenCalledWith('test-token', false);
    });
  });

  it('disables push for the current device', async () => {
    vi.mocked(unsubscribeFromPush).mockResolvedValue(true);

    const { getByText } = render(<PushPermissionIsland />);

    await waitFor(() => {
      expect(getByText('Disable on this device')).toBeTruthy();
    });

    fireEvent.click(getByText('Disable on this device'));

    await waitFor(() => {
      expect(unsubscribeFromPush).toHaveBeenCalledWith('test-token');
    });
  });
});