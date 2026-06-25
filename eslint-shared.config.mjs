import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const eslint = require('@eslint/js');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const vitest = require('@vitest/eslint-plugin');
const jsonc = require('eslint-plugin-jsonc');
const sonarjs = require('eslint-plugin-sonarjs');

/**
 * eslintJsConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all JavaScript
 * family files (e.g. `.[j|t]s`, `.[j|t]sx`).
 */
export const eslintJsConfig = tsEslint.config(
  eslint.configs.recommended,
  eslintPluginPrettierRecommended,
);

/**
 * eslintTsConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all TypeScript
 * family files (e.g. `.ts`, `.tsx`).
 */
export const eslintTsConfig = tsEslint.config(
  eslintJsConfig,
  tsEslint.configs.recommended,
  sonarjs.configs.recommended,
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  {
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  // ---------------------------------------------------------------------------
  // eslint-plugin-sonarjs deviations from `sonarjs.configs.recommended`
  //
  // The plugin was adopted primarily to gate cognitive complexity. Its
  // `recommended` config sets every rule to `error`, which surfaced ~413
  // pre-existing violations across the codebase that would immediately break
  // the `--quiet` lint gate. Rather than block PRs on existing debt, every
  // sonarjs rule with pre-existing violations is downgraded to `warn` below so
  // the findings stay VISIBLE for incremental cleanup without failing CI. The
  // ~230 sonarjs rules with zero current violations remain at `error` (their
  // recommended severity) so they block NEW problems.
  //
  // As violations for a given rule are remediated to zero, promote that rule
  // back to `error` (delete its line here) to lock in the improvement.
  // ---------------------------------------------------------------------------
  {
    rules: {
      // Headline gate: keep cognitive-complexity visible but non-blocking for now.
      'sonarjs/cognitive-complexity': 'warn',

      // Pre-existing violations — downgraded to non-blocking until remediated.
      'sonarjs/prefer-specific-assertions': 'warn',
      'sonarjs/no-clear-text-protocols': 'warn',
      'sonarjs/todo-tag': 'warn',
      'sonarjs/no-unused-vars': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/assertions-in-tests': 'warn',
      'sonarjs/no-ignored-exceptions': 'warn',
      'sonarjs/super-linear-regex': 'warn',
      'sonarjs/no-duplicate-test-title': 'warn',
      'sonarjs/no-skipped-tests': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/pseudo-random': 'warn',
      'sonarjs/no-nested-template-literals': 'warn',
      'sonarjs/regex-complexity': 'warn',
      'sonarjs/duplicates-in-character-class': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/constructor-for-side-effects': 'warn',
      'sonarjs/single-char-in-character-classes': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/concise-regex': 'warn',
      'sonarjs/no-trivial-assertions': 'warn',
      'sonarjs/public-static-readonly': 'warn',
      'sonarjs/async-test-assertions': 'warn',
      'sonarjs/single-character-alternation': 'warn',
      'sonarjs/use-type-alias': 'warn',
      'sonarjs/hardcoded-secret-signatures': 'warn',
      'sonarjs/no-identical-expressions': 'warn',
      'sonarjs/redundant-type-aliases': 'warn',
      'sonarjs/no-hardcoded-ip': 'warn',
      'sonarjs/no-redundant-jump': 'warn',
      'sonarjs/no-hardcoded-passwords': 'warn', // pragma: allowlist secret
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/no-unused-collection': 'warn',
      'sonarjs/no-redundant-assignments': 'warn',
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/no-redundant-optional': 'warn',
    },
  },
);

/**
 * eslintTestConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all JavaScript
 * family test files (e.g. `.test.[j|t]s`, `.test.[j|t]sx`) that are tested with Vitest.
 */
export const eslintTestConfig = tsEslint.config(
  eslintTsConfig,
  {
    plugins: {
      vitest,
    },
  },
  {
    rules: {
      ...vitest.configs.recommended.rules,
      'vitest/valid-title': 'off', // Disabled to avoid type-checking requirement
    },
  },
  {
    settings: {
      vitest: {
        typecheck: true,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...vitest.environments.env.globals,
      },
    },
  },
);

/**
 * eslintJsonConfig
 *
 * This ConfigArray is intended to be the eslint configuration for all JSON files,
 * with specific rules to enforce alphabetization in package.json files.
 */
export const eslintJsonConfig = [
  ...jsonc.configs['flat/recommended-with-json'],
  {
    files: ['**/package.json'],
    rules: {
      'jsonc/sort-keys': [
        'error',
        {
          pathPattern: '^$',
          order: [
            'name',
            'version',
            'private',
            'license',
            'description',
            'main',
            'type',
            'workspaces',
            'scripts',
            'author',
            'browserslist',
            'eslintConfig',
            'dependencies',
            'devDependencies',
            'peerDependencies',
            'optionalDependencies',
            'overrides',
          ],
        },
        {
          pathPattern: '^(?:dev|peer|optional)?[Dd]ependencies$',
          order: { type: 'asc' },
        },
        {
          pathPattern: '^scripts$',
          order: { type: 'asc' },
        },
      ],
    },
  },
];
