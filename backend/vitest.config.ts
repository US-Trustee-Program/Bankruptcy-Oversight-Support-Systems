/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/?(*.)+(spec|test).[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/?(*.)+(integration).(spec|test).[jt]s?(x)'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      all: true,
      include: ['**/*.{js,ts}'],
      exclude: [
        '<rootDir>/node_modules/',
        '.dependency-cruiser.js',
        '.*test.[jt]s',
        '.*mock.*.ts',
        '.*.d.ts',
        'function-apps/azure/app-insights.ts',
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
        'vitest.*config.ts',
        'lib/adapters/gateways/okta/HumbleVerifier.ts',
        'function-apps/dataflows/migration/*',
        'function-apps/dataflows/events/*',
        'function-apps/dataflows/e2e/*',
        'function-apps/dataflows/import/*',
        'function-apps/dataflows/dataflows-queues.ts',
        'function-apps/dataflows/dataflows.ts',
        'function-apps/dataflows/storage-queues.ts',
        'express/',
        'scripts/',
        ...coverageConfigDefaults.exclude,
      ],
      thresholds: {
        lines: 90,
        branches: 90,
      },
    },
  },
});
