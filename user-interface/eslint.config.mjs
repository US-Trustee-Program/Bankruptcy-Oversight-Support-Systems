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

const envToConfigFile = {
  files: ['**/envToConfig.js'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'script', // or 'module' if you're using import/export
    globals: {
      require: 'readonly',
      process: 'readonly',
      console: 'readonly',
      __dirname: 'readonly',
      module: 'readonly',
      exports: 'readonly',
    },
  },
  linterOptions: {
    rules: {
      'prettier/prettier': 'off',
    },
  },
};

const frontendEslintConfig = [
  {
    ignores: ['**/build/**/*', '**/dist/**/*', '**/node_modules/**/*', '**/coverage/**/*'],
  },
  envToConfigFile,
  ...codeConfig,
  ...testConfig,
];

export default frontendEslintConfig;
