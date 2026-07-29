/**
 * Integration test suite for FIX-CHAPTER-7-APPOINTMENTS's repository layer —
 * findAppointmentIdPairsByChapter and applyChapterFix — against a real
 * MongoDB instance. No mocks: proves the aggregate pipeline ($lookup,
 * $arrayElemAt, $filter, ObjectId $in coercion) and the drift-repair path
 * behave correctly under real Mongo semantics, not just against unit-test
 * doubles.
 *
 * Covers:
 *   - Exact match: trustee-partition doc with a case-partition counterpart
 *     sharing (caseId, trusteeId, assignedOn) is found and both _ids returned.
 *   - No false match: a case-partition doc sharing caseId but a DIFFERENT
 *     trusteeId/assignedOn (a different appointment on the same case) is
 *     correctly excluded — proves the $lookup-then-$filter narrowing doesn't
 *     over-match on the indexed caseId join alone.
 *   - Partition-parity drift: a trustee-partition doc with NO case-partition
 *     counterpart returns caseApptId: null instead of being silently dropped.
 *   - Drift repair: applyChapterFix('rename', ...) creates the missing
 *     case-partition document with the corrected chapter already set.
 *   - Delete + drift: applyChapterFix('delete', ...) is a no-op on the case
 *     side when caseApptId is null (nothing to delete).
 *   - ObjectId $in coercion: applyChapterFix correctly matches/updates
 *     documents by their real Mongo-assigned _id (not just a string that
 *     happens to look like one).
 *   - Idempotency: re-running applyChapterFix after a successful fix matches
 *     zero documents (they no longer carry matchChapter).
 *
 * Usage (from test/integration/):
 *   npm run fix-chapter-7-appointments -- [command]
 *
 * Local workflow:
 *   1. cd fix-chapter-7-appointments/scripts && ./start-services.sh
 *   2. Copy .env.local.template to .env.local
 *   3. npm run fix-chapter-7-appointments -- seed
 *   4. npm run fix-chapter-7-appointments -- run
 *   5. npm run fix-chapter-7-appointments -- clean
 *   6. cd fix-chapter-7-appointments/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Insert CASE_APPOINTMENT fixtures into both partition collections
 *   run     Run findAppointmentIdPairsByChapter/applyChapterFix assertions
 *   clean   Remove all fixture documents
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient, ObjectId } from 'mongodb';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';

const HARNESS_DIR = path.resolve(__dirname, '../');

const CASE_COLLECTION = 'case-trustee-appointments';
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(`Missing ${localEnvPath} — copy .env.local.template to .env.local first`);
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

// Scenario A: exact match — both partitions have the appointment, trustee side
// carries the raw legacy chapter '7A'.
const CASE_A = 'integration-fix7-case-a';
const TRUSTEE_A = 'integration-fix7-trustee-a';
const ASSIGNED_ON_A = '2024-01-01';

// Scenario B: same caseId as A, but a DIFFERENT trustee/assignedOn — proves
// the $lookup-then-$filter narrowing doesn't over-match on caseId alone.
const TRUSTEE_B = 'integration-fix7-trustee-b';
const ASSIGNED_ON_B = '2024-06-01';

// Scenario C: partition-parity drift — trustee partition has the doc, case
// partition does NOT.
const CASE_C = 'integration-fix7-case-c';
const TRUSTEE_C = 'integration-fix7-trustee-c';
const ASSIGNED_ON_C = '2024-03-01';

// Scenario D: delete + drift — trustee partition has a chapter='AC' doc with
// no case-partition counterpart.
const CASE_D = 'integration-fix7-case-d';
const TRUSTEE_D = 'integration-fix7-trustee-d';
const ASSIGNED_ON_D = '2024-09-01';

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

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding integration test fixtures...\n');
  const { client, db } = await getMongoClient();
  try {
    // Scenario A: present in both partitions, chapter '7A'.
    const idA = new ObjectId();
    await db.collection(TRUSTEE_COLLECTION).insertOne({
      _id: idA,
      id: 'app-id-a-trustee',
      ...baseAppointmentFields(CASE_A, TRUSTEE_A, ASSIGNED_ON_A),
      chapter: '7A',
    });
    await db.collection(CASE_COLLECTION).insertOne({
      id: 'app-id-a-case',
      ...baseAppointmentFields(CASE_A, TRUSTEE_A, ASSIGNED_ON_A),
      chapter: '7A',
    });
    pass(`Seeded scenario A (exact match): case=${CASE_A} trustee=${TRUSTEE_A}`);

    // Scenario B: same caseId as A, different trustee/assignedOn, chapter '7A'
    // present in both partitions — must NOT be matched to A's case-partition doc.
    await db.collection(TRUSTEE_COLLECTION).insertOne({
      id: 'app-id-b-trustee',
      ...baseAppointmentFields(CASE_A, TRUSTEE_B, ASSIGNED_ON_B),
      chapter: '7A',
    });
    await db.collection(CASE_COLLECTION).insertOne({
      id: 'app-id-b-case',
      ...baseAppointmentFields(CASE_A, TRUSTEE_B, ASSIGNED_ON_B),
      chapter: '7A',
    });
    pass(`Seeded scenario B (same caseId, different trustee): trustee=${TRUSTEE_B}`);

    // Scenario C: trustee partition only — case partition intentionally missing
    // (partition-parity drift), chapter '7N'.
    await db.collection(TRUSTEE_COLLECTION).insertOne({
      id: 'app-id-c-trustee',
      ...baseAppointmentFields(CASE_C, TRUSTEE_C, ASSIGNED_ON_C),
      chapter: '7N',
    });
    pass(
      `Seeded scenario C (drift, rename): case=${CASE_C} trustee=${TRUSTEE_C} (case partition intentionally absent)`,
    );

    // Scenario D: trustee partition only, chapter 'AC' (delete), case partition
    // intentionally missing.
    await db.collection(TRUSTEE_COLLECTION).insertOne({
      id: 'app-id-d-trustee',
      ...baseAppointmentFields(CASE_D, TRUSTEE_D, ASSIGNED_ON_D),
      chapter: 'AC',
    });
    pass(
      `Seeded scenario D (drift, delete): case=${CASE_D} trustee=${TRUSTEE_D} (case partition intentionally absent)`,
    );
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning findAppointmentIdPairsByChapter / applyChapterFix assertions...\n');

  const context = await getAppContext();
  const repo = factory.getTrusteeCaseAppointmentsRepository(context);

  // ── '7A' stream: scenarios A and B ──────────────────────────────────────
  console.log("Stage 1: findAppointmentIdPairsByChapter('7A', 100)\n");
  const pairs7A = await repo.findAppointmentIdPairsByChapter('7A', 100);
  info(`Found ${pairs7A.length} pair(s) for chapter '7A'`);

  assertEqual(pairs7A.length, 2, "exactly 2 pairs found for chapter '7A' (scenarios A + B)");

  // Fetch the raw seeded docs to know their real _ids for assertions.
  const { client: rawClient, db: rawDb } = await getMongoClient();
  let trusteeADoc: { _id: ObjectId } | null;
  let caseADoc: { _id: ObjectId } | null;
  let trusteeBDoc: { _id: ObjectId } | null;
  let caseBDoc: { _id: ObjectId } | null;
  try {
    trusteeADoc = await rawDb
      .collection(TRUSTEE_COLLECTION)
      .findOne({ caseId: CASE_A, trusteeId: TRUSTEE_A, assignedOn: ASSIGNED_ON_A });
    caseADoc = await rawDb
      .collection(CASE_COLLECTION)
      .findOne({ caseId: CASE_A, trusteeId: TRUSTEE_A, assignedOn: ASSIGNED_ON_A });
    trusteeBDoc = await rawDb
      .collection(TRUSTEE_COLLECTION)
      .findOne({ caseId: CASE_A, trusteeId: TRUSTEE_B, assignedOn: ASSIGNED_ON_B });
    caseBDoc = await rawDb
      .collection(CASE_COLLECTION)
      .findOne({ caseId: CASE_A, trusteeId: TRUSTEE_B, assignedOn: ASSIGNED_ON_B });
  } finally {
    await rawClient.close();
  }

  if (!trusteeADoc || !caseADoc || !trusteeBDoc || !caseBDoc) {
    fail('Could not find seeded scenario A/B documents — did you run seed first?');
    return;
  }

  const pairForA = pairs7A.find((p) => p.trusteeApptId === trusteeADoc!._id.toString());
  const pairForB = pairs7A.find((p) => p.trusteeApptId === trusteeBDoc!._id.toString());

  if (pairForA) {
    assertEqual(
      pairForA.caseApptId,
      caseADoc._id.toString(),
      'scenario A: trustee doc correctly paired with its own case-partition doc',
    );
  } else {
    fail('scenario A: expected pair not found in findAppointmentIdPairsByChapter results');
  }

  if (pairForB) {
    assertEqual(
      pairForB.caseApptId,
      caseBDoc._id.toString(),
      "scenario B: trustee doc correctly paired with ITS OWN case-partition doc, not scenario A's (proves no over-matching on shared caseId)",
    );
  } else {
    fail('scenario B: expected pair not found in findAppointmentIdPairsByChapter results');
  }

  // ── '7N' stream: scenario C (drift) ─────────────────────────────────────
  console.log("\nStage 2: findAppointmentIdPairsByChapter('7N', 100) — partition drift\n");
  const pairs7N = await repo.findAppointmentIdPairsByChapter('7N', 100);
  assertEqual(pairs7N.length, 1, "exactly 1 pair found for chapter '7N' (scenario C)");
  if (pairs7N.length === 1) {
    assertEqual(
      pairs7N[0].caseApptId,
      null,
      'scenario C: caseApptId is null (no silent drop) for a trustee doc with no case-partition counterpart',
    );
  }

  // ── 'AC' stream: scenario D (delete + drift) ────────────────────────────
  console.log("\nStage 3: findAppointmentIdPairsByChapter('AC', 100) — delete + drift\n");
  const pairsAC = await repo.findAppointmentIdPairsByChapter('AC', 100);
  assertEqual(pairsAC.length, 1, "exactly 1 pair found for chapter 'AC' (scenario D)");
  if (pairsAC.length === 1) {
    assertEqual(pairsAC[0].caseApptId, null, 'scenario D: caseApptId is null');
  }

  // ── applyChapterFix: rename with exact matches (A, B) ───────────────────
  console.log("\nStage 4: applyChapterFix(pairs7A, 'rename', '7A', '7')\n");
  const renameResult = await repo.applyChapterFix(pairs7A, 'rename', '7A', '7');
  assertEqual(
    renameResult.modifiedCount,
    2,
    'applyChapterFix reports 2 trustee-partition documents modified',
  );

  const { client: verifyClient1, db: verifyDb1 } = await getMongoClient();
  try {
    const updatedTrusteeA = await verifyDb1
      .collection(TRUSTEE_COLLECTION)
      .findOne({ _id: trusteeADoc._id });
    const updatedCaseA = await verifyDb1.collection(CASE_COLLECTION).findOne({ _id: caseADoc._id });
    const updatedTrusteeB = await verifyDb1
      .collection(TRUSTEE_COLLECTION)
      .findOne({ _id: trusteeBDoc._id });
    const updatedCaseB = await verifyDb1.collection(CASE_COLLECTION).findOne({ _id: caseBDoc._id });

    assertEqual(
      updatedTrusteeA?.chapter,
      '7',
      'scenario A: trustee-partition chapter updated to 7',
    );
    assertEqual(updatedCaseA?.chapter, '7', 'scenario A: case-partition chapter updated to 7');
    assertEqual(
      updatedTrusteeB?.chapter,
      '7',
      'scenario B: trustee-partition chapter updated to 7',
    );
    assertEqual(updatedCaseB?.chapter, '7', 'scenario B: case-partition chapter updated to 7');
  } finally {
    await verifyClient1.close();
  }

  // ── applyChapterFix: rename with drift repair (C) ───────────────────────
  console.log("\nStage 5: applyChapterFix(pairs7N, 'rename', '7N', '7') — drift repair\n");
  await repo.applyChapterFix(pairs7N, 'rename', '7N', '7');

  const { client: verifyClient2, db: verifyDb2 } = await getMongoClient();
  try {
    const repairedCaseDoc = await verifyDb2
      .collection(CASE_COLLECTION)
      .findOne({ caseId: CASE_C, trusteeId: TRUSTEE_C, assignedOn: ASSIGNED_ON_C });

    if (repairedCaseDoc) {
      pass('scenario C: missing case-partition document was created (drift repaired)');
      assertEqual(
        repairedCaseDoc.chapter,
        '7',
        'scenario C: repaired case-partition document has the CORRECTED chapter (not the old 7N)',
      );
      assertEqual(
        repairedCaseDoc.documentType,
        'CASE_APPOINTMENT',
        'scenario C: repaired document has correct documentType',
      );
    } else {
      fail('scenario C: case-partition document was NOT created — drift repair failed');
    }

    const updatedTrusteeC = await verifyDb2
      .collection(TRUSTEE_COLLECTION)
      .findOne({ caseId: CASE_C, trusteeId: TRUSTEE_C, assignedOn: ASSIGNED_ON_C });
    assertEqual(
      updatedTrusteeC?.chapter,
      '7',
      'scenario C: trustee-partition chapter also updated to 7',
    );
  } finally {
    await verifyClient2.close();
  }

  // ── applyChapterFix: delete with drift (D) — no-op on case side ─────────
  console.log("\nStage 6: applyChapterFix(pairsAC, 'delete', 'AC') — delete + drift no-op\n");
  const deleteResult = await repo.applyChapterFix(pairsAC, 'delete', 'AC');
  assertEqual(
    deleteResult.modifiedCount,
    1,
    'applyChapterFix reports 1 trustee-partition document deleted',
  );

  const { client: verifyClient3, db: verifyDb3 } = await getMongoClient();
  try {
    const deletedTrusteeD = await verifyDb3
      .collection(TRUSTEE_COLLECTION)
      .findOne({ caseId: CASE_D, trusteeId: TRUSTEE_D, assignedOn: ASSIGNED_ON_D });
    assertEqual(deletedTrusteeD, null, 'scenario D: trustee-partition document was deleted');

    const caseDCount = await verifyDb3
      .collection(CASE_COLLECTION)
      .countDocuments({ caseId: CASE_D });
    assertEqual(
      caseDCount,
      0,
      'scenario D: no case-partition document was created (nothing to delete)',
    );
  } finally {
    await verifyClient3.close();
  }

  // ── Idempotency: re-running after a successful fix finds nothing ───────
  console.log('\nStage 7: idempotency — re-querying after fixes finds zero remaining matches\n');
  const remaining7A = await repo.findAppointmentIdPairsByChapter('7A', 100);
  const remaining7N = await repo.findAppointmentIdPairsByChapter('7N', 100);
  const remainingAC = await repo.findAppointmentIdPairsByChapter('AC', 100);
  assertEqual(remaining7A.length, 0, "re-querying '7A' after fix finds 0 remaining documents");
  assertEqual(remaining7N.length, 0, "re-querying '7N' after fix finds 0 remaining documents");
  assertEqual(remainingAC.length, 0, "re-querying 'AC' after fix finds 0 remaining documents");
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up integration test data...\n');
  const { client, db } = await getMongoClient();
  try {
    const caseIds = [CASE_A, CASE_C, CASE_D];
    const trusteeIds = [TRUSTEE_A, TRUSTEE_B, TRUSTEE_C, TRUSTEE_D];

    const r1 = await db.collection(CASE_COLLECTION).deleteMany({
      documentType: 'CASE_APPOINTMENT',
      caseId: { $in: caseIds },
    });
    const r2 = await db.collection(TRUSTEE_COLLECTION).deleteMany({
      documentType: 'CASE_APPOINTMENT',
      trusteeId: { $in: trusteeIds },
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
  console.log('FIX-CHAPTER-7-APPOINTMENTS — Integration Test');
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
      const HARNESS = 'npm run fix-chapter-7-appointments --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  ${HARNESS} <command>`);
      console.log('\nLocal workflow:');
      console.log('  1. ./fix-chapter-7-appointments/scripts/start-services.sh');
      console.log('  2. Copy .env.local.template to .env.local');
      console.log(`  3. ${HARNESS} seed`);
      console.log(`  4. ${HARNESS} run`);
      console.log(`  5. ${HARNESS} clean`);
      console.log('  6. ./fix-chapter-7-appointments/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  seed    Insert CASE_APPOINTMENT fixtures into both partition collections');
      console.log('  run     Run findAppointmentIdPairsByChapter/applyChapterFix assertions');
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
