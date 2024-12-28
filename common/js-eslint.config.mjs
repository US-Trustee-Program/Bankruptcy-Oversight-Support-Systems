import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');
const eslint = require('@eslint/js');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

const jsEslintConfig = tsEslint.config(eslint.configs.recommended, eslintPluginPrettierRecommended);

export default jsEslintConfig;
