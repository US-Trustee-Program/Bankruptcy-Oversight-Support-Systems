#!/usr/bin/env node
// Build a function app's production node_modules for packaging.
//
// WHY THIS EXISTS
// ---------------
// Azure Function apps (backend/function-apps/<app>) are deployed as a zip containing a
// bundled `dist/` plus a `node_modules/` holding only the dependencies esbuild leaves
// EXTERNAL (see backend/esbuild-shared.mjs). The function apps are deliberately NOT npm
// workspaces and have no lockfile of their own — npm workspaces support a single root
// lockfile only.
//
// The previous approach copied the app's package.json + the root lockfile into a temp dir
// and ran `npm ci --workspaces=false`, treating each app as a standalone root project. That
// only worked when npm happened to hoist the app's externals to the top level of the root
// install. npm's hoisting is not stable across npm versions or install sequences, so a
// routine dependency bump could (and did) move a package out of the top level and break the
// standalone `npm ci` with "Missing: <pkg> from lock file".
//
// WHAT THIS DOES INSTEAD
// ----------------------
// After a normal, workspace-aware install at the repo root (npm ci), every dependency the
// function app needs already exists — correctly resolved and at the locked version — inside
// the root node_modules tree. This script:
//   1. Reads the app's declared production dependencies as closure seeds.
//   2. Walks the production dependency graph encoded in package-lock.json (NOT Node's
//      resolver — the lockfile graph is authoritative and avoids exports-field /
//      trailing-slash resolution quirks that silently drop packages).
//   3. Copies each package in that closure from the root install into the destination
//      node_modules, preserving the exact (possibly nested) install layout so that, e.g.,
//      node_modules/mssql/node_modules/commander lands where Node will find it.
//
// The result is faithful to the lockfile, independent of hoisting, and needs no second
// lockfile and no standalone install.
//
// USAGE
//   node build-function-app-node-modules.mjs <app> <destNodeModulesDir>
// where <app> is "api" or "dataflows" and <destNodeModulesDir> is created/overwritten.

import { readFileSync, existsSync, cpSync, rmSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ---------------------------------------------------------------------------
// Pure closure logic (exported for unit testing; no filesystem access here).
// ---------------------------------------------------------------------------

// Resolve a dependency `dep` required by the package installed at lockfile path `fromPath`,
// against a lockfile `packages` map. npm resolution walks node_modules from the requiring
// package upward to the root, so we try fromPath/node_modules/dep first, then each ancestor,
// then the root node_modules. Returns the resolved lockfile key, or null if not present.
export function resolveDep(packages, fromPath, dep) {
  let base = fromPath;
  const candidates = [];
  while (true) {
    candidates.push(base ? `${base}/node_modules/${dep}` : `node_modules/${dep}`);
    const idx = base.lastIndexOf('/node_modules/');
    if (idx === -1) {
      if (base === '') break;
      base = ''; // a top-level workspace (e.g. "backend") falls back to the root
    } else {
      base = base.slice(0, idx);
    }
  }
  candidates.push(`node_modules/${dep}`); // ensure root is always considered
  for (const candidate of candidates) {
    if (packages[candidate]) return candidate;
  }
  return null;
}

// Compute the production dependency closure (a set of lockfile keys) reachable from `seeds`
// when those seeds are required by a package at `fromPrefix`. Walks production +
// optional dependencies. `unresolved` collects edges with no matching package (expected for
// optionalDependencies that are absent for the platform).
export function computeClosure(packages, seeds, fromPrefix, unresolved = []) {
  const closure = new Set();

  function walk(pkgPath) {
    const node = packages[pkgPath];
    if (!node) return;
    const deps = { ...(node.dependencies || {}), ...(node.optionalDependencies || {}) };
    for (const dep of Object.keys(deps)) {
      const resolved = resolveDep(packages, pkgPath, dep);
      if (!resolved) {
        unresolved.push(`${dep} (required by ${pkgPath})`);
        continue;
      }
      if (closure.has(resolved)) continue;
      closure.add(resolved);
      walk(resolved);
    }
  }

  for (const seed of seeds) {
    const resolved = resolveDep(packages, fromPrefix, seed);
    if (!resolved) {
      throw new Error(`Seed dependency "${seed}" not found in lockfile. Is the root install up to date?`);
    }
    if (!closure.has(resolved)) {
      closure.add(resolved);
      walk(resolved);
    }
  }
  return closure;
}

// Map a lockfile key to its slot inside the function app's flat node_modules. A lockfile key
// locates a package under some node_modules tree — rooted at the repo root
// ("node_modules/...") or under a workspace ("backend/node_modules/...") — and the package may
// itself be nested ("node_modules/mssql/node_modules/commander"). The app's node_modules needs
// everything AFTER the FIRST "node_modules/" segment, which strips any workspace prefix while
// preserving nesting:
//   node_modules/mssql/node_modules/commander -> mssql/node_modules/commander
//   backend/node_modules/mssql               -> mssql
export function installSlotFor(lockfileKey) {
  const firstNm = lockfileKey.indexOf('node_modules/');
  return lockfileKey.slice(firstNm + 'node_modules/'.length);
}

// ---------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------

// Only run the build when invoked directly (not when imported by a test).
const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedDirectly) {
  main();
}

