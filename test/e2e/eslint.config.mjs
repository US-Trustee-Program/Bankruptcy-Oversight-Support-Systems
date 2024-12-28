import tsEslintConfig from '../../common/ts-eslint.config.mjs';
import jestEslintConfig from '../../common/jest-eslint.config.mjs';

const codeConfig = tsEslintConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = jestEslintConfig.map((configObject) => ({
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
