/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { coverageConfigDefaults } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@common\/cams$/, replacement: path.resolve(__dirname, '../common/src/index.ts') },
      {
        find: /^@common\/cams\/(.+)$/,
        replacement: path.resolve(__dirname, '../common/src/cams/$1'),
      },
      { find: '@common', replacement: path.resolve(__dirname, '../common/src') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    restoreMocks: true,
    include: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/?(*.)+(integration).(spec|test).[jt]s?(x)'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['**/*.[jt]s'],
      exclude: [
        '<rootDir>/node_modules/',
        '**/express/',
        '**/function-apps/azure/app-insights.ts',
        '**/function-apps/api/oauth2/',
        '**/function-apps/dataflows/',
        '**/lib/adapters/gateways/cases.local.gateway.ts',
        '**/lib/humble-objects/',
        '**/lib/testing/',
        '**/lib/adapters/gateways/okta/HumbleVerifier.ts',
        'common/',
        'user-interface/',
        'dev-tools/',
        'test/',
        '../test/migration/**',
        '.dependency-cruiser.js',
        '.*test.[jt]s',
        '.*mock.*.ts',
        '.*.d.ts',
        '**/dist/',
        '**/coverage/',
        'vitest.*config.ts',
        ...coverageConfigDefaults.exclude,
      ],
      thresholds: {
        lines: 90,
        branches: 90,
      },
    },
  },
});
