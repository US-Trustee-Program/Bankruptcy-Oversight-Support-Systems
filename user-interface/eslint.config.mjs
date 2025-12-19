import eslintUiConfig from './eslint-ui.config.mjs';
import eslintUiTestConfig from './eslint-ui-test.config.mjs';
import eslintNodeConfig from './eslint-node.config.mjs';

const codeConfig = eslintUiConfig.map((configObject) => ({
  files: ['**/*.ts', '**/*.tsx'],
  ...configObject,
}));
const testConfig = eslintUiTestConfig.map((configObject) => ({
  files: ['**/*.test.ts', '**/*.test.tsx'],
  ...configObject,
}));
const nodeConfig = eslintNodeConfig.map((configObject) => ({
  files: ['**/envToConfig.js'],
  ...configObject,
}));

const frontendEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*', '**/eslint*.config.mjs'],
  },
  ...codeConfig,
  ...testConfig,
  ...nodeConfig,
];

export default frontendEslintConfig;
