/**
 * Integration test for CAMS-618/CAMS-749 — Trustee Appointment History on Case Detail.
 *
 * Exercises the full pipeline:
 *   1. Seeds CMMAP rows into ACMS SQL (two past appointments for a test case)
 *   2. Seeds a TrusteeProfessionalId mapping + Trustee into Cosmos
 *   3. Calls MigrateCaseAppointmentsUseCase.processPage() — reads CMMAP, writes CASE_APPOINTMENTs
 *   4. Calls getCaseTrusteeAppointmentHistory() — asserts history is sorted and names resolved
 *
 * Two environments via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh
 *   azure            — lower-env Azure Gov databases (VPN required)
 *
 * Usage (from test/integration/):
 *   npm run case-trustee-appointments -- [command]
 *
 * Local workflow:
 *   1. cd case-trustee-appointments/scripts && ./start-services.sh
 *   2. npm run case-trustee-appointments -- seed
 *   3. npm run case-trustee-appointments -- run
 *   4. npm run case-trustee-appointments -- clean
 *   5. cd case-trustee-appointments/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Insert CMMAP rows into ACMS SQL + trustee/proId into Cosmos
 *   run     Run full pipeline: migrate → read → assert
 *   clean   Remove all seeded test data from both databases
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import * as mssql from 'mssql';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import MigrateCaseAppointmentsUseCase from '../../../../backend/lib/use-cases/dataflows/migrate-case-appointments';
import { CaseTrusteeAppointmentUseCase } from '../../../../backend/lib/use-cases/cases/case-trustee-appointment.use-case';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

function loadEnv() {
  if (IS_LOCAL) {
    const localEnvPath = path.join(HARNESS_DIR, '.env.local');
    if (!fs.existsSync(localEnvPath)) {
      console.error(
        `Missing ${localEnvPath} — run start-services.sh first, then copy .env.local.template to .env.local`,
      );
      process.exit(1);
    }
    dotenv.config({ path: localEnvPath, override: true });
  } else {
    dotenv.config({ path: path.join(REPO_ROOT, 'backend/.env') });
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

// ACMS IDs: CASE_DIV=091, CASE_YEAR=69, CASE_NUMBER=99999 → caseId "091-69-99999"
// Using a case number unlikely to collide with real data
const ACMS_CASE_DIV = 91;
const ACMS_CASE_YEAR = 69;
const ACMS_CASE_NUMBER = 99999;
const TEST_CASE_ID = `${String(ACMS_CASE_DIV).padStart(3, '0')}-${String(ACMS_CASE_YEAR).padStart(2, '0')}-${String(ACMS_CASE_NUMBER).padStart(5, '0')}`;

// GROUP_DESIGNATOR + PROF_CODE → acmsProfessionalId "NY-00063"
const TEST_GROUP_DESIGNATOR = 'NY';
const TEST_PROF_CODE = 63;
const TEST_ACMS_PROFESSIONAL_ID = `${TEST_GROUP_DESIGNATOR}-${String(TEST_PROF_CODE).padStart(5, '0')}`;

const TEST_TRUSTEE_ID = 'integration-trustee-cams618-001';
const TEST_TRUSTEE_NAME = 'Integration, Trustee';

// CMMAP rows: APPT_DATE = assignDate, DISP_DATE = unassignDate
// Past appointment 1: assigned 2025-06-01, ended 2026-01-14
// Past appointment 2: assigned 2024-11-01, ended 2025-05-31
const CMMAP_ROW_1 = { assignDate: 20250601, dispDate: 20260114 };
const CMMAP_ROW_2 = { assignDate: 20241101, dispDate: 20250531 };

// RECORD_SEQ_NBRs are allocated dynamically at seed time to avoid conflicts
let seededRecordSeqNbrs: number[] = [];

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

function info(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

async function getMongoDb() {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function getAcmsSqlPool(): Promise<mssql.ConnectionPool> {
  const server = process.env.ACMS_MSSQL_HOST;
  if (!server) throw new Error('ACMS_MSSQL_HOST is not set');

  const database = process.env.ACMS_MSSQL_DATABASE || 'ACMS_REP_SUB';
  const port = Number(process.env.ACMS_MSSQL_PORT) || 1433;
  const encrypt = process.env.ACMS_MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate = process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
  const user = process.env.ACMS_MSSQL_USER;
  const password = process.env.ACMS_MSSQL_PASS;

  const config: mssql.config = {
    server,
    port,
    database,
    options: { encrypt, trustServerCertificate },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  };

  if (user && password) {
    config.user = user;
    config.password = password;
  } else {
    config.authentication = {
      type: (process.env.ACMS_MSSQL_AUTH_TYPE || 'azure-active-directory-default') as mssql.AuthenticationType,
      options: process.env.ACMS_MSSQL_CLIENT_ID ? { clientId: process.env.ACMS_MSSQL_CLIENT_ID } : {},
    };
  }

  return mssql.connect(config);
}

async function getAppContext() {
  const invocationContext = new InvocationContext();
  const appContext = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  appContext.featureFlags['trustee-appointment-history-enabled'] = true;
  return appContext;
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding integration test fixtures...\n');

  // Step 1: ACMS SQL — insert CMMAP rows
  console.log('Step 1: Seeding CMMAP rows into ACMS SQL...');
  const pool = await getAcmsSqlPool();
  try {
    // Find max RECORD_SEQ_NBR to avoid collision
    const maxResult = await pool.request().query(
      `SELECT ISNULL(MAX(RECORD_SEQ_NBR), 0) AS maxSeq FROM [dbo].[CMMAP]`,
    );
    const base: number = maxResult.recordset[0].maxSeq;
    const seq1 = base + 1;
    const seq2 = base + 2;
    seededRecordSeqNbrs = [seq1, seq2];

    for (const [seq, row] of [[seq1, CMMAP_ROW_1], [seq2, CMMAP_ROW_2]] as [number, typeof CMMAP_ROW_1][]) {
      const req = pool.request();
      req.input('seq', mssql.Int, seq);
      req.input('div', mssql.Int, ACMS_CASE_DIV);
      req.input('year', mssql.Int, ACMS_CASE_YEAR);
      req.input('num', mssql.Int, ACMS_CASE_NUMBER);
      req.input('grp', mssql.Char(2), TEST_GROUP_DESIGNATOR);
      req.input('prof', mssql.Int, TEST_PROF_CODE);
      req.input('assignDate', mssql.Int, row.assignDate);
      req.input('dispDate', mssql.Int, row.dispDate);

      await req.query(`
        INSERT INTO [dbo].[CMMAP] (
          RECORD_SEQ_NBR, CASE_DIV, CASE_YEAR, CASE_NUMBER,
          GROUP_DESIGNATOR, PROF_CODE,
          APPT_TYPE, APPT_DATE, DISP_DATE,
          DELETE_CODE, APPTEE_ACTIVE
        ) VALUES (
          @seq, @div, @year, @num,
          @grp, @prof,
          'TR', @assignDate, @dispDate,
          ' ', 'Y'
        )
      `);
      pass(`Inserted CMMAP row RECORD_SEQ_NBR=${seq} (case ${TEST_CASE_ID}, assignDate=${row.assignDate}, dispDate=${row.dispDate})`);
    }
  } finally {
    await pool.close();
  }

  // Step 2: Cosmos — upsert Trustee + TrusteeProfessionalId mapping
  console.log('\nStep 2: Seeding Trustee and ProfessionalId mapping into Cosmos...');
  const now = new Date().toISOString();
  const { client, db } = await getMongoDb();
  try {
    await db.collection('trustees').replaceOne(
      { trusteeId: TEST_TRUSTEE_ID },
      {
        documentType: 'TRUSTEE',
        trusteeId: TEST_TRUSTEE_ID,
        name: TEST_TRUSTEE_NAME,
        firstName: 'Trustee',
        lastName: 'Integration',
        public: {
          address: {
            addressLine1: '100 Integration Ave',
            city: 'Washington',
            stateProvince: 'DC',
            postalCode: '20001',
          },
          phone: '202-555-0199',
          email: 'integration.trustee@example.com',
        },
        createdOn: now,
        updatedOn: now,
      },
      { upsert: true },
    );
    pass(`Upserted Trustee: ${TEST_TRUSTEE_ID} (name="${TEST_TRUSTEE_NAME}")`);

    await db.collection('trustee-professional-ids').replaceOne(
      { acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID, camsTrusteeId: TEST_TRUSTEE_ID },
      {
        documentType: 'TRUSTEE_PROFESSIONAL_ID',
        camsTrusteeId: TEST_TRUSTEE_ID,
        acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID,
        createdOn: now,
        updatedOn: now,
      },
      { upsert: true },
    );
    pass(`Upserted TrusteeProfessionalId: ${TEST_ACMS_PROFESSIONAL_ID} → ${TEST_TRUSTEE_ID}`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning full pipeline integration test...\n');

  // ── Stage 1: Migration ──────────────────────────────────────────────────
  console.log('Stage 1: MigrateCaseAppointmentsUseCase.processPage()');
  console.log('  Reads CMMAP from ACMS SQL → writes CASE_APPOINTMENTs to Cosmos\n');

  // Clean any leftover CASE_APPOINTMENTs from previous runs before migrating
  const { client: cleanClient, db: cleanDb } = await getMongoDb();
  try {
    await cleanDb.collection('trustee-appointments').deleteMany({
      documentType: 'CASE_APPOINTMENT',
      caseId: TEST_CASE_ID,
      source: 'acms',
    });
  } finally {
    await cleanClient.close();
  }

  // Get the lowest seeded RECORD_SEQ_NBR so we page from just before it
  const pool = await getAcmsSqlPool();
  let startLastId: number;
  try {
    const result = await pool.request().query(
      `SELECT ISNULL(MIN(RECORD_SEQ_NBR), 1) - 1 AS startId
       FROM [dbo].[CMMAP]
       WHERE CASE_DIV = ${ACMS_CASE_DIV}
         AND CASE_YEAR = ${ACMS_CASE_YEAR}
         AND CASE_NUMBER = ${ACMS_CASE_NUMBER}
         AND DELETE_CODE != 'D'`,
    );
    startLastId = result.recordset[0].startId;
  } finally {
    await pool.close();
  }

  info(`Paging from lastId=${startLastId} with pageSize=2`);

  const context = await getAppContext();
  const pageResult = await MigrateCaseAppointmentsUseCase.processPage(context, startLastId, 2);

  if (pageResult.status === 'error') {
    fail(`processPage returned error: ${pageResult.error.message}`);
    return;
  }
  if (pageResult.status === 'empty') {
    fail('processPage returned empty — CMMAP rows not found. Did you run seed first?');
    return;
  }

  pass(`processPage status: ${pageResult.status}`);

  const successCount = pageResult.status === 'done' || pageResult.status === 'continue'
    ? pageResult.successCount
    : 0;
  const failedCount = pageResult.status === 'done' || pageResult.status === 'continue'
    ? pageResult.failedCount
    : 0;

  if (successCount === 2) {
    pass(`Migration wrote 2 CASE_APPOINTMENTs (successCount=${successCount})`);
  } else {
    fail(`Expected successCount=2, got ${successCount} (failedCount=${failedCount})`);
    return;
  }

  if (failedCount > 0) {
    fail(`Migration had ${failedCount} failed records — check trustee-professional-ids mapping`);
    return;
  }

  // ── Stage 2: Read path ──────────────────────────────────────────────────
  console.log('\nStage 2: getCaseTrusteeAppointmentHistory()');
  console.log('  Reads CASE_APPOINTMENTs from Cosmos → resolves trustee names\n');

  const readUseCase = new CaseTrusteeAppointmentUseCase();
  const result = await readUseCase.getCaseTrusteeAppointmentHistory(context, TEST_CASE_ID);

  // history length
  if (result.history.length === 2) {
    pass('history contains 2 past appointments');
  } else {
    fail(`expected 2 history items, got ${result.history.length}`);
    return;
  }

  // sort order
  const [first, second] = result.history;
  if (first.unassignedOn! > second.unassignedOn!) {
    pass(`sorted correctly: ${first.unassignedOn} > ${second.unassignedOn}`);
  } else {
    fail(`expected most-recent-end first, got ${first.unassignedOn} then ${second.unassignedOn}`);
  }

  // trustee name resolved from Cosmos trustees collection
  for (const item of result.history) {
    if (item.trusteeName === TEST_TRUSTEE_NAME) {
      pass(`trusteeName resolved: "${item.trusteeName}" (appointment ${item.id})`);
    } else {
      fail(`expected trusteeName "${TEST_TRUSTEE_NAME}", got "${item.trusteeName}" (appointment ${item.id})`);
    }
  }

  // dates round-tripped correctly from ACMS YYYYMMDD integer format
  if (first.assignedOn === '2025-06-01') {
    pass(`first assignedOn = ${first.assignedOn} (from ACMS ${CMMAP_ROW_1.assignDate})`);
  } else {
    fail(`expected first assignedOn "2025-06-01", got "${first.assignedOn}"`);
  }
  if (first.unassignedOn === '2026-01-14') {
    pass(`first unassignedOn = ${first.unassignedOn} (from ACMS ${CMMAP_ROW_1.dispDate})`);
  } else {
    fail(`expected first unassignedOn "2026-01-14", got "${first.unassignedOn}"`);
  }
  if (second.assignedOn === '2024-11-01') {
    pass(`second assignedOn = ${second.assignedOn} (from ACMS ${CMMAP_ROW_2.assignDate})`);
  } else {
    fail(`expected second assignedOn "2024-11-01", got "${second.assignedOn}"`);
  }
  if (second.unassignedOn === '2025-05-31') {
    pass(`second unassignedOn = ${second.unassignedOn} (from ACMS ${CMMAP_ROW_2.dispDate})`);
  } else {
    fail(`expected second unassignedOn "2025-05-31", got "${second.unassignedOn}"`);
  }

  console.log('\nResult summary:');
  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up integration test data...\n');

  // ACMS SQL: remove seeded CMMAP rows by case identity
  console.log('Removing CMMAP rows from ACMS SQL...');
  const pool = await getAcmsSqlPool();
  try {
    const req = pool.request();
    req.input('div', mssql.Int, ACMS_CASE_DIV);
    req.input('year', mssql.Int, ACMS_CASE_YEAR);
    req.input('num', mssql.Int, ACMS_CASE_NUMBER);
    req.input('grp', mssql.Char(2), TEST_GROUP_DESIGNATOR);
    req.input('prof', mssql.Int, TEST_PROF_CODE);
    const r = await req.query(`
      DELETE FROM [dbo].[CMMAP]
      WHERE CASE_DIV = @div
        AND CASE_YEAR = @year
        AND CASE_NUMBER = @num
        AND GROUP_DESIGNATOR = @grp
        AND PROF_CODE = @prof
        AND APPT_TYPE = 'TR'
    `);
    pass(`Deleted ${r.rowsAffected[0]} CMMAP row(s) for case ${TEST_CASE_ID}`);
  } finally {
    await pool.close();
  }

  // Cosmos: remove CASE_APPOINTMENTs, TrusteeProfessionalId, and Trustee
  console.log('\nRemoving Cosmos documents...');
  const { client, db } = await getMongoDb();
  try {
    const r1 = await db.collection('trustee-appointments').deleteMany({
      documentType: 'CASE_APPOINTMENT',
      caseId: TEST_CASE_ID,
      source: 'acms',
    });
    pass(`Deleted ${r1.deletedCount} CASE_APPOINTMENT(s) for case ${TEST_CASE_ID}`);

    const r2 = await db.collection('trustee-professional-ids').deleteMany({
      acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID,
      camsTrusteeId: TEST_TRUSTEE_ID,
    });
    pass(`Deleted ${r2.deletedCount} TrusteeProfessionalId(s)`);

    const r3 = await db.collection('trustees').deleteMany({
      documentType: 'TRUSTEE',
      trusteeId: TEST_TRUSTEE_ID,
    });
    pass(`Deleted ${r3.deletedCount} Trustee doc(s) for trusteeId ${TEST_TRUSTEE_ID}`);

    // Clean migration state so it doesn't interfere with future runs
    await db.collection('runtime-state').deleteMany({
      documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE',
    });
    pass('Removed MIGRATE_CASE_APPOINTMENTS_STATE from runtime-state');
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
  console.log('Case Trustee Appointment History — Integration Test');
  console.log(`Environment: ${INTEGRATION_ENV}`);
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
      const HARNESS = 'npm run case-trustee-appointments --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  INTEGRATION_ENV=local  ${HARNESS} <command>   (default)`);
      console.log(`  INTEGRATION_ENV=azure  ${HARNESS} <command>   (VPN required)`);
      console.log('\nLocal workflow:');
      console.log('  1. ./case-trustee-appointments/scripts/start-services.sh');
      console.log(`  2. ${HARNESS} seed    (seed CMMAP rows in SQL + trustee/proId in Cosmos)`);
      console.log(`  3. ${HARNESS} run     (migrate CMMAP→Cosmos, then assert read path)`);
      console.log(`  4. ${HARNESS} clean   (remove all test data from both databases)`);
      console.log('  5. ./case-trustee-appointments/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  seed    Seed ACMS SQL (CMMAP rows) + Cosmos (Trustee + ProfessionalId)');
      console.log('  run     Run migration use case then read path — full pipeline assertion');
      console.log('  clean   Remove seeded data from ACMS SQL + Cosmos');
      console.log('  help    Show this help');
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
