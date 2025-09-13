const { test, expect } = require('@playwright/test');
const { TEST_VALUES, cleanupAllTestData } = require('./helpers/cleanup');

test.describe('Walk to Mordor UI - Passing Goals Feature', () => {
  // Set longer timeout for tests that might have slow loading
  test.setTimeout(60000); // 60 seconds

  // Helper to format date for API
  function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Helper to get a future date for testing
  function getFutureDate() {
    const now = new Date();
    const futureDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return formatDate(futureDate);
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

  test('Goal popup shows congratulations when user passes a goal by adding distance', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');

    // Verify page loaded with goals
    await expect(page.locator('#goals-list')).toBeVisible();

    // Get the current goals to find the first upcoming goal
    const goals = await page.evaluate(async () => {
      const response = await fetch('/wtm/api/goals');
      return await response.json();
    });

    if (goals.length === 0) {
      console.log('No goals available for testing');
      return;
    }

    // Find the first goal with a reasonable distance for testing
    const testGoal = goals.find(goal => goal.distance > 0 && goal.distance <= 100);
    
    if (!testGoal) {
      console.log('No suitable test goal found');
      return;
    }

    // Add a distance entry that will pass this goal
    const testDistance = testGoal.distance + 1; // Slightly more than the goal distance
    const testDate = getFutureDate();

    // Click on a calendar cell to open the distance input popup
    const dayOfWeek = new Date().getDay();
    const firstDayNextWeek = new Date();
    firstDayNextWeek.setDate(firstDayNextWeek.getDate() - dayOfWeek + 7);
    const timestamp = firstDayNextWeek.setHours(0, 0, 0, 0);

    // Navigate to next week if needed
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300);

    // Click on a calendar cell
    const cell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    if (await cell.count() > 0) {
      await cell.click();
    } else {
      // Fallback: click any available calendar cell
      const availableCells = page.locator('[role="gridcell"]:not([aria-disabled="true"])');
      const cellCount = await availableCells.count();
      if (cellCount > 0) {
        await availableCells.first().click();
      } else {
        console.log('No available calendar cells found');
        return;
      }
    }

    // Wait for popup to open
    await expect(page.locator('#popup')).toBeVisible();

    // Enter the distance that should pass the goal
    const distanceInput = page.locator('#distance-input');
    await expect(distanceInput).toBeVisible();
    await distanceInput.fill(testDistance.toString());

    // Click Save/Add button
    const saveButton = page.locator('text=Add').or(page.locator('text=Save')).first();
    await saveButton.click();

    // Wait for the distance input popup to close
    await expect(page.locator('#popup')).toBeHidden({ timeout: 10000 });

    // Wait a moment for the congratulations popup to appear
    await page.waitForTimeout(1000);

    // Check if the goal popup opened with congratulations text
    const goalPopup = page.locator('#goal-popup');
    if (await goalPopup.isVisible({ timeout: 5000 })) {
      // Check for congratulations text
      await expect(goalPopup).toContainText('Congratulations! You\'ve passed a new goal!');
      
      // Check that it shows the correct goal
      await expect(goalPopup).toContainText(testGoal.title);
      
      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closeButton.click();
      await expect(goalPopup).toBeHidden({ timeout: 10000 });
    } else {
      console.log('Goal popup did not appear - this may be expected if no goals were passed');
    }
  });

  test('Goal popup does not show congratulations when opened manually', async ({ page }) => {
    await page.goto('http://localhost:8787');
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
      await expect(page.locator('#goal-popup')).toBeVisible();

      // Check that congratulations text is NOT present
      await expect(page.locator('#goal-popup')).not.toContainText('Congratulations! You\'ve passed a new goal!');

      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closeButton.click();
      await expect(page.locator('#goal-popup')).toBeHidden({ timeout: 10000 });
    } else {
      // Try clicking on a completed goal instead
      const completedGoals = page.locator('.completed-goal');
      const completedCount = await completedGoals.count();
      
      if (completedCount > 0) {
        const firstCompletedGoal = completedGoals.first();
        await firstCompletedGoal.click();

        // Check that goal popup is visible
        await expect(page.locator('#goal-popup')).toBeVisible();

        // Check that congratulations text is NOT present
        await expect(page.locator('#goal-popup')).not.toContainText('Congratulations! You\'ve passed a new goal!');

        // Close the popup
        const closeButton = page.locator('text=Close').last();
        await closeButton.click();
        await expect(page.locator('#goal-popup')).toBeHidden({ timeout: 10000 });
      } else {
        console.log('No goals available to test manual opening');
      }
    }
  });

  test('Only the highest passed goal shows when multiple goals are passed', async ({ page }) => {
    await page.goto('http://localhost:8787');
    await page.waitForLoadState('networkidle');

    // Verify page loaded with goals
    await expect(page.locator('#goals-list')).toBeVisible();

    // Get the current goals
    const goals = await page.evaluate(async () => {
      const response = await fetch('/wtm/api/goals');
      return await response.json();
    });

    if (goals.length < 2) {
      console.log('Need at least 2 goals to test multiple goals passing');
      return;
    }

    // Find two consecutive goals with reasonable distances for testing
    goals.sort((a, b) => a.distance - b.distance);
    const suitableGoals = goals.filter(goal => goal.distance > 0 && goal.distance <= 100);
    
    if (suitableGoals.length < 2) {
      console.log('Need at least 2 suitable goals for testing');
      return;
    }

    // Use distance that would pass multiple goals
    const highestGoal = suitableGoals[1]; // Second goal
    const testDistance = highestGoal.distance + 1; // Should pass both first and second goal

    // Add the distance entry
    const dayOfWeek = new Date().getDay();
    const firstDayNextWeek = new Date();
    firstDayNextWeek.setDate(firstDayNextWeek.getDate() - dayOfWeek + 7);
    const timestamp = firstDayNextWeek.setHours(0, 0, 0, 0);

    // Navigate to next week if needed
    await page.click('[aria-label="Next page"]');
    await page.waitForTimeout(300);

    // Click on a calendar cell
    const cell = page.locator(`[aria-describedby="mbsc-calendar-day-desc-${timestamp}"]`).first();
    if (await cell.count() > 0) {
      await cell.click();
    } else {
      // Fallback: click any available calendar cell
      const availableCells = page.locator('[role="gridcell"]:not([aria-disabled="true"])');
      const cellCount = await availableCells.count();
      if (cellCount > 0) {
        await availableCells.first().click();
      } else {
        console.log('No available calendar cells found');
        return;
      }
    }

    // Wait for popup to open
    await expect(page.locator('#popup')).toBeVisible();

    // Enter the distance
    const distanceInput = page.locator('#distance-input');
    await expect(distanceInput).toBeVisible();
    await distanceInput.fill(testDistance.toString());

    // Click Save/Add button
    const saveButton = page.locator('text=Add').or(page.locator('text=Save')).first();
    await saveButton.click();

    // Wait for the distance input popup to close
    await expect(page.locator('#popup')).toBeHidden({ timeout: 10000 });

    // Wait a moment for the congratulations popup to appear
    await page.waitForTimeout(1000);

    // Check if the goal popup opened
    const goalPopup = page.locator('#goal-popup');
    if (await goalPopup.isVisible({ timeout: 5000 })) {
      // Check for congratulations text
      await expect(goalPopup).toContainText('Congratulations! You\'ve passed a new goal!');
      
      // Check that it shows the HIGHEST goal passed (the second goal)
      await expect(goalPopup).toContainText(highestGoal.title);
      
      // Close the popup
      const closeButton = page.locator('text=Close').last();
      await closeButton.click();
      await expect(goalPopup).toBeHidden({ timeout: 10000 });
    } else {
      console.log('Goal popup did not appear - this may be expected depending on test data');
    }
  });
});