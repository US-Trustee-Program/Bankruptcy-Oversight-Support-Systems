import tseslint from 'typescript-eslint';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import noJestEslintConfig from '../common/no-jest.eslint.config.mjs';

const frontendEslintConfig = tseslint.config(noJestEslintConfig, jsxA11y.flatConfigs.recommended);

export default frontendEslintConfig;
