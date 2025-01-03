import eslintUiConfig from './eslint-ui.config.mjs';
import eslintUiTestConfig from './eslint-ui-test.config.mjs';

const codeConfig = eslintUiConfig.map((configObject) => ({
  files: ['**/*.ts', '**/*.tsx'],
  ...configObject,
}));
const testConfig = eslintUiTestConfig.map((configObject) => ({
  files: ['**/*.test.ts', '**/*.test.tsx'],
  ...configObject,
}));

const frontendEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  ...codeConfig,
  ...testConfig,
];

export default frontendEslintConfig;
