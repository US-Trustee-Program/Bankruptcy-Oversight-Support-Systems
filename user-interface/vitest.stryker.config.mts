/// <reference types="vitest" />
// Vitest config for cross-module Stryker runs from the monorepo root.
// Adjusts paths that are relative in the standard config to work from root.
import { defineConfig } from 'vite';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    restoreMocks: true,
    setupFiles: './user-interface/src/setupTests.ts',
    include: ['user-interface/src/**/*.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/{vite,vitest,eslint,prettier}.config.*',
      'test/accessibility/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
});
