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
const { exec } = require('child_process');
const { promisify } = require('util');
const { updateCacheVersion } = require('../../public/js/update-cache-version');
const { resetCacheVersion } = require('../../public/js/reset-cache-version');

const execAsync = promisify(exec);

describe('Cache Version Management Scripts', () => {
  const SW_PATH = path.join(__dirname, '..', '..', 'public', 'sw.js');
  const BACKUP_PATH = path.join(__dirname, 'temp-sw-backup.js');
  const BUILD_TIMESTAMP_PLACEHOLDER = '{{BUILD_TIMESTAMP}}';
  
  let originalContent;
  
  beforeEach(() => {
    // Backup original service worker content
    originalContent = fs.readFileSync(SW_PATH, 'utf8');
    fs.writeFileSync(BACKUP_PATH, originalContent, 'utf8');
    
    // Ensure we start with a clean placeholder state
    const placeholderContent = originalContent
      .replace(/const BUILD_TIMESTAMP = '[^']+';/, `const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`)
      .replace(/const CACHE_NAME = `walk-to-mordor-[^`]+`;/, `const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
    
    fs.writeFileSync(SW_PATH, placeholderContent, 'utf8');
  });
  
  afterEach(() => {
    // Restore original content
    fs.writeFileSync(SW_PATH, originalContent, 'utf8');
    
    // Clean up backup file
    if (fs.existsSync(BACKUP_PATH)) {
      fs.unlinkSync(BACKUP_PATH);
    }
  });

  describe('updateCacheVersion', () => {
    test('should replace BUILD_TIMESTAMP placeholder with actual timestamp', () => {
      // Arrange - service worker should have placeholder
      const beforeContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(beforeContent).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      
      // Act
      updateCacheVersion();
      
      // Assert
      const afterContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(afterContent).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
    });
    
    test('should generate timestamp in correct format (YYYYMMDD-HHMMSS)', () => {
      // Act
      updateCacheVersion();
      
      // Assert
      const content = fs.readFileSync(SW_PATH, 'utf8');
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
      const content = fs.readFileSync(SW_PATH, 'utf8');
      const cacheNameMatch = content.match(/const CACHE_NAME = `walk-to-mordor-(\d{8}-\d{6})`;/);
      
      expect(cacheNameMatch).toBeTruthy();
      expect(cacheNameMatch[1]).toMatch(/^\d{8}-\d{6}$/);
    });
    
    test('should use same timestamp for both BUILD_TIMESTAMP and CACHE_NAME', () => {
      // Act
      updateCacheVersion();
      
      // Assert
      const content = fs.readFileSync(SW_PATH, 'utf8');
      const timestampMatch = content.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/);
      const cacheNameMatch = content.match(/const CACHE_NAME = `walk-to-mordor-(\d{8}-\d{6})`;/);
      
      expect(timestampMatch[1]).toBe(cacheNameMatch[1]);
    });
    
    test('should handle missing placeholder gracefully', () => {
      // Arrange - remove ALL placeholders from service worker
      const contentWithoutPlaceholder = fs.readFileSync(SW_PATH, 'utf8')
        .replace(new RegExp(BUILD_TIMESTAMP_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'), 'some-other-value');
      fs.writeFileSync(SW_PATH, contentWithoutPlaceholder, 'utf8');
      
      // Spy on console.log to capture warning
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Act
      updateCacheVersion();
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('⚠️  Build timestamp placeholder not found in service worker');
      
      // Content should remain unchanged
      const afterContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(afterContent).toBe(contentWithoutPlaceholder);
      
      consoleSpy.mockRestore();
    });
    
    test('should generate unique timestamps on sequential calls', async () => {
      // Act - call twice with small delay
      updateCacheVersion();
      const firstContent = fs.readFileSync(SW_PATH, 'utf8');
      const firstTimestamp = firstContent.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/)[1];
      
      // Reset to placeholder for second call
      const placeholderContent = firstContent
        .replace(/const BUILD_TIMESTAMP = '[^']+';/, `const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`)
        .replace(/const CACHE_NAME = `walk-to-mordor-[^`]+`;/, `const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
      fs.writeFileSync(SW_PATH, placeholderContent, 'utf8');
      
      // Wait a second to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateCacheVersion();
      const secondContent = fs.readFileSync(SW_PATH, 'utf8');
      const secondTimestamp = secondContent.match(/const BUILD_TIMESTAMP = '(\d{8}-\d{6})';/)[1];
      
      // Assert
      expect(firstTimestamp).not.toBe(secondTimestamp);
    });
  });

  describe('resetCacheVersion', () => {
    test('should restore BUILD_TIMESTAMP placeholder', () => {
      // Arrange - first update with timestamp
      updateCacheVersion();
      const updatedContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(updatedContent).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      
      // Act
      resetCacheVersion();
      
      // Assert
      const resetContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(resetContent).toContain(`const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`);
    });
    
    test('should restore CACHE_NAME placeholder', () => {
      // Arrange - first update with timestamp
      updateCacheVersion();
      const updatedContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(updatedContent).toMatch(/const CACHE_NAME = `walk-to-mordor-\d{8}-\d{6}`;/);
      
      // Act
      resetCacheVersion();
      
      // Assert
      const resetContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(resetContent).toContain(`const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
    });
    
    test('should handle missing cache name pattern gracefully', () => {
      // Arrange - create content without the expected cache name pattern
      const contentWithoutPattern = fs.readFileSync(SW_PATH, 'utf8')
        .replace(/const CACHE_NAME = `walk-to-mordor-[^`]+`;/, 'const CACHE_NAME = "different-format";');
      fs.writeFileSync(SW_PATH, contentWithoutPattern, 'utf8');
      
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
      const firstResetContent = fs.readFileSync(SW_PATH, 'utf8');
      
      // Act - reset again
      resetCacheVersion();
      const secondResetContent = fs.readFileSync(SW_PATH, 'utf8');
      
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
      const content = fs.readFileSync(SW_PATH, 'utf8');
      
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
      expect(fs.readFileSync(SW_PATH, 'utf8')).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      
      // Update to timestamp
      updateCacheVersion();
      const updatedContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(updatedContent).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      expect(updatedContent).toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
      
      // Reset back to placeholder
      resetCacheVersion();
      const resetContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(resetContent).toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      expect(resetContent).not.toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
    });
    
    test('cache names should follow expected pattern', () => {
      updateCacheVersion();
      const content = fs.readFileSync(SW_PATH, 'utf8');
      
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
    test('should work when executed from command line', async () => {
      // Arrange - ensure we start with placeholder
      const placeholderContent = fs.readFileSync(SW_PATH, 'utf8')
        .replace(/const BUILD_TIMESTAMP = '[^']+';/, `const BUILD_TIMESTAMP = '${BUILD_TIMESTAMP_PLACEHOLDER}';`)
        .replace(/const CACHE_NAME = `walk-to-mordor-[^`]+`;/, `const CACHE_NAME = \`walk-to-mordor-${BUILD_TIMESTAMP_PLACEHOLDER}\`;`);
      fs.writeFileSync(SW_PATH, placeholderContent, 'utf8');
      
      // Act
      const { stdout } = await execAsync('node public/js/update-cache-version.js', { cwd: path.join(__dirname, '../..') });
      
      // Assert
      expect(stdout).toMatch(/✅ Updated service worker cache version to: walk-to-mordor-\d{8}-\d{6}/);
      
      const content = fs.readFileSync(SW_PATH, 'utf8');
      expect(content).not.toContain(BUILD_TIMESTAMP_PLACEHOLDER);
      expect(content).toMatch(/const BUILD_TIMESTAMP = '\d{8}-\d{6}';/);
      expect(content).toMatch(/const CACHE_NAME = `walk-to-mordor-\d{8}-\d{6}`;/);
    });
    
    test('should handle missing placeholder when executed from command line', async () => {
      // Arrange - remove ALL placeholders from service worker
      const contentWithoutPlaceholder = fs.readFileSync(SW_PATH, 'utf8')
        .replace(new RegExp(BUILD_TIMESTAMP_PLACEHOLDER.replace(/[{}]/g, '\\$&'), 'g'), 'some-other-value');
      fs.writeFileSync(SW_PATH, contentWithoutPlaceholder, 'utf8');
      
      // Act
      const { stdout } = await execAsync('node public/js/update-cache-version.js', { cwd: path.join(__dirname, '../..') });
      
      // Assert
      expect(stdout).toContain('⚠️  Build timestamp placeholder not found in service worker');
      
      // Content should remain unchanged
      const afterContent = fs.readFileSync(SW_PATH, 'utf8');
      expect(afterContent).toBe(contentWithoutPlaceholder);
    });
  });

  describe('Error Handling', () => {
    test('should handle file system errors gracefully', () => {
      // Mock fs.readFileSync to throw an error
      const originalReadFileSync = fs.readFileSync;
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation();
      
      fs.readFileSync = jest.fn().mockImplementation(() => {
        throw new Error('File system error');
      });
      
      // Act
      updateCacheVersion();
      
      // Assert
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to update cache version:', 'File system error');
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      // Restore
      fs.readFileSync = originalReadFileSync;
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});
