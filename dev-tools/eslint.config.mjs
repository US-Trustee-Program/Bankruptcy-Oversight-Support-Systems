import commonEslintConfig from '../common/eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

const devToolsEslintConfig = tsEslint.config(commonEslintConfig);

export default devToolsEslintConfig;
