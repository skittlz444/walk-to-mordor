#!/usr/bin/env node
/**
 * Runs Playwright UI tests one browser project at a time, each with parallel workers.
 * This keeps dev-server load manageable while still covering all browsers.
 *
 * Usage:
 *   node scripts/test-ui-all-browsers.js            # run all 4 browsers
 *   node scripts/test-ui-all-browsers.js chromium    # run specific browser(s)
 */
const { execSync } = require('child_process');

const ALL_PROJECTS = ['chromium', 'firefox', 'Mobile Chrome', 'Mobile Firefox'];

const requested = process.argv.slice(2);
const projects = requested.length > 0 ? requested : ALL_PROJECTS;

let failed = 0;
let passed = 0;

for (const project of projects) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${project}`);
  console.log('='.repeat(60));

  try {
    execSync(`npx playwright test --project="${project}" --reporter=line`, {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
    passed++;
  } catch {
    failed++;
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Results: ${passed}/${projects.length} browser projects passed`);
if (failed > 0) {
  console.log(`${failed} browser project(s) had failures`);
}
console.log('='.repeat(60));

process.exit(failed > 0 ? 1 : 0);
