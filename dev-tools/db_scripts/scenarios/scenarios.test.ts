import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import type { SeedOperation } from '../../runner.js';
import { sequentialCaseIds, unusedCaseIdContext } from '../lib/scenario-test-doubles.js';

beforeEach(() => {
  vi.restoreAllMocks();
});

// No real DXTR connection. An empty recordset tells ensureDxtrCase the case isn't in DXTR,
// so it always returns the AO_CS + AO_PY seed operations these tests expect.
vi.mock('mssql', async () => (await import('../lib/scenario-test-doubles.js')).fakeMssqlModule([]));

import { generate as generateCh7WithAssignment } from './ch7-with-assignment.js';
import { generate as generateCh11WithTransferOrders } from './ch11-with-transfer-orders.js';
import { generate as generateConsolidationScenarios } from './consolidation-scenarios.js';
import { generate as generateTrusteeData } from './trustee-data.js';
import { generate as generateAdminData } from './admin-data.js';
import { generate as generateTrusteeCaseList } from './trustee-case-list.js';

function findCosmosDocument(ops: SeedOperation[], docType: string) {
  return ops.find((o) => o.db === 'cams' && o.data[0]?.documentType === docType);
}

/**
 * The DXTR case and debtor rows a scenario asked ensureDxtrCase for, by the values the scenario
 * chooses. The rows' keys and shape belong to ensureDxtrCase (ensure-dxtr-case.test.ts).
 */
function dxtrCases(ops: SeedOperation[]) {
  const rows = (table: string) =>
    ops.filter((o) => o.db === 'dxtr' && o.collectionOrTable === table).map((o) => o.data[0]);
  return {
    cases: rows('AO_CS').map((row) => ({
      csCaseId: row.CS_CASEID,
      caseNumber: row.CASE_ID,
      chapter: row.CS_CHAPTER,
    })),
    debtorCaseIds: rows('AO_PY').map((row) => row.CS_CASEID),
  };
}

// ─── ch7-with-assignment ──────────────────────────────────────────────────────

// ch7-with-assignment uses a fixed case (CASE_ID = '081-26-99476', csCaseId = 'SEED99476').
const CH7_FIXED_CASE_ID = '081-26-99476';
const CH7_FIXED_CS_CASE_ID = 'SEED99476';
const CH7_FIXED_CASE_NUMBER = '26-99476';

