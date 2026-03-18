#!/usr/bin/env node

/**
 * Asset Count CI Dashboard
 *
 * Counts files recursively under a target directory (default: public/)
 * and enforces Cloudflare Workers Assets file budget thresholds.
 *
 * Thresholds (derived from Cloudflare Workers Assets 25,000-file soft limit):
 *   - Pass:  < 15,000 files
 *   - Warn:  >= 15,000 and < 18,000 files
 *   - Fail:  >= 18,000 files
 *
 * Usage:
 *   node .github/scripts/check-asset-count.js [directory]
 *   npm run check:assets
 *
 * In GitHub Actions: writes Markdown to $GITHUB_STEP_SUMMARY and emits
 * ::warning:: or ::error:: annotations.
 * Locally: outputs a human-readable table to stdout.
 */

const fs = require('fs');
const path = require('path');

// Cloudflare Workers Assets threshold constants
const WARN_THRESHOLD = 15000;
const FAIL_THRESHOLD = 18000;

// Deterministic number formatting (avoid locale-dependent toLocaleString)
const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n);

/**
 * Recursively count all files under a directory.
 * Uses lstatSync to avoid following symlinks.
 * @param {string} dir - Directory to count files in
 * @returns {number} Total file count
 */
function countFiles(dir) {
  let count = 0;
  let entries;

  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return 0;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch (err) {
      continue;
    }
    if (stat.isFile()) {
      count++;
    } else if (stat.isDirectory()) {
      count += countFiles(fullPath);
    }
  }

  return count;
}

/**
 * Get file count breakdown by top-level subdirectory.
 * Also counts files directly in the root of the target directory.
 * @param {string} dir - Directory to break down
 * @returns {{ breakdown: Array<{name: string, count: number}>, total: number }}
 */
function getBreakdown(dir) {
  const breakdown = [];
  let total = 0;
  let entries;

  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    return { breakdown, total: 0 };
  }

  let rootFiles = 0;

  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch (err) {
      continue;
    }

    if (stat.isFile()) {
      rootFiles++;
      total++;
    } else if (stat.isDirectory()) {
      const count = countFiles(fullPath);
      if (count > 0) {
        breakdown.push({ name: entry, count });
      }
      total += count;
    }
  }

  if (rootFiles > 0) {
    breakdown.push({ name: '(root files)', count: rootFiles });
  }

  // Sort by count descending
  breakdown.sort((a, b) => b.count - a.count);

  return { breakdown, total };
}

/**
 * Classify the file count against thresholds.
 * @param {number} total - Total file count
 * @returns {'pass' | 'warn' | 'fail'}
 */
function classify(total) {
  if (total >= FAIL_THRESHOLD) return 'fail';
  if (total >= WARN_THRESHOLD) return 'warn';
  return 'pass';
}

/**
 * Build a Markdown summary table for GitHub Actions.
 * @param {number} total
 * @param {Array<{name: string, count: number}>} breakdown
 * @param {string} status
 * @param {string} targetDir
 * @returns {string}
 */
function buildMarkdownSummary(total, breakdown, status, targetDir) {
  const statusEmoji = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  const statusLabel = status === 'pass' ? 'Pass' : status === 'warn' ? 'Warning' : 'Fail';

  let md = `## 📦 Asset Count: ${statusEmoji} ${statusLabel}\n\n`;
  md += `**Total files in \`${targetDir}/\`:** ${fmtNum(total)}\n\n`;
  md += `| Threshold | Value | Status |\n`;
  md += `|-----------|-------|--------|\n`;
  md += `| Warning | ${fmtNum(WARN_THRESHOLD)} | ${total >= WARN_THRESHOLD ? '⚠️ Exceeded' : '✅ OK'} |\n`;
  md += `| Failure | ${fmtNum(FAIL_THRESHOLD)} | ${total >= FAIL_THRESHOLD ? '❌ Exceeded' : '✅ OK'} |\n\n`;

  if (breakdown.length > 0) {
    md += `### Breakdown by Directory\n\n`;
    md += `| Directory | Files |\n`;
    md += `|-----------|-------|\n`;
    for (const { name, count } of breakdown) {
      md += `| \`${name}\` | ${fmtNum(count)} |\n`;
    }
    md += '\n';
  }

  md += `_Cloudflare Workers Assets limit: 25,000 files_\n`;

  return md;
}

