// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * UI Tests - Password Reset Functionality
 */
test.describe('Password Reset', () => {

    test('should display password reset request page', async ({ page }) => {
        await page.goto('/password-reset');
        
        // Verify page loads correctly
        await expect(page.locator('h1')).toHaveText('Walk to Mordor');
        await expect(page.locator('h2')).toHaveText('Reset Your Password');
        
        // Verify form elements
        await expect(page.locator('#reset-email')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toHaveText('Request Password Reset');
        
        // Verify back to login link
        await expect(page.locator('a[href="/login"]')).toBeVisible();
    });

    test('should show error for missing email', async ({ page }) => {
        await page.goto('/password-reset');
        
        // Submit form without email
        await page.click('button[type="submit"]');
        
        // Browser validation should trigger (HTML5 required attribute)
        const emailInput = page.locator('#reset-email');
        await expect(emailInput).toHaveAttribute('required');
    });

    test('should show error for invalid email format', async ({ page }) => {
        await page.goto('/password-reset');
        
        // Fill form with invalid email - bypass HTML5 validation by setting a valid email first
        const emailInput = page.locator('#reset-email');
        await emailInput.evaluate(el => el.setAttribute('type', 'text')); // Temporarily change type to bypass validation
        await page.fill('#reset-email', 'invalid-email');
        await page.click('button[type="submit"]');
        
        // Wait for error message
        const errorDiv = page.locator('#reset-error');
        await expect(errorDiv).toBeVisible();
        const errorText = await errorDiv.textContent();
        expect(errorText).toContain('email');
    });

    test('should successfully request password reset for existing user', async ({ page }) => {
        // First, create a test user by registering
        await page.goto('/login');
        await page.click('#show-register');
        
        const timestamp = Date.now();
        const testUsername = `pwreset${timestamp}`;
        const testEmail = `${testUsername}@example.com`;
        
        await page.fill('#register-username', testUsername);
        await page.fill('#register-email', testEmail);
        await page.fill('#register-password', 'TestPassword123!');
        await page.click('#register-form button[type="submit"]');
        
        // Wait for success
        await page.waitForSelector('.success-message', { timeout: 5000 });
        
        // Now go to password reset page
        await page.goto('/password-reset');
        
        // Fill form with the registered email
        await page.fill('#reset-email', testEmail);
        await page.click('button[type="submit"]');
        
        // Wait for success message
        const successDiv = page.locator('.success-message');
        await expect(successDiv).toBeVisible();
        const successText = await successDiv.textContent();
        expect(successText).toContain('password reset link');
    });

    test('should display password reset form with token', async ({ page }) => {
        // Navigate to reset password page with a token
        await page.goto('/reset-password?token=test-token-123');
        
        // Verify page loads correctly
        await expect(page.locator('h1')).toHaveText('Walk to Mordor');
        await expect(page.locator('h2')).toHaveText('Set Your New Password');
        
        // Verify form elements
        await expect(page.locator('#new-password')).toBeVisible();
        await expect(page.locator('button[type="submit"]')).toHaveText('Set New Password');
        
        // Verify password strength indicators
        await expect(page.locator('#strength-length')).toBeVisible();
        await expect(page.locator('#strength-upper')).toBeVisible();
        await expect(page.locator('#strength-lower')).toBeVisible();
        await expect(page.locator('#strength-number')).toBeVisible();
        
        // Verify back to login link
        await expect(page.locator('a[href="/login"]')).toBeVisible();
    });

    test('should show error when token is missing', async ({ page }) => {
        await page.goto('/reset-password');
        
        // Wait for error message about missing token
        const errorDiv = page.locator('#reset-error');
        await expect(errorDiv).toBeVisible();
        const errorText = await errorDiv.textContent();
        expect(errorText).toContain('Invalid or missing reset token');
    });

    test('should update password strength indicators', async ({ page }) => {
        await page.goto('/reset-password?token=test-token-123');
        
        const passwordInput = page.locator('#new-password');
        
        // Initially all should be invalid (with ✗)
        await expect(page.locator('#strength-length')).toContainText('✗');
        await expect(page.locator('#strength-upper')).toContainText('✗');
        await expect(page.locator('#strength-lower')).toContainText('✗');
        await expect(page.locator('#strength-number')).toContainText('✗');
        
        // Type a valid password
        await passwordInput.fill('TestPassword123!');
        
        // All should be valid (with ✓)
        await expect(page.locator('#strength-length')).toContainText('✓');
        await expect(page.locator('#strength-upper')).toContainText('✓');
        await expect(page.locator('#strength-lower')).toContainText('✓');
        await expect(page.locator('#strength-number')).toContainText('✓');
    });

    test('should show error for invalid token on password reset', async ({ page }) => {
        await page.goto('/reset-password?token=invalid-token-123');
        
        // Fill in a valid password
        await page.fill('#new-password', 'NewPassword123!');
        await page.click('button[type="submit"]');
        
        // Wait for error message
        const errorDiv = page.locator('#reset-error');
        await expect(errorDiv).toBeVisible();
        const errorText = await errorDiv.textContent();
        expect(errorText).toContain('Invalid password reset token');
    });

    test('should show error for weak password', async ({ page }) => {
        await page.goto('/reset-password?token=test-token-123');
        
        // Fill in a weak password
        await page.fill('#new-password', 'weak');
        await page.click('button[type="submit"]');
        
        // Wait for error message
        const errorDiv = page.locator('#reset-error');
        await expect(errorDiv).toBeVisible();
        const errorText = await errorDiv.textContent();
        expect(errorText).toContain('Password');
    });

    test('should have forgot password link on login page', async ({ page }) => {
        await page.goto('/login');
        
        // Verify the "Forgot your password?" link exists
        const forgotPasswordLink = page.locator('a[href="/password-reset"]');
        await expect(forgotPasswordLink).toBeVisible();
        await expect(forgotPasswordLink).toHaveText('Forgot Password?');
        
        // Click the link and verify navigation
        await forgotPasswordLink.click();
        await expect(page).toHaveURL(/.*password-reset/);
    });

    test('should navigate back to login from password reset request page', async ({ page }) => {
        await page.goto('/password-reset');
        
        const backLink = page.locator('a[href="/login"]');
        await backLink.click();
        
        await expect(page).toHaveURL(/.*login/);
        await expect(page.locator('#login-form-container h2')).toHaveText('Login');
    });

    test('should navigate back to login from reset password page', async ({ page }) => {
        await page.goto('/reset-password?token=test-token-123');
        
        const backLink = page.locator('a[href="/login"]');
        await backLink.click();
        
        await expect(page).toHaveURL(/.*login/);
        await expect(page.locator('#login-form-container h2')).toHaveText('Login');
    });
});
