import tsEslintConfig from '../common/ts-eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const jsxA11y = require('eslint-plugin-jsx-a11y');

const frontendEslintConfig = tsEslint.config(tsEslintConfig, jsxA11y['flatConfigs']['recommended']);

export default frontendEslintConfig;
