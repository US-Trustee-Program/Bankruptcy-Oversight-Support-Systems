import tsEslintConfig from './ts-eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jest = require('eslint-plugin-jest');
const jestVersion = require('jest/package.json').version;

const jestEslintConfig = tsEslint.config(
  tsEslintConfig,
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
        version: jestVersion,
      },
    },
  },
);

export default jestEslintConfig;
