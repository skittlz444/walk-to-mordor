#!/usr/bin/env node

/**
 * Generate a comprehensive test summary for GitHub PR comments
 * This script processes coverage data and test results to create a formatted summary
 */

const fs = require('fs');
const path = require('path');

function generateTestSummary() {
  console.log('📊 Generating comprehensive test summary...');
  
  // Read coverage data
  let coverageData = null;
  let overallStats = null;
  
  try {
    const coveragePath = 'artifacts/coverage-reports/coverage-final.json';
    if (fs.existsSync(coveragePath)) {
      coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      console.log('✅ Coverage data found');
      
      // Calculate overall coverage stats
      let totalStatements = 0, coveredStatements = 0;
      let totalBranches = 0, coveredBranches = 0;
      let totalFunctions = 0, coveredFunctions = 0;
      let totalLines = 0, coveredLines = 0;
      
      Object.values(coverageData).forEach(file => {
        const stmtTotal = Object.keys(file.statementMap).length;
        const stmtCovered = Object.values(file.s).filter(x => x > 0).length;
        totalStatements += stmtTotal;
        coveredStatements += stmtCovered;
        
        // Each branch map entry can have multiple locations
        const branchTotal = Object.keys(file.branchMap).length;
        const branchCovered = Object.values(file.b).filter(branchArray => 
          Array.isArray(branchArray) && branchArray.some(x => x > 0)
        ).length;
        totalBranches += branchTotal;
        coveredBranches += branchCovered;
        
        const funcTotal = Object.keys(file.fnMap).length;
        const funcCovered = Object.values(file.f).filter(x => x > 0).length;
        totalFunctions += funcTotal;
        coveredFunctions += funcCovered;
        
        totalLines += stmtTotal; // Approximate lines as statements
        coveredLines += stmtCovered;
      });
      
      overallStats = {
        statements: totalStatements > 0 ? Math.round((coveredStatements / totalStatements) * 100) : 0,
        branches: totalBranches > 0 ? Math.round((coveredBranches / totalBranches) * 100) : 0,
        functions: totalFunctions > 0 ? Math.round((coveredFunctions / totalFunctions) * 100) : 0,
        lines: totalLines > 0 ? Math.round((coveredLines / totalLines) * 100) : 0
      };
      
      console.log('📈 Coverage stats calculated:', overallStats);
    } else {
      console.log('⚠️ Coverage data not found at:', coveragePath);
    }
  } catch (error) {
    console.log('⚠️ Error reading coverage data:', error.message);
  }
  
  // Get test results from environment variables
  const unitTestsResult = process.env.UNIT_TESTS_RESULT || 'unknown';
  const apiTestsResult = process.env.API_TESTS_RESULT || 'unknown';
  const uiTestsResult = process.env.UI_TESTS_RESULT || 'unknown';
  
  function getStatusEmoji(result) {
    switch(result) {
      case 'success': return '✅';
      case 'failure': return '❌';
      case 'cancelled': return '⚠️';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  }
  
  function getCoverageEmoji(percentage) {
    if (percentage >= 90) return '🟢';
    if (percentage >= 80) return '🟡';
    if (percentage >= 70) return '🟠';
    return '🔴';
  }
  
  // Generate the summary
  const githubServerUrl = process.env.GITHUB_SERVER_URL || 'https://github.com';
  const githubRepository = process.env.GITHUB_REPOSITORY || 'skittlz444/walk-to-mordor';
  const githubRunId = process.env.GITHUB_RUN_ID || 'unknown';
  
  let coverageSection = '';
  if (overallStats) {
    coverageSection = `### 📊 Code Coverage

| Metric | Coverage | Status |
|---------|----------|--------|
| **Statements** | **${overallStats.statements}%** | ${getCoverageEmoji(overallStats.statements)} |
| **Branches** | **${overallStats.branches}%** | ${getCoverageEmoji(overallStats.branches)} |
| **Functions** | **${overallStats.functions}%** | ${getCoverageEmoji(overallStats.functions)} |
| **Lines** | **${overallStats.lines}%** | ${getCoverageEmoji(overallStats.lines)} |

`;
  } else {
    coverageSection = `### 📊 Code Coverage

Coverage data is not available. This may be because tests failed or coverage collection was disabled.

`;
  }
  
  const summary = `## 🧪 Test Results Summary

### Test Suites Status
| Test Suite | Status | Result |
|------------|---------|---------|
| Unit Tests | ${getStatusEmoji(unitTestsResult)} | ${unitTestsResult.toUpperCase()} |
| API Tests | ${getStatusEmoji(apiTestsResult)} | ${apiTestsResult.toUpperCase()} |
| UI Tests | ${getStatusEmoji(uiTestsResult)} | ${uiTestsResult.toUpperCase()} |

${coverageSection}### 📋 Available Reports

The following detailed reports are available in the **Actions** tab under **Artifacts**:

- 📊 **Coverage Report** - HTML coverage report showing line-by-line coverage
- 📋 **Coverage Results** - JUnit XML coverage report for GitHub test reporting
- 🧪 **Unit Test Results** - JUnit XML results for unit tests  
- 🔗 **API Test Reports** - HTML and XML reports for API integration tests
- 🖥️ **UI Test Reports** - Playwright HTML reports for end-to-end tests

### 🔗 Quick Links

- [📊 View All Artifacts](${githubServerUrl}/${githubRepository}/actions/runs/${githubRunId}) - Download coverage and test reports
- [🧪 Test Details](${githubServerUrl}/${githubRepository}/actions/runs/${githubRunId}) - View test results in GitHub
- [📝 Workflow Run](${githubServerUrl}/${githubRepository}/actions/runs/${githubRunId}) - Complete workflow details

---
*Generated automatically by GitHub Actions*`;

  // Ensure output directory exists
  if (!fs.existsSync('test-summary')) {
    fs.mkdirSync('test-summary', { recursive: true });
  }
  
  // Save summary
  fs.writeFileSync('test-summary/summary.md', summary);
  console.log('📄 Test summary generated successfully');
  
  return summary;
}

// Run if called directly
if (require.main === module) {
  try {
    generateTestSummary();
  } catch (error) {
    console.error('❌ Error generating test summary:', error);
    process.exit(1);
  }
}

module.exports = { generateTestSummary };