import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const eslint = require('@eslint/js');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');
const vitest = require('@vitest/eslint-plugin');
const jsonc = require('eslint-plugin-jsonc');

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
