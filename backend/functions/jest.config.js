/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverageFrom: ['**/*.{js,ts}'],
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 90,
    },
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '.dependency-cruiser.js',
    '.*test.[jt]s',
    '.*mock.*.ts',
    '.*.d.ts',
    'azure/app-insights.ts',
    'dist/',
    'coverage/',
    'lib/adapters/gateways/cases.local.gateway.ts',
    'lib/humble-objects/',
    'lib/testing/mock-data/index.ts',
    'lib/testing/local-data/',
    'lib/testing/analysis/',
    'lib/testing/isolated-integration/',
    'lib/testing/testing-utilities.ts',
    'jest.*config.js',
    'lib/adapters/gateways/okta/HumbleVerifier.ts',
  ],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/?(*.)+(integration).(spec|test).[jt]s?(x)'],
};
