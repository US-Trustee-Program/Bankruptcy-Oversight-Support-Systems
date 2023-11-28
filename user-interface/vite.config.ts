/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import envCompatible from 'vite-plugin-env-compatible';
import checker from 'vite-plugin-checker';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import eslint from 'vite-plugin-eslint';

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: ['node_modules/', 'node_modules/@uswds/uswds/packages/', 'src/'],
      },
    },
  },
  assetsInclude: ['node_modules/@uswds/uswds/dist/img'],
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: './node_modules/@uswds/uswds/dist/fonts/*',
          dest: 'assets/fonts',
        },
        {
          src: './node_modules/@uswds/uswds/dist/img/*',
          dest: 'assets/styles/img',
        },
      ],
    }),
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
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, '../common/src'),
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
        'node_modules/',
        'src/setupTests.ts',
        'src/ApplicationInsightsService.tsx',
        'build',
        'src/lib/models/*mock*.ts',
        'src/lib/components/utils/http.adapter.ts',
      ],
      branches: 90,
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
