import eslintTsConfig from './eslint-ts.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jest = require('eslint-plugin-jest');

/**
 * eslintJestConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all JavaScript
 * family test files (e.g. `.test.[j|t]s`, `.test.[j|t]sx`) that are tested with Jest.
 */
const eslintJestConfig = tsEslint.config(
  eslintTsConfig,
  {
    plugins: jest.configs['flat/recommended']['plugins'],
  },
  {
    languageOptions: {
      globals: jest.configs['flat/recommended']['languageOptions']['globals'],
    },
  },
  {
    rules: {
      ...jest.configs['flat/recommended']['rules'],
    },
  },
  {
    settings: {
      jest: {
        version: '29.7.0',
      },
    },
  },
);

export default eslintJestConfig;
