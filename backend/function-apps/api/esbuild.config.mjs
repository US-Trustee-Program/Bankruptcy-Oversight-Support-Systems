import * as esbuild from 'esbuild';
import { COMMON_BUILD_OPTIONS, findFunctionEntryPoints } from '../../esbuild-shared.mjs';

const entryPoints = findFunctionEntryPoints();

// eslint-disable-next-line no-undef
console.log(`Found ${entryPoints.length} Azure Functions to bundle`);

esbuild
  .build({
    ...COMMON_BUILD_OPTIONS,
    entryPoints,
    outdir: 'dist',
    outbase: '.',
  })
  .catch((err) => {
    // eslint-disable-next-line no-undef
    console.error('Build failed:', err);
    // eslint-disable-next-line no-undef
    process.exit(1);
  });
