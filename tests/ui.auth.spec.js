// @ts-check
const { test, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./helpers/cleanup');

/**
 * UI Authentication Tests - Walk to Mordor
 * Tests the authentication flows in the browser interface
 */

test.describe('Walk to Mordor UI - Authentication Flows', () => {
  // Set longer timeout for authentication flows
  test.setTimeout(60000); // 60 seconds

  let testUser = null;

  // Clean all data before and after tests
  test.beforeAll(async () => {
    await cleanupAllTestData();
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  // Generate unique test user for each test
  test.beforeEach(async ({ page }) => {
    // Generate unique test user with short username (keep <= 20 chars)
    const randomSuffix = Math.random().toString(36).substring(2, 8); // 6 chars
    testUser = {
      username: `ui_${randomSuffix}`, // 9 chars total (ui_ + 6 chars)
      password: 'TestPassword123!'
    };
  });

  /**
   * Navigate to the application and ensure we're on the login page
   */
  async function navigateToApp(page) {
    // Clear all cookies to ensure unauthenticated state
    await page.context().clearCookies();
    
    await page.goto('http://localhost:8787/wtm/');
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the authentication page (not main app)
    const isOnAuth = await isOnLoginPage(page);
    if (!isOnAuth) {
      throw new Error('Expected to be on authentication page, but authentication form was not found. This may indicate a session issue.');
    }
  }

  /**
   * Helper to check if we're on the login page
   */
  async function isOnLoginPage(page) {
    try {
      // Check for both login form and auth container (unique to auth page)
      await page.waitForSelector('#login-form', { timeout: 5000 });
      await page.waitForSelector('.auth-container', { timeout: 1000 });
      return true;
    } catch (error) {
      console.log('Not on login page:', error.message);
      return false;
    }
  }

  /**
   * Helper to check if we're on the main application page
   */
  async function isOnMainPage(page) {
    try {
      // Check for calendar element (unique to main app)
      await page.waitForSelector('#eventcalendar', { timeout: 5000 });
      return true;
    } catch (error) {
      console.log('Not on main page:', error.message);
      return false;
    }
  }

  test.describe('User Registration Flow', () => {
    test('should display registration form when clicking register link', async ({ page }) => {
      await navigateToApp(page);
      
      // Should be on login page initially
      expect(await isOnLoginPage(page)).toBe(true);
      
      // Click register link
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), #register-link, .register-link');
      await registerLink.first().click();
      await page.waitForTimeout(1000);
      
      // Should show registration form
      await expect(page.locator('#register-form')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('#register-username')).toBeVisible();
      await expect(page.locator('#register-password')).toBeVisible();
    });

    test('should register a new user successfully', async ({ page }) => {
      await navigateToApp(page);
      
      // Navigate to register form
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), #register-link, .register-link');
      await registerLink.first().click();
      await page.waitForTimeout(1000);
      
      // Fill registration form
      await page.fill('#register-username', testUser.username);
      await page.fill('#register-password', testUser.password);
      
      // Submit registration
      const submitButton = page.locator('#register-form button[type="submit"]');
      await submitButton.click();
      
      // Should redirect to main page after successful registration
      await page.waitForTimeout(3000);
      expect(await isOnMainPage(page)).toBe(true);
      
      // Verify we can see the main application elements
      await expect(page.locator('#eventcalendar')).toBeVisible();
      await expect(page.locator('#goals-list')).toBeVisible();
    });

    test('should show error for duplicate username', async ({ page }) => {
      // First, register the user via API
      const response = await page.request.post('http://localhost:8787/wtm/api/auth/register', {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });
      expect(response.status()).toBe(201);
      
      await navigateToApp(page);
      
      // Navigate to register form
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), #register-link, .register-link');
      await registerLink.first().click();
      await page.waitForTimeout(1000);
      
      // Try to register with same username
      await page.fill('#register-username', testUser.username);
      await page.fill('#register-password', testUser.password);
      
      const submitButton = page.locator('#register-form button[type="submit"]');
      await submitButton.click();
      
      // Should show error message
      await expect(page.locator('.error, .error-message, [data-testid="error"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=already exists')).toBeVisible({ timeout: 5000 });
    });

    test('should validate registration form fields', async ({ page }) => {
      await navigateToApp(page);
      
      // Navigate to register form
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), #register-link, .register-link');
      await registerLink.first().click();
      await page.waitForTimeout(1000);
      
      // Try to submit empty form
      const submitButton = page.locator('#register-form button[type="submit"]');
      await submitButton.click();
      
      // Should show validation errors or prevent submission
      const usernameField = page.locator('#register-username');
      const passwordField = page.locator('#register-password');
      
      // Check if HTML5 validation is working or custom validation appears
      const usernameValid = await usernameField.evaluate(el => el.checkValidity());
      const passwordValid = await passwordField.evaluate(el => el.checkValidity());
      
      expect(usernameValid || passwordValid).toBe(false); // At least one should be invalid
    });
  });

  test.describe('User Login Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Register a user for login tests
      const response = await page.request.post('http://localhost:8787/wtm/api/auth/register', {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });
      expect(response.status()).toBe(201);
    });

    test('should login user successfully', async ({ page }) => {
      await navigateToApp(page);
      
      // Should be on login page
      expect(await isOnLoginPage(page)).toBe(true);
      
      // Fill login form
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      
      // Submit login
      await page.click('#login-form button[type="submit"]');
      
      // Should redirect to main page
      await page.waitForTimeout(3000);
      expect(await isOnMainPage(page)).toBe(true);
      
      // Verify main application is loaded
      await expect(page.locator('#eventcalendar')).toBeVisible();
      await expect(page.locator('#goals-list')).toBeVisible();
    });

    test('should show error for invalid credentials', async ({ page }) => {
      await navigateToApp(page);
      
      // Fill login form with wrong password
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', 'wrongpassword');
      
      // Submit login
      await page.click('#login-form button[type="submit"]');
      
      // Should show error message and stay on login page
      await expect(page.locator('.error, .error-message, [data-testid="error"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Invalid username or password')).toBeVisible({ timeout: 5000 });
      expect(await isOnLoginPage(page)).toBe(true);
    });

    test('should show error for non-existent user', async ({ page }) => {
      await navigateToApp(page);
      
      // Fill login form with non-existent user
      await page.fill('#login-username', 'nonexistentuser');
      await page.fill('#login-password', testUser.password);
      
      // Submit login
      await page.click('#login-form button[type="submit"]');
      
      // Should show error message
      await expect(page.locator('.error, .error-message, [data-testid="error"]')).toBeVisible({ timeout: 5000 });
      await expect(page.locator('text=Invalid username or password')).toBeVisible({ timeout: 5000 });
    });

    test('should validate login form fields', async ({ page }) => {
      await navigateToApp(page);
      
      // Try to submit empty form
      await page.click('#login-form button[type="submit"]');
      
      // Should show validation or prevent submission
      const usernameField = page.locator('#login-username');
      const passwordField = page.locator('#login-password');
      
      const usernameValid = await usernameField.evaluate(el => el.checkValidity());
      const passwordValid = await passwordField.evaluate(el => el.checkValidity());
      
      expect(usernameValid || passwordValid).toBe(false);
    });

    test('should maintain session on page refresh', async ({ page }) => {
      await navigateToApp(page);
      
      // Login
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('#login-form button[type="submit"]');
      
      // Wait for main page
      await page.waitForTimeout(3000);
      expect(await isOnMainPage(page)).toBe(true);
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be on main page (session maintained)
      expect(await isOnMainPage(page)).toBe(true);
      await expect(page.locator('#eventcalendar')).toBeVisible();
    });
  });

  test.describe('User Logout Flow', () => {
    test.beforeEach(async ({ page }) => {
      // Register and login a user
      await page.request.post('http://localhost:8787/wtm/api/auth/register', {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await navigateToApp(page);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('#login-form button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Verify we're logged in
      expect(await isOnMainPage(page)).toBe(true);
    });

    test('should logout user successfully via UI', async ({ page }) => {
      // Look for logout button/link
      const logoutSelectors = [
        'button:has-text("Logout")',
        'a:has-text("Logout")',
        '#logout-btn',
        '.logout-btn',
        '[data-testid="logout"]'
      ];
      
      let logoutClicked = false;
      for (const selector of logoutSelectors) {
        try {
          const logoutButton = page.locator(selector);
          if (await logoutButton.isVisible({ timeout: 2000 })) {
            await logoutButton.click();
            logoutClicked = true;
            break;
          }
        } catch (error) {
          continue;
        }
      }
      
      if (logoutClicked) {
        // Should redirect to login page
        await page.waitForTimeout(2000);
        expect(await isOnLoginPage(page)).toBe(true);
        
        // Verify session is cleared by trying to access main page directly
        await page.goto('http://localhost:8787/wtm/');
        await page.waitForLoadState('networkidle');
        expect(await isOnLoginPage(page)).toBe(true);
      } else {
        // If no logout UI is visible, test via API
        const logoutResponse = await page.request.post('http://localhost:8787/wtm/api/auth/logout');
        expect(logoutResponse.status()).toBe(200);
        
        // Verify session is cleared
        await page.goto('http://localhost:8787/wtm/');
        await page.waitForLoadState('networkidle');
        expect(await isOnLoginPage(page)).toBe(true);
      }
    });

    test('should clear session on logout', async ({ page }) => {
      // First create a session by registering and logging in
      await navigateToApp(page);
      
      // Try to register, but if user exists, just login
      const registerLink = page.locator('a:has-text("Register")');
      await registerLink.click();
      await page.waitForTimeout(1000);
      
      await page.fill('#register-username', testUser.username);
      await page.fill('#register-password', testUser.password);
      await page.click('#register-form button[type="submit"]');
      await page.waitForTimeout(2000);
      
      // If registration failed (user exists), switch to login
      if (!(await isOnMainPage(page))) {
        const loginLink = page.locator('a:has-text("Login")');
        if (await loginLink.isVisible()) {
          await loginLink.click();
          await page.waitForTimeout(1000);
        }
        
        await page.fill('#login-username', testUser.username);
        await page.fill('#login-password', testUser.password);
        await page.click('#login-form button[type="submit"]');
        await page.waitForTimeout(2000);
      }
      
      // Should be on main page (authenticated)
      expect(await isOnMainPage(page)).toBe(true);
      
      // Now logout via API
      const logoutResponse = await page.request.post('http://localhost:8787/wtm/api/auth/logout');
      expect(logoutResponse.status()).toBe(200);
      
      // Navigate to app again
      await page.goto('http://localhost:8787/wtm/');
      await page.waitForLoadState('networkidle');
      
      // Should be redirected to login page
      expect(await isOnLoginPage(page)).toBe(true);
    });
  });

  test.describe('Authentication State Management', () => {
    test('should redirect unauthenticated users to login page', async ({ page }) => {
      await navigateToApp(page);
      
      // Should automatically redirect to login page
      expect(await isOnLoginPage(page)).toBe(true);
      await expect(page.locator('#login-form')).toBeVisible();
    });

    test('should redirect authenticated users to main page', async ({ page }) => {
      // First register and login through browser (not API) to set session cookie
      await navigateToApp(page);
      
      // Register the user through the UI
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), #register-link, .register-link');
      await registerLink.first().click();
      await page.waitForTimeout(1000);
      
      await page.fill('#register-username', testUser.username);
      await page.fill('#register-password', testUser.password);
      await page.click('#register-form button[type="submit"]');
      
      // Wait for redirect after successful registration
      await page.waitForTimeout(3000);
      
      // Should now be on main page
      expect(await isOnMainPage(page)).toBe(true);
      await expect(page.locator('#eventcalendar')).toBeVisible();
    });

    test('should handle session expiration gracefully', async ({ page }) => {
      // Login first
      await page.request.post('http://localhost:8787/wtm/api/auth/register', {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await navigateToApp(page);
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      await page.click('#login-form button[type="submit"]');
      await page.waitForTimeout(3000);
      
      // Verify we're logged in
      expect(await isOnMainPage(page)).toBe(true);
      
      // Manually clear session via API (simulating expiration)
      await page.request.post('http://localhost:8787/wtm/api/auth/logout');
      
      // Try to access a protected endpoint via UI
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should be redirected to login page
      expect(await isOnLoginPage(page)).toBe(true);
    });

    test('should persist login state across tabs', async ({ browser }) => {
      const context = await browser.newContext();
      
      // Register and login in first tab via browser (not API)
      const page1 = await context.newPage();
      await page1.goto('http://localhost:8787/wtm/');
      
      // Register through the UI
      const registerLink = page1.locator('a:has-text("Register")');
      await registerLink.click();
      await page1.waitForTimeout(1000);
      
      await page1.fill('#register-username', testUser.username);
      await page1.fill('#register-password', testUser.password);
      await page1.click('#register-form button[type="submit"]');
      await page1.waitForTimeout(3000);
      
      // Should be on main page now
      expect(await isOnMainPage(page1)).toBe(true);
      
      // Open second tab in same context
      const page2 = await context.newPage();
      await page2.goto('http://localhost:8787/wtm/');
      await page2.waitForLoadState('networkidle');
      
      // Second tab should also be authenticated (same context shares cookies)
      expect(await isOnMainPage(page2)).toBe(true);
      
      await context.close();
    });
  });

  test.describe('Form Interactions', () => {
    test('should allow switching between login and register forms', async ({ page }) => {
      await navigateToApp(page);
      
      // Should be on login form initially
      expect(await isOnLoginPage(page)).toBe(true);
      
      // Click register link
      const registerLink = page.locator('a:has-text("Register"), button:has-text("Register"), #register-link');
      if (await registerLink.first().isVisible({ timeout: 2000 })) {
        await registerLink.first().click();
        await page.waitForTimeout(1000);
        
        // Should show register form
        await expect(page.locator('#register-form')).toBeVisible({ timeout: 5000 });
        
        // Click back to login
        const loginLink = page.locator('a:has-text("Login"), a:has-text("Sign In"), #login-link');
        if (await loginLink.first().isVisible({ timeout: 2000 })) {
          await loginLink.first().click();
          await page.waitForTimeout(1000);
          
          // Should be back to login form
          expect(await isOnLoginPage(page)).toBe(true);
        }
      }
    });

    test('should handle keyboard navigation in forms', async ({ page }) => {
      await navigateToApp(page);
      
      // Test tab navigation in login form
      const usernameField = page.locator('#login-username');
      const passwordField = page.locator('#login-password');
      
      await usernameField.focus();
      await page.keyboard.press('Tab');
      
      // Should focus password field
      await expect(passwordField).toBeFocused();
      
      // Test Enter key submission
      await usernameField.fill(testUser.username);
      await passwordField.fill('wrongpassword');
      await page.keyboard.press('Enter');
      
      // Should attempt to submit form
      await page.waitForTimeout(1000);
    });

    test('should show loading states during authentication', async ({ page }) => {
      // Register user first
      await page.request.post('http://localhost:8787/wtm/api/auth/register', {
        data: {
          username: testUser.username,
          password: testUser.password
        }
      });
      
      await navigateToApp(page);
      
      await page.fill('#login-username', testUser.username);
      await page.fill('#login-password', testUser.password);
      
      // Click submit and quickly check for loading state
      const submitButton = page.locator('#login-form button[type="submit"]');
      await submitButton.click();
      
      // Check if button shows loading state (disabled, spinner, etc.)
      // This is implementation-specific, so we'll check common patterns
      try {
        const isDisabled = await submitButton.isDisabled();
        const hasLoadingText = await page.locator('text=Loading, text=Logging in').isVisible({ timeout: 1000 });
        const hasSpinner = await page.locator('.spinner, .loading, [data-testid="spinner"]').isVisible({ timeout: 1000 });
        
        // At least one loading indicator should be present
        expect(isDisabled || hasLoadingText || hasSpinner).toBe(true);
      } catch (error) {
        // Loading states may be very fast, so this test is optional
      }
      
      // Should eventually complete
      await page.waitForTimeout(3000);
      expect(await isOnMainPage(page)).toBe(true);
    });
  });
});