import commonEslintConfig from './common/eslint.config.mjs';
import backendEslintConfig from './backend/eslint.config.mjs';
import frontendEslintConfig from './user-interface/eslint.config.mjs';
import devToolsEslintConfig from './dev-tools/eslint.config.mjs';
import e2eEslintConfig from './test/e2e/eslint.config.mjs';
import jsEslintConfig from './common/js-eslint.config.mjs';

const backendConfig = backendEslintConfig.map((configObject) => ({
  files: ['backend/**/*.ts'],
  ...configObject,
}));
const commonConfig = commonEslintConfig.map((configObject) => ({
  files: ['common/**/*.ts'],
  ...configObject,
}));
const devToolsConfig = devToolsEslintConfig.map((configObject) => ({
  files: ['dev-tools/**/*.ts'],
  ...configObject,
}));
const e2eConfig = e2eEslintConfig.map((configObject) => ({
  files: ['test/e2e/**/*.ts'],
  ...configObject,
}));
const frontendConfig = frontendEslintConfig.map((configObject) => ({
  files: ['user-interface/**/*.ts', 'user-interface/**/*.tsx'],
  ...configObject,
}));
const jsConfig = jsEslintConfig.map((configObject) => ({
  files: ['**/*.[mc]js', '**/*.js'],
  ...configObject,
}));

const eslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*'],
  },
  ...backendConfig,
  ...commonConfig,
  ...devToolsConfig,
  ...e2eConfig,
  ...frontendConfig,
  ...jsConfig,
];

export default eslintConfig;
