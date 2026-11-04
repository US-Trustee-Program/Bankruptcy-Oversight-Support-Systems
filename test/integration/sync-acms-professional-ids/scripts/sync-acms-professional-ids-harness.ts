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
 *   run-without-manual-link  Prove NY-00075 would be ambiguous (and get a task) without its
 *                manual link
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
const AMBIGUOUS_TRUSTEE_ID_A = 'INTEGRATION-TRUSTEE-AMBIGUOUS-A';
const AMBIGUOUS_TRUSTEE_ID_B = 'INTEGRATION-TRUSTEE-AMBIGUOUS-B';
const CONFLICT_EXISTING_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-CONFLICT-EXISTING';

const FINGERPRINT_ACMS_ID = 'NY-00063';
const NAME_MATCH_ACMS_ID = 'NY-00064';
const ACTIVE_NO_MATCH_ACMS_ID = 'NY-00065';
const INACTIVE_NO_MATCH_ACMS_ID = 'NY-00066';
const UT_ACMS_ID = 'UT-00070';
const LEADING_ZERO_ACMS_ID = 'NY-00071';
const AMBIGUOUS_ACMS_ID = 'NY-00072';
const SKIPPED_ACMS_ID = 'NY-00073';
const CONFLICT_ACMS_ID = 'NY-00074';
const MANUAL_LINK_ACMS_ID = 'NY-00075';
const AMBIGUOUS_INACTIVE_ACMS_ID = 'NY-00076';
// The highest NY UST_PROF_CODE seeded; the NY bookmark reaching it means the NY page is done.
const LAST_NY_UST_PROF_CODE = 76;

