import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'generate-image-manifest.js');
const MANIFEST_PATH = path.join(ROOT, 'public', 'img', 'image-manifest.json');
const HIGHRES_DIR = path.join(ROOT, 'public', 'img', 'highres');

const sandboxes: string[] = [];

function createSandbox(slugs: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtm-manifest-test-'));
  sandboxes.push(dir);
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(SCRIPT_PATH, path.join(dir, 'scripts', 'generate-image-manifest.js'));
  const highres = path.join(dir, 'public', 'img', 'highres');
  fs.mkdirSync(highres, { recursive: true });
  for (const slug of slugs) {
    fs.writeFileSync(path.join(highres, `${slug}.webp`), '');
  }
  return dir;
}

function runGenerator(dir: string): Record<string, unknown> {
  execFileSync(process.execPath, [path.join(dir, 'scripts', 'generate-image-manifest.js')], {
    cwd: dir,
    stdio: 'pipe',
  });
  const manifestPath = path.join(dir, 'public', 'img', 'image-manifest.json');
  return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
}

afterAll(() => {
  for (const dir of sandboxes) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('generate-image-manifest.js', () => {
  describe('committed manifest matches the real image directory', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const webpFiles = fs.readdirSync(HIGHRES_DIR).filter((f) => f.endsWith('.webp'));

    it('has one entry per high-res image', () => {
      expect(manifest.count).toBe(webpFiles.length);
      expect(manifest.images).toHaveLength(webpFiles.length);
    });

    it('equals the exact sorted slug list of public/img/highres/*.webp', () => {
      const expectedSlugs = webpFiles
        .map((f) => f.replace(/\.webp$/, ''))
        .sort((a: string, b: string) => a.localeCompare(b));
      // Exact comparison: same slugs, same order, nothing extra.
      expect(manifest.images).toEqual(expectedSlugs);
    });

    it('lists slugs without file extensions, sorted', () => {
      const sorted = [...manifest.images].sort((a: string, b: string) => a.localeCompare(b));
      expect(manifest.images).toEqual(sorted);
      for (const slug of manifest.images) {
        expect(slug).not.toMatch(/\.(webp|jpe?g|png)$/);
      }
    });

    it('has a valid ISO 8601 timestamp', () => {
      expect(new Date(manifest.generated).getTime()).not.toBeNaN();
    });
  });

  it('generates a sorted manifest of slugs from the image directory', () => {
    const dir = createSandbox(['zulu', 'alpha', 'mike']);
    const manifest = runGenerator(dir);

    expect(manifest.images).toEqual(['alpha', 'mike', 'zulu']);
    expect(manifest.count).toBe(3);
    expect(typeof manifest.generated).toBe('string');
  });

  it('writes an empty manifest when the image directory is missing', () => {
    const dir = createSandbox([]);
    fs.rmSync(path.join(dir, 'public', 'img', 'highres'), { recursive: true });

    const manifest = runGenerator(dir);

    expect(manifest.images).toEqual([]);
    expect(manifest.count).toBe(0);
    expect(manifest.generated).toBeDefined();
  });

  it('does not mutate the repository manifest', () => {
    const before = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const dir = createSandbox(['fixture']);
    runGenerator(dir);
    expect(fs.readFileSync(MANIFEST_PATH, 'utf8')).toBe(before);
  });
});
