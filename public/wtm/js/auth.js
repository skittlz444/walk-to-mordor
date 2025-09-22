// Authentication JavaScript functions

// Show login form
function showLogin() {
  hideAllForms();
  document.getElementById('login-form').classList.add('active');
  clearMessage();
}

// Show register form
function showRegister() {
  hideAllForms();
  document.getElementById('register-form').classList.add('active');
  clearMessage();
}

// Show password reset form
function showPasswordReset() {
  hideAllForms();
  document.getElementById('password-reset-form').classList.add('active');
  clearMessage();
}

// Hide all forms
function hideAllForms() {
  document.querySelectorAll('.auth-form').forEach(form => {
    form.classList.remove('active');
  });
}

// Clear message
function clearMessage() {
  const messageEl = document.getElementById('auth-message');
  messageEl.style.display = 'none';
  messageEl.className = 'auth-message';
  messageEl.textContent = '';
}

// Show message
function showMessage(text, type = 'info') {
  const messageEl = document.getElementById('auth-message');
  messageEl.textContent = text;
  messageEl.className = `auth-message ${type}`;
  messageEl.style.display = 'block';
}

// Handle login form submission
async function handleLogin(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const data = {
    username: formData.get('username'),
    password: formData.get('password')
  };
  
  // Disable submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Logging in...';
  
  try {
    const response = await fetch('/wtm/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showMessage('Login successful! Redirecting...', 'success');
      // Redirect to main page after successful login
      setTimeout(() => {
        window.location.href = '/wtm/';
      }, 1000);
    } else {
      showMessage(result.error || 'Login failed', 'error');
    }
  } catch (error) {
    console.error('Login error:', error);
    showMessage('Network error. Please try again.', 'error');
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = 'Login';
  }
}

// Handle register form submission
async function handleRegister(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const data = {
    username: formData.get('username'),
    email: formData.get('email'),
    password: formData.get('password')
  };
  
  // Disable submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Registering...';
  
  try {
    const response = await fetch('/wtm/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showMessage('Registration successful! Redirecting...', 'success');
      // Redirect to main page after successful registration
      setTimeout(() => {
        window.location.href = '/wtm/';
      }, 1000);
    } else {
      showMessage(result.error || 'Registration failed', 'error');
    }
  } catch (error) {
    console.error('Registration error:', error);
    showMessage('Network error. Please try again.', 'error');
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = 'Register';
  }
}

// Handle password reset form submission
async function handlePasswordReset(event) {
  event.preventDefault();
  
  const form = event.target;
  const formData = new FormData(form);
  const data = {
    email: formData.get('email')
  };
  
  // Disable submit button
  const submitBtn = form.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending...';
  
  try {
    const response = await fetch('/wtm/api/auth/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (response.ok) {
      showMessage(result.message || 'Password reset link sent if account exists', 'success');
      form.reset();
    } else {
      showMessage(result.error || 'Password reset failed', 'error');
    }
  } catch (error) {
    console.error('Password reset error:', error);
    showMessage('Network error. Please try again.', 'error');
  } finally {
    // Re-enable submit button
    submitBtn.disabled = false;
    submitBtn.textContent = 'Send Reset Link';
  }
}

// Handle logout (for authenticated pages)
async function handleLogout() {
  try {
    const response = await fetch('/wtm/api/auth/logout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Redirect to login page regardless of response
    window.location.href = '/wtm/';
  } catch (error) {
    console.error('Logout error:', error);
    // Still redirect on error
    window.location.href = '/wtm/';
  }
}

// Check authentication status (for use in main app)
async function checkAuth() {
  try {
    const response = await fetch('/wtm/api/auth/me');
    if (response.ok) {
      const result = await response.json();
      return result.user;
    }
    return null;
  } catch (error) {
    console.error('Auth check error:', error);
    return null;
  }
}