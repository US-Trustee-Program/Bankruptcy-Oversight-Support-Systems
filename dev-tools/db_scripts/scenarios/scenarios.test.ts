import { describe, test, expect, vi, beforeAll } from 'vitest';
import type { SeedContext, GeneratedCaseId, SeedOperation } from '../../runner.js';

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

import { generate as generateCh7WithAssignment } from './ch7-with-assignment.js';
import { generate as generateCh11WithTransferOrders } from './ch11-with-transfer-orders.js';
import { generate as generateConsolidationScenarios } from './consolidation-scenarios.js';
import { generate as generateTrusteeData } from './trustee-data.js';
import { generate as generateAdminData } from './admin-data.js';
import { generate as generateTrusteeCaseList } from './trustee-case-list.js';

// Fixed IDs used across all tests so assertions are deterministic
const CH7_IDS: GeneratedCaseId = {
  caseId: '081-25-90001',
  caseNumber: '25-90001',
  csCaseId: 'SEED90001',
};
const CH11_IDS: GeneratedCaseId = {
  caseId: '081-25-90002',
  caseNumber: '25-90002',
  csCaseId: 'SEED90002',
};
const CH13_IDS: GeneratedCaseId = {
  caseId: '081-25-90003',
  caseNumber: '25-90003',
  csCaseId: 'SEED90003',
};

function singleIdContext(ids: GeneratedCaseId): SeedContext {
  return { generateCaseId: vi.fn().mockResolvedValue(ids) };
}

// Helper functions to reduce duplication in finding operations
function findDxtrOperation(ops: SeedOperation[], table: string) {
  return ops.find((o) => o.db === 'dxtr' && o.collectionOrTable === table);
}

function findCosmosDocument(ops: SeedOperation[], docType: string) {
  return ops.find((o) => o.db === 'cams' && o.data[0]?.documentType === docType);
}

// ─── ch7-with-assignment ──────────────────────────────────────────────────────

// ch7-with-assignment uses a fixed case ID (CASE_ID = '081-26-99476' /
// csCaseId = 'SEED99476'); the mock generateCaseId is never consulted.
const CH7_FIXED_CASE_ID = '081-26-99476';
const CH7_FIXED_CS_CASE_ID = 'SEED99476';
const CH7_FIXED_CASE_NUMBER = '26-99476';

