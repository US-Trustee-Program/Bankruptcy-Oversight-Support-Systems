/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
  clearMocks: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    'coverage/',
    'dist/',
    '<rootDir>/node_modules/',
    '.dependency-cruiser.js',
    'jest.config.cjs',
    '.*test.[jt]s',
    '.*.d.ts',
    '.*mock.*',
    'http-status-codes.ts',
  ],
  collectCoverageFrom: ['**/*.{js,ts}'],
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 90,
    },
  },
  preset: 'ts-jest',
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
};
