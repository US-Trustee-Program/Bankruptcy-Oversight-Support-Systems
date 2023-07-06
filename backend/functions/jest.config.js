/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    '**/*.{js,ts}'
  ],
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '.dependency-cruiser.js',
    '.*test.[jt]s',
    'dist/',
    'coverage/',
    'lib/adapters/types/',
    'lib/testing/mock-data/',
    'jest.*config.js',
  ],
  testMatch: [ '**/?(*.)+(spec|test).[jt]s?(x)', '!**/?(*.)+(integration).(spec|test).[jt]s?(x)' ]
};
