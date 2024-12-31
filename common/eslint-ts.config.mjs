import eslintJsConfig from './eslint-js.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

/**
 * eslintTsConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all TypeScript
 * family files (e.g. `.ts`, `.tsx`).
 */
const eslintTsConfig = tsEslint.config(
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

export default eslintTsConfig;
