/**
 * Integration smoke test harness for the migrate-case-appointments dataflow.
 *
 * Seeds known fixtures into MongoDB and SQL Edge, enqueues a start message to
 * Azurite, waits for the running function app to process it, then asserts the
 * resulting state in MongoDB and Azurite.
 *
 * The function app must be running separately before `run` (or `run-reset` /
 * `run-delete-all`) is invoked. This harness only seeds and asserts.
 *
 * Two environments are supported via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh
 *   azure            — lower-env Azure Government databases (VPN required)
 *
 * This is a one-shot script — NOT a Vitest test, NOT a Playwright E2E test.
 *
 * Usage (from test/integration/):
 *   npm run migrate-case-appointments -- [command]
 *
 * Local workflow:
 *   1. cd test/integration/migrate-case-appointments/scripts && ./start-services.sh
 *   2. npm run migrate-case-appointments -- seed-schema
 *   3. npm run migrate-case-appointments -- seed-sql
 *   4. npm run migrate-case-appointments -- seed-cosmos
 *   5. cd backend/function-apps/dataflows && npm start
 *   6. npm run migrate-case-appointments -- run
 *   7. npm run migrate-case-appointments -- clean
 *   8. cd test/integration/migrate-case-appointments/scripts && ./stop-services.sh
 *
 * Commands:
 *   check-env       Verify all required environment variables are set
 *   seed-schema     Create ACMS_INT database and apply CMMAP DDL
 *   seed-sql        Drop/recreate CMMAP rows with fixture data (idempotent)
 *   seed-cosmos     Seed TrusteeProfessionalId into MongoDB (upsert)
 *   run             Full test: clean → seed → enqueue start → wait → assert
 *   run-reset       Same as run but enqueues { reset: true } to bypass COMPLETED
 *   run-delete-all  Verifies deleteAll scopes deletion to source='acms' only
 *   clean           Remove test documents from MongoDB and clear queues
 *   help            Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { QueueServiceClient } from '@azure/storage-queue';
import { MongoClient } from 'mongodb';
import * as sql from 'mssql';

// Resolve paths relative to the repo root
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

// Environment selection: local (default) or azure
const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

// Load environment — .env.local in harness directory for local runs
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
// Queue names — derived from buildQueueName(MODULE_NAME, suffix) which
// lowercases and hyphenates. MODULE_NAME = 'MIGRATE-CASE-APPOINTMENTS'.
// ---------------------------------------------------------------------------
const START_QUEUE = 'migrate-case-appointments-start';
const DLQ_QUEUE = 'migrate-case-appointments-dlq';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ACMS_PROFESSIONAL_ID = 'NY-00063';
const CAMS_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-001';

// The two fixture case IDs that should appear after migration
const ACTIVE_CASE_ID = '081-24-12345';
const CLOSED_CASE_ID = '081-24-67890';
const DELETED_CASE_ID = '081-23-99999'; // filtered by DELETE_CODE='D'

// ---------------------------------------------------------------------------
// Pass / fail / info helpers (matches canonical harness pattern)
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

// ---------------------------------------------------------------------------
// Connection helpers
// ---------------------------------------------------------------------------

async function getMongoDb() {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName)
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

// Build an mssql ConnectionPool using ACMS_MSSQL_* env vars — same logic
// as ApplicationConfiguration.getAcmsDbConfig() but targeting a named database.
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    config.authentication = {
      type: authType,
      options: identityClientId ? { clientId: identityClientId } : {},
    } as any;
  }

  return sql.connect(config);
}

// Split a SQL file on GO batch separators and execute each batch in sequence.
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

function getStorageConnectionString(): string {
  const cs = process.env.AzureWebJobsDataflowsStorage || process.env.AzureWebJobsStorage;
  if (!cs) throw new Error('AzureWebJobsStorage or AzureWebJobsDataflowsStorage must be set');
  return cs;
}

async function getQueueClient(queueName: string) {
  const queueService = QueueServiceClient.fromConnectionString(getStorageConnectionString());
  const client = queueService.getQueueClient(queueName);
  await client.createIfNotExists();
  return client;
}

async function enqueueMessage(queueName: string, body: object): Promise<void> {
  const client = await getQueueClient(queueName);
  const encoded = Buffer.from(JSON.stringify(body)).toString('base64');
  await client.sendMessage(encoded);
}

async function getDlqMessageCount(): Promise<number> {
  try {
    const client = await getQueueClient(DLQ_QUEUE);
    const props = await client.getProperties();
    return props.approximateMessagesCount ?? 0;
  } catch {
    return 0;
  }
}

async function clearQueues(): Promise<void> {
  for (const queueName of [START_QUEUE, DLQ_QUEUE]) {
    try {
      const client = await getQueueClient(queueName);
      await client.clearMessages();
      info(`Cleared queue: ${queueName}`);
    } catch {
      // Queue may not exist yet — that's fine
    }
  }
}

// Poll MongoDB until predicate resolves or timeout is reached.
// Returns true if the predicate was satisfied before the timeout.
async function pollUntil(
  predicate: () => Promise<boolean>,
  timeoutMs = 30000,
  intervalMs = 2000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await predicate()) return true;
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    info(`Attempt ${attempt}: condition not met yet, ${remaining}s remaining...`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required: [string, string][] = [
    ['MONGO_CONNECTION_STRING', 'Cosmos DB / MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos database name'],
    ['ACMS_MSSQL_HOST', 'ACMS SQL Server host'],
    ['AzureWebJobsStorage', 'Azure Storage connection string (Azurite for local)'],
  ];

  const optional: [string, string][] = [
    ['ACMS_MSSQL_DATABASE', 'ACMS database name (default: ACMS_INT)'],
    ['ACMS_MSSQL_USER', 'ACMS SQL user (omit to use Azure AD default auth)'],
    ['ACMS_MSSQL_PASS', 'ACMS SQL password'],
    ['AzureWebJobsDataflowsStorage', 'Alternative storage connection string key'],
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
    console.log('\n  Set missing variables in .env.local before running.');
  } else {
    console.log('\n  All required variables present.');
  }
}

// ---------------------------------------------------------------------------
// seed-schema  (creates ACMS_INT database in SQL Edge)
// ---------------------------------------------------------------------------

async function seedSchema() {
  if (!IS_LOCAL) {
    console.error('seed-schema is only for local container runs. Schema already exists in Azure.');
    process.exit(1);
  }
  console.log('\nCreating ACMS_INT and applying CMMAP schema...\n');

  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';

  // Connect to master to create the database
  const master = await getAcmsSqlPool('master');
  try {
    if (!/^[A-Za-z0-9_]+$/.test(acmsDatabase)) {
      throw new Error(`Database name '${acmsDatabase}' contains invalid characters`);
    }
    await master.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${acmsDatabase}')
        CREATE DATABASE [${acmsDatabase}]
    `);
    pass(`Database '${acmsDatabase}' ready`);
  } finally {
    await master.close();
  }

  // Apply CMMAP DDL
  const pool = await getAcmsSqlPool(acmsDatabase);
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(pool, path.join(seedDir, '01-seed-cmmap.sql'));
    pass('01-seed-cmmap.sql applied (CMMAP schema created)');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-sql  (drop/recreate CMMAP rows — idempotent)
// ---------------------------------------------------------------------------

async function seedSql() {
  console.log('\nSeeding CMMAP fixture rows into ACMS_INT...\n');

  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
  const pool = await getAcmsSqlPool(acmsDatabase);
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(pool, path.join(seedDir, '01-seed-cmmap.sql'));
    pass('01-seed-cmmap.sql seeded (CMMAP rows recreated)');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos  (upsert TrusteeProfessionalId into MongoDB)
// ---------------------------------------------------------------------------

async function seedCosmos() {
  console.log('\nSeeding TrusteeProfessionalId into MongoDB...\n');

  const { client, db } = await getMongoDb();
  try {
    const now = new Date().toISOString();
    await db.collection('trustee-professional-ids').updateOne(
      {
        documentType: 'TRUSTEE_PROFESSIONAL_ID',
        acmsProfessionalId: ACMS_PROFESSIONAL_ID,
      },
      {
        $set: {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId: CAMS_TRUSTEE_ID,
          acmsProfessionalId: ACMS_PROFESSIONAL_ID,
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );
    pass(`Upserted TrusteeProfessionalId: ${CAMS_TRUSTEE_ID} ↔ ${ACMS_PROFESSIONAL_ID}`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// clean  (remove test documents from MongoDB and clear queues)
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up test data...\n');

  const { client, db } = await getMongoDb();
  try {
    // Remove case-appointments created by the migration
    const r1 = await db
      .collection('trustee-appointments')
      .deleteMany({ documentType: 'CASE_APPOINTMENT', source: 'acms' });
    pass(`Deleted ${r1.deletedCount} case-appointments with source='acms'`);

    // Remove the migration runtime-state document
    const r2 = await db
      .collection('runtime-state')
      .deleteMany({ documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' });
    pass(`Deleted ${r2.deletedCount} MIGRATE_CASE_APPOINTMENTS_STATE doc(s)`);

    // Remove the TrusteeProfessionalId fixture
    const r3 = await db
      .collection('trustee-professional-ids')
      .deleteMany({ acmsProfessionalId: ACMS_PROFESSIONAL_ID });
    pass(`Deleted ${r3.deletedCount} TrusteeProfessionalId doc(s) for ${ACMS_PROFESSIONAL_ID}`);

    // Remove harness-inserted dxtr doc (from run-delete-all test)
    await db
      .collection('trustee-appointments')
      .deleteMany({ documentType: 'CASE_APPOINTMENT', trusteeId: 'DXTR-TRUSTEE-HARNESS' });
  } finally {
    await client.close();
  }

  await clearQueues();
  pass('Queues cleared');
}

// ---------------------------------------------------------------------------
// assert helpers
// ---------------------------------------------------------------------------

async function assertHappyPath(db: ReturnType<MongoClient['db']>) {
  console.log('\nAssertions:\n');

  // 1. Exactly 2 case-appointments with source='acms'
  const acmsDocs = await db
    .collection('trustee-appointments')
    .find({ documentType: 'CASE_APPOINTMENT', source: 'acms' })
    .toArray();

  if (acmsDocs.length === 2) {
    pass(`2 case-appointments found with source='acms'`);
  } else {
    fail(`Expected 2 case-appointments with source='acms', got ${acmsDocs.length}`);
  }

  // 2. Active appointment assertions (081-24-12345)
  const activeDoc = acmsDocs.find((d) => d.caseId === ACTIVE_CASE_ID);
  if (!activeDoc) {
    fail(`No case-appointment found for caseId '${ACTIVE_CASE_ID}'`);
  } else {
    pass(`case-appointment found for caseId '${ACTIVE_CASE_ID}'`);
    if (activeDoc.trusteeId === CAMS_TRUSTEE_ID) {
      pass(`trusteeId === '${CAMS_TRUSTEE_ID}'`);
    } else {
      fail(`trusteeId: expected '${CAMS_TRUSTEE_ID}', got '${activeDoc.trusteeId}'`);
    }
    if (activeDoc.assignedOn === '2020-01-15') {
      pass(`assignedOn === '2020-01-15'`);
    } else {
      fail(`assignedOn: expected '2020-01-15', got '${activeDoc.assignedOn}'`);
    }
    if (!activeDoc.unassignedOn) {
      pass(`unassignedOn is absent (active appointment)`);
    } else {
      fail(`unassignedOn should be absent for active appointment, got '${activeDoc.unassignedOn}'`);
    }
  }

  // 3. Closed appointment assertions (081-24-67890)
  const closedDoc = acmsDocs.find((d) => d.caseId === CLOSED_CASE_ID);
  if (!closedDoc) {
    fail(`No case-appointment found for caseId '${CLOSED_CASE_ID}'`);
  } else {
    pass(`case-appointment found for caseId '${CLOSED_CASE_ID}'`);
    if (closedDoc.unassignedOn === '2021-06-30') {
      pass(`unassignedOn === '2021-06-30'`);
    } else {
      fail(`unassignedOn: expected '2021-06-30', got '${closedDoc.unassignedOn}'`);
    }
  }

  // 4. Deleted record must NOT appear
  const deletedDoc = acmsDocs.find((d) => d.caseId === DELETED_CASE_ID);
  if (!deletedDoc) {
    pass(`No case-appointment for deleted caseId '${DELETED_CASE_ID}' (correctly filtered)`);
  } else {
    fail(`case-appointment for deleted caseId '${DELETED_CASE_ID}' should not exist`);
  }

  // 5. runtime-state shows COMPLETED
  const stateDoc = await db
    .collection('runtime-state')
    .findOne({ documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' });
  if (!stateDoc) {
    fail(`No MIGRATE_CASE_APPOINTMENTS_STATE doc found in runtime-state`);
  } else if (stateDoc.status === 'COMPLETED') {
    pass(`runtime-state.status === 'COMPLETED'`);
  } else {
    fail(`runtime-state.status: expected 'COMPLETED', got '${stateDoc.status}'`);
  }

  // 6. DLQ is empty
  const dlqCount = await getDlqMessageCount();
  if (dlqCount === 0) {
    pass('DLQ is empty');
  } else {
    fail(`DLQ has ${dlqCount} message(s) — check function app logs`);
  }
}

// ---------------------------------------------------------------------------
// run  (full happy-path test)
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning migrate-case-appointments happy path test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed SQL fixture rows');
  await seedSql();
  console.log('');

  console.log('Step 2: Seed Cosmos fixture (TrusteeProfessionalId)');
  await seedCosmos();
  console.log('');

  console.log('Step 3: Enqueue start message {}');
  await enqueueMessage(START_QUEUE, {});
  pass(`Enqueued {} to '${START_QUEUE}'`);
  console.log('');

  console.log('Step 4: Wait for function app to process (up to 30s)');
  const { client, db } = await getMongoDb();
  try {
    const satisfied = await pollUntil(async () => {
      const count = await db
        .collection('trustee-appointments')
        .countDocuments({ documentType: 'CASE_APPOINTMENT', source: 'acms' });
      return count >= 2;
    });

    if (!satisfied) {
      fail(
        'Timed out waiting for 2 case-appointments with source=acms — is the function app running?',
      );
      return;
    }
    pass('Detected 2 case-appointments with source=acms in MongoDB');
    console.log('');

    await assertHappyPath(db);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-reset  (verifies { reset: true } bypasses COMPLETED state)
// ---------------------------------------------------------------------------

async function runReset() {
  console.log('\nRunning migrate-case-appointments reset-flag test...\n');

  console.log('Phase 1: Run happy path to reach COMPLETED state');
  await run();

  // Verify COMPLETED before proceeding
  const { client: c1, db: db1 } = await getMongoDb();
  let currentStatus: string | undefined;
  try {
    const stateDoc = await db1
      .collection('runtime-state')
      .findOne({ documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' });
    currentStatus = stateDoc?.status as string | undefined;
  } finally {
    await c1.close();
  }

  if (currentStatus !== 'COMPLETED') {
    fail(`Expected COMPLETED state before reset test, got '${currentStatus}' — aborting`);
    return;
  }
  pass(`State is COMPLETED — proceeding with reset test`);
  console.log('');

  console.log('Phase 2: Enqueue { reset: true } and wait for re-run to complete');
  await enqueueMessage(START_QUEUE, { reset: true });
  pass(`Enqueued { reset: true } to '${START_QUEUE}'`);

  const { client: c2, db: db2 } = await getMongoDb();
  try {
    // Wait for state to transition through IN_PROGRESS back to COMPLETED
    const satisfied = await pollUntil(async () => {
      const stateDoc = await db2
        .collection('runtime-state')
        .findOne({ documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' });
      // We want COMPLETED to appear again after a reset triggered a re-run
      return stateDoc?.status === 'COMPLETED';
    }, 45000);

    if (!satisfied) {
      fail('Timed out waiting for COMPLETED state after reset — is the function app running?');
      return;
    }
    pass(`runtime-state returned to COMPLETED after reset`);
    console.log('');

    // Assert same 2 appointments still present (idempotent — no duplicates)
    console.log('Asserting idempotency (no duplicate appointments):\n');
    const acmsDocs = await db2
      .collection('trustee-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', source: 'acms' })
      .toArray();

    if (acmsDocs.length === 2) {
      pass(`Exactly 2 case-appointments with source='acms' (no duplicates created)`);
    } else {
      fail(
        `Expected 2 case-appointments after reset, got ${acmsDocs.length} — duplicates may have been created`,
      );
    }

    const dlqCount = await getDlqMessageCount();
    if (dlqCount === 0) {
      pass('DLQ is empty');
    } else {
      fail(`DLQ has ${dlqCount} message(s)`);
    }
  } finally {
    await c2.close();
  }
}

// ---------------------------------------------------------------------------
// run-delete-all  (verifies deleteAll scopes deletion to source='acms' only)
// ---------------------------------------------------------------------------

async function runDeleteAll() {
  console.log('\nRunning migrate-case-appointments deleteAll test...\n');

  console.log('Phase 1: Run happy path to seed ACMS appointments');
  await run();
  console.log('');

  console.log('Phase 2: Manually insert a source=dxtr appointment for cross-source test');
  const { client: c1, db: db1 } = await getMongoDb();
  try {
    const now = new Date().toISOString();
    await db1.collection('trustee-appointments').insertOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: ACTIVE_CASE_ID,
      trusteeId: 'DXTR-TRUSTEE-HARNESS',
      assignedOn: '2019-01-01',
      source: 'dxtr',
      createdOn: now,
      updatedOn: now,
    });
    pass(`Inserted source='dxtr' appointment for caseId '${ACTIVE_CASE_ID}'`);
    const totalBefore = await db1
      .collection('trustee-appointments')
      .countDocuments({ documentType: 'CASE_APPOINTMENT' });
    info(`Total case-appointments before deleteAll: ${totalBefore}`);
  } finally {
    await c1.close();
  }
  console.log('');

  console.log('Phase 3: Enqueue { deleteAll: true }');
  await enqueueMessage(START_QUEUE, { deleteAll: true });
  pass(`Enqueued { deleteAll: true } to '${START_QUEUE}'`);
  console.log('');

  console.log('Phase 4: Wait for COMPLETED state (up to 45s)');
  const { client: c2, db: db2 } = await getMongoDb();
  try {
    // After deleteAll the handler deletes acms docs then re-runs the full migration,
    // ending in COMPLETED. We poll for 3 total docs (2 acms + 1 dxtr).
    const satisfied = await pollUntil(async () => {
      const stateDoc = await db2
        .collection('runtime-state')
        .findOne({ documentType: 'MIGRATE_CASE_APPOINTMENTS_STATE' });
      return stateDoc?.status === 'COMPLETED';
    }, 45000);

    if (!satisfied) {
      fail('Timed out waiting for COMPLETED state after deleteAll — is the function app running?');
      return;
    }
    pass('runtime-state is COMPLETED after deleteAll re-run');
    console.log('');

    // Assert final state
    console.log('Assertions:\n');
    const acmsDocs = await db2
      .collection('trustee-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', source: 'acms' })
      .toArray();
    // Check specifically for the harness-inserted dxtr doc (by trusteeId sentinel)
    const harnessDoc = await db2
      .collection('trustee-appointments')
      .findOne({ documentType: 'CASE_APPOINTMENT', source: 'dxtr', trusteeId: 'DXTR-TRUSTEE-HARNESS' });

    if (acmsDocs.length === 2) {
      pass(`2 case-appointments with source='acms' re-created`);
    } else {
      fail(`Expected 2 acms case-appointments, got ${acmsDocs.length}`);
    }

    if (harnessDoc) {
      pass(`Harness dxtr appointment (trusteeId='DXTR-TRUSTEE-HARNESS') still present (not deleted)`);
    } else {
      fail(`Expected harness dxtr appointment to still be present but it was deleted`);
    }

    if (acmsDocs.length === 2 && harnessDoc) {
      pass(`Correct totals: 2 acms + harness dxtr doc intact`);
    } else {
      fail(`Unexpected state: ${acmsDocs.length} acms docs, harness dxtr doc ${harnessDoc ? 'present' : 'missing'}`);
    }

    const dlqCount = await getDlqMessageCount();
    if (dlqCount === 0) {
      pass('DLQ is empty');
    } else {
      fail(`DLQ has ${dlqCount} message(s)`);
    }
  } finally {
    await c2.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('migrate-case-appointments — Integration Smoke Test Harness');
  console.log('='.repeat(60));

  switch (command) {
    case 'check-env':
      await checkEnv();
      break;
    case 'seed-schema':
      await seedSchema();
      break;
    case 'seed-sql':
      await seedSql();
      break;
    case 'seed-cosmos':
      await seedCosmos();
      break;
    case 'run':
      await run();
      break;
    case 'run-reset':
      await runReset();
      break;
    case 'run-delete-all':
      await runDeleteAll();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run migrate-case-appointments --';
      console.log('\nUsage (from test/integration/):');
      console.log(
        `  INTEGRATION_ENV=local  ${HARNESS} <command>   (default — localhost containers)`,
      );
      console.log(
        `  INTEGRATION_ENV=azure  ${HARNESS} <command>   (lower-env Azure, VPN required)`,
      );
      console.log('\nLocal workflow:');
      console.log('  1. ./migrate-case-appointments/scripts/start-services.sh');
      console.log(`  2. ${HARNESS} seed-schema        (create ACMS_INT + apply CMMAP DDL)`);
      console.log(`  3. ${HARNESS} seed-sql           (seed fixture rows into CMMAP)`);
      console.log(`  4. ${HARNESS} seed-cosmos        (seed TrusteeProfessionalId in MongoDB)`);
      console.log('  5. cd backend/function-apps/dataflows && npm start');
      console.log(`  6. ${HARNESS} run                (full happy path test)`);
      console.log(`  7. ${HARNESS} clean              (remove test data)`);
      console.log('  8. ./migrate-case-appointments/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env       Verify required environment variables');
      console.log('  seed-schema     [local] Create ACMS_INT + apply CMMAP DDL');
      console.log('  seed-sql        [local] Seed CMMAP fixture rows (idempotent)');
      console.log('  seed-cosmos     Seed TrusteeProfessionalId into MongoDB');
      console.log('  run             Full test: clean → seed → enqueue → wait → assert');
      console.log('  run-reset       Verify { reset: true } bypasses COMPLETED state');
      console.log('  run-delete-all  Verify deleteAll scopes deletion to source=acms only');
      console.log('  clean           Remove test documents and clear queues');
      console.log('  help            Show this help');
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
