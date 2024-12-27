import commonEslintConfig from '../common/eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tseslint = require('typescript-eslint');

const backendEslintConfig = tseslint.config(commonEslintConfig);

export default backendEslintConfig;
