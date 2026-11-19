// @ts-check
// Lint as a control (P18-TSK-008). Adapted from finapp-admin-panel/eslint.config.js (ADR-F08); every rule
// here is proven to fire by tests/eslint-guards.test.ts, so weakening one turns the build red.
import path from 'node:path';
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * finapp/module-boundaries - a customer module never imports another (blueprint §9).
 *
 * src/modules/<a>/** may import src/platform, src/design-system, src/generated and its own files,
 * never src/modules/<b>/**. Relative imports are resolved against the importing file, so `../../x`
 * cannot slip past the rule.
 * @type {import('eslint').Rule.RuleModule}
 */
const moduleBoundaries = {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid one customer module importing another' },
    messages: {
      crossModule:
        "Module '{{from}}' must not import module '{{to}}'. Share through src/platform or src/design-system instead.",
    },
    schema: [],
  },
  create(context) {
    const file = context.filename.split(path.sep).join('/');
    const own = /\/src\/modules\/([^/]+)\//.exec(file)?.[1];
    if (own === undefined) return {};
    /** @param {import('estree').Node & { source?: import('estree').Node | null }} node */
    const check = (node) => {
      const source = node.source?.type === 'Literal' ? node.source.value : undefined;
      if (typeof source !== 'string' || !source.startsWith('.')) return;
      const target = path.resolve(path.dirname(context.filename), source).split(path.sep).join('/');
      const other = /\/src\/modules\/([^/]+)(\/|$)/.exec(target)?.[1];
      if (other !== undefined && other !== own) {
        context.report({ node, messageId: 'crossModule', data: { from: own, to: other } });
      }
    };
    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
      ImportExpression: check,
    };
  },
};

/** Money never becomes a JavaScript number (ADR-F04 decision 7). */
const moneyRules = [
  {
    selector: "CallExpression[callee.name='parseFloat']",
    message: 'parseFloat is forbidden: amounts stay decimal strings (ADR-F04). Use the Money formatter.',
  },
  {
    selector: "CallExpression[callee.object.name='Number'][callee.property.name='parseFloat']",
    message: 'Number.parseFloat is forbidden: amounts stay decimal strings (ADR-F04).',
  },
  {
    selector:
      "CallExpression[callee.name='Number'] > MemberExpression[property.name=/[Aa]mount|[Bb]alance|^(fee|rate)s?$|[a-z](Fee|Rate)s?$/]",
    message: 'Converting a monetary value to a Number is forbidden (ADR-F04). It stays a decimal string.',
  },
  {
    selector:
      "CallExpression[callee.name='Number'] > Identifier[name=/[Aa]mount|[Bb]alance|^(fee|rate)s?$|[a-z](Fee|Rate)s?$/]",
    message: 'Converting a monetary value to a Number is forbidden (ADR-F04). It stays a decimal string.',
  },
  {
    selector:
      "UnaryExpression[operator='+'] > MemberExpression[property.name=/[Aa]mount|[Bb]alance|^(fee|rate)s?$|[a-z](Fee|Rate)s?$/]",
    message: 'Unary + on a monetary value is a float conversion and is forbidden (ADR-F04).',
  },
  {
    selector:
      "UnaryExpression[operator='+'] > Identifier[name=/[Aa]mount|[Bb]alance|^(fee|rate)s?$|[a-z](Fee|Rate)s?$/]",
    message: 'Unary + on a monetary value is a float conversion and is forbidden (ADR-F04).',
  },
  {
    selector: "CallExpression[callee.property.name='toFixed']",
    message: 'toFixed formats a binary float and is forbidden (ADR-F04). Use the Money formatter on the string.',
  },
];

