#!/usr/bin/env node
/**
 * mutation-overlap.mjs
 *
 * Reports which source files are covered by multiple test files, and for
 * each overlap whether the extra test files are adding real value (killing
 * unique mutants) or just duplicating what another test file already covers.
 *
 * Usage:
 *   node mutation-overlap.mjs [--min-files=2]
 *
 * Options:
 *   --min-files=N   Only show source files covered by at least N test files (default: 2)
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const REPORT = resolve(import.meta.dirname, 'reports/mutation/mutation.json');
const minFiles = parseInt(process.argv.find(a => a.startsWith('--min-files='))?.split('=')[1] ?? '2', 10);

const data = JSON.parse(readFileSync(REPORT, 'utf8'));

// Build maps: test ID -> { name, file }
const testById = {};
for (const [file, tf] of Object.entries(data.testFiles ?? {})) {
  for (const t of tf.tests ?? []) {
    testById[t.id] = { name: t.name, file };
  }
}

// For each source file, compute per-test-file kill and cover counts
const rows = [];

for (const [src, fd] of Object.entries(data.files)) {
  // Per test file: how many mutants it kills vs only covers
  const killsByFile = {};   // testFile -> Set of mutant IDs it kills
  const coversByFile = {};  // testFile -> Set of mutant IDs it covers (but doesn't kill)

  for (const m of fd.mutants) {
    const killedByFiles = new Set((m.killedBy ?? []).map(id => testById[id]?.file).filter(Boolean));
    const coveredByFiles = new Set((m.coveredBy ?? []).map(id => testById[id]?.file).filter(Boolean));

    for (const f of killedByFiles) {
      (killsByFile[f] ??= new Set()).add(m.id);
    }
    for (const f of coveredByFiles) {
      if (!killedByFiles.has(f)) {
        (coversByFile[f] ??= new Set()).add(m.id);
      }
    }
  }

  const allFiles = new Set([...Object.keys(killsByFile), ...Object.keys(coversByFile)]);
  if (allFiles.size < minFiles) continue;

  // For each mutant, which test files uniquely kill it (not killed by any other file)?
  // A test file is "redundant" if every mutant it kills is also killed by another file.
  const mutantKillers = {}; // mutantId -> Set of test files that kill it
  for (const m of fd.mutants) {
    const killedByFiles = new Set((m.killedBy ?? []).map(id => testById[id]?.file).filter(Boolean));
    if (killedByFiles.size) mutantKillers[m.id] = killedByFiles;
  }

  const fileStats = [];
  for (const f of [...allFiles].sort()) {
    const kills = killsByFile[f] ?? new Set();
    const covers = coversByFile[f] ?? new Set();

    // Unique kills: mutants this file kills that no other file kills
    const uniqueKills = [...kills].filter(mid => {
      const killers = mutantKillers[mid];
      return killers && killers.size === 1 && killers.has(f);
    });

    // Overlap kills: mutants this file kills that are ALSO killed by another file
    const overlapKills = [...kills].filter(mid => {
      const killers = mutantKillers[mid];
      return killers && killers.size > 1;
    });

    fileStats.push({
      file: f,
      kills: kills.size,
      uniqueKills: uniqueKills.length,
      overlapKills: overlapKills.length,
      coversOnly: covers.size,
      isFullyRedundant: kills.size > 0 && uniqueKills.length === 0,
      isPureWatcher: kills.size === 0 && covers.size > 0,
    });
  }

  rows.push({ src, fileStats });
}

if (!rows.length) {
  console.log(`No source files covered by ${minFiles}+ test files.`);
  process.exit(0);
}

// ── REPORT ──────────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(80)}`);
console.log(`  MUTATION OVERLAP REPORT`);
console.log(`  Source files covered by ${minFiles}+ test files: ${rows.length}`);
console.log(`${'═'.repeat(80)}\n`);

let fullyRedundantCount = 0;
let pureWatcherCount = 0;

for (const { src, fileStats } of rows.sort((a, b) => b.fileStats.length - a.fileStats.length)) {
  console.log(`SOURCE: ${src}`);
  console.log(`${'─'.repeat(80)}`);

  for (const s of fileStats.sort((a, b) => b.kills - a.kills)) {
    const flags = [];
    if (s.isFullyRedundant) { flags.push('⚠ FULLY REDUNDANT'); fullyRedundantCount++; }
    if (s.isPureWatcher)    { flags.push('⚠ COVERS BUT KILLS NOTHING'); pureWatcherCount++; }
    const flagStr = flags.length ? `  ${flags.join(', ')}` : '';

    console.log(`  ${s.file}${flagStr}`);
    console.log(`    kills: ${s.kills}  (${s.uniqueKills} unique to this file, ${s.overlapKills} also killed elsewhere)  |  covers-only: ${s.coversOnly}`);
  }
  console.log();
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
console.log(`${'═'.repeat(80)}`);
console.log(`  SUMMARY`);
console.log(`${'─'.repeat(80)}`);
console.log(`  Source files with multi-file coverage: ${rows.length}`);
console.log(`  Test file instances that are FULLY REDUNDANT (kill nothing unique): ${fullyRedundantCount}`);
console.log(`  Test file instances that COVER BUT KILL NOTHING: ${pureWatcherCount}`);
console.log();
console.log(`  A "fully redundant" test file for a source file means every mutation`);
console.log(`  that file catches is also caught by another test file. You could remove`);
console.log(`  those tests without losing any mutation coverage.`);
console.log();
console.log(`  A "covers but kills nothing" file runs against the source but never`);
console.log(`  fails — those tests add zero behavioral assurance for that source file.`);
console.log(`${'═'.repeat(80)}\n`);
