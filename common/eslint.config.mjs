import tsEslintConfig from './ts-eslint.config.mjs';
import jestEslintConfig from './jest-eslint.config.mjs';

const codeConfig = tsEslintConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = jestEslintConfig.map((configObject) => ({
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
