import { eslintTsConfig } from '../eslint-shared.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactPlugin = require('eslint-plugin-react');
const reactHooks = require('eslint-plugin-react-hooks');
const reactVersionConfig = { settings: { react: { version: 'detect' } } };

/**
 * eslintUiConfig
 *
 * This ConfigArray is intended to be the eslint configuration for non-test TypeScript
 * family files (e.g. `.ts`, `.tsx`) in the frontend project.
 */
const eslintUiConfig = tsEslint.config(
  reactVersionConfig,
  eslintTsConfig,
  jsxA11y['flatConfigs']['recommended'],
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
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
    },
  },
);

export default eslintUiConfig;
