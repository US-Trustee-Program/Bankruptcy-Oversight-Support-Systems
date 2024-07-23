/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import envCompatible from 'vite-plugin-env-compatible';
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
  build: {
    outDir: 'build',
  },
  server: {
    port: 3000,
    open: true,
    proxy: {},
  },
});
