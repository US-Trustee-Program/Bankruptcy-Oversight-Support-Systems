import eslintTsConfig from '../common/eslint-ts.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');
const reactPlugin = require('eslint-plugin-react');

const frontendEslintConfig = tsEslint.config(
  eslintTsConfig,
  jsxA11y['flatConfigs']['recommended'],
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
);

export default frontendEslintConfig;
