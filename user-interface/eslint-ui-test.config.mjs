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
const eslintUiTestConfig = tsEslint.config(eslintUiConfig, {
  plugins: testingLibrary.configs['flat/react']['plugins'],
  files: ['**/*.test.ts', '**/*.test.tsx'],
  rules: {
    'testing-library/await-async-events': 'error',
    'testing-library/await-async-queries': 'error',
    'testing-library/await-async-utils': 'error',
    'testing-library/no-await-sync-events': 'error',
    'testing-library/no-await-sync-queries': 'error',
    'testing-library/no-container': 'warn', // default: error
    'testing-library/no-debugging-utils': 'warn',
    'testing-library/no-dom-import': 'error',
    'testing-library/no-global-regexp-flag-in-query': 'error',
    'testing-library/no-manual-cleanup': 'error',
    'testing-library/no-node-access': 'off', // default: error
    'testing-library/no-promise-in-fire-event': 'error',
    'testing-library/no-render-in-lifecycle': 'warn', // default: error
    'testing-library/no-unnecessary-act': 'error',
    'testing-library/no-wait-for-multiple-assertions': 'warn', // default: error
    'testing-library/no-wait-for-side-effects': 'warn', // default: error
    'testing-library/no-wait-for-snapshot': 'error',
    'testing-library/prefer-find-by': 'error',
    'testing-library/prefer-presence-queries': 'warn', // default: error
    'testing-library/prefer-query-by-disappearance': 'error',
    'testing-library/prefer-screen-queries': 'warn', // default: error
    'testing-library/render-result-naming-convention': 'error',
  },
});

export default eslintUiTestConfig;
