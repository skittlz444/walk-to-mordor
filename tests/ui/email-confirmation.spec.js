// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Email Confirmation UI', () => {
    
    test('should show success message when visited with verified=true', async ({ page }) => {
        await page.goto('/login?verified=true');
        await expect(page.locator('.bg-green-100')).toContainText('Email verified! You can now log in.');
    });

    test('should show error message when visited with error=token', async ({ page }) => {
        await page.goto('/login?error=token_invalid');
        // The text depends on AuthForms.tsx logic: "Confirmation token invalid or expired..."
        await expect(page.locator('.error-message, .bg-red-100')).toContainText('Confirmation token invalid');
    });

    test('should show generic error from query param', async ({ page }) => {
        const errorMsg = 'Something went wrong';
        await page.goto(`/login?error=${encodeURIComponent(errorMsg)}`);
        await expect(page.locator('.error-message, .bg-red-100')).toContainText(errorMsg);
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
        
        // Check if we are already logged in? (setupTest usually handles this, but here we are raw)
        // If we see "Logout" or profile, we should logout.
        // Assuming clean state or logic to handle it.
        // The test runner might start fresh browser context.
        
        // Toggle to Register
        const registerLink = page.locator('button:has-text("Register")');
        // Just in case it's in Login mode
        if (await registerLink.isVisible()) {
             await registerLink.click();
        }

        // Register User A
        await page.fill('input[placeholder="Username"]', userA.username);
        await page.fill('input[placeholder="Email"]', userA.email);
        await page.fill('input[placeholder="Password"]', userA.password);
        
        // Submit
        await page.click('button[type="submit"]');

        // We might be auto-logged in (if First User) or waiting for verification (if not).
        // Either way, we want to logout to register User B.
        // Wait for either dashboard or "check email" message.
        
        // If successful login (first user), we are at '/', check for Profile button?
        // Or if not first user, we are at login with message.
        
        // Let's just go to /login again, it should clear state if we didn't preserve cookies? 
        // No, playwright preserves state in the context.
        // If we are logged in, /login usually redirects to / or shows logged in state.
        
        await page.goto('/api/auth/logout'); // Hard logout to be sure? Or assume UI logout.
        // The app might not have a GET /logout.
        // Let's use the UI logout if visible.
        
        await page.goto('/');
        const profileBtn = page.locator('#profile-btn');
        if (await profileBtn.isVisible()) {
             await profileBtn.click();
             await page.click('button:has-text("Logout")');
        } else {
             await page.goto('/login');
        }

        // 2. Register User B (Guaranteed non-first)
        // Ensure we are in Register mode
        const registerLink2 = page.locator('button:has-text("Register")');
        await expect(registerLink2).toBeVisible();
        await registerLink2.click();

        await page.fill('input[placeholder="Username"]', userB.username);
        await page.fill('input[placeholder="Email"]', userB.email);
        await page.fill('input[placeholder="Password"]', userB.password);
        await page.click('button[type="submit"]');
        
        // Should show success message "Registration successful... Please check your email"
        await expect(page.locator('.bg-green-100')).toContainText('check your email');

        // 3. Try to Login as User B (Unverified)
        // Switch to Login
        await page.click('button:has-text("Login")');
        
        await page.fill('input[placeholder="Username"]', userB.username);
        await page.fill('input[placeholder="Password"]', userB.password);
        await page.click('button[type="submit"]');

        // Expect Error
        await expect(page.locator('.error-message, .bg-red-100')).toContainText('Email not verified');
    });

});