/**
 * Build human-readable terminal output.
 * @param {number} total
 * @param {Array<{name: string, count: number}>} breakdown
 * @param {string} status
 * @param {string} targetDir
 * @returns {string}
 */
function buildTerminalOutput(total, breakdown, status, targetDir) {
  const statusEmoji = status === 'pass' ? '✅' : status === 'warn' ? '⚠️' : '❌';
  const statusLabel = status === 'pass' ? 'PASS' : status === 'warn' ? 'WARNING' : 'FAIL';

  let output = `\n📦 Asset Count Check: ${statusEmoji} ${statusLabel}\n`;
  output += `${'─'.repeat(45)}\n`;
  output += `Directory: ${targetDir}/\n`;
  output += `Total files: ${fmtNum(total)}\n`;
  output += `Warn threshold: ${fmtNum(WARN_THRESHOLD)}\n`;
  output += `Fail threshold: ${fmtNum(FAIL_THRESHOLD)}\n`;
  output += `${'─'.repeat(45)}\n`;

  if (breakdown.length > 0) {
    output += `\nBreakdown:\n`;
    const maxNameLen = Math.max(...breakdown.map((b) => b.name.length));
    for (const { name, count } of breakdown) {
      output += `  ${name.padEnd(maxNameLen + 2)} ${fmtNum(count)}\n`;
    }
  }

  output += `\n`;

  return output;
}

/**
 * Main execution — runs the asset count check.
 * Exported for testing; also runs automatically when invoked directly.
 */
function main() {
  const targetDir = process.argv[2] || 'public';
  const resolvedDir = path.resolve(targetDir);

  if (!fs.existsSync(resolvedDir)) {
    console.error(`❌ Directory not found: ${resolvedDir}`);
    process.exit(1);
  }

  if (!fs.statSync(resolvedDir).isDirectory()) {
    console.error(`❌ Path is not a directory: ${resolvedDir}`);
    process.exit(1);
  }

  const { breakdown, total } = getBreakdown(resolvedDir);
  const status = classify(total);
  const isCI = !!process.env.GITHUB_STEP_SUMMARY;

  if (isCI) {
    // Write Markdown summary to $GITHUB_STEP_SUMMARY
    const markdown = buildMarkdownSummary(total, breakdown, status, targetDir);
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);

    // Emit workflow annotations
    if (status === 'warn') {
      console.log(`::warning::Asset count (${fmtNum(total)}) approaching limit. Warn threshold: ${fmtNum(WARN_THRESHOLD)}, Fail threshold: ${fmtNum(FAIL_THRESHOLD)}`);
    } else if (status === 'fail') {
      console.log(`::error::Asset count (${fmtNum(total)}) exceeds fail threshold of ${fmtNum(FAIL_THRESHOLD)}! Reduce asset count before deploying.`);
    }

    // Also print summary to CI log
    console.log(`📦 Asset count: ${fmtNum(total)} files in ${targetDir}/ [${status.toUpperCase()}]`);
  } else {
    // Local output
    const output = buildTerminalOutput(total, breakdown, status, targetDir);
    console.log(output);
  }

  // Exit with code 1 on fail, 0 otherwise
  if (status === 'fail') {
    process.exit(1);
  }
}

// Export functions for testing
module.exports = {
  countFiles,
  getBreakdown,
  classify,
  buildMarkdownSummary,
  buildTerminalOutput,
  main,
  WARN_THRESHOLD,
  FAIL_THRESHOLD,
};

// Run main when invoked directly
if (require.main === module) {
  main();
}
