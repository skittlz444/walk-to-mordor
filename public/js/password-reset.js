// Password reset frontend JavaScript
(function() {
  'use strict';

  const API_BASE = '/api';
  
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
      if (element) {
        if (checks[id]) {
          element.classList.add('valid');
          element.textContent = element.textContent.replace('✗', '✓');
        } else {
          element.classList.remove('valid');
          element.textContent = element.textContent.replace('✓', '✗');
        }
      }
    });
  }
  
  // Handle password reset request form submission
  async function handlePasswordResetRequest(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('reset-error');
    const successDiv = document.getElementById('reset-success');
    errorDiv.textContent = '';
    successDiv.textContent = '';
    
    const formData = new FormData(e.target);
    const email = formData.get('email');
    
    try {
      const response = await fetch(`${API_BASE}/password-reset-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        successDiv.textContent = data.message;
        
        // Clear form
        e.target.reset();
      } else {
        errorDiv.textContent = data.error || 'Password reset request failed';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Password reset request error:', error);
    }
  }
  
  // Handle password reset form submission
  async function handlePasswordReset(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('reset-error');
    const successDiv = document.getElementById('reset-success');
    errorDiv.textContent = '';
    successDiv.textContent = '';
    
    const formData = new FormData(e.target);
    const token = formData.get('token');
    const password = formData.get('password');
    
    if (!token) {
      errorDiv.textContent = 'Invalid or missing reset token';
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        successDiv.textContent = data.message + ' Redirecting to login...';
        // Redirect to login after 2 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        errorDiv.textContent = data.error || 'Password reset failed';
      }
    } catch (error) {
      errorDiv.textContent = 'Network error. Please try again.';
      console.error('Password reset error:', error);
    }
  }
  
  // Initialize event listeners
  function init() {
    // Check which form is present
    const requestForm = document.getElementById('password-reset-request-form');
    const resetForm = document.getElementById('password-reset-form');
    
    if (requestForm) {
      requestForm.addEventListener('submit', handlePasswordResetRequest);
    }
    
    if (resetForm) {
      resetForm.addEventListener('submit', handlePasswordReset);
      
      // Password strength indicator
      const passwordInput = document.getElementById('new-password');
      if (passwordInput) {
        passwordInput.addEventListener('input', (e) => {
          updatePasswordStrength(e.target.value);
        });
      }
      
      // Get token from URL query parameter
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const tokenInput = document.getElementById('reset-token');
      if (token && tokenInput) {
        tokenInput.value = token;
      } else if (!token) {
        const errorDiv = document.getElementById('reset-error');
        if (errorDiv) {
          errorDiv.textContent = 'Invalid or missing reset token. Please request a new password reset.';
        }
      }
    }
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
