// Authentication frontend JavaScript
(function() {
  'use strict';

  const API_BASE = '/api';
  
  // Set session token in localStorage
  function setSessionToken(token) {
    localStorage.setItem('sessionToken', token);
  }
  
  // Show/hide form containers
  function showLogin() {
    document.getElementById('login-form-container').classList.add('active');
    document.getElementById('register-form-container').classList.remove('active');
  }
  
  function showRegister() {
    document.getElementById('register-form-container').classList.add('active');
    document.getElementById('login-form-container').classList.remove('active');
  }
  
  // Password strength checker
  function updatePasswordStrength(password) {
    const checks = {
      'strength-length': password.length >= 8,
      'strength-upper': /[A-Z]/.test(password),
      'strength-lower': /[a-z]/.test(password),
      'strength-number': /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
    };
    
    Object.keys(checks).forEach(id => {
      const element = document.getElementById(id);
      if (checks[id]) {
        element.classList.add('valid');
        element.textContent = element.textContent.replace('✗', '✓');
      } else {
        element.classList.remove('valid');
        element.textContent = element.textContent.replace('✓', '✗');
      }
    });
  }
  
  // Handle login form submission
  async function handleLogin(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('login-error');
    const successDiv = document.getElementById('login-success');
    errorDiv.textContent = '';
    if (successDiv) successDiv.textContent = '';
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const password = formData.get('password');
    
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        // Store session token
        setSessionToken(data.sessionId);
        
        // Redirect to main app
        window.location.href = '/';
      } else {
        errorDiv.textContent = data.error || 'Login failed';
        
        // If email not verified, show resend option
        if (response.status === 403 && data.error.includes('Email not verified')) {
          const resendBtn = document.createElement('button');
          resendBtn.textContent = 'Resend Confirmation Email';
          resendBtn.className = 'resend-btn';
          resendBtn.style.marginTop = '10px';
          resendBtn.addEventListener('click', () => handleResendConfirmation(username));
          errorDiv.appendChild(document.createElement('br'));
          errorDiv.appendChild(resendBtn);
        }
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Login error:', error);
    }
  }
  
  // Handle resend confirmation email
  async function handleResendConfirmation(username) {
    const errorDiv = document.getElementById('login-error');
    const successDiv = document.getElementById('login-success');
    
    errorDiv.textContent = '';
    
    // TODO: Replace prompt() with a proper modal for better UX and accessibility
    // For MVP, using prompt() as a minimal solution
    const email = prompt('Please enter your email address to resend the confirmation:');
    if (!email) return;
    
    try {
      const response = await fetch(`${API_BASE}/auth/resend-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (successDiv) {
          successDiv.textContent = data.message;
          successDiv.style.display = 'block';
        }
        errorDiv.textContent = '';
      } else {
        errorDiv.textContent = data.error || 'Failed to resend confirmation';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Resend confirmation error:', error);
    }
  }
  
  // Handle registration form submission
  async function handleRegister(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');
    errorDiv.textContent = '';
    successDiv.textContent = '';
    
    const formData = new FormData(e.target);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    
    try {
      const response = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, email, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        successDiv.textContent = data.message;
        // Clear form
        e.target.reset();
        
        if (!data.requiresApproval && !data.requiresEmailConfirmation) {
          // First user - automatically approved and verified
          successDiv.textContent += ' Redirecting to login...';
          setTimeout(() => {
            showLogin();
          }, 2000);
        }
      } else {
        errorDiv.textContent = data.error || 'Registration failed';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Registration error:', error);
    }
  }
  
  // Initialize event listeners
  function init() {
    // Check for verified parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('verified') === 'true') {
      const successDiv = document.getElementById('login-success');
      if (successDiv) {
        successDiv.textContent = 'Email verified! You can now log in.';
        successDiv.style.display = 'block';
      }
      // Remove the parameter from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    // Form submissions
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    
    // Toggle forms
    document.getElementById('show-register').addEventListener('click', (e) => {
      e.preventDefault();
      showRegister();
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      showLogin();
    });
    
    // Password strength indicator
    document.getElementById('register-password').addEventListener('input', (e) => {
      updatePasswordStrength(e.target.value);
    });
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
