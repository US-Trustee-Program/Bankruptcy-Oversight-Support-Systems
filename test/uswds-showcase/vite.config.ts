import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    viteStaticCopy({
      targets: [
        {
          src: '../../node_modules/@uswds/uswds/dist/fonts/*',
          dest: 'assets/fonts',
        },
        {
          src: '../../node_modules/@uswds/uswds/dist/img/*',
          dest: 'assets/styles/img',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../user-interface/src'),
      '@common': path.resolve(__dirname, '../../common/src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        loadPaths: [
          path.resolve(__dirname, '../../user-interface/src'),
          path.resolve(__dirname, '../../user-interface/public'),
        ],
      },
    },
  },
  server: {
    port: 3001,
    open: true,
  },
});
