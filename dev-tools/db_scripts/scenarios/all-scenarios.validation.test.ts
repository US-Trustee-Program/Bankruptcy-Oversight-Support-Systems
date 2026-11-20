/**
 * Data quality validation for every scenario the runner seeds.
 *
 * Scenarios are discovered the way the runner discovers them (every .ts file in this directory
 * that isn't a test), so a new scenario is validated without being registered here.
 *
 * Each scenario's operations go through validators.validateAllSeedOperations, the same check the
 * runner applies before seeding. See that function for the rules; in short:
 * - cases and transfer orders: DXTR linkage (dxtrId), debtor phoneticTokens and phone format,
 *   attorney phone and email format
 * - trustees: phoneticTokens, phone and email format
 * - trustee appointments: required fields and division codes
 * - trustee match verification: every recorded comparison is backed by data
 * - bankruptcy software: contact phone and email format
 * - notification routing: at least one recipient, each an email address
 *
 * A scenario must write at least one document the validator checks, so a scenario can't pass
 * here only because nothing it seeds is checked.
 */

import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { describe, test, expect, vi } from 'vitest';
import type { GeneratorScript, SeedContext } from '../../runner.js';
import { validators } from '../lib/test-data-utils.js';
import { sequentialCaseIds } from '../lib/scenario-test-doubles.js';

// No real DXTR connection. A non-empty recordset because dxtr-historical-trustees reads
// `nextSeq` from it; ensureDxtrCase then treats every case as already in DXTR, which doesn't
// matter here because the validator doesn't check DXTR rows.
vi.mock('mssql', async () =>
  (await import('../lib/scenario-test-doubles.js')).fakeMssqlModule([{ nextSeq: 1 }]),
);

const SCENARIOS_DIR = dirname(fileURLToPath(import.meta.url));
const SCENARIO_FILES = readdirSync(SCENARIOS_DIR).filter(
  (file) => file.endsWith('.ts') && !file.endsWith('.test.ts'),
);

function seedContext(): SeedContext {
  return {
    generateCaseId: sequentialCaseIds(),
    mongoClient: {
      db: () => ({ collection: () => ({ findOne: async () => null }) }),
    } as never,
  };
}

async function operationsFor(file: string) {
  const scenario = (await import(join(SCENARIOS_DIR, file))) as Partial<GeneratorScript>;
  expect(scenario.generate, `${file} must export generate()`).toBeTypeOf('function');
  return scenario.generate!(seedContext());
}

describe('Data Quality Validation (All Scenarios)', () => {
  test('finds the scenarios', () => {
    expect(SCENARIO_FILES).toContain('admin-data.ts');
    expect(SCENARIO_FILES).toContain('notification-routing.ts');
    expect(SCENARIO_FILES).not.toContain('scenarios.test.ts');
  });

  test.each(SCENARIO_FILES)('%s meets data quality standards', async (file) => {
    const ops = await operationsFor(file);

    const checked = ops.filter(
      (op) => validators.checksCollection(op.collectionOrTable) && op.data.length > 0,
    );
    expect(
      checked,
      `${file} writes nothing the validator checks; add a check for its collections`,
    ).not.toHaveLength(0);
    expect(validators.validateAllSeedOperations(ops)).toEqual([]);
  });
});
