/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: [ '**/?(*.)+(integration).(spec|test).[jt]s?(x)' ]
};
