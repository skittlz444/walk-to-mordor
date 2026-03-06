import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

const MANIFEST_PATH = path.join(__dirname, '..', '..', 'public', 'img', 'image-manifest.json');
const HIGHRES_DIR = path.join(__dirname, '..', '..', 'public', 'img', 'highres');
const SCRIPT_PATH = path.join(__dirname, '..', '..', 'scripts', 'generate-image-manifest.js');

describe('generate-image-manifest.js', () => {
  // Save original manifest before tests
  let originalManifest: string | null = null;

  beforeAll(() => {
    if (fs.existsSync(MANIFEST_PATH)) {
      originalManifest = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    }
  });

  afterAll(() => {
    // Restore original manifest
    if (originalManifest !== null) {
      fs.writeFileSync(MANIFEST_PATH, originalManifest);
    }
  });

  it('should generate a valid JSON manifest', () => {
    execSync(`node "${SCRIPT_PATH}"`, { cwd: path.join(__dirname, '..', '..') });

    expect(fs.existsSync(MANIFEST_PATH)).toBe(true);

    const raw = fs.readFileSync(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(raw);

    expect(manifest).toHaveProperty('generated');
    expect(manifest).toHaveProperty('images');
    expect(manifest).toHaveProperty('count');
    expect(Array.isArray(manifest.images)).toBe(true);
    expect(typeof manifest.count).toBe('number');
    expect(typeof manifest.generated).toBe('string');
  });

  it('should have count matching the number of highres .webp files', () => {
    execSync(`node "${SCRIPT_PATH}"`, { cwd: path.join(__dirname, '..', '..') });
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

    const webpFiles = fs.readdirSync(HIGHRES_DIR).filter((f: string) => f.endsWith('.webp'));
    expect(manifest.count).toBe(webpFiles.length);
    expect(manifest.images.length).toBe(webpFiles.length);
  });

  it('should have slugs sorted alphabetically', () => {
    execSync(`node "${SCRIPT_PATH}"`, { cwd: path.join(__dirname, '..', '..') });
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

    const sorted = [...manifest.images].sort((a: string, b: string) => a.localeCompare(b));
    expect(manifest.images).toEqual(sorted);
  });

  it('should contain correct slugs (no .webp extension)', () => {
    execSync(`node "${SCRIPT_PATH}"`, { cwd: path.join(__dirname, '..', '..') });
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

    for (const slug of manifest.images) {
      expect(slug).not.toContain('.webp');
      expect(slug).not.toContain('.jpg');
      expect(slug).not.toContain('.png');
    }
  });

  it('should have a valid ISO 8601 generated timestamp', () => {
    execSync(`node "${SCRIPT_PATH}"`, { cwd: path.join(__dirname, '..', '..') });
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

    const date = new Date(manifest.generated);
    expect(date.getTime()).not.toBeNaN();
  });

  it('should handle empty directory gracefully', () => {
    // Create a temp empty directory to simulate no images
    const tempDir = path.join(__dirname, '..', '..', 'public', 'img', 'highres-empty-test');
    fs.mkdirSync(tempDir, { recursive: true });

    try {
      // Temporarily rename real dir and point script at empty one
      const realDir = HIGHRES_DIR;
      const backupDir = realDir + '-backup';
      fs.renameSync(realDir, backupDir);
      fs.renameSync(tempDir, realDir);

      try {
        execSync(`node "${SCRIPT_PATH}"`, { cwd: path.join(__dirname, '..', '..') });
        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

        expect(manifest.images).toEqual([]);
        expect(manifest.count).toBe(0);
        expect(manifest.generated).toBeDefined();
      } finally {
        // Restore original directory
        fs.renameSync(realDir, tempDir);
        fs.renameSync(backupDir, realDir);
      }
    } finally {
      // Clean up temp dir
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true });
      }
    }
  });
});
