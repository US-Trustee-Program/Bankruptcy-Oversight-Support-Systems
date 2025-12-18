import { eslintTsConfig, eslintTestConfig } from '../eslint-shared.config.mjs';

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const devToolsEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/eslint*.config.mjs'],
  },
  ...codeConfig,
  ...testConfig,
];

export default devToolsEslintConfig;
