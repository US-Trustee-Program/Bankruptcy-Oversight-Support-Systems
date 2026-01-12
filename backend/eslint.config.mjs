import { eslintJsConfig, eslintTsConfig, eslintTestConfig } from '../eslint-shared.config.mjs';
import globals from 'globals';

const jsConfig = eslintJsConfig.map((configObject) => ({
  files: ['**/*.js'],
  ...configObject,
  languageOptions: {
    ...configObject.languageOptions,
    globals: {
      ...(configObject.languageOptions?.globals ?? {}),
      ...globals.node,
    },
  },
}));

const codeConfig = eslintTsConfig.map((configObject) => ({
  files: ['**/*.ts'],
  ...configObject,
}));
const testConfig = eslintTestConfig.map((configObject) => ({
  files: ['**/*.test.ts'],
  ...configObject,
}));

const backendEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*', '**/eslint*.config.mjs'],
  },
  ...jsConfig,
  ...codeConfig,
  ...testConfig,
];

export default backendEslintConfig;
