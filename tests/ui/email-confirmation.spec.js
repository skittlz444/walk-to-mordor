// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Email Confirmation UI', () => {
    
    test('should show success message when visited with verified=true', async ({ page }) => {
        await page.goto('/login?verified=true');
        await page.waitForSelector('[data-island="AuthForms"][data-hydrated="true"]');
        const successMessage = page.locator('.success-message');
        await expect(successMessage).toBeVisible();
        await expect(successMessage).toContainText('Email verified! You can now log in.');
    });

    test('should show error message when visited with error=token', async ({ page }) => {
        await page.goto('/login?error=token_invalid');
        await page.waitForSelector('[data-island="AuthForms"][data-hydrated="true"]');
        // The text depends on AuthForms.tsx logic: "Confirmation token invalid or expired..."
        const errorMessage = page.locator('.error-message');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('Confirmation token invalid');
    });

    test('should show generic error from query param', async ({ page }) => {
        const errorMsg = 'Something went wrong';
        await page.goto(`/login?error=${encodeURIComponent(errorMsg)}`);
        await page.waitForSelector('[data-island="AuthForms"][data-hydrated="true"]');
        const errorMessage = page.locator('.error-message');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText(errorMsg);
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
        await page.waitForSelector('[data-island="AuthForms"][data-hydrated="true"]');
        
        // Toggle to Register using the ID we added
        const registerLink = page.locator('#show-register');
        await expect(registerLink).toBeVisible();
        await registerLink.click();

        // Register User A
        await page.fill('#register-username', userA.username);
        await page.fill('#register-email', userA.email);
        await page.fill('#register-password', userA.password);
        
        // Submit and wait for response
        await Promise.all([
            page.waitForResponse(resp => resp.url().includes('/api/register')),
            page.click('button[type="submit"]'),
        ]);

        // We might be auto-logged in (if First User) or waiting for verification (if not).
        
        await page.goto('/login');
        await page.waitForLoadState('domcontentloaded');
        
        // If we are on dashboard (first user case), logout
        if (page.url() === '/' || page.url().endsWith('/')) {
             // Try to open drawer and logout via profile modal
             const menuBtn = page.locator('.menu-icon');
             if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                 await menuBtn.click();
                 await page.waitForSelector('body.drawer-open');
                 await page.click('.drawer-profile');
                 await page.click('button:has-text("Logout")');
                 await page.waitForLoadState('domcontentloaded');
             }
        }
        
        await page.goto('/login');
        await page.waitForSelector('[data-island="AuthForms"][data-hydrated="true"]');
        
        // 2. Register User B (Guaranteed non-first)
        // Ensure we are in Register mode
        const showRegister = page.locator('#show-register');
        await expect(showRegister).toBeVisible();
        await showRegister.click();

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
        const loginLink = page.locator('text=Login here');
        await expect(loginLink).toBeVisible();
        await loginLink.click();
        
        await page.fill('#login-username', userB.username);
        await page.fill('#login-password', userB.password);
        await page.click('button[type="submit"]');

        // Expect Error
        const errorMsg2 = page.locator('.error-message');
        await expect(errorMsg2).toBeVisible();
        await expect(errorMsg2).toContainText('Email not verified');
    });

});
