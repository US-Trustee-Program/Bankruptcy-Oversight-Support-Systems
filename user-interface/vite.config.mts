/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import envCompatible from 'vite-plugin-env-compatible';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [
          fileURLToPath(new URL('./node_modules/', import.meta.url)),
          fileURLToPath(new URL('../node_modules/', import.meta.url)),
          fileURLToPath(new URL('../node_modules/@uswds/uswds/packages/', import.meta.url)),
          fileURLToPath(new URL('./node_modules/@uswds/uswds/src/stylesheets/', import.meta.url)),
          fileURLToPath(new URL('./src/', import.meta.url)),
        ],
      },
    },
  },
  assetsInclude: ['../node_modules/@uswds/uswds/dist/img'],
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
    viteStaticCopy({
      targets: [
        {
          src: '../node_modules/@uswds/uswds/dist/fonts/*',
          dest: 'assets/fonts',
        },
        {
          src: '../node_modules/@uswds/uswds/dist/img/*',
          dest: 'assets/styles/img',
        },
      ],
    }),
    envCompatible(),
    // svgr options: https://react-svgr.com/docs/options/
    svgr({ svgrOptions: { icon: true } }),
    viteTsconfigPaths(),
  ],
  envPrefix: 'CAMS_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
  build: {
    outDir: 'build',
    rollupOptions: {
      external: [
        '@faker-js/faker',
        '@common/cams/test-utilities/mock-data',
        '../common/src/cams/test-utilities/mock-data.ts',
      ],
    },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {},
  },
});
