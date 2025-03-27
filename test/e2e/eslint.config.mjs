import eslintTsConfig from '../../common/eslint-ts.config.mjs';
import eslintTestConfig from '../../common/eslint-test.config.mjs';

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const e2eEslintConfig = [
  {
    ignores: ['**/node_modules/**/*', '**/playwright-report/**/*', '**/test-results/**/*'],
  },
  ...codeConfig,
  ...testConfig,
];

export default e2eEslintConfig;
