import { eslintTsConfig, eslintTestConfig } from '../eslint-shared.config.mjs';

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const backendEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*'],
  },
  ...codeConfig,
  ...testConfig,
];

export default backendEslintConfig;
