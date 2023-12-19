/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverageFrom: ['**/*.{js,ts}'],
  coverageThreshold: {
    global: {
      lines: 90,
      branches: 85,
    },
  },
  coveragePathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '.dependency-cruiser.js',
    '.*test.[jt]s',
    'azure/app-insights.ts',
    'dist/',
    'coverage/',
    'lib/interfaces/case.assignment.repository.interface.d.ts',
    'lib/use-cases/cases.interface.d.ts',
    'lib/use-cases/attorney.gateway.interface.d.ts',
    'lib/adapters/types/',
    'lib/adapters/gateways/cases.local.gateway.ts',
    'lib/testing/',
    'lib/cosmos-humble-objects/',
    'jest.*config.js',
  ],
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '!**/?(*.)+(integration).(spec|test).[jt]s?(x)'],
};
