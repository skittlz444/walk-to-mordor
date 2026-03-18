const fs = require('fs');
const path = require('path');

// Import the module under test
const {
  countFiles,
  getBreakdown,
  classify,
  buildMarkdownSummary,
  buildTerminalOutput,
  WARN_THRESHOLD,
  FAIL_THRESHOLD,
} = require('../../.github/scripts/check-asset-count.js');

describe('check-asset-count', () => {
  describe('countFiles', () => {
    let readdirSyncSpy;
    let lstatSyncSpy;

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('counts files recursively in a directory structure', () => {
      // Mock a directory structure:
      // root/
      //   file1.txt
      //   subdir/
      //     file2.txt
      //     file3.txt
      readdirSyncSpy = jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
        if (dir === '/root') return ['file1.txt', 'subdir'];
        if (dir === path.join('/root', 'subdir')) return ['file2.txt', 'file3.txt'];
        return [];
      });

      lstatSyncSpy = jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        if (p === path.join('/root', 'file1.txt')) return { isFile: () => true, isDirectory: () => false };
        if (p === path.join('/root', 'subdir')) return { isFile: () => false, isDirectory: () => true };
        if (p === path.join('/root', 'subdir', 'file2.txt')) return { isFile: () => true, isDirectory: () => false };
        if (p === path.join('/root', 'subdir', 'file3.txt')) return { isFile: () => true, isDirectory: () => false };
        return { isFile: () => false, isDirectory: () => false };
      });

      expect(countFiles('/root')).toBe(3);
    });

    it('returns 0 for an empty directory', () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue([]);
      expect(countFiles('/empty')).toBe(0);
    });

    it('returns 0 when readdirSync throws an error', () => {
      jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });
      expect(countFiles('/nonexistent')).toBe(0);
    });

    it('skips entries where lstatSync throws', () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['good.txt', 'bad.txt']);
      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        if (p.endsWith('bad.txt')) throw new Error('EACCES');
        return { isFile: () => true, isDirectory: () => false };
      });

      expect(countFiles('/test')).toBe(1);
    });

    it('ignores non-file non-directory entries (e.g., symlinks)', () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['link']);
      jest.spyOn(fs, 'lstatSync').mockReturnValue({
        isFile: () => false,
        isDirectory: () => false,
      });

      expect(countFiles('/test')).toBe(0);
    });

    it('handles deeply nested directory structures', () => {
      jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
        if (dir === '/deep') return ['a'];
        if (dir === path.join('/deep', 'a')) return ['b'];
        if (dir === path.join('/deep', 'a', 'b')) return ['c'];
        if (dir === path.join('/deep', 'a', 'b', 'c')) return ['file.txt'];
        return [];
      });
      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        if (p.endsWith('file.txt')) return { isFile: () => true, isDirectory: () => false };
        return { isFile: () => false, isDirectory: () => true };
      });

      expect(countFiles('/deep')).toBe(1);
    });
  });

  describe('getBreakdown', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('returns breakdown by top-level subdirectory', () => {
      // Mock structure:
      // public/
      //   index.html
      //   img/
      //     a.webp
      //     b.webp
      //   css/
      //     style.css
      jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
        if (dir === '/public') return ['index.html', 'img', 'css'];
        if (dir === path.join('/public', 'img')) return ['a.webp', 'b.webp'];
        if (dir === path.join('/public', 'css')) return ['style.css'];
        return [];
      });
      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        if (p === path.join('/public', 'index.html')) return { isFile: () => true, isDirectory: () => false };
        if (p === path.join('/public', 'img')) return { isFile: () => false, isDirectory: () => true };
        if (p === path.join('/public', 'css')) return { isFile: () => false, isDirectory: () => true };
        if (p === path.join('/public', 'img', 'a.webp')) return { isFile: () => true, isDirectory: () => false };
        if (p === path.join('/public', 'img', 'b.webp')) return { isFile: () => true, isDirectory: () => false };
        if (p === path.join('/public', 'css', 'style.css')) return { isFile: () => true, isDirectory: () => false };
        return { isFile: () => false, isDirectory: () => false };
      });

      const result = getBreakdown('/public');

      expect(result.total).toBe(4);
      // Sorted by count descending: img(2), css(1), root(1)
      expect(result.breakdown).toEqual([
        { name: 'img', count: 2 },
        { name: 'css', count: 1 },
        { name: '(root files)', count: 1 },
      ]);
    });

    it('returns empty breakdown for nonexistent directory', () => {
      jest.spyOn(fs, 'readdirSync').mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const result = getBreakdown('/nope');
      expect(result.total).toBe(0);
      expect(result.breakdown).toEqual([]);
    });

    it('excludes empty subdirectories from breakdown', () => {
      jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
        if (dir === '/pub') return ['empty-dir', 'file.txt'];
        if (dir === path.join('/pub', 'empty-dir')) return [];
        return [];
      });
      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        if (p === path.join('/pub', 'empty-dir')) return { isFile: () => false, isDirectory: () => true };
        if (p === path.join('/pub', 'file.txt')) return { isFile: () => true, isDirectory: () => false };
        return { isFile: () => false, isDirectory: () => false };
      });

      const result = getBreakdown('/pub');
      expect(result.total).toBe(1);
      expect(result.breakdown).toEqual([{ name: '(root files)', count: 1 }]);
    });

    it('skips entries where lstatSync throws', () => {
      jest.spyOn(fs, 'readdirSync').mockReturnValue(['ok.txt', 'err.txt']);
      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        if (p.endsWith('err.txt')) throw new Error('EACCES');
        return { isFile: () => true, isDirectory: () => false };
      });

      const result = getBreakdown('/test');
      expect(result.total).toBe(1);
    });
  });

  describe('classify', () => {
    it('returns "pass" for counts below warn threshold', () => {
      expect(classify(0)).toBe('pass');
      expect(classify(897)).toBe('pass');
      expect(classify(14999)).toBe('pass');
    });

    it('returns "warn" for counts at or above warn but below fail', () => {
      expect(classify(15000)).toBe('warn');
      expect(classify(16000)).toBe('warn');
      expect(classify(17999)).toBe('warn');
    });

    it('returns "fail" for counts at or above fail threshold', () => {
      expect(classify(18000)).toBe('fail');
      expect(classify(25000)).toBe('fail');
      expect(classify(100000)).toBe('fail');
    });
  });

  describe('threshold constants', () => {
    it('has correct warn threshold', () => {
      expect(WARN_THRESHOLD).toBe(15000);
    });

    it('has correct fail threshold', () => {
      expect(FAIL_THRESHOLD).toBe(18000);
    });
  });

  describe('buildMarkdownSummary', () => {
    it('builds pass summary with breakdown', () => {
      const md = buildMarkdownSummary(897, [{ name: 'img', count: 866 }, { name: 'css', count: 13 }], 'pass', 'public');

      expect(md).toContain('✅ Pass');
      expect(md).toContain('897');
      expect(md).toContain('`public/`');
      expect(md).toContain('`img`');
      expect(md).toContain('866');
      expect(md).toContain('`css`');
      expect(md).toContain('13');
      expect(md).toContain('Cloudflare Workers Assets limit');
    });

    it('builds warn summary', () => {
      const md = buildMarkdownSummary(16000, [{ name: 'img', count: 15500 }], 'warn', 'public');

      expect(md).toContain('⚠️ Warning');
      expect(md).toContain('16,000');
      expect(md).toContain('⚠️ Exceeded');
    });

    it('builds fail summary', () => {
      const md = buildMarkdownSummary(20000, [{ name: 'img', count: 19000 }], 'fail', 'public');

      expect(md).toContain('❌ Fail');
      expect(md).toContain('20,000');
      expect(md).toContain('❌ Exceeded');
    });

    it('handles empty breakdown', () => {
      const md = buildMarkdownSummary(0, [], 'pass', 'dist');

      expect(md).toContain('✅ Pass');
      expect(md).toContain('`dist/`');
      expect(md).not.toContain('Breakdown by Directory');
    });
  });

  describe('buildTerminalOutput', () => {
    it('builds pass output with breakdown', () => {
      const output = buildTerminalOutput(897, [{ name: 'img', count: 866 }], 'pass', 'public');

      expect(output).toContain('PASS');
      expect(output).toContain('✅');
      expect(output).toContain('897');
      expect(output).toContain('img');
      expect(output).toContain('866');
      expect(output).toContain('public/');
    });

    it('builds warn output', () => {
      const output = buildTerminalOutput(16000, [], 'warn', 'public');

      expect(output).toContain('WARNING');
      expect(output).toContain('⚠️');
    });

    it('builds fail output', () => {
      const output = buildTerminalOutput(20000, [], 'fail', 'public');

      expect(output).toContain('FAIL');
      expect(output).toContain('❌');
    });

    it('includes threshold values', () => {
      const output = buildTerminalOutput(100, [], 'pass', 'public');

      expect(output).toContain('15,000');
      expect(output).toContain('18,000');
    });
  });

  describe('main (integration)', () => {
    let originalArgv;
    let originalEnv;
    let exitSpy;
    let logSpy;
    let errorSpy;

    beforeEach(() => {
      originalArgv = process.argv;
      originalEnv = { ...process.env };
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit called');
      });
      logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      process.argv = originalArgv;
      process.env = originalEnv;
      jest.restoreAllMocks();
    });

    it('runs successfully on the real public/ directory', () => {
      process.argv = ['node', 'script.js', 'public'];
      delete process.env.GITHUB_STEP_SUMMARY;

      // Require the already-loaded module
      const { main } = require('../../.github/scripts/check-asset-count.js');
      main();

      // Should not exit with code 1 (we're well under limits)
      expect(exitSpy).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalled();
      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).not.toContain('FAIL');
    });

    it('exits with code 1 when directory does not exist', () => {
      process.argv = ['node', 'script.js', 'nonexistent-dir-xyz'];
      delete process.env.GITHUB_STEP_SUMMARY;

      const { main } = require('../../.github/scripts/check-asset-count.js');

      expect(() => main()).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Directory not found'));
    });

    it('writes to GITHUB_STEP_SUMMARY in CI mode', () => {
      const tmpFile = path.join(__dirname, '_test_summary.md');
      process.argv = ['node', 'script.js', 'public'];
      process.env.GITHUB_STEP_SUMMARY = tmpFile;

      // Ensure clean file
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      fs.writeFileSync(tmpFile, '');

      const { main } = require('../../.github/scripts/check-asset-count.js');
      main();

      const summary = fs.readFileSync(tmpFile, 'utf8');
      expect(summary).toContain('Asset Count');
      expect(summary).toContain('Pass');

      // Cleanup
      fs.unlinkSync(tmpFile);
    });

    it('exits with code 1 when path is a file, not a directory', () => {
      process.argv = ['node', 'script.js', 'package.json'];
      delete process.env.GITHUB_STEP_SUMMARY;

      const { main } = require('../../.github/scripts/check-asset-count.js');

      expect(() => main()).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Path is not a directory'));
    });

    it('emits ::warning:: annotation for warn status in CI', () => {
      const tmpFile = path.join(__dirname, '_test_summary_warn.md');
      process.env.GITHUB_STEP_SUMMARY = tmpFile;
      fs.writeFileSync(tmpFile, '');

      // Mock the fs to simulate a large directory
      const origReaddirSync = fs.readdirSync;
      const origLstatSync = fs.lstatSync;
      const origExistsSync = fs.existsSync;
      const origStatSync = fs.statSync;

      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('warn-test-dir')) return true;
        return origExistsSync.call(fs, p);
      });

      jest.spyOn(fs, 'statSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('warn-test-dir')) return { isDirectory: () => true };
        return origStatSync.call(fs, p);
      });

      jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr.includes('warn-test-dir') && !dirStr.includes('big')) {
          return ['big'];
        }
        if (dirStr.includes('big')) {
          // Generate 16000 file names
          return Array.from({ length: 16000 }, (_, i) => `file${i}.txt`);
        }
        return origReaddirSync.call(fs, dir);
      });

      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        const pStr = String(p);
        if (pStr.includes('warn-test-dir') && pStr.endsWith('big')) {
          return { isFile: () => false, isDirectory: () => true };
        }
        if (pStr.includes('big') && pStr.includes('file')) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return origLstatSync.call(fs, p);
      });

      process.argv = ['node', 'script.js', 'warn-test-dir'];
      const { main } = require('../../.github/scripts/check-asset-count.js');
      main();

      const logOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(logOutput).toContain('::warning::');
      expect(logOutput).toContain('approaching limit');

      // Cleanup
      jest.restoreAllMocks();
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    });

    it('emits ::error:: and exits 1 for fail status in CI', () => {
      const tmpFile = path.join(__dirname, '_test_summary_fail.md');
      process.env.GITHUB_STEP_SUMMARY = tmpFile;
      fs.writeFileSync(tmpFile, '');

      const origReaddirSync = fs.readdirSync;
      const origLstatSync = fs.lstatSync;
      const origExistsSync = fs.existsSync;
      const origStatSync = fs.statSync;

      jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('fail-test-dir')) return true;
        return origExistsSync.call(fs, p);
      });

      jest.spyOn(fs, 'statSync').mockImplementation((p) => {
        if (typeof p === 'string' && p.includes('fail-test-dir')) return { isDirectory: () => true };
        return origStatSync.call(fs, p);
      });

      jest.spyOn(fs, 'readdirSync').mockImplementation((dir) => {
        const dirStr = String(dir);
        if (dirStr.includes('fail-test-dir') && !dirStr.includes('huge')) {
          return ['huge'];
        }
        if (dirStr.includes('huge')) {
          return Array.from({ length: 19000 }, (_, i) => `f${i}.txt`);
        }
        return origReaddirSync.call(fs, dir);
      });

      jest.spyOn(fs, 'lstatSync').mockImplementation((p) => {
        const pStr = String(p);
        if (pStr.includes('fail-test-dir') && pStr.endsWith('huge')) {
          return { isFile: () => false, isDirectory: () => true };
        }
        if (pStr.includes('huge') && pStr.includes('f')) {
          return { isFile: () => true, isDirectory: () => false };
        }
        return origLstatSync.call(fs, p);
      });

      process.argv = ['node', 'script.js', 'fail-test-dir'];
      const { main } = require('../../.github/scripts/check-asset-count.js');

      expect(() => main()).toThrow('process.exit called');
      expect(exitSpy).toHaveBeenCalledWith(1);

      const logOutput = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(logOutput).toContain('::error::');
      expect(logOutput).toContain('exceeds fail threshold');

      // Cleanup
      jest.restoreAllMocks();
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    });

    it('defaults to public/ when no argument is provided', () => {
      process.argv = ['node', 'script.js'];
      delete process.env.GITHUB_STEP_SUMMARY;

      const { main } = require('../../.github/scripts/check-asset-count.js');
      main();

      const output = logSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(output).toContain('public/');
    });
  });
});
