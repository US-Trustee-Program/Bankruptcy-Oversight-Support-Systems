import tseslint from 'typescript-eslint';
import commonEslintConfig from '../common/eslint.config.mjs';

const backendEslintConfig = tseslint.config(commonEslintConfig);

export default backendEslintConfig;
