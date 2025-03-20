import { createRequire } from 'module';
import eslintUiTestConfig from 'cams/eslint-ui-test.config.mjs';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

const testConfig = eslintUiTestConfig.map((configObject) => ({
  files: ['**/*.test.ts', '**/*.test.tsx'],
  ...configObject,
}));

/**
 * eslintTsConfig
 *
 * This ConfigArray is intended to be the base eslint configuration for all TypeScript
 * family files (e.g. `.ts`, `.tsx`).
 */
const eslintTsConfig = tsEslint.config(
  eslintPluginPrettierRecommended,
  tsEslint.configs.recommended,
  testConfig,
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
