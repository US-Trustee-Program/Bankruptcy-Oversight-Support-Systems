import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'backend/vitest.config.ts',
      'common/vitest.config.ts',
      'user-interface/vitest.config.mts',
      'dev-tools/vitest.config.ts',
    ],
  },
});
