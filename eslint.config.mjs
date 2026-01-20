import { eslintJsConfig, eslintTsConfig, eslintTestConfig, eslintJsonConfig } from './eslint-shared.config.mjs';
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

const jsonConfig = eslintJsonConfig.map((configObject) => ({
  ...configObject,
  files: ['**/package.json'],
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
      'ops/local-dev/mongo-init/**/*',
    ],
  },
  ...frontendSourceConfig,
  ...frontendTestConfig,
  ...sourceConfig,
  ...testConfig,
  ...jsConfig,
  ...nodeConfig,
  ...jsonConfig,
];

export default eslintConfig;
