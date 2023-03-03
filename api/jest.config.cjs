module.exports = {
  preset: 'ts-jest/presets/default-esm',
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/unit/**/*.test.ts',
  ],
  verbose: true,
  forceExit: true,
  //clearMocks: true,
};
