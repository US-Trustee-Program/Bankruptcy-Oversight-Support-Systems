/// <reference types="vitest" />
// Vitest config for cross-module Stryker runs from the monorepo root.
// Restricts test discovery to backend/ only and resolves @common alias.
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    restoreMocks: true,
    include: ['backend/**/?(*.)+(spec|test).[jt]s?(x)'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/?(*.)+(integration).(spec|test).[jt]s?(x)'],
  },
});
