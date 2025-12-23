/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import { coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './coverage',
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        '**/src/index.ts',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        '**/*mock*.{ts,tsx}',
        '**/test-utilities/**',
        ...coverageConfigDefaults.exclude,
      ],
      thresholds: {
        lines: 90,
        branches: 90,
      },
    },
  },
});
