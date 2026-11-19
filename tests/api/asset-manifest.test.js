'use strict';

/**
 * Tracked-only enumeration for the generated asset maps.
 *
 * Maps must describe committed assets so a local-only source (for example the
 * gitignored map tile image) or a scratch file on disk can never pollute a
 * committed map. The only gitignored inputs allowed are the required client
 * build outputs `islands.js` / `islands.css`.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const LIB_PATH = path.join(ROOT, 'scripts', 'lib', 'asset-manifest.js');
const GENERATOR_PATH = path.join(ROOT, 'scripts', 'generate-asset-versions.js');

const sandboxes = [];

function writeFile(dir, relativePath, content = '') {
  const absPath = path.join(dir, relativePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
}

function runGit(dir, args) {
  return execFileSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function createSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtm-asset-manifest-test-'));
  sandboxes.push(dir);
  fs.mkdirSync(path.join(dir, 'scripts', 'lib'), { recursive: true });
  fs.copyFileSync(LIB_PATH, path.join(dir, 'scripts', 'lib', 'asset-manifest.js'));

  const tracked = [
    'public/css/main.css',
    'public/icons/icon.svg',
    'public/js/main.js',
    'public/manifest.json',
    'public/img/photo.webp',
  ];
  for (const relativePath of tracked) {
    writeFile(dir, relativePath, relativePath);
  }
  runGit(dir, ['init', '-q']);
  runGit(dir, ['add', '--', ...tracked]);

  // On disk but not tracked: must never enter a map.
  writeFile(dir, 'public/css/zz-probe.css', 'scratch');
  writeFile(dir, 'public/js/zz-probe.js', 'scratch');
  writeFile(dir, 'public/icons/zz-probe.svg', 'scratch');
  writeFile(dir, 'public/img/zz-probe.webp', 'scratch');
  writeFile(dir, 'public/img/map/ctd58g7fsmyf1.webp', 'tile-source');

  // Required gitignored build outputs: present, never tracked.
  writeFile(dir, 'public/js/client/islands.js', 'islands');
  writeFile(dir, 'public/js/client/islands.css', 'islands');
  return dir;
}

function loadLib(dir) {
  const libPath = path.join(dir, 'scripts', 'lib', 'asset-manifest.js');
  delete require.cache[require.resolve(libPath)];
  return require(libPath);
}

afterAll(() => {
  for (const dir of sandboxes) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('tracked-only asset maps', () => {
  test('entry map contains tracked assets plus the required islands bundle', () => {
    const { buildEntryAssetMap } = loadLib(createSandbox());
    const map = buildEntryAssetMap();

    expect(Object.keys(map)).toEqual([
      '/css/main.css',
      '/icons/icon.svg',
      '/js/client/islands.css',
      '/js/client/islands.js',
      '/js/main.js',
      '/manifest.json',
    ]);
  });

  test('image map contains tracked images only', () => {
    const { buildImageAssetMap } = loadLib(createSandbox());
    const map = buildImageAssetMap();

    expect(Object.keys(map)).toEqual(['/img/photo.webp']);
  });

  test('entry map still hard-fails when the islands bundle is missing', () => {
    const dir = createSandbox();
    fs.rmSync(path.join(dir, 'public', 'js', 'client', 'islands.js'));
    const { buildEntryAssetMap } = loadLib(dir);

    expect(() => buildEntryAssetMap()).toThrow(
      /Missing required input file: \/js\/client\/islands\.js/
    );
  });
});

describe('generate-asset-versions tile drift guidance', () => {
  function createGeneratorSandbox() {
    const dir = createSandbox();
    fs.copyFileSync(GENERATOR_PATH, path.join(dir, 'scripts', 'generate-asset-versions.js'));

    const tracked = ['public/img/map/tiles/metadata.json', 'public/img/map/tiles/0/0_0.webp'];
    writeFile(dir, tracked[0], JSON.stringify({ tileSize: 512, levels: [] }, null, 2));
    writeFile(dir, tracked[1], 'tile-bytes');
    runGit(dir, ['add', '--', ...tracked]);

    execFileSync(process.execPath, [path.join(dir, 'scripts', 'generate-asset-versions.js')], {
      cwd: dir,
      stdio: 'pipe',
    });

    const { computeTileSetVersion } = loadLib(dir);
    const tileDir = path.join(dir, 'public', 'img', 'map', 'tiles');
    const metadata = JSON.parse(fs.readFileSync(path.join(tileDir, 'metadata.json'), 'utf8'));
    fs.writeFileSync(
      path.join(tileDir, 'metadata.json'),
      JSON.stringify({ ...metadata, version: computeTileSetVersion(tileDir) }, null, 2)
    );
    return dir;
  }

  function runCheck(dir) {
    return spawnSync(
      process.execPath,
      [path.join(dir, 'scripts', 'generate-asset-versions.js'), '--check'],
      { cwd: dir, encoding: 'utf8' }
    );
  }

  test('untracked stray files in the tile directory do not change the tile version', () => {
    const dir = createGeneratorSandbox();
    const { computeTileSetVersion } = loadLib(dir);
    const tileDir = path.join(dir, 'public', 'img', 'map', 'tiles');
    const before = computeTileSetVersion(tileDir);

    writeFile(dir, 'public/img/map/tiles/.DS_Store', 'stray');
    writeFile(dir, 'public/img/map/tiles/0/scratch.bin', 'stray');

    expect(computeTileSetVersion(tileDir)).toBe(before);
    expect(runCheck(dir).status).toBe(0);
  });

  test('stale tile bytes point at tile:map, not generate:assets', () => {
    const dir = createGeneratorSandbox();
    expect(runCheck(dir).status).toBe(0);

    fs.appendFileSync(path.join(dir, 'public', 'img', 'map', 'tiles', '0', '0_0.webp'), 'x');
    const result = runCheck(dir);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('stale tile-set version');
    expect(result.stderr).toContain('npm run tile:map');
    expect(result.stderr).not.toContain('npm run generate:assets');
  });
});
