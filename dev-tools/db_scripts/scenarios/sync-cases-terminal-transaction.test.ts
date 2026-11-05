import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SeedContext } from '../../runner.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Prevent ensureDxtrCase from opening a real SQL connection during tests.
// Returning an empty recordset tells the helper the case doesn't exist,
// so it always produces the expected AO_CS + AO_PY seed operations.
vi.mock('mssql', () => ({
  default: {
    ConnectionPool: class {
      async connect() {
        return {
          request: () => ({
            input: vi.fn().mockReturnThis(),
            query: vi.fn().mockResolvedValue({ recordset: [] }),
          }),
          close: vi.fn().mockResolvedValue(undefined),
        };
      }
    },
    VarChar: 'VarChar',
  },
}));

import { generate } from './sync-cases-terminal-transaction.js';

const mockContext: SeedContext = {
  generateCaseId: vi.fn(),
};

describe('sync-cases-terminal-transaction scenario', () => {
  test('returns exactly the DXTR operations: AO_CS, AO_PY, and AO_TX', async () => {
    const ops = await generate(mockContext);

    expect(ops.every((op) => op.db === 'dxtr')).toBe(true);
    expect(ops.map((op) => op.collectionOrTable).sort()).toEqual(['AO_CS', 'AO_PY', 'AO_TX']);
  });

  test('AO_CS row has CASE_ID and CS_CASEID as different values, and a past LAST_UPDATE_DATE', async () => {
    const ops = await generate(mockContext);
    const aoCs = ops.find((op) => op.collectionOrTable === 'AO_CS');

    expect(aoCs?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    const row = aoCs?.data[0] as Record<string, unknown>;
    expect(row.CS_CASEID).toBe('SEED98100');
    expect(row.CASE_ID).toBe('26-98100');
    expect(row.CS_CASEID).not.toBe(row.CASE_ID);
    expect(row.LAST_UPDATE_DATE).toEqual(new Date('2024-01-01'));
  });

  test('AO_TX row carries the same CS_CASEID/COURT_ID as AO_CS and a terminal transaction code', async () => {
    const ops = await generate(mockContext);
    const aoCs = ops.find((op) => op.collectionOrTable === 'AO_CS');
    const aoTx = ops.find((op) => op.collectionOrTable === 'AO_TX');

    expect(aoTx?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    expect(aoTx?.insertOnly).toBe(true);

    const csRow = aoCs?.data[0] as Record<string, unknown>;
    const txRow = aoTx?.data[0] as Record<string, unknown>;
    expect(txRow.CS_CASEID).toBe(csRow.CS_CASEID);
    expect(txRow.COURT_ID).toBe(csRow.COURT_ID);
    expect(txRow.CASE_ID).toBe(csRow.CASE_ID);
    expect(txRow.TX_TYPE).toBe('O');
    expect(['CBC', 'CDC', 'OCO', 'CTO']).toContain(txRow.TX_CODE);
    // Computed at seed time rather than fixed, so it stays after the real
    // transactionsStart watermark however far that's advanced (see the
    // module docstring); just assert it's recent, not an exact value.
    expect(Date.now() - (txRow.TX_DATE as Date).getTime()).toBeLessThan(60_000);
    expect(txRow.DE_SEQNO).toBeTypeOf('number');
    expect(txRow.JOB_ID).toBeTypeOf('number');
    expect(txRow).not.toHaveProperty('TX_ID');
    expect(typeof txRow.REC).toBe('string');
    expect((txRow.REC as string).length).toBe(237);
  });

  test('AO_TX.REC packs a numeric YYMMDD date at offset 19-24, matching TX_DATE', async () => {
    // dxtr.gateway.helper.ts's parseTransactionDate reads exactly this
    // substring; getCaseDetail throws ("non-numeric characters in the date
    // string") and the event lands in sync-cases-dlq if it isn't numeric —
    // confirmed by actually seeding this scenario before this assertion
    // existed and watching it fail that way in dev.
    const ops = await generate(mockContext);
    const aoTx = ops.find((op) => op.collectionOrTable === 'AO_TX');
    const txRow = aoTx?.data[0] as Record<string, unknown>;

    const rec = txRow.REC as string;
    const packedDate = rec.slice(19, 25);
    expect(packedDate).toMatch(/^\d{6}$/);

    const txDate = txRow.TX_DATE as Date;
    const expected =
      String(txDate.getUTCFullYear() % 100).padStart(2, '0') +
      String(txDate.getUTCMonth() + 1).padStart(2, '0') +
      String(txDate.getUTCDate()).padStart(2, '0');
    expect(packedDate).toBe(expected);
  });

  test('AO_TX transaction date is after the AO_CS LAST_UPDATE_DATE, matching the blind-spot scenario', async () => {
    const ops = await generate(mockContext);
    const aoCs = ops.find((op) => op.collectionOrTable === 'AO_CS');
    const aoTx = ops.find((op) => op.collectionOrTable === 'AO_TX');

    const csRow = aoCs?.data[0] as Record<string, unknown>;
    const txRow = aoTx?.data[0] as Record<string, unknown>;
    expect((txRow.TX_DATE as Date).getTime()).toBeGreaterThan(
      (csRow.LAST_UPDATE_DATE as Date).getTime(),
    );
  });
});
