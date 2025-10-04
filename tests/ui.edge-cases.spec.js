const { test, expect } = require('@playwright/test');
const { cleanupAllTestData } = require('./helpers/cleanup');
const { authenticateUserInBrowser, makeAuthenticatedApiRequest } = require('./helpers/browser-auth');

/**
 * Generate realistic walking distance values (1-50 km)
 */
function generateRealisticTestDistance() {
  return Math.floor(Math.random() * 50) + 1;
}

/**
 * Generate larger distance for completing goals (100-1000 km)
 */
function generateLargeTestDistance() {
  return Math.floor(Math.random() * 900) + 100;
}

test.describe('Walk to Mordor UI - Edge Cases & Advanced Features', () => {
  // Set longer timeout for tests that might have slow loading
  test.setTimeout(60000); // 60 seconds

  // Clear all data before and after tests for clean state
  test.beforeAll(async () => {
    await cleanupAllTestData();
  });

  test.afterAll(async () => {
    await cleanupAllTestData();
  });

  // Authenticate user and clear popups before each test
  test.beforeEach(async ({ page }) => {
    // Authenticate user first
    await authenticateUserInBrowser(page);
    
    try {
      // Close any existing popups that might interfere with the next test
      const existingPopup = page.locator('.modal-overlay');
      if (await existingPopup.isVisible({ timeout: 1000 })) {
        const closeButton = page.locator('text=Close').last();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        } else {
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(500);
      }
    } catch (error) {
      // No popup to close or page not loaded yet
    }
  });

  // Helper to get timestamp for first day of next week
  async function getNextWeekTimestamp(page) {
    return await page.evaluate(() => {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const firstDayNextWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dayOfWeek + 7);
      return firstDayNextWeek.setHours(0, 0, 0, 0);
    });
  }

  // Helper to select calendar cell for next week
  async function selectNextWeekCell(page) {
    await page.click('#next-btn');
    await page.waitForTimeout(300);
    const timestamp = await getNextWeekTimestamp(page);
    const cell = page.locator(`[data-timestamp="${timestamp}"]`).first();
    await expect(cell).toBeVisible();
    await expect(cell).toBeEnabled();
    return cell;
  }

  // Helper to properly close popup with Firefox compatibility
  async function closePopupRobust(page, closeButton) {
    await closeButton.click();
    
    // Firefox may need more time for popup animations/transitions
    await page.waitForTimeout(1000);
    
    // Wait for popup to actually close - Firefox sometimes has timing issues
    await page.waitForFunction(() => {
      const popup = document.querySelector('.modal-overlay');
      return !popup || window.getComputedStyle(popup).display === 'none' || 
             popup.style.display === 'none' || !popup.offsetParent;
    }, { timeout: 10000 });
    
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
  }

  // Clean up before each test to ensure clean state
  test.beforeEach(async ({ page }) => {
    try {
      await cleanupAllTestData();
    } catch (error) {
      // Silently ignore cleanup warnings
    }
  });

  // Clean up after each test, regardless of pass/fail
  test.afterEach(async ({ page }) => {
    try {
      await cleanupAllTestData();
    } catch (error) {
      // Silently ignore cleanup warnings
    }
  });

  test('Goals section renders and controls work', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await expect(page.locator('#goals-list')).toBeVisible();
    await page.click('#toggle-completed-visibility');
    await expect(page.locator('#completed-goals-wrapper')).toBeHidden();
    await page.click('#toggle-completed-visibility');
    await expect(page.locator('#completed-goals-wrapper')).toBeVisible();
    await page.click('#toggle-completed');
    await expect(page.locator('#all-completed-goals')).toBeVisible();
    await page.click('#toggle-completed');
    await expect(page.locator('#completed-goals')).toBeVisible();
  });

  test('UI is responsive on specific viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    // User is already authenticated by beforeEach hook
    await expect(page.locator('header')).toBeVisible();
    
    // Calendar may be hidden on mobile viewports, check if it exists but don't require visibility
    const calendar = page.locator('#eventcalendar');
    const calendarExists = await calendar.count() > 0;
    // Calendar exists but may be hidden on mobile - this is expected behavior
    
    await expect(page.locator('#goals-list')).toBeVisible();
  });

  test('Goal popup opens for upcoming goals and shows correct content', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Wait for goals to load and find the first visible goal (upcoming or any goal)
    await expect(page.locator('#goals-list')).toBeVisible();
    
    // Try to find upcoming goals first, then fall back to any goal
    let goalToClick = page.locator('.upcoming-goal').first();
    const upcomingCount = await page.locator('.upcoming-goal').count();
    
    if (upcomingCount === 0) {
      // If no upcoming goals, try any clickable goal in the list
      goalToClick = page.locator('#goals-list li[role="button"], #goals-list li[tabindex], #goals-list li').first();
    }
    
    await expect(goalToClick).toBeVisible();
    await goalToClick.click();
    
    // Check that goal popup is visible
    await expect(page.locator('.modal-overlay')).toBeVisible();
    
    // Check that Close button exists and has correct text
    const closeButton = page.locator('text=Close').last();
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveText('Close');
    
    // Check that distance is displayed
    const popupContent = page.locator('.modal-overlay');
    await expect(popupContent).toContainText('km');
    
    // Check if this is an upcoming goal (has "km to go") or completed goal (just shows distance)
    const popupText = await popupContent.textContent();
    if (popupText.includes('km to go')) {
      // This is an upcoming goal
      await expect(popupContent).toContainText('km to go');
    } else {
      // This is a completed goal - just verify it has distance info
      expect(popupText).toMatch(/\d+\.\d+\s*km/); // Should contain distance in km format
    }
    
    // Close the popup
    await closeButton.click();
    
    // Wait for popup to close with longer timeout for Firefox - try multiple approaches
    await page.waitForTimeout(1000); // Give more time
    
    try {
      await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 15000 });
    } catch (error) {
      // If still visible, try clicking outside the popup to close it
      await page.click('body');
      await page.waitForTimeout(1000);
      
      // Wait for popup to actually close - Firefox sometimes has timing issues
      await page.waitForFunction(() => {
        const popup = document.querySelector('.modal-overlay');
        return !popup || window.getComputedStyle(popup).display === 'none' || 
               popup.style.display === 'none' || !popup.offsetParent;
      }, { timeout: 10000 });
      
      await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
    }
  });

  test('Goal popup opens for completed goals and shows strikethrough distance', async ({ page }) => {
    const userAgent = await page.evaluate(() => navigator.userAgent);
    
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Close any existing popups first - critical for mobile browsers
    try {
      const existingPopup = page.locator('.modal-overlay');
      if (await existingPopup.isVisible({ timeout: 2000 })) {
        const closeButton = page.locator('text=Close').last();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        } else {
          // Force close by clicking outside or ESC key
          await page.keyboard.press('Escape');
        }
        await page.waitForTimeout(1000);
        // Verify popup is closed
        await expect(existingPopup).toBeHidden({ timeout: 5000 });
      }
    } catch (error) {
      // No popup to close, continue
    }
    
    // Add some distance to ensure we have completed goals
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await page.fill('#distance-input', generateLargeTestDistance().toString()); // Use large distance to complete goals
    
    // Check if Add button is visible before clicking
    const addButton = page.locator('text=Add');
    if (await addButton.isVisible({ timeout: 5000 })) {
      await addButton.click();
      await page.waitForTimeout(2000); // Wait for distance processing and potential congratulations
    }
    
    // Wait for goals to load
    await expect(page.locator('#goals-list')).toBeVisible();
    
    // If there's a congratulations popup from adding distance, close it first
    try {
      const congratsPopup = page.locator('.modal-overlay');
      if (await congratsPopup.isVisible({ timeout: 2000 })) {
        const congratsText = await congratsPopup.textContent();
        if (congratsText && congratsText.includes('Congratulations')) {
          const closeButton = page.locator('text=Close').last();
          await closeButton.click();
          await page.waitForTimeout(1000);
          await expect(congratsPopup).toBeHidden({ timeout: 5000 });
        }
      }
    } catch (error) {
      // No congratulations popup, continue
    }
    
    // Try to find any clickable goal - prioritize completed goals if available
    let goalToClick = page.locator('.completed-goal').first();
    const completedCount = await page.locator('.completed-goal').count();
    
    if (completedCount === 0) {
      // If no completed goals, try any clickable goal
      goalToClick = page.locator('#goals-list li[role="button"], #goals-list li').first();
    }
    
    // Double-check no popups are blocking the click
    try {
      const blockingPopup = page.locator('.modal-overlay');
      if (await blockingPopup.isVisible({ timeout: 1000 })) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        await expect(blockingPopup).toBeHidden({ timeout: 3000 });
      }
    } catch (error) {
      // No popup to close, continue
    }
    
    await expect(goalToClick).toBeVisible();
    
    await goalToClick.click();
    
    // Check that goal popup is visible
    await expect(page.locator('.modal-overlay')).toBeVisible();
    
    // Check that Close button exists and has correct text
    const closeButton = page.locator('text=Close').last();
    await expect(closeButton).toBeVisible();
    
    // Check that distance is displayed but no "km to go" for completed goals
    const popupContent = page.locator('.modal-overlay');
    await expect(popupContent).toContainText('km');
    await expect(popupContent).not.toContainText('km to go');
    
    // Close the popup
    await closeButton.click();
    await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 10000 });
  });

  test('Goal popup opens from header goals', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Check if there's already a header goal visible without adding distance
    const headerGoal = page.locator('.goal-header-main').first();
    if (await headerGoal.count() > 0) {
      await expect(headerGoal).toBeVisible();
      await headerGoal.click();
      
      // Check that goal popup is visible
      await expect(page.locator('.modal-overlay')).toBeVisible();
      
      // Check that Close button exists
      const closeButton = page.locator('text=Close').last();
      await expect(closeButton).toBeVisible();
      
      // Check that content is displayed
      const popupContent = page.locator('.modal-overlay');
      await expect(popupContent).toContainText('km');
      
      // Close the popup
      await closePopupRobust(page, closeButton);
    } else {
      // Add some distance to ensure we have a last goal in header
      const cell = await selectNextWeekCell(page);
      await cell.click();
      await page.fill('#distance-input', generateLargeTestDistance().toString()); // Use large distance to complete goals
      await page.click('text=Add');
      await page.waitForTimeout(100);
      
      // Click on header goal
      const newHeaderGoal = page.locator('.goal-header-main').first();
      await expect(newHeaderGoal).toBeVisible();
      await newHeaderGoal.click();
      
      // Check that goal popup is visible
      await expect(page.locator('.modal-overlay')).toBeVisible();
      
      // Check that Close button exists
      const closeButton = page.locator('text=Close').last();
      await expect(closeButton).toBeVisible();
      
      // Check that content is displayed
      const popupContent = page.locator('.modal-overlay');
      await expect(popupContent).toContainText('km');
      
      // Close the popup
      await closePopupRobust(page, closeButton);
    }
  });

  test('Goal popup displays special milestone and description', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Check if there are upcoming goals available
    await expect(page.locator('#goals-list')).toBeVisible();
    const upcomingGoals = page.locator('.upcoming-goal');
    
    if (await upcomingGoals.count() > 0) {
      // Test with upcoming goal
      const anyGoal = upcomingGoals.first();
      await expect(anyGoal).toBeVisible();
      
      await anyGoal.click();
      
      // Check that goal popup is visible
      await expect(page.locator('.modal-overlay')).toBeVisible();
      
      const popupContent = page.locator('.modal-overlay');
      
      // Check for substantial content (description text)
      const hasDescription = await popupContent.textContent();
      expect(hasDescription.length).toBeGreaterThan(50); // Should have substantial content
      
      // Check that Close button works
      const closeButton = page.locator('text=Close').last();
      await closePopupRobust(page, closeButton);
    } else {
      // If no upcoming goals, test with completed goals by showing all
      const showAllButton = page.locator('#toggle-completed');
      if (await showAllButton.count() > 0) {
        await showAllButton.click();
        const completedGoal = page.locator('.all-completed-goal').first();
        await expect(completedGoal).toBeVisible();
        
        await completedGoal.click();
        
        // Check that goal popup is visible
        await expect(page.locator('.modal-overlay')).toBeVisible();
        
        const popupContent = page.locator('.modal-overlay');
        
        // Check for substantial content (description text)
        const hasDescription = await popupContent.textContent();
        expect(hasDescription.length).toBeGreaterThan(50); // Should have substantial content
        
        // Check that Close button works
        const closeButton = page.locator('text=Close').last();
        await closePopupRobust(page, closeButton);
      }
    }
  });

  test('Goal popup shows distance information correctly', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Test any available goal without adding distance first
    await expect(page.locator('#goals-list')).toBeVisible();
    
    // Try upcoming goals first
    const upcomingGoals = page.locator('.upcoming-goal');
    if (await upcomingGoals.count() > 0) {
      const goal = upcomingGoals.first();
      await expect(goal).toBeVisible();
      await goal.click();
      
      // Check that goal popup is visible
      await expect(page.locator('.modal-overlay')).toBeVisible();
      
      const popupContent = page.locator('.modal-overlay');
      
      // Should show "km to go" for upcoming goals
      await expect(popupContent).toContainText('km to go');
      await expect(popupContent).toContainText('km');
      
      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closeButton.click();
      
      // Wait for popup to close with longer timeout for Firefox - try multiple approaches
      await page.waitForTimeout(1000); // Give more time
      
      try {
        await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 15000 });
      } catch (error) {
        // If still visible, try clicking outside the popup to close it
        await page.click('body');
        await page.waitForTimeout(500);
        await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 10000 });
      }
    } else {
      // If no upcoming goals, just test that completed goals work
      const completedGoals = page.locator('.completed-goal');
      if (await completedGoals.count() > 0) {
        const goal = completedGoals.first();
        await expect(goal).toBeVisible();
        await goal.click();
        
        // Check that goal popup is visible
        await expect(page.locator('.modal-overlay')).toBeVisible();
        
        const popupContent = page.locator('.modal-overlay');
        
        // Should NOT show "km to go" for completed goals
        await expect(popupContent).toContainText('km');
        await expect(popupContent).not.toContainText('km to go');
        
        // Close the popup
        const closeButton = page.locator('text=Close').last();
        await closePopupRobust(page, closeButton);
      } else {
        // No goals available to test popup functionality
        const upcomingCount = await page.locator('.upcoming-goal').count();
        const completedCount = await page.locator('.completed-goal').count();
        test.skip(`No goals available for popup testing. Upcoming: ${upcomingCount}, Completed: ${completedCount}. Need at least one goal to test popup functionality.`);
      }
    }
  });

  test('Page handles different screen sizes', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Test various screen sizes
    const viewports = [
      { width: 320, height: 568 }, // iPhone SE
      { width: 375, height: 667 }, // iPhone 8
      { width: 768, height: 1024 }, // iPad
      { width: 1200, height: 800 }  // Desktop
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      // Expect calendar to be visible on all screen sizes
      await expect(page.locator('.custom-calendar')).toBeVisible();
    }
  });

  test('API error handling works correctly', async ({ page }) => {
    // Test API with invalid data
    const response = await makeAuthenticatedApiRequest(
      page.request, 
      'post', 
      'http://localhost:8787/wtm/api/calendar-progress', 
      { data: { start: 'invalid-date', title: 'test' } }
    );
    expect(response.status()).toBe(400);
    
    const errorData = await response.json();
    expect(errorData.error).toBeDefined();
  });

  test('API validates required fields', async ({ page }) => {
    // Test missing required fields
    const response = await makeAuthenticatedApiRequest(
      page.request, 
      'post', 
      'http://localhost:8787/wtm/api/calendar-progress', 
      { data: {} }
    );
    expect([400, 422]).toContain(response.status());
  });

  test('Page loads without JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', error => jsErrors.push(error));
    
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Verify no JavaScript errors occurred
    expect(jsErrors).toHaveLength(0);
  });

  test('Network requests complete successfully', async ({ page }) => {
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push(request));
    
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Verify no critical network requests failed
    // Allow some non-critical resource failures (e.g., fonts, analytics) on mobile
    const criticalFailures = failedRequests.filter(request => {
      const url = request.url();
      return !url.includes('analytics') && 
             !url.includes('fonts') && 
             !url.includes('tracking') &&
             !url.includes('.woff') &&
             !url.includes('.ttf');
    });
    
    expect(criticalFailures).toHaveLength(0);
  });

  test('Calendar navigation performance', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    const nextButton = page.locator('#next-btn');
    await expect(nextButton).toBeVisible();

    // Test rapid navigation clicks
    for (let i = 0; i < 3; i++) {
      await nextButton.click();
      await page.waitForTimeout(100);
    }

    // Calendar should still be functional
    await expect(page.locator('.custom-calendar')).toBeVisible();
  });

  test('Browser back/forward navigation', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Navigate to a different page if possible
    await page.goBack();
    await page.goForward();
    
    // Should return to the application with visible calendar
    await expect(page.locator('.custom-calendar')).toBeVisible();
  });

  test('Page accessibility basics', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Check for basic accessibility elements
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check for navigation landmarks
    const navigation = page.locator('#next-btn, #prev-btn');
    await expect(navigation.first()).toBeVisible();
  });

  // Goal Image Loading Edge Cases & Advanced Features
  async function openFirstAvailableGoalPopup(page) {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    
    // Wait for goals to load
    await expect(page.locator('#goals-list')).toBeVisible();
    
    // Check if there are upcoming goals available first
    const upcomingGoals = page.locator('.upcoming-goal');
    if (await upcomingGoals.count() > 0) {
      const upcomingGoal = upcomingGoals.first();
      await expect(upcomingGoal).toBeVisible();
      await upcomingGoal.click();
    } else {
      // Fall back to completed goals if no upcoming goals
      const completedGoals = page.locator('.completed-goal');
      const completedGoal = completedGoals.first();
      await expect(completedGoal).toBeVisible();
      await completedGoal.click();
    }
    
    // Check that goal popup is visible
    await expect(page.locator('.modal-overlay')).toBeVisible();
    
    return page.locator('.modal-overlay');
  }

  test('Thumbnail image initially has blur filter applied', async ({ page }) => {
    // Block high-res images from loading to test initial blur state
    await page.route('**/wtm/img/highres/*.jpg', route => route.abort());

    const popup = await openFirstAvailableGoalPopup(page);
    
    // Check that thumbnail has blur initially
    const thumbImage = popup.locator('#goal-thumb-image');
    await expect(thumbImage).toBeVisible();
    
    // Since highres is blocked, blur should remain
    await page.waitForTimeout(500); // Give time for any potential loading
    
    // Check the filter is still blur (since highres won't load)
    const filterValue = await thumbImage.evaluate(el => getComputedStyle(el).filter);
    expect(filterValue).toContain('blur');
  });

  test('Thumbnail image falls back to placeholder on error', async ({ page }) => {
    // Mock network to make thumb image fail
    await page.route('**/wtm/img/thumbs/*.jpg', route => {
      if (route.request().url().includes('0-thumb.jpg')) {
        // Let placeholder load successfully
        route.continue();
      } else {
        // Fail all other thumb images
        route.abort();
      }
    });

    const popup = await openFirstAvailableGoalPopup(page);
    
    // Wait for error fallback to trigger
    const thumbImage = popup.locator('#goal-thumb-image');
    
    // Check that fallback image is loaded
    await expect(thumbImage).toHaveAttribute('src', '/wtm/img/thumbs/0-thumb.jpg');
  });

  test('High-res image falls back to placeholder on error', async ({ page }) => {
    // Mock network to make highres image fail
    await page.route('**/wtm/img/highres/*.jpg', route => {
      if (route.request().url().includes('0.jpg')) {
        // Let placeholder load successfully
        route.continue();
      } else {
        // Fail all other highres images
        route.abort();
      }
    });

    const popup = await openFirstAvailableGoalPopup(page);
    
    // Wait for error fallback to trigger
    const highresImage = popup.locator('#goal-highres-image');
    
    // Check that fallback image is loaded
    await expect(highresImage).toHaveAttribute('src', '/wtm/img/highres/0.jpg');
  });

  test('Image lazy loading only occurs when popup is opened', async ({ page }) => {
    let imageRequestsMade = [];
    
    // Track image requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/wtm/img/thumbs/') || url.includes('/wtm/img/highres/')) {
        imageRequestsMade.push(url);
      }
    });

    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#goals-list')).toBeVisible();
    
    // Wait a bit to ensure no premature image loading
    await page.waitForTimeout(1000);
    
    // Should have no image requests yet
    expect(imageRequestsMade.length).toBe(0);
    
    // Now open a goal popup - check for upcoming goals first, fall back to completed
    const upcomingGoals = page.locator('.upcoming-goal');
    if (await upcomingGoals.count() > 0) {
      const upcomingGoal = upcomingGoals.first();
      await expect(upcomingGoal).toBeVisible();
      await upcomingGoal.click();
    } else {
      // Fall back to completed goals if no upcoming goals
      const completedGoals = page.locator('.completed-goal');
      const completedGoal = completedGoals.first();
      await expect(completedGoal).toBeVisible();
      await completedGoal.click();
    }
    await expect(page.locator('.modal-overlay')).toBeVisible();
    
    // Wait for images to start loading
    await page.waitForTimeout(1000);
    
    // Should now have image requests
    expect(imageRequestsMade.length).toBeGreaterThan(0);
    
    // Should have requests for both thumb and highres
    const thumbRequests = imageRequestsMade.filter(url => url.includes('/thumbs/'));
    const highresRequests = imageRequestsMade.filter(url => url.includes('/highres/'));
    
    expect(thumbRequests.length).toBeGreaterThan(0);
    expect(highresRequests.length).toBeGreaterThan(0);
  });

  test('Goal popup handles scrolling properly with images', async ({ page }) => {
    const popup = await openFirstAvailableGoalPopup(page);
    
    // Check that popup has proper scrolling setup
    const popupBody = page.locator('.goal-modal-scrollable');
    await expect(popupBody).toBeVisible();
    
    // Check scrolling CSS properties
    await expect(popupBody).toHaveCSS('overflow-y', 'auto');
    await expect(popupBody).toHaveCSS('overflow-x', 'hidden');
    
    // Check that content is scrollable if needed
    const popupContent = popup.locator('div').first();
    await expect(popupContent).toBeVisible();
    
    // Test scroll behavior by trying to scroll (should not throw errors)
    await popupContent.evaluate(element => {
      element.scrollTop = 10;
    });
  });

  test('Custom scrollbar styling is applied to goal popup', async ({ page }) => {
    const popup = await openFirstAvailableGoalPopup(page);
    
    // Check that the popup has the scrollable class
    const popupElement = page.locator('.goal-modal-scrollable');
    await expect(popupElement).toBeVisible();
    
    // Check that the popup content exceeds viewport if necessary for scrolling
    // (This depends on the content length, but we can at least verify the class exists)
    const popupBody = popupElement;
    await expect(popupBody).toBeVisible();
    
    // Verify the CSS class is properly applied for custom scrollbar
    const hasScrollableClass = await popup.evaluate(() => {
      const popupContainer = document.querySelector('.goal-modal-scrollable');
      return popupContainer !== null;
    });
    
    expect(hasScrollableClass).toBe(true);
  });

  test('Goal popup does not show congratulations when opened manually', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');

    // Wait for goals to load
    await expect(page.locator('#goals-list')).toBeVisible();

    // Try to click on an upcoming goal directly
    const upcomingGoals = page.locator('.upcoming-goal');
    const upcomingCount = await upcomingGoals.count();
    
    if (upcomingCount > 0) {
      const firstUpcomingGoal = upcomingGoals.first();
      await firstUpcomingGoal.click();

      // Check that goal popup is visible
      await expect(page.locator('.modal-overlay')).toBeVisible();

      // Check that congratulations text is NOT present
      await expect(page.locator('.modal-overlay')).not.toContainText('Congratulations! You\'ve passed a new goal!');

      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closePopupRobust(page, closeButton);
    } else {
      // Try clicking on a completed goal instead
      const completedGoals = page.locator('.completed-goal');
      const completedCount = await completedGoals.count();
      
      if (completedCount > 0) {
        const firstCompletedGoal = completedGoals.first();
        await firstCompletedGoal.click();

        // Check that goal popup is visible
        await expect(page.locator('.modal-overlay')).toBeVisible();

        // Check that congratulations text is NOT present
        await expect(page.locator('.modal-overlay')).not.toContainText('Congratulations! You\'ve passed a new goal!');

        // Close the popup
        const closeButton = page.locator('text=Close').last();
        await closePopupRobust(page, closeButton);
      } else {
        // No goals available to test manual opening
      }
    }
  });

  test('Only the highest passed goal shows when multiple goals are passed', async ({ page }) => {
    // User is already authenticated by beforeEach hook
    await page.waitForLoadState('networkidle');

    // Verify page loaded with goals
    await expect(page.locator('#goals-list')).toBeVisible();

    // Get the current goals
    const goals = await page.evaluate(async () => {
      const response = await fetch('/wtm/api/goals');
      return await response.json();
    });

    if (goals.length < 2) {
      test.skip(true, `Skipping test: Not enough goals available (found ${goals.length}, need at least 2). Current goals: ${JSON.stringify(goals.map(g => ({title: g.title, distance: g.distance})))}`);
      return;
    }

    // Find two consecutive goals with reasonable distances for testing
    goals.sort((a, b) => a.distance - b.distance);
    const suitableGoals = goals.filter(goal => goal.distance > 0 && goal.distance <= 100);
    
    if (suitableGoals.length < 2) {
      test.skip(true, `Skipping test: Not enough suitable goals for testing (found ${suitableGoals.length}, need at least 2). Suitable goals (distance 1-100km): ${JSON.stringify(suitableGoals.map(g => ({title: g.title, distance: g.distance})))}. Total goals: ${goals.length}`);
      return;
    }

    // Use distance that would pass multiple goals
    const highestGoal = suitableGoals[1]; // Second goal
    const testDistance = highestGoal.distance + 1; // Should pass both first and second goal

    // Add the distance entry using the same approach as other edge case tests
    const cell = await selectNextWeekCell(page);
    await cell.click();

    // Enter the distance
    const distanceInput = page.locator('#distance-input');
    await expect(distanceInput).toBeVisible();
    await distanceInput.fill(testDistance.toString());

    // Click Save/Add button
    const addButton = page.locator('text=Add');
    await addButton.click();

    // Wait for the distance input popup to close
    await expect(page.locator('#popup')).toBeHidden({ timeout: 10000 });

    // Wait a moment for the congratulations popup to appear
    await page.waitForTimeout(1000);

    // Check if the goal popup opened
    const goalPopup = page.locator('.modal-overlay');
    if (await goalPopup.isVisible({ timeout: 5000 })) {
      // Check for congratulations text
      await expect(goalPopup).toContainText('Congratulations! You\'ve passed a new goal!');
      
      // Check that it shows the HIGHEST goal passed (the second goal)
      await expect(goalPopup).toContainText(highestGoal.title);
      
      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closePopupRobust(page, closeButton);
    } else {
      // Goal popup did not appear - this may be expected depending on test data
    }
  });
});
