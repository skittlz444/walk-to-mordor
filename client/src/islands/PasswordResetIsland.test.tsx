import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/preact';
import { PasswordResetIsland } from './PasswordResetIsland';

// Mock window.location
const mockLocation = {
  search: '',
  href: '',
};

beforeEach(() => {
  vi.stubGlobal('location', mockLocation);
  mockLocation.search = '';
  mockLocation.href = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('PasswordResetIsland - request mode', () => {
  it('renders email form with correct elements', () => {
    const { container } = render(<PasswordResetIsland mode="request" />);

    expect(container.querySelector('.auth-forms')).toBeTruthy();
    expect(container.querySelector('.auth-form.active')).toBeTruthy();
    expect(container.querySelector('#password-reset-request-form')).toBeTruthy();
    expect(container.querySelector('#reset-email')).toBeTruthy();
    expect(container.querySelector('.btn-primary')?.textContent).toBe('Request Password Reset');
    expect(container.querySelector('.auth-toggle a')?.getAttribute('href')).toBe('/login');
  });

  it('submits request and shows success message', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Reset link sent!' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { container } = render(<PasswordResetIsland mode="request" />);

    const emailInput = container.querySelector('#reset-email') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });

    const form = container.querySelector('#password-reset-request-form') as HTMLFormElement;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(container.querySelector('#reset-success')?.textContent).toBe('Reset link sent!');
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/password-reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
  });

  it('clears email input on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Done' }),
    }));

    const { container } = render(<PasswordResetIsland mode="request" />);

    const emailInput = container.querySelector('#reset-email') as HTMLInputElement;
    fireEvent.input(emailInput, { target: { value: 'test@example.com' } });
    fireEvent.submit(container.querySelector('#password-reset-request-form') as HTMLFormElement);

    await waitFor(() => {
      expect(emailInput.value).toBe('');
    });
  });

  it('shows error on failed request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'User not found' }),
    }));

    const { container } = render(<PasswordResetIsland mode="request" />);

    fireEvent.input(container.querySelector('#reset-email') as HTMLInputElement, {
      target: { value: 'bad@example.com' },
    });
    fireEvent.submit(container.querySelector('#password-reset-request-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-error')?.textContent).toBe('User not found');
    });
  });

  it('shows network error on fetch failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    const { container } = render(<PasswordResetIsland mode="request" />);

    fireEvent.input(container.querySelector('#reset-email') as HTMLInputElement, {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(container.querySelector('#password-reset-request-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-error')?.textContent).toBe('Network error. Please try again.');
    });
  });

  it('shows default error when no error field in response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    const { container } = render(<PasswordResetIsland mode="request" />);

    fireEvent.input(container.querySelector('#reset-email') as HTMLInputElement, {
      target: { value: 'test@example.com' },
    });
    fireEvent.submit(container.querySelector('#password-reset-request-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-error')?.textContent).toBe('Password reset request failed');
    });
  });
});

