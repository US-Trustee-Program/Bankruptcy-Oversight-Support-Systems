/**
 * Data quality validation for every scenario the runner seeds.
 *
 * Scenarios are found with discoverScenarioScripts, the same function the runner uses, so a new
 * scenario is validated without being registered here.
 *
 * Each scenario's operations go through validators.checkSeedOperations, the check the runner
 * applies before seeding. See its DOCUMENT_CHECKS table for the rules; in short:
 * - cases and transfer orders: DXTR linkage (dxtrId), debtor phoneticTokens and phone format,
 *   attorney phone and email format
 * - trustees: phoneticTokens, phone and email format
 * - trustee appointments: required fields and division codes
 * - trustee match verification: every recorded comparison is backed by data
 * - bankruptcy software: contact phone and email format
 * - notification routing: at least one recipient, each an email address
 *
 * A scenario must write at least one document the validator actually checked (not just one in a
 * checked collection), so a scenario can't pass here only because nothing it seeds is checked.
 *
 * The fake DXTR reports every case as already present, so this suite runs only that branch of each
 * generator. scenarios.test.ts and ensure-dxtr-case.test.ts cover the "not yet in DXTR" branch.
 */

import { basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { faker } from '@faker-js/faker';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { GeneratorScript, SeedContext } from '../../runner.js';
import { discoverScenarioScripts } from '../lib/discover-scripts.js';
import { validators } from '../lib/test-data-utils.js';
import { sequentialCaseIds } from '../lib/scenario-test-doubles.js';

// No real DXTR connection. A non-empty recordset because dxtr-historical-trustees reads
// `nextSeq` from it; ensureDxtrCase then treats every case as already in DXTR, which doesn't
// matter here because the validator doesn't check DXTR rows.
vi.mock('mssql', async () =>
  (await import('../lib/scenario-test-doubles.js')).fakeMssqlModule([{ nextSeq: 1 }]),
);

const SCENARIO_PATHS = discoverScenarioScripts(dirname(fileURLToPath(import.meta.url)));

function seedContext(): SeedContext {
  return {
    generateCaseId: sequentialCaseIds(),
    mongoClient: {
      db: () => ({ collection: () => ({ findOne: async () => null }) }),
    } as never,
  };
}

async function operationsFor(path: string) {
  const scenario = (await import(path)) as Partial<GeneratorScript>;
  expect(scenario.generate, `${basename(path)} must export generate()`).toBeTypeOf('function');
  return scenario.generate!(seedContext());
}

describe('Data Quality Validation (All Scenarios)', () => {
  beforeEach(() => {
    // Generators use faker; a fixed seed keeps a future faker-built field from failing at random.
    faker.seed(940);
    // Generators log progress and warnings; keep the test output to the results.
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  test('finds scenarios to validate', () => {
    // Guards test.each below, which would pass with no cases at all.
    expect(SCENARIO_PATHS.length).toBeGreaterThan(0);
  });

  test.each(SCENARIO_PATHS.map((path) => [basename(path), path]))(
    '%s meets data quality standards',
    async (file, path) => {
      const { errors, checkedCount } = validators.checkSeedOperations(await operationsFor(path));

      expect(
        checkedCount,
        `${file} writes nothing the validator checks; add its documents to DOCUMENT_CHECKS`,
      ).toBeGreaterThan(0);
      expect(errors).toEqual([]);
    },
  );
});