function main() {
const app = process.argv[2];
const destDir = process.argv[3];

if (!app || !destDir) {
  console.error('Usage: node build-function-app-node-modules.mjs <app> <destNodeModulesDir>');
  process.exit(1);
}

// This script lives in backend/; the repo root is its parent.
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

const lockPath = path.join(REPO_ROOT, 'package-lock.json');
const appPjPath = path.join(REPO_ROOT, 'backend', 'function-apps', app, 'package.json');

if (!existsSync(lockPath)) {
  console.error(`Lockfile not found at ${lockPath}. Run "npm ci" at the repo root first.`);
  process.exit(1);
}
if (!existsSync(appPjPath)) {
  console.error(`Function app package.json not found at ${appPjPath}.`);
  process.exit(1);
}

const lock = JSON.parse(readFileSync(lockPath, 'utf8'));
const pkgs = lock.packages;
if (!pkgs) {
  console.error('Unsupported lockfile: expected a v2/v3 "packages" map.');
  process.exit(1);
}

const appPj = JSON.parse(readFileSync(appPjPath, 'utf8'));
const seeds = Object.keys(appPj.dependencies || {});

// The function app is not in the lockfile; it inherits dependency resolution from the
// "backend" workspace (whose lockfile node-prefix is "backend"). Resolve seeds as if they
// were required by a package installed at "backend".
const BACKEND_PREFIX = 'backend';

const unresolved = [];
let closure;
try {
  closure = computeClosure(pkgs, seeds, BACKEND_PREFIX, unresolved);
} catch (e) {
  console.error(e.message);
  process.exit(1);
}

// The destination must not be the root install we copy FROM — clearing it would delete the
// source mid-build. (pack.sh targets the function app's own node_modules; guard anyway.)
const rootNodeModules = path.join(REPO_ROOT, 'node_modules');
if (path.resolve(destDir) === rootNodeModules) {
  console.error(`Refusing to build into the root install at ${rootNodeModules}; choose a separate destination.`);
  process.exit(1);
}

// Copy each closure package, preserving its install-relative path. Exclude each package's
// own nested node_modules — those nested packages are themselves separate closure entries
// and are copied at their own paths, so excluding them here avoids copying anything twice.
rmSync(destDir, { recursive: true, force: true });
mkdirSync(destDir, { recursive: true });

let copied = 0;
const missing = [];
const destClaims = new Map(); // dest install-key -> source lockfile path (collision guard)
for (const rel of [...closure].sort()) {
  const src = path.join(REPO_ROOT, rel);
  if (!existsSync(src)) {
    missing.push(rel);
    continue;
  }
  const relInsideNodeModules = installSlotFor(rel);

  // Two different source paths must never flatten onto the same destination key — that would
  // mean the closure picked two different installs of the same package for one install slot,
  // which would silently ship the wrong version. Fail loudly instead.
  const claimed = destClaims.get(relInsideNodeModules);
  if (claimed && claimed !== rel) {
    console.error(`ERROR: closure maps two packages to the same slot "${relInsideNodeModules}":`);
    console.error(`  ${claimed}`);
    console.error(`  ${rel}`);
    process.exit(1);
  }
  destClaims.set(relInsideNodeModules, rel);

  const dest = path.join(destDir, relInsideNodeModules);
  cpSync(src, dest, {
    recursive: true,
    filter: (s) => {
      const r = path.relative(src, s);
      return !(r === 'node_modules' || r.startsWith('node_modules' + path.sep));
    },
  });
  copied++;
}

if (missing.length) {
  console.error(`ERROR: ${missing.length} closure package(s) missing from the root install:`);
  for (const m of missing.slice(0, 20)) console.error(`  ${m}`);
  console.error('Run "npm ci" at the repo root before packaging.');
  process.exit(1);
}

console.log(`Built ${app} node_modules: ${copied} package(s) into ${destDir}`);
if (unresolved.length) {
  // Optional/absent dependencies are expected; surface them at low volume for transparency.
  const unique = [...new Set(unresolved)];
  console.log(`Note: ${unique.length} optional/unresolved dependency edge(s) skipped (expected for optionalDependencies).`);
}
}
