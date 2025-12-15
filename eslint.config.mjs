import eslintJsConfig from './common/eslint-js.config.mjs';
import eslintTsConfig from './common/eslint-ts.config.mjs';
import eslintTestConfig from './common/eslint-test.config.mjs';
import eslintUiTestConfig from './user-interface/eslint-ui-test.config.mjs';
import eslintUiConfig from './user-interface/eslint-ui.config.mjs';
import eslintNodeConfig from './user-interface/eslint-node.config.mjs';

const frontendSourceConfig = eslintUiConfig.map((configObject) => ({
  ...configObject,
  files: ['user-interface/**/*.ts', 'user-interface/**/*.tsx'],
}));
const frontendTestConfig = eslintUiTestConfig.map((configObject) => ({
  ...configObject,
  files: ['user-interface/**/*.test.ts', 'user-interface/**/*.test.tsx', 'test/bdd/**/*.ts', 'test/bdd/**/*.tsx'],
}));
const sourceConfig = eslintTsConfig.map((configObject) => ({
  ...configObject,
  files: ['backend/**/*.ts', 'common/**/*.ts', 'dev-tools/**/*.ts', 'test/e2e/**/*.ts'],
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  ...configObject,
  files: [
    'backend/**/*.test.ts',
    'common/**/*.test.ts',
    'dev-tools/**/*.test.ts',
    'test/e2e/**/*.test.ts',
  ],
}));
const jsConfig = eslintJsConfig.map((configObject) => ({
  ...configObject,
  files: ['**/*.[mc]js', '**/*.js'],
}));
const nodeConfig = eslintNodeConfig.map((configObject) => ({
  ...configObject,
  files: ['user-interface/**/envToConfig.js'],
}));

const eslintConfig = [
  {
    ignores: [
      '**/build/**/*',
      '**/dist/**/*',
      '**/node_modules/**/*',
      '**/coverage/**/*',
      '**/.*/**',
      '**/eslint*.config.mjs',
    ],
  },
  ...frontendSourceConfig,
  ...frontendTestConfig,
  ...sourceConfig,
  ...testConfig,
  ...jsConfig,
  ...nodeConfig,
];

export default eslintConfig;
