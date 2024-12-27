import tseslint from 'typescript-eslint';
import commonEslintConfig from '../../common/eslint.config.mjs';

const e2eEslintConfig = tseslint.config(commonEslintConfig);

export default e2eEslintConfig;
