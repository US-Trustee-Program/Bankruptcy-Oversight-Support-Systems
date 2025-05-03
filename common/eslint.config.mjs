import eslintConfigsConfig from './configs.config.mjs';
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
const configsConfig = eslintConfigsConfig.map((configObject) => ({
  files: ['**/*.config.[cm]js'],
  ...configObject,
}));

const commonEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*'],
  },
  ...codeConfig,
  ...testConfig,
  ...configsConfig,
];

export default commonEslintConfig;
