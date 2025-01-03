import eslintUiConfig from './eslint-ui.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const testingLibrary = require('eslint-plugin-testing-library');

/**
 * eslintUiTestConfig
 *
 * This ConfigArray is intended to be the eslint configuration for TypeScript
 * family test files (e.g. `.test.ts`, `.test.tsx`).
 */
const eslintUiTestConfig = tsEslint.config(
  eslintUiConfig,
  {
    plugins: testingLibrary.configs['flat/react']['plugins'],
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'testing-library/no-dom-import': 'error',
      'testing-library/no-unnecessary-act': 'error',
      'testing-library/await-async-events': 'error',
      'testing-library/no-manual-cleanup': 'error',
      'testing-library/no-node-access': 'off',
    },
  },
);

export default eslintUiTestConfig;
