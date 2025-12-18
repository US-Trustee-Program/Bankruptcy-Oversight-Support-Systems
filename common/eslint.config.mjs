import { eslintTsConfig, eslintTestConfig } from '../eslint-shared.config.mjs';

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const commonEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*', '**/eslint*.config.mjs'],
  },
  ...codeConfig,
  ...testConfig,
];

export default commonEslintConfig;
