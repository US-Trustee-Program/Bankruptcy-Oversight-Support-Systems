import eslintTsConfig from '../common/eslint-ts.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');

const frontendEslintConfig = tsEslint.config(eslintTsConfig, jsxA11y['flatConfigs']['recommended']);

export default frontendEslintConfig;
