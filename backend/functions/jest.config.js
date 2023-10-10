/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverageFrom: ['**/*.{js,ts}'],
  coverageThreshold: {
    global: {
      lines: 90,
    },
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '.dependency-cruiser.js',
    '.*test.[jt]s',
    'dist/',
    'coverage/',
    'lib/adapters/types/',
    'lib/testing/mock-data/',
    'lib/cosmos-humble-objects/',
    'jest.*config.js',
  ],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/?(*.)+(integration).(spec|test).[jt]s?(x)'],
};
