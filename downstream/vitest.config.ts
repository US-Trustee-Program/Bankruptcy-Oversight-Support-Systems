import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'temp/**',
        'database/**',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
    include: ['functions/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'temp', 'test/acms-cams-transition'],
  },
});
