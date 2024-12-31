import eslintTsConfig from './eslint-ts.config.mjs';
import eslintJestConfig from './eslint-jest.config.mjs';

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintJestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const commonEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  ...codeConfig,
  ...testConfig,
];

export default commonEslintConfig;