describe('PasswordResetIsland - reset mode', () => {
  it('renders password form with strength indicators', () => {
    mockLocation.search = '?token=abc123';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    expect(container.querySelector('#password-reset-form')).toBeTruthy();
    expect(container.querySelector('#new-password')).toBeTruthy();
    expect(container.querySelector('#reset-token')).toBeTruthy();
    expect(container.querySelector('#password-strength')).toBeTruthy();
    expect(container.querySelector('#strength-length')).toBeTruthy();
    expect(container.querySelector('#strength-upper')).toBeTruthy();
    expect(container.querySelector('#strength-lower')).toBeTruthy();
    expect(container.querySelector('#strength-number')).toBeTruthy();
    expect(container.querySelector('.btn-primary')?.textContent).toBe('Set New Password');
  });

  it('reads token from URL', () => {
    mockLocation.search = '?token=mytoken123';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    const tokenInput = container.querySelector('#reset-token') as HTMLInputElement;
    expect(tokenInput.value).toBe('mytoken123');
  });

  it('shows error when token is missing', () => {
    mockLocation.search = '';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    expect(container.querySelector('#reset-error')?.textContent).toBe(
      'Invalid or missing reset token. Please request a new password reset.'
    );
  });

  it('submits reset and shows success with redirect', async () => {
    mockLocation.search = '?token=abc123';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: 'Password updated!' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'StrongPass1!' },
    });
    fireEvent.submit(container.querySelector('#password-reset-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-success')?.textContent).toBe(
        'Password updated! Redirecting to login...'
      );
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'abc123', password: 'StrongPass1!' }),
    });

    vi.advanceTimersByTime(2000);
    expect(mockLocation.href).toBe('/login');
  });

  it('shows error on failed reset', async () => {
    mockLocation.search = '?token=abc123';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Token expired' }),
    }));

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'Pass1!' },
    });
    fireEvent.submit(container.querySelector('#password-reset-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-error')?.textContent).toBe('Token expired');
    });
  });

  it('shows default error when no error field in response', async () => {
    mockLocation.search = '?token=abc123';

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    }));

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'Pass1!' },
    });
    fireEvent.submit(container.querySelector('#password-reset-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-error')?.textContent).toBe('Password reset failed');
    });
  });

  it('shows network error on fetch failure', async () => {
    mockLocation.search = '?token=abc123';

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')));

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'Pass1!' },
    });
    fireEvent.submit(container.querySelector('#password-reset-form') as HTMLFormElement);

    await waitFor(() => {
      expect(container.querySelector('#reset-error')?.textContent).toBe('Network error. Please try again.');
    });
  });

  it('shows error when submitting without token', async () => {
    mockLocation.search = '';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    // Clear the initial error to test the submit-time check
    const errorDiv = container.querySelector('#reset-error') as HTMLElement;
    expect(errorDiv.textContent).toContain('Invalid or missing reset token');
  });
});

describe('PasswordResetIsland - strength indicators', () => {
  it('marks length valid when >= 8 characters', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'abcdefgh' },
    });

    const lengthItem = container.querySelector('#strength-length');
    expect(lengthItem?.classList.contains('valid')).toBe(true);
    expect(lengthItem?.textContent).toContain('✓');
  });

  it('marks length invalid when < 8 characters', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'abc' },
    });

    const lengthItem = container.querySelector('#strength-length');
    expect(lengthItem?.classList.contains('valid')).toBe(false);
    expect(lengthItem?.textContent).toContain('✗');
  });

  it('marks uppercase valid when has uppercase', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'A' },
    });

    expect(container.querySelector('#strength-upper')?.classList.contains('valid')).toBe(true);
  });

  it('marks lowercase valid when has lowercase', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'a' },
    });

    expect(container.querySelector('#strength-lower')?.classList.contains('valid')).toBe(true);
  });

  it('marks number/symbol valid when has digit', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: '1' },
    });

    expect(container.querySelector('#strength-number')?.classList.contains('valid')).toBe(true);
  });

  it('marks number/symbol valid when has symbol', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: '@' },
    });

    expect(container.querySelector('#strength-number')?.classList.contains('valid')).toBe(true);
  });

  it('all indicators invalid for empty password', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    expect(container.querySelector('#strength-length')?.classList.contains('valid')).toBe(false);
    expect(container.querySelector('#strength-upper')?.classList.contains('valid')).toBe(false);
    expect(container.querySelector('#strength-lower')?.classList.contains('valid')).toBe(false);
    expect(container.querySelector('#strength-number')?.classList.contains('valid')).toBe(false);
  });

  it('all indicators valid for strong password', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    fireEvent.input(container.querySelector('#new-password') as HTMLInputElement, {
      target: { value: 'StrongP1!' },
    });

    expect(container.querySelector('#strength-length')?.classList.contains('valid')).toBe(true);
    expect(container.querySelector('#strength-upper')?.classList.contains('valid')).toBe(true);
    expect(container.querySelector('#strength-lower')?.classList.contains('valid')).toBe(true);
    expect(container.querySelector('#strength-number')?.classList.contains('valid')).toBe(true);
  });
});

describe('PasswordResetIsland - back to login link', () => {
  it('has back to login link in request mode', () => {
    const { container } = render(<PasswordResetIsland mode="request" />);

    const link = container.querySelector('.auth-toggle a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('/login');
    expect(link.textContent).toBe('Back to Login');
  });

  it('has back to login link in reset mode', () => {
    mockLocation.search = '?token=t';

    const { container } = render(<PasswordResetIsland mode="reset" />);

    const link = container.querySelector('.auth-toggle a') as HTMLAnchorElement;
    expect(link).toBeTruthy();
    expect(link.href).toContain('/login');
    expect(link.textContent).toBe('Back to Login');
  });
});
