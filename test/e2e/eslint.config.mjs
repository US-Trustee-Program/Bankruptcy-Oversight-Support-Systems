import eslintTsConfig from '../../common/eslint-ts.config.mjs';
import eslintJestConfig from '../../common/eslint-jest.config.mjs';

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintJestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const e2eEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  ...codeConfig,
  ...testConfig,
];

export default e2eEslintConfig;
