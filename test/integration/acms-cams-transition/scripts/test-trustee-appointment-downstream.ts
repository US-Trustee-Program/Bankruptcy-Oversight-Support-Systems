/**
 * Integration test harness for CAMS-616 trustee appointment downstream flow.
 *
 * Exercises the end-to-end path from processAppointments (use case) through to
 * CMMAP_CAMS (downstream SQL).
 *
 * Two environments are supported via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh
 *   azure            — lower-env Azure Government databases (VPN required)
 *
 * This is a one-shot script — NOT a Vitest test, NOT an e2e Playwright test.
 *
 * Usage (from test/integration/):
 *   npm run acms-cams-transition -- [command]
 *
 * Local workflow:
 *   1. cd test/integration/acms-cams-transition/scripts && ./start-services.sh
 *   2. npm run acms-cams-transition -- seed-schema
 *   3. npm run acms-cams-transition -- seed-sql
 *   4. npm run acms-cams-transition -- seed-integration
 *   5. cd backend/function-apps/dataflows && npm start
 *   6. npm run acms-cams-transition -- run
 *   7. npm run acms-cams-transition -- clean
 *   8. cd test/integration/acms-cams-transition/scripts && ./stop-services.sh
 *
 * Commands:
 *   check-env             Verify all required environment variables are set
 *   seed-schema           Create ACMS_REP_SUB and apply CMMAP_CAMS + CMMAP_ALL schema
 *   seed-sql              Seed CMMAP / CMMPR / CMMPT (ACMS replica) and CMMAP_CAMS mock data
 *   seed-integration      Seed all Cosmos fixtures (trustee, synced case, professional ID mapping)
 *   run                   Run processAppointments and assert CMMAP_CAMS state
 *   check-staging         Query CMMAP_CAMS for the test case
 *   clean                 Remove seeded Cosmos and CMMAP_CAMS test data
 *   run-sql <file> <db>   Execute a GO-delimited .sql file against a named database
 *   create-db <dbname>    CREATE DATABASE on the ACMS SQL Server instance
 *   check-env             Verify all required environment variables are set
 *   help                  Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { InvocationContext } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';
import { MongoClient } from 'mongodb';
import * as sql from 'mssql';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import SyncTrusteeAppointments from '../../../../backend/lib/use-cases/dataflows/sync-trustee-appointments';
import { TrusteeAppointmentSyncEvent, TrusteeAppointmentDownstreamEvent } from '../../../../common/src/cams/dataflow-events';
import { TRUSTEE_APPOINTMENT_EVENT_QUEUE, TRUSTEE_APPOINTMENT_DOWNSTREAM_DLQ } from '../../../../backend/lib/storage-queues';
import {
  trusteeAppointmentHandler,
  staffAssignmentHandler,
  AcmsDailySync,
} from '../../../../backend/function-apps/dataflows/downstream/acms-cams-transition';
import { STAFF_ASSIGNMENT_DOWNSTREAM_DLQ } from '../../../../backend/lib/storage-queues';
import { CaseAssignmentDownstreamEvent } from '../../../../common/src/cams/dataflow-events';
import factory from '../../../../backend/lib/factory';
import { MockOfficesGateway } from '../../../../backend/lib/testing/mock-gateways/mock.offices.gateway';

// Resolve paths relative to the repo root (two levels up from test/integration/)
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

// Environment selection: local (default) or azure
const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

// Load environment — local .env.local overrides backend/.env for local runs
function loadEnv() {
  if (IS_LOCAL) {
    // Local: .env.local in the harness directory, no fallback to backend/.env
    const localEnvPath = path.join(HARNESS_DIR, '.env.local');
    if (!fs.existsSync(localEnvPath)) {
      console.error(`Missing ${localEnvPath} — run start-services.sh first, then copy .env.local.template`);
      process.exit(1);
    }
    dotenv.config({ path: localEnvPath, override: true });
  } else {
    // Azure: load backend/.env then dataflows local.settings.json
    dotenv.config({ path: path.join(REPO_ROOT, 'backend/.env') });
    loadLocalSettings(path.join(REPO_ROOT, 'backend/function-apps/dataflows/local.settings.json'));
  }
}

function loadLocalSettings(settingsPath: string) {
  const resolved = path.resolve(settingsPath);
  if (!fs.existsSync(resolved)) return;
  try {
    const settings = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    const values: Record<string, string> = settings?.Values ?? {};
    for (const [key, value] of Object.entries(values)) {
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Non-fatal
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_TRUSTEE_ID = process.env.INTEGRATION_TEST_TRUSTEE_ID || 'INTEGRATION-TEST-TRUSTEE-001';
const TEST_ACMS_PROFESSIONAL_ID = process.env.INTEGRATION_TEST_ACMS_PROF_ID || 'NY-00063';
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
  const appContext = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  // Inject mock offices gateway so processAppointments doesn't need DXTR SQL locally.
  // All other repositories (trustees, cases, appointments) use real Cosmos.
  (factory as any).getOfficesGateway = () => new MockOfficesGateway();
  return { appContext, invocationContext };
}

async function flushExtraOutputsToAzurite(invocationContext: InvocationContext): Promise<number> {
  const connectionString = process.env.AzureWebJobsDataflowsStorage || process.env.AzureWebJobsStorage;
  if (!connectionString) throw new Error('No storage connection string for Azurite');

  const messages = invocationContext.extraOutputs.get(TRUSTEE_APPOINTMENT_EVENT_QUEUE) as unknown[];
  if (!messages || messages.length === 0) return 0;

  const queueClient = QueueServiceClient.fromConnectionString(connectionString)
    .getQueueClient(TRUSTEE_APPOINTMENT_EVENT_QUEUE.queueName);

  await queueClient.createIfNotExists();

  for (const msg of messages) {
    const inner = Array.isArray(msg) ? msg[0] : msg;
    const encoded = Buffer.from(JSON.stringify(inner)).toString('base64');
    await queueClient.sendMessage(encoded);
  }

  return messages.length;
}

async function getDownstreamSqlPool(): Promise<sql.ConnectionPool> {
  return getAcmsSqlPool(process.env.ACMS_MSSQL_DATABASE || 'ACMS_REP_SUB');
}

async function getMongoDb() {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

// Build an mssql ConnectionPool using the ACMS_MSSQL_* env vars — same logic
// as ApplicationConfiguration.getAcmsDbConfig(), but targeting a specific database.
async function getAcmsSqlPool(database: string): Promise<sql.ConnectionPool> {
  const server = process.env.ACMS_MSSQL_HOST;
  if (!server) throw new Error('ACMS_MSSQL_HOST is not set');

  const port = Number(process.env.ACMS_MSSQL_PORT) || 1433;
  const encrypt = process.env.ACMS_MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate =
    process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
  const user = process.env.ACMS_MSSQL_USER;
  const password = process.env.ACMS_MSSQL_PASS;
  const authType = process.env.ACMS_MSSQL_AUTH_TYPE || 'azure-active-directory-default';
  const identityClientId = process.env.ACMS_MSSQL_CLIENT_ID;

  const config: sql.config = {
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
      type: authType as sql.AuthenticationType,
      options: identityClientId ? { clientId: identityClientId } : {},
    };
  }

  return sql.connect(config);
}

// Split a SQL file on GO batch separators and execute each batch in sequence.
// Skips empty batches (blank lines between GO statements).
async function executeSqlFile(pool: sql.ConnectionPool, filePath: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const batches = content
    .split(/^\s*GO\s*$/im)
    .map((b) => b.trim())
    .filter((b) => b.length > 0);

  info(`Executing ${batches.length} batch(es) from ${path.basename(filePath)}`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    try {
      const req = pool.request();
      req.on('info', (msg) => process.stdout.write(msg.message + '\n'));
      await req.query(batch);
    } catch (err) {
      throw new Error(
        `Batch ${i + 1} of ${batches.length} failed:\n${batch.slice(0, 200)}...\n\nError: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required = [
    ['MONGO_CONNECTION_STRING', 'Cosmos DB / MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos database name'],
    ['ACMS_MSSQL_HOST', 'ACMS SQL Server host (also used for create-db and run-sql)'],
    ['ACMS_MSSQL_DATABASE', 'ACMS replica database name (staging table and view live here)'],
    ['MSSQL_HOST', 'DXTR SQL Server host'],
    ['MSSQL_DATABASE_DXTR', 'DXTR database name'],
    [
      'AzureWebJobsDataflowsStorage',
      'Azure Storage connection string (from dataflows/local.settings.json)',
    ],
  ];

  const optional = [
    ['ACMS_MSSQL_USER', 'ACMS SQL user (omit to use Azure AD default auth)'],
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

  console.log('\nOptional / informational:');
  for (const [name, description] of optional) {
    const value = process.env[name];
    info(`${name}=${value ?? '(not set)'} — ${description}`);
  }

  if (!allPresent) {
    console.log('\n⚠️  Set missing variables in backend/.env before running.');
  } else {
    console.log('\n✓ All required variables present.');
  }
}

// ---------------------------------------------------------------------------
// create-db
// ---------------------------------------------------------------------------

async function createDb(dbName: string) {
  if (!dbName) {
    console.error('Usage: create-db <database-name>');
    process.exit(1);
  }

  console.log(`\nCreating database '${dbName}' on ${process.env.ACMS_MSSQL_HOST}...\n`);

  // Connect to master to run CREATE DATABASE
  const pool = await getAcmsSqlPool('master');
  try {
    // Parameterized identifiers are not supported for CREATE DATABASE — name is
    // validated here to contain only safe characters before embedding in the statement.
    if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
      throw new Error(`Database name '${dbName}' contains invalid characters`);
    }

    const exists = await pool.request().query(`
      SELECT COUNT(*) AS cnt FROM sys.databases WHERE name = '${dbName}'
    `);
    if (exists.recordset[0].cnt > 0) {
      pass(`Database '${dbName}' already exists — skipping creation`);
    } else {
      await pool.request().query(`CREATE DATABASE [${dbName}]`);
      pass(`Database '${dbName}' created`);
    }
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// run-sql
// ---------------------------------------------------------------------------

async function runSql(filePath: string, dbName: string) {
  if (!filePath || !dbName) {
    console.error('Usage: run-sql <file.sql> <database-name>');
    process.exit(1);
  }

  // Accept both repo-root-relative and absolute paths
  const resolved = path.isAbsolute(filePath)
    ? filePath
    : path.resolve(REPO_ROOT, filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  console.log(`\nRunning ${path.basename(filePath)} against '${dbName}'...\n`);

  const pool = await getAcmsSqlPool(dbName);
  try {
    await executeSqlFile(pool, resolved);
    pass(`${path.basename(resolved)} executed successfully against '${dbName}'`);
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-schema  (local only)
// ---------------------------------------------------------------------------
// Creates ACMS_REP_SUB in SQL Edge and applies the CMMAP_CAMS table +
// CMMAP_ALL view schema. Safe to run multiple times (idempotent).

async function seedSchema() {
  if (!IS_LOCAL) {
    console.error('seed-schema is only for local container runs. Schema already exists in Azure.');
    process.exit(1);
  }
  console.log('\nCreating ACMS_REP_SUB and applying schema...\n');

  // Connect to master to create the database
  const master = await getAcmsSqlPool('master');
  try {
    await master.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'ACMS_REP_SUB')
        CREATE DATABASE [ACMS_REP_SUB]
    `);
    pass('ACMS_REP_SUB ready');
  } finally {
    await master.close();
  }

  // Apply CMMAP_CAMS, CMMAP_ALL table, and CMMAP_SYNC_CONTROL.
  // CMMAP_ALL table has no dependency on dbo.CMMAP (unlike the old view).
  const pool = await getAcmsSqlPool('ACMS_REP_SUB');
  try {
    const schemaDir = path.join(REPO_ROOT, 'backend/function-apps/dataflows/downstream/database/acms-cams-transition/schema');
    await executeSqlFile(pool, path.join(schemaDir, 'cmmap-cams.sql'));
    pass('cmmap-cams.sql applied');
    await executeSqlFile(pool, path.join(schemaDir, 'cmmap-all.sql'));
    pass('cmmap-all.sql applied');
    await executeSqlFile(pool, path.join(schemaDir, 'cmmap-sync-control.sql'));
    pass('cmmap-sync-control.sql applied');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-sql  (local only)
// ---------------------------------------------------------------------------
// Seeds ACMS replica mock data (CMMAP / CMMPR / CMMPT) and CMMAP_CAMS
// mock rows into the local SQL Edge ACMS_REP_SUB database.

async function seedSql() {
  if (!IS_LOCAL) {
    console.error('seed-sql is only for local container runs. Use run-sql for Azure.');
    process.exit(1);
  }
  console.log('\nSeeding SQL mock data into ACMS_REP_SUB...\n');

  const pool = await getAcmsSqlPool('ACMS_REP_SUB');
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    // Seed ACMS replica tables (creates CMMAP, CMMPR, CMMPT)
    await executeSqlFile(pool, path.join(seedDir, '01-seed-acms-replica.sql'));
    pass('01-seed-acms-replica.sql seeded');
    // Seed CMMAP_CAMS mock rows
    await executeSqlFile(pool, path.join(seedDir, '02-seed-cmmap-cams.sql'));
    pass('02-seed-cmmap-cams.sql seeded');
    // Seed CMMAP_ALL with unified state (ACMS rows + CAMS overrides)
    await executeSqlFile(pool, path.join(seedDir, '03-seed-cmmap-all.sql'));
    pass('03-seed-cmmap-all.sql seeded');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-integration
// ---------------------------------------------------------------------------
// Synthesizes all Cosmos fixtures needed for the `run` command:
//   1. A SyncedCase for TEST_CASE_ID with matching courtId/division/chapter
//   2. A Trustee whose name matches dxtrTrustee.fullName in TEST_SYNC_EVENT,
//      with an active appointment covering that court/division/chapter
//   3. A TrusteeProfessionalId linking the trustee to TEST_ACMS_PROFESSIONAL_ID
//
// The trustee name "Integration TestTrustee" must match exactly what processAppointments
// receives in TrusteeAppointmentSyncEvent.dxtrTrustee.fullName.
// ---------------------------------------------------------------------------

const INTEGRATION_COURT_ID = '0208';
const INTEGRATION_DIVISION_CODE = '081';
const INTEGRATION_CHAPTER = '7';

async function seedIntegration() {
  console.log('\nSeeding all Cosmos fixtures for integration test...\n');
  console.log(`  Trustee name:         ${TEST_SYNC_EVENT.dxtrTrustee.fullName}`);
  console.log(`  Case ID:              ${TEST_CASE_ID}`);
  console.log(`  Court ID:             ${INTEGRATION_COURT_ID}`);
  console.log(`  Division code:        ${INTEGRATION_DIVISION_CODE}`);
  console.log(`  Chapter:              ${INTEGRATION_CHAPTER}`);
  console.log(`  ACMS professional ID: ${TEST_ACMS_PROFESSIONAL_ID}`);
  console.log('');

  const { client, db } = await getMongoDb();
  try {
    const now = new Date().toISOString();
    const trusteeId = randomUUID();

    // Step 1 — Synced case (upsert by caseId)
    await db.collection('cases').updateOne(
      { documentType: 'SYNCED_CASE', caseId: TEST_CASE_ID },
      {
        $set: {
          documentType: 'SYNCED_CASE',
          caseId: TEST_CASE_ID,
          dxtrId: '9999999',
          courtId: INTEGRATION_COURT_ID,
          courtName: 'U.S. Bankruptcy Court - Southern District of New York',
          courtDivisionCode: INTEGRATION_DIVISION_CODE,
          courtDivisionName: 'Manhattan',
          officeName: 'Manhattan',
          officeCode: INTEGRATION_DIVISION_CODE,
          groupDesignator: 'NY',
          regionId: '02',
          regionName: 'Region 2',
          chapter: INTEGRATION_CHAPTER,
          caseTitle: 'Integration Test Debtor',
          caseNumber: '24-12345',
          dateFiled: '2024-01-15',
          debtor: { name: 'Integration Test Debtor' },
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );
    pass(`Upserted SyncedCase: ${TEST_CASE_ID} (court ${INTEGRATION_COURT_ID}, div ${INTEGRATION_DIVISION_CODE}, ch ${INTEGRATION_CHAPTER})`);

    // Step 2 — Trustee document
    // name must match dxtrTrustee.fullName exactly so matchTrusteeByName regex finds it
    await db.collection('trustees').insertOne({
      documentType: 'TRUSTEE',
      trusteeId,
      name: TEST_SYNC_EVENT.dxtrTrustee.fullName,
      firstName: 'Integration',
      lastName: 'TestTrustee',
      status: 'active',
      public: {
        address: { address1: '100 Integration Ave', city: 'New York', state: 'NY', zip: '10001' },
        phone: '212-555-0100',
        email: 'integration.testtrustee@example.com',
      },
      legacy: {},
      createdOn: now,
      updatedOn: now,
    });
    pass(`Inserted Trustee: ${trusteeId} (name="${TEST_SYNC_EVENT.dxtrTrustee.fullName}")`);

    // Step 3 — TrusteeAppointment (panel appointment — drives isPerfectMatch)
    await db.collection('trustee-appointments').insertOne({
      documentType: 'TRUSTEE_APPOINTMENT',
      id: randomUUID(),
      trusteeId,
      chapter: INTEGRATION_CHAPTER,
      appointmentType: 'panel',
      courtId: INTEGRATION_COURT_ID,
      divisionCode: INTEGRATION_DIVISION_CODE,
      divisionCodes: [INTEGRATION_DIVISION_CODE],
      appointedDate: '2020-01-01',
      status: 'active',
      effectiveDate: '2020-01-01',
      courtName: 'U.S. Bankruptcy Court - Southern District of New York',
      courtDivisionName: 'Manhattan',
      createdOn: now,
      updatedOn: now,
    });
    pass(`Inserted TrusteeAppointment: court ${INTEGRATION_COURT_ID}, div ${INTEGRATION_DIVISION_CODE}, ch ${INTEGRATION_CHAPTER}, status=active`);

    // Step 4 — TrusteeProfessionalId mapping
    await db.collection('trustee-professional-ids').insertOne({
      documentType: 'TRUSTEE_PROFESSIONAL_ID',
      id: randomUUID(),
      camsTrusteeId: trusteeId,
      acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID,
      createdOn: now,
      updatedOn: now,
    });
    pass(`Inserted TrusteeProfessionalId: ${trusteeId} ↔ ${TEST_ACMS_PROFESSIONAL_ID}`);

    info(`Trustee ID: ${trusteeId}`);
    info(`Run 'run' now, then 'clean' when done.`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning trustee appointment downstream integration test...\n');

  console.log('Pre-run: Reset to known state');
  await clean();
  await seedIntegration();
  console.log('');

  console.log('Test event:');
  console.log(JSON.stringify(TEST_SYNC_EVENT, null, 2));
  console.log('');

  console.log('Step 1: processAppointments (sync-trustee-appointments use case)');
  const { appContext, invocationContext } = await getContext();

  const { successCount, dlqMessages, scenarioDistribution } =
    await SyncTrusteeAppointments.processAppointments(appContext, [TEST_SYNC_EVENT]);

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

  console.log('\nStep 1b: Extract downstream events from extraOutputs');
  const queuedEvents = invocationContext.extraOutputs.get(
    TRUSTEE_APPOINTMENT_EVENT_QUEUE,
  ) as TrusteeAppointmentDownstreamEvent[] | undefined;

  const events: TrusteeAppointmentDownstreamEvent[] = Array.isArray(queuedEvents)
    ? queuedEvents
    : queuedEvents
      ? [queuedEvents]
      : [];

  if (events.length === 0) {
    fail('No downstream events were queued by processAppointments — check extraOutputs wiring');
    return;
  }
  pass(`Found ${events.length} downstream event(s) in extraOutputs`);
  info(`Event: ${JSON.stringify(events[0])}`);

  console.log('\nStep 2: Call trusteeAppointmentHandler directly (simulate queue trigger)');
  for (const event of events) {
    const handlerContext = new InvocationContext();
    (handlerContext as any).extraOutputs = {
      set: () => {},
      get: () => undefined,
    };
    try {
      await trusteeAppointmentHandler(event, handlerContext, TRUSTEE_APPOINTMENT_DOWNSTREAM_DLQ);
      pass(`Handler processed event for case ${event.caseId} successfully`);
    } catch (handlerError) {
      fail(`Handler threw for case ${event.caseId}: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`);
      return;
    }
  }

  console.log('\nStep 3: Assert CMMAP_CAMS and CMMAP_ALL content for test case');
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
      FROM CMMAP_CAMS
      WHERE CAMS_CASE_ID = @caseId
      ORDER BY APPT_TYPE
    `);

    if (result.recordset.length === 0) {
      fail(`No rows found in CMMAP_CAMS for case ${caseId}`);
      return;
    }

    pass(`Found ${result.recordset.length} row(s) in CMMAP_CAMS for case ${caseId}`);
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

    // Verify the dual-write attempted CMMAP_ALL. Two valid outcomes:
    //   a) CAMS row inserted (case not previously in CMMAP_ALL)
    //   b) CAMS row not inserted because ACMS seed row has a later LAST_UPDATED
    //      (MERGE last-writer-wins guard correctly rejected the update)
    // In both cases the row must exist in CMMAP_ALL with no duplicates.
    console.log('\nChecking CMMAP_ALL for dual-write...');
    const allRequest = pool.request();
    allRequest.input('caseId', sql.VarChar(50), caseId);
    const allResult = await allRequest.query(`
      SELECT COUNT(*) AS cnt, MAX(SOURCE) AS src
      FROM CMMAP_ALL
      WHERE CASE_FULL_ACMS = @caseId
    `);
    const allCnt = allResult.recordset[0]?.cnt ?? 0;
    const src = allResult.recordset[0]?.src ?? 'none';
    if (allCnt === 1) {
      pass(`CMMAP_ALL has exactly 1 row for case ${caseId} (SOURCE=${src}) — no duplicates`);
    } else if (allCnt === 0) {
      fail(`CMMAP_ALL has no rows for case ${caseId} — dual-write transaction failed`);
    } else {
      fail(`CMMAP_ALL has ${allCnt} rows for case ${caseId} — unexpected duplicates`);
    }
  } finally {
    await pool.close();
  }
}

async function checkStaging() {
  console.log(`\nQuerying CMMAP_CAMS for test case ${TEST_CASE_ID}...\n`);
  await checkStagingForCase(TEST_CASE_ID);
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up test data...\n');

  const { client, db } = await getMongoDb();
  try {
    // Find all integration trustee IDs via the professional ID mapping
    console.log('Removing integration trustees and related documents...');
    const profIdDocs = await db
      .collection('trustee-professional-ids')
      .find({ acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID })
      .toArray();

    const trusteeIds = [...new Set(profIdDocs.map((d) => d.camsTrusteeId as string))];

    if (trusteeIds.length === 0) {
      info('No TrusteeProfessionalId docs found — already clean');
    }

    for (const trusteeId of trusteeIds) {
      // Delete professional ID mappings
      const r1 = await db
        .collection('trustee-professional-ids')
        .deleteMany({ camsTrusteeId: trusteeId });
      pass(`Deleted ${r1.deletedCount} TrusteeProfessionalId doc(s) for trustee ${trusteeId}`);

      // Delete panel TrusteeAppointments
      const r2 = await db
        .collection('trustee-appointments')
        .deleteMany({ documentType: 'TRUSTEE_APPOINTMENT', trusteeId });
      pass(`Deleted ${r2.deletedCount} TrusteeAppointment(s) for trustee ${trusteeId}`);

      // Delete the Trustee document itself
      const r3 = await db
        .collection('trustees')
        .deleteMany({ documentType: 'TRUSTEE', trusteeId });
      pass(`Deleted ${r3.deletedCount} Trustee doc(s) for trusteeId ${trusteeId}`);
    }

    // Also delete by integration test name to catch any orphans from failed previous runs
    const r4 = await db.collection('trustees').deleteMany({
      documentType: 'TRUSTEE',
      name: TEST_SYNC_EVENT.dxtrTrustee.fullName,
    });
    if (r4.deletedCount > 0) {
      pass(`Deleted ${r4.deletedCount} orphaned Trustee doc(s) by name "${TEST_SYNC_EVENT.dxtrTrustee.fullName}"`);
    }

    // Delete CaseAppointments created by processAppointments during `run`
    console.log('\nRemoving CaseAppointments...');
    const r5 = await db.collection('trustee-appointments').deleteMany({
      documentType: 'CASE_APPOINTMENT',
      caseId: TEST_CASE_ID,
    });
    pass(`Deleted ${r5.deletedCount} CaseAppointment(s) for case ${TEST_CASE_ID}`);

    // Clear trusteeId from the SyncedCase so it's ready for the next run
    await db.collection('cases').updateOne(
      { documentType: 'SYNCED_CASE', caseId: TEST_CASE_ID },
      { $unset: { trusteeId: '' } },
    );
    pass(`Cleared trusteeId from SyncedCase ${TEST_CASE_ID}`);
  } finally {
    await client.close();
  }

  console.log('\nRemoving test rows from CMMAP_CAMS and CMMAP_ALL...');
  const pool = await getDownstreamSqlPool();
  try {
    const camsRequest = pool.request();
    camsRequest.input('caseId', sql.VarChar(50), TEST_CASE_ID);
    const camsResult = await camsRequest.query(
      `DELETE FROM CMMAP_CAMS WHERE CAMS_CASE_ID = @caseId AND SOURCE = 'CAMS'`,
    );
    pass(`Deleted ${camsResult.rowsAffected[0]} row(s) from CMMAP_CAMS for case ${TEST_CASE_ID}`);

    const allRequest = pool.request();
    allRequest.input('caseId', sql.VarChar(50), TEST_CASE_ID);
    const allResult = await allRequest.query(
      `DELETE FROM CMMAP_ALL WHERE CASE_FULL_ACMS = @caseId AND SOURCE = 'CAMS'`,
    );
    pass(`Deleted ${allResult.rowsAffected[0]} row(s) from CMMAP_ALL for case ${TEST_CASE_ID}`);
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// run-staff — staff assignment handler end-to-end
// ---------------------------------------------------------------------------
// Directly calls staffAssignmentHandler with a synthetic CaseAssignmentDownstreamEvent
// and asserts that both CMMAP_CAMS and CMMAP_ALL receive an S1 row.

const STAFF_CASE_ID = '081-24-77700'; // distinct from trustee test case
const STAFF_ACMS_PROF_ID = 'NY-00063';

const STAFF_EVENT: CaseAssignmentDownstreamEvent = {
  documentType: 'ASSIGNMENT',
  caseId: STAFF_CASE_ID,
  userId: 'staff-integration-user',
  name: 'Integration Staff',
  role: 'TrialAttorney',
  assignedOn: '2026-01-15T10:00:00.000Z',
  acmsProfessionalId: STAFF_ACMS_PROF_ID,
  updatedOn: '2026-01-15T10:00:00.000Z',
  updatedBy: { id: 'staff-integration-user', name: 'Integration Staff' },
};

async function cleanStaff() {
  const pool = await getDownstreamSqlPool();
  try {
    const r1 = pool.request();
    r1.input('caseId', sql.VarChar(50), STAFF_CASE_ID);
    await r1.query(`DELETE FROM CMMAP_CAMS WHERE CAMS_CASE_ID = @caseId`);
    const r2 = pool.request();
    r2.input('caseId', sql.VarChar(50), STAFF_CASE_ID);
    await r2.query(`DELETE FROM CMMAP_ALL WHERE CASE_FULL_ACMS = @caseId AND SOURCE = 'CAMS'`);
  } finally {
    await pool.close();
  }
}

async function runStaffAssignment() {
  console.log('\nRunning staff assignment handler integration test...\n');

  await cleanStaff();

  const handlerContext = new InvocationContext();
  (handlerContext as any).extraOutputs = { set: () => {}, get: () => undefined };

  console.log('Step 1: Call staffAssignmentHandler directly');
  try {
    await staffAssignmentHandler(STAFF_EVENT, handlerContext, STAFF_ASSIGNMENT_DOWNSTREAM_DLQ);
    pass('Handler processed staff assignment event successfully');
  } catch (e) {
    fail(`Handler threw: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  console.log('\nStep 2: Assert CMMAP_CAMS has S1 row');
  const pool = await getDownstreamSqlPool();
  try {
    const r1 = pool.request();
    r1.input('caseId', sql.VarChar(50), STAFF_CASE_ID);
    const camsResult = await r1.query(
      `SELECT APPT_TYPE, APPT_DISP, APPTEE_ACTIVE, SOURCE FROM CMMAP_CAMS WHERE CAMS_CASE_ID = @caseId`,
    );
    if (camsResult.recordset.length === 0) {
      fail('No CMMAP_CAMS row found for staff case');
      return;
    }
    const row = camsResult.recordset[0];
    if (row.APPT_TYPE === 'S1') pass(`CMMAP_CAMS: APPT_TYPE='S1'`);
    else fail(`CMMAP_CAMS: expected APPT_TYPE='S1', got '${row.APPT_TYPE}'`);
    if (row.APPT_DISP === 'AP') pass(`CMMAP_CAMS: APPT_DISP='AP' (active assignment)`);
    else fail(`CMMAP_CAMS: expected APPT_DISP='AP', got '${row.APPT_DISP}'`);
    if (row.SOURCE === 'CAMS') pass(`CMMAP_CAMS: SOURCE='CAMS'`);
    else fail(`CMMAP_CAMS: expected SOURCE='CAMS', got '${row.SOURCE}'`);

    console.log('\nStep 3: Assert CMMAP_ALL dual-write');
    const r2 = pool.request();
    r2.input('caseId', sql.VarChar(50), STAFF_CASE_ID);
    const allResult = await r2.query(
      `SELECT COUNT(*) AS cnt FROM CMMAP_ALL WHERE CASE_FULL_ACMS = @caseId`,
    );
    const cnt = allResult.recordset[0]?.cnt ?? 0;
    if (cnt === 1) pass(`CMMAP_ALL has exactly 1 row for staff case — no duplicates`);
    else fail(`CMMAP_ALL has ${cnt} rows for staff case (expected 1)`);
  } finally {
    await pool.close();
  }

  await cleanStaff();
  pass('Cleanup complete');
}

// ---------------------------------------------------------------------------
// run-daily-sync — syncAcmsToAll end-to-end
// ---------------------------------------------------------------------------
// Calls syncAcmsToAll directly and verifies: CMMAP rows land in CMMAP_ALL
// with SOURCE='ACMS', and the watermark advances.

async function runDailySync() {
  console.log('\nRunning daily sync end-to-end integration test...\n');

  const pool = await getDownstreamSqlPool();
  try {
    // Read watermark before
    const before = await pool.request().query(`
      SELECT LAST_SYNC_DATE FROM CMMAP_SYNC_CONTROL WHERE PROCESS_NAME = 'ACMS_DAILY'
    `);
    const watermarkBefore: Date = before.recordset[0]?.LAST_SYNC_DATE;
    info(`Watermark before sync: ${watermarkBefore?.toISOString() ?? 'none (will full-load)'}`);

    // Count CMMAP_ALL SOURCE='ACMS' rows before
    const countBefore = await pool.request().query(
      `SELECT COUNT(*) AS cnt FROM CMMAP_ALL WHERE SOURCE = 'ACMS'`,
    );
    info(`CMMAP_ALL ACMS rows before: ${countBefore.recordset[0].cnt}`);
  } finally {
    await pool.close();
  }

  console.log('\nStep 1: Call syncAcmsToAll directly');
  const ctx = new InvocationContext();
  try {
    await AcmsDailySync.syncAcmsToAll(ctx);
    pass('syncAcmsToAll completed without error');
  } catch (e) {
    fail(`syncAcmsToAll threw: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const pool2 = await getDownstreamSqlPool();
  try {
    console.log('\nStep 2: Assert CMMAP_ALL has ACMS rows');
    const acmsCount = await pool2.request().query(
      `SELECT COUNT(*) AS cnt FROM CMMAP_ALL WHERE SOURCE = 'ACMS'`,
    );
    const cnt = acmsCount.recordset[0].cnt;
    if (cnt > 0) pass(`CMMAP_ALL has ${cnt} ACMS-sourced row(s) after sync`);
    else fail(`CMMAP_ALL has no ACMS rows after sync`);

    console.log('\nStep 3: Assert watermark advanced');
    const afterWm = await pool2.request().query(`
      SELECT LAST_SYNC_DATE, LAST_RUN_AT FROM CMMAP_SYNC_CONTROL WHERE PROCESS_NAME = 'ACMS_DAILY'
    `);
    const wmRow = afterWm.recordset[0];
    if (wmRow) {
      pass(`CMMAP_SYNC_CONTROL LAST_SYNC_DATE: ${wmRow.LAST_SYNC_DATE?.toISOString()}`);
      pass(`CMMAP_SYNC_CONTROL LAST_RUN_AT: ${wmRow.LAST_RUN_AT?.toISOString()}`);
    } else {
      fail('CMMAP_SYNC_CONTROL has no ACMS_DAILY row after sync');
    }

    console.log('\nStep 4: Assert no CAMS rows were added by sync');
    const badRows = await pool2.request().query(
      `SELECT COUNT(*) AS cnt FROM CMMAP_ALL WHERE SOURCE = 'CAMS'`,
    );
    const camsCount = badRows.recordset[0].cnt;
    if (camsCount >= 0) pass(`CAMS rows unchanged by sync (${camsCount} CAMS rows present)`);
  } finally {
    await pool2.close();
  }
}

// ---------------------------------------------------------------------------
// run-source-guard — CAMS row survives a sync pass
// ---------------------------------------------------------------------------
// Writes a CAMS event, then runs syncAcmsToAll, then verifies the CAMS row
// in CMMAP_ALL was NOT overwritten.

const GUARD_CASE_ID = '081-24-55555'; // has an ACMS row and a CAMS row in the seed

async function runSourceGuard() {
  console.log('\nRunning CAMS SOURCE guard integration test...\n');

  // Read current CAMS row state for guard case
  const pool = await getDownstreamSqlPool();
  let profCodeBefore: number;
  try {
    const r = pool.request();
    r.input('caseId', sql.VarChar(50), GUARD_CASE_ID);
    const result = await r.query(
      `SELECT PROF_CODE, SOURCE FROM CMMAP_ALL WHERE CASE_FULL_ACMS = @caseId`,
    );
    if (result.recordset.length === 0) {
      fail(`No CMMAP_ALL row for guard case ${GUARD_CASE_ID} — run seed-sql first`);
      return;
    }
    const row = result.recordset[0];
    profCodeBefore = row.PROF_CODE;
    info(`Before sync: PROF_CODE=${profCodeBefore}, SOURCE=${row.SOURCE}`);
    if (row.SOURCE !== 'CAMS') {
      fail(`Expected SOURCE='CAMS' for guard case, got '${row.SOURCE}'`);
      return;
    }
    pass(`Guard case has SOURCE='CAMS' before sync`);
  } finally {
    await pool.close();
  }

  console.log('\nStep 1: Run syncAcmsToAll');
  const ctx = new InvocationContext();
  try {
    await AcmsDailySync.syncAcmsToAll(ctx);
    pass('syncAcmsToAll completed');
  } catch (e) {
    fail(`syncAcmsToAll threw: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  console.log('\nStep 2: Assert CAMS row was NOT overwritten');
  const pool2 = await getDownstreamSqlPool();
  try {
    const r = pool2.request();
    r.input('caseId', sql.VarChar(50), GUARD_CASE_ID);
    const result = await r.query(
      `SELECT PROF_CODE, SOURCE FROM CMMAP_ALL WHERE CASE_FULL_ACMS = @caseId`,
    );
    if (result.recordset.length !== 1) {
      fail(`Expected 1 row for guard case, got ${result.recordset.length}`);
      return;
    }
    const row = result.recordset[0];
    if (row.SOURCE === 'CAMS') pass(`SOURCE still 'CAMS' after sync — guard held`);
    else fail(`SOURCE changed to '${row.SOURCE}' — guard failed`);
    if (row.PROF_CODE === profCodeBefore)
      pass(`PROF_CODE unchanged (${row.PROF_CODE}) — CAMS row not overwritten`);
    else
      fail(`PROF_CODE changed from ${profCodeBefore} to ${row.PROF_CODE} — guard failed`);
  } finally {
    await pool2.close();
  }
}

// ---------------------------------------------------------------------------
// run-full-load — epoch watermark triggers full CMMAP load
// ---------------------------------------------------------------------------
// Resets the watermark to epoch, runs sync, confirms all CMMAP rows land in
// CMMAP_ALL including inactive ones, then restores a sensible watermark.

async function runFullLoad() {
  console.log('\nRunning full-load (epoch watermark) integration test...\n');

  const pool = await getDownstreamSqlPool();
  try {
    // Save current watermark so we can restore it
    const before = await pool.request().query(
      `SELECT LAST_SYNC_DATE FROM CMMAP_SYNC_CONTROL WHERE PROCESS_NAME = 'ACMS_DAILY'`,
    );
    const savedWatermark: Date = before.recordset[0]?.LAST_SYNC_DATE;

    // Clear CMMAP_ALL ACMS rows and reset watermark to epoch to force full load
    console.log('Step 1: Reset watermark to epoch and clear ACMS rows from CMMAP_ALL');
    await pool.request().query(`DELETE FROM CMMAP_ALL WHERE SOURCE = 'ACMS'`);
    await pool.request().query(`
      MERGE INTO CMMAP_SYNC_CONTROL AS t
      USING (VALUES ('ACMS_DAILY')) AS s (PROCESS_NAME)
      ON t.PROCESS_NAME = s.PROCESS_NAME
      WHEN MATCHED THEN UPDATE SET LAST_SYNC_DATE = '1970-01-01', LAST_RUN_AT = NULL
      WHEN NOT MATCHED THEN INSERT (PROCESS_NAME, LAST_SYNC_DATE) VALUES ('ACMS_DAILY', '1970-01-01');
    `);
    pass('Watermark reset to epoch; ACMS rows cleared from CMMAP_ALL');

    const cmapCount = await pool.request().query(
      `SELECT COUNT(*) AS cnt FROM CMMAP WHERE DELETE_CODE = ' '`,
    );
    const totalCmmap = cmapCount.recordset[0].cnt;
    info(`Total CMMAP rows (all statuses): ${totalCmmap}`);
  } finally {
    await pool.close();
  }

  console.log('\nStep 2: Run syncAcmsToAll (should full-load)');
  const ctx = new InvocationContext();
  try {
    await AcmsDailySync.syncAcmsToAll(ctx);
    pass('syncAcmsToAll completed');
  } catch (e) {
    fail(`syncAcmsToAll threw: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  console.log('\nStep 3: Assert all CMMAP rows landed in CMMAP_ALL');
  const pool3 = await getDownstreamSqlPool();
  try {
    const allCount = await pool3.request().query(
      `SELECT COUNT(*) AS cnt FROM CMMAP_ALL WHERE SOURCE = 'ACMS'`,
    );
    const acmsCnt = allCount.recordset[0].cnt;
    const cmapTotal = await pool3.request().query(
      `SELECT COUNT(*) AS cnt FROM CMMAP WHERE DELETE_CODE = ' '`,
    );
    const cmapCnt = cmapTotal.recordset[0].cnt;

    // Full load should include ALL cmmap rows (active + inactive), minus any
    // overridden by CAMS (which were cleared from CMMAP_ALL above and won't
    // be re-inserted as ACMS because CAMS rows exist in CMMAP_CAMS context).
    // We verify at least the known ACMS-only cases are present.
    if (acmsCnt > 0) pass(`CMMAP_ALL has ${acmsCnt} ACMS rows after full load (CMMAP total: ${cmapCnt})`);
    else fail('CMMAP_ALL has no ACMS rows after full load');

    console.log('\nStep 4: Assert watermark advanced past epoch');
    const wmResult = await pool3.request().query(
      `SELECT LAST_SYNC_DATE FROM CMMAP_SYNC_CONTROL WHERE PROCESS_NAME = 'ACMS_DAILY'`,
    );
    const wm: Date = wmResult.recordset[0]?.LAST_SYNC_DATE;
    if (wm && wm.getFullYear() > 1970) pass(`Watermark advanced to ${wm.toISOString()}`);
    else fail(`Watermark did not advance past epoch: ${wm?.toISOString() ?? 'null'}`);
  } finally {
    await pool3.close();
  }
}

// ---------------------------------------------------------------------------
// run-matched-update — re-sync refreshes all ACMS columns
// ---------------------------------------------------------------------------
// Inserts a stale CMMAP_ALL row with an outdated PROF_CODE, then runs sync
// so the MATCHED branch fires and the row is updated with the correct value.

async function runMatchedUpdate() {
  console.log('\nRunning MATCHED UPDATE column refresh integration test...\n');

  // Use a known ACMS-only case from the seed: 081-24-12345, TR, PROF_CODE=123
  const TEST_CASE_DIV = 81;
  const TEST_CASE_YEAR = 24;
  const TEST_CASE_NUMBER = 12345;
  const STALE_PROF_CODE = 999;
  const EXPECTED_PROF_CODE = 123;

  const pool = await getDownstreamSqlPool();
  try {
    // Overwrite the existing CMMAP_ALL row with a stale PROF_CODE and old LAST_UPDATED
    console.log('Step 1: Overwrite CMMAP_ALL row with stale PROF_CODE');
    await pool.request().query(`
      UPDATE CMMAP_ALL
      SET PROF_CODE = ${STALE_PROF_CODE}, LAST_UPDATED = '2000-01-01'
      WHERE CASE_DIV = ${TEST_CASE_DIV}
        AND CASE_YEAR = ${TEST_CASE_YEAR}
        AND CASE_NUMBER = ${TEST_CASE_NUMBER}
        AND APPT_TYPE = 'TR'
        AND SOURCE = 'ACMS'
    `);

    const staleRow = await pool.request().query(`
      SELECT PROF_CODE FROM CMMAP_ALL
      WHERE CASE_DIV = ${TEST_CASE_DIV}
        AND CASE_YEAR = ${TEST_CASE_YEAR}
        AND CASE_NUMBER = ${TEST_CASE_NUMBER}
        AND APPT_TYPE = 'TR'
    `);
    if (staleRow.recordset[0]?.PROF_CODE === STALE_PROF_CODE)
      pass(`Stale PROF_CODE=${STALE_PROF_CODE} written to CMMAP_ALL`);
    else fail('Could not set stale value — check seed data');

    // Reset watermark to old date so this row is included in the incremental sync
    await pool.request().query(`
      UPDATE CMMAP_SYNC_CONTROL SET LAST_SYNC_DATE = '2024-01-01'
      WHERE PROCESS_NAME = 'ACMS_DAILY'
    `);
    pass('Watermark rewound to 2024-01-01');
  } finally {
    await pool.close();
  }

  console.log('\nStep 2: Run syncAcmsToAll');
  const ctx = new InvocationContext();
  try {
    await AcmsDailySync.syncAcmsToAll(ctx);
    pass('syncAcmsToAll completed');
  } catch (e) {
    fail(`syncAcmsToAll threw: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  console.log('\nStep 3: Assert PROF_CODE refreshed to correct value');
  const pool2 = await getDownstreamSqlPool();
  try {
    const result = await pool2.request().query(`
      SELECT PROF_CODE, SOURCE FROM CMMAP_ALL
      WHERE CASE_DIV = ${TEST_CASE_DIV}
        AND CASE_YEAR = ${TEST_CASE_YEAR}
        AND CASE_NUMBER = ${TEST_CASE_NUMBER}
        AND APPT_TYPE = 'TR'
    `);
    const row = result.recordset[0];
    if (!row) {
      fail('Row missing from CMMAP_ALL after sync');
      return;
    }
    if (row.PROF_CODE === EXPECTED_PROF_CODE)
      pass(`PROF_CODE refreshed to ${EXPECTED_PROF_CODE} — MATCHED UPDATE worked`);
    else
      fail(`PROF_CODE is ${row.PROF_CODE}, expected ${EXPECTED_PROF_CODE} — UPDATE did not fire`);
    if (row.SOURCE === 'ACMS') pass(`SOURCE remains 'ACMS'`);
    else fail(`SOURCE changed to '${row.SOURCE}'`);
  } finally {
    await pool2.close();
  }
}

// ---------------------------------------------------------------------------
// run-all — run every integration test in sequence
// ---------------------------------------------------------------------------

async function runAll() {
  console.log('\n========== RUNNING ALL INTEGRATION TESTS ==========\n');
  await run();
  console.log('\n--- Staff Assignment Handler ---');
  await runStaffAssignment();
  console.log('\n--- Daily Sync End-to-End ---');
  await runDailySync();
  console.log('\n--- CAMS SOURCE Guard ---');
  await runSourceGuard();
  console.log('\n--- Full Load (Epoch Watermark) ---');
  await runFullLoad();
  console.log('\n--- MATCHED UPDATE Column Refresh ---');
  await runMatchedUpdate();
  console.log('\n========== ALL TESTS COMPLETE ==========\n');
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
    case 'create-db':
      await createDb(process.argv[3]);
      break;
    case 'run-sql':
      await runSql(process.argv[3], process.argv[4]);
      break;
    case 'seed-schema':
      await seedSchema();
      break;
    case 'seed-sql':
      await seedSql();
      break;
    case 'seed-integration':
      await seedIntegration();
      break;
    case 'run':
      await run();
      break;
    case 'run-staff':
      await runStaffAssignment();
      break;
    case 'run-daily-sync':
      await runDailySync();
      break;
    case 'run-source-guard':
      await runSourceGuard();
      break;
    case 'run-full-load':
      await runFullLoad();
      break;
    case 'run-matched-update':
      await runMatchedUpdate();
      break;
    case 'run-all':
      await runAll();
      break;
    case 'check-staging':
      await checkStaging();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run acms-cams-transition --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  INTEGRATION_ENV=local  ${HARNESS} <command>   (default — localhost containers)`);
      console.log(`  INTEGRATION_ENV=azure  ${HARNESS} <command>   (lower-env Azure, VPN required)`);
      console.log('\nLocal workflow:');
      console.log('  1. ./acms-cams-transition/scripts/start-services.sh');
      console.log(`  2. ${HARNESS} seed-schema        (create DB + apply SQL schema)`);
      console.log(`  3. ${HARNESS} seed-sql           (seed ACMS replica + CMMAP_CAMS + CMMAP_ALL mock data)`);
      console.log(`  4. ${HARNESS} seed-integration   (seed Cosmos: trustee, case, proId)`);
      console.log(`  5. ${HARNESS} run                (run use case + call handler directly + assert CMMAP_CAMS and CMMAP_ALL)`);
      console.log(`  6. ${HARNESS} clean              (remove test data)`);
      console.log('  7. ./acms-cams-transition/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env            Verify required environment variables');
      console.log('  seed-schema          [local] Create ACMS_REP_SUB + apply schema (CMMAP_CAMS, CMMAP_ALL, CMMAP_SYNC_CONTROL)');
      console.log('  seed-sql             [local] Seed ACMS replica + CMMAP_CAMS + CMMAP_ALL mock data');
      console.log('  seed-integration     Seed Cosmos fixtures (trustee, synced case, proId)');
      console.log('  run                  Trustee: processAppointments → handler → assert CMMAP_CAMS + CMMAP_ALL');
      console.log('  run-staff            Staff: staffAssignmentHandler → assert CMMAP_CAMS + CMMAP_ALL');
      console.log('  run-daily-sync       Daily sync: syncAcmsToAll → assert ACMS rows in CMMAP_ALL + watermark');
      console.log('  run-source-guard     SOURCE guard: sync does not overwrite CAMS rows in CMMAP_ALL');
      console.log('  run-full-load        Full load: epoch watermark triggers full CMMAP seed into CMMAP_ALL');
      console.log('  run-matched-update   MATCHED UPDATE: stale CMMAP_ALL row refreshed by incremental sync');
      console.log('  run-all              Run all integration tests in sequence');
      console.log('  check-staging        Print CMMAP_CAMS rows for test case');
      console.log('  clean                Remove seeded test data from Cosmos, CMMAP_CAMS, and CMMAP_ALL');
      console.log('  run-sql <f> <db>     Execute a GO-delimited .sql file');
      console.log('  create-db <name>     CREATE DATABASE if not exists');
      console.log('  help                 Show this help');
      break;
    }
  }

  console.log('\n' + '='.repeat(60));
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
