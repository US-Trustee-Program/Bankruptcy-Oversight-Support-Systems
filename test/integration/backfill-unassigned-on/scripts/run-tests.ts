/**
 * Integration test suite for BACKFILL-UNASSIGNED-ON's use case
 * (processBackfillPage / correctUnassignedOn / findSupersedingAppointment)
 * against a real MongoDB instance. No mocks: proves the cursor-paginated
 * query (findClosedAppointments), the dual-partition read/write
 * (getByCaseId / updateCaseAppointment), and the placeholder-exclusion
 * filters behave correctly under real Mongo semantics, not just against
 * unit-test doubles.
 *
 * Covers:
 *   - Correction applied: a soft-closed appointment with a wrong
 *     unassignedOn is corrected to one day before its superseding
 *     appointment's assignedOn, in BOTH partitions (case-trustee-appointments
 *     and trustee-case-appointments), since updateCaseAppointment dual-writes.
 *   - No-op: an already-correct record is left untouched (idempotency).
 *   - Skip: a closed appointment with no superseding appointment on the case
 *     is left untouched.
 *   - Placeholder exclusion: surrogate rows (isSurrogate: true) and legacy
 *     SENTINEL_TRUSTEE_ID rows are excluded both from the findClosedAppointments
 *     candidate query AND from findSupersedingAppointment's search — a
 *     surrogate/sentinel row must never be corrected itself, nor mistaken for
 *     a real superseding appointment.
 *   - Multi-appointment-per-case failure routing (the bug this integration
 *     test harness was written to catch): when a page contains TWO closed
 *     appointments for the SAME case and one of them fails, the failure must
 *     be matched back to the correct appointment by _id, not by caseId alone
 *     (which would silently misroute the retry to the wrong record). The
 *     failure itself is genuine, not simulated: one appointment's
 *     trustee-partition copy is deleted during seeding, so
 *     updateCaseAppointment's dual-write throws a real NotFoundError.
 *   - Pagination: cursor-based pagination on _id returns hasMore/nextCursor
 *     correctly across a page boundary.
 *
 * Usage (from test/integration/):
 *   npm run backfill-unassigned-on -- [command]
 *
 * Local workflow:
 *   1. cd backfill-unassigned-on/scripts && ./start-services.sh
 *   2. Create backfill-unassigned-on/.env.local with:
 *        MONGO_CONNECTION_STRING=mongodb://localhost:27017/cams-backfill-unassigned-on-integration?retrywrites=false
 *        COSMOS_DATABASE_NAME=cams-backfill-unassigned-on-integration
 *   3. npm run backfill-unassigned-on -- seed
 *   4. npm run backfill-unassigned-on -- run
 *   5. npm run backfill-unassigned-on -- clean
 *   6. cd backfill-unassigned-on/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Insert CASE_APPOINTMENT fixtures into both partition collections
 *   run     Run processBackfillPage / correctUnassignedOn assertions
 *   clean   Remove all fixture documents
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import BackfillUnassignedOnUseCase from '../../../../backend/lib/use-cases/dataflows/backfill-unassigned-on';
import { SENTINEL_TRUSTEE_ID } from '../../../../backend/lib/use-cases/dataflows/migrate-case-appointments-constants';
import { finalizeDeferrable } from '../../../../backend/lib/deferrable/finalize-deferrable';

const HARNESS_DIR = path.resolve(__dirname, '../');

const CASE_COLLECTION = 'case-trustee-appointments';
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} — create it with MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME set (see the usage header at the top of this file).`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

loadEnv();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string) {
  console.error(`  ✗ FAIL: ${msg}`);
  process.exitCode = 1;
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual === expected) {
    pass(`${msg} (${String(actual)})`);
  } else {
    fail(`${msg} — expected ${String(expected)}, got ${String(actual)}`);
  }
}

function info(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

async function getMongoClient() {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function getAppContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const NOW = new Date().toISOString();

// Scenario A: needs correction — wrong unassignedOn, real superseding appointment exists.
const CASE_A = 'integration-backfill-case-a';
const TRUSTEE_A1 = 'integration-backfill-trustee-a1';
const TRUSTEE_A2 = 'integration-backfill-trustee-a2';

// Scenario B: already correct — must be a no-op (idempotency).
const CASE_B = 'integration-backfill-case-b';
const TRUSTEE_B1 = 'integration-backfill-trustee-b1';
const TRUSTEE_B2 = 'integration-backfill-trustee-b2';

// Scenario C: no superseding appointment — closed is the terminal appointment on the case.
const CASE_C = 'integration-backfill-case-c';
const TRUSTEE_C1 = 'integration-backfill-trustee-c1';

// Scenario D: placeholder exclusion — a surrogate row and a sentinel row sit between the
// closed appointment and the real superseding one; neither must be picked as superseding,
// and the surrogate/sentinel rows themselves must not appear as backfill candidates.
const CASE_D = 'integration-backfill-case-d';
const TRUSTEE_D1 = 'integration-backfill-trustee-d1';
const TRUSTEE_D2 = 'integration-backfill-trustee-d2';

// Scenario E: multi-appointment-per-case failure routing — TWO closed appointments on the
// SAME case in one page, one of which fails. Proves failedResults carries the correct _id
// so the caller (handlePage in the function app) matches the failure back to the RIGHT
// appointment, not just "the first appointment found for this caseId".
const CASE_E = 'integration-backfill-case-e';
const TRUSTEE_E1 = 'integration-backfill-trustee-e1';
const TRUSTEE_E2 = 'integration-backfill-trustee-e2';
const TRUSTEE_E3 = 'integration-backfill-trustee-e3';

const ALL_CASE_IDS = [CASE_A, CASE_B, CASE_C, CASE_D, CASE_E];

function baseAppointmentFields(caseId: string, trusteeId: string, assignedOn: string) {
  return {
    documentType: 'CASE_APPOINTMENT' as const,
    caseId,
    trusteeId,
    assignedOn,
    appointedDate: assignedOn,
    dateFiled: '2023-01-01',
    courtDivisionCode: '081',
    createdOn: NOW,
    createdBy: { id: 'integration-test', name: 'Integration Test' },
    updatedOn: NOW,
    updatedBy: { id: 'integration-test', name: 'Integration Test' },
  };
}

// Writes the same logical appointment into BOTH partitions, matching what
// upsert()/updateCaseAppointment() maintain in production — findClosedAppointments
// and getByCaseId both read from the case partition, but updateCaseAppointment
// dual-writes both, so both must be seeded for the harness to look like real data.
async function insertAppointment(
  db: Awaited<ReturnType<typeof getMongoClient>>['db'],
  id: string,
  fields: Record<string, unknown>,
) {
  const doc = { id, ...fields };
  await db.collection(CASE_COLLECTION).insertOne({ ...doc });
  await db.collection(TRUSTEE_COLLECTION).insertOne({ ...doc });
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding integration test fixtures...\n');
  const { client, db } = await getMongoClient();
  try {
    // Scenario A: closed appointment with WRONG unassignedOn; real superseding appointment
    // assignedOn='2025-02-01' means correct unassignedOn is '2025-01-31'.
    await insertAppointment(db, 'a-closed', {
      ...baseAppointmentFields(CASE_A, TRUSTEE_A1, '2025-01-01'),
      unassignedOn: '2025-06-15', // wrong — old wall-clock-time bug
    });
    await insertAppointment(db, 'a-superseding', {
      ...baseAppointmentFields(CASE_A, TRUSTEE_A2, '2025-02-01'),
    });
    pass(`Seeded scenario A (needs correction): case=${CASE_A}`);

    // Scenario B: closed appointment already has the CORRECT unassignedOn.
    await insertAppointment(db, 'b-closed', {
      ...baseAppointmentFields(CASE_B, TRUSTEE_B1, '2025-01-01'),
      unassignedOn: '2025-01-31', // already correct
    });
    await insertAppointment(db, 'b-superseding', {
      ...baseAppointmentFields(CASE_B, TRUSTEE_B2, '2025-02-01'),
    });
    pass(`Seeded scenario B (already correct, no-op expected): case=${CASE_B}`);

    // Scenario C: closed appointment with no superseding appointment on the case.
    await insertAppointment(db, 'c-closed', {
      ...baseAppointmentFields(CASE_C, TRUSTEE_C1, '2025-01-01'),
      unassignedOn: '2025-06-15',
    });
    pass(`Seeded scenario C (no superseding appointment, skip expected): case=${CASE_C}`);

    // Scenario D: closed appointment, then a surrogate row, then a sentinel row, then the
    // REAL superseding appointment — the real one (assignedOn='2025-04-01') must be found,
    // not the surrogate/sentinel rows in between. Correct unassignedOn = '2025-03-31'.
    await insertAppointment(db, 'd-closed', {
      ...baseAppointmentFields(CASE_D, TRUSTEE_D1, '2025-01-01'),
      unassignedOn: '2025-06-15',
    });
    // unassignedOn is set on both placeholder rows (even though production would never soft-close
    // a surrogate/sentinel row this way) specifically so findClosedAppointments' own query has to
    // exclude them via the trusteeId/isSurrogate conditions, not via unassignedOn.exists() — a
    // regression that dropped either condition from the query would otherwise pass Stage 1
    // undetected, since these rows would already fail unassignedOn.exists() on their own.
    await insertAppointment(db, 'd-surrogate', {
      ...baseAppointmentFields(CASE_D, 'fingerprint-marker-d', '2025-02-01'),
      isSurrogate: true,
      unassignedOn: '2025-06-15',
    });
    await insertAppointment(db, 'd-sentinel', {
      ...baseAppointmentFields(CASE_D, SENTINEL_TRUSTEE_ID, '2025-03-01'),
      unassignedOn: '2025-06-15',
    });
    await insertAppointment(db, 'd-superseding', {
      ...baseAppointmentFields(CASE_D, TRUSTEE_D2, '2025-04-01'),
    });
    pass(
      `Seeded scenario D (placeholder exclusion): case=${CASE_D} (surrogate + sentinel rows must be skipped over)`,
    );

    // Scenario E: TWO closed appointments on the SAME case, both needing correction. One
    // (e-closed-2) is set up to genuinely fail during 'run' via real Mongo semantics — its
    // trustee-partition copy is deleted right after seeding, so findClosedAppointments/getByCaseId
    // (both case-partition reads) see it as a normal candidate, but updateCaseAppointment's
    // dual-write throws a real NotFoundError on the trustee-partition replaceOne (0 matches),
    // after the case-partition write has already succeeded — proving the failure is matched back
    // to e-closed-2 specifically, not silently attributed to e-closed-1.
    await insertAppointment(db, 'e-closed-1', {
      ...baseAppointmentFields(CASE_E, TRUSTEE_E1, '2025-01-01'),
      unassignedOn: '2025-06-15',
    });
    await insertAppointment(db, 'e-closed-2', {
      ...baseAppointmentFields(CASE_E, TRUSTEE_E2, '2025-01-05'),
      unassignedOn: '2025-06-16',
    });
    await db.collection(TRUSTEE_COLLECTION).deleteOne({ id: 'e-closed-2' });
    await insertAppointment(db, 'e-superseding', {
      ...baseAppointmentFields(CASE_E, TRUSTEE_E3, '2025-02-01'),
    });
    pass(`Seeded scenario E (multi-appointment-per-case failure routing): case=${CASE_E}`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning processBackfillPage assertions...\n');

  const context = await getAppContext();
  try {
    await runStages(context);
  } finally {
    // processBackfillPage (via factory.getTrusteeCaseAppointmentsRepository) opens a real Mongo
    // client through the deferRelease mechanism, same as a controller would — without this, the
    // client is never closed and the process hangs after printing results instead of exiting on
    // its own (Node waits for the event loop to drain).
    await finalizeDeferrable(context);
  }
}

async function runStages(context: Awaited<ReturnType<typeof getAppContext>>) {
  // ── Stage 1: processBackfillPage — the real orchestration function ─────
  // Exercises the actual code path the Azure Function handler calls end to end (fetch, then
  // correct), rather than calling getPageNeedingBackfill/correctUnassignedOn directly as separate
  // pieces — this is what actually proves processBackfillPage itself correctly assembles
  // failedResults/nextCursor/successCount, not just that its constituent functions work in
  // isolation. limit=100 is large enough to fetch every seeded candidate (8) in one page, so this
  // single call also performs every scenario's correction; Stages 2-6 below verify outcomes by
  // reading the DB afterward.
  console.log('Stage 1: processBackfillPage — fetch and correct every seeded candidate\n');
  const pageResult = await BackfillUnassignedOnUseCase.processBackfillPage(context, null, 100);
  if (pageResult.status !== 'ok') {
    fail(`processBackfillPage: expected status 'ok', got '${pageResult.status}'`);
    return;
  }
  info(`processBackfillPage processed ${pageResult.appointments.length} candidate(s) in this run`);

  const processedIds = new Set(pageResult.appointments.map((a) => a.id));
  assertEqual(
    processedIds.has('d-surrogate'),
    false,
    'surrogate row (isSurrogate: true) excluded from processBackfillPage candidates',
  );
  assertEqual(
    processedIds.has('d-sentinel'),
    false,
    'sentinel row (SENTINEL_TRUSTEE_ID) excluded from processBackfillPage candidates',
  );
  assertEqual(
    processedIds.has('a-closed'),
    true,
    'scenario A real closed appointment IS included as a candidate',
  );
  assertEqual(
    pageResult.successCount,
    pageResult.appointments.length - pageResult.failedResults.length,
    'processBackfillPage: successCount matches appointments minus failedResults',
  );

  // ── Stage 2: scenario A (needed correction) ─────────────────────────────
  console.log('\nStage 2: scenario A (needed correction)\n');
  {
    const { client, db } = await getMongoClient();
    try {
      const updatedCasePartition = await db.collection(CASE_COLLECTION).findOne({ id: 'a-closed' });
      const updatedTrusteePartition = await db
        .collection(TRUSTEE_COLLECTION)
        .findOne({ id: 'a-closed' });
      assertEqual(
        updatedCasePartition?.unassignedOn,
        '2025-01-31',
        'scenario A: case-partition unassignedOn corrected to one day before superseding assignedOn',
      );
      assertEqual(
        updatedTrusteePartition?.unassignedOn,
        '2025-01-31',
        'scenario A: trustee-partition unassignedOn ALSO corrected (dual-write via updateCaseAppointment)',
      );
    } finally {
      await client.close();
    }
  }

  // ── Stage 3: scenario B (already correct, no-op) ────────────────────────
  console.log('\nStage 3: scenario B (idempotency / no-op)\n');
  {
    const { client, db } = await getMongoClient();
    try {
      const doc = await db.collection(CASE_COLLECTION).findOne({ id: 'b-closed' });
      assertEqual(
        doc?.unassignedOn,
        '2025-01-31',
        'scenario B: unassignedOn unchanged (was already correct)',
      );
    } finally {
      await client.close();
    }
  }

  // ── Stage 4: scenario C (no superseding, skip) ──────────────────────────
  console.log('\nStage 4: scenario C (no superseding appointment)\n');
  {
    const { client, db } = await getMongoClient();
    try {
      const doc = await db.collection(CASE_COLLECTION).findOne({ id: 'c-closed' });
      assertEqual(
        doc?.unassignedOn,
        '2025-06-15',
        'scenario C: unassignedOn left untouched — nothing to correct against',
      );
    } finally {
      await client.close();
    }
  }

  // ── Stage 5: scenario D (placeholder exclusion) ─────────────────────────
  console.log('\nStage 5: scenario D (skips surrogate/sentinel rows)\n');
  {
    const { client, db } = await getMongoClient();
    try {
      const doc = await db.collection(CASE_COLLECTION).findOne({ id: 'd-closed' });
      assertEqual(
        doc?.unassignedOn,
        '2025-03-31',
        "scenario D: corrected against the REAL superseding appointment (assignedOn='2025-04-01'), not the surrogate or sentinel row in between",
      );
    } finally {
      await client.close();
    }
  }

  // ── Stage 6: multi-appointment-per-case failure routing (scenario E) ───
  console.log('\nStage 6: multi-appointment-per-case failure routing (scenario E)\n');
  const scenarioEAppointments = pageResult.appointments.filter((a) => a.caseId === CASE_E);
  assertEqual(
    scenarioEAppointments.length,
    2,
    'scenario E: both closed appointments for the case are present in the page',
  );

  const eClosed1 = scenarioEAppointments.find((a) => a.id === 'e-closed-1');
  const eClosed2 = scenarioEAppointments.find((a) => a.id === 'e-closed-2');
  if (!eClosed1 || !eClosed2) {
    fail('scenario E: expected both e-closed-1 and e-closed-2 in the page');
  } else {
    // e-closed-2's trustee-partition copy was deleted during seed(), so updateCaseAppointment's
    // dual-write throws a real NotFoundError on that partition's replaceOne (0 matches) — a
    // genuine, unmocked write failure surfaced through processBackfillPage itself.
    const eClosed1Failed = pageResult.failedResults.some((r) => r._id === eClosed1._id);
    const result2 = pageResult.failedResults.find((r) => r._id === eClosed2._id);

    assertEqual(eClosed1Failed, false, 'scenario E: e-closed-1 succeeds normally');

    if (!result2) {
      fail(
        'scenario E: expected e-closed-2 (missing trustee-partition copy) to fail so the routing fix could be exercised, but nothing failed',
      );
    } else {
      info(`e-closed-2 result: error=${result2.error ?? 'none'}`);

      // The critical assertion this scenario exists for: each BackfillResult carries the
      // appointment's OWN _id (not just its shared caseId), so a caller (handlePage) can match
      // a failure back to the exact appointment that failed — even when two appointments on
      // the same page share a caseId. Before the fix, BackfillResult had no _id field at all,
      // and handlePage matched failures back to appointments via
      // `appointments.find(a => a.caseId === r.caseId)`, which — for scenario E — would always
      // resolve to e-closed-1 (the first appointment found for CASE_E), even when e-closed-2 is
      // the one that actually failed.
      assertEqual(
        result2._id,
        eClosed2._id,
        "scenario E: failure result carries e-closed-2's own _id (NOT e-closed-1's) — this is what lets a caller distinguish which of two same-case appointments actually failed",
      );

      // Simulate handlePage's (fixed) matching logic directly: match the failure back to its
      // originating appointment by _id, and confirm it resolves to the RIGHT one.
      const matched = [eClosed1, eClosed2].find((a) => a._id === result2._id);
      assertEqual(
        matched?.id,
        eClosed2.id,
        'scenario E: _id-based matching in handlePage resolves the failure to e-closed-2, not e-closed-1',
      );
    }
  }

  // ── Stage 7: pagination — cursor advances correctly ─────────────────────
  console.log('\nStage 7: pagination — cursor-based pagination on _id\n');
  const firstPage = await BackfillUnassignedOnUseCase.getPageNeedingBackfill(context, null, 2);
  assertEqual(firstPage.error, undefined, 'pagination: first page reads without error');
  assertEqual(firstPage.data?.appointments.length, 2, 'pagination: first page respects limit');
  assertEqual(
    firstPage.data?.hasMore,
    true,
    'pagination: hasMore is true when more candidates exist',
  );

  if (firstPage.data?.lastId) {
    const secondPage = await BackfillUnassignedOnUseCase.getPageNeedingBackfill(
      context,
      firstPage.data.lastId,
      100,
    );
    assertEqual(secondPage.error, undefined, 'pagination: second page reads without error');
    // _id is typed string but is a Mongo ObjectId at runtime; firstPage/secondPage come from two
    // independent find() calls and deserialize into distinct ObjectId instances even for the same
    // underlying value, so comparing with === (reference equality) can never detect a real
    // overlap. Stringify both sides first.
    const overlap = secondPage.data?.appointments.some((a) =>
      firstPage.data!.appointments.some((f) => String(f._id) === String(a._id)),
    );
    assertEqual(overlap, false, 'pagination: second page has no overlap with the first page');
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up integration test data...\n');
  const { client, db } = await getMongoClient();
  try {
    const r1 = await db.collection(CASE_COLLECTION).deleteMany({
      documentType: 'CASE_APPOINTMENT',
      caseId: { $in: ALL_CASE_IDS },
    });
    const r2 = await db.collection(TRUSTEE_COLLECTION).deleteMany({
      documentType: 'CASE_APPOINTMENT',
      caseId: { $in: ALL_CASE_IDS },
    });
    pass(
      `Deleted ${r1.deletedCount} case-partition and ${r2.deletedCount} trustee-partition document(s)`,
    );
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('BACKFILL-UNASSIGNED-ON — Integration Test');
  console.log('='.repeat(60));

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
    default: {
      const HARNESS = 'npm run backfill-unassigned-on --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  ${HARNESS} <command>`);
      console.log('\nLocal workflow:');
      console.log('  1. ./backfill-unassigned-on/scripts/start-services.sh');
      console.log(
        '  2. Create backfill-unassigned-on/.env.local with MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME',
      );
      console.log(`  3. ${HARNESS} seed`);
      console.log(`  4. ${HARNESS} run`);
      console.log(`  5. ${HARNESS} clean`);
      console.log('  6. ./backfill-unassigned-on/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  seed    Insert CASE_APPOINTMENT fixtures into both partition collections');
      console.log('  run     Run processBackfillPage/correctUnassignedOn assertions');
      console.log('  clean   Remove seeded data');
      console.log('  help    Show this help');
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
