/**
 * validate-eslint-rules.mjs
 *
 * Checks the project's ESLint configuration by reading a manifest of
 * representative file-path surfaces and asserting that each listed rule is
 * active (or inactive) at the expected severity on that surface.
 *
 * The manifest uses fictional paths with `_surface_` in the name — the files
 * do not need to exist on disk because ESLint's calculateConfigForFile()
 * resolves config purely from the path string.
 *
 * Usage:
 *   node dev-tools/validate-eslint-rules.mjs
 *   npm run lint:validate
 *
 * Exit codes:
 *   0 – all checks passed
 *   1 – one or more checks failed
 */

import { ESLint } from 'eslint';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'eslint-rule-manifest.json');

const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
const eslint = new ESLint({ cwd: projectRoot });

function normalizeSeverity(value) {
  if (value === undefined || value === null) return null;
  if (Array.isArray(value)) value = value[0];
  if (value === 'error') return 2;
  if (value === 'warn') return 1;
  if (value === 'off') return 0;
  return Number(value);
}

let passed = 0;
let failed = 0;

for (const surface of manifest) {
  const absolutePath = path.resolve(projectRoot, surface.path);
  const config = await eslint.calculateConfigForFile(absolutePath);
  const resolvedRules = config.rules ?? {};

  console.log(`\n[${surface.surface}] (${surface.path})`);

  for (const [ruleId, expected] of Object.entries(surface.rules)) {
    const raw = resolvedRules[ruleId];
    const actual = raw !== undefined ? normalizeSeverity(raw) : null;

    if (expected === null) {
      // Rule should be absent or off
      if (actual === null || actual === 0) {
        console.log(`  ✓ ${ruleId} — not active (correct)`);
        passed++;
      } else {
        console.error(`  ✗ ${ruleId} — expected absent/off, got severity ${actual}`);
        failed++;
      }
    } else {
      // Rule should be active at specific severity
      if (actual === expected) {
        const label = expected === 2 ? 'error' : expected === 1 ? 'warn' : 'off';
        console.log(`  ✓ ${ruleId} — ${label} (correct)`);
        passed++;
      } else {
        const expectedLabel = expected === 2 ? 'error' : expected === 1 ? 'warn' : 'off';
        const actualLabel = actual === null ? 'absent' : actual === 2 ? 'error' : actual === 1 ? 'warn' : 'off';
        console.error(`  ✗ ${ruleId} — expected ${expectedLabel}, got ${actualLabel}`);
        failed++;
      }
    }
  }
}

console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
