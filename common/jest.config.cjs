/**
 * For a detailed explanation regarding each configuration property, visit:
 * https://jestjs.io/docs/configuration
 */
module.exports = {
  clearMocks: true,
  collectCoverageFrom: ['**/*.{js,ts}'],
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
  coverageThreshold: {
    global: {
      branches: 90,
      lines: 90,
    },
  },
  preset: 'ts-jest',
  testPathIgnorePatterns: ['/dist/', '/node_modules/'],
};
