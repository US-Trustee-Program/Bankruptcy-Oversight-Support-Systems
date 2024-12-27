import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

const noJestEslintConfig = tsEslint.config(
  eslint.configs.recommended,
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
  eslintPluginPrettierRecommended,
);

export default noJestEslintConfig;
