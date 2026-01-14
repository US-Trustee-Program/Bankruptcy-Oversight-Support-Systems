import * as esbuild from 'esbuild';
import { COMMON_BUILD_OPTIONS } from '../../esbuild-shared.mjs';

// Use single entry point to bundle all functions together
// This eliminates code duplication across multiple bundles
const entryPoints = ['index.ts'];

 
console.log('Building single bundle with all Azure Functions');

esbuild
  .build({
    ...COMMON_BUILD_OPTIONS,
    entryPoints,
    outdir: 'dist',
    outbase: '.',
  })
  .catch((err) => {
     
    console.error('Build failed:', err);
     
    process.exit(1);
  });
