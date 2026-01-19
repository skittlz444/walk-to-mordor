// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Email Confirmation UI', () => {
    
    test('should show success message when visited with verified=true', async ({ page }) => {
        await page.goto('/login?verified=true');
        await expect(page.locator('.success-message')).toContainText('Email verified! You can now log in.');
    });

    test('should show error message when visited with error=token', async ({ page }) => {
        await page.goto('/login?error=token_invalid');
        // The text depends on AuthForms.tsx logic: "Confirmation token invalid or expired..."
        await expect(page.locator('.error-message')).toContainText('Confirmation token invalid');
    });

    test('should show generic error from query param', async ({ page }) => {
        const errorMsg = 'Something went wrong';
        await page.goto(`/login?error=${encodeURIComponent(errorMsg)}`);
        await expect(page.locator('.error-message')).toContainText(errorMsg);
    });

    test('should require email verification for subsequent registered users', async ({ page }) => {
        // 1. Create User A (to ensure DB is not empty, so next user is NOT first user)
        // We use a random suffix to ensure uniqueness
        const uniqueId = Math.random().toString(36).substring(7);
        const userA = {
            username: `userA_${uniqueId}`,
            email: `userA_${uniqueId}@example.com`,
            password: 'Password123!'
        };
        const userB = {
            username: `userB_${uniqueId}`,
            email: `userB_${uniqueId}@example.com`,
            password: 'Password123!'
        };

        // Go to Login -> Click Register
        await page.goto('/login');
        
        // Toggle to Register using the ID we added
        const registerLink = page.locator('#show-register');
        if (await registerLink.isVisible()) {
             await registerLink.click();
        }

        // Register User A
        await page.fill('#register-username', userA.username);
        await page.fill('#register-email', userA.email);
        await page.fill('#register-password', userA.password);
        
        // Submit
        await page.click('button[type="submit"]');

        // We might be auto-logged in (if First User) or waiting for verification (if not).
        
        await page.goto('/login'); // Refresh to reset state or navigate back if redirected
        // Check if we need to logout (if redirection happened)
        // ... (skipping complex check, blindly navigate to login should show login or dashboard)
        
        // If we are on dashboard (first user case), logout
        if (page.url() === '/' || page.url().endsWith('/')) {
             // Try to find profile or logout
             const profileBtn = page.locator('#profile-btn');
             if (await profileBtn.isVisible()) {
                 await profileBtn.click();
                 // Assuming logout is in profile modal
                 // In profile.spec.js: should have logout button in profile modal
                 await page.click('button:has-text("Logout")');
             }
        }
        
        await page.goto('/login');
        
        // 2. Register User B (Guaranteed non-first)
        // Ensure we are in Register mode
        await page.click('#show-register');

        await page.fill('#register-username', userB.username);
        await page.fill('#register-email', userB.email);
        await page.fill('#register-password', userB.password);
        await page.click('button[type="submit"]');
        
        // Should show success message "Registration successful... Please check your email"
        const successMsg = page.locator('.success-message');
        await expect(successMsg).toBeVisible();
        await expect(successMsg).toContainText('check your email');

        // 3. Try to Login as User B (Unverified)
        // Switch to Login
        await page.click('text=Login here');
        
        await page.fill('#login-username', userB.username);
        await page.fill('#login-password', userB.password);
        await page.click('button[type="submit"]');

        // Expect Error
        await expect(page.locator('.error-message')).toContainText('Email not verified');
    });

});
