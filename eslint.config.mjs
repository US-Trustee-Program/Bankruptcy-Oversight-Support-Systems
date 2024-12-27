import commonEslintConfig from './common/eslint.config.mjs';
import tseslint from 'typescript-eslint';
import backendEslintConfig from './backend/eslint.config.mjs';
import frontendEslintConfig from './user-interface/eslint.config.mjs';
import e2eEslintConfig from './test/e2e/eslint.config.mjs';
import devToolsEslintConfig from './dev-tools/eslint.config.mjs';

export default [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  {
    files: ['./backend/**/*.ts'],
    ...backendEslintConfig,
  },
  {
    files: ['./common/**/*.ts'],
    ...commonEslintConfig,
  },
  {
    files: ['./user-interface/**/*.ts'],
    ...frontendEslintConfig,
  },
  {
    files: ['./dev-tools/**/*.ts'],
    ...devToolsEslintConfig,
  },
  {
    files: ['./test/e2e/**/*.ts'],
    ...e2eEslintConfig,
  }
];
