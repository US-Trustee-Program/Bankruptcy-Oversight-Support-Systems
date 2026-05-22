import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@common': resolve(__dirname, '../common/src'),
    },
  },
  test: {
    globals: false,
    environment: 'node',
    restoreMocks: true,
  },
});
