import eslintJsConfig from '../common/eslint-js.config.mjs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const tsEslint = require('typescript-eslint');

const eslintNodeConfig = tsEslint.config(
  eslintJsConfig,
  {
    rules: {
      'no-undef': 'off',
    }
  }
);

export default eslintNodeConfig;
