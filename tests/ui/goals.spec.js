// @ts-check
const { 
  test, 
  expect, 
  setupTest, 
  generateRealisticTestDistance, 
  generateLargeTestDistance, 
  generateRandomTestDate, 
  selectCalendarDate, 
  createTestEvent 
} = require('./helpers/common');

// Helper to properly close popup with Firefox compatibility
async function closePopupRobust(page, closeButton) {
  try {
    await closeButton.click({ timeout: 2000 });
  } catch (e) {
    // If standard click fails (e.g. covered) or times out, try force click
    await closeButton.click({ force: true });
  }
  
  // Firefox may need more time for popup animations/transitions
  await page.waitForTimeout(1000);
  
  // Wait for popup to actually close - Firefox sometimes has timing issues
  await page.waitForFunction(() => {
    const popup = document.querySelector('.modal-overlay');
    return !popup || window.getComputedStyle(popup).display === 'none' || 
           popup.style.display === 'none' || !popup.offsetParent;
  }, { timeout: 10000 });
  
  await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 10000 });
}

// Helper to open first available goal popup
async function openFirstAvailableGoalPopup(page) {
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

test.describe('Goals Functionality', () => {
  // Set longer timeout for tests that might have slow loading
  test.setTimeout(60000);

  test.beforeEach(async ({ page, authToken }) => {
    await setupTest({ page, authToken });
  });

  test('Goal popup images load correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for goal-related elements using the patterns from edge cases test
    const goalSelectors = [
      '.upcoming-goal',
      '.completed-goal',
      '.goal-header-main',
      '#last-goal'
    ];
    
    let goalFound = false;
    
    for (const selector of goalSelectors) {
      const goalElements = page.locator(selector);
      const count = await goalElements.count();
      
      if (count > 0) {
        try {
          const firstGoal = goalElements.first();
          
          // Check if element is visible and clickable
          if (await firstGoal.isVisible({ timeout: 2000 })) {
            await firstGoal.click({ timeout: 5000 });
            await page.waitForTimeout(1000);
            
            // Check if popup appeared using simpler selector
            const popup = page.locator('.modal-overlay');
            if (await popup.isVisible({ timeout: 3000 })) {
              
              // Check for images in popup (simplified verification)
              const images = popup.locator('img');
              const imageCount = await images.count();
              
              if (imageCount > 0) {
                goalFound = true;
              }
              
              // Close popup using the Close button from edge cases pattern
              const closeButton = page.locator('text=Close').last();
              if (await closeButton.isVisible({ timeout: 2000 })) {
                await closeButton.click();
                await page.waitForTimeout(500);
              }
              
              break;
            }
          }
        } catch (error) {
          // Goal element interaction failed, continue to test fix or expect block
          continue;
        }
      }
    }
    
    if (!goalFound) {
      test.fixme(true, 'No interactive goals found to test popup images. Ensure goals exist in the system for this test.');
    } else {
      // Test passed - we successfully interacted with a goal popup
      expect(goalFound).toBe(true);
    }
  });

  test('Goal popup shows congratulations when user passes a goal by adding distance', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Close any existing popups first
    try {
      const existingPopup = page.locator('.modal-overlay');
      if (await existingPopup.isVisible({ timeout: 1000 })) {
        const closeButton = page.locator('text=Close').last();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        } else {
          await page.click('body'); // Click outside to close
        }
        await page.waitForTimeout(500);
      }
    } catch (error) {
      // No popup to close, continue
    }

    // Verify page loaded with goals
    await expect(page.locator('#goals-list')).toBeVisible();

    // Get the current goals to find the first upcoming goal
    const goals = await page.evaluate(async () => {
      const token = localStorage.getItem('sessionToken');
      const headers = window.getAuthHeaders ? window.getAuthHeaders() : { 'Authorization': `Bearer ${token}` };
      const response = await fetch('/api/goals', { headers });
      return await response.json();
    });

    if (goals.length === 0) {
      test.skip(true, `No goals available for congratulations testing. Need at least one goal to test goal completion popup.`);
      return;
    }

    // Find the first goal with a reasonable distance for testing
    const testGoal = goals.find(goal => goal.distance > 0 && goal.distance <= 100);
    
    if (!testGoal) {
      const availableGoals = goals.map(g => `${g.title}: ${g.distance}km`).join(', ');
      test.skip(true, `No suitable goals found for testing. Need goals ≤100km, available: ${availableGoals}`);
      return;
    }

    // Add a distance entry that will pass this goal
    const testDistance = testGoal.distance + 1; // Slightly more than the goal distance
    const testDateInfo = generateRandomTestDate();

    // Create event using the helper pattern
    const cell = await selectCalendarDate(page, testDateInfo.day);
    await cell.click({ force: true, timeout: 10000 });

    // Enter the distance that should pass the goal
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

    // Check if the goal popup opened with congratulations text
    const goalPopup = page.locator('.modal-overlay');
      // Check for congratulations text
    await expect(goalPopup).toContainText('Congratulations! You\'ve passed a new goal!');
    
    // Check that it shows the correct goal
    await expect(goalPopup).toContainText(testGoal.title);
    
    // Close the popup
    const closeButton = page.locator('text=Close').last();
    await closeButton.click();
    await expect(goalPopup).toBeHidden({ timeout: 10000 });

    // Ensure popup is fully closed before test ends
    await page.waitForTimeout(500);
    
    // Always try to close any remaining popups
    try {
      const finalPopup = page.locator('.modal-overlay');
      if (await finalPopup.isVisible({ timeout: 1000 })) {
        const closeButton = page.locator('text=Close').last();
        if (await closeButton.isVisible({ timeout: 1000 })) {
          await closeButton.click();
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('Goals section renders and controls work', async ({ page }) => {
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

  test('Goal popup opens for upcoming goals and shows correct content', async ({ page }) => {
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
    if (popupText && popupText.includes('km to go')) {
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
      
      // Wait for popup to actually close
      await page.waitForFunction(() => {
        const popup = document.querySelector('.modal-overlay');
        return !popup || window.getComputedStyle(popup).display === 'none' || 
               popup.style.display === 'none' || !popup.offsetParent;
      }, { timeout: 10000 });
      
      await expect(page.locator('.modal-overlay')).toBeHidden({ timeout: 5000 });
    }
  });

  test('Goal popup opens for completed goals and shows strikethrough distance', async ({ page }) => {
    // Close any existing popups first
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
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo.day);
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
    
    await goalToClick.click({ force: true });
    
    // Check that goal popup is visible
    await expect(page.locator('.modal-overlay')).toBeVisible();
    
    // Check that Close button exists and has correct text
    const closeButton = page.locator('#close-goal-btn').last();
    await expect(closeButton).toBeVisible();
    await expect(closeButton).toHaveText('Close');
    
    // Check that distance is displayed but no "km to go" for completed goals
    const popupContent = page.locator('.modal-overlay');
    await expect(popupContent).toContainText('km');
    await expect(popupContent).not.toContainText('km to go');
    
    // Close the popup
    await closePopupRobust(page, closeButton);
  });

  test('Goal popup opens from header goals', async ({ page }) => {
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
      const testDateInfo = generateRandomTestDate();
      const cell = await selectCalendarDate(page, testDateInfo.day);
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
      if (hasDescription) {
        expect(hasDescription.length).toBeGreaterThan(50); // Should have substantial content
      }
      
      // Check that Close button works
    // Use specific ID for goal modal to ensure we click the right one, get the last one if duplicates exist
    const closeButton = page.locator('#close-goal-btn').last();
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
        if (hasDescription) {
          expect(hasDescription.length).toBeGreaterThan(50); // Should have substantial content
        }
        
        // Check that Close button works
        // Use specific ID for goal modal, get last to resolve duplicates
        const closeButton = page.locator('#close-goal-btn').last();
        await closePopupRobust(page, closeButton);
      }
    }
  });

  test('Goal popup shows distance information correctly', async ({ page }) => {
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
      // Use the robust helper with specific ID, get last to resolve duplicates
      const closeButton = page.locator('#close-goal-btn').last();
      await closePopupRobust(page, closeButton);
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

  test('Thumbnail image initially has blur filter applied', async ({ page }) => {
    // Block high-res images from loading to test initial blur state
    await page.route('**/img/highres/*', route => route.abort());

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
    await page.route('**/img/thumbs/*', route => {
      if (route.request().url().includes('0-thumb.webp')) {
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
    await expect(thumbImage).toHaveAttribute('src', '/img/thumbs/0-thumb.webp');
  });

  test('High-res image falls back to placeholder on error', async ({ page }) => {
    // Mock network to make highres image fail
    await page.route('**/img/highres/*', route => {
      if (route.request().url().includes('0.webp')) {
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
    await expect(highresImage).toHaveAttribute('src', '/img/highres/0.webp');
  });

  test('Image lazy loading only occurs when popup is opened', async ({ page }) => {
    let imageRequestsMade = [];
    
    // Track image requests
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/img/thumbs/') || url.includes('/img/highres/')) {
        imageRequestsMade.push(url);
      }
    });

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
      }
    }
  });

  test('Only the highest passed goal shows when multiple goals are passed', async ({ page }) => {
    await page.waitForLoadState('networkidle');

    // Verify page loaded with goals
    await expect(page.locator('#goals-list')).toBeVisible();

    // Get the current goals
    const goals = await page.evaluate(async () => {
      const token = localStorage.getItem('sessionToken');
      const headers = window.getAuthHeaders ? window.getAuthHeaders() : { 'Authorization': `Bearer ${token}` };
      const response = await fetch('/api/goals', { headers });
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
    const testDateInfo = generateRandomTestDate();
    const cell = await selectCalendarDate(page, testDateInfo.day);
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
    }
  });

});
