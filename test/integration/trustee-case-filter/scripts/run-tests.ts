/**
 * Integration test harness for TrusteeCasesUseCase.getCasesForTrustee().
 *
 * Exercises the full API use-case layer against a real MongoDB instance —
 * no mocks. Seeds >500 case appointments for a single trustee plus SYNCED_CASE
 * documents covering every filter dimension:
 *
 *   caseStatus  — OPEN, CLOSED, ALL
 *   chapter     — 7, 11, 12, 13
 *   filedDate   — date range filtering (filedDateFrom / filedDateTo)
 *   division    — courtDivisionCode filtering
 *   movedTo     — movedToCaseId cases appear with caseTitle='Case not available', courtDivisionName=''
 *   >500 limit  — regression guard: all appointments visible when unfilterd
 *
 * Both collections used by the use case are seeded directly:
 *   trustee-case-appointments  (partitioned by trusteeId)
 *   cases                      (SYNCED_CASE documents)
 *
 * Usage (from test/integration/):
 *   npm run trustee-case-filter -- [command]
 *
 * Local workflow:
 *   1. cd trustee-case-filter/scripts && ./start-services.sh
 *   2. Copy .env.local.template to .env.local
 *   3. npm run trustee-case-filter -- seed
 *   4. npm run trustee-case-filter -- run
 *   5. npm run trustee-case-filter -- clean
 *   6. cd trustee-case-filter/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Insert fixture documents into MongoDB
 *   run     Run all filter assertions against the use case
 *   clean   Remove all seeded fixture documents
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Collection, MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { closeDeferred } from '../../../../backend/lib/deferrable/defer-close';
import { TrusteeCasesUseCase } from '../../../../backend/lib/use-cases/trustee-cases/trustee-cases.use-case';
import { TrusteeCasesSearchPredicate } from '../../../../common/src/api/search';

const HARNESS_DIR = path.resolve(__dirname, '../');

// Collections match production collection names used by the repositories
const APPOINTMENTS_COLLECTION = 'trustee-case-appointments';
const CASES_COLLECTION = 'cases';

// Trustee under test — use a unique ID unlikely to collide with real data
const TEST_TRUSTEE_ID = 'integration-trustee-case-filter-001';

// Division codes used in fixtures
const DIV_ALPHA = 'TCF-ALPHA';
const DIV_BETA = 'TCF-BETA';
const DIV_GAMMA = 'TCF-GAMMA';

// ---------------------------------------------------------------------------
// Fixture design
//
// We seed 510 total appointments for TEST_TRUSTEE_ID.
//
// Slots 1–500: "bulk" cases — Chapter 7, OPEN, filed 2020-01-01, DIV_ALPHA.
//   These are the cases that would be silently dropped under the old 500 limit.
//
// Slots 501–510: "feature" cases — varied attributes for filter assertions:
//   501: Chapter 11, OPEN,   filed 2022-06-01, DIV_BETA
//   502: Chapter 13, OPEN,   filed 2023-03-15, DIV_BETA
//   503: Chapter 7,  CLOSED, filed 2021-09-10, DIV_ALPHA  (closedDate set)
//   504: Chapter 11, CLOSED, filed 2022-11-20, DIV_GAMMA  (closedDate set)
//   505: Chapter 12, OPEN,   filed 2024-04-01, DIV_GAMMA
//   506: Chapter 7,  OPEN,   filed 2019-07-04, DIV_ALPHA  (early filed date)
//   507: Chapter 13, OPEN,   filed 2025-01-15, DIV_BETA   (late filed date)
//   508: Chapter 7,  OPEN,   filed 2023-08-08, DIV_ALPHA  (movedToCaseId set — appears as 'Case not available')
//   509: Chapter 11, OPEN,   filed 2023-08-08, DIV_GAMMA  (CLOSED then REOPENED — counts as OPEN)
//   510: Chapter 7,  OPEN,   filed 2023-08-08, DIV_ALPHA  (unassigned appt — not in results)
//
// Slot 510 has unassignedOn set on its appointment, so it should never appear.
// ---------------------------------------------------------------------------

type AppointmentDoc = {
  documentType: 'CASE_APPOINTMENT';
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  appointedDate?: string;
  unassignedOn?: string | null;
  source: 'acms';
  createdBy: { id: string; name: string };
  createdOn: string;
  // Denormalized case fields required by getCasesForTrustee pre-paginate $match
  dateFiled?: string;
  chapter?: string;
  courtDivisionCode?: string;
  caseStatus?: 'OPEN' | 'CLOSED';
};

type SyncedCaseDoc = {
  documentType: 'SYNCED_CASE';
  caseId: string;
  dxtrId: string;
  caseNumber: string;
  chapter: string;
  caseTitle: string;
  dateFiled: string;
  courtId: string;
  courtName: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  groupDesignator: string;
  regionId: string;
  regionName: string;
  officeName: string;
  officeCode: string;
  debtor: { name: string };
  closedDate?: string;
  reopenedDate?: string;
  movedToCaseId?: string;
  createdBy: { id: string; name: string };
  createdOn: string;
};

const SYSTEM_USER = { id: 'integration-test', name: 'Integration Test Harness' };
const CREATED_ON = '2024-01-01T00:00:00.000Z';

function makeCaseId(slot: number): string {
  return `TCF-24-${String(slot).padStart(5, '0')}`;
}

function makeAppointment(slot: number, overrides: Partial<AppointmentDoc> = {}): AppointmentDoc {
  const base: AppointmentDoc = {
    documentType: 'CASE_APPOINTMENT',
    caseId: makeCaseId(slot),
    trusteeId: TEST_TRUSTEE_ID,
    assignedOn: '2024-01-01T00:00:00.000Z',
    appointedDate: '2024-01-01',
    source: 'acms',
    createdBy: SYSTEM_USER,
    createdOn: CREATED_ON,
  };
  return { ...base, ...overrides };
}

function makeSyncedCase(
  slot: number,
  chapter: string,
  dateFiled: string,
  divisionCode: string,
  overrides: Partial<SyncedCaseDoc> = {},
): SyncedCaseDoc {
  const caseId = makeCaseId(slot);
  return {
    documentType: 'SYNCED_CASE',
    caseId,
    dxtrId: `DXTR-${caseId}`,
    caseNumber: caseId.replace('TCF-', ''),
    chapter,
    caseTitle: `Integration Test Case ${slot}`,
    dateFiled,
    courtId: 'TCF',
    courtName: 'Test Court for Integration',
    courtDivisionCode: divisionCode,
    courtDivisionName: `${divisionCode} Division`,
    groupDesignator: 'TCF',
    regionId: '99',
    regionName: 'Integration Test Region',
    officeName: 'Integration Test Office',
    officeCode: 'TCF',
    debtor: { name: `Debtor ${slot}` },
    createdBy: SYSTEM_USER,
    createdOn: CREATED_ON,
    ...overrides,
  };
}

function buildFixtures(): { appointments: AppointmentDoc[]; cases: SyncedCaseDoc[] } {
  const appointments: AppointmentDoc[] = [];
  const cases: SyncedCaseDoc[] = [];

  // Slots 1–500: bulk open Chapter 7 cases
  for (let i = 1; i <= 500; i++) {
    appointments.push(
      makeAppointment(i, {
        dateFiled: '2020-01-01',
        chapter: '7',
        courtDivisionCode: DIV_ALPHA,
        caseStatus: 'OPEN',
      }),
    );
    cases.push(makeSyncedCase(i, '7', '2020-01-01', DIV_ALPHA));
  }

  // Slot 501: Chapter 11, OPEN, DIV_BETA
  appointments.push(
    makeAppointment(501, {
      dateFiled: '2022-06-01',
      chapter: '11',
      courtDivisionCode: DIV_BETA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(makeSyncedCase(501, '11', '2022-06-01', DIV_BETA));

  // Slot 502: Chapter 13, OPEN, DIV_BETA
  appointments.push(
    makeAppointment(502, {
      dateFiled: '2023-03-15',
      chapter: '13',
      courtDivisionCode: DIV_BETA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(makeSyncedCase(502, '13', '2023-03-15', DIV_BETA));

  // Slot 503: Chapter 7, CLOSED, DIV_ALPHA
  appointments.push(
    makeAppointment(503, {
      dateFiled: '2021-09-10',
      chapter: '7',
      courtDivisionCode: DIV_ALPHA,
      caseStatus: 'CLOSED',
    }),
  );
  cases.push(makeSyncedCase(503, '7', '2021-09-10', DIV_ALPHA, { closedDate: '2023-01-01' }));

  // Slot 504: Chapter 11, CLOSED, DIV_GAMMA
  appointments.push(
    makeAppointment(504, {
      dateFiled: '2022-11-20',
      chapter: '11',
      courtDivisionCode: DIV_GAMMA,
      caseStatus: 'CLOSED',
    }),
  );
  cases.push(makeSyncedCase(504, '11', '2022-11-20', DIV_GAMMA, { closedDate: '2024-03-01' }));

  // Slot 505: Chapter 12, OPEN, DIV_GAMMA
  appointments.push(
    makeAppointment(505, {
      dateFiled: '2024-04-01',
      chapter: '12',
      courtDivisionCode: DIV_GAMMA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(makeSyncedCase(505, '12', '2024-04-01', DIV_GAMMA));

  // Slot 506: Chapter 7, OPEN, early filed date, DIV_ALPHA
  appointments.push(
    makeAppointment(506, {
      dateFiled: '2019-07-04',
      chapter: '7',
      courtDivisionCode: DIV_ALPHA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(makeSyncedCase(506, '7', '2019-07-04', DIV_ALPHA));

  // Slot 507: Chapter 13, OPEN, late filed date, DIV_BETA
  appointments.push(
    makeAppointment(507, {
      dateFiled: '2025-01-15',
      chapter: '13',
      courtDivisionCode: DIV_BETA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(makeSyncedCase(507, '13', '2025-01-15', DIV_BETA));

  // Slot 508: Chapter 7, OPEN, DIV_ALPHA — movedToCaseId set, appears as 'Case not available'
  appointments.push(
    makeAppointment(508, {
      dateFiled: '2023-08-08',
      chapter: '7',
      courtDivisionCode: DIV_ALPHA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(makeSyncedCase(508, '7', '2023-08-08', DIV_ALPHA, { movedToCaseId: makeCaseId(501) }));

  // Slot 509: Chapter 11, OPEN, DIV_GAMMA — closed then reopened (counts as OPEN)
  appointments.push(
    makeAppointment(509, {
      dateFiled: '2023-08-08',
      chapter: '11',
      courtDivisionCode: DIV_GAMMA,
      caseStatus: 'OPEN',
    }),
  );
  cases.push(
    makeSyncedCase(509, '11', '2023-08-08', DIV_GAMMA, {
      closedDate: '2024-01-01',
      reopenedDate: '2024-06-01',
    }),
  );

  // Slot 510: Chapter 7, OPEN, DIV_ALPHA — appointment is inactive (unassignedOn set)
  // This case should NEVER appear in any result set
  appointments.push(
    makeAppointment(510, {
      dateFiled: '2023-08-08',
      chapter: '7',
      courtDivisionCode: DIV_ALPHA,
      caseStatus: 'OPEN',
      unassignedOn: '2024-06-01T00:00:00.000Z',
    }),
  );
  cases.push(makeSyncedCase(510, '7', '2023-08-08', DIV_ALPHA));

  // Slot 511: No dateFiled on appointment — simulates legacy pre-migration doc, must NEVER appear
  appointments.push(makeAppointment(511));
  cases.push(makeSyncedCase(511, '7', '2021-01-01', DIV_ALPHA));

  return { appointments, cases };
}

// ---------------------------------------------------------------------------
// Env + DB connection
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(`Missing ${localEnvPath} — copy .env.local.template to .env.local first`);
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

async function getDb(): Promise<{
  client: MongoClient;
  appointments: Collection;
  cases: Collection;
}> {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName)
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);
  return {
    client,
    appointments: db.collection(APPOINTMENTS_COLLECTION),
    cases: db.collection(CASES_COLLECTION),
  };
}

async function getAppContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function pass(msg: string) {
  passCount++;
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string) {
  failCount++;
  console.error(`  ✗ FAIL: ${msg}`);
  process.exitCode = 1;
}

function assertCount(label: string, actual: number | undefined, expected: number) {
  if (actual === expected) {
    pass(`${label}: count = ${actual}`);
  } else {
    fail(`${label}: expected ${expected} but got ${actual}`);
  }
}

function assertNone(label: string, caseIds: string[], forbidden: string[]) {
  const found = caseIds.filter((id) => forbidden.includes(id));
  if (found.length === 0) {
    pass(`${label}: none of the forbidden case IDs appear`);
  } else {
    fail(`${label}: forbidden caseIds found in result: ${found.join(', ')}`);
  }
}

function assertAll(label: string, caseIds: string[], required: string[]) {
  const missing = required.filter((id) => !caseIds.includes(id));
  if (missing.length === 0) {
    pass(`${label}: all required caseIds present`);
  } else {
    fail(`${label}: missing caseIds: ${missing.join(', ')}`);
  }
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding trustee-case-filter fixtures...\n');
  const { client, appointments, cases } = await getDb();
  try {
    const { appointments: apptDocs, cases: caseDocs } = buildFixtures();

    // Drop existing test fixtures first (idempotent re-seed)
    const apptDeleteResult = await appointments.deleteMany({
      trusteeId: TEST_TRUSTEE_ID,
      documentType: 'CASE_APPOINTMENT',
    });
    const caseDeleteResult = await cases.deleteMany({
      caseId: { $regex: '^TCF-' },
      documentType: 'SYNCED_CASE',
    });
    console.log(
      `  Cleared ${apptDeleteResult.deletedCount} existing appointments, ${caseDeleteResult.deletedCount} existing cases`,
    );

    const apptResult = await appointments.insertMany(apptDocs as never[]);
    const caseResult = await cases.insertMany(caseDocs as never[]);

    // Create the composite indexes required by getCasesForTrustee.
    // The filter index covers the $match stage; the sort index satisfies
    // Cosmos DB's requirement for a composite index on ORDER BY dateFiled DESC, caseId ASC.
    // Without the sort index Cosmos returns: "The order by query does not have a
    // corresponding composite index that it can be served from."
    await appointments.createIndex(
      { unassignedOn: 1, dateFiled: 1, caseStatus: 1 },
      { name: 'unassignedOn_1_dateFiled_1_caseStatus_1' },
    );
    await appointments.createIndex({ dateFiled: -1, caseId: 1 }, { name: 'dateFiled_-1_caseId_1' });

    console.log(`  Inserted ${apptResult.insertedCount} appointments`);
    console.log(`  Inserted ${caseResult.insertedCount} cases`);
    console.log(`  Created composite filter index and sort index on ${APPOINTMENTS_COLLECTION}`);
    console.log('\nSeed complete.\n');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning trustee-case-filter fixtures...\n');
  const { client, appointments, cases } = await getDb();
  try {
    const apptResult = await appointments.deleteMany({
      trusteeId: TEST_TRUSTEE_ID,
      documentType: 'CASE_APPOINTMENT',
    });
    const caseResult = await cases.deleteMany({
      caseId: { $regex: '^TCF-' },
      documentType: 'SYNCED_CASE',
    });
    console.log(`  Deleted ${apptResult.deletedCount} appointments`);
    console.log(`  Deleted ${caseResult.deletedCount} cases`);
    console.log('\nClean complete.\n');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run — all assertions
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning trustee-case-filter assertions...\n');

  // Fast connectivity check — fails in ≤5s rather than the default 30s
  // if MongoDB is unreachable before we hand off to the use case layer.
  const { client: probeClient } = await getDb();
  await probeClient.close();

  const context = await getAppContext();
  const useCase = new TrusteeCasesUseCase();

  function predicate(
    overrides: Partial<TrusteeCasesSearchPredicate> = {},
  ): TrusteeCasesSearchPredicate {
    return { limit: 25, offset: 0, caseStatus: 'ALL', ...overrides };
  }

  // -------------------------------------------------------------------------
  // Test 1: No filters — all active appointments visible (>500 regression guard)
  // Slot 510 has unassignedOn set so it is excluded.
  // Slot 508 has movedToCaseId so it appears with caseTitle='Case not available'.
  // Expected: 509 total (511 slots minus slot 510 excluded by unassigned appt,
  // minus slot 511 excluded by dateFiled $exists true guard)
  // -------------------------------------------------------------------------
  console.log('Test 1: No filters — full result set (>500 regression guard)');
  {
    const result = await useCase.getCasesForTrustee(context, TEST_TRUSTEE_ID, predicate());
    assertCount('total cases (no filter)', result.metadata?.total, 509);
    assertNone(
      'unassigned appt excluded',
      result.data.map((c) => c.caseId),
      [makeCaseId(510)],
    );
    assertNone(
      'legacy doc (no dateFiled) excluded by $exists true guard',
      result.data.map((c) => c.caseId),
      [makeCaseId(511)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 1c: movedToCaseId case appears with sentinel display values
  // Slot 508 has movedToCaseId set. It is included in results but rendered
  // with caseTitle='Case not available' and courtDivisionName='' so the trustee
  // can observe its presence without displaying stale case data.
  // -------------------------------------------------------------------------
  console.log("\nTest 1c: movedToCaseId case appears as 'Case not available'");
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ limit: 509, offset: 0 }),
    );
    const slot508 = result.data.find((c) => c.caseId === makeCaseId(508));
    if (slot508 && slot508.caseTitle === 'Case not available' && slot508.courtDivisionName === '') {
      pass("moved case present with caseTitle='Case not available'");
    } else if (!slot508) {
      fail("moved case (slot 508) missing from results — should appear as 'Case not available'");
    } else {
      fail(
        `moved case has unexpected values: caseTitle='${slot508.caseTitle}', courtDivisionName='${slot508.courtDivisionName}'`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Test 1b-pre: sort composite index exists
  // Cosmos DB requires a composite index for ORDER BY dateFiled DESC, caseId ASC.
  // Without it: "The order by query does not have a corresponding composite index."
  // This assertion catches missing index before the sort query runs.
  // -------------------------------------------------------------------------
  console.log('\nTest 1b-pre: sort composite index (dateFiled DESC, caseId ASC) exists');
  {
    const { client: idxClient, appointments: idxAppts } = await getDb();
    try {
      const indexes = await idxAppts.indexes();
      const expectedSortKey = { dateFiled: -1, caseId: 1 };
      const hasSortIndex = indexes.some(
        (idx) => JSON.stringify(idx.key) === JSON.stringify(expectedSortKey),
      );
      if (hasSortIndex) {
        pass('sort composite index (dateFiled: -1, caseId: 1) present');
      } else {
        fail(
          'sort composite index MISSING — Cosmos will reject ORDER BY dateFiled DESC, caseId ASC. ' +
            'Check Bicep deployment for trustee-case-appointments collection.',
        );
      }
    } finally {
      await idxClient.close();
    }
  }

  // -------------------------------------------------------------------------
  // Test 1b: sort order — dateFiled DESC, caseId ASC
  // Chapter 11 cases: 501 (2022-06-01), 504 (2022-11-20), 509 (2023-08-08)
  // Expected order by dateFiled DESC: 509 → 504 → 501
  // -------------------------------------------------------------------------
  console.log('\nTest 1b: sort order — dateFiled DESC, caseId ASC');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ chapters: ['11'], limit: 10, offset: 0 }),
    );
    const ids = result.data.map((c) => c.caseId);
    if (ids[0] === makeCaseId(509) && ids[1] === makeCaseId(504) && ids[2] === makeCaseId(501)) {
      pass('sort order dateFiled DESC: 509 → 504 → 501');
    } else {
      fail(
        `sort order incorrect: expected [${makeCaseId(509)}, ${makeCaseId(504)}, ${makeCaseId(501)}], got [${ids.join(', ')}]`,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Test 2: caseStatus = OPEN
  // Open cases: slots 1–502, 505–509 (508 as 'Case not available', 509 closed+reopened)
  // Closed cases: 503, 504
  // Slot 510 excluded by unassigned appt, slot 511 excluded by dateFiled $exists guard
  // Expected open: 509 - 2 closed = 507
  // -------------------------------------------------------------------------
  console.log('\nTest 2: caseStatus = OPEN');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ caseStatus: 'OPEN' }),
    );
    assertCount('total OPEN cases', result.metadata?.total, 507);
    assertNone(
      'closed cases excluded',
      result.data.map((c) => c.caseId),
      [makeCaseId(503), makeCaseId(504)],
    );
    // The closed-then-reopened case (509) must be present
    const page1 = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ caseStatus: 'OPEN', limit: 509, offset: 0 }),
    );
    assertAll(
      'reopened case present in OPEN',
      page1.data.map((c) => c.caseId),
      [makeCaseId(509)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 3: caseStatus = CLOSED
  // Only slots 503 and 504 are closed (have closedDate, no reopenedDate >= closedDate)
  // -------------------------------------------------------------------------
  console.log('\nTest 3: caseStatus = CLOSED');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ caseStatus: 'CLOSED', limit: 25, offset: 0 }),
    );
    assertCount('total CLOSED cases', result.metadata?.total, 2);
    assertAll(
      'closed cases present',
      result.data.map((c) => c.caseId),
      [makeCaseId(503), makeCaseId(504)],
    );
    // Reopened case must NOT appear in CLOSED
    assertNone(
      'reopened case not in CLOSED',
      result.data.map((c) => c.caseId),
      [makeCaseId(509)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 4: chapter filter — chapter 11 only
  // Chapter 11 cases: 501, 504 (closed), 509 (reopened)
  // -------------------------------------------------------------------------
  console.log('\nTest 4: chapter = [11]');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ chapters: ['11'], limit: 25, offset: 0 }),
    );
    assertCount('total Chapter 11 cases', result.metadata?.total, 3);
    assertAll(
      'ch11 cases present',
      result.data.map((c) => c.caseId),
      [makeCaseId(501), makeCaseId(504), makeCaseId(509)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 5: chapter filter — multiple chapters [12, 13]
  // Chapter 12: slot 505
  // Chapter 13: slots 502, 507
  // -------------------------------------------------------------------------
  console.log('\nTest 5: chapter = [12, 13]');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ chapters: ['12', '13'], limit: 25, offset: 0 }),
    );
    assertCount('total Chapter 12+13 cases', result.metadata?.total, 3);
    assertAll(
      'ch12+13 cases present',
      result.data.map((c) => c.caseId),
      [makeCaseId(502), makeCaseId(505), makeCaseId(507)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 6: filedDateFrom filter — only cases filed on or after 2024-01-01
  // Qualifying: slots 1–500 (filed 2020, excluded), 505 (2024-04-01), 507 (2025-01-15)
  // Slot 509 filed 2023-08-08 — excluded
  // Expected: 505 + 507 = 2
  // -------------------------------------------------------------------------
  console.log('\nTest 6: filedDateFrom = 2024-01-01');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ filedDateFrom: '2024-01-01', limit: 25, offset: 0 }),
    );
    assertCount('cases filed >= 2024-01-01', result.metadata?.total, 2);
    assertAll(
      'expected cases present',
      result.data.map((c) => c.caseId),
      [makeCaseId(505), makeCaseId(507)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 7: filedDateTo filter — only cases filed on or before 2019-12-31
  // Only slot 506 (filed 2019-07-04) qualifies
  // -------------------------------------------------------------------------
  console.log('\nTest 7: filedDateTo = 2019-12-31');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ filedDateTo: '2019-12-31', limit: 25, offset: 0 }),
    );
    assertCount('cases filed <= 2019-12-31', result.metadata?.total, 1);
    assertAll(
      'slot 506 present',
      result.data.map((c) => c.caseId),
      [makeCaseId(506)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 8: filedDate range — between 2022-01-01 and 2022-12-31
  // Qualifying: 501 (2022-06-01), 504 (2022-11-20)
  // -------------------------------------------------------------------------
  console.log('\nTest 8: filedDate range 2022-01-01 to 2022-12-31');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ filedDateFrom: '2022-01-01', filedDateTo: '2022-12-31', limit: 25, offset: 0 }),
    );
    assertCount('cases in 2022 date range', result.metadata?.total, 2);
    assertAll(
      '2022 cases present',
      result.data.map((c) => c.caseId),
      [makeCaseId(501), makeCaseId(504)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 9: divisionCodes filter — DIV_GAMMA only
  // DIV_GAMMA cases: 504 (closed), 505 (ch12 open), 509 (reopened)
  // -------------------------------------------------------------------------
  console.log('\nTest 9: divisionCodes = [DIV_GAMMA]');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ divisionCodes: [DIV_GAMMA], limit: 25, offset: 0 }),
    );
    assertCount('DIV_GAMMA cases', result.metadata?.total, 3);
    assertAll(
      'gamma cases present',
      result.data.map((c) => c.caseId),
      [makeCaseId(504), makeCaseId(505), makeCaseId(509)],
    );
    assertNone(
      'alpha/beta not in gamma results',
      result.data.map((c) => c.caseId),
      [makeCaseId(501), makeCaseId(502)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 10: divisionCodes filter — multiple divisions [DIV_BETA, DIV_GAMMA]
  // DIV_BETA: 501, 502, 507
  // DIV_GAMMA: 504, 505, 509
  // -------------------------------------------------------------------------
  console.log('\nTest 10: divisionCodes = [DIV_BETA, DIV_GAMMA]');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ divisionCodes: [DIV_BETA, DIV_GAMMA], limit: 25, offset: 0 }),
    );
    assertCount('DIV_BETA + DIV_GAMMA cases', result.metadata?.total, 6);
  }

  // -------------------------------------------------------------------------
  // Test 11: combined filter — OPEN + chapter 11 + DIV_GAMMA
  // DIV_GAMMA ch11 OPEN: 509 (reopened counts as open)
  // DIV_GAMMA ch11 CLOSED: 504 — excluded by OPEN filter
  // -------------------------------------------------------------------------
  console.log('\nTest 11: combined — OPEN + chapter 11 + DIV_GAMMA');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ caseStatus: 'OPEN', chapters: ['11'], divisionCodes: [DIV_GAMMA] }),
    );
    assertCount('OPEN ch11 DIV_GAMMA', result.metadata?.total, 1);
    assertAll(
      'slot 509 present',
      result.data.map((c) => c.caseId),
      [makeCaseId(509)],
    );
    assertNone(
      'slot 504 excluded (closed)',
      result.data.map((c) => c.caseId),
      [makeCaseId(504)],
    );
  }

  // -------------------------------------------------------------------------
  // Test 12: pagination — page 2 of bulk cases
  // With no filter, there are 509 total. Page at offset 500, limit 25 → 9 results
  // -------------------------------------------------------------------------
  console.log('\nTest 12: pagination — offset 500 of full result set');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ limit: 25, offset: 500 }),
    );
    assertCount('page 2 result count', result.data.length, 9);
    assertCount('page 2 total metadata', result.metadata?.total, 509);
  }

  // -------------------------------------------------------------------------
  // Test 13: empty trustee — no appointments
  // -------------------------------------------------------------------------
  console.log('\nTest 13: trustee with no appointments → empty result');
  {
    const result = await useCase.getCasesForTrustee(context, 'nonexistent-trustee-id', predicate());
    assertCount('empty trustee total', result.metadata?.total, 0);
    assertCount('empty trustee data', result.data.length, 0);
  }

  // -------------------------------------------------------------------------
  // Test 14: appointedDate preserved on results
  // Slot 501 has appointedDate = '2024-01-01'
  // -------------------------------------------------------------------------
  console.log('\nTest 14: appointedDate preserved in result items');
  {
    const result = await useCase.getCasesForTrustee(
      context,
      TEST_TRUSTEE_ID,
      predicate({ chapters: ['11'], divisionCodes: [DIV_BETA] }),
    );
    const slot501 = result.data.find((c) => c.caseId === makeCaseId(501));
    if (!slot501) {
      fail('appointedDate: slot 501 not found in results');
    } else if (slot501.appointedDate === '2024-01-01') {
      pass('appointedDate = 2024-01-01 on slot 501');
    } else {
      fail(`appointedDate: expected 2024-01-01, got ${slot501.appointedDate}`);
    }
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.error('\nSome tests failed — see FAIL lines above.');
    process.exitCode = 1;
  } else {
    console.log('\nAll tests passed.');
  }

  await closeDeferred(context);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function help() {
  console.log(`
trustee-case-filter integration test harness

Usage (from test/integration/):
  npm run trustee-case-filter -- <command>

Commands:
  seed    Insert fixture documents into MongoDB
  run     Run all filter assertions against the use case
  clean   Remove all seeded fixture documents
  help    Show this help

Local workflow:
  1. cd trustee-case-filter/scripts && ./start-services.sh
  2. Copy .env.local.template to .env.local
  3. npm run trustee-case-filter -- seed
  4. npm run trustee-case-filter -- run
  5. npm run trustee-case-filter -- clean
  6. cd trustee-case-filter/scripts && ./stop-services.sh
`);
}

loadEnv();

const command = process.argv[2] ?? 'help';

(async () => {
  switch (command) {
    case 'seed':
      await seed();
      break;
    case 'run':
      await run();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default:
      help();
  }
})().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
