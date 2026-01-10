import * as fs from 'fs';
import * as path from 'path';

/**
 * External dependencies that should not be bundled by esbuild.
 * These are copied manually during the pack step.
 */
export const EXTERNAL_DEPENDENCIES = [
  // All third-party packages - let Azure install them on Linux during deployment
  // This avoids platform-specific binary issues with native modules
  '@azure/functions',
  'mssql',
  'mongodb',
  'applicationinsights',
  'dotenv',
  'express',
  // Only our own code (@common via path aliases) will be bundled
];

/**
 * Common esbuild options shared across all function apps.
 */
export const COMMON_BUILD_OPTIONS = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  external: EXTERNAL_DEPENDENCIES,
  sourcemap: true,
  minify: false,
  format: 'cjs',
  logLevel: 'info',
};

/**
 * Find all *.function.ts files recursively from the current directory.
 * @returns {string[]} Array of entry point file paths
 */
export function findFunctionEntryPoints() {
  const entryPoints = [];
  const walkDir = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory() && file !== 'node_modules' && file !== 'dist') {
        walkDir(filePath);
      } else if (file.endsWith('.function.ts')) {
        entryPoints.push(filePath);
      }
    }
  };

  walkDir('.');
  return entryPoints;
}
