import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/preact';
import { ProfileAccountIsland } from './ProfileAccountIsland';

beforeEach(() => {
  Object.defineProperty(window, 'location', {
    value: { href: '/profile/settings', origin: 'http://localhost', pathname: '/profile/settings' },
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  cleanup();
  delete (window as typeof window & { logout?: () => void }).logout;
});

describe('ProfileAccountIsland', () => {
  it('renders an Account card with the Logout action and nothing else destructive', () => {
    const { container, getByText } = render(<ProfileAccountIsland />);

    expect(container.querySelector('.profile-account-card')).toBeTruthy();
    expect(getByText('Account')).toBeTruthy();
    expect(getByText('Logout')).toBeTruthy();
    expect(container.querySelector('#save-profile-btn')).toBeNull();
    expect(container.querySelector('.profile-card-footer')).toBeNull();
  });

  it('owns the logout flow through window.logout', () => {
    const mockLogout = vi.fn();
    (window as typeof window & { logout?: () => void }).logout = mockLogout;

    const { getByText } = render(<ProfileAccountIsland />);
    fireEvent.click(getByText('Logout'));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