/** Script-injection paths, banned so the CSP is a second line, not the only one (ADR-F07 decision 2). */
const injectionRules = [
  {
    selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
    message: 'dangerouslySetInnerHTML is forbidden (ADR-F07).',
  },
  {
    selector: 'MemberExpression[property.name=/^(innerHTML|outerHTML)$/]',
    message: 'innerHTML/outerHTML are forbidden (ADR-F07).',
  },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: 'insertAdjacentHTML is forbidden (ADR-F07).',
  },
  {
    selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
    message: 'document.write is forbidden (ADR-F07).',
  },
  {
    selector: 'CallExpression[callee.name=/^set(Timeout|Interval)$/] > Literal.arguments:first-child',
    message: 'A string timer is eval; pass a function (ADR-F07).',
  },
  {
    selector: "CallExpression[callee.name='useMantineColorScheme'][arguments.length=0]",
    message:
      'Call useMantineColorScheme({ keepTransitions: true }): without it Mantine writes a <style> through innerHTML, which Trusted Types refuse (ADR-F07).',
  },
];

/**
 * Browser storage (ADR-F07 decision 4). Only src/platform/preferences.ts may touch localStorage, for the
 * one allow-listed preferences key; nothing may use sessionStorage, IndexedDB or script-set cookies.
 */
const storageGlobals = [
  { name: 'localStorage', message: 'Only src/platform/preferences.ts may use localStorage (ADR-F07 decision 4).' },
  { name: 'sessionStorage', message: 'sessionStorage is forbidden: nothing is stored at rest (ADR-F07).' },
  { name: 'indexedDB', message: 'IndexedDB is forbidden: nothing is stored at rest (ADR-F07).' },
];
const storageProperties = [
  {
    object: 'window',
    property: 'localStorage',
    message: 'Only src/platform/preferences.ts may use localStorage (ADR-F07).',
  },
  { object: 'window', property: 'sessionStorage', message: 'sessionStorage is forbidden (ADR-F07).' },
  { object: 'window', property: 'indexedDB', message: 'IndexedDB is forbidden (ADR-F07).' },
  { object: 'globalThis', property: 'localStorage', message: 'Only src/platform/preferences.ts may (ADR-F07).' },
  { object: 'document', property: 'cookie', message: 'Script never reads or sets cookies (ADR-F02, ADR-F07).' },
];

/**
 * Mantine parts that render inline <style> elements, which the CSP (`style-src 'self'`) refuses. The
 * catalogue's CSP run is the backstop for anything not listed.
 */
const inlineStyleComponents = {
  name: '@mantine/core',
  importNames: ['Grid', 'SimpleGrid', 'ColorSchemeScript', 'InlineStyles', 'AppShell', 'Modal', 'Drawer'],
  message:
    "Renders an inline <style> element, which the CSP refuses (ADR-F07). Use Group, Stack, Flex, a stylesheet, or the design system's CustomerModal.",
};

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'dist-catalogue/',
      'coverage/',
      'node_modules/',
      'playwright-report/',
      'test-results/',
      'src/generated/',
      // Tool worktrees and session files: another checkout of this repository, never this tree.
      '.claude/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    plugins: { finapp: { rules: { 'module-boundaries': moduleBoundaries } } },
    rules: {
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-restricted-syntax': ['error', ...moneyRules, ...injectionRules],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}', 'catalogue/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'finapp/module-boundaries': 'error',
      'no-restricted-globals': ['error', ...storageGlobals],
      'no-restricted-properties': ['error', ...storageProperties],
      // Test doubles never ship (DOD-CUST); check-bundle is the backstop.
      'no-restricted-imports': [
        'error',
        {
          paths: [inlineStyleComponents],
          patterns: [{ group: ['msw', 'msw/*'], message: 'MSW is for tests only (DOD-CUST).' }],
        },
      ],
    },
  },
  {
    // The one sanctioned localStorage user: the allow-listed preferences key.
    files: ['src/platform/preferences.ts'],
    rules: {
      'no-restricted-globals': ['error', ...storageGlobals.filter((g) => g.name !== 'localStorage')],
      'no-restricted-properties': ['error', ...storageProperties.filter((p) => p.property !== 'localStorage')],
    },
  },
  {
    files: ['src/**/*.test.{ts,tsx}', 'src/testing/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', { paths: [inlineStyleComponents] }],
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
    },
  },
  {
    files: ['scripts/**/*.mjs', 'config/**/*.mjs', '*.config.{js,ts}', 'tests/**/*.ts', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
