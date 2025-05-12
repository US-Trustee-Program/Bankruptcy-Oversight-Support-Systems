/// <reference types="vitest" />
import {defineConfig, mergeConfig} from 'vite';
import base from './vite.config.mjs'

// https://vitejs.dev/config/
export default mergeConfig(base, {
  build: {
    rollupOptions: {
      input: 'index-scan.html'
    }
  },
  server: {
    open: '/index-scan.html'
  },
});