describe('ch7-with-assignment scenario', () => {
  async function operations() {
    // singleIdContext satisfies the SeedContext type but generateCaseId is never
    // called — this scenario uses its own hardcoded fixed case IDs (CH7_FIXED_*).
    return generateCh7WithAssignment(singleIdContext(CH7_IDS));
  }

  test('returns 5 operations: 2 DXTR and 3 Cosmos', async () => {
    const ops = await operations();
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(3);
  });

  test('DXTR AO_CS row has compound primary key and insertOnly flag', async () => {
    const ops = await operations();
    const aoCs = findDxtrOperation(ops, 'AO_CS');

    expect(aoCs).toBeDefined();
    expect(aoCs?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    expect(aoCs?.insertOnly).toBe(true);
    expect(aoCs?.data[0]).toMatchObject({
      CS_CASEID: CH7_FIXED_CS_CASE_ID,
      COURT_ID: expect.any(String),
      CS_DIV: expect.any(String),
      CASE_ID: CH7_FIXED_CASE_NUMBER,
      CS_SHORT_TITLE: expect.any(String),
      CS_CHAPTER: '7',
    });
  });

  test('DXTR AO_PY debtor row has compound primary key including PY_ROLE', async () => {
    const ops = await operations();
    const aoPy = ops.find((o) => o.collectionOrTable === 'AO_PY');

    expect(aoPy?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID', 'PY_ROLE']);
    expect(aoPy?.insertOnly).toBe(true);
    expect(aoPy?.data[0]).toMatchObject({
      CS_CASEID: CH7_FIXED_CS_CASE_ID,
      COURT_ID: expect.any(String),
      PY_ROLE: 'DB',
    });
  });

  test('Cosmos SYNCED_CASE document is in the cases collection with correct chapter and debtor', async () => {
    const ops = await operations();
    const syncedCase = findCosmosDocument(ops, 'SYNCED_CASE');

    expect(syncedCase?.collectionOrTable).toBe('cases');
    expect(syncedCase?.data[0]).toMatchObject({
      id: CH7_FIXED_CASE_ID,
      documentType: 'SYNCED_CASE',
      caseId: CH7_FIXED_CASE_ID,
      chapter: '7',
      caseTitle: expect.any(String),
    });
    expect(syncedCase?.data[0]).toMatchObject({
      debtor: expect.objectContaining({ name: expect.any(String) }),
    });
  });

  test('Cosmos ASSIGNMENT document has role TrialAttorney in the assignments collection', async () => {
    const ops = await operations();
    const assignment = ops.find((o) => o.collectionOrTable === 'assignments');

    expect(assignment?.db).toBe('cams');
    expect(assignment?.data[0]).toMatchObject({
      id: `seed-assignment-${CH7_FIXED_CASE_ID}`,
      documentType: 'ASSIGNMENT',
      caseId: CH7_FIXED_CASE_ID,
      role: 'TrialAttorney',
    });
  });

  test('Cosmos NOTE document is in the cases collection (not a separate collection) with documentType NOTE', async () => {
    const ops = await operations();
    const note = findCosmosDocument(ops, 'NOTE');

    expect(note?.collectionOrTable).toBe('cases');
    expect(note?.data[0]).toMatchObject({
      id: `seed-note-${CH7_FIXED_CASE_ID}`,
      documentType: 'NOTE',
      caseId: CH7_FIXED_CASE_ID,
    });
  });

  test('all id values use stable seed-prefixed strings so repeated runs stay idempotent', async () => {
    const ops = await operations();
    const cosmosIds = ops.filter((o) => o.db === 'cams').map((o) => o.data[0]?.id as string);

    expect(cosmosIds).toContain(CH7_FIXED_CASE_ID); // SYNCED_CASE id = caseId
    expect(cosmosIds).toContain(`seed-assignment-${CH7_FIXED_CASE_ID}`);
    expect(cosmosIds).toContain(`seed-note-${CH7_FIXED_CASE_ID}`);
  });
});

// ─── ch11-with-transfer-orders ────────────────────────────────────────────────

describe('ch11-with-transfer-orders scenario', () => {
  async function operations() {
    return generateCh11WithTransferOrders(singleIdContext(CH11_IDS));
  }

  test('returns 5 operations: 2 DXTR and 3 Cosmos (SYNCED_CASE + 2 orders)', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(5);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(3);
  });

  test('DXTR AO_CS row records the correct case with compound primary key and insertOnly', async () => {
    const ops = await operations();
    const aoCs = ops.find((o) => o.collectionOrTable === 'AO_CS');

    expect(aoCs?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    expect(aoCs?.insertOnly).toBe(true);
    expect(aoCs?.data[0]).toBeDefined();
    expect(aoCs?.data[0]).toMatchObject({
      CS_CASEID: 'SEED00874',
      COURT_ID: expect.any(String),
      CS_DIV: expect.any(String),
      CASE_ID: '99-00874',
      CS_SHORT_TITLE: expect.any(String),
    });
  });

  test('pending transfer order has docketSuggestedCaseNumber and no newCase field', async () => {
    const ops = await operations();
    const pendingOp = ops.find(
      (o) => o.collectionOrTable === 'orders' && o.data[0]?.status === 'pending',
    );
    expect(pendingOp?.data[0]).toBeDefined();
    const pending = pendingOp?.data[0] as Record<string, unknown>;

    expect(pending?.id).toBe('seed-transfer-pending-091-99-00874');
    expect(pending?.taskType).toBe('transfer');
    expect(typeof pending?.docketSuggestedCaseNumber).toBe('string');
    expect(pending).not.toHaveProperty('newCase');
  });

  test('approved transfer order has newCase and no docketSuggestedCaseNumber field', async () => {
    const ops = await operations();
    const approvedOp = ops.find(
      (o) => o.collectionOrTable === 'orders' && o.data[0]?.status === 'approved',
    );
    expect(approvedOp?.data[0]).toBeDefined();
    const approved = approvedOp?.data[0] as Record<string, unknown>;

    expect(approved?.id).toBe('seed-transfer-approved-091-99-00874');
    expect(approved?.taskType).toBe('transfer');
    expect(approved?.newCase).toMatchObject({ caseId: expect.any(String) });
    expect(approved).not.toHaveProperty('docketSuggestedCaseNumber');
  });

  test('both transfer orders carry the originating case summary fields', async () => {
    const ops = await operations();
    const orderOps = ops.filter((o) => o.collectionOrTable === 'orders');

    for (const op of orderOps) {
      expect(op.data[0]).toMatchObject({
        caseId: '091-99-00874',
        courtDivisionCode: expect.any(String),
      });
      expect(Array.isArray((op.data[0] as Record<string, unknown>).docketEntries)).toBe(true);
    }
  });
});

// ─── consolidation-scenarios ──────────────────────────────────────────────────

describe('consolidation-scenarios scenario', () => {
  function multiIdContext() {
    return {
      generateCaseId: vi
        .fn()
        .mockResolvedValueOnce(CH7_IDS)
        .mockResolvedValueOnce(CH11_IDS)
        .mockResolvedValueOnce(CH13_IDS),
    } satisfies SeedContext;
  }

  async function operations() {
    return generateConsolidationScenarios(multiIdContext());
  }

  test('returns 11 operations: 6 DXTR rows and 5 Cosmos documents', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(11);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(6);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(5);
  });

  test('each of the three cases has an AO_CS row and an AO_PY debtor row in DXTR', async () => {
    const ops = await operations();
    const aoCsRows = ops.filter((o) => o.collectionOrTable === 'AO_CS');
    const aoPyRows = ops.filter((o) => o.collectionOrTable === 'AO_PY');

    expect(aoCsRows).toHaveLength(3);
    expect(aoPyRows).toHaveLength(3);

    const aoCsCaseIds = aoCsRows.map((o) => o.data[0]?.CS_CASEID as string);
    expect(aoCsCaseIds).toContain('SEED87899');
    expect(aoCsCaseIds).toContain('SEED00874');
    expect(aoCsCaseIds).toContain('SEED92748');
  });

  test('all DXTR operations use compound primary keys and insertOnly flag', async () => {
    const ops = await operations();
    const dxtrOps = ops.filter((o) => o.db === 'dxtr');

    for (const op of dxtrOps) {
      expect(Array.isArray(op.primaryKey)).toBe(true);
      expect(op.insertOnly).toBe(true);
    }
  });

  test('three SYNCED_CASE documents land in the cases collection with the correct chapters', async () => {
    const ops = await operations();
    const syncedCases = ops.filter(
      (o) => o.db === 'cams' && o.data[0]?.documentType === 'SYNCED_CASE',
    );

    expect(syncedCases).toHaveLength(3);
    const chapters = syncedCases.map((o) => o.data[0]?.chapter as string).sort();
    expect(chapters).toEqual(['11', '13', '7']);
  });

  test('pending administrative consolidation has a leadCase and lists two memberCases', async () => {
    const ops = await operations();
    const pendingOp = ops.find(
      (o) => o.collectionOrTable === 'consolidations' && o.data[0]?.status === 'pending',
    );
    expect(pendingOp?.data[0]).toBeDefined();
    const pending = pendingOp?.data[0] as Record<string, unknown>;

    expect(pending?.id).toBe('seed-consolidation-pending-091-99-87899-091-99-00874');
    expect(pending?.consolidationType).toBe('administrative');
    expect(pending?.taskType).toBe('consolidation');
    expect(pending).toHaveProperty('leadCase');
    expect(Array.isArray(pending?.memberCases)).toBe(true);
    expect((pending?.memberCases as unknown[]).length).toBe(2);
  });

  test('approved substantive consolidation has ch13 as leadCase and ch7 as the member', async () => {
    const ops = await operations();
    const approvedOp = ops.find(
      (o) => o.collectionOrTable === 'consolidations' && o.data[0]?.status === 'approved',
    );
    expect(approvedOp?.data[0]).toBeDefined();
    const approved = approvedOp?.data[0] as Record<string, unknown>;

    expect(approved?.id).toBe('seed-consolidation-approved-091-99-92748');
    expect(approved?.consolidationType).toBe('substantive');
    const leadCase = approved?.leadCase as Record<string, unknown>;
    expect(leadCase?.caseId).toBe('091-99-92748');
    expect(leadCase?.chapter).toBeDefined();
    expect(leadCase?.caseTitle).toBeDefined();

    const members = approved?.memberCases as Array<Record<string, unknown>>;
    expect(members).toHaveLength(1);
    expect(members[0].caseId).toBe('091-99-87899');
  });

  test('consolidation ids are stable seed-prefixed strings for idempotent reruns', async () => {
    const ops = await operations();
    const consolidationIds = ops
      .filter((o) => o.collectionOrTable === 'consolidations')
      .map((o) => o.data[0]?.id as string);

    expect(consolidationIds).toHaveLength(2);
    expect(consolidationIds.every((id) => id.startsWith('seed-consolidation-'))).toBe(true);
  });
});

// ─── trustee-data ─────────────────────────────────────────────────────────────

describe('trustee-data scenario', () => {
  const CASE_IDS: GeneratedCaseId = {
    caseId: '081-25-90010',
    caseNumber: '25-90010',
    csCaseId: 'SEED90010',
  };

  async function operations() {
    return generateTrusteeData(singleIdContext(CASE_IDS));
  }

  test('returns 8 operations: 2 DXTR and 6 Cosmos', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(8);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(6);
  });

  test('DXTR operations use compound primary keys and insertOnly flag', async () => {
    const ops = await operations();
    const dxtrOps = ops.filter((o) => o.db === 'dxtr');

    expect(dxtrOps.find((o) => o.collectionOrTable === 'AO_CS')?.primaryKey).toEqual([
      'CS_CASEID',
      'COURT_ID',
    ]);
    expect(dxtrOps.find((o) => o.collectionOrTable === 'AO_PY')?.primaryKey).toEqual([
      'CS_CASEID',
      'COURT_ID',
      'PY_ROLE',
    ]);
    expect(dxtrOps.every((o) => o.insertOnly === true)).toBe(true);
  });

  test('SYNCED_CASE document is in the cases collection with correct caseId and chapter', async () => {
    const ops = await operations();
    const syncedCase = ops.find(
      (o) => o.collectionOrTable === 'cases' && o.data[0]?.documentType === 'SYNCED_CASE',
    );

    expect(syncedCase?.data[0]).toBeDefined();
    expect(syncedCase?.data[0]).toMatchObject({
      documentType: 'SYNCED_CASE',
      caseId: '091-99-87899',
      chapter: '11',
      debtor: expect.objectContaining({ name: expect.any(String) }),
    });
  });

  test('active trustee document has status active in the trustees collection', async () => {
    const ops = await operations();
    const trustees = ops.filter((o) => o.collectionOrTable === 'trustees');

    expect(trustees).toHaveLength(2);
    const active = trustees.find((o) => o.data[0]?.id === 'seed-trustee-active-001');
    expect(active?.data[0]).toMatchObject({
      documentType: 'TRUSTEE',
      status: 'active',
      name: 'Sam Seedtrustee',
    });
  });

  test('inactive trustee document has status inactive in the trustees collection', async () => {
    const ops = await operations();
    const inactive = ops
      .filter((o) => o.collectionOrTable === 'trustees')
      .find((o) => o.data[0]?.id === 'seed-trustee-inactive-001');

    expect(inactive?.data[0]).toMatchObject({
      documentType: 'TRUSTEE',
      status: 'inactive',
      name: 'Pat Seedtrustee',
    });
  });

  test('matched appointment has active status in the trustee-appointments collection', async () => {
    const ops = await operations();
    const matched = ops
      .filter((o) => o.collectionOrTable === 'trustee-appointments')
      .find((o) => o.data[0]?.id === 'seed-appointment-matched-001');

    expect(matched?.data[0]).toMatchObject({
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: 'seed-trustee-active-001',
      chapter: '7',
      status: 'active',
    });
  });

  test('mismatched appointment has active status and chapter 13 in the trustee-appointments collection', async () => {
    const ops = await operations();
    const mismatched = ops
      .filter((o) => o.collectionOrTable === 'trustee-appointments')
      .find((o) => o.data[0]?.id === 'seed-appointment-mismatched-001');

    expect(mismatched?.data[0]).toMatchObject({
      documentType: 'TRUSTEE_APPOINTMENT',
      trusteeId: 'seed-trustee-active-001',
      chapter: '13',
      status: 'active',
    });
  });

  test('pending match verification is in trustee-match-verification collection with IMPERFECT_MATCH reason', async () => {
    const ops = await operations();
    const verification = ops.find((o) => o.collectionOrTable === 'trustee-match-verification');

    expect(verification?.data[0]).toBeDefined();
    expect(verification?.data[0]).toMatchObject({
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      taskType: 'trustee-match',
      caseId: '091-99-87899',
      status: 'pending',
      mismatchReason: 'IMPERFECT_MATCH',
    });
    const candidates = (verification?.data[0] as Record<string, unknown>)
      ?.matchCandidates as unknown[];
    expect(candidates).toHaveLength(1);
  });

  test('match verification id is stable and seed-prefixed for idempotent reruns', async () => {
    const ops = await operations();
    const verification = ops.find((o) => o.collectionOrTable === 'trustee-match-verification');

    expect(verification?.data[0]?.id).toBe('seed-trustee-match-verification-091-99-87899');
  });
});

