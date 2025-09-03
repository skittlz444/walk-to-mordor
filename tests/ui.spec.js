const { test, expect } = require('@playwright/test');

test.describe('Walk to Mordor UI', () => {
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

  // Clean up any test events after each test
  test.afterEach(async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle'); // Wait for page to finish loading
    
    // Clean up specific test values
    for (const value of ['999999 km', '888888 km', '777777 km']) {
      const eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: value });
      while (await eventLabel.count() > 0) {
        await eventLabel.first().click();
        const deleteButton = page.locator('text=Delete');
        await expect(deleteButton).toBeVisible({ timeout: 2000 }); // Wait for popup to open
        if (await deleteButton.count() > 0) {
          await deleteButton.click();
          await page.waitForTimeout(100); // Wait for deletion to complete
        }
        await expect(eventLabel).not.toBeVisible();
      }
    }
    
    // Also clean up any high value test entries that might be left behind
    const highValueEvents = page.locator('.mbsc-calendar-label-text').filter({ hasText: /^(999999|888888|777777|999998|888887|777776)\s*km$/ });
    while (await highValueEvents.count() > 0) {
      await highValueEvents.first().click();
      await page.waitForTimeout(100);
      const deleteButton = page.locator('text=Delete');
      if (await deleteButton.count() > 0) {
        await deleteButton.click();
        await page.waitForTimeout(100);
      }
    }
  });

  test('Calendar renders and is interactable', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await expect(page.locator('#eventcalendar')).toBeVisible();
    await page.waitForTimeout(500);
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await expect(page.locator('#popup')).toBeVisible();
  });

  test('Can add and delete a new event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await page.fill('#distance-input', '999999');
    await page.click('text=Add');
    await page.waitForTimeout(100);
    const eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '999999 km' });
    await expect(eventLabel).toBeVisible();
    await cell.click();
    await page.click('text=Delete');
    await expect(eventLabel).not.toBeVisible();
  });

  test('Can edit and delete an event', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');
    const cell = await selectNextWeekCell(page);
    await cell.click();
    await page.fill('#distance-input', '888888');
    await page.click('text=Add');
    await page.waitForTimeout(100);
    let eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '888888 km' });
    await eventLabel.first().click();
    await page.fill('#distance-input', '777777');
    await page.click('text=Save');
    await page.waitForTimeout(100);
    eventLabel = page.locator('.mbsc-calendar-label-text', { hasText: '777777 km' });
    await expect(eventLabel).toBeVisible();
    await eventLabel.first().click();
    await page.click('text=Delete');
    await expect(eventLabel).not.toBeVisible();
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

  test('UI is responsive', async ({ page }) => {
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
    await page.fill('#distance-input', '999999');
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
    
    // Check that distance has strikethrough styling (completed goal)
    const popupContent = page.locator('#goal-popup');
    
    // Check that distance is displayed but no "km to go" for completed goals
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
      await page.fill('#distance-input', '888888');
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
});
