import * as esbuild from 'esbuild';

const EXTERNAL = [
  '@azure/functions',
  'mssql',
];

esbuild
  .build({
    bundle: true,
    platform: 'node',
    target: 'node20',
    external: EXTERNAL,
    sourcemap: true,
    minify: false,
    format: 'cjs',
    logLevel: 'info',
    entryPoints: ['./index.ts'],
    outfile: 'dist/index.js',
    tsconfig: './tsconfig.json',
  })
  .catch((err) => {
    console.error('Build failed:', err);
    process.exit(1);
  });
