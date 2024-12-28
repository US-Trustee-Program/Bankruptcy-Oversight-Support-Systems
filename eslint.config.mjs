import frontendEslintConfig from './user-interface/eslint.config.mjs';
import jsEslintConfig from './common/js-eslint.config.mjs';
import tsEslintConfig from './common/ts-eslint.config.mjs';
import jestEslintConfig from './common/jest-eslint.config.mjs';

const frontendSourceConfig = frontendEslintConfig.map((configObject) => ({
  files: ['user-interface/**/*.ts', 'user-interface/**/*.tsx'],
  ...configObject,
}));
const vitestConfig = frontendEslintConfig.map((configObject) => ({
  files: ['user-interface/**/*.test.ts', 'user-interface/**/*.test.tsx'],
  ...configObject,
}));
const sourceConfig = tsEslintConfig.map((configObject) => ({
  files: ['backend/**/*.ts', 'common/**/*.ts', 'dev-tools/**/*.ts', 'test/e2e/**/*.ts'],
  ...configObject,
}));
const jestConfig = jestEslintConfig.map((configObject) => ({
  files: [
    'backend/**/*.test.ts',
    'common/**/*.test.ts',
    'dev-tools/**/*.test.ts',
    'test/e2e/**/*.test.ts',
  ],
  ...configObject,
}));
const jsConfig = jsEslintConfig.map((configObject) => ({
  files: ['**/*.[mc]js', '**/*.js'],
  ...configObject,
}));

const eslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  ...frontendSourceConfig,
  ...vitestConfig,
  ...sourceConfig,
  ...jestConfig,
  ...jsConfig,
];

export default eslintConfig;
