#!/usr/bin/env node

/**
 * Generate JUnit XML report for code coverage data
 * This script converts Jest coverage data into JUnit XML format for GitHub test reporting
 */

const fs = require('fs');
const path = require('path');

function generateCoverageJUnit() {
  console.log('📊 Generating coverage JUnit XML report...');
  
  // Read coverage data
  let coverageData = null;
  
  try {
    const coveragePath = 'coverage/coverage-final.json';
    if (fs.existsSync(coveragePath)) {
      coverageData = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
      console.log('✅ Coverage data found');
    } else {
      console.log('⚠️ Coverage data not found at:', coveragePath);
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Error reading coverage data:', error.message);
    process.exit(1);
  }
  
  // Calculate overall coverage stats
  let totalStatements = 0, coveredStatements = 0;
  let totalBranches = 0, coveredBranches = 0;
  let totalFunctions = 0, coveredFunctions = 0;
  let totalLines = 0, coveredLines = 0;
  let fileDetails = [];
  
  Object.entries(coverageData).forEach(([filePath, file]) => {
    const stmtTotal = Object.keys(file.statementMap).length;
    const stmtCovered = Object.values(file.s).filter(x => x > 0).length;
    totalStatements += stmtTotal;
    coveredStatements += stmtCovered;
    
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
    
    totalLines += stmtTotal;
    coveredLines += stmtCovered;
    
    // Store file details for individual test cases
    const stmtPct = stmtTotal > 0 ? (stmtCovered / stmtTotal) * 100 : 100;
    const branchPct = branchTotal > 0 ? (branchCovered / branchTotal) * 100 : 100;
    const funcPct = funcTotal > 0 ? (funcCovered / funcTotal) * 100 : 100;
    
    fileDetails.push({
      path: filePath,
      statements: { covered: stmtCovered, total: stmtTotal, pct: stmtPct },
      branches: { covered: branchCovered, total: branchTotal, pct: branchPct },
      functions: { covered: funcCovered, total: funcTotal, pct: funcPct }
    });
  });
  
  const overallStats = {
    statements: totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 100,
    branches: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 100,
    functions: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 100,
    lines: totalLines > 0 ? (coveredLines / totalLines) * 100 : 100
  };
  
  console.log('📈 Coverage stats calculated:', {
    statements: Math.round(overallStats.statements),
    branches: Math.round(overallStats.branches),
    functions: Math.round(overallStats.functions),
    lines: Math.round(overallStats.lines)
  });
  
  // Generate JUnit XML
  const timestamp = new Date().toISOString();
  const testsuiteTime = '0.001'; // Coverage collection is instantaneous
  
  // Create test cases for each file
  const testCases = fileDetails.map(file => {
    const relativePath = path.relative(process.cwd(), file.path);
    const className = relativePath.replace(/[/\\]/g, '.').replace(/\.(js|ts|jsx|tsx)$/, '');
    
    // Determine if this file "passes" based on coverage thresholds
    const minCoverage = 70; // Could be configurable
    const passes = file.statements.pct >= minCoverage && 
                   file.branches.pct >= minCoverage && 
                   file.functions.pct >= minCoverage;
    
    if (passes) {
      return `    <testcase classname="Coverage.${className}" name="Coverage Check" time="0.001">
      <properties>
        <property name="statements" value="${file.statements.covered}/${file.statements.total} (${file.statements.pct.toFixed(1)}%)"/>
        <property name="branches" value="${file.branches.covered}/${file.branches.total} (${file.branches.pct.toFixed(1)}%)"/>
        <property name="functions" value="${file.functions.covered}/${file.functions.total} (${file.functions.pct.toFixed(1)}%)"/>
      </properties>
    </testcase>`;
    } else {
      const failureReason = [];
      if (file.statements.pct < minCoverage) failureReason.push(`statements: ${file.statements.pct.toFixed(1)}%`);
      if (file.branches.pct < minCoverage) failureReason.push(`branches: ${file.branches.pct.toFixed(1)}%`);
      if (file.functions.pct < minCoverage) failureReason.push(`functions: ${file.functions.pct.toFixed(1)}%`);
      
      return `    <testcase classname="Coverage.${className}" name="Coverage Check" time="0.001">
      <failure message="Coverage below threshold" type="CoverageFailure">
Coverage below ${minCoverage}% threshold for: ${failureReason.join(', ')}

File: ${relativePath}
Statements: ${file.statements.covered}/${file.statements.total} (${file.statements.pct.toFixed(1)}%)
Branches: ${file.branches.covered}/${file.branches.total} (${file.branches.pct.toFixed(1)}%)
Functions: ${file.functions.covered}/${file.functions.total} (${file.functions.pct.toFixed(1)}%)
      </failure>
      <properties>
        <property name="statements" value="${file.statements.covered}/${file.statements.total} (${file.statements.pct.toFixed(1)}%)"/>
        <property name="branches" value="${file.branches.covered}/${file.branches.total} (${file.branches.pct.toFixed(1)}%)"/>
        <property name="functions" value="${file.functions.covered}/${file.functions.total} (${file.functions.pct.toFixed(1)}%)"/>
      </properties>
    </testcase>`;
    }
  });
  
  // Add overall summary test case
  const overallPasses = overallStats.statements >= 70 && 
                       overallStats.branches >= 70 && 
                       overallStats.functions >= 70;
  
  const overallTestCase = overallPasses ? 
    `    <testcase classname="Coverage.Overall" name="Overall Coverage" time="0.001">
      <properties>
        <property name="statements" value="${coveredStatements}/${totalStatements} (${overallStats.statements.toFixed(1)}%)"/>
        <property name="branches" value="${coveredBranches}/${totalBranches} (${overallStats.branches.toFixed(1)}%)"/>
        <property name="functions" value="${coveredFunctions}/${totalFunctions} (${overallStats.functions.toFixed(1)}%)"/>
        <property name="lines" value="${coveredLines}/${totalLines} (${overallStats.lines.toFixed(1)}%)"/>
      </properties>
    </testcase>` :
    `    <testcase classname="Coverage.Overall" name="Overall Coverage" time="0.001">
      <failure message="Overall coverage below threshold" type="CoverageFailure">
Overall coverage below 70% threshold

Statements: ${coveredStatements}/${totalStatements} (${overallStats.statements.toFixed(1)}%)
Branches: ${coveredBranches}/${totalBranches} (${overallStats.branches.toFixed(1)}%)
Functions: ${coveredFunctions}/${totalFunctions} (${overallStats.functions.toFixed(1)}%)
Lines: ${coveredLines}/${totalLines} (${overallStats.lines.toFixed(1)}%)
      </failure>
      <properties>
        <property name="statements" value="${coveredStatements}/${totalStatements} (${overallStats.statements.toFixed(1)}%)"/>
        <property name="branches" value="${coveredBranches}/${totalBranches} (${overallStats.branches.toFixed(1)}%)"/>
        <property name="functions" value="${coveredFunctions}/${totalFunctions} (${overallStats.functions.toFixed(1)}%)"/>
        <property name="lines" value="${coveredLines}/${totalLines} (${overallStats.lines.toFixed(1)}%)"/>
      </properties>
    </testcase>`;
  
  const failures = fileDetails.filter(f => 
    f.statements.pct < 70 || f.branches.pct < 70 || f.functions.pct < 70
  ).length + (overallPasses ? 0 : 1);
  
  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites id="coverage" name="Code Coverage Report" tests="${fileDetails.length + 1}" failures="${failures}" time="${testsuiteTime}" timestamp="${timestamp}">
  <testsuite id="coverage" name="Code Coverage" tests="${fileDetails.length + 1}" failures="${failures}" time="${testsuiteTime}" timestamp="${timestamp}">
${testCases.join('\n')}
${overallTestCase}
  </testsuite>
</testsuites>`;
  
  // Ensure output directory exists
  if (!fs.existsSync('test-results')) {
    fs.mkdirSync('test-results', { recursive: true });
  }
  
  // Save XML report
  fs.writeFileSync('test-results/coverage-junit.xml', xml);
  console.log('📄 Coverage JUnit XML report generated successfully');
  
  return xml;
}

// Run if called directly
if (require.main === module) {
  try {
    generateCoverageJUnit();
  } catch (error) {
    console.error('❌ Error generating coverage JUnit XML:', error);
    process.exit(1);
  }
}

module.exports = { generateCoverageJUnit };