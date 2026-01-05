// Authentication frontend JavaScript
(function() {
  'use strict';

  const API_BASE = '/api';
  
  // Get session token from localStorage
  function getSessionToken() {
    return localStorage.getItem('sessionToken');
  }
  
  // Set session token in localStorage
  function setSessionToken(token) {
    localStorage.setItem('sessionToken', token);
  }
  
  // Clear session token
  function clearSessionToken() {
    localStorage.removeItem('sessionToken');
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
    errorDiv.textContent = '';
    
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
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Login error:', error);
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
        if (data.requiresApproval) {
          successDiv.textContent = data.message;
          // Clear form
          e.target.reset();
        } else {
          // First user - automatically approved
          successDiv.textContent = data.message + ' Redirecting to login...';
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
