#!/usr/bin/env node
/**
 * mutation-coverage.mjs
 *
 * Given a source file path (relative to common/src), shows every mutant in
 * that file alongside the tests that killed it (failing tests = proof) and
 * tests that only covered it (running but not failing = duplicate/weak tests).
 *
 * Usage:
 *   node mutation-coverage.mjs <src-file>
 *
 * Examples:
 *   node mutation-coverage.mjs src/feature-flags.ts
 *   node mutation-coverage.mjs src/cams/utilities.ts
 */

import { readFileSync } from 'fs';
import { resolve, join } from 'path';

const REPORT = resolve(import.meta.dirname, 'reports/mutation/mutation.json');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node mutation-coverage.mjs <src/file.ts>');
  process.exit(1);
}

const report = JSON.parse(readFileSync(REPORT, 'utf8'));

// Build a flat test ID -> name map across all test files
const testMap = {};
for (const [filePath, tf] of Object.entries(report.testFiles ?? {})) {
  for (const t of tf.tests ?? []) {
    testMap[t.id] = { name: t.name, file: filePath };
  }
}

// Find the matching source file (the report keys include full paths)
const targetKey = Object.keys(report.files).find(k => k.endsWith(arg.replace(/^src\//, '')));
if (!targetKey) {
  console.error(`File not found in report: ${arg}`);
  console.error('Available files:', Object.keys(report.files).join('\n  '));
  process.exit(1);
}

const fileData = report.files[targetKey];
const mutants = fileData.mutants;

// Group by status
const byStatus = { Killed: [], Survived: [], NoCoverage: [], Timeout: [], Ignored: [] };
for (const m of mutants) {
  (byStatus[m.status] ?? []).push(m);
}

const total = mutants.length;
const killed = byStatus.Killed.length;
const score = total ? ((killed / total) * 100).toFixed(1) : '0.0';

console.log(`\n${'═'.repeat(72)}`);
console.log(`  ${arg}`);
console.log(`  Mutation score: ${score}%  (${killed} killed / ${total} total)`);
console.log(`${'═'.repeat(72)}\n`);

// ── SURVIVED ────────────────────────────────────────────────────────────────
if (byStatus.Survived.length) {
  console.log(`SURVIVED (${byStatus.Survived.length}) — tests ran but none failed`);
  console.log('These are your weak/duplicate tests: the mutation went undetected.\n');

  for (const m of byStatus.Survived) {
    const loc = `${m.location.start.line}:${m.location.start.column}`;
    console.log(`  [${m.id}] ${m.mutatorName} @ line ${loc}`);
    console.log(`        Original → mutated: ${m.replacement}`);
    const covered = (m.coveredBy ?? []).map(id => testMap[id]);
    if (covered.length) {
      console.log(`        Tests that ran (but didn't fail):`);
      for (const t of covered) {
        console.log(`          • ${t?.name ?? id} (${t?.file ?? '?'})`);
      }
    } else {
      console.log(`        No tests ran against this mutant.`);
    }
    console.log();
  }
}

// ── NO COVERAGE ─────────────────────────────────────────────────────────────
if (byStatus.NoCoverage.length) {
  console.log(`NO COVERAGE (${byStatus.NoCoverage.length}) — zero tests reached this code`);
  console.log('These are plain gaps: no test exercises this path at all.\n');

  for (const m of byStatus.NoCoverage) {
    const loc = `${m.location.start.line}:${m.location.start.column}`;
    console.log(`  [${m.id}] ${m.mutatorName} @ line ${loc}: ${m.replacement}`);
  }
  console.log();
}

// ── KILLED ──────────────────────────────────────────────────────────────────
if (byStatus.Killed.length) {
  console.log(`KILLED (${byStatus.Killed.length}) — at least one test failed on the mutation ✓`);
  console.log('These tests are doing real work.\n');

  for (const m of byStatus.Killed) {
    const loc = `${m.location.start.line}:${m.location.start.column}`;
    const killers = (m.killedBy ?? []).map(id => testMap[id]);
    const killerNames = killers.map(t => t?.name ?? '?').join(', ');
    console.log(`  [${m.id}] ${m.mutatorName} @ line ${loc} → killed by: ${killerNames}`);
  }
  console.log();
}

// ── SUMMARY ─────────────────────────────────────────────────────────────────
console.log('─'.repeat(72));

// Build a test-level summary: how many mutants each test killed
const testKillCount = {};
const testCoverCount = {};
for (const m of mutants) {
  for (const id of m.killedBy ?? []) {
    testKillCount[id] = (testKillCount[id] ?? 0) + 1;
  }
  for (const id of m.coveredBy ?? []) {
    testCoverCount[id] = (testCoverCount[id] ?? 0) + 1;
  }
}

// Tests that cover but never kill = fully redundant for this file
const redundant = Object.keys(testCoverCount).filter(id => !testKillCount[id]);
if (redundant.length) {
  console.log(`\nREDUNDANT TESTS for ${arg} (cover but kill nothing):`);
  console.log('These tests are the most likely candidates for duplicate coverage.\n');
  for (const id of redundant) {
    const t = testMap[id];
    console.log(`  • ${t?.name ?? id}`);
    console.log(`    file: ${t?.file ?? '?'}`);
  }
  console.log();
}

console.log('Done.\n');
