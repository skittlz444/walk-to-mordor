/**
 * ESLint Flat Config — Walk to Mordor
 *
 * Three-scope strategy:
 *  1. src/ and client/src/  → strict TypeScript-ESLint rules
 *  2. public/js/*.js        → relaxed rules + legacy deprecation warning
 *  3. public/sw.js          → service-worker globals
 *
 * public/js/client/ is globally ignored (Vite build output).
 * See docs/frontend-guide.md #Linting for full documentation.
 */

import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import globals from "globals";

/** @type {import("eslint").Linter.Config[]} */
export default [
  // ── Global ignores ────────────────────────────────────────────────────
  {
    ignores: [
      "node_modules/",
      "public/js/client/",
      "coverage/",
      "dist/",
      "playwright-report/",
      "test-results/",
      "_bmad*/",
      "raw_assets/",
      "screenshots/",
      "client/test-results/",
    ],
  },

  // ── Scope 1: src/**/*.ts — strict TypeScript ─────────────────────────
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
      globals: {
        ...globals.node,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // Strict: no explicit any (aligns with project "no any" rule)
      "@typescript-eslint/no-explicit-any": "error",
      // Unused vars: error, but allow _ prefix for intentional unused
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      // Encourage consistent type imports
      "@typescript-eslint/consistent-type-imports": "warn",
      // Return types encouraged but not required
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },

  // ── Scope 2: client/src/**/*.{ts,tsx} — strict TypeScript + JSX ──────
  {
    files: ["client/src/**/*.ts", "client/src/**/*.tsx"],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        jsxPragma: null, // Preact uses automatic JSX runtime
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },

  // ── Scope 3: public/js/*.js — relaxed legacy + deprecation warning ───
  {
    files: ["public/js/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // Deprecation warning: fires once per file via Program node selector.
      // Warns contributors that new code should go in client/src/ instead.
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Program",
          message:
            "Legacy JS: New code should be added to client/src/ (Preact islands). Do not expand legacy modules.",
        },
      ],
      // Relaxed: no error-level rules on existing legacy code
      "no-unused-vars": "off",
    },
  },

  // ── Scope 4: public/sw.js — service worker globals ───────────────────
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
      },
    },
    rules: {
      "no-restricted-syntax": [
        "warn",
        {
          selector: "Program",
          message:
            "Legacy JS: New code should be added to client/src/ (Preact islands). Do not expand legacy modules.",
        },
      ],
      "no-unused-vars": "off",
    },
  },
];
