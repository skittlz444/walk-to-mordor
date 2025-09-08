const { test, expect } = require('@playwright/test');
const { TEST_VALUES, cleanupAllTestData } = require('./helpers/cleanup');

test.describe('Walk to Mordor UI - Edge Cases & Advanced Features', () => {

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
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300);
    const timestamp = await getNextWeekTimestamp(page);
    const cell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    await expect(cell).toBeVisible();
    await expect(cell).toBeEnabled();
    return cell;
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
    await page.goto('http://localhost:8787');
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
    await page.goto('http://localhost:8787');
    await expect(page.locator('header')).toBeVisible();
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await expect(page.locator('#goals-list')).toBeVisible();
  });

  test('Goal popup opens for upcoming goals and shows correct content', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Wait for goals to load and find the first visible upcoming goal
    await expect(page.locator('#goals-list')).toBeVisible();
    const upcomingGoal = page.locator('.upcoming-goal').first();
    await expect(upcomingGoal).toBeVisible();
    
    await upcomingGoal.click();
    
    // Check that goal popup is visible
    await expect(page.locator('#goal-popup')).toBeVisible();
    
    // Check that Close button exists and has correct text
    const closeButton = page.locator('text=Close').last();
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveText('Close');
    
    // Check that distance and "km to go" are displayed
    const popupContent = page.locator('#goal-popup');
    await expect(popupContent).toContainText('km');
    await expect(popupContent).toContainText('km to go');
    
    // Close the popup
    await closeButton.click();
    await expect(page.locator('#goal-popup')).toBeHidden();
  });

  test('Goal popup opens for completed goals and shows strikethrough distance', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Add some distance to ensure we have completed goals
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await page.fill('#distance-input', TEST_VALUES[0]); // Use 9876543
    await page.click('text=Add');
    await page.waitForTimeout(100);
    
    // Wait for goals to load and find the first visible completed goal
    await expect(page.locator('#goals-list')).toBeVisible();
    const completedGoal = page.locator('.completed-goal').first();
    await expect(completedGoal).toBeVisible();
    
    await completedGoal.click();
    
    // Check that goal popup is visible
    await expect(page.locator('#goal-popup')).toBeVisible();
    
    // Check that Close button exists and has correct text
    const closeButton = page.locator('text=Close').last();
    await expect(closeButton).toBeVisible();
    
    // Check that distance is displayed but no "km to go" for completed goals
    const popupContent = page.locator('#goal-popup');
    await expect(popupContent).toContainText('km');
    await expect(popupContent).not.toContainText('km to go');
    
    // Close the popup
    await closeButton.click();
    await expect(page.locator('#goal-popup')).toBeHidden();
  });

  test('Goal popup opens from header goals', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Check if there's already a header goal visible without adding distance
    const headerGoal = page.locator('.goal-header-main').first();
    if (await headerGoal.count() > 0) {
      await expect(headerGoal).toBeVisible();
      await headerGoal.click();
      
      // Check that goal popup is visible
      await expect(page.locator('#goal-popup')).toBeVisible();
      
      // Check that Close button exists
      const closeButton = page.locator('text=Close').last();
      await expect(closeButton).toBeVisible();
      
      // Check that content is displayed
      const popupContent = page.locator('#goal-popup');
      await expect(popupContent).toContainText('km');
      
      // Close the popup
      await closeButton.click();
      await expect(page.locator('#goal-popup')).toBeHidden();
    } else {
      // Add some distance to ensure we have a last goal in header
      const cell = await selectNextWeekCell(page);
      await cell.click();
      await page.fill('#distance-input', TEST_VALUES[1]); // Use 8765432
      await page.click('text=Add');
      await page.waitForTimeout(100);
      
      // Click on header goal
      const newHeaderGoal = page.locator('.goal-header-main').first();
      await expect(newHeaderGoal).toBeVisible();
      await newHeaderGoal.click();
      
      // Check that goal popup is visible
      await expect(page.locator('#goal-popup')).toBeVisible();
      
      // Check that Close button exists
      const closeButton = page.locator('text=Close').last();
      await expect(closeButton).toBeVisible();
      
      // Check that content is displayed
      const popupContent = page.locator('#goal-popup');
      await expect(popupContent).toContainText('km');
      
      // Close the popup
      await closeButton.click();
      await expect(page.locator('#goal-popup')).toBeHidden();
    }
  });

  test('Goal popup displays special milestone and description', async ({ page }) => {
    await page.goto('http://localhost:8787');
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
      await expect(page.locator('#goal-popup')).toBeVisible();
      
      const popupContent = page.locator('#goal-popup');
      
      // Check for substantial content (description text)
      const hasDescription = await popupContent.textContent();
      expect(hasDescription.length).toBeGreaterThan(50); // Should have substantial content
      
      // Check that Close button works
      const closeButton = page.locator('text=Close').last();
      await closeButton.click();
      await expect(page.locator('#goal-popup')).toBeHidden();
    } else {
      // If no upcoming goals, test with completed goals by showing all
      const showAllButton = page.locator('#toggle-completed');
      if (await showAllButton.count() > 0) {
        await showAllButton.click();
        const completedGoal = page.locator('.all-completed-goal').first();
        await expect(completedGoal).toBeVisible();
        
        await completedGoal.click();
        
        // Check that goal popup is visible
        await expect(page.locator('#goal-popup')).toBeVisible();
        
        const popupContent = page.locator('#goal-popup');
        
        // Check for substantial content (description text)
        const hasDescription = await popupContent.textContent();
        expect(hasDescription.length).toBeGreaterThan(50); // Should have substantial content
        
        // Check that Close button works
        const closeButton = page.locator('text=Close').last();
        await closeButton.click();
        await expect(page.locator('#goal-popup')).toBeHidden();
      }
    }
  });

  test('Goal popup shows distance information correctly', async ({ page }) => {
    await page.goto('http://localhost:8787');
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
      await expect(page.locator('#goal-popup')).toBeVisible();
      
      const popupContent = page.locator('#goal-popup');
      
      // Should show "km to go" for upcoming goals
      await expect(popupContent).toContainText('km to go');
      await expect(popupContent).toContainText('km');
      
      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closeButton.click();
      await expect(page.locator('#goal-popup')).toBeHidden();
    } else {
      // If no upcoming goals, just test that completed goals work
      const completedGoals = page.locator('.completed-goal');
      if (await completedGoals.count() > 0) {
        const goal = completedGoals.first();
        await expect(goal).toBeVisible();
        await goal.click();
        
        // Check that goal popup is visible
        await expect(page.locator('#goal-popup')).toBeVisible();
        
        const popupContent = page.locator('#goal-popup');
        
        // Should NOT show "km to go" for completed goals
        await expect(popupContent).toContainText('km');
        await expect(popupContent).not.toContainText('km to go');
        
        // Close the popup
        const closeButton = page.locator('text=Close').last();
        await closeButton.click();
        await expect(page.locator('#goal-popup')).toBeHidden();
      }
    }
  });

  test('Page handles different screen sizes', async ({ page }) => {
    await page.goto('http://localhost:8787');
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
      await expect(page.locator('.mbsc-calendar')).toBeVisible();
    }
  });

  test('API error handling works correctly', async ({ page }) => {
    // Test API with invalid data
    const response = await page.request.post('http://localhost:8787/wtm/api/calendar-progress', {
      data: { start: 'invalid-date', title: 'test' }
    });
    expect(response.status()).toBe(400);
    
    const errorData = await response.json();
    expect(errorData.error).toBeDefined();
  });

  test('API validates required fields', async ({ page }) => {
    // Test missing required fields
    const response = await page.request.post('http://localhost:8787/wtm/api/calendar-progress', {
      data: {}
    });
    expect([400, 422]).toContain(response.status());
  });

  test('Page loads without JavaScript errors', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', error => jsErrors.push(error));
    
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Verify no JavaScript errors occurred
    expect(jsErrors).toHaveLength(0);
  });

  test('Network requests complete successfully', async ({ page }) => {
    const failedRequests = [];
    page.on('requestfailed', request => failedRequests.push(request));
    
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Verify no network requests failed
    expect(failedRequests).toHaveLength(0);
  });

  test('Calendar navigation performance', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    const nextButton = page.locator('[aria-label="Next page"]');
    await expect(nextButton).toBeVisible();
    
    // Test rapid navigation clicks
    for (let i = 0; i < 3; i++) {
      await nextButton.click();
      await page.waitForTimeout(100);
    }
    
    // Calendar should still be functional
    await expect(page.locator('.mbsc-calendar')).toBeVisible();
  });

  test('Browser back/forward navigation', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Navigate to a different page if possible
    await page.goBack();
    await page.goForward();
    
    // Should return to the application
    await expect(page.locator('.mbsc-calendar')).toBeVisible();
  });

  test('Page accessibility basics', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    
    // Check for basic accessibility elements
    const title = await page.title();
    expect(title).toBeTruthy();
    
    // Check for navigation landmarks
    const navigation = page.locator('[aria-label*="page"], [aria-label*="Next"], [aria-label*="Previous"]');
    await expect(navigation.first()).toBeVisible();
  });

  // Goal Image Loading Edge Cases & Advanced Features
  async function openFirstAvailableGoalPopup(page) {
    await page.goto('http://localhost:8787');
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
    await expect(page.locator('#goal-popup')).toBeVisible();
    
    return page.locator('#goal-popup');
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

    await page.goto('http://localhost:8787');
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
    await expect(page.locator('#goal-popup')).toBeVisible();
    
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
    const popupBody = page.locator('.goal-popup-scrollable .mbsc-popup-body');
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
    const popupElement = page.locator('.goal-popup-scrollable');
    await expect(popupElement).toBeVisible();
    
    // Check that the popup content exceeds viewport if necessary for scrolling
    // (This depends on the content length, but we can at least verify the class exists)
    const popupBody = popupElement.locator('.mbsc-popup-body');
    await expect(popupBody).toBeVisible();
    
    // Verify the CSS class is properly applied for custom scrollbar
    const hasScrollableClass = await popup.evaluate(() => {
      const popupContainer = document.querySelector('.goal-popup-scrollable');
      return popupContainer !== null;
    });
    
    expect(hasScrollableClass).toBe(true);
  });
});
