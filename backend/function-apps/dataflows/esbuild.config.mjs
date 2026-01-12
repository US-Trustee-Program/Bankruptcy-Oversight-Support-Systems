import * as esbuild from 'esbuild';
import { COMMON_BUILD_OPTIONS } from '../../esbuild-shared.mjs';

esbuild
  .build({
    ...COMMON_BUILD_OPTIONS,
    entryPoints: ['./dataflows.ts'],
    outfile: 'dist/dataflows.js',
  })
  .catch((err) => {
    // eslint-disable-next-line no-undef
    console.error('Build failed:', err);
    // eslint-disable-next-line no-undef
    process.exit(1);
  });
