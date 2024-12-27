import commonEslintConfig from '../common/eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tseslint = require('typescript-eslint');

const devToolsEslintConfig = tseslint.config(commonEslintConfig);

export default devToolsEslintConfig;
