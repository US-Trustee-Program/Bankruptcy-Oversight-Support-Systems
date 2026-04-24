/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import babelPlugin from '@rolldown/plugin-babel';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import envCompatible from 'vite-plugin-env-compatible';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';
import svgr from 'vite-plugin-svgr';
import { fileURLToPath } from 'node:url';
import { createReadStream, existsSync } from 'node:fs';

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
    react(),
    babelPlugin({ presets: [reactCompilerPreset()] }),
    viteStaticCopy({
      targets: [
        {
          src: '../node_modules/@uswds/uswds/dist/fonts/**',
          dest: 'assets/fonts',
          rename: { stripBase: 5 },
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
    {
      name: 'serve-uswds-img',
      configureServer(server) {
        const uswdsImgDir = fileURLToPath(
          new URL('../node_modules/@uswds/uswds/dist/img/', import.meta.url),
        );
        const mimeTypes: Record<string, string> = {
          '.svg': 'image/svg+xml',
          '.png': 'image/png',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.gif': 'image/gif',
          '.webp': 'image/webp',
        };
        server.middlewares.use('/assets/styles/img', (req, res, next) => {
          const sanitized = (req.url ?? '').replace(/^\/+/, '').replace(/\.\./g, '');
          const filePath = path.resolve(uswdsImgDir, sanitized);
          if (!filePath.startsWith(uswdsImgDir)) return next();
          if (existsSync(filePath)) {
            const ext = path.extname(filePath).toLowerCase();
            if (mimeTypes[ext]) res.setHeader('Content-Type', mimeTypes[ext]);
            createReadStream(filePath).pipe(res);
          } else {
            next();
          }
        });
      },
    },
  ],
  envPrefix: 'CAMS_',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@common': path.resolve(__dirname, '../common/src'),
    },
  },
  build: {
    cssMinify: 'esbuild',
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