const VERIFICATION_COLLECTION = 'trustee-match-verification';

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
  if (!IS_LOCAL) {
    console.error(
      'seed-sql is only for local container runs. It truncates 8 tables ' +
        '(CMMPR/CMMAP/CMMDB/AO_CS_DIV/AO_OFFICE/AO_COURT/AO_GRP_DES/AO_REGION) - never point it ' +
        'at a shared Azure database.',
    );
    process.exit(1);
  }
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
    // callers only query that value (see trustees.mongo.repository.ts). Every trustee carries
    // firstName/middleName/lastName as well as name: the pipeline's doesNameMatch compares the
    // structured name parts, so a name-only trustee never passes the name check.
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: FINGERPRINT_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: FINGERPRINT_TRUSTEE_ID,
          name: 'Iris F Fingerprint',
          firstName: 'Iris',
          middleName: 'F',
          lastName: 'Fingerprint',
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
    // "62701-0000" (zero-padded to 9 digits, split 5+4), not the bare digit run. PROF_FAX_NBR 0
    // reaches the variant as a string (see the README).
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
      fax: '0',
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
    // no fingerprint variant on file, so the matching pipeline resolves it. Its contact data
    // matches the CMMPR row: a sole exact-name candidate with no contact data stays unresolved.
    // Name must match CMMPR's PROF_FIRST_NAME/PROF_MI/PROF_LAST_NAME for
    // UST_PROF_CODE 64 in seed/01-seed-cmmpr.sql exactly ("Norman N Namematch").
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: NAME_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: NAME_TRUSTEE_ID,
          name: 'Norman N Namematch',
          firstName: 'Norman',
          middleName: 'N',
          lastName: 'Namematch',
          status: 'active',
          public: {
            address: {
              address1: '600 Unique Ave',
              city: 'Albany',
              state: 'NY',
              zipCode: '12207',
              countryCode: 'US',
            },
            phone: { number: '518-555-0200' },
          },
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
          firstName: 'Ulysses',
          middleName: 'U',
          lastName: 'Utahmatch',
          status: 'active',
          public: {
            address: {
              address1: '900 Beehive Blvd',
              city: 'Salt Lake City',
              state: 'UT',
              zipCode: '84111',
              countryCode: 'US',
            },
            phone: { number: '801-555-0500' },
          },
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
          firstName: 'Lena',
          middleName: 'L',
          lastName: 'Leadingzero',
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
      fax: '0',
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

    // Two CAMS trustees sharing the EXACT same name, for the ambiguous scenario
    // (UST_PROF_CODE 72) — CMMPR's fixture row has no address/phone at all, so neither
    // trustee's contact data can corroborate a winner and the pipeline must end ambiguous.
    for (const trusteeId of [AMBIGUOUS_TRUSTEE_ID_A, AMBIGUOUS_TRUSTEE_ID_B]) {
      await db.collection('trustees').updateOne(
        { documentType: 'TRUSTEE', trusteeId },
        {
          $set: {
            documentType: 'TRUSTEE',
            trusteeId,
            name: 'Chris M Ambiguous',
            firstName: 'Chris',
            middleName: 'M',
            lastName: 'Ambiguous',
            status: 'active',
            public: {},
            updatedOn: now,
          },
          $setOnInsert: { createdOn: now },
        },
        { upsert: true },
      );
    }
    pass(
      `Seeded two identically-named trustee profiles for the ambiguous scenario (${AMBIGUOUS_TRUSTEE_ID_A}, ${AMBIGUOUS_TRUSTEE_ID_B})`,
    );

    // A trustee already linked to CONFLICT_ACMS_ID before this run, so the pipeline's
    // resolved match for UST_PROF_CODE 74 (which shares NAME_TRUSTEE_ID's demographics)
    // collides with this existing, different link.
    await db.collection('trustees').updateOne(
      { documentType: 'TRUSTEE', trusteeId: CONFLICT_EXISTING_TRUSTEE_ID },
      {
        $set: {
          documentType: 'TRUSTEE',
          trusteeId: CONFLICT_EXISTING_TRUSTEE_ID,
          name: 'Priorly Linked Trustee',
          firstName: 'Priorly',
          middleName: '',
          lastName: 'Trustee',
          status: 'active',
          public: {},
          updatedOn: now,
        },
        $setOnInsert: { createdOn: now },
      },
      { upsert: true },
    );
    await db.collection('trustee-professional-ids').updateOne(
      {
        documentType: 'TRUSTEE_PROFESSIONAL_ID',
        camsTrusteeId: CONFLICT_EXISTING_TRUSTEE_ID,
        acmsProfessionalId: CONFLICT_ACMS_ID,
      },
      {
        $set: {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId: CONFLICT_EXISTING_TRUSTEE_ID,
          acmsProfessionalId: CONFLICT_ACMS_ID,
          disposition: 'linked',
          linkMethod: 'auto',
          nameMatchCount: 1,
          evidence: {
            sourceRaw: { fullName: 'Norman N Namematch' },
            sourceNormalized: {},
            memo: {},
            candidates: [],
            match: {
              trusteeId: CONFLICT_EXISTING_TRUSTEE_ID,
              score: {},
              resolvedBy: 'resolveByPhone',
            },
            skip: false,
            error: null,
          },
          updatedOn: now,
          updatedBy: { id: 'HARNESS', name: 'HARNESS' },
        },
        $setOnInsert: { createdOn: now, createdBy: { id: 'HARNESS', name: 'HARNESS' } },
      },
      { upsert: true },
    );
    pass(
      `Pre-linked ${CONFLICT_ACMS_ID} to ${CONFLICT_EXISTING_TRUSTEE_ID} for the conflict scenario`,
    );

    // A person already linked MANUAL_LINK_ACMS_ID (UST_PROF_CODE 75) to one of the two
    // same-named trustees. Without this link the record would end ambiguous and get an identity
    // task; the sync must leave a manual link alone.
    await db.collection('trustee-professional-ids').updateOne(
      {
        documentType: 'TRUSTEE_PROFESSIONAL_ID',
        camsTrusteeId: AMBIGUOUS_TRUSTEE_ID_B,
        acmsProfessionalId: MANUAL_LINK_ACMS_ID,
      },
      {
        $set: {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId: AMBIGUOUS_TRUSTEE_ID_B,
          acmsProfessionalId: MANUAL_LINK_ACMS_ID,
          disposition: 'linked',
          linkMethod: 'manual',
          nameMatchCount: 2,
          evidence: {
            sourceRaw: { fullName: 'Chris M Ambiguous' },
            sourceNormalized: {},
            memo: {},
            candidates: [],
            match: null,
            skip: false,
            error: null,
          },
          updatedOn: now,
          updatedBy: { id: 'HARNESS', name: 'HARNESS' },
        },
        $setOnInsert: { createdOn: now, createdBy: { id: 'HARNESS', name: 'HARNESS' } },
      },
      { upsert: true },
    );
    pass(
      `Manually linked ${MANUAL_LINK_ACMS_ID} to ${AMBIGUOUS_TRUSTEE_ID_B} for the manual-link scenario`,
    );
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
          AMBIGUOUS_ACMS_ID,
          SKIPPED_ACMS_ID,
          CONFLICT_ACMS_ID,
          MANUAL_LINK_ACMS_ID,
          AMBIGUOUS_INACTIVE_ACMS_ID,
        ],
      },
    });
    pass(`Deleted ${r1.deletedCount} trustee-professional-ids doc(s)`);

    // ACMS identity tasks are keyed by fingerprint+variant; a pending task left over from a
    // previous run would be found and left untouched, so the run would not prove a fresh write.
    const r2 = await db.collection(VERIFICATION_COLLECTION).deleteMany({
      acmsProfessionalId: {
        $in: [
          AMBIGUOUS_ACMS_ID,
          ACTIVE_NO_MATCH_ACMS_ID,
          CONFLICT_ACMS_ID,
          MANUAL_LINK_ACMS_ID,
          AMBIGUOUS_INACTIVE_ACMS_ID,
        ],
      },
    });
    pass(`Deleted ${r2.deletedCount} ${VERIFICATION_COLLECTION} doc(s)`);

    const r3 = await db
      .collection('trustee-variation')
      .deleteMany({ trusteeId: { $in: [FINGERPRINT_TRUSTEE_ID, LEADING_ZERO_TRUSTEE_ID] } });
    pass(`Deleted ${r3.deletedCount} trustee-variation doc(s)`);

    const r4 = await db.collection('trustees').deleteMany({
      trusteeId: {
        $in: [
          FINGERPRINT_TRUSTEE_ID,
          NAME_TRUSTEE_ID,
          UT_TRUSTEE_ID,
          LEADING_ZERO_TRUSTEE_ID,
          AMBIGUOUS_TRUSTEE_ID_A,
          AMBIGUOUS_TRUSTEE_ID_B,
          CONFLICT_EXISTING_TRUSTEE_ID,
        ],
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
  if (activeErrored?.disposition === 'no-match') {
    pass(`Active no-match: no-match professional-id record written for ${ACTIVE_NO_MATCH_ACMS_ID}`);
    if (
      typeof activeErrored.evidence?.variant === 'string' &&
      activeErrored.evidence.variant.length > 0
    ) {
      pass('Active no-match: variant populated on the record');
    } else {
      fail('Active no-match: variant missing/empty on the record');
    }
    if (activeErrored.camsTrusteeId && activeErrored.camsTrusteeId !== FINGERPRINT_TRUSTEE_ID) {
      pass('Active no-match: camsTrusteeId set to a fingerprint placeholder, not a real trustee');
    } else {
      fail(`Active no-match: unexpected camsTrusteeId ${activeErrored.camsTrusteeId}`);
    }
    if (activeErrored.evidence?.sourceRaw && activeErrored.evidence?.candidates) {
      pass('Active no-match: full pipeline evidence (sourceRaw/candidates) persisted');
    } else {
      fail('Active no-match: expected sourceRaw/candidates pipeline evidence on the record');
    }
  } else {
    fail(
      `Active no-match: expected a disposition=no-match record for ${ACTIVE_NO_MATCH_ACMS_ID}, got ${JSON.stringify(activeErrored)}`,
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

  // Scenario 6: ambiguous — two identically-named CAMS trustees, neither corroborated by
  // this ACMS record's (blank) contact fields. The pipeline must resolve neither, writing a
  // disposition=ambiguous record with both candidates present in the evidence graph.
  const ambiguousRecord = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: AMBIGUOUS_ACMS_ID });
  if (ambiguousRecord?.disposition === 'ambiguous') {
    pass(`Ambiguous: ${AMBIGUOUS_ACMS_ID} written with disposition=ambiguous`);
    const candidateTrusteeIds = (ambiguousRecord.evidence?.candidates ?? []).map(
      (c: { camsRaw?: { trusteeId?: string } }) => c.camsRaw?.trusteeId,
    );
    if (
      candidateTrusteeIds.includes(AMBIGUOUS_TRUSTEE_ID_A) &&
      candidateTrusteeIds.includes(AMBIGUOUS_TRUSTEE_ID_B)
    ) {
      pass('Ambiguous: both same-named candidates present in the persisted evidence graph');
    } else {
      fail(
        `Ambiguous: expected both ${AMBIGUOUS_TRUSTEE_ID_A} and ${AMBIGUOUS_TRUSTEE_ID_B} among candidates, got ${JSON.stringify(candidateTrusteeIds)}`,
      );
    }
  } else {
    fail(
      `Ambiguous: expected a disposition=ambiguous record for ${AMBIGUOUS_ACMS_ID}, got ${JSON.stringify(ambiguousRecord)}`,
    );
  }

  // Scenario 7: administrative placeholder — a record naming no real person ("NOT
  // ASSIGNED") must be skipped before any matching is attempted, with disposition=skipped
  // persisted (not silently dropped like the zero-active-appointments no-match case).
  const skippedRecord = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: SKIPPED_ACMS_ID });
  if (skippedRecord?.disposition === 'skipped') {
    pass(`Skipped: ${SKIPPED_ACMS_ID} written with disposition=skipped`);
  } else {
    fail(
      `Skipped: expected a disposition=skipped record for ${SKIPPED_ACMS_ID}, got ${JSON.stringify(skippedRecord)}`,
    );
  }

  // Scenario 8: conflict — this ACMS id was already linked to a different trustee before
  // this run; the pipeline's resolved match (to NAME_TRUSTEE_ID, via identical demographics
  // to UST_PROF_CODE 64) collides with that existing link.
  const conflictRecord = await db
    .collection('trustee-professional-ids')
    .findOne({ acmsProfessionalId: CONFLICT_ACMS_ID, disposition: 'conflict' });
  if (conflictRecord?.evidence?.conflictingTrusteeId === CONFLICT_EXISTING_TRUSTEE_ID) {
    pass(
      `Conflict: ${CONFLICT_ACMS_ID} written with disposition=conflict, conflictingTrusteeId=${CONFLICT_EXISTING_TRUSTEE_ID}`,
    );
  } else {
    fail(
      `Conflict: expected a disposition=conflict record for ${CONFLICT_ACMS_ID} with conflictingTrusteeId=${CONFLICT_EXISTING_TRUSTEE_ID}, got ${JSON.stringify(conflictRecord)}`,
    );
  }

  // Scenario 9: the ambiguous professional (UST_PROF_CODE 72, active appointment) gets a pending,
  // caseless ACMS identity task carrying its acmsProfessionalId and the pipeline findings.
  const ambiguousTasks = await db
    .collection(VERIFICATION_COLLECTION)
    .find({ acmsProfessionalId: AMBIGUOUS_ACMS_ID })
    .toArray();
  const ambiguousTask = ambiguousTasks[0];
  if (ambiguousTasks.length !== 1) {
    fail(
      `Ambiguous task: expected exactly one identity task for ${AMBIGUOUS_ACMS_ID}, found ${ambiguousTasks.length}`,
    );
  } else if (
    ambiguousTask.documentType === 'TRUSTEE_MATCH_VERIFICATION' &&
    ambiguousTask.source === 'ACMS' &&
    ambiguousTask.mismatchReason === 'ambiguous' &&
    ambiguousTask.status === 'pending' &&
    // Mongo client uses ignoreUndefined, so the sync's absent caseId/courtId read back undefined.
    ambiguousTask.caseId === undefined &&
    ambiguousTask.courtId === undefined &&
    ambiguousTask.findings != null
  ) {
    pass(
      `Ambiguous task: pending ACMS identity task for ${AMBIGUOUS_ACMS_ID} (mismatchReason=ambiguous, no caseId/courtId, findings present)`,
    );
    const taskCandidateIds = (ambiguousTask.findings.candidates ?? []).map(
      (c: { camsRaw?: { trusteeId?: string } }) => c.camsRaw?.trusteeId,
    );
    if (
      taskCandidateIds.includes(AMBIGUOUS_TRUSTEE_ID_A) &&
      taskCandidateIds.includes(AMBIGUOUS_TRUSTEE_ID_B)
    ) {
      pass('Ambiguous task: findings list both same-named candidates');
    } else {
      fail(
        `Ambiguous task: expected both ${AMBIGUOUS_TRUSTEE_ID_A} and ${AMBIGUOUS_TRUSTEE_ID_B} among findings candidates, got ${JSON.stringify(taskCandidateIds)}`,
      );
    }
    if (typeof ambiguousTask.fingerprint !== 'string' || ambiguousTask.fingerprint === '') {
      fail(
        `Ambiguous task: expected a non-empty string fingerprint, got ${JSON.stringify(ambiguousTask.fingerprint)}`,
      );
    } else if (ambiguousTask.fingerprint === ambiguousRecord?.camsTrusteeId) {
      pass("Ambiguous task: fingerprint matches the ambiguous professional-id record's key");
    } else {
      fail(
        `Ambiguous task: fingerprint ${ambiguousTask.fingerprint} does not match the professional-id record's camsTrusteeId ${ambiguousRecord?.camsTrusteeId}`,
      );
    }
    // The task is keyed by fingerprint + variant, so the variant must be the one the sync
    // recorded for this professional, or later lookups would miss the task.
    if (
      ambiguousTask.variant != null &&
      ambiguousTask.variant === ambiguousRecord?.evidence?.variant
    ) {
      pass("Ambiguous task: variant matches the ambiguous professional-id record's variant");
    } else {
      fail(
        `Ambiguous task: variant ${ambiguousTask.variant} does not match the professional-id record's evidence.variant ${ambiguousRecord?.evidence?.variant}`,
      );
    }
  } else {
    fail(
      `Ambiguous task: unexpected identity task for ${AMBIGUOUS_ACMS_ID}: ${JSON.stringify(ambiguousTask)}`,
    );
  }

  // Scenario 10: no-match and conflict professionals never get an identity task — only
  // ambiguous ACMS outcomes do. Both have an active CMMAP appointment, so neither is kept from a
  // task by the active-appointment gate.
  const otherTasks = await db
    .collection(VERIFICATION_COLLECTION)
    .find({ acmsProfessionalId: { $in: [ACTIVE_NO_MATCH_ACMS_ID, CONFLICT_ACMS_ID] } })
    .toArray();
  if (otherTasks.length === 0) {
    pass(
      `No identity task for the no-match (${ACTIVE_NO_MATCH_ACMS_ID}) or conflict (${CONFLICT_ACMS_ID}) professional`,
    );
  } else {
    fail(
      `Expected no identity tasks for ${ACTIVE_NO_MATCH_ACMS_ID}/${CONFLICT_ACMS_ID}, found ${JSON.stringify(otherTasks)}`,
    );
  }

  // Scenario 11: a professional with a manual link keeps exactly that link — no new
  // professional-id record and no identity task, even though it would otherwise be ambiguous.
  const manualRecords = await db
    .collection('trustee-professional-ids')
    .find({ acmsProfessionalId: MANUAL_LINK_ACMS_ID })
    .toArray();
  const manualRecord = manualRecords[0];
  if (
    manualRecords.length === 1 &&
    manualRecord.camsTrusteeId === AMBIGUOUS_TRUSTEE_ID_B &&
    manualRecord.disposition === 'linked' &&
    manualRecord.linkMethod === 'manual' &&
    manualRecord.updatedBy?.id === 'HARNESS'
  ) {
    pass(`Manual link: ${MANUAL_LINK_ACMS_ID} kept its manual link to ${AMBIGUOUS_TRUSTEE_ID_B}`);
  } else {
    fail(
      `Manual link: expected only the seeded manual link for ${MANUAL_LINK_ACMS_ID}, found ${JSON.stringify(manualRecords)}`,
    );
  }
  const manualTask = await db
    .collection(VERIFICATION_COLLECTION)
    .findOne({ acmsProfessionalId: MANUAL_LINK_ACMS_ID });
  if (!manualTask) {
    pass(`Manual link: no identity task written for ${MANUAL_LINK_ACMS_ID}`);
  } else {
    fail(
      `Manual link: expected no identity task for ${MANUAL_LINK_ACMS_ID}, found ${JSON.stringify(manualTask)}`,
    );
  }

  // Scenario 12: an ambiguous professional with no active appointment (UST_PROF_CODE 76) gets
  // neither a professional-id record nor an identity task.
  const [inactiveAmbiguousRecord, inactiveAmbiguousTask] = await Promise.all([
    db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: AMBIGUOUS_INACTIVE_ACMS_ID }),
    db
      .collection(VERIFICATION_COLLECTION)
      .findOne({ acmsProfessionalId: AMBIGUOUS_INACTIVE_ACMS_ID }),
  ]);
  if (!inactiveAmbiguousRecord && !inactiveAmbiguousTask) {
    pass(`Ambiguous, no active appointment: nothing written for ${AMBIGUOUS_INACTIVE_ACMS_ID}`);
  } else {
    fail(
      `Ambiguous, no active appointment: expected nothing for ${AMBIGUOUS_INACTIVE_ACMS_ID}, found record=${JSON.stringify(inactiveAmbiguousRecord)} task=${JSON.stringify(inactiveAmbiguousTask)}`,
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
  if (byGroup.NY >= LAST_NY_UST_PROF_CODE && byGroup.UT >= 70) {
    pass(`Sync bookmark advanced correctly: ${JSON.stringify(byGroup)}`);
  } else {
    fail(`Sync bookmark did not advance as expected: ${JSON.stringify(byGroup)}`);
  }
}

// ---------------------------------------------------------------------------
// sync helpers
// ---------------------------------------------------------------------------

/**
 * This harness's plain MongoDB container has no indexes applied. Create the
 * (fingerprint, variant, documentType) unique index real Cosmos enforces on identity tasks
 * (cosmos-collections.bicep), so a duplicate task write fails here as it would in Azure.
 */
async function createVerificationUniqueIndex() {
  const { client, db } = await getMongoDb();
  try {
    await db
      .collection(VERIFICATION_COLLECTION)
      .createIndex({ fingerprint: 1, variant: 1, documentType: 1 }, { unique: true });
    pass(
      `Ensured the (fingerprint, variant, documentType) unique index on ${VERIFICATION_COLLECTION}`,
    );
  } finally {
    await client.close();
  }
}

/** Waits for the NY bookmark to pass the last NY fixture; false (after a fail()) on timeout. */
async function waitForNyPage(db: ReturnType<MongoClient['db']>): Promise<boolean> {
  const nyPageProcessed = await pollUntil(async () => {
    const stateDoc = await db
      .collection('runtime-state')
      .findOne({ documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE' });
    return (stateDoc?.lastUstProfCodeByGroup?.NY ?? 0) >= LAST_NY_UST_PROF_CODE;
  });
  if (!nyPageProcessed) {
    fail(`Timed out waiting for the NY bookmark to reach UST_PROF_CODE ${LAST_NY_UST_PROF_CODE}`);
  }
  return nyPageProcessed;
}

/** Deletes the sync bookmark (so every group restarts at 0) and runs the sync again. */
async function resyncFromStart(db: ReturnType<MongoClient['db']>): Promise<boolean> {
  await db
    .collection('runtime-state')
    .deleteMany({ documentType: 'ACMS_PROFESSIONAL_ID_SYNC_STATE' });
  await enqueueMessage(START_QUEUE, {});
  return waitForNyPage(db);
}

/**
 * Re-processing the ambiguous professional must leave its identity task exactly as it was:
 * first while the task is pending, then after it is resolved. Proves the create-if-absent rule
 * against real persistence, with the unique index in place.
 */
async function assertResyncLeavesIdentityTasksUntouched(db: ReturnType<MongoClient['db']>) {
  const tasksFor = () =>
    db
      .collection(VERIFICATION_COLLECTION)
      .find({ acmsProfessionalId: AMBIGUOUS_ACMS_ID })
      .toArray();
  const [original] = await tasksFor();
  if (!original) {
    fail(`Re-sync: no identity task for ${AMBIGUOUS_ACMS_ID} to re-sync against`);
    return;
  }
  const isUnchanged = (task: typeof original | undefined, status: string) =>
    task !== undefined &&
    task._id.equals(original._id) &&
    task.status === status &&
    JSON.stringify(task.updatedOn) === JSON.stringify(original.updatedOn);

  if (!(await resyncFromStart(db))) {
    return;
  }
  const afterPendingResync = await tasksFor();
  if (afterPendingResync.length === 1 && isUnchanged(afterPendingResync[0], 'pending')) {
    pass(`Re-sync: the pending task for ${AMBIGUOUS_ACMS_ID} was left untouched`);
  } else {
    fail(
      `Re-sync: expected the original pending task for ${AMBIGUOUS_ACMS_ID} unchanged, found ${JSON.stringify(afterPendingResync)}`,
    );
  }

  await db
    .collection(VERIFICATION_COLLECTION)
    .updateOne({ _id: original._id }, { $set: { status: 'approved' } });
  if (!(await resyncFromStart(db))) {
    return;
  }
  const afterResolvedResync = await tasksFor();
  if (afterResolvedResync.length === 1 && isUnchanged(afterResolvedResync[0], 'approved')) {
    pass(`Re-sync: the resolved task for ${AMBIGUOUS_ACMS_ID} was left untouched, no new task`);
  } else {
    fail(
      `Re-sync: expected only the resolved task for ${AMBIGUOUS_ACMS_ID}, found ${JSON.stringify(afterResolvedResync)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// run  (happy path — seeds the scenarios above, runs the sync once, asserts each outcome, then
// re-syncs to prove existing pending and resolved identity tasks are left untouched)
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
  await createVerificationUniqueIndex();
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

    // The ambiguous and skipped records are written only after the active-appointment check; the
    // conflict record is written before it (a conflict bypasses the gate). Wait for all three
    // before asserting, same as the active-no-match record above.
    const newScenariosVerified = await pollUntil(async () => {
      const [ambiguousDoc, skippedDoc, conflictDoc] = await Promise.all([
        db
          .collection('trustee-professional-ids')
          .findOne({ acmsProfessionalId: AMBIGUOUS_ACMS_ID }),
        db.collection('trustee-professional-ids').findOne({ acmsProfessionalId: SKIPPED_ACMS_ID }),
        db
          .collection('trustee-professional-ids')
          .findOne({ acmsProfessionalId: CONFLICT_ACMS_ID, disposition: 'conflict' }),
      ]);
      return ambiguousDoc != null && skippedDoc != null && conflictDoc != null;
    });
    if (!newScenariosVerified) {
      fail('Timed out waiting for the ambiguous/skipped/conflict professional-id records');
      return;
    }

    // The manual-link and inactive-ambiguous scenarios write nothing, so wait for the NY page's
    // bookmark to pass them - the bookmark is stored only after every record in the page is processed.
    if (!(await waitForNyPage(db))) {
      return;
    }
    console.log('');

    await assertHappyPath(db);
    if (hasFailures) {
      return;
    }
    console.log('');

    console.log('Step 5: Re-sync from the start; existing identity tasks must be left untouched');
    await assertResyncLeavesIdentityTasksUntouched(db);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-without-manual-link  (proves the manual-link scenario's premise: without its manual link,
// NY-00075 really would end ambiguous and get an identity task)
// ---------------------------------------------------------------------------

async function runWithoutManualLink() {
  console.log('\nRunning sync-acms-professional-ids without the NY-00075 manual link...\n');

  await clean();
  await seedSchema();
  await seedSql();
  await seedCosmos();
  await createVerificationUniqueIndex();

  const { client, db } = await getMongoDb();
  try {
    await db
      .collection('trustee-professional-ids')
      .deleteMany({ acmsProfessionalId: MANUAL_LINK_ACMS_ID });
    pass(`Removed the seeded manual link for ${MANUAL_LINK_ACMS_ID}`);

    await enqueueMessage(START_QUEUE, {});
    pass(`Enqueued {} to '${START_QUEUE}'`);
    if (!(await waitForNyPage(db))) {
      return;
    }

    const record = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: MANUAL_LINK_ACMS_ID });
    const tasks = await db
      .collection(VERIFICATION_COLLECTION)
      .find({ acmsProfessionalId: MANUAL_LINK_ACMS_ID })
      .toArray();
    if (
      record?.disposition === 'ambiguous' &&
      tasks.length === 1 &&
      tasks[0].status === 'pending' &&
      tasks[0].source === 'ACMS' &&
      tasks[0].mismatchReason === 'ambiguous'
    ) {
      pass(
        `Without its manual link, ${MANUAL_LINK_ACMS_ID} is ambiguous and gets a pending ACMS identity task`,
      );
    } else {
      fail(
        `Without its manual link, expected ${MANUAL_LINK_ACMS_ID} ambiguous with one pending ACMS task, found record=${JSON.stringify(record)} tasks=${JSON.stringify(tasks)}`,
      );
    }
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-purge  (verifies { purge: true } wipes and reloads from scratch)
// ---------------------------------------------------------------------------

async function runPurge() {
  if (!IS_LOCAL) {
    console.error(
      'run-purge is only for local container runs. It triggers deleteAll() on the real ' +
        'trustee-professional-ids collection - never point it at a shared Azure environment.',
    );
    process.exit(1);
  }
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
    // stale survivors — deleteAll wipes trustee-professional-ids entirely). Deliberately not
    // re-asserting the ambiguous/skipped/conflict scenarios here: deleteAll also wipes the
    // conflict scenario's pre-linked seed record, so a post-purge pass would resolve that ACMS
    // id as a clean auto-link rather than reproduce the conflict - a purge, unlike a normal
    // sync, doesn't re-run seedCosmos to restore that pre-existing state. deleteAll also wipes
    // linkMethod 'manual' links (NY-00075's included), so purge is NOT manual-link safe: after a
    // purge NY-00075 has no guard and is processed as ambiguous. Accepted for CAMS-954 - purge is
    // an operator reset.
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
    '\nProving upsertProfessionalId is idempotent against a real Mongo unique-index violation...\n',
  );

  const context = await buildRealApplicationContext();
  const factory = (await import('../../../../backend/lib/factory')).default;
  const repo = factory.getTrusteeProfessionalIdsRepository(context);

  const fingerprint = `retry-idempotency-fingerprint-${Date.now()}`;
  const acmsProfessionalId = 'NY-RETRY-TEST';
  const variant = '{"firstName":"Retry","lastName":"Test"}';
  const user = { id: 'HARNESS', name: 'HARNESS' };
  const document = {
    documentType: 'TRUSTEE_PROFESSIONAL_ID' as const,
    camsTrusteeId: fingerprint,
    acmsProfessionalId,
    disposition: 'no-match' as const,
    nameMatchCount: 0,
    evidence: {
      variant,
      sourceRaw: { fullName: 'Retry Test' },
      sourceNormalized: {},
      memo: {},
      candidates: [],
      match: null,
      skip: false,
      error: null,
    },
  };

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
    const first = await repo.upsertProfessionalId(document, user);
    pass(`First write succeeded: ${first.id}`);

    // Second call with IDENTICAL inputs: simulates handlePage's retry-from-original-bookmark
    // reprocessing this same record after a transient error elsewhere in the page. Before the
    // fix, this threw E11000 (not classified as rate-limited, so handlePage rethrew and the
    // message redelivered until it dead-lettered). After the fix, it must return the existing
    // document instead of throwing.
    const second = await repo.upsertProfessionalId(document, user);

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
    case 'run-without-manual-link':
      await runWithoutManualLink();
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
      console.log(
        '  run-without-manual-link  Prove NY-00075 is ambiguous and gets a task without its manual link',
      );
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
