import eslintTsConfig from '../common/eslint-ts.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactPlugin = require('eslint-plugin-react');
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
);

export default eslintUiConfig;
