import eslintTsConfig from './eslint-ts.config.mjs';
import eslintTestConfig from './eslint-test.config.mjs';

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
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*'],
  },
  ...codeConfig,
  ...testConfig,
];

export default commonEslintConfig;