// ─── admin-data ───────────────────────────────────────────────────────────────

describe('admin-data scenario', () => {
  async function operations() {
    // admin-data ignores its context entirely; pass a stub that throws if called
    // to make it obvious if that assumption ever changes.
    return generateAdminData({
      generateCaseId: () => {
        throw new Error('admin-data should not call generateCaseId');
      },
    } as SeedContext);
  }

  test('returns 4 operations: 2 banks and 2 bankruptcy-software, all Cosmos', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(4);
    expect(ops.every((o) => o.db === 'cams')).toBe(true);
    expect(ops.filter((o) => o.collectionOrTable === 'banks')).toHaveLength(2);
    expect(ops.filter((o) => o.collectionOrTable === 'bankruptcy-software')).toHaveLength(2);
  });

  test('active bank has documentType BANK_PROFILE and status active', async () => {
    const ops = await operations();
    const active = ops.find((o) => o.data[0]?.id === 'seed-bank-active-001');

    expect(active?.data[0]).toMatchObject({
      documentType: 'BANK_PROFILE',
      name: 'Test Bank of America',
      status: 'active',
    });
  });

  test('inactive bank has status inactive', async () => {
    const ops = await operations();
    const inactive = ops.find((o) => o.data[0]?.id === 'seed-bank-inactive-001');

    expect(inactive?.data[0]).toMatchObject({
      documentType: 'BANK_PROFILE',
      name: 'SEED Inactive Bank',
      status: 'inactive',
    });
  });

  test('active software has documentType BANKRUPTCY_SOFTWARE and contact info', async () => {
    const ops = await operations();
    const active = ops.find((o) => o.data[0]?.id === 'seed-software-active-001');

    expect(active?.data[0]).toMatchObject({
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'BestCase Pro',
      status: 'active',
    });
    expect((active?.data[0] as Record<string, unknown>).contact).toBeTruthy();
  });

  test('inactive software has status inactive', async () => {
    const ops = await operations();
    const inactive = ops.find((o) => o.data[0]?.id === 'seed-software-inactive-001');

    expect(inactive?.data[0]).toMatchObject({
      documentType: 'BANKRUPTCY_SOFTWARE',
      name: 'SEED Inactive Software',
      status: 'inactive',
    });
  });

  test('all ids are stable seed-prefixed strings for idempotent reruns', async () => {
    const ops = await operations();
    const ids = ops.map((o) => o.data[0]?.id as string);

    expect(ids).toEqual(
      expect.arrayContaining([
        'seed-bank-active-001',
        'seed-bank-inactive-001',
        'seed-software-active-001',
        'seed-software-inactive-001',
      ]),
    );
    expect(ids).toHaveLength(4);
  });
});

