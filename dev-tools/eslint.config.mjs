import tseslint from 'typescript-eslint';
import commonEslintConfig from '../common/eslint.config.mjs';

const devToolsEslintConfig = tseslint.config(commonEslintConfig);

export default devToolsEslintConfig;
