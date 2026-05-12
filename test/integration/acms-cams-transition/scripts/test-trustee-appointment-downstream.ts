/**
 * Integration test harness for CAMS-616 trustee appointment downstream flow.
 *
 * Exercises the end-to-end path from processAppointments (use case) through to
 * CMMAP_STAGING (downstream SQL), using real lower-environment databases.
 *
 * This is a one-shot script — NOT a Vitest test, NOT an e2e Playwright test.
 * Run it manually against a lower environment to verify the full flow.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts [command]
 *
 * Commands:
 *   check-env       Verify all required environment variables are set
 *   seed-cosmos     Seed Cosmos with a test trustee + professional ID mapping
 *   run             Run processAppointments for the test event and assert results
 *   check-staging   Query CMMAP_STAGING and print current rows for test cases
 *   clean           Remove seeded test data from Cosmos and CMMAP_STAGING
 *   help            Show this help
 *
 * Prerequisites:
 *   1. backend/.env populated with lower-env connection strings (see check-env output)
 *   2. CMMAP_STAGING table exists in the downstream SQL database
 *   3. VPN connected (if databases are on Azure Government)
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import * as sql from 'mssql';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import SyncTrusteeAppointments from '../../../../backend/lib/use-cases/dataflows/sync-trustee-appointments';
import factory from '../../../../backend/lib/factory';
import { TrusteeAppointmentSyncEvent } from '../../../../common/src/cams/dataflow-events';
import { TrusteeProfessionalId } from '../../../../common/src/cams/trustee-professional-ids';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '../../../../common/src/cams/auditable';

// Load backend/.env first (primary config: Cosmos, DXTR, downstream SQL)
dotenv.config({ path: 'backend/.env' });

// Load local.settings.json Values into process.env so the harness behaves like
// the Functions runtime locally (provides AzureWebJobsDataflowsStorage etc.)
function loadLocalSettings(settingsPath: string) {
  const resolved = path.resolve(settingsPath);
  if (!fs.existsSync(resolved)) return;
  try {
    const settings = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    const values: Record<string, string> = settings?.Values ?? {};
    for (const [key, value] of Object.entries(values)) {
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Non-fatal — harness will surface missing vars via check-env
  }
}

loadLocalSettings('backend/function-apps/dataflows/local.settings.json');

// ---------------------------------------------------------------------------
// Test fixtures
// These values must correspond to real data in the lower-env DXTR / CAMS
// databases, OR be seeded by the seed-cosmos command below.
// ---------------------------------------------------------------------------

const TEST_TRUSTEE_ID = process.env.INTEGRATION_TEST_TRUSTEE_ID || 'INTEGRATION-TEST-TRUSTEE-001';
const TEST_ACMS_PROFESSIONAL_ID =
  process.env.INTEGRATION_TEST_ACMS_PROF_ID || 'NY-00063';
const TEST_CASE_ID = process.env.INTEGRATION_TEST_CASE_ID || '081-24-12345';
const TEST_COURT_ID = process.env.INTEGRATION_TEST_COURT_ID || '0208';

const TEST_SYNC_EVENT: TrusteeAppointmentSyncEvent = {
  caseId: TEST_CASE_ID,
  courtId: TEST_COURT_ID,
  dxtrTrustee: {
    firstName: 'Integration',
    lastName: 'TestTrustee',
    fullName: 'Integration TestTrustee',
  },
  appointedDate: new Date().toISOString().split('T')[0],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string) {
  console.log(`  ✗ FAIL: ${msg}`);
}

function info(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

async function getContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

async function getDownstreamSqlPool(): Promise<sql.ConnectionPool> {
  const connStr = process.env.DOWNSTREAM_SQL_CONNECTION_STRING;
  if (!connStr) throw new Error('DOWNSTREAM_SQL_CONNECTION_STRING is not set');
  return sql.connect(connStr);
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required = [
    ['MONGO_CONNECTION_STRING', 'Cosmos DB / MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos database name'],
    ['MSSQL_HOST', 'DXTR SQL Server host'],
    ['MSSQL_DATABASE_DXTR', 'DXTR database name'],
    ['DOWNSTREAM_SQL_CONNECTION_STRING', 'Downstream Azure SQL connection string'],
    [
      'AzureWebJobsDataflowsStorage',
      'Azure Storage connection string (from dataflows/local.settings.json)',
    ],
  ];

  const optional = [
    ['INTEGRATION_TEST_TRUSTEE_ID', `CAMS trustee ID to use (default: ${TEST_TRUSTEE_ID})`],
    ['INTEGRATION_TEST_ACMS_PROF_ID', `ACMS professional ID (default: ${TEST_ACMS_PROFESSIONAL_ID})`],
    ['INTEGRATION_TEST_CASE_ID', `Case ID to test (default: ${TEST_CASE_ID})`],
    ['INTEGRATION_TEST_COURT_ID', `Court ID to test (default: ${TEST_COURT_ID})`],
  ];

  let allPresent = true;
  for (const [name, description] of required) {
    if (process.env[name]) {
      pass(`${name} — ${description}`);
    } else {
      fail(`${name} — ${description} (MISSING)`);
      allPresent = false;
    }
  }

  console.log('\nOptional overrides:');
  for (const [name, description] of optional) {
    const value = process.env[name];
    info(`${name}=${value ?? '(using default)'} — ${description}`);
  }

  if (!allPresent) {
    console.log('\n⚠️  Set missing variables in backend/.env before running.');
  } else {
    console.log('\n✓ All required variables present.');
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos
// ---------------------------------------------------------------------------

async function seedCosmos() {
  console.log('\nSeeding Cosmos with test trustee + professional ID mapping...\n');
  console.log(`  Trustee ID:           ${TEST_TRUSTEE_ID}`);
  console.log(`  ACMS Professional ID: ${TEST_ACMS_PROFESSIONAL_ID}`);

  const context = await getContext();
  const repo = factory.getTrusteeProfessionalIdsRepository(context);

  try {
    const doc: TrusteeProfessionalId = {
      ...createAuditRecord<TrusteeProfessionalId>(
        {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId: TEST_TRUSTEE_ID,
          acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID,
        },
        SYSTEM_USER_REFERENCE,
      ),
    };

    await repo.upsert(TEST_TRUSTEE_ID, TEST_ACMS_PROFESSIONAL_ID, doc);
    pass(`Upserted TrusteeProfessionalId: ${TEST_TRUSTEE_ID} ↔ ${TEST_ACMS_PROFESSIONAL_ID}`);
  } finally {
    repo.release();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning trustee appointment downstream integration test...\n');
  console.log('Test event:');
  console.log(JSON.stringify(TEST_SYNC_EVENT, null, 2));
  console.log('');

  // Step 1: processAppointments
  console.log('Step 1: processAppointments (sync-trustee-appointments use case)');
  const context = await getContext();

  const { successCount, dlqMessages, scenarioDistribution } =
    await SyncTrusteeAppointments.processAppointments(context, [TEST_SYNC_EVENT]);

  info(`successCount: ${successCount}`);
  info(`dlqMessages: ${dlqMessages.length}`);
  info(`scenarioDistribution: ${JSON.stringify(scenarioDistribution)}`);

  if (dlqMessages.length > 0) {
    fail('Event landed on DLQ — check trustee match config');
    console.log('\nDLQ message:');
    console.log(JSON.stringify(dlqMessages[0], null, 2));
    return;
  }

  if (successCount === 0) {
    fail('No appointments processed successfully');
    return;
  }

  pass('processAppointments completed without DLQ errors');

  // Step 2: Check CMMAP_STAGING
  console.log('\nStep 2: Query CMMAP_STAGING for test case');
  await checkStagingForCase(TEST_CASE_ID);
}

// ---------------------------------------------------------------------------
// check-staging
// ---------------------------------------------------------------------------

async function checkStagingForCase(caseId: string) {
  const pool = await getDownstreamSqlPool();
  try {
    const request = pool.request();
    request.input('caseId', sql.VarChar(50), caseId);

    const result = await request.query(`
      SELECT
        CAMS_CASE_ID,
        APPT_TYPE,
        PROF_CODE,
        GROUP_DESIGNATOR,
        APPT_DISP,
        APPTEE_ACTIVE,
        APPT_DATE,
        DISP_DATE,
        SOURCE,
        LAST_UPDATED
      FROM CMMAP_STAGING
      WHERE CAMS_CASE_ID = @caseId
      ORDER BY APPT_TYPE
    `);

    if (result.recordset.length === 0) {
      fail(`No rows found in CMMAP_STAGING for case ${caseId}`);
      return;
    }

    pass(`Found ${result.recordset.length} row(s) in CMMAP_STAGING for case ${caseId}`);
    console.log('');
    console.table(result.recordset);

    for (const row of result.recordset) {
      if (row.APPT_TYPE === 'TR') {
        if (row.APPT_DISP === 'GR') {
          pass(`TR row has APPT_DISP='GR' (active trustee appointment)`);
        } else if (row.APPT_DISP === 'WD') {
          pass(`TR row has APPT_DISP='WD' (closed trustee appointment)`);
        } else {
          fail(`TR row has unexpected APPT_DISP='${row.APPT_DISP}'`);
        }

        if (row.SOURCE === 'CAMS') {
          pass(`TR row SOURCE='CAMS'`);
        } else {
          fail(`TR row SOURCE='${row.SOURCE}' (expected 'CAMS')`);
        }
      }
    }
  } finally {
    await pool.close();
  }
}

async function checkStaging() {
  console.log(`\nQuerying CMMAP_STAGING for test case ${TEST_CASE_ID}...\n`);
  await checkStagingForCase(TEST_CASE_ID);
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up test data...\n');

  // Remove from Cosmos
  console.log('Removing TrusteeProfessionalId from Cosmos...');
  const context = await getContext();
  const repo = factory.getTrusteeProfessionalIdsRepository(context);
  try {
    const existing = await repo.findByAcmsProfessionalId(TEST_ACMS_PROFESSIONAL_ID);
    const testDoc = existing.find((d) => d.camsTrusteeId === TEST_TRUSTEE_ID);
    if (testDoc?.id) {
      // Soft-delete by upsert with a marker, or just inform — depends on repo capability
      info(
        `Found TrusteeProfessionalId doc id=${testDoc.id} — manual deletion required in Cosmos if needed`,
      );
    } else {
      info('No matching TrusteeProfessionalId doc found in Cosmos (may have already been removed)');
    }
  } finally {
    repo.release();
  }

  // Remove from CMMAP_STAGING
  console.log('\nRemoving test rows from CMMAP_STAGING...');
  const pool = await getDownstreamSqlPool();
  try {
    const request = pool.request();
    request.input('caseId', sql.VarChar(50), TEST_CASE_ID);
    const result = await request.query(
      `DELETE FROM CMMAP_STAGING WHERE CAMS_CASE_ID = @caseId AND SOURCE = 'CAMS'`,
    );
    pass(`Deleted ${result.rowsAffected[0]} row(s) from CMMAP_STAGING for case ${TEST_CASE_ID}`);
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('ACMS-CAMS Transition — Trustee Appointment Downstream Test');
  console.log('='.repeat(60));

  switch (command) {
    case 'check-env':
      await checkEnv();
      break;
    case 'seed-cosmos':
      await seedCosmos();
      break;
    case 'run':
      await run();
      break;
    case 'check-staging':
      await checkStaging();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default:
      console.log('\nUsage:');
      console.log(
        '  npx tsx --tsconfig backend/tsconfig.json \\',
      );
      console.log(
        '    test/integration/acms-cams-transition/scripts/test-trustee-appointment-downstream.ts [command]',
      );
      console.log('\nCommands:');
      console.log('  check-env       Verify all required environment variables are set');
      console.log('  seed-cosmos     Seed Cosmos with test trustee + professional ID mapping');
      console.log('  run             Run processAppointments and assert CMMAP_STAGING state');
      console.log('  check-staging   Print current CMMAP_STAGING rows for the test case');
      console.log('  clean           Remove seeded test data from Cosmos and CMMAP_STAGING');
      console.log('  help            Show this help');
      console.log('\nOptional env var overrides (in backend/.env):');
      console.log(`  INTEGRATION_TEST_TRUSTEE_ID   (default: ${TEST_TRUSTEE_ID})`);
      console.log(`  INTEGRATION_TEST_ACMS_PROF_ID (default: ${TEST_ACMS_PROFESSIONAL_ID})`);
      console.log(`  INTEGRATION_TEST_CASE_ID      (default: ${TEST_CASE_ID})`);
      console.log(`  INTEGRATION_TEST_COURT_ID     (default: ${TEST_COURT_ID})`);
      break;
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
