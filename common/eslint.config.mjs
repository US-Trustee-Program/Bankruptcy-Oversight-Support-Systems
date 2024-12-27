import noJestEslintConfig from './no-jest.eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jest = require('eslint-plugin-jest');

const commonEslintConfig = tsEslint.config(
  noJestEslintConfig,
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
);

export default commonEslintConfig;
