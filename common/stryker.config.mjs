// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  checkers: ['typescript'],
  tsconfigFile: 'tsconfig.json',
  mutate: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/**/*mock*.ts',
    '!src/**/test-utilities/**',
  ],
  reporters: ['html', 'clear-text', 'progress'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html',
  },
  thresholds: {
    high: 80,
    low: 60,
    break: 0,
  },
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',
  tempDirName: '.stryker-tmp',
};

export default config;
