import eslintJsConfig from './common/eslint-js.config.mjs';
import eslintTsConfig from './common/eslint-ts.config.mjs';
import eslintTestConfig from './common/eslint-test.config.mjs';
import eslintUiTestConfig from './user-interface/eslint-ui-test.config.mjs';
import eslintUiConfig from './user-interface/eslint-ui.config.mjs';
import eslintNodeConfig from './user-interface/eslint-node.config.mjs';

const frontendSourceConfig = eslintUiConfig.map((configObject) => ({
  files: ['user-interface/**/*.ts', 'user-interface/**/*.tsx'],
  ...configObject,
}));
const frontendTestConfig = eslintUiTestConfig.map((configObject) => ({
  files: ['user-interface/**/*.test.ts', 'user-interface/**/*.test.tsx'],
  ...configObject,
}));
const sourceConfig = eslintTsConfig.map((configObject) => ({
  files: ['backend/**/*.ts', 'common/**/*.ts', 'dev-tools/**/*.ts', 'test/e2e/**/*.ts'],
  ...configObject,
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  files: [
    'backend/**/*.test.ts',
    'common/**/*.test.ts',
    'dev-tools/**/*.test.ts',
    'test/e2e/**/*.test.ts',
  ],
  ...configObject,
}));
const jsConfig = eslintJsConfig.map((configObject) => ({
  files: ['**/*.[mc]js', '**/*.js'],
  ...configObject,
}));
const nodeConfig = eslintNodeConfig.map((configObject) => ({
  files: ['**/envToConfig.js'],
  ...configObject,
}));

const eslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*'],
  },
  ...frontendSourceConfig,
  ...frontendTestConfig,
  ...sourceConfig,
  ...testConfig,
  ...jsConfig,
  ...nodeConfig,
];

export default eslintConfig;
