import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const eslint = require('@eslint/js');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

/**
 * eslintJsConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all JavaScript
 * family files (e.g. `.config.[c|m]js`).
 */
const eslintConfigsConfig = tsEslint.config(
  eslint.configs.recommended,
  eslintPluginPrettierRecommended,
);

export default eslintConfigsConfig;
