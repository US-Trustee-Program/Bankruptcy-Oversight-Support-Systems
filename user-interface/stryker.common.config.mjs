// @ts-check
process.env.CAMS_USE_FAKE_API = 'true';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: {
    configFile: 'user-interface/vitest.stryker.config.mts',
  },
  // No TS checker — UI tsconfig has browser/USWDS deps not in the sandbox.
  checkers: [],
  mutate: [
    'common/src/**/*.ts',
    '!common/src/index.ts',
    '!common/src/**/*.test.ts',
    '!common/src/**/*.d.ts',
    '!common/src/**/*mock*.ts',
    '!common/src/**/test-utilities/**',
  ],
  ignorePatterns: [
    '/backend',
    '/dev-tools',
    '/test',
    '/ops',
    '/docs',
    '/architecture',
    '/.claude',
    '/.beads',
    '/.ustp-cams-fdp',
  ],
  concurrency: 2,
  reporters: ['json', 'clear-text'],
  jsonReporter: {
    fileName: 'user-interface/reports/mutation/common-via-ui.json',
  },
  thresholds: { high: 0, low: 0, break: 0 },
  incremental: true,
  incrementalFile: 'user-interface/.stryker-tmp/common-via-ui-incremental.json',
  tempDirName: '.stryker-tmp/cross-module-ui',
};

export default config;
