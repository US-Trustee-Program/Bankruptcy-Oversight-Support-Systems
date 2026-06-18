import { eslintTsConfig } from '../eslint-shared.config.mjs';
// @eslint-react/eslint-plugin is ESM-only (no CJS export) — must use top-level import
import eslintReact from '@eslint-react/eslint-plugin';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactHooks = require('eslint-plugin-react-hooks');

/**
 * eslintUiConfig
 *
 * This ConfigArray is intended to be the eslint configuration for non-test TypeScript
 * family files (e.g. `.ts`, `.tsx`) in the frontend project.
 */
const eslintUiConfig = tsEslint.config(
  eslintTsConfig,
  jsxA11y['flatConfigs']['recommended'],
  eslintReact.configs['recommended-typescript'],
  reactHooks.configs.flat['recommended-latest'],
  {
    // Override react-hooks rules to be warnings instead of errors
    // This allows us to track issues without blocking PRs
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'react-hooks/rules-of-hooks': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      // Disabled due to known bug causing false positives: https://github.com/facebook/react/issues/34775
      'react-hooks/refs': 'off',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/use-memo': 'warn',
      // Downgrade @eslint-react rules that have pre-existing violations to warnings
      // so the ESLint v10 migration doesn't block PRs for pre-existing issues
      '@eslint-react/rules-of-hooks': 'warn',
      '@eslint-react/no-create-ref': 'warn',
      '@eslint-react/error-boundaries': 'warn',
    },
  },
);

export default eslintUiConfig;
