import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SeedContext, SeedOperation } from '../../runner.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Prevent ensureDxtrCase from opening a real SQL connection. An empty recordset tells it the
// cases don't exist yet, so it emits AO_CS + debtor AO_PY operations (same pattern as
// ust-division-tn-eastern.test.ts).
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

import { generate } from './trustee-match-tn-split-divisions.js';

const mockContext: SeedContext = {
  generateCaseId: vi.fn(),
};

function rows(ops: SeedOperation[], collectionOrTable: string): Record<string, unknown>[] {
  return ops.filter((op) => op.collectionOrTable === collectionOrTable).flatMap((op) => op.data);
}

const PAIRS = [
  {
    caseId: '491-26-99604',
    csCaseId: 'SEED99604',
    caseDivision: '494',
    trusteeId: 'seed-trustee-tn-split-chattanooga',
    trusteeDivision: '491',
    // Freshly synced after the CAMS-936 Phase 1 deploy — see plan.md.
    usesTempCourtDivisionCode: true,
  },
  {
    caseId: '492-26-99605',
    csCaseId: 'SEED99605',
    caseDivision: '495',
    trusteeId: 'seed-trustee-tn-split-greeneville',
    trusteeDivision: '492',
    // Pre-existing, not yet migrated — see plan.md.
    usesTempCourtDivisionCode: false,
  },
];

describe('trustee-match-tn-split-divisions scenario', () => {
  test.each(PAIRS)(
    '$caseId: case in $caseDivision, trustee appointed only in $trusteeDivision',
    async ({
      caseId,
      csCaseId,
      caseDivision,
      trusteeId,
      trusteeDivision,
      usesTempCourtDivisionCode,
    }) => {
      const ops = await generate(mockContext);

      const dxtrCase = rows(ops, 'AO_CS').find((r) => r.CS_CASEID === csCaseId);
      expect(dxtrCase?.CS_DIV).toBe(caseDivision);

      const syncedCase = rows(ops, 'cases').find((r) => r.caseId === caseId);
      const [expectedTemp, expectedUst] = usesTempCourtDivisionCode
        ? [caseDivision, undefined]
        : [undefined, caseDivision];
      expect(syncedCase?.tempCourtDivisionCode).toBe(expectedTemp);
      expect(syncedCase?.ustDivisionCode).toBe(expectedUst);
      expect(syncedCase?.courtDivisionCode).toBe(trusteeDivision);

      const appointments = rows(ops, 'trustee-appointments').filter(
        (r) => r.trusteeId === trusteeId,
      );
      expect(appointments).toHaveLength(1);
      expect(appointments[0].status).toBe('active');
      expect(appointments[0].divisionCodes).toEqual([trusteeDivision]);
    },
  );

  test.each(PAIRS)(
    '$caseId: DXTR trustee party matches the CAMS trustee by exact name and contact',
    async ({ csCaseId, trusteeId }) => {
      const ops = await generate(mockContext);

      const party = rows(ops, 'AO_PY').find((r) => r.CS_CASEID === csCaseId && r.PY_ROLE === 'tr')!;
      const trustee = rows(ops, 'trustees').find((r) => r.trusteeId === trusteeId) as {
        name: string;
        public: {
          address: { address1: string; zipCode: string };
          phone: { number: string };
          email: string;
        };
      };

      expect(`${party.PY_FIRST_NAME} ${party.PY_LAST_NAME}`).toBe(trustee.name);
      expect(party.PY_ADDRESS1).toBe(trustee.public.address.address1);
      expect(party.PY_ZIP).toBe(trustee.public.address.zipCode);
      expect(party.PY_PHONENO).toBe(trustee.public.phone.number);
      expect(party.PY_E_MAIL).toBe(trustee.public.email);
    },
  );

  test.each(PAIRS)(
    '$caseId: trustee-appointed transaction carries the appointment date where the sync reads it',
    async ({ csCaseId }) => {
      const ops = await generate(mockContext);

      const tx = rows(ops, 'AO_TX').find((r) => r.CS_CASEID === csCaseId)!;
      expect(tx.TX_TYPE).toBe('A');
      expect(tx.TX_CODE).toBe('TR');

      const txDate = tx.TX_DATE as Date;
      const expectedYymmdd = txDate.toISOString().slice(2, 10).replace(/-/g, '');
      // SQL SUBSTRING(REC, 24, 6) is 1-indexed.
      expect((tx.REC as string).substring(23, 29)).toBe(expectedYymmdd);
      expect((tx.REC as string).substring(16, 21).trim()).toBe('');
    },
  );
});
