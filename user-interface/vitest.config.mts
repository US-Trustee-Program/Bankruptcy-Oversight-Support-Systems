/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { coverageConfigDefaults } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    // Ensure proper jsdom initialization timing
    environmentOptions: {
      jsdom: {
        resources: 'usable',
        // Ensure jsdom is fully ready before tests
        pretendToBeVisual: true,
        // Generic URL for jsdom - doesn't need to be a real server
        // This just sets window.location.href for tests, no actual network connection
        url: process.env.VITEST_JSDOM_URL || 'http://test.example.com'
      }
    },
    exclude: [
      '**\/node_modules/**',
      '**\/dist/**',
      '**\/{vite,vitest,eslint,prettier}.config.*',
      'test/accessibility/**',
    ],

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
        '**/staff-assignment/screen/StaffAssignmentScreenView.tsx',
        '**/staff-assignment/filters/StaffAssignmentFilterView.tsx',
        '**/*.d.ts',
        '**/*.types.ts',
        '**/**humble.ts',
        '*.config.*js',
        ...coverageConfigDefaults.exclude,
        './src/initialize.ts',
        './envToConfig.js',
        './playwright.config.ts',
        './playwright-report/',
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
