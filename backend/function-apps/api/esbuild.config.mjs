import * as esbuild from 'esbuild';
import { COMMON_BUILD_OPTIONS } from '../../esbuild-shared.mjs';

// Build a single bundle that imports all functions
// This ensures all app.http() registration code executes at startup
esbuild
  .build({
    ...COMMON_BUILD_OPTIONS,
    entryPoints: ['./index.ts'],
    outfile: 'dist/index.js',
  })
  .catch((err) => {
    // eslint-disable-next-line no-undef
    console.error('Build failed:', err);
    // eslint-disable-next-line no-undef
    process.exit(1);
  });
