import { describe, test, expect, vi } from 'vitest';
import type { SeedContext, GeneratedCaseId, SeedOperation } from '../../runner.js';
import { generate as generateCh7WithAssignment } from './ch7-with-assignment.js';
import { generate as generateCh11WithTransferOrders } from './ch11-with-transfer-orders.js';
import { generate as generateConsolidationScenarios } from './consolidation-scenarios.js';
import { generate as generateTrusteeData } from './trustee-data.js';
import { generate as generateAdminData } from './admin-data.js';

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

describe('ch7-with-assignment scenario', () => {
  async function operations() {
    return generateCh7WithAssignment(singleIdContext(CH7_IDS));
  }

  test('returns 5 operations: 2 DXTR followed by 3 Cosmos', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(5);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(3);
    // DXTR ops appear before Cosmos ops in the generated list
    expect(ops[0].db).toBe('dxtr');
    expect(ops[1].db).toBe('dxtr');
  });

  test('DXTR AO_CS row has compound primary key and insertOnly flag', async () => {
    const ops = await operations();
    const aoCs = findDxtrOperation(ops, 'AO_CS');

    expect(aoCs?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    expect(aoCs?.insertOnly).toBe(true);
    expect(aoCs?.data[0]).toMatchObject({
      CS_CASEID: 'SEED90001',
      COURT_ID: expect.any(String),
      CS_DIV: expect.any(String),
      CASE_ID: '25-90001',
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
      CS_CASEID: 'SEED90001',
      COURT_ID: expect.any(String),
      PY_ROLE: 'db',
    });
  });

  test('Cosmos SYNCED_CASE document is in the cases collection with correct chapter and debtor', async () => {
    const ops = await operations();
    const syncedCase = findCosmosDocument(ops, 'SYNCED_CASE');

    expect(syncedCase?.collectionOrTable).toBe('cases');
    expect(syncedCase?.data[0]).toMatchObject({
      id: '081-25-90001',
      documentType: 'SYNCED_CASE',
      caseId: '081-25-90001',
      chapter: '7',
      caseTitle: expect.any(String),
    });
    expect(typeof (syncedCase?.data[0]?.debtor as { name: string })?.name).toBe('string');
  });

  test('Cosmos ASSIGNMENT document has role TrialAttorney in the assignments collection', async () => {
    const ops = await operations();
    const assignment = ops.find((o) => o.collectionOrTable === 'assignments');

    expect(assignment?.db).toBe('cams');
    expect(assignment?.data[0]).toMatchObject({
      id: 'seed-assignment-081-25-90001',
      documentType: 'ASSIGNMENT',
      caseId: '081-25-90001',
      role: 'TrialAttorney',
    });
  });

  test('Cosmos NOTE document is in the cases collection (not a separate collection) with documentType NOTE', async () => {
    const ops = await operations();
    const note = findCosmosDocument(ops, 'NOTE');

    expect(note?.collectionOrTable).toBe('cases');
    expect(note?.data[0]).toMatchObject({
      id: 'seed-note-081-25-90001',
      documentType: 'NOTE',
      caseId: '081-25-90001',
    });
  });

  test('all id values use stable seed-prefixed strings so repeated runs stay idempotent', async () => {
    const ops = await operations();
    const cosmosIds = ops.filter((o) => o.db === 'cams').map((o) => o.data[0]?.id as string);

    expect(cosmosIds).toContain('081-25-90001'); // SYNCED_CASE id = caseId
    expect(cosmosIds).toContain('seed-assignment-081-25-90001');
    expect(cosmosIds).toContain('seed-note-081-25-90001');
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

  test('DXTR AO_CS row records a Chapter 11 case with compound primary key and insertOnly', async () => {
    const ops = await operations();
    const aoCs = ops.find((o) => o.collectionOrTable === 'AO_CS');

    expect(aoCs?.primaryKey).toEqual(['CS_CASEID', 'COURT_ID']);
    expect(aoCs?.insertOnly).toBe(true);
    expect(aoCs?.data[0]).toMatchObject({
      CS_CHAPTER: '11',
      CASE_ID: '25-90002',
      CS_SHORT_TITLE: expect.any(String),
    });
  });

  test('pending transfer order has docketSuggestedCaseNumber and no newCase field', async () => {
    const ops = await operations();
    const pendingOp = ops.find(
      (o) => o.collectionOrTable === 'orders' && o.data[0]?.status === 'pending',
    );
    const pending = pendingOp?.data[0] as Record<string, unknown>;

    expect(pending?.id).toBe('seed-transfer-pending-081-25-90002');
    expect(pending?.orderType).toBe('transfer');
    expect(pending?.docketSuggestedCaseNumber).toBeTruthy();
    expect(pending).not.toHaveProperty('newCase');
  });

  test('approved transfer order has newCase and no docketSuggestedCaseNumber field', async () => {
    const ops = await operations();
    const approvedOp = ops.find(
      (o) => o.collectionOrTable === 'orders' && o.data[0]?.status === 'approved',
    );
    const approved = approvedOp?.data[0] as Record<string, unknown>;

    expect(approved?.id).toBe('seed-transfer-approved-081-25-90002');
    expect(approved?.orderType).toBe('transfer');
    expect(approved?.newCase).toBeTruthy();
    expect(approved).not.toHaveProperty('docketSuggestedCaseNumber');
  });

  test('both transfer orders carry the originating case summary fields', async () => {
    const ops = await operations();
    const orderOps = ops.filter((o) => o.collectionOrTable === 'orders');

    for (const op of orderOps) {
      expect(op.data[0]).toMatchObject({
        caseId: '081-25-90002',
        chapter: '11',
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
    expect(aoCsCaseIds).toContain('SEED90001');
    expect(aoCsCaseIds).toContain('SEED90002');
    expect(aoCsCaseIds).toContain('SEED90003');
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

  test('pending administrative consolidation has no leadCase and lists two memberCases', async () => {
    const ops = await operations();
    const pendingOp = ops.find(
      (o) => o.collectionOrTable === 'consolidations' && o.data[0]?.status === 'pending',
    );
    const pending = pendingOp?.data[0] as Record<string, unknown>;

    expect(pending?.id).toBe('seed-consolidation-pending-081-25-90001-081-25-90002');
    expect(pending?.consolidationType).toBe('administrative');
    expect(pending?.orderType).toBe('consolidation');
    expect(pending).not.toHaveProperty('leadCase');
    expect(Array.isArray(pending?.memberCases)).toBe(true);
    expect((pending?.memberCases as unknown[]).length).toBe(2);
  });

  test('approved substantive consolidation has ch13 as leadCase and ch7 as the member', async () => {
    const ops = await operations();
    const approvedOp = ops.find(
      (o) => o.collectionOrTable === 'consolidations' && o.data[0]?.status === 'approved',
    );
    const approved = approvedOp?.data[0] as Record<string, unknown>;

    expect(approved?.id).toBe('seed-consolidation-approved-081-25-90003');
    expect(approved?.consolidationType).toBe('substantive');
    expect((approved?.leadCase as Record<string, unknown>)?.caseId).toBe('081-25-90003');

    const members = approved?.memberCases as Array<Record<string, unknown>>;
    expect(members).toHaveLength(1);
    expect(members[0].caseId).toBe('081-25-90001');
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

    expect(verification?.data[0]).toMatchObject({
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      orderType: 'trustee-match',
      caseId: '081-25-90010',
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

    expect(verification?.data[0]?.id).toBe('seed-trustee-match-verification-081-25-90010');
  });
});

// ─── admin-data ───────────────────────────────────────────────────────────────

describe('admin-data scenario', () => {
  async function operations() {
    return generateAdminData({ generateCaseId: vi.fn() });
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
      name: 'SEED Active Bank',
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
      name: 'SEED Active Software',
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

    expect(ids).toEqual([
      'seed-bank-active-001',
      'seed-bank-inactive-001',
      'seed-software-active-001',
      'seed-software-inactive-001',
    ]);
  });
});
