import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import noJestEslintConfig from './no-jest.eslint.config.mjs';

const commonEslintConfig = tseslint.config(
  noJestEslintConfig,
  {
    plugins: jest.configs['flat/recommended']['plugins'],
  },
  {
    languageOptions: {
      globals: jest.configs['flat/recommended']['languageOptions']['globals'],
    },
  },
  {
    rules: {
      ...jest.configs['flat/recommended']['rules'],
    },
  },
);

export default commonEslintConfig;
