// @ts-check
// Set env vars needed by backend test suite before Stryker reads this config
process.env.CAMS_LOGIN_PROVIDER = 'mock';
process.env.DATABASE_MOCK = 'true';
process.env.MONGO_CONNECTION_STRING = 'mongodb://test-string';
process.env.FEATURE_FLAG_SDK_KEY = '';

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  testRunner: 'vitest',
  vitest: {
    configFile: 'backend/vitest.stryker.config.ts',
  },
  // No TS checker — backend tsconfig pulls in Azure deps not in the sandbox.
  // common/src mutations are already type-validated in common's own Stryker run.
  checkers: [],
  // Mutate common source only, run backend tests against it
  mutate: [
    'common/src/**/*.ts',
    '!common/src/index.ts',
    '!common/src/**/*.test.ts',
    '!common/src/**/*.d.ts',
    '!common/src/**/*mock*.ts',
    '!common/src/**/test-utilities/**',
  ],
  // Only sandbox common/src and backend — skip everything else to avoid OOM
  ignorePatterns: [
    '/user-interface',
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
    fileName: 'backend/reports/mutation/common-via-backend.json',
  },
  thresholds: { high: 0, low: 0, break: 0 },
  incremental: true,
  incrementalFile: 'backend/.stryker-tmp/common-via-backend-incremental.json',
  tempDirName: '.stryker-tmp/cross-module-backend',
};

export default config;