describe('ch7-with-assignment scenario', () => {
  async function operations() {
    return generateCh7WithAssignment(unusedCaseIdContext('ch7-with-assignment'));
  }

  test('returns 5 operations: 2 DXTR and 3 Cosmos', async () => {
    const ops = await operations();
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(3);
  });

  test('seeds its fixed chapter 7 case and debtor in DXTR', async () => {
    expect(dxtrCases(await operations())).toEqual({
      cases: [{ csCaseId: CH7_FIXED_CS_CASE_ID, caseNumber: CH7_FIXED_CASE_NUMBER, chapter: '7' }],
      debtorCaseIds: [CH7_FIXED_CS_CASE_ID],
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
});

// ─── ch11-with-transfer-orders ────────────────────────────────────────────────

describe('ch11-with-transfer-orders scenario', () => {
  async function operations() {
    return generateCh11WithTransferOrders(unusedCaseIdContext('ch11-with-transfer-orders'));
  }

  test('returns 5 operations: 2 DXTR and 3 Cosmos (SYNCED_CASE + 2 orders)', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(5);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(3);
  });

  test('seeds its fixed chapter 11 case and debtor in DXTR', async () => {
    expect(dxtrCases(await operations())).toEqual({
      cases: [{ csCaseId: 'SEED00874', caseNumber: '99-00874', chapter: '11' }],
      debtorCaseIds: ['SEED00874'],
    });
  });

  test('pending transfer order has docketSuggestedCaseNumber and no newCase field', async () => {
    const ops = await operations();
    const pendingOp = ops.find(
      (o) => o.collectionOrTable === 'orders' && o.data[0]?.status === 'pending',
    );
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
    const approved = approvedOp?.data[0] as Record<string, unknown>;

    expect(approved?.id).toBe('seed-transfer-approved-091-99-00874');
    expect(approved?.taskType).toBe('transfer');
    expect(approved?.newCase).toMatchObject({ caseId: expect.any(String) });
    expect(approved).not.toHaveProperty('docketSuggestedCaseNumber');
  });

  test('both transfer orders carry the originating case summary fields', async () => {
    const ops = await operations();
    const orderOps = ops.filter((o) => o.collectionOrTable === 'orders');
    expect(orderOps).toHaveLength(2);

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
  async function operations() {
    return generateConsolidationScenarios(unusedCaseIdContext('consolidation-scenarios'));
  }

  test('returns 11 operations: 6 DXTR rows and 5 Cosmos documents', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(11);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(6);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(5);
  });

  test('seeds its three fixed cases and their debtors in DXTR', async () => {
    expect(dxtrCases(await operations())).toEqual({
      cases: [
        { csCaseId: 'SEED87899', caseNumber: '99-87899', chapter: '7' },
        { csCaseId: 'SEED00874', caseNumber: '99-00874', chapter: '11' },
        { csCaseId: 'SEED92748', caseNumber: '99-92748', chapter: '13' },
      ],
      debtorCaseIds: ['SEED87899', 'SEED00874', 'SEED92748'],
    });
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
});

// ─── trustee-data ─────────────────────────────────────────────────────────────

describe('trustee-data scenario', () => {
  async function operations() {
    return generateTrusteeData(unusedCaseIdContext('trustee-data'));
  }

  test('returns 11 operations: 2 DXTR and 9 Cosmos', async () => {
    const ops = await operations();
    expect(ops).toHaveLength(11);
    expect(ops.filter((o) => o.db === 'dxtr')).toHaveLength(2);
    expect(ops.filter((o) => o.db === 'cams')).toHaveLength(9);
  });

  test('seeds 3 trustee documents', async () => {
    const ops = await operations();
    expect(ops.filter((o) => o.collectionOrTable === 'trustees')).toHaveLength(3);
  });

  test('seeds its fixed chapter 11 case and debtor in DXTR', async () => {
    expect(dxtrCases(await operations())).toEqual({
      cases: [{ csCaseId: 'SEED87899', caseNumber: '99-87899', chapter: '11' }],
      debtorCaseIds: ['SEED87899'],
    });
  });

  test('SYNCED_CASE document is in the cases collection with correct caseId and chapter', async () => {
    const ops = await operations();
    const syncedCase = ops.find(
      (o) => o.collectionOrTable === 'cases' && o.data[0]?.documentType === 'SYNCED_CASE',
    );

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

  test('no-email trustee document is active with no email in the trustees collection', async () => {
    const ops = await operations();
    const noEmail = ops
      .filter((o) => o.collectionOrTable === 'trustees')
      .find((o) => o.data[0]?.id === 'seed-trustee-nocontact-001');

    expect(noEmail?.data[0]).toMatchObject({
      documentType: 'TRUSTEE',
      status: 'active',
      name: 'Nolan Nocontact',
    });
    expect((noEmail?.data[0] as Record<string, unknown>)?.public).toMatchObject({
      phone: { number: '212-555-0400' },
    });
    expect(
      ((noEmail?.data[0] as Record<string, unknown>)?.public as Record<string, unknown>)?.email,
    ).toBeUndefined();
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

  test('pending match verification is an ambiguous DXTR identity task: both Seedtrustees are candidates', async () => {
    const ops = await operations();
    const verification = ops.find((o) => o.collectionOrTable === 'trustee-match-verification');

    expect(verification?.data[0]).toMatchObject({
      documentType: 'TRUSTEE_MATCH_VERIFICATION',
      taskType: 'trustee-match',
      caseId: '091-99-16994',
      status: 'pending',
      mismatchReason: 'ambiguous',
      source: 'DXTR',
    });
    const findings = (verification?.data[0] as Record<string, unknown>)?.findings as {
      candidates: { camsRaw: { trusteeId: string } }[];
    };
    expect(findings.candidates.map((candidate) => candidate.camsRaw.trusteeId)).toEqual([
      'seed-trustee-active-001',
      'seed-trustee-inactive-001',
    ]);
  });

  test('match verification id is stable and seed-prefixed for idempotent reruns', async () => {
    const ops = await operations();
    const verification = ops.find((o) => o.collectionOrTable === 'trustee-match-verification');

    expect(verification?.data[0]?.id).toBe('seed-trustee-match-verification-091-99-16994');
  });

  // The sync raises a task only for a case it could not resolve, and writes a surrogate for it;
  // 091-99-87899 carries other scenarios' case appointments, so the task has a case of its own.
  test('pending match verification has a surrogate for its own case in both partitions', async () => {
    const ops = await operations();
    const verification = ops.find((o) => o.collectionOrTable === 'trustee-match-verification')
      ?.data[0];

    for (const table of ['case-trustee-appointments', 'trustee-case-appointments']) {
      const surrogates = ops
        .filter((o) => o.collectionOrTable === table)
        .flatMap((o) => o.data)
        .filter((d) => d.trusteeId === verification?.fingerprint);
      expect(surrogates).toEqual([
        expect.objectContaining({
          documentType: 'CASE_APPOINTMENT',
          caseId: '091-99-16994',
          isSurrogate: true,
          chapter: '12',
          courtDivisionCode: '091',
        }),
      ]);
    }
  });
});

// ─── admin-data ───────────────────────────────────────────────────────────────

describe('admin-data scenario', () => {
  async function operations() {
    return generateAdminData(unusedCaseIdContext('admin-data'));
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
});

// ─── trustee-case-list ────────────────────────────────────────────────────────

describe('trustee-case-list scenario', () => {
  // The scenario's cases and trustees (see trustee-case-list.ts).
  const PAGINATED_CASES = 60; // 3 pages of 25/25/10
  const PAGINATED_CLOSED_CASES = 2; // CLOSED_INDICES in trustee-case-list.ts
  const SINGLE_DIVISION_CASES = 3;
  const DIVISION_CLOSED_CASES = 2; // every case of the division-closed trustee is closed
  const ALL_CASES = PAGINATED_CASES + SINGLE_DIVISION_CASES + DIVISION_CLOSED_CASES;
  const DOCKET_ENTRIES_PER_PAGINATED_CASE = 3;
  const TRUSTEES = [
    'cams-593-paginated',
    'cams-593-empty',
    'cams-814-single-division',
    'cams-814-division-closed',
  ];
  const PANEL_TRUSTEES = TRUSTEES.filter((id) => id !== 'cams-593-empty');

  // Generated once (65 cases) and shared by every test below, so tests must not mutate seedOps.
  let seedOps: SeedOperation[];
  beforeAll(async () => {
    seedOps = await generateTrusteeCaseList({ generateCaseId: sequentialCaseIds() });
  });

  function batch(collection: string): SeedOperation {
    const op = seedOps.find((o) => o.collectionOrTable === collection);
    if (!op) throw new Error(`trustee-case-list wrote no ${collection} batch`);
    return op;
  }

  test("seeds AO_CS and AO_PY for every case, and AO_DE for the paginated trustee's cases", () => {
    const dxtrOps = seedOps.filter((o) => o.db === 'dxtr');
    const opsFor = (table: string) => dxtrOps.filter((o) => o.collectionOrTable === table);

    expect(opsFor('AO_CS')).toHaveLength(ALL_CASES);
    expect(opsFor('AO_PY')).toHaveLength(ALL_CASES);
    expect(opsFor('AO_DE')).toHaveLength(PAGINATED_CASES);
    expect(dxtrOps).toHaveLength(2 * ALL_CASES + PAGINATED_CASES);
  });

  test('writes one batch to each Cosmos collection', () => {
    // case-trustee-appointments and trustee-case-appointments are the dual-written appointment
    // partitions; trustee-appointments holds panel membership.
    expect(
      seedOps
        .filter((o) => o.db === 'cams')
        .map((o) => o.collectionOrTable)
        .sort(),
    ).toEqual([
      'case-trustee-appointments',
      'cases',
      'trustee-appointments',
      'trustee-case-appointments',
      'trustees',
    ]);
  });

  test('AO_DE operations have the docket entries for each paginated case, keyed by docket sequence', () => {
    // trustee-case-list builds AO_DE itself (ensureDxtrCase doesn't), so it owns this key.
    const aoDe = seedOps.filter((o) => o.collectionOrTable === 'AO_DE');
    expect(aoDe).toHaveLength(PAGINATED_CASES);
    for (const op of aoDe) {
      expect(op.primaryKey).toEqual(['CS_CASEID', 'COURT_ID', 'DE_SEQNO']);
      expect(op.insertOnly).toBe(true);
      expect(op.data).toHaveLength(DOCKET_ENTRIES_PER_PAGINATED_CASE);
      for (const entry of op.data) {
        expect(entry).toMatchObject({
          DE_SEQNO: expect.any(Number),
          DE_DATE_FILED: expect.any(Date),
          DO_SUMMARY_TEXT: expect.any(String),
        });
      }
    }
  });

  test('trustees batch contains paginated, empty, single-division, and division-closed trustee documents', () => {
    const trustees = batch('trustees');
    expect(trustees.db).toBe('cams');
    expect(trustees.data.map((d) => d.id).sort()).toEqual([...TRUSTEES].sort());
  });

  test('cases batch contains a SYNCED_CASE for every case, across chapters 7, 11, and 13', () => {
    const cases = batch('cases');
    expect(cases.db).toBe('cams');
    expect(cases.data).toHaveLength(ALL_CASES);
    for (const c of cases.data) {
      expect(c.documentType).toBe('SYNCED_CASE');
    }
    expect(new Set(cases.data.map((c) => c.chapter))).toEqual(new Set(['7', '11', '13']));
  });

  test('appointments batch contains a CASE_APPOINTMENT for every case, including each paginated case', () => {
    const appointments = batch('trustee-case-appointments');
    expect(appointments.db).toBe('cams');
    expect(appointments.data).toHaveLength(ALL_CASES);
    for (const a of appointments.data) {
      expect(a.documentType).toBe('CASE_APPOINTMENT');
      expect(a.unassignedOn).toBeUndefined();
    }
    expect(appointments.data.filter((a) => a.trusteeId === 'cams-593-paginated')).toHaveLength(
      PAGINATED_CASES,
    );
  });

  // The trustee case list reads dateFiled, chapter, courtDivisionCode and caseStatus off the
  // appointment, not the SYNCED_CASE, and links each case to DXTR by dxtrId.
  test("each appointment's copied case fields match its SYNCED_CASE, and each case links to DXTR", () => {
    const casesById = new Map(batch('cases').data.map((c) => [c.caseId, c]));
    const dxtrCaseIds = new Set(
      seedOps.filter((o) => o.collectionOrTable === 'AO_CS').map((o) => o.data[0].CS_CASEID),
    );

    for (const appointment of batch('trustee-case-appointments').data) {
      const syncedCase = casesById.get(appointment.caseId);
      expect(syncedCase, `no SYNCED_CASE for ${appointment.caseId}`).toBeDefined();
      expect(appointment).toMatchObject({
        chapter: syncedCase?.chapter,
        courtDivisionCode: syncedCase?.courtDivisionCode,
        dateFiled: syncedCase?.dateFiled,
      });
    }
    for (const syncedCase of casesById.values()) {
      expect(dxtrCaseIds.has(syncedCase.dxtrId), `${syncedCase.caseId} has no AO_CS row`).toBe(
        true,
      );
    }
  });

  test('cases have closedDate set exactly when their appointment reports caseStatus CLOSED', () => {
    const closedCaseIds = new Set(
      batch('trustee-case-appointments')
        .data.filter((a) => a.caseStatus === 'CLOSED')
        .map((a) => a.caseId),
    );
    expect(closedCaseIds.size).toBe(PAGINATED_CLOSED_CASES + DIVISION_CLOSED_CASES);

    const cases = batch('cases').data;
    const closedCases = cases.filter((c) => closedCaseIds.has(c.caseId));
    const openCases = cases.filter((c) => !closedCaseIds.has(c.caseId));
    expect(closedCases).toHaveLength(closedCaseIds.size);
    expect(closedCases.filter((c) => c.closedDate === undefined)).toEqual([]);
    expect(openCases.filter((c) => c.closedDate !== undefined)).toEqual([]);
  });

  test('single-division trustee appointments share one division; division-closed trustee appointments are all closed in one division', () => {
    const appointments = batch('trustee-case-appointments').data;

    const singleDivisionAppts = appointments.filter(
      (a) => a.trusteeId === 'cams-814-single-division',
    );
    expect(singleDivisionAppts).toHaveLength(SINGLE_DIVISION_CASES);
    for (const a of singleDivisionAppts) {
      expect(a.courtDivisionCode).toBe('081');
    }

    const divisionClosedAppts = appointments.filter(
      (a) => a.trusteeId === 'cams-814-division-closed',
    );
    expect(divisionClosedAppts).toHaveLength(DIVISION_CLOSED_CASES);
    for (const a of divisionClosedAppts) {
      expect(a.courtDivisionCode).toBe('393');
      expect(a.caseStatus).toBe('CLOSED');
      expect(a.closedDate).toBeDefined();
    }
  });

  test('case-trustee-appointments dual-write matches trustee-case-appointments exactly', () => {
    expect(batch('case-trustee-appointments').data).toEqual(
      batch('trustee-case-appointments').data,
    );
  });

  test('trustee-appointments batch marks every panel trustee active with matching division codes', () => {
    const panel = batch('trustee-appointments');
    expect(panel.db).toBe('cams');
    expect(panel.data).toHaveLength(PANEL_TRUSTEES.length);

    for (const doc of panel.data) {
      expect(doc.documentType).toBe('TRUSTEE_APPOINTMENT');
      expect(doc.status).toBe('active');
    }
    const byTrustee = new Map(panel.data.map((d) => [d.trusteeId, d]));
    expect(byTrustee.get('cams-593-paginated')?.divisionCodes).toEqual(['081']);
    expect(byTrustee.get('cams-814-single-division')?.divisionCodes).toEqual(['081']);
    expect(byTrustee.get('cams-814-division-closed')?.divisionCodes).toEqual(['393']);
  });

  test('empty trustee has zero appointments', () => {
    const appointments = batch('trustee-case-appointments').data;
    expect(appointments.filter((a) => a.trusteeId === 'cams-593-empty')).toHaveLength(0);
  });

  test('each paginated-trustee appointment has distinct appointedDate (15th) vs dateFiled in its SYNCED_CASE (1st)', () => {
    const dateFiledByCase = new Map(batch('cases').data.map((c) => [c.caseId, c.dateFiled]));
    const paginatedAppointments = batch('trustee-case-appointments').data.filter(
      (a) => a.trusteeId === 'cams-593-paginated',
    );
    expect(paginatedAppointments).toHaveLength(PAGINATED_CASES);

    for (const a of paginatedAppointments) {
      const dateFiled = dateFiledByCase.get(a.caseId) as string;
      expect(a.appointedDate).not.toBe(dateFiled);
      expect((a.appointedDate as string).endsWith('-15')).toBe(true);
      expect(dateFiled.endsWith('-01')).toBe(true);
    }
  });
});
