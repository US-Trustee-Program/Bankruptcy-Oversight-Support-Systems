const config = {
  testRunner: 'vitest',
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/index.ts',
    '!src/**/test-utilities/**',
  ],
  coverageAnalysis: 'perTest',
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/mutation.html',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  vitest: {
    configFile: 'vitest.config.ts',
  },
  timeoutMS: 10000,
  timeoutFactor: 1.5,
};

export default config;
