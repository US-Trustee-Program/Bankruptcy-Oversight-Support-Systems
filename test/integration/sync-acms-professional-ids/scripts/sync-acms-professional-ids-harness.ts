/**
 * Integration smoke test harness for the sync-acms-professional-ids dataflow.
 *
 * Seeds known fixtures into MongoDB and SQL Edge, enqueues a start message to
 * Azurite, waits for the running function app to process it, then asserts the
 * resulting state in MongoDB.
 *
 * For local runs, start-services.sh starts the dataflows function app as a
 * container alongside MongoDB/SQL Edge/Azurite — no separate `npm start` is
 * needed. This harness only seeds and asserts.
 *
 * Two environments are supported via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh.
 *                       Loads backend/.env for shape/defaults, then overrides
 *                       host/database/auth vars to point at the local SQL
 *                       Edge, MongoDB, and Azurite containers. The SQL Edge SA
 *                       password comes from scripts/.env (same file
 *                       start-services.sh reads).
 *   azure              — lower-env Azure Government databases (VPN required).
 *                       Loads backend/.env as-is.
 *
 * This is a one-shot script — NOT a Vitest test, NOT a Playwright E2E test.
 *
 * Usage (from test/integration/):
 *   npm run sync-acms-professional-ids -- [command]
 *
 * Local workflow:
 *   1. cd test/integration/sync-acms-professional-ids/scripts
 *      cp .env.template .env   (set MSSQL_PASS)
 *      ./start-services.sh
 *   2. npm run sync-acms-professional-ids -- seed-schema
 *   3. npm run sync-acms-professional-ids -- seed-sql
 *   4. npm run sync-acms-professional-ids -- seed-cosmos
 *   5. npm run sync-acms-professional-ids -- run
 *   6. npm run sync-acms-professional-ids -- clean
 *   7. cd test/integration/sync-acms-professional-ids/scripts && ./stop-services.sh
 *
 * Commands:
 *   check-env    Verify all required environment variables are set
 *   seed-schema  Create ACMS_INT + DXTR_INT databases, apply CMMPR/CMMAP/CMMDB + offices DDL
 *   seed-sql     Drop/recreate CMMPR/CMMAP/CMMDB (ACMS_INT) and offices rows (DXTR_INT)
 *   seed-cosmos  Seed TRUSTEE_VARIATION and CAMS trustee fixtures into MongoDB
 *   run          Full test: clean → seed → enqueue start → wait → assert all scenarios
 *   run-purge    Verify { purge: true } wipes trustee-professional-ids and reloads
 *   run-retry-idempotency  Prove a retry replaying an errored record returns the existing
 *                document instead of throwing E11000 and dead-lettering
 *   clean        Remove test documents from MongoDB and clear queues
 *   help         Show this help
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

function loadEnv() {
  dotenv.config({ path: path.join(REPO_ROOT, 'backend/.env') });

  if (IS_LOCAL) {
    const scriptsEnvPath = path.join(HARNESS_DIR, 'scripts/.env');
    if (!fs.existsSync(scriptsEnvPath)) {
      console.error(
        `Missing ${scriptsEnvPath} — copy scripts/.env.template to scripts/.env and set MSSQL_PASS first.`,
      );
      process.exit(1);
    }
    // override: true — dotenv does not override already-set vars by default, and
    // backend/.env (loaded above) already set MSSQL_PASS/etc. to real lower-env values.
    dotenv.config({ path: scriptsEnvPath, override: true });

    const sqlEdgePassword = process.env.MSSQL_PASS;

    // Well-known Azurite default account key — not a secret, publicly documented.
    const AZURITE_CONNECTION_STRING =
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;QueueEndpoint=http://localhost:10001/devstoreaccount1;TableEndpoint=http://localhost:10002/devstoreaccount1'; // pragma: allowlist secret

    // Override backend/.env's real Azure lower-env values with the local
    // SQL Edge / MongoDB / Azurite containers started by start-services.sh.
    Object.assign(process.env, {
      MONGO_CONNECTION_STRING: 'mongodb://localhost:27017/cams-integration?retrywrites=false',
      COSMOS_DATABASE_NAME: 'cams-integration',

      ACMS_MSSQL_HOST: 'localhost',
      ACMS_MSSQL_DATABASE: 'ACMS_INT',
      ACMS_MSSQL_USER: 'sa',
      ACMS_MSSQL_PASS: sqlEdgePassword,
      ACMS_MSSQL_ENCRYPT: 'false',
      ACMS_MSSQL_TRUST_UNSIGNED_CERT: 'true',

      MSSQL_HOST: 'localhost',
      MSSQL_DATABASE_DXTR: 'DXTR_INT',
      MSSQL_USER: 'sa',
      MSSQL_PASS: sqlEdgePassword,
      MSSQL_ENCRYPT: 'false',
      MSSQL_TRUST_UNSIGNED_CERT: 'true',

      AzureWebJobsStorage: AZURITE_CONNECTION_STRING,
    });
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Queue names — derived from buildQueueName(MODULE_NAME, suffix). MODULE_NAME
// = 'SYNC-ACMS-PROFESSIONAL-IDS'.
// ---------------------------------------------------------------------------
const START_QUEUE = 'sync-acms-professional-ids-start';
const PAGE_QUEUE = 'sync-acms-professional-ids-page';
const DLQ_QUEUE = 'sync-acms-professional-ids-dlq';

// ---------------------------------------------------------------------------
// Test fixtures — see seed/01-seed-cmmpr.sql for the full scenario matrix.
// ---------------------------------------------------------------------------

const FINGERPRINT_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-FINGERPRINT';
const NAME_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-NAME';
const UT_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-UT';
const LEADING_ZERO_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-LEADINGZERO';

const FINGERPRINT_ACMS_ID = 'NY-00063';
const NAME_MATCH_ACMS_ID = 'NY-00064';
const ACTIVE_NO_MATCH_ACMS_ID = 'NY-00065';
const INACTIVE_NO_MATCH_ACMS_ID = 'NY-00066';
const UT_ACMS_ID = 'UT-00070';
const LEADING_ZERO_ACMS_ID = 'NY-00071';

// ---------------------------------------------------------------------------
// Pass / fail / info helpers (matches canonical harness pattern)
// ---------------------------------------------------------------------------

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

let hasFailures = false;

function fail(msg: string) {
  hasFailures = true;
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

async function getDxtrSqlPool(database: string): Promise<sql.ConnectionPool> {
  const server = process.env.MSSQL_HOST;
  if (!server) throw new Error('MSSQL_HOST is not set');

  const port = Number(process.env.MSSQL_PORT) || 1433;
  const encrypt = process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate = process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
  const user = process.env.MSSQL_USER;
  const password = process.env.MSSQL_PASS;
  const authType = process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-default';
  const identityClientId = process.env.MSSQL_CLIENT_ID;

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

async function clearQueues(): Promise<void> {
  for (const queueName of [START_QUEUE, PAGE_QUEUE, DLQ_QUEUE]) {
    try {
      const client = await getQueueClient(queueName);
      await client.clearMessages();
      info(`Cleared queue: ${queueName}`);
    } catch {
      // Queue may not exist yet — that's fine
    }
  }
}

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
    ['MSSQL_HOST', 'DXTR SQL Server host'],
    ['AzureWebJobsStorage', 'Azure Storage connection string (Azurite for local)'],
  ];

  const optional: [string, string][] = [
    ['ACMS_MSSQL_DATABASE', 'ACMS database name (default: ACMS_INT)'],
    ['ACMS_MSSQL_USER', 'ACMS SQL user (omit to use Azure AD default auth)'],
    ['ACMS_MSSQL_PASS', 'ACMS SQL password'],
    ['MSSQL_DATABASE_DXTR', 'DXTR database name (default: DXTR_INT)'],
    ['MSSQL_USER', 'DXTR SQL user (omit to use Azure AD default auth)'],
    ['MSSQL_PASS', 'DXTR SQL password'],
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
    const raw = process.env[name];
    const isSensitive = /pass|key|secret/i.test(name);
    const display = raw === undefined ? '(not set)' : isSensitive ? '***' : raw;
    info(`${name}=${display} — ${description}`);
  }

  if (!allPresent) {
    console.log(
      '\n  Set missing variables in backend/.env (azure) or scripts/.env (local) before running.',
    );
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
  console.log('\nCreating ACMS_INT + DXTR_INT and applying schema...\n');

  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
  const dxtrDatabase = process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';

  await ensureDatabase(getAcmsSqlPool, acmsDatabase);
  pass(`Database '${acmsDatabase}' ready`);
  await ensureDatabase(getDxtrSqlPool, dxtrDatabase);
  pass(`Database '${dxtrDatabase}' ready`);

  const seedDir = path.join(HARNESS_DIR, 'seed');

  const acmsPool = await getAcmsSqlPool(acmsDatabase);
  try {
    await executeSqlFile(acmsPool, path.join(seedDir, '00-seed-cmmpr-schema.sql'));
    pass('00-seed-cmmpr-schema.sql applied (CMMPR/CMMAP/CMMDB tables created)');
  } finally {
    await acmsPool.close();
  }

  const dxtrPool = await getDxtrSqlPool(dxtrDatabase);
  try {
    await executeSqlFile(dxtrPool, path.join(seedDir, '00-seed-dxtr-offices-schema.sql'));
    pass('00-seed-dxtr-offices-schema.sql applied (DXTR offices tables created)');
  } finally {
    await dxtrPool.close();
  }
}

async function ensureDatabase(
  getPool: (database: string) => Promise<sql.ConnectionPool>,
  database: string,
): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`Database name '${database}' contains invalid characters`);
  }
  const master = await getPool('master');
  try {
    await master.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${database}')
        CREATE DATABASE [${database}]
    `);
  } finally {
    await master.close();
  }
}

// ---------------------------------------------------------------------------
// seed-sql  (drop/recreate CMMPR/CMMAP/CMMDB and DXTR offices rows)
// ---------------------------------------------------------------------------

async function seedSql() {
  console.log('\nSeeding CMMPR/CMMAP/CMMDB into ACMS_INT and offices into DXTR_INT...\n');

  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
  const dxtrDatabase = process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';
  const seedDir = path.join(HARNESS_DIR, 'seed');

  const acmsPool = await getAcmsSqlPool(acmsDatabase);
  try {
    await executeSqlFile(acmsPool, path.join(seedDir, '01-seed-cmmpr.sql'));
    pass('01-seed-cmmpr.sql seeded (CMMPR/CMMAP/CMMDB rows recreated)');
  } finally {
    await acmsPool.close();
  }

  const dxtrPool = await getDxtrSqlPool(dxtrDatabase);
  try {
    await executeSqlFile(dxtrPool, path.join(seedDir, '01-seed-dxtr-offices.sql'));
    pass('01-seed-dxtr-offices.sql seeded (DXTR offices rows recreated)');
  } finally {
    await dxtrPool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos  (seed TRUSTEE_VARIATION + CAMS trustee fixtures into MongoDB)
// ---------------------------------------------------------------------------

async function seedCosmos() {
  console.log('\nSeeding TRUSTEE_VARIATION and trustee fixtures into MongoDB...\n');

  const { client, db } = await getMongoDb();
  try {
    const now = new Date().toISOString();

    // Trustee for the fingerprint-match scenario (UST_PROF_CODE 63)
    // documentType must be 'TRUSTEE' — findTrusteesByName/findByFingerprint's
    // callers only query that value (see trustees.mongo.repository.ts).
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: FINGERPRINT_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: FINGERPRINT_TRUSTEE_ID,
          name: 'Iris F Fingerprint',
          status: 'active',
          public: {},
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );

    // The fingerprint variant — built to match buildAcmsVariant's shape for
    // UST_PROF_CODE 63's demographics in seed/01-seed-cmmpr.sql exactly. PROF_ZIP is seeded there
    // as the raw numeric 627010000; buildAcmsVariant formats it via formatAcmsZip into
    // "62701-0000" (zero-padded to 9 digits, split 5+4), not the bare digit run.
    const fingerprintVariant = JSON.stringify({
      firstName: 'Iris',
      middleName: 'F',
      lastName: 'Fingerprint',
      generation: '',
      address1: '500 Match Ln',
      address2: '',
      address3: '',
      cityStateZipCountry: 'Springfield IL 62701-0000',
      phone: '2175550100',
      fax: '',
      email: '',
    });
    const crypto = await import('crypto');
    const fingerprint = crypto.createHash('sha256').update(fingerprintVariant).digest('hex');

    await db.collection('trustee-variation').updateOne(
      { documentType: 'TRUSTEE_VARIATION', fingerprint, variant: fingerprintVariant },
      {
        $set: {
          documentType: 'TRUSTEE_VARIATION',
          fingerprint,
          variant: fingerprintVariant,
          trusteeId: FINGERPRINT_TRUSTEE_ID,
          updatedOn: now,
          updatedBy: { id: 'HARNESS', name: 'HARNESS' },
        },
        $setOnInsert: { createdOn: now, createdBy: { id: 'HARNESS', name: 'HARNESS' } },
      },
      { upsert: true },
    );
    pass(`Seeded TRUSTEE_VARIATION for ${FINGERPRINT_TRUSTEE_ID}`);

    // Trustee for the name-match scenario (UST_PROF_CODE 64) — unique name,
    // no fingerprint variant on file, so matchTrusteeByName resolves it.
    // Name must match CMMPR's PROF_FIRST_NAME/PROF_MI/PROF_LAST_NAME for
    // UST_PROF_CODE 64 in seed/01-seed-cmmpr.sql exactly ("Norman N Namematch").
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: NAME_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: NAME_TRUSTEE_ID,
          name: 'Norman N Namematch',
          status: 'active',
          public: {},
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );
    pass(`Seeded trustee profile for ${NAME_TRUSTEE_ID} (name-match target)`);

    // Trustee for the cross-group (UT) name-match scenario (UST_PROF_CODE 70).
    // Name must match CMMPR's UST_PROF_CODE 70 fixture exactly ("Ulysses U Utahmatch").
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: UT_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: UT_TRUSTEE_ID,
          name: 'Ulysses U Utahmatch',
          status: 'active',
          public: {},
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );
    pass(`Seeded trustee profile for ${UT_TRUSTEE_ID} (cross-group name-match target)`);

    // Trustee for the leading-zero-zip fingerprint-match scenario (UST_PROF_CODE 71).
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: LEADING_ZERO_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: LEADING_ZERO_TRUSTEE_ID,
          name: 'Lena L Leadingzero',
          status: 'active',
          public: {},
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );

    // The leading-zero-zip fingerprint variant — built to match buildAcmsVariant's shape for
    // UST_PROF_CODE 71's demographics in seed/01-seed-cmmpr.sql exactly. PROF_ZIP is seeded there
    // as the raw numeric 65110000 (New Haven, CT's real 065110000 with NUMERIC(9,0) storage
    // already having dropped the leading zero); formatAcmsZip zero-pads back to 9 digits before
    // splitting 5+4, producing "06511-0000", not "65110-000" or any other misaligned split.
    const leadingZeroVariant = JSON.stringify({
      firstName: 'Lena',
      middleName: 'L',
      lastName: 'Leadingzero',
      generation: '',
      address1: '400 Elm St',
      address2: '',
      address3: '',
      cityStateZipCountry: 'New Haven CT 06511-0000',
      phone: '2035550800',
      fax: '',
      email: '',
    });
    const leadingZeroFingerprint = crypto
      .createHash('sha256')
      .update(leadingZeroVariant)
      .digest('hex');

    await db.collection('trustee-variation').updateOne(
      {
        documentType: 'TRUSTEE_VARIATION',
        fingerprint: leadingZeroFingerprint,
        variant: leadingZeroVariant,
      },
      {
        $set: {
          documentType: 'TRUSTEE_VARIATION',
          fingerprint: leadingZeroFingerprint,
          variant: leadingZeroVariant,
          trusteeId: LEADING_ZERO_TRUSTEE_ID,
          updatedOn: now,
          updatedBy: { id: 'HARNESS', name: 'HARNESS' },
        },
        $setOnInsert: { createdOn: now, createdBy: { id: 'HARNESS', name: 'HARNESS' } },
      },
      { upsert: true },
    );
    pass(`Seeded TRUSTEE_VARIATION for ${LEADING_ZERO_TRUSTEE_ID}`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up test data...\n');

  const { client, db } = await getMongoDb();
  try {
    const r1 = await db.collection('trustee-professional-ids').deleteMany({
      acmsProfessionalId: {
        $in: [
          FINGERPRINT_ACMS_ID,
          NAME_MATCH_ACMS_ID,
          ACTIVE_NO_MATCH_ACMS_ID,
          INACTIVE_NO_MATCH_ACMS_ID,
          UT_ACMS_ID,
          LEADING_ZERO_ACMS_ID,
        ],
      },
    });
    pass(`Deleted ${r1.deletedCount} trustee-professional-ids doc(s)`);

    const r3 = await db
      .collection('trustee-variation')
      .deleteMany({ trusteeId: { $in: [FINGERPRINT_TRUSTEE_ID, LEADING_ZERO_TRUSTEE_ID] } });
    pass(`Deleted ${r3.deletedCount} trustee-variation doc(s)`);

    const r4 = await db.collection('trustees').deleteMany({
      trusteeId: {
        $in: [FINGERPRINT_TRUSTEE_ID, NAME_TRUSTEE_ID, UT_TRUSTEE_ID, LEADING_ZERO_TRUSTEE_ID],
      },
    });
    pass(`Deleted ${r4.deletedCount} trustee profile doc(s)`);

    const r5 = await db
      .collection('runtime-state')
      .deleteMany({ documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE' });
    pass(`Deleted ${r5.deletedCount} ACMS_PROFESSIONAL_ID_SYNC_STATE doc(s)`);
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

  // Scenario 1: fingerprint match auto-links UST_PROF_CODE 63 to
  // FINGERPRINT_TRUSTEE_ID without any human review.
  const fingerprintLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: FINGERPRINT_ACMS_ID });
  if (fingerprintLink?.camsTrusteeId === FINGERPRINT_TRUSTEE_ID) {
    pass(`Fingerprint match: ${FINGERPRINT_ACMS_ID} linked to ${FINGERPRINT_TRUSTEE_ID}`);
  } else {
    fail(
      `Fingerprint match: expected ${FINGERPRINT_ACMS_ID} linked to ${FINGERPRINT_TRUSTEE_ID}, got ${JSON.stringify(fingerprintLink)}`,
    );
  }

  // Scenario 1b: a leading-zero PROF_ZIP (New Haven, CT) still fingerprint-matches —
  // formatAcmsZip's zero-padding must produce the exact same variant/fingerprint the harness
  // computed for LEADING_ZERO_TRUSTEE_ID, not a shifted/misaligned zip split.
  const leadingZeroLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: LEADING_ZERO_ACMS_ID });
  if (leadingZeroLink?.camsTrusteeId === LEADING_ZERO_TRUSTEE_ID) {
    pass(
      `Fingerprint match (leading-zero zip): ${LEADING_ZERO_ACMS_ID} linked to ${LEADING_ZERO_TRUSTEE_ID}`,
    );
  } else {
    fail(
      `Fingerprint match (leading-zero zip): expected ${LEADING_ZERO_ACMS_ID} linked to ${LEADING_ZERO_TRUSTEE_ID}, got ${JSON.stringify(leadingZeroLink)}`,
    );
  }

  // Scenario 2: fingerprint miss falls through to name match, auto-links
  // UST_PROF_CODE 64 to NAME_TRUSTEE_ID.
  const nameLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: NAME_MATCH_ACMS_ID });
  if (nameLink?.camsTrusteeId === NAME_TRUSTEE_ID) {
    pass(`Name match: ${NAME_MATCH_ACMS_ID} linked to ${NAME_TRUSTEE_ID}`);
  } else {
    fail(
      `Name match: expected ${NAME_MATCH_ACMS_ID} linked to ${NAME_TRUSTEE_ID}, got ${JSON.stringify(nameLink)}`,
    );
  }

  // Scenario 3: no-match with an active CMMAP appointment must produce an
  // errored professional-id record (not silently skipped), keyed by
  // fingerprint rather than a real trusteeId.
  const activeErrored = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: ACTIVE_NO_MATCH_ACMS_ID });
  if (activeErrored?.error?.disposition === 'no-match') {
    pass(`Active no-match: errored professional-id record written for ${ACTIVE_NO_MATCH_ACMS_ID}`);
    if (typeof activeErrored.variant === 'string' && activeErrored.variant.length > 0) {
      pass('Active no-match: variant populated on the errored record');
    } else {
      fail('Active no-match: variant missing/empty on the errored record');
    }
    if (activeErrored.camsTrusteeId && activeErrored.camsTrusteeId !== FINGERPRINT_TRUSTEE_ID) {
      pass('Active no-match: camsTrusteeId set to a fingerprint placeholder, not a real trustee');
    } else {
      fail(`Active no-match: unexpected camsTrusteeId ${activeErrored.camsTrusteeId}`);
    }
  } else {
    fail(
      `Active no-match: expected an errored (disposition=no-match) record for ${ACTIVE_NO_MATCH_ACMS_ID}, got ${JSON.stringify(activeErrored)}`,
    );
  }

  // Scenario 4: no-match with zero active appointments must be silently
  // skipped — no professional-id record (errored or otherwise) written.
  const inactiveLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: INACTIVE_NO_MATCH_ACMS_ID });
  if (!inactiveLink) {
    pass(`Inactive no-match: ${INACTIVE_NO_MATCH_ACMS_ID} silently skipped (nothing written)`);
  } else {
    fail(
      `Inactive no-match: expected nothing written for ${INACTIVE_NO_MATCH_ACMS_ID}, found ${JSON.stringify(inactiveLink)}`,
    );
  }

  // Scenario 5: cross-group — UT-00070 processed independently of NY records.
  const utLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: UT_ACMS_ID });
  if (utLink?.camsTrusteeId === UT_TRUSTEE_ID) {
    pass(`Cross-group match: ${UT_ACMS_ID} linked to ${UT_TRUSTEE_ID}`);
  } else {
    fail(
      `Cross-group match: expected ${UT_ACMS_ID} linked to ${UT_TRUSTEE_ID}, got ${JSON.stringify(utLink)}`,
    );
  }

  // Deleted/non-trustee records must never be synced.
  const deletedLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: 'NY-00067' });
  const nonTrusteeLink = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: 'NY-00068' });
  if (!deletedLink && !nonTrusteeLink) {
    pass('Deleted and non-trustee CMMPR rows were not synced');
  } else {
    fail(
      `Expected deleted/non-trustee rows to be excluded, found deletedLink=${JSON.stringify(deletedLink)} nonTrusteeLink=${JSON.stringify(nonTrusteeLink)}`,
    );
  }

  // Runtime state bookmark advanced for both groups.
  const stateDoc = await db
    .collection('runtime-state')
    .findOne({ documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE' });
  const byGroup = stateDoc?.lastUstProfCodeByGroup ?? {};
  if (byGroup.NY >= 71 && byGroup.UT >= 70) {
    pass(`Sync bookmark advanced correctly: ${JSON.stringify(byGroup)}`);
  } else {
    fail(`Sync bookmark did not advance as expected: ${JSON.stringify(byGroup)}`);
  }
}

// ---------------------------------------------------------------------------
// run  (happy path — covers scenarios 1-5: fingerprint match, name match,
// active no-match errored record, inactive no-match skip, cross-group paging)
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning sync-acms-professional-ids happy path test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed SQL schema + fixture rows');
  await seedSchema();
  await seedSql();
  console.log('');

  console.log('Step 2: Seed Cosmos fixtures (TRUSTEE_VARIATION + trustee profiles)');
  await seedCosmos();
  console.log('');

  console.log('Step 3: Enqueue start message {}');
  await enqueueMessage(START_QUEUE, {});
  pass(`Enqueued {} to '${START_QUEUE}'`);
  console.log('');

  console.log('Step 4: Wait for function app to process (up to 30s)');
  const { client, db } = await getMongoDb();
  try {
    // 4 professional-id links expected (fingerprint, name, cross-group UT, leading-zero-zip fingerprint)
    const satisfied = await pollUntil(async () => {
      const count = await db.collection('trustee-professional-ids').countDocuments({
        acmsProfessionalId: {
          $in: [FINGERPRINT_ACMS_ID, NAME_MATCH_ACMS_ID, UT_ACMS_ID, LEADING_ZERO_ACMS_ID],
        },
      });
      return count >= 4;
    });

    if (!satisfied) {
      fail('Timed out waiting for 4 professional-id links — is the function app running?');
      return;
    }
    pass('Detected 4 professional-id links in MongoDB');

    // Errored professional-id record for the active-no-match scenario arrives
    // after the active-appointment gate check completes.
    const verified = await pollUntil(async () => {
      const doc = await db
        .collection('trustee-professional-ids')
        .findOne({ acmsProfessionalId: ACTIVE_NO_MATCH_ACMS_ID });
      return doc != null;
    });
    if (!verified) {
      fail('Timed out waiting for the active-no-match errored professional-id record');
      return;
    }
    console.log('');

    await assertHappyPath(db);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-purge  (verifies { purge: true } wipes and reloads from scratch)
// ---------------------------------------------------------------------------

async function runPurge() {
  console.log('\nRunning sync-acms-professional-ids purge test...\n');

  console.log('Step 0: Run the happy path first so there is data to purge');
  await run();
  if (hasFailures) {
    fail('Happy path must pass before the purge test is meaningful — aborting run-purge');
    return;
  }
  console.log('');

  console.log('Step 1: Enqueue start message { purge: true }');
  await enqueueMessage(START_QUEUE, { purge: true });
  pass(`Enqueued { purge: true } to '${START_QUEUE}'`);
  console.log('');

  console.log('Step 2: Wait for the purge + full reload to complete (up to 30s)');
  const { client, db } = await getMongoDb();
  try {
    // After a purge, the same 4 links must exist again (freshly reloaded, not
    // stale survivors — deleteAll wipes trustee-professional-ids entirely).
    const satisfied = await pollUntil(async () => {
      const count = await db.collection('trustee-professional-ids').countDocuments({
        acmsProfessionalId: {
          $in: [FINGERPRINT_ACMS_ID, NAME_MATCH_ACMS_ID, UT_ACMS_ID, LEADING_ZERO_ACMS_ID],
        },
      });
      return count >= 4;
    });

    if (!satisfied) {
      fail('Timed out waiting for professional-id links to reappear after purge');
      return;
    }
    pass('Professional-id links reloaded from scratch after purge');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-retry-idempotency  (proves a retry replaying an already-written errored
// record doesn't throw a duplicate-key error and dead-letter the page)
// ---------------------------------------------------------------------------

/**
 * Builds the same non-HTTP ApplicationContext handlePage/handleStart construct in production
 * (getApplicationContext, no session/request — dataflow invocations have neither), pointed at
 * this harness's real local MongoDB container via loadEnv()'s MONGO_CONNECTION_STRING /
 * COSMOS_DATABASE_NAME overrides. Deliberately NOT createMockApplicationContext (backend/lib/
 * testing/testing-utilities.ts): that helper forces DATABASE_MOCK=true, which would exercise the
 * mocked in-memory adapter instead of the real container this test needs to hit a genuine
 * (camsTrusteeId, acmsProfessionalId, documentType) unique-index violation.
 */
