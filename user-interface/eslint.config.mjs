import jsxA11y from 'eslint-plugin-jsx-a11y';
import noJestEslintConfig from '../common/no-jest.eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

const frontendEslintConfig = tsEslint.config(noJestEslintConfig, jsxA11y.flatConfigs.recommended);

export default frontendEslintConfig;
