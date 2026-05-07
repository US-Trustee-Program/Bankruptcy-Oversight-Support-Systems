#!/usr/bin/env node
/**
 * mutation-cross-module.mjs
 *
 * Aggregates mutation reports from all three packages to show which common/src
 * files are tested by multiple packages, and whether those cross-package tests
 * add unique kill coverage or are redundant.
 *
 * Reports to read (generate with npm scripts in each package first):
 *   common/reports/mutation/mutation.json          (common's own tests)
 *   backend/reports/mutation/common-via-backend.json
 *   user-interface/reports/mutation/common-via-ui.json
 *
 * Usage:
 *   node mutation-cross-module.mjs
 *   node mutation-cross-module.mjs --min-packages=2   (default)
 *   node mutation-cross-module.mjs --show-all          (include single-package files)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname);
const showAll = process.argv.includes('--show-all');
const minPackages = parseInt(process.argv.find(a => a.startsWith('--min-packages='))?.split('=')[1] ?? '2', 10);

const REPORTS = [
  { pkg: 'common',         path: 'common/reports/mutation/mutation.json' },
  { pkg: 'backend',        path: 'backend/reports/mutation/common-via-backend.json' },
  { pkg: 'user-interface', path: 'user-interface/reports/mutation/common-via-ui.json' },
];

// Load available reports
const loaded = [];
for (const r of REPORTS) {
  const full = resolve(ROOT, r.path);
  if (!existsSync(full)) {
    console.warn(`⚠ Missing report (run the corresponding mutate script first): ${r.path}`);
    continue;
  }
  const data = JSON.parse(readFileSync(full, 'utf8'));
  loaded.push({ ...r, data });
}

if (loaded.length < 2) {
  console.error('\nNeed at least 2 reports to compare. Generate missing reports first:\n');
  console.error('  cd common && npm run mutate');
  console.error('  cd .. && NODE_OPTIONS="--max-old-space-size=8192" npx stryker run backend/stryker.common.config.mjs');
  console.error('  NODE_OPTIONS="--max-old-space-size=8192" npx stryker run user-interface/stryker.common.config.mjs');
  process.exit(1);
}

// For each report, build: normalizedSrcFile -> { mutantId -> { status, killedBy: [testNames], coveredBy: [testNames] } }
function buildMutantMap(report) {
  // Build test ID -> test name map
  const testNameMap = {};
  for (const [file, tf] of Object.entries(report.testFiles ?? {})) {
    for (const t of tf.tests ?? []) {
      testNameMap[t.id] = t.name;
    }
  }

  const map = {}; // normalizedPath -> { mutantId -> mutantInfo }
  for (const [filePath, fd] of Object.entries(report.files)) {
    // Normalize to common/src/<rest> regardless of how the report was generated.
    // common's own report uses  "src/foo.ts"
    // backend/UI cross reports use "common/src/foo.ts"
    let normalized;
    if (filePath.startsWith('common/src/')) {
      normalized = filePath;
    } else if (filePath.match(/(?:^|\/)src\//)) {
      // strip everything up to and including the first src/
      const rest = filePath.replace(/^.*?src\//, '');
      normalized = 'common/src/' + rest;
    } else {
      continue;
    }

    map[normalized] = {};
    for (const m of fd.mutants) {
      map[normalized][m.id] = {
        status: m.status,
        mutatorName: m.mutatorName,
        replacement: m.replacement,
        location: m.location,
        killedBy: (m.killedBy ?? []).map(id => testNameMap[id] ?? id),
        coveredBy: (m.coveredBy ?? []).map(id => testNameMap[id] ?? id),
      };
    }
  }
  return map;
}

const packageMaps = loaded.map(r => ({ pkg: r.pkg, mutantMap: buildMutantMap(r.data) }));

// Collect all normalized common/src file paths across all reports
const allFiles = new Set();
for (const { mutantMap } of packageMaps) {
  for (const f of Object.keys(mutantMap)) allFiles.add(f);
}

// For each source file, build per-package kill/cover sets
const results = [];
for (const srcFile of [...allFiles].sort()) {
  const pkgStats = [];

  for (const { pkg, mutantMap } of packageMaps) {
    const mutants = mutantMap[srcFile];
    if (!mutants) continue;

    const killed = new Set(Object.entries(mutants).filter(([,m]) => m.status === 'Killed').map(([id]) => id));
    const covered = new Set(Object.entries(mutants).filter(([,m]) => m.coveredBy.length > 0).map(([id]) => id));
    const survived = new Set(Object.entries(mutants).filter(([,m]) => m.status === 'Survived').map(([id]) => id));
    const noCoverage = new Set(Object.entries(mutants).filter(([,m]) => m.status === 'NoCoverage').map(([id]) => id));

    pkgStats.push({ pkg, killed, covered, survived, noCoverage, mutants });
  }

  if (pkgStats.length < (showAll ? 1 : minPackages)) continue;

  // Find mutants killed by each package but NOT by the others (unique kills)
  const uniqueKillsPerPkg = {};
  for (const ps of pkgStats) {
    const otherKills = new Set(
      pkgStats.filter(o => o.pkg !== ps.pkg).flatMap(o => [...o.killed])
    );
    uniqueKillsPerPkg[ps.pkg] = new Set([...ps.killed].filter(id => !otherKills.has(id)));
  }

  // Overlap kills: killed by 2+ packages
  const allKilled = pkgStats.flatMap(ps => [...ps.killed]);
  const killCount = {};
  for (const id of allKilled) killCount[id] = (killCount[id] ?? 0) + 1;
  const overlapKills = new Set(Object.entries(killCount).filter(([,c]) => c > 1).map(([id]) => id));

  // Fully redundant package: kills things, but all of those are also killed by another package
  const enriched = pkgStats.map(ps => {
    const total = Object.keys(ps.mutants).length;
    return {
      ...ps,
      uniqueKills: uniqueKillsPerPkg[ps.pkg],
      overlapKills: new Set([...ps.killed].filter(id => overlapKills.has(id))),
      isFullyRedundant: ps.killed.size > 0 && uniqueKillsPerPkg[ps.pkg].size === 0,
      isPureWatcher: ps.killed.size === 0 && ps.covered.size > 0,
      totalMutants: total,
      score: total ? ((ps.killed.size / total) * 100).toFixed(1) : '0.0',
    };
  });

  results.push({ srcFile, pkgStats: enriched });
}

// ── REPORT ──────────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(80)}`);
console.log(`  CROSS-MODULE MUTATION OVERLAP REPORT`);
console.log(`  common/src files covered by ${minPackages}+ packages: ${results.length}`);
console.log(`  Reports loaded: ${loaded.map(r => r.pkg).join(', ')}`);
console.log(`${'═'.repeat(80)}\n`);

let totalRedundant = 0;
let totalPureWatchers = 0;

for (const { srcFile, pkgStats } of results) {
  // Headline: mutation score per package
  const scoreLine = pkgStats.map(ps => `${ps.pkg}: ${ps.score}%`).join('  |  ');
  console.log(`SOURCE: ${srcFile}`);
  console.log(`        ${scoreLine}`);
  console.log(`${'─'.repeat(80)}`);

  for (const ps of pkgStats.sort((a, b) => b.killed.size - a.killed.size)) {
    const flags = [];
    if (ps.isFullyRedundant) { flags.push('⚠ FULLY REDUNDANT'); totalRedundant++; }
    if (ps.isPureWatcher)    { flags.push('⚠ COVERS BUT KILLS NOTHING'); totalPureWatchers++; }
    const flagStr = flags.length ? `  ${flags.join(', ')}` : '';

    console.log(`  [${ps.pkg}]${flagStr}`);
    console.log(`    killed: ${ps.killed.size}  (${ps.uniqueKills.size} unique, ${ps.overlapKills.size} also killed by another pkg)  |  covers-only: ${ps.covered.size - ps.killed.size}  |  no-cov: ${ps.noCoverage.size}`);
  }

  // Show what unique kill breakdown reveals
  const anyUnique = pkgStats.some(ps => ps.uniqueKills.size > 0);
  const anyOverlap = pkgStats.some(ps => ps.overlapKills.size > 0);
  if (anyOverlap && anyUnique) {
    console.log(`  → Overlap: some mutants killed by multiple packages (redundant test effort)`);
  } else if (!anyOverlap && anyUnique) {
    console.log(`  → No overlap: each package kills distinct mutants (complementary coverage)`);
  } else if (!anyUnique) {
    console.log(`  → All kills overlapping: packages are fully redundant for this file`);
  }
  console.log();
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
console.log(`${'═'.repeat(80)}`);
console.log(`  SUMMARY`);
console.log(`${'─'.repeat(80)}`);
console.log(`  common/src files covered by ${minPackages}+ packages: ${results.length}`);
console.log(`  Package instances that are FULLY REDUNDANT: ${totalRedundant}`);
console.log(`  Package instances that COVER BUT KILL NOTHING: ${totalPureWatchers}`);
console.log();
console.log(`  Packages available: ${loaded.map(r => r.pkg).join(', ')}`);
if (loaded.length < REPORTS.length) {
  console.log(`  ⚠ Missing packages: ${REPORTS.filter(r => !loaded.find(l => l.pkg === r.pkg)).map(r => r.pkg).join(', ')}`);
  console.log(`    Run their stryker configs to get full cross-module picture.`);
}
console.log(`${'═'.repeat(80)}\n`);
