import { useState, useEffect } from 'preact/hooks';

interface PasswordResetIslandProps {
  mode: 'request' | 'reset';
}

export function PasswordResetIsland({ mode }: PasswordResetIslandProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (mode === 'reset') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlToken = urlParams.get('token');
      if (urlToken) {
        setToken(urlToken);
      } else {
        setError('Invalid or missing reset token. Please request a new password reset.');
      }
    }
  }, [mode]);

  const handleRequestSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/password-reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message);
        setEmail('');
      } else {
        setError(data.error || 'Password reset request failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  const handleResetSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Invalid or missing reset token');
      return;
    }

    try {
      const response = await fetch('/api/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(data.message + ' Redirecting to login...');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setError(data.error || 'Password reset failed');
      }
    } catch {
      setError('Network error. Please try again.');
    }
  };

  // Password strength checks
  const isLengthValid = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (mode === 'request') {
    return (
      <div class="auth-forms">
        <div class="auth-form active">
          <h2>Reset Your Password</h2>
          <p>Enter your email address and we'll generate a password reset token for you.</p>
          <form id="password-reset-request-form" onSubmit={handleRequestSubmit}>
            <div class="form-group">
              <label for="reset-email">Email</label>
              <input
                type="email"
                id="reset-email"
                name="email"
                required
                autocomplete="email"
                value={email}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
              />
            </div>
            <div id="reset-error" class="error-message">{error}</div>
            <div id="reset-success" class="success-message">{success}</div>
            <button type="submit" class="btn-primary">Request Password Reset</button>
          </form>
          <p class="auth-toggle">
            <a href="/login">Back to Login</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div class="auth-forms">
      <div class="auth-form active">
        <h2>Set Your New Password</h2>
        <form id="password-reset-form" onSubmit={handleResetSubmit}>
          <input type="hidden" id="reset-token" name="token" value={token} />
          <div class="form-group">
            <label for="new-password">New Password</label>
            <input
              type="password"
              id="new-password"
              name="password"
              required
              autocomplete="new-password"
              value={password}
              onInput={(e) => setPassword((e.target as HTMLInputElement).value)}
            />
            <small>At least 8 characters with uppercase, lowercase, and number/symbol</small>
          </div>
          <div id="password-strength" class="password-strength">
            <div class={`strength-item ${isLengthValid ? 'valid' : ''}`} id="strength-length">
              {isLengthValid ? '✓' : '✗'} At least 8 characters
            </div>
            <div class={`strength-item ${hasUpper ? 'valid' : ''}`} id="strength-upper">
              {hasUpper ? '✓' : '✗'} One uppercase letter
            </div>
            <div class={`strength-item ${hasLower ? 'valid' : ''}`} id="strength-lower">
              {hasLower ? '✓' : '✗'} One lowercase letter
            </div>
            <div class={`strength-item ${hasNumber ? 'valid' : ''}`} id="strength-number">
              {hasNumber ? '✓' : '✗'} One number or symbol
            </div>
          </div>
          <div id="reset-error" class="error-message">{error}</div>
          <div id="reset-success" class="success-message">{success}</div>
          <button type="submit" class="btn-primary">Set New Password</button>
        </form>
        <p class="auth-toggle">
          <a href="/login">Back to Login</a>
        </p>
      </div>
    </div>
  );
}
