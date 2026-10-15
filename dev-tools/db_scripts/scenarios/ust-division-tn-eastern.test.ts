import { describe, test, expect, vi, beforeEach } from 'vitest';
import type { SeedContext, SeedOperation } from '../../runner.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

// Prevent ensureDxtrCase from opening a real SQL connection during tests. An empty recordset
// tells the helper none of the three cases already exist, so it always produces the expected
// AO_CS + AO_PY seed operations (same pattern as scenarios.test.ts).
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

import { generate } from './ust-division-tn-eastern.js';

type SyncedCaseDoc = Record<string, unknown> & {
  caseId: string;
  courtId: string;
  courtDivisionCode: string;
  ustDivisionCode?: string;
};

type TrusteeAppointmentDoc = Record<string, unknown> & {
  id: string;
  trusteeId: string;
  courtId: string;
  divisionCodes: string[];
};

const mockContext: SeedContext = {
  generateCaseId: vi.fn(),
};

function findOps(ops: SeedOperation[], collectionOrTable: string): SeedOperation[] {
  return ops.filter((op) => op.collectionOrTable === collectionOrTable);
}

describe('ust-division-tn-eastern scenario', () => {
  test('Chattanooga and Knoxville cases are already forward-synced with ustDivisionCode', async () => {
    const ops = await generate(mockContext);
    const cases = findOps(ops, 'cases')[0].data as SyncedCaseDoc[];

    const chattanooga = cases.find((c) => c.caseId === '491-26-99601')!;
    expect(chattanooga.courtDivisionCode).toBe('491');
    expect(chattanooga.ustDivisionCode).toBe('491');

    const knoxville = cases.find((c) => c.caseId === '493-26-99603')!;
    expect(knoxville.courtDivisionCode).toBe('493');
    expect(knoxville.ustDivisionCode).toBe('493');
  });

  test('Winchester case keeps its ACMS-coded caseId/courtDivisionCode but omits ustDivisionCode', async () => {
    const ops = await generate(mockContext);
    const cases = findOps(ops, 'cases')[0].data as SyncedCaseDoc[];

    const winchester = cases.find((c) => c.caseId === '491-26-99602')!;
    expect(winchester).toBeDefined();
    // Case identity is unchanged by CAMS-936 — Winchester's caseId/courtDivisionCode still use
    // Chattanooga's ACMS code (491), not its own bare CS_DIV (494).
    expect(winchester.courtDivisionCode).toBe('491');
    // Intentionally absent — this is what the backfill-ust-division-code dataflow should fill in.
    expect(winchester.ustDivisionCode).toBeUndefined();
    expect('ustDivisionCode' in winchester).toBe(false);
  });

  test('seeds the underlying DXTR AO_CS row with the bare CS_DIV for each case', async () => {
    const ops = await generate(mockContext);
    const aoCsOps = findOps(ops, 'AO_CS');

    const winchesterRow = aoCsOps
      .flatMap((op) => op.data)
      .find((row) => (row as { CS_CASEID?: string }).CS_CASEID === 'SEED99602') as {
      CS_DIV: string;
    };
    expect(winchesterRow.CS_DIV).toBe('494');

    const chattanoogaRow = aoCsOps
      .flatMap((op) => op.data)
      .find((row) => (row as { CS_CASEID?: string }).CS_CASEID === 'SEED99601') as {
      CS_DIV: string;
    };
    expect(chattanoogaRow.CS_DIV).toBe('491');
  });

  test('trustee has distinct divisionCodes for Chattanooga and Winchester appointments', async () => {
    const ops = await generate(mockContext);
    const appointments = findOps(ops, 'trustee-appointments')[0].data as TrusteeAppointmentDoc[];

    expect(appointments).toHaveLength(2);
    const chattanoogaAppt = appointments.find((a) => a.id.includes('chattanooga'))!;
    const winchesterAppt = appointments.find((a) => a.id.includes('winchester'))!;

    expect(chattanoogaAppt.trusteeId).toBe(winchesterAppt.trusteeId);
    expect(chattanoogaAppt.courtId).toBe(winchesterAppt.courtId);
    expect(chattanoogaAppt.divisionCodes).toEqual(['491']);
    expect(winchesterAppt.divisionCodes).toEqual(['494']);
  });

  test('links the trustee to the Winchester case via a CASE_APPOINTMENT', async () => {
    const ops = await generate(mockContext);
    const caseTrusteeAppointments = findOps(ops, 'case-trustee-appointments')[0].data as Array<
      Record<string, unknown>
    >;
    const trusteeCaseAppointments = findOps(ops, 'trustee-case-appointments')[0].data as Array<
      Record<string, unknown>
    >;

    for (const appointments of [caseTrusteeAppointments, trusteeCaseAppointments]) {
      expect(appointments).toHaveLength(1);
      expect(appointments[0].caseId).toBe('491-26-99602');
      expect(appointments[0].documentType).toBe('CASE_APPOINTMENT');
    }
  });
});
