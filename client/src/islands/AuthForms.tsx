
import { useSignal } from '@preact/signals';
import { useEffect } from 'preact/hooks';

type ViewState = 'login' | 'register' | 'forgot-password';

export function AuthForms() {
  const view = useSignal<ViewState>('login');
  const error = useSignal<string>('');
  const success = useSignal<string>('');
  const isLoading = useSignal<boolean>(false);
  
  // Form Data
  const username = useSignal('');
  const email = useSignal('');
  const password = useSignal('');

  // Password Strength
  const showPasswordStrength = useSignal(false);

  const showResendInput = useSignal(false);

  useEffect(() => {
    // Check URL parameters on mount
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
      success.value = 'Email verified! You can now log in.';
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    const errorParam = urlParams.get('error');
    if (errorParam) {
        if (errorParam.includes('token')) {
            error.value = 'Confirmation token invalid or expired. Please login to request a new one.';
        } else {
            error.value = decodeURIComponent(errorParam);
        }
        window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const resetForm = () => {
    error.value = '';
    success.value = '';
    username.value = '';
    email.value = '';
    password.value = '';
    showPasswordStrength.value = false;
    showResendInput.value = false;
  };

  const switchView = (newView: ViewState) => {
    resetForm();
    view.value = newView;
  };

  const handleLogin = async (e: Event) => {
    e.preventDefault();
    error.value = '';
    success.value = '';
    isLoading.value = true;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.value, password: password.value })
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('sessionToken', data.sessionId);
        window.location.href = '/';
      } else {
        error.value = data.error || 'Login failed';
        
        // Handle "Email not verified" specific case
        if (response.status === 403 && data.error && data.error.includes('verified')) {
           // We keep the error message but maybe add a specific action button in the UI?
           // The error message itself from API is "Email not verified. Please check your email..."
           // We can add a "Resend" button if we detect this.
           
           // If the API returned the email, pre-fill it
           if (data.email) {
             email.value = data.email;
           }
        }
      }
    } catch (err) {
      error.value = 'Network error. Please try again.';
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  };

  const handleRegister = async (e: Event) => {
    e.preventDefault();
    error.value = '';
    success.value = '';
    isLoading.value = true;

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: username.value, 
          email: email.value, 
          password: password.value 
        })
      });

      const data = await response.json();

      if (response.ok) {
        success.value = data.message;
        
        if (!data.requiresApproval && !data.requiresEmailConfirmation) {
           // Auto login case (first user)
           setTimeout(() => switchView('login'), 2000);
        } else if (data.requiresEmailConfirmation) {
            // Stay on register or specific success state?
            // Usually switch to login so they can see the message there or stay here.
            // Let's clear form but show success
            username.value = '';
            email.value = '';
            password.value = '';
        }
      } else {
        error.value = data.error || 'Registration failed';
      }
    } catch (err) {
      error.value = 'Network error. Please try again.';
      console.error(err);
    } finally {
      isLoading.value = false;
    }
  };

  const handleResendConfirmation = async () => {
    const emailToSend = email.value;
    
    if (!emailToSend) {
        // If email is missing, show input
        showResendInput.value = true;
        return;
    }

    isLoading.value = true;
    try {
        const response = await fetch('/api/auth/resend-confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: emailToSend })
        });
        const data = await response.json();
        if (response.ok) {
            success.value = data.message;
            error.value = '';
            showResendInput.value = false;
        } else {
            error.value = data.error || 'Failed to resend';
        }
    } catch (_err) {
        error.value = 'Network error';
    } finally {
        isLoading.value = false;
    }
  };
  
  const handlePasswordResetRequest = async (e: Event) => {
    e.preventDefault();
    error.value = '';
    success.value = '';
    isLoading.value = true;

    try {
        const response = await fetch('/api/password-reset-request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email.value })
        });
        
        const data = await response.json();
        if (response.ok) {
            success.value = data.message;
        } else {
            error.value = data.error || 'Request failed';
        }
    } catch (_err) {
        error.value = 'Network error';
    } finally {
        isLoading.value = false;
    }
  };

  // Password validation helpers
  const isLengthValid = password.value.length >= 8;
  const hasUpper = /[A-Z]/.test(password.value);
  const hasLower = /[a-z]/.test(password.value);
  const hasNumber = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password.value);

  return (
    <div className="auth-forms">
      {/* LOGIN VIEW */}
      {view.value === 'login' && (
        <div id="login-form-container" className="auth-form active">
          <h2>Login</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="login-username">Username</label>
              <input 
                type="text" 
                id="login-username" 
                value={username}
                onInput={(e) => username.value = (e.target as HTMLInputElement).value}
                required 
                autoComplete="username" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="login-password">Password</label>
              <input 
                type="password" 
                id="login-password" 
                value={password}
                onInput={(e) => password.value = (e.target as HTMLInputElement).value}
                required 
                autoComplete="current-password" 
              />
            </div>
            
            {success.value && <div className="success-message auth-message-visible">{success.value}</div>}
            {error.value && (
                <div className="error-message auth-message-visible">
                    {error.value}
                    {error.value.includes('verified') && (
                        <div className="resend-button-container">
                            <button 
                                type="button" 
                                className="resend-btn" 
                                onClick={handleResendConfirmation}
                            >
                                Resend Confirmation Email
                            </button>
                        </div>
                    )}
                </div>
            )}
            {!success.value && !error.value.includes('verified') && (
              <div className="resend-section">
                {!showResendInput.value ? (
                  <button 
                    type="button" 
                    className="resend-btn resend-btn-full" 
                    onClick={handleResendConfirmation}
                  >
                    Resend Confirmation Email
                  </button>
                ) : (
                  <div className="resend-input-group">
                    <input 
                      type="email" 
                      placeholder="Confirm your email"
                      value={email}
                      onInput={(e) => email.value = (e.currentTarget as HTMLInputElement).value}
                      className="resend-email-input"
                    />
                    <button 
                      type="button"
                      onClick={handleResendConfirmation}
                      className="resend-send-btn"
                    >
                      Send
                    </button>
                  </div>
                )}
              </div>
            )}

            <button type="submit" className="btn-primary btn-submit" disabled={isLoading.value}>
              {isLoading.value ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <p className="auth-toggle">
            <a href="/password-reset">Forgot Password?</a>
          </p>
          <p className="auth-toggle">
            Don't have an account? <a href="#" id="show-register" onClick={(e) => { e.preventDefault(); switchView('register'); }}>Register here</a>
          </p>
        </div>
      )}

      {/* REGISTER VIEW */}
      {view.value === 'register' && (
        <div id="register-form-container" className="auth-form active">
          <h2>Register</h2>
          <form id="register-form" onSubmit={handleRegister}>
            <div className="form-group">
              <label htmlFor="register-username">Username</label>
              <input 
                type="text" 
                id="register-username"
                value={username}
                onInput={(e) => username.value = (e.target as HTMLInputElement).value}
                required 
                autoComplete="username"
                pattern="[a-zA-Z0-9_]{3,30}"
                title="3-30 characters, letters, numbers, and underscores only"
              />
              <small>3-30 characters, letters, numbers, and underscores only</small>
            </div>
            <div className="form-group">
              <label htmlFor="register-email">Email</label>
              <input 
                type="email" 
                id="register-email" 
                value={email}
                onInput={(e) => email.value = (e.target as HTMLInputElement).value}
                required 
                autoComplete="email" 
              />
            </div>
            <div className="form-group">
              <label htmlFor="register-password">Password</label>
              <input 
                type="password" 
                id="register-password" 
                value={password}
                onFocus={() => showPasswordStrength.value = true}
                onInput={(e) => password.value = (e.target as HTMLInputElement).value}
                required 
                autoComplete="new-password" 
              />
              <small>At least 8 characters with uppercase, lowercase, and number/symbol</small>
            </div>

            {showPasswordStrength.value && (
                <div id="password-strength" className="password-strength">
                  <div className={`strength-item ${isLengthValid ? 'valid' : ''}`}>
                    {isLengthValid ? '✓' : '✗'} At least 8 characters
                  </div>
                  <div className={`strength-item ${hasUpper ? 'valid' : ''}`}>
                    {hasUpper ? '✓' : '✗'} One uppercase letter
                  </div>
                  <div className={`strength-item ${hasLower ? 'valid' : ''}`}>
                    {hasLower ? '✓' : '✗'} One lowercase letter
                  </div>
                  <div className={`strength-item ${hasNumber ? 'valid' : ''}`}>
                    {hasNumber ? '✓' : '✗'} One number or symbol
                  </div>
                </div>
            )}

            {error.value && <div className="error-message auth-message-visible">{error.value}</div>}
            {success.value && <div className="success-message auth-message-visible">{success.value}</div>}

            <button type="submit" className="btn-primary" disabled={isLoading.value}>
                {isLoading.value ? 'Registering...' : 'Register'}
            </button>
          </form>
          <p className="auth-toggle">
            Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); switchView('login'); }}>Login here</a>
          </p>
        </div>
      )}

      {/* FORGOT PASSWORD VIEW */}
      {view.value === 'forgot-password' && (
        <div id="forgot-password-form-container" className="auth-form active">
            <h2>Reset Password</h2>
            <form onSubmit={handlePasswordResetRequest}>
                <div className="form-group">
                    <label htmlFor="reset-email">Email</label>
                    <input 
                        type="email" 
                        id="reset-email" 
                        value={email}
                        onInput={(e) => email.value = (e.target as HTMLInputElement).value}
                        required 
                        autoComplete="email" 
                    />
                </div>
                
                {error.value && <div className="error-message auth-message-visible">{error.value}</div>}
                {success.value && <div className="success-message auth-message-visible">{success.value}</div>}
                
                <button type="submit" className="btn-primary" disabled={isLoading.value}>
                    {isLoading.value ? 'Sending...' : 'Send Reset Link'}
                </button>
            </form>
            <p className="auth-toggle">
                <a href="#" onClick={(e) => { e.preventDefault(); switchView('login'); }}>Back to Login</a>
            </p>
        </div>
      )}
    </div>
  );
}
