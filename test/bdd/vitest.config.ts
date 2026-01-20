/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { coverageConfigDefaults } from 'vitest/config';
import * as path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '../..'), // Set root to CAMS project root
  plugins: [
    react(),
    tsconfigPaths({
      projects: [
        path.resolve(__dirname, './tsconfig.json'),
        path.resolve(__dirname, '../../user-interface/tsconfig.json'),
        path.resolve(__dirname, '../../backend/tsconfig.json'),
      ],
    }),
  ],
  // Configure SSR externals for Node.js-only packages used in backend
  ssr: {
    noExternal: [],
    // Don't try to bundle these Node.js packages for browser environment
    external: ['natural', 'name-match'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: path.resolve(__dirname, './helpers/setup-tests.ts'),
    // Run BDD full-stack tests + common unit tests + helper infrastructure tests
    include: [
      'test/bdd/features/**/*.spec.{ts,tsx}',
      'test/bdd/helpers/**/*.test.{ts,tsx}',
      'common/**/*.test.{ts,tsx}',
    ],
    exclude: [],
    // Run test files sequentially since they share a single HTTP server
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'json-summary'],
      reportsDirectory: './test/bdd/coverage',
      all: true, // Track all files matching include patterns, even if not imported
      include: ['user-interface/src/**/*.{ts,tsx}', 'backend/lib/**/*.ts', 'common/src/**/*.ts'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/*.d.ts',
        '**/*.types.ts',
        '**/*mock*.{ts,tsx}',
        '**/*.config.{ts,js}',
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/setupTests.ts',
        '**/index.tsx',
        '**/initialize.ts',
        '**/testing/**',
        '**/test-utilities/**',
        '**/server.ts',
        ...coverageConfigDefaults.exclude,
      ],
      // No thresholds for now - just want to see coverage
      thresholds: {
        lines: 0,
        branches: 0,
        functions: 0,
        statements: 0,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../user-interface/src'),
      '@common': path.resolve(__dirname, '../../common/src'),
      '@backend': path.resolve(__dirname, '../../backend'),
      // With workspaces, React is hoisted to root node_modules
      react: path.resolve(__dirname, '../../node_modules/react'),
      'react-dom': path.resolve(__dirname, '../../node_modules/react-dom'),
      'react-router-dom': path.resolve(__dirname, '../../node_modules/react-router-dom'),
      'react/jsx-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-runtime'),
      'react/jsx-dev-runtime': path.resolve(__dirname, '../../node_modules/react/jsx-dev-runtime'),
    },
  },
});
