/**
 * Test doubles shared by the scenario test suites. Lives in lib/ (not scenarios/) because the
 * runner treats every .ts file in scenarios/ as a scenario to seed.
 */

import { vi } from 'vitest';
import type { GeneratedCaseId } from '../../runner.js';

/**
 * A stand-in for the `mssql` module, for `vi.mock('mssql', ...)`, so scenarios never open a
 * real DXTR connection. Every query returns `recordset`. ensureDxtrCase reads an empty
 * recordset as "case not in DXTR" (it returns AO_CS + AO_PY seed operations) and a non-empty
 * one as "case already in DXTR" (it returns none).
 */
export function fakeMssqlModule(recordset: Record<string, unknown>[]) {
  class ConnectionPool {
    async connect() {
      return this;
    }
    request() {
      const request = {
        input: vi.fn(() => request),
        query: vi.fn(async () => ({ recordset })),
      };
      return request;
    }
    async close() {}
  }
  return { default: { ConnectionPool, VarChar: 'VarChar', Int: 'Int' } };
}

/**
 * A generateCaseId that gives each call a new case, like the runner's, so scenarios that create
 * many cases get distinct ids.
 */
export function sequentialCaseIds(firstSequence = 90100) {
  let sequence = firstSequence;
  return async (divisionCode: string): Promise<GeneratedCaseId> => {
    const number = sequence++;
    return {
      caseId: `${divisionCode}-26-${number}`,
      caseNumber: `26-${number}`,
      csCaseId: `SEED${number}`,
    };
  };
}
