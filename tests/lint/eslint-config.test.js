/**
 * Tests for eslint.config.mjs — validates scopes, rules, and ignores.
 *
 * Uses `eslint --print-config` subprocess to inspect the resolved config
 * for representative file paths (avoids ESM/CJS interop issues with Jest).
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '..', '..');
const ESLINT_BIN = path.join('.', 'node_modules', '.bin', 'eslint');

/**
 * Get resolved ESLint config for a file path via --print-config.
 * Returns parsed JSON with { rules, languageOptions, ... }.
 */
function configFor(relPath) {
  const out = execSync(
    `${ESLINT_BIN} --print-config ${relPath}`,
    { cwd: ROOT, encoding: 'utf-8', timeout: 30000 }
  );
  return JSON.parse(out);
}

/** Run eslint on the whole project and return { exitCode, errorCount, warningCount } */
function lintAll() {
  try {
    const out = execSync(`${ESLINT_BIN} . --format json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
    });
    const results = JSON.parse(out);
    return {
      exitCode: 0,
      errorCount: results.reduce((s, r) => s + r.errorCount, 0),
      warningCount: results.reduce((s, r) => s + r.warningCount, 0),
    };
  } catch (err) {
    // ESLint exits non-zero when there are errors; stdout still has JSON
    if (err.stdout) {
      const results = JSON.parse(err.stdout);
      return {
        exitCode: err.status,
        errorCount: results.reduce((s, r) => s + r.errorCount, 0),
        warningCount: results.reduce((s, r) => s + r.warningCount, 0),
      };
    }
    throw err;
  }
}

// ── Config loading ────────────────────────────────────────────────────
describe('ESLint flat config', () => {
  it('loads without errors', () => {
    const config = configFor('src/index.ts');
    expect(config).toBeDefined();
    expect(config.rules).toBeDefined();
  });
});

// ── Scope: src/**/*.ts — strict TypeScript rules ─────────────────────
describe('src/ TypeScript scope', () => {
  let config;
  beforeAll(() => {
    config = configFor('src/index.ts');
  });

  it('enables @typescript-eslint/no-explicit-any as error', () => {
    const rule = config.rules['@typescript-eslint/no-explicit-any'];
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(2); // error
  });

  it('enables @typescript-eslint/no-unused-vars as error', () => {
    const rule = config.rules['@typescript-eslint/no-unused-vars'];
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(2);
  });

  it('enables @typescript-eslint/consistent-type-imports as warn', () => {
    const rule = config.rules['@typescript-eslint/consistent-type-imports'];
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(1); // warn
  });

  it('turns off base no-unused-vars to avoid conflict', () => {
    const rule = config.rules['no-unused-vars'];
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(0); // off
  });
});

// ── Scope: client/src/**/*.{ts,tsx} — strict TypeScript + JSX ────────
describe('client/src/ TypeScript scope', () => {
  it('applies strict rules to .ts files', () => {
    const config = configFor('client/src/stores/mapStore.ts');
    const rule = config.rules['@typescript-eslint/no-explicit-any'];
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(2);
  });

  it('applies strict rules to .tsx files', () => {
    const config = configFor('client/src/islands/MapIsland.tsx');
    const rule = config.rules['@typescript-eslint/no-explicit-any'];
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(2);
  });
});

// ── Scope: public/js/*.js — legacy + deprecation ─────────────────────
describe('public/js/ legacy scope', () => {
  let config;
  beforeAll(() => {
    config = configFor('public/js/main.js');
  });

  it('includes no-restricted-syntax deprecation warning', () => {
    const rule = config.rules['no-restricted-syntax'];
    expect(rule).toBeDefined();
    const severity = Array.isArray(rule) ? rule[0] : rule;
    expect(severity).toBe(1); // warn
  });

  it('deprecation message mentions client/src/', () => {
    const rule = config.rules['no-restricted-syntax'];
    expect(Array.isArray(rule)).toBe(true);
    const restrictions = rule.slice(1);
    const programRule = restrictions.find(
      (r) => typeof r === 'object' && r.selector === 'Program'
    );
    expect(programRule).toBeDefined();
    expect(programRule.message).toMatch(/client\/src\//);
  });

  it('does not enable @typescript-eslint rules', () => {
    expect(config.rules['@typescript-eslint/no-explicit-any']).toBeUndefined();
  });

  it('matches all legacy JS files', () => {
    const files = [
      'public/js/main.js',
      'public/js/goals.js',
      'public/js/calendar.js',
      'public/js/progress.js',
      'public/js/validators.js',
      'public/js/password-reset.js',
      'public/js/reset-cache-version.js',
      'public/js/update-cache-version.js',
    ];
    for (const f of files) {
      const cfg = configFor(f);
      expect(cfg.rules['no-restricted-syntax']).toBeDefined();
    }
  });
});

// ── Scope: public/sw.js — service worker ─────────────────────────────
describe('public/sw.js service worker scope', () => {
  it('includes service worker globals', () => {
    const config = configFor('public/sw.js');
    expect(config.languageOptions.globals).toBeDefined();
    // ServiceWorkerGlobalScope exposes 'caches'
    expect(config.languageOptions.globals['caches']).toBeDefined();
  });
});

// ── Global ignores ────────────────────────────────────────────────────
describe('global ignores', () => {
  // Create temporary fixture files so --print-config tests real ignore patterns,
  // not "file not found" errors masquerading as ignored.
  const fixtures = [
    'public/js/client/islands.js',
    'coverage/lcov.info',
    '_bmad-output/foo.js',
  ];

  beforeAll(() => {
    for (const f of fixtures) {
      const abs = path.join(ROOT, f);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      if (!fs.existsSync(abs)) {
        fs.writeFileSync(abs, '// fixture\n');
      }
    }
  });

  afterAll(() => {
    for (const f of fixtures) {
      const abs = path.join(ROOT, f);
      try { fs.unlinkSync(abs); } catch { /* may not exist */ }
    }
  });

  // --print-config on ignored files prints "undefined" rather than JSON.
  // We verify the file exists first so a missing file doesn't false-positive.
  function isIgnored(relPath) {
    const abs = path.join(ROOT, relPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`Fixture file missing: ${relPath}`);
    }
    const out = execSync(`${ESLINT_BIN} --print-config ${relPath}`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 15000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    // ESLint prints "undefined" (literally) for globally ignored files
    return out.trim() === 'undefined';
  }

  it('ignores public/js/client/ (Vite build output)', () => {
    expect(isIgnored('public/js/client/islands.js')).toBe(true);
  });

  it('ignores coverage/', () => {
    expect(isIgnored('coverage/lcov.info')).toBe(true);
  });

  it('ignores _bmad directories', () => {
    expect(isIgnored('_bmad-output/foo.js')).toBe(true);
  });
});

// ── npm run lint smoke test ──────────────────────────────────────────
describe('npm run lint', () => {
  it('exits with code 0 on current codebase (no errors)', () => {
    const result = lintAll();
    expect(result.errorCount).toBe(0);
  }, 60000);
});

