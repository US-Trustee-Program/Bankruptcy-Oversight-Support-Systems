/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: [
    "**/*.{js,ts}"
  ],
  coveragePathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "dist/",
    "coverage/",
    "lib/adapters/types/",
    "lib/testing/mock-data/",
    "jest.config.js",
  ]
};
