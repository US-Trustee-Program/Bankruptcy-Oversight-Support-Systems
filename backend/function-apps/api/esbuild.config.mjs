import * as esbuild from 'esbuild';
import { COMMON_BUILD_OPTIONS, findFunctionEntryPoints } from '../../esbuild-shared.mjs';

const functionEntryPoints = findFunctionEntryPoints();
// Add index.ts as an entry point to load all functions
const entryPoints = [...functionEntryPoints, './index.ts'];

// eslint-disable-next-line no-undef
console.log(`Found ${functionEntryPoints.length} Azure Functions to bundle (+ index.ts loader)`);

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