// ─── trustee-case-list ────────────────────────────────────────────────────────

describe('trustee-case-list scenario', () => {
  function multiIdContext(): SeedContext {
    let seq = 90100;
    return {
      generateCaseId: vi.fn().mockImplementation(async (divisionCode: string) => {
        const num = seq++;
        return {
          caseId: `${divisionCode}-26-${num}`,
          caseNumber: `26-${num}`,
          csCaseId: `SEED${num}`,
        } satisfies GeneratedCaseId;
      }),
    };
  }

  let seedOps: SeedOperation[];
  beforeAll(async () => {
    seedOps = await generateTrusteeCaseList(multiIdContext());
  });

  test('has 180 DXTR operations and 4 Cosmos operations', async () => {
    const ops = seedOps;
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(180);
    // trustees + cases + case-appointments + TRUSTEE_APPOINTMENT for panel membership
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(4);
  });

  test('all DXTR operations use compound primary keys and insertOnly flag', () => {
    const ops = seedOps;
    const dxtrOps = ops.filter((o) => o.db === 'dxtr');
    for (const op of dxtrOps) {
      expect(Array.isArray(op.primaryKey)).toBe(true);
      expect(op.insertOnly).toBe(true);
    }
  });

  test('AO_DE operations have 3 docket entries per case with insertOnly flag', () => {
    const ops = seedOps;
    const aoDe = ops.filter((o) => o.collectionOrTable === 'AO_DE');
    expect(aoDe).toHaveLength(60);
    for (const op of aoDe) {
      expect(op.data).toHaveLength(3);
      expect(op.insertOnly).toBe(true);
      expect(Array.isArray(op.primaryKey)).toBe(true);
      for (const entry of op.data) {
        expect(entry).toMatchObject({
          DE_SEQNO: expect.any(Number),
          DE_DATE_FILED: expect.any(Date),
          DO_SUMMARY_TEXT: expect.any(String),
        });
      }
    }
  });

  test('trustees batch contains both paginated and empty trustee documents', () => {
    const ops = seedOps;
    const trusteeOp = ops.find((o) => o.collectionOrTable === 'trustees');
    expect(trusteeOp?.db).toBe('cams');
    expect(trusteeOp?.data).toHaveLength(2);
    const ids = trusteeOp?.data.map((d) => d.id);
    expect(ids).toContain('cams-593-paginated');
    expect(ids).toContain('cams-593-empty');
  });

  test('cases batch contains 60 SYNCED_CASE documents across chapters 7, 11, and 13', () => {
    const ops = seedOps;
    const casesOp = ops.find((o) => o.collectionOrTable === 'cases');
    expect(casesOp).toBeDefined();
    expect(casesOp?.db).toBe('cams');
    expect(casesOp?.data).toHaveLength(60);
    for (const c of casesOp!.data) {
      expect(c.documentType).toBe('SYNCED_CASE');
    }
    const chapters = casesOp!.data.map((c) => c.chapter as string);
    expect(chapters).toContain('7');
    expect(chapters).toContain('11');
    expect(chapters).toContain('13');
  });

  test('appointments batch contains 60 CASE_APPOINTMENT documents all linked to paginated trustee', () => {
    const ops = seedOps;
    const apptOp = ops.find((o) => o.collectionOrTable === 'trustee-appointments');
    expect(apptOp).toBeDefined();
    expect(apptOp?.db).toBe('cams');
    expect(apptOp?.data).toHaveLength(60);
    for (const a of apptOp!.data) {
      expect(a.documentType).toBe('CASE_APPOINTMENT');
      expect(a.trusteeId).toBe('cams-593-paginated');
      expect(a.unassignedOn).toBeUndefined();
    }
  });

  test('cases at index 2 and 7 have closedDate set; all others do not', () => {
    const casesOp = seedOps.find((o) => o.collectionOrTable === 'cases');
    expect(casesOp).toBeDefined();
    const cases = casesOp!.data;
    expect(cases[2].closedDate).toBeDefined();
    expect(cases[7].closedDate).toBeDefined();
    const openCases = cases.filter((_, i) => i !== 2 && i !== 7);
    for (const c of openCases) {
      expect(c.closedDate).toBeUndefined();
    }
  });

  test('each appointment has distinct appointedDate (15th) vs dateFiled in its SYNCED_CASE (1st)', () => {
    const ops = seedOps;
    const casesOp = ops.find((o) => o.collectionOrTable === 'cases');
    const apptOp = ops.find((o) => o.collectionOrTable === 'trustee-appointments');
    expect(casesOp).toBeDefined();
    expect(apptOp).toBeDefined();
    const caseMap = new Map(casesOp!.data.map((c) => [c.caseId as string, c.dateFiled as string]));
    for (const a of apptOp!.data) {
      const dateFiled = caseMap.get(a.caseId as string);
      expect(dateFiled).toBeTruthy();
      expect(a.appointedDate).not.toBe(dateFiled);
      expect((a.appointedDate as string).endsWith('-15')).toBe(true);
      expect((dateFiled as string).endsWith('-01')).toBe(true);
    }
  });
});