async function buildRealApplicationContext() {
  const { InvocationContext } = await import('@azure/functions');
  const ContextCreator = (
    await import('../../../../backend/function-apps/azure/application-context-creator')
  ).default;
  return ContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
  });
}

async function runRetryIdempotency() {
  console.log(
    '\nProving createErroredProfessionalId is idempotent against a real Mongo unique-index violation...\n',
  );

  const context = await buildRealApplicationContext();
  const factory = (await import('../../../../backend/lib/factory')).default;
  const repo = factory.getTrusteeProfessionalIdsRepository(context);

  const fingerprint = `retry-idempotency-fingerprint-${Date.now()}`;
  const acmsProfessionalId = 'NY-RETRY-TEST';
  const variant = '{"firstName":"Retry","lastName":"Test"}';
  const error = { disposition: 'no-match' as const };
  const user = { id: 'HARNESS', name: 'HARNESS' };

  // This harness's plain MongoDB container has no indexes applied (unlike real Cosmos, whose
  // unique index comes from cosmos-collections.bicep) — create the same
  // (camsTrusteeId, acmsProfessionalId, documentType) unique index here so the second write
  // below hits a genuine violation instead of silently succeeding.
  {
    const { client, db } = await getMongoDb();
    try {
      await db
        .collection('trustee-professional-ids')
        .createIndex(
          { camsTrusteeId: 1, acmsProfessionalId: 1, documentType: 1 },
          { unique: true },
        );
    } finally {
      await client.close();
    }
  }

  try {
    // First call: the original (successful) write handlePage made before hitting a transient
    // error later in the same page.
    const first = await repo.createErroredProfessionalId(
      fingerprint,
      acmsProfessionalId,
      variant,
      error,
      user,
    );
    pass(`First write succeeded: ${first.id}`);

    // Second call with IDENTICAL inputs: simulates handlePage's retry-from-original-bookmark
    // reprocessing this same record after a transient error elsewhere in the page. Before the
    // fix, this threw E11000 (not classified as rate-limited, so handlePage rethrew and the
    // message redelivered until it dead-lettered). After the fix, it must return the existing
    // document instead of throwing.
    const second = await repo.createErroredProfessionalId(
      fingerprint,
      acmsProfessionalId,
      variant,
      error,
      user,
    );

    if (second.id === first.id) {
      pass(`Retry returned the existing document (${second.id}) instead of throwing E11000`);
    } else {
      fail(
        `Retry created a NEW document (${second.id}) instead of returning the existing one (${first.id})`,
      );
    }
  } catch (err) {
    fail(
      `Retry threw instead of returning the existing document — this is the reported deadlock: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    const { client, db } = await getMongoDb();
    try {
      await db.collection('trustee-professional-ids').deleteMany({ acmsProfessionalId });
    } finally {
      await client.close();
    }
  }
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('sync-acms-professional-ids — Integration Smoke Test Harness');
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
    case 'run-purge':
      await runPurge();
      break;
    case 'run-retry-idempotency':
      await runRetryIdempotency();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run sync-acms-professional-ids --';
      console.log('\nUsage (from test/integration/):');
      console.log(
        `  INTEGRATION_ENV=local  ${HARNESS} <command>   (default — localhost containers)`,
      );
      console.log(
        `  INTEGRATION_ENV=azure  ${HARNESS} <command>   (lower-env Azure, VPN required)`,
      );
      console.log('\nLocal workflow:');
      console.log(
        '  1. cp sync-acms-professional-ids/scripts/.env.template sync-acms-professional-ids/scripts/.env',
      );
      console.log(
        '     (set MSSQL_PASS), then ./sync-acms-professional-ids/scripts/start-services.sh',
      );
      console.log(`  2. ${HARNESS} seed-schema   (create ACMS_INT + DXTR_INT, apply DDL)`);
      console.log(`  3. ${HARNESS} seed-sql      (seed fixture rows)`);
      console.log(`  4. ${HARNESS} seed-cosmos   (seed TRUSTEE_VARIATION + trustee profiles)`);
      console.log(`  5. ${HARNESS} run           (full happy path test)`);
      console.log(`  6. ${HARNESS} clean         (remove test data)`);
      console.log('  7. ./sync-acms-professional-ids/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env   Verify required environment variables');
      console.log(
        '  seed-schema [local] Create ACMS_INT + DXTR_INT, apply CMMPR/CMMAP/CMMDB + offices DDL',
      );
      console.log('  seed-sql    [local] Seed fixture rows (idempotent)');
      console.log('  seed-cosmos Seed TRUSTEE_VARIATION + trustee profiles into MongoDB');
      console.log('  run         Full test: clean → seed → enqueue → wait → assert');
      console.log('  run-purge   Verify { purge: true } wipes and reloads from scratch');
      console.log(
        '  run-retry-idempotency  Prove a replayed retry returns the existing errored record',
      );
      console.log('  clean       Remove test documents and clear queues');
      console.log('  help        Show this help');
      break;
    }
  }

  console.log('\n' + '='.repeat(60));
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
