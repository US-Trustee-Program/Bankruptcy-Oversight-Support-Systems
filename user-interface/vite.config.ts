/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import envCompatible from 'vite-plugin-env-compatible';
import checker from 'vite-plugin-checker';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import eslint from 'vite-plugin-eslint';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    checker({
      overlay: { initialIsOpen: false },
      typescript: true,
      eslint: {
        lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
      },
    }),
    envCompatible(),
    // svgr options: https://react-svgr.com/docs/options/
    svgr({ svgrOptions: { icon: true } }),
    viteTsconfigPaths(),
    eslint(),
  ],
  envPrefix: 'CAMS_',
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    coverage: {
      reporter: ['text', 'html'],
      exclude: [
        '/index.tsx',
        '/reportWebVitals.ts',
        '/configuration/apiConfiguration.ts',
        'http.adapter.ts',
        'node_modules/',
        'src/setupTests.ts',
        'build',
      ],
    },
  },
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
    proxy: {},
  },
});
