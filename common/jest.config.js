/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */

module.exports = {
  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    'coverage/',
    'dist/',
    '<rootDir>/node_modules/',
    'jest.config.js',
    '.*test.[jt]s',
    '.*.d.ts',
    '.*mock.*',
  ],
  collectCoverageFrom: ['**/*.{js,ts}'],
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 90,
    },
  },
  preset: 'ts-jest',
};
