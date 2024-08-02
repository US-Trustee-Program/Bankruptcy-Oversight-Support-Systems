/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        '**/index.tsx',
        '**/.dependency-cruiser.js',
        'src/configuration/apiConfiguration.ts',
        'node_modules/',
        'src/setupTests.ts',
        'src/ApplicationInsightsService.tsx',
        'build',
        'src/lib/models/*mock*.ts',
        'src/lib/components/**/*.mock.tsx',
        'src/lib/components/utils/http.adapter.ts',
        'src/lib/components/**/*Examples.tsx',
        'src/lib/testing/*',
        '**/data-verification/consolidation/ConsolidationOrderAccordionView.tsx',
        '**/data-verification/consolidation/*Mock.ts',
        '**/*.d.ts',
        ...coverageConfigDefaults.exclude,
      ],
      thresholds: {
        branches: 90,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
});
