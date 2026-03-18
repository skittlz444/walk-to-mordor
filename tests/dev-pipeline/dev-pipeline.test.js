const { readFileSync } = require('fs');
const { join } = require('path');

const pkg = JSON.parse(
  readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8')
);

describe('Dev pipeline configuration (package.json)', () => {
  const devScript = pkg.scripts.dev;

  test('dev script exists and invokes concurrently', () => {
    expect(devScript).toBeDefined();
    expect(devScript).toContain('concurrently');
  });

  test('dev script includes --kill-others-on-fail for clean shutdown', () => {
    expect(devScript).toContain('--kill-others-on-fail');
  });

  test('dev script includes process name labels', () => {
    expect(devScript).toMatch(/--names\s/);
    expect(devScript).toContain('vite');
    expect(devScript).toContain('wrangler');
  });

  test('dev script includes prefix colors for visual distinction', () => {
    expect(devScript).toMatch(/--prefix-colors\s/);
  });

  test('dev script runs build:client before concurrently for fresh-clone safety', () => {
    const buildIdx = devScript.indexOf('npm run build:client');
    const concurrentlyIdx = devScript.indexOf('concurrently');
    expect(buildIdx).toBeGreaterThan(-1);
    expect(concurrentlyIdx).toBeGreaterThan(buildIdx);
  });

  test('dev script preserves build:sw:reset and seedLocalD1 pre-steps', () => {
    const swIdx = devScript.indexOf('build:sw:reset');
    const seedIdx = devScript.indexOf('seedLocalD1');
    const concurrentlyIdx = devScript.indexOf('concurrently');
    expect(swIdx).toBeGreaterThan(-1);
    expect(seedIdx).toBeGreaterThan(swIdx);
    expect(concurrentlyIdx).toBeGreaterThan(seedIdx);
  });

  test('dev:client script exists and uses vite build --watch', () => {
    expect(pkg.scripts['dev:client']).toBeDefined();
    expect(pkg.scripts['dev:client']).toContain('vite build --watch');
  });

  test('concurrently is listed as a devDependency', () => {
    expect(pkg.devDependencies.concurrently).toBeDefined();
  });
});
