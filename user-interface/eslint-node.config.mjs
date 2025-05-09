import globals from 'globals';
import eslintTsConfig from '../common/eslint-ts.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

const eslintNodeConfig = tsEslint.config(
  eslintTsConfig,
  {
    rules: {
      'no-undef': 'off',
    }
  }
);

export default eslintNodeConfig;
