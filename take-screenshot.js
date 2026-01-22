const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  
  const htmlPath = path.join(__dirname, '_bmad-output', 'goal-modal-changes.html');
  await page.goto(`file://${htmlPath}`);
  
  // Wait for page to render
  await page.waitForTimeout(1000);
  
  // Take full page screenshot
  const screenshotPath = path.join(__dirname, '_bmad-output', 'goal-modal-screenshot.png');
  await page.screenshot({ 
    path: screenshotPath,
    fullPage: true 
  });
  
  console.log('✓ Screenshot saved:', screenshotPath);
  
  await browser.close();
})();
