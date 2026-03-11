/**
 * Tests for cache version management scripts
 * 
 * These tests ensure the build scripts work correctly for updating service worker cache names.
 * 
 * Test Coverage:
 * - updateCacheVersion(): Replaces {{BUILD_TIMESTAMP}} placeholder with actual timestamps
 * - resetCacheVersion(): Restores development placeholders for clean development state
 * - Command line execution: Validates scripts work when called from build process
 * - Error handling: Ensures graceful failure and appropriate error messages
 * - Integration: Verifies complete update/reset cycles work correctly
 * 
 * The cache versioning system ensures each deployment gets a fresh cache by using
 * build-time timestamps in the format: walk-to-mordor-YYYYMMDD-HHMMSS
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Source sw.js to copy content from
const REAL_SW_PATH = path.join(__dirname, '..', '..', 'public', 'sw.js');

describe('Cache Version Management Scripts', () => {
  const BUILD_TIMESTAMP_PLACEHOLDER = '{{BUILD_TIMESTAMP}}';
  
  let tmpSW;
  let placeholderContent;
  
  beforeAll(() => {
    // Create a temp file for ALL tests to isolate from dev server / parallel workers
    tmpSW = path.join(os.tmpdir(), `sw-cache-test-${process.pid}.js`);
    
    // Read real sw.js and build canonical placeholder version
    const originalContent = fs.readFileSync(REAL_SW_PATH, 'utf8');
    placeholderContent = originalContent
      .replace(/const BUILD_TIMESTAMP = ['`][^'`]*['`];/, `const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`)
      .replace(/const CACHE_NAME = [`'"][^`'"]*[`'"];/, `const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
    
    // Point scripts at the temp file via env var (lazy resolution)
    process.env.SW_PATH = tmpSW;
  });
  
  beforeEach(() => {
    // Write fresh placeholder content before each test
    fs.writeFileSync(tmpSW, placeholderContent, 'utf8');
  });
  
  afterAll(() => {
    // Clean up
    delete process.env.SW_PATH;
    try { fs.unlinkSync(tmpSW); } catch (_) { /* ignore */ }
  });
  
  // Import AFTER setting env var is not needed since scripts use lazy getSwPath()
  const { updateCacheVersion } = require('../../public/js/update-cache-version');
  const { resetCacheVersion } = require('../../public/js/reset-cache-version');

  describe('updateCacheVersion', () => {
    test('should replace BUILD_TIMESTAMP placeholder with actual timestamp', () => {
      // Arrange - service worker should have placeholder
      const beforeContent = fs.readFileSync(tmpSW, 'utf8');
      expect(beforeContent).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      
      // Act
      updateCacheVersion();
      
      // Assert
      const afterContent = fs.readFileSync(tmpSW, 'utf8');
      expect(afterContent).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
    });
    
    test('should generate timestamp in correct format (YYYYMMDD-HHMMSS)', () => {
      // Act
      updateCacheVersion();
      
      // Assert
      const content = fs.readFileSync(tmpSW, 'utf8');
      const timestampMatch = content.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/);
      
      expect(timestampMatch).toBeTruthy();
      expect(timestampMatch[1]).toMatch(/^\d{8}-\d{6}$/);
      
      // Verify it's a valid date format
      const [datePart, timePart] = timestampMatch[1].split('-');
      const year = datePart.substring(0, 4);
      const month = datePart.substring(4, 6);
      const day = datePart.substring(6, 8);
      const hour = timePart.substring(0, 2);
      const minute = timePart.substring(2, 4);
      const second = timePart.substring(4, 6);
      
      expect(parseInt(year)).toBeGreaterThanOrEqual(2024);
      expect(parseInt(month)).toBeGreaterThanOrEqual(1);
      expect(parseInt(month)).toBeLessThanOrEqual(12);
      expect(parseInt(day)).toBeGreaterThanOrEqual(1);
      expect(parseInt(day)).toBeLessThanOrEqual(31);
      expect(parseInt(hour)).toBeGreaterThanOrEqual(0);
      expect(parseInt(hour)).toBeLessThanOrEqual(23);
      expect(parseInt(minute)).toBeGreaterThanOrEqual(0);
      expect(parseInt(minute)).toBeLessThanOrEqual(59);
      expect(parseInt(second)).toBeGreaterThanOrEqual(0);
      expect(parseInt(second)).toBeLessThanOrEqual(59);
    });
    
    test('should update CACHE_NAME with timestamp', () => {
      // Act
      updateCacheVersion();
      
      // Assert
      const content = fs.readFileSync(tmpSW, 'utf8');
      const cacheNameMatch = content.match(/const CACHE_NAME = `walk-to-mordor-(\d{8}-\d{6})`;/);
      
      expect(cacheNameMatch).toBeTruthy();
      expect(cacheNameMatch[1]).toMatch(/^\d{8}-\d{6}$/);
    });
    
    test('should use same timestamp for both BUILD_TIMESTAMP and CACHE_NAME', () => {
      // Act
      updateCacheVersion();
      
      // Assert
      const content = fs.readFileSync(tmpSW, 'utf8');
      const timestampMatch = content.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/);
      const cacheNameMatch = content.match(/const CACHE_NAME = `walk-to-mordor-(\d{8}-\d{6})`;/);
      
      expect(timestampMatch[1]).toBe(cacheNameMatch[1]);
    });
    
    test('should handle missing placeholder gracefully', () => {
      // Arrange - remove ALL placeholders from service worker
      const contentWithoutPlaceholder = fs.readFileSync(tmpSW, 'utf8')
        .replace(new RegExp(BUILD_TIMESTAMP_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'), 'some-other-value');
      fs.writeFileSync(tmpSW, contentWithoutPlaceholder, 'utf8');
      
      // Spy on console.log to capture warning
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Act
      updateCacheVersion();
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Build timestamp placeholder not found in service worker');
      
      // Content should remain unchanged
      const afterContent = fs.readFileSync(tmpSW, 'utf8');
      expect(afterContent).toBe(contentWithoutPlaceholder);
      
      consoleSpy.mockRestore();
    });
    
    test('should generate unique timestamps on sequential calls', async () => {
      // Act - call twice with small delay
      updateCacheVersion();
      const firstContent = fs.readFileSync(tmpSW, 'utf8');
      const firstTimestamp = firstContent.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/)[1];
      
      // Reset to placeholder for second call
      const resetContent = firstContent
        .replace(/const BUILD_TIMESTAMP = '[^']+';/, `const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`)
        .replace(/const CACHE_NAME = `walk-to-mordor-[^`]+`;/, `const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
      fs.writeFileSync(tmpSW, resetContent, 'utf8');
      
      // Wait a second to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateCacheVersion();
      const secondContent = fs.readFileSync(tmpSW, 'utf8');
      const secondTimestamp = secondContent.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/)[1];
      
      // Assert
      expect(firstTimestamp).not.toBe(secondTimestamp);
    });
  });

  describe('resetCacheVersion', () => {
    test('should restore BUILD_TIMESTAMP placeholder', () => {
      // Arrange - first update with timestamp
      updateCacheVersion();
      const updatedContent = fs.readFileSync(tmpSW, 'utf8');
      expect(updatedContent).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      
      // Act
      resetCacheVersion();
      
      // Assert
      const resetContent = fs.readFileSync(tmpSW, 'utf8');
      expect(resetContent).toContain(`const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`);
    });
    
    test('should restore CACHE_NAME placeholder', () => {
      // Arrange - first update with timestamp
      updateCacheVersion();
      const updatedContent = fs.readFileSync(tmpSW, 'utf8');
      expect(updatedContent).toMatch(/const CACHE_NAME = `walk-to-mordor-\d{8}-\d{6}`;/);
      
      // Act
      resetCacheVersion();
      
      // Assert
      const resetContent = fs.readFileSync(tmpSW, 'utf8');
      expect(resetContent).toContain(`const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
    });
    
    test('should handle missing cache name pattern gracefully', () => {
      // Arrange - create content without the expected cache name pattern
      const contentWithoutPattern = fs.readFileSync(tmpSW, 'utf8')
        .replace(/const CACHE_NAME = `walk-to-mordor-[^`]+`;/, 'const CACHE_NAME = "different-format";');
      fs.writeFileSync(tmpSW, contentWithoutPattern, 'utf8');
      
      // Spy on console.log to capture warning
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Act
      resetCacheVersion();
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Cache name pattern not found in service worker');
      
      consoleSpy.mockRestore();
    });
    
    test('should be idempotent (safe to call multiple times)', () => {
      // Arrange - first update, then reset
      updateCacheVersion();
      resetCacheVersion();
      const firstResetContent = fs.readFileSync(tmpSW, 'utf8');
      
      // Act - reset again
      resetCacheVersion();
      const secondResetContent = fs.readFileSync(tmpSW, 'utf8');
      
      // Assert
      expect(firstResetContent).toBe(secondResetContent);
      expect(secondResetContent).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
    });
    
    test('should handle both timestamp and cache name resets correctly', () => {
      // Arrange - update to have actual timestamp
      updateCacheVersion();
      
      // Act
      resetCacheVersion();
      
      // Assert
      const content = fs.readFileSync(tmpSW, 'utf8');
      
      // Both should be reset to placeholders
      expect(content).toContain(`const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`);
      expect(content).toContain(`const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
      
      // Should not contain any actual timestamps
      expect(content).not.toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
      expect(content).not.toMatch(/const CACHE_NAME = `walk-to-mordor-\d{8}-\d{6}`;/);
    });
  });

  describe('Integration Tests', () => {
    test('update and reset cycle should work correctly', () => {
      // Start with placeholder
      expect(fs.readFileSync(tmpSW, 'utf8')).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      
      // Update to timestamp
      updateCacheVersion();
      const updatedContent = fs.readFileSync(tmpSW, 'utf8');
      expect(updatedContent).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      expect(updatedContent).toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
      
      // Reset back to placeholder
      resetCacheVersion();
      const resetContent = fs.readFileSync(tmpSW, 'utf8');
      expect(resetContent).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      expect(resetContent).not.toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
    });
    
    test('cache names should follow expected pattern', () => {
      updateCacheVersion();
      const content = fs.readFileSync(tmpSW, 'utf8');
      
      // Extract cache name
      const cacheNameMatch = content.match(/const CACHE_NAME = `([^`]+)`;/);
      expect(cacheNameMatch).toBeTruthy();
      
      const cacheName = cacheNameMatch[1];
      expect(cacheName).toMatch(/^walk-to-mordor-\d{8}-\d{6}$/);
      
      // Should be a valid cache name (no spaces, valid characters)
      expect(cacheName).not.toContain(' ');
      expect(cacheName).toMatch(/^[a-zA-Z0-9-]+$/);
    });
  });

  describe('Command Line Execution', () => {
    // Command-line tests reuse the suite-level tmpSW via SW_PATH env var
    
    test('should work when executed from command line', async () => {
      // Arrange - write placeholder content to isolated temp file
      fs.writeFileSync(tmpSW, placeholderContent, 'utf8');
      
      // Act - pass SW_PATH env var to use the temp file
      const { stdout } = await execAsync('node public/js/update-cache-version.js', {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, SW_PATH: tmpSW }
      });
      
      // Assert
      expect(stdout).toMatch(/✅ Updated service worker cache version to: walk-to-mordor-\d{8}-\d{6}/);
      
      const content = fs.readFileSync(tmpSW, 'utf8');
      expect(content).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      expect(content).toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
      expect(content).toMatch(/const CACHE_NAME = `walk-to-mordor-\d{8}-\d{6}`;/);
    });
    
    test('should handle missing placeholder when executed from command line', async () => {
      // Arrange - write content WITHOUT placeholder to isolated temp file
      const contentWithoutPlaceholder = placeholderContent
        .replace(new RegExp(BUILD_TIMESTAMP_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'), 'some-other-value');
      fs.writeFileSync(tmpSW, contentWithoutPlaceholder, 'utf8');
      
      // Act - pass SW_PATH env var to use the temp file
      const { stdout } = await execAsync('node public/js/update-cache-version.js', {
        cwd: path.join(__dirname, '../..'),
        env: { ...process.env, SW_PATH: tmpSW }
      });
      
      // Assert
      expect(stdout).toContain('⚠️  Build timestamp placeholder not found in service worker');
      
      // Content should remain unchanged
      const afterContent = fs.readFileSync(tmpSW, 'utf8');
      expect(afterContent).toBe(contentWithoutPlaceholder);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', () => {
      // Mock fs.readFileSync to throw an error
      const originalReadFileSync = fs.readFileSync;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      try {
        fs.readFileSync = jest.fn().mockImplementation(() => {
          throw new Error('File system error');
        });
        
        // Act
        updateCacheVersion();
        
        // Assert
        expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to update cache version:', 'File system error');
        expect(exitSpy).toHaveBeenCalledWith(1);
      } finally {
        // Always restore, even if assertions fail
        fs.readFileSync = originalReadFileSync;
        consoleSpy.mockRestore();
        exitSpy.mockRestore();
      }
    });
  });
});
