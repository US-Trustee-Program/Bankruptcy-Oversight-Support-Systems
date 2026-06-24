#!/usr/bin/env node
// Verify a packaged function app's node_modules can actually load every dependency the
// bundled code requires at runtime — a build-time gate against an incomplete closure.
//
// esbuild leaves a fixed set of dependencies EXTERNAL (backend/esbuild-shared.mjs); those,
// plus everything they require transitively (including lazily-required submodules such as
// mssql's tedious driver), must be present and resolvable in the packaged node_modules.
// A package-count check is not enough — a subtly missed transitive dep can pass a count
// check yet throw "Cannot find module" only when the relevant code path runs. So this
// probe performs real require() calls from the perspective of the function app directory.
//
// The deployed zip contains ONLY the app's own node_modules (Azure has no ancestor
// node_modules to fall back on). When packaging locally or in CI, however, ancestor
// node_modules DO exist (backend/, repo root), so a require() could be satisfied from an
// ancestor and mask a package missing from the app tree. To catch that, each top-level
// external is required AND asserted to resolve from inside the app's own node_modules.
//
// USAGE
//   node verify-function-app-node-modules.mjs <appDir>
// where <appDir> contains the built node_modules (i.e. <appDir>/node_modules exists).

import { createRequire } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const appDirArg = process.argv[2];
if (!appDirArg) {
  console.error('Usage: node verify-function-app-node-modules.mjs <appDir>');
  process.exit(1);
}
// createRequire requires an absolute base path; callers may pass a relative appDir.
const appDir = path.resolve(appDirArg);
const nmDir = path.join(appDir, 'node_modules');
if (!existsSync(nmDir)) {
  console.error(`No node_modules found at ${nmDir}.`);
  process.exit(1);
}

// Probe the app's own declared dependencies (its esbuild externals) — not a fixed union
// across apps, which would flag a package legitimately absent from one app's closure.
const appPjPath = path.join(appDir, 'package.json');
if (!existsSync(appPjPath)) {
  console.error(`No package.json found at ${appPjPath}.`);
  process.exit(1);
}
const appDeps = Object.keys(JSON.parse(readFileSync(appPjPath, 'utf8')).dependencies || {});

// Extra deep-load probes for declared deps that lazily require a driver only when a specific
// code path runs — a plain top-level require of the package would not surface a missing driver.
const DEEP_PROBES = {
  mssql: ['mssql/lib/tedious/connection-pool.js'], // forces mssql -> tedious lazy load
};

const PROBES = [];
for (const dep of appDeps) {
  PROBES.push(dep);
  if (DEEP_PROBES[dep]) PROBES.push(...DEEP_PROBES[dep]);
}

// Resolve as if from a module sitting in the function app directory.
const require = createRequire(path.join(appDir, 'verify-probe.cjs'));

const nmDirReal = path.resolve(nmDir);

let failures = 0;
for (const spec of PROBES) {
  let resolved;
  try {
    resolved = require.resolve(spec);
  } catch (e) {
    // Every probe is a declared app dependency (or its driver), so a resolve failure is real.
    console.error(`  FAIL  ${spec} -> ${String(e.message).split('\n')[0]}`);
    failures++;
    continue;
  }
  // The resolved file must live inside the app's own node_modules, not an ancestor's — a
  // fall-through to an ancestor would pass here but fail in the ancestor-less deployed zip.
  if (!path.resolve(resolved).startsWith(nmDirReal + path.sep)) {
    console.error(`  FAIL  ${spec} -> resolved outside app node_modules: ${resolved}`);
    failures++;
    continue;
  }
  try {
    require(spec);
    console.log(`  ok    ${spec}`);
  } catch (e) {
    console.error(`  FAIL  ${spec} -> ${String(e.message).split('\n')[0]}`);
    failures++;
  }
}

if (failures) {
  console.error(`\nnode_modules verification FAILED: ${failures} module(s) could not be loaded.`);
  process.exit(1);
}
console.log('\nnode_modules verification passed: all runtime dependencies load.');
