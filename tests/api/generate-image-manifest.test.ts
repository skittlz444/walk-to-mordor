import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';

const ROOT = path.join(__dirname, '..', '..');
const SCRIPT_PATH = path.join(ROOT, 'scripts', 'generate-image-manifest.js');
const MANIFEST_PATH = path.join(ROOT, 'public', 'img', 'image-manifest.json');
const HIGHRES_DIR = path.join(ROOT, 'public', 'img', 'highres');

const sandboxes: string[] = [];

function runGit(dir: string, args: string[]): string {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function createSandbox(slugs: string[], untrackedSlugs: string[] = []): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtm-manifest-test-'));
  sandboxes.push(dir);
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(SCRIPT_PATH, path.join(dir, 'scripts', 'generate-image-manifest.js'));
  fs.copyFileSync(
    path.join(ROOT, 'scripts', 'lib', 'asset-manifest.js'),
    path.join(dir, 'scripts', 'lib', 'asset-manifest.js')
  );
  const highres = path.join(dir, 'public', 'img', 'highres');
  fs.mkdirSync(highres, { recursive: true });
  for (const slug of slugs) {
    fs.writeFileSync(path.join(highres, `${slug}.webp`), '');
  }
  runGit(dir, ['init', '-q']);
  if (slugs.length > 0) {
    runGit(dir, ['add', '--', path.join('public', 'img', 'highres')]);
  }
  // Written after `git add` so they stay untracked on disk.
  for (const slug of untrackedSlugs) {
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
  describe('committed manifest matches the tracked image directory', () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const webpFiles = runGit(ROOT, ['ls-files', '--', 'public/img/highres'])
      .split('\n')
      .filter(Boolean)
      .map((file) => path.basename(file))
      .filter((name) => name.endsWith('.webp'));

    it('has one entry per high-res image', () => {
      expect(manifest.count).toBe(webpFiles.length);
      expect(manifest.images).toHaveLength(webpFiles.length);
    });

    it('equals the exact sorted slug list of public/img/highres/*.webp', () => {
      const expectedSlugs = webpFiles
        .map((f) => f.replace(/\.webp$/, ''))
        .sort((a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      // Exact comparison: same slugs, same byte-wise order, nothing extra.
      expect(manifest.images).toEqual(expectedSlugs);
    });

    it('lists slugs without file extensions, sorted', () => {
      const sorted = [...manifest.images].sort((a: string, b: string) => Buffer.compare(Buffer.from(a), Buffer.from(b)));
      expect(manifest.images).toEqual(sorted);
      for (const slug of manifest.images) {
        expect(slug).not.toMatch(/\.(webp|jpe?g|png)$/);
      }
    });

    it('has no build timestamp', () => {
      expect(manifest).not.toHaveProperty('generated');
    });
  });

  it('generates a sorted, timestamp-free manifest of slugs from the image directory', () => {
    const dir = createSandbox(['zulu', 'alpha', 'mike']);
    const manifest = runGenerator(dir);

    expect(manifest.images).toEqual(['alpha', 'mike', 'zulu']);
    expect(manifest.count).toBe(3);
    expect(manifest).not.toHaveProperty('generated');
  });

  it('ignores untracked .webp files on disk', () => {
    const dir = createSandbox(['alpha'], ['scratch']);
    const manifest = runGenerator(dir);

    expect(manifest.images).toEqual(['alpha']);
    expect(manifest.count).toBe(1);
  });

  it('fails without writing a manifest when the image directory is missing', () => {
    const dir = createSandbox([]);
    fs.rmSync(path.join(dir, 'public', 'img', 'highres'), { recursive: true });

    expect(() => runGenerator(dir)).toThrow();
    expect(fs.existsSync(path.join(dir, 'public', 'img', 'image-manifest.json'))).toBe(false);
  });

  it('produces byte-identical output on a second run', () => {
    const dir = createSandbox(['zulu', 'alpha', 'mike']);
    runGenerator(dir);
    const first = fs.readFileSync(path.join(dir, 'public', 'img', 'image-manifest.json'), 'utf8');
    runGenerator(dir);
    const second = fs.readFileSync(path.join(dir, 'public', 'img', 'image-manifest.json'), 'utf8');

    expect(second).toBe(first);
  });

  it('does not mutate the repository manifest', () => {
    const before = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const dir = createSandbox(['fixture']);
    runGenerator(dir);
    expect(fs.readFileSync(MANIFEST_PATH, 'utf8')).toBe(before);
  });
});
