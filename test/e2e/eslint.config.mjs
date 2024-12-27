import commonEslintConfig from '../../common/eslint.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

const e2eEslintConfig = tsEslint.config(commonEslintConfig);

export default e2eEslintConfig;
