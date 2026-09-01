#!/usr/bin/env node
/**
 * Verify that all EXTERNAL dependencies used in function app bundles are properly
 * declared in each app's package.json.
 *
 * This is a lightweight check requiring only built bundles, not node_modules or pack operations.
 * Runs as a first-class CI job after esbuild.
 *
 * USAGE
 *   node backend/verify-bundle-externals.mjs
 *
 * EXIT CODES
 *   0 = All bundles valid (all externals declared)
 *   1 = One or more bundles have undeclared externals
 */

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { findUndeclaredBundledExternals } from './find-undeclared-bundled-externals.mjs';
import { EXTERNAL_DEPENDENCIES } from './esbuild-shared.mjs';

const SCRIPT_DIR = import.meta.url.slice('file://'.length, import.meta.url.lastIndexOf('/'));
const BACKEND_DIR = path.resolve(SCRIPT_DIR);

const APP_CONFIGS = [
  {
    name: 'api',
    appDir: 'function-apps/api',
  },
  {
    name: 'dataflows',
    appDir: 'function-apps/dataflows',
  },
];

let totalFailures = 0;

for (const { name, appDir } of APP_CONFIGS) {
  const fullAppDir = path.join(BACKEND_DIR, appDir);
  const pjPath = path.join(fullAppDir, 'package.json');

  if (!existsSync(pjPath)) {
    console.error(`[${name}] No package.json found at ${pjPath}`);
    totalFailures++;
    continue;
  }

  const pj = JSON.parse(readFileSync(pjPath, 'utf8'));
  const mainField = pj.main ?? 'dist/index.js';
  const bundlePath = path.join(fullAppDir, mainField);

  if (!existsSync(bundlePath)) {
    console.error(
      `[${name}] Bundle file not found at ${mainField} (app must be built first).\n` +
        `        Please run: npm run build:backend`,
    );
    totalFailures++;
    continue;
  }

  const declaredDeps = [
    ...Object.keys(pj.dependencies || {}),
    ...Object.keys(pj.peerDependencies || {}),
  ];

  const bundleSource = readFileSync(bundlePath, 'utf8');
  const undeclaredExternals = findUndeclaredBundledExternals({
    bundleSource,
    externalDependencies: EXTERNAL_DEPENDENCIES,
    declaredDependencies: declaredDeps,
  });

  if (undeclaredExternals.length === 0) {
    console.log(`[${name}] OK: Bundle declares all external dependencies`);
  } else {
    console.error(
      `[${name}] FAIL: External dependencies appear in bundle but not declared in package.json:`,
    );
    for (const spec of undeclaredExternals) {
      console.error(`        - ${spec}`);
    }
    totalFailures++;
  }
}

if (totalFailures > 0) {
  console.error(`\nBundle dependency verification FAILED (${totalFailures} app(s)).`);
  process.exit(1);
}

console.log('\nBundle dependency verification passed: all apps declare their externals.');
