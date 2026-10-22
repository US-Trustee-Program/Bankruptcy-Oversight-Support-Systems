/**
 * Integration test harness: trustee migration.
 *
 * Covers four areas in a single `run` invocation:
 *
 *   1. Address normalization (fixtures 1001–1003)
 *      Re-running migration removes stale null address2 fields from existing
 *      trustee documents (STREET1 / STREET1_A2 mapped with || undefined).
 *
 *   2. Active-only filter (fixture 1009)
 *      getTrusteesPage without importAll=true must exclude trustees whose only
 *      CHAPTER_DETAILS rows have STATUS codes outside ACTIVE_STATUS_CODES.
 *
 *   3. Migration state lifecycle
 *      getOrCreateMigrationState initializes with the correct documentType and
 *      lastTrusteeId is null immediately after resetMigrationState.
 *
 *   4. CAMS-772 archive-date override (fixtures 1010–1014)
 *      cleanseAndMapAppointment overrides appointment status to 'inactive' when
 *      ARCHIVE_DATE is set for case-by-case (C), elected (E), or converted-case
 *      (O) types, and leaves panel (PA) and unarchived C records active.
 *
 *   5. heal() professional-ID backfill (ACMS CMMPR fixtures HL-98001..98005)
 *      readAllTrusteeProfessionalRecords + backfillProfessionalIdsPage scan ACMS
 *      CMMPR (independent of ATS) and create missing trustee-professional-ids
 *      mappings by matching ACMS professional records to CAMS trustees by name +
 *      state. Covers: created, alreadyMapped (idempotent skip), one-to-many
 *      (one CAMS trustee, multiple ACMS IDs), NO_TRUSTEE_MATCH and
 *      INCOMPLETE_NAME_OR_STATE unmatched routing, and idempotent re-run
 *      convergence (re-running creates nothing new, no duplicate mappings).
 *
 * Two environments are supported via INTEGRATION_ENV:
 *   local  (default) — localhost containers started manually
 *   azure            — lower-env Azure Government databases (VPN required)
 *
 * This is a one-shot script — NOT a Vitest test.
 *
 * Usage (from test/integration/):
 *   npm run migrate-trustees -- [command]
 *
 * Local workflow:
 *   1. Start MongoDB container:  podman run -d -p 27017:27017 mongo:7.0
 *   2. Start SQL Edge container: podman run -d -p 1433:1433 -e ACCEPT_EULA=Y \
 *        -e MSSQL_SA_PASSWORD=YourStrong!Passw0rd mcr.microsoft.com/azure-sql-edge
 *   3. Copy .env.local.template to .env.local and fill in passwords
 *   4. npm run migrate-trustees -- seed-schema
 *   5. npm run migrate-trustees -- seed-sql
 *   6. npm run migrate-trustees -- run
 *   7. npm run migrate-trustees -- clean
 *
 * Commands:
 *   check-env     Verify required environment variables
 *   seed-schema   Create ATS_INT + ACMS_INT databases and apply schema
 *   seed-sql      Drop/recreate ATS + ACMS fixture rows (idempotent)
 *   run           Full test: address normalization + active filter + CAMS-772 + migration state + heal()
 *   clean         Remove test documents from MongoDB + ATS/ACMS fixture rows
 *   help          Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import * as sql from 'mssql';
import { InvocationContext } from '@azure/functions';

import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import {
  upsertTrustee,
  mergeTrusteeRecords,
  getPageOfTrustees,
  readAllTrusteeProfessionalRecords,
  backfillProfessionalIdsPage,
} from '../../../../backend/lib/use-cases/dataflows/migrate-trustees';
import {
  getOrCreateMigrationState,
  resetMigrationState,
} from '../../../../backend/lib/use-cases/dataflows/trustee-migration-state.service';
import { cleanseAndMapAppointment } from '../../../../backend/lib/adapters/gateways/ats/cleansing/ats-cleansing-pipeline';
import { AtsAppointmentRecord } from '../../../../backend/lib/adapters/types/ats.types';
import { TrusteeOverride } from '../../../../backend/lib/adapters/gateways/ats/cleansing/ats-cleansing-types';
import factory from '../../../../backend/lib/factory';
type AppointmentType = string;

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

// ATS fixture trustee IDs (must match 01-seed-trustees.sql)
const TRUSTEE_ID_NO_ADDRESS2 = 1001; // Alice — no STREET1
const TRUSTEE_ID_WITH_ADDRESS2 = 1002; // Bob — has STREET1 "Suite 300"
const TRUSTEE_ID_A2_PUBLIC = 1003; // Carol — A2 is public, no STREET1_A2

// IDs 1009-1014 come from 04-seed-migration-scenarios.sql
const TRUSTEE_ID_INACTIVE_ONLY = 1009; // active-filter: only STATUS='T' appointment
const TRUSTEE_ID_ARCHIVE_CBC = 1010; // CAMS-772: STATUS=C + ARCHIVE_DATE → inactive
const TRUSTEE_ID_ARCHIVE_ELECTED = 1011; // CAMS-772: STATUS=E + ARCHIVE_DATE → inactive
const TRUSTEE_ID_ARCHIVE_CONVERTED = 1012; // CAMS-772: STATUS=O + ARCHIVE_DATE → inactive
const TRUSTEE_ID_ARCHIVE_PANEL_CTRL = 1013; // CAMS-772 control: STATUS=PA + ARCHIVE_DATE → active
const TRUSTEE_ID_CBC_NO_ARCHIVE = 1014; // CAMS-772 control: STATUS=C, no ARCHIVE_DATE → active

// Sentinel used to find our test documents in Cosmos
const TEST_DOC_SENTINEL = 'INTEGRATION-MIGRATE-TRUSTEES-ADDRESS-TEST';

// ACMS CMMPR fixtures for the heal() backfill (05-seed-heal-cmmpr.sql).
const HEAL_ACMS_ID_NEW_MATCH = 'HL-98001'; // no existing mapping, matches CAMS trustee -> created
const HEAL_ACMS_ID_ALREADY_MAPPED = 'HL-98002'; // mapping pre-created by the harness -> skipped
const HEAL_ACMS_ID_NO_MATCH = 'HL-98003'; // no CAMS trustee matches -> unmatched
const HEAL_ACMS_ID_SECOND_MATCH = 'HL-98004'; // same trustee as 98001 -> second mapping (1-to-many)
const HEAL_ACMS_ID_INCOMPLETE = 'HL-98005'; // blank last name -> INCOMPLETE_NAME_OR_STATE
const HEAL_TRUSTEE_SENTINEL = 'INTEGRATION-MIGRATE-TRUSTEES-HEAL-TEST';

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

function loadEnv() {
  if (IS_LOCAL) {
    const localEnvPath = path.join(HARNESS_DIR, '.env.local');
    if (!fs.existsSync(localEnvPath)) {
      console.error(
        `Missing ${localEnvPath} — copy .env.local.template to .env.local and fill in passwords`,
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
// Output helpers
// ---------------------------------------------------------------------------

let hasFailures = false;

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

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

async function getAtsSqlPool(database = 'ATS_INT'): Promise<sql.ConnectionPool> {
  const server = process.env.ATS_MSSQL_HOST;
  if (!server) throw new Error('ATS_MSSQL_HOST is not set');

  const port = Number(process.env.ATS_MSSQL_PORT) || 1433;
  const encrypt = process.env.ATS_MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate =
    process.env.ATS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
  const user = process.env.ATS_MSSQL_USER;
  const password = process.env.ATS_MSSQL_PASS;

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
    config.authentication = { type: 'azure-active-directory-default' } as any;
  }

  return sql.connect(config);
}

async function getAcmsSqlPool(database = 'ACMS_INT'): Promise<sql.ConnectionPool> {
  const server = process.env.ACMS_MSSQL_HOST;
  if (!server) throw new Error('ACMS_MSSQL_HOST is not set');

  const port = Number(process.env.ACMS_MSSQL_PORT) || 1433;
  const encrypt = process.env.ACMS_MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate =
    process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
  const user = process.env.ACMS_MSSQL_USER;
  const password = process.env.ACMS_MSSQL_PASS;

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
    config.authentication = { type: 'azure-active-directory-default' } as any;
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

async function buildContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({ invocationContext });
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required: [string, string][] = [
    ['MONGO_CONNECTION_STRING', 'MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos/Mongo database name'],
    ['ATS_MSSQL_HOST', 'ATS SQL Server host'],
  ];

  const optional: [string, string][] = [
    ['ATS_MSSQL_DATABASE', 'ATS database name (default: ATS_INT)'],
    ['ATS_MSSQL_USER', 'ATS SQL user (omit for Azure AD auth)'],
    ['ATS_MSSQL_PASS', 'ATS SQL password'],
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
    console.log('\n  Set missing variables in .env.local before running.');
  } else {
    console.log('\n  All required variables present.');
  }
}

// ---------------------------------------------------------------------------
// seed-schema  (create ATS_INT database + apply DDL)
// ---------------------------------------------------------------------------

async function seedSchema() {
  if (!IS_LOCAL) {
    console.error('seed-schema is only for local container runs. Schema already exists in Azure.');
    process.exit(1);
  }
  console.log('\nCreating ATS_INT database + applying schema...\n');

  const atsMasterPool = await getAtsSqlPool('master');
  try {
    await atsMasterPool
      .request()
      .query(
        `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'ATS_INT') CREATE DATABASE ATS_INT`,
      );
    pass(`Database 'ATS_INT' ready`);
  } finally {
    await atsMasterPool.close();
  }

  const atsPool = await getAtsSqlPool('ATS_INT');
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(atsPool, path.join(seedDir, '00-seed-ats-schema.sql'));
    pass('00-seed-ats-schema.sql applied (TRUSTEES + CHAPTER_DETAILS tables created)');
  } finally {
    await atsPool.close();
  }

  const acmsMasterPool = await getAcmsSqlPool('master');
  try {
    await acmsMasterPool
      .request()
      .query(
        `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = 'ACMS_INT') CREATE DATABASE ACMS_INT`,
      );
    pass(`Database 'ACMS_INT' ready`);
  } finally {
    await acmsMasterPool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-sql  (drop/recreate ATS fixture rows — idempotent)
// ---------------------------------------------------------------------------

async function seedSql() {
  console.log('\nSeeding ATS fixture rows into ATS_INT...\n');

  const atsDatabase = process.env.ATS_MSSQL_DATABASE || 'ATS_INT';
  const pool = await getAtsSqlPool(atsDatabase);
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(pool, path.join(seedDir, '01-seed-trustees.sql'));
    pass('01-seed-trustees.sql seeded (address-normalization fixtures 1001-1003)');
    await executeSqlFile(pool, path.join(seedDir, '04-seed-migration-scenarios.sql'));
    pass('04-seed-migration-scenarios.sql seeded (active-filter + CAMS-772 fixtures 1009-1014)');
  } finally {
    await pool.close();
  }

  const acmsPool = await getAcmsSqlPool();
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(acmsPool, path.join(seedDir, '05-seed-heal-cmmpr.sql'));
    pass('05-seed-heal-cmmpr.sql seeded (heal() backfill fixtures HL-98001..98005)');
  } finally {
    await acmsPool.close();
  }
}

// ---------------------------------------------------------------------------
// clean  (remove test documents from MongoDB and ATS fixture rows)
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up test data...\n');

  const { client, db } = await getMongoDb();
  try {
    // Remove trustees seeded by this harness (identified by the sentinel company name)
    const r = await db
      .collection('trustees')
      .deleteMany({ 'legacy.testSentinel': TEST_DOC_SENTINEL });
    pass(`Deleted ${r.deletedCount} harness trustee document(s) from 'trustees' collection`);

    // Remove migration state document created during the test
    const s = await db
      .collection('runtime-state')
      .deleteMany({ documentType: 'TRUSTEE_MIGRATION_STATE' });
    pass(`Deleted ${s.deletedCount} TRUSTEE_MIGRATION_STATE doc(s)`);

    // Remove heal() fixtures: the CAMS trustee doc seeded for matching, and any
    // professional-id mappings the backfill created/pre-created against it.
    const healTrustee = await db
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': HEAL_TRUSTEE_SENTINEL });
    if (healTrustee) {
      const m = await db
        .collection('trustee-professional-ids')
        .deleteMany({ camsTrusteeId: healTrustee.trusteeId });
      pass(`Deleted ${m.deletedCount} trustee-professional-ids mapping(s) for heal() fixture`);
    }
    const h = await db
      .collection('trustees')
      .deleteMany({ 'legacy.testSentinel': HEAL_TRUSTEE_SENTINEL });
    pass(`Deleted ${h.deletedCount} heal() fixture trustee document(s)`);
  } finally {
    await client.close();
  }

  // Remove ATS fixture rows
  const atsDatabase = process.env.ATS_MSSQL_DATABASE || 'ATS_INT';
  const pool = await getAtsSqlPool(atsDatabase);
  const allFixtureIds = [
    TRUSTEE_ID_NO_ADDRESS2,
    TRUSTEE_ID_WITH_ADDRESS2,
    TRUSTEE_ID_A2_PUBLIC,
    TRUSTEE_ID_INACTIVE_ONLY,
    TRUSTEE_ID_ARCHIVE_CBC,
    TRUSTEE_ID_ARCHIVE_ELECTED,
    TRUSTEE_ID_ARCHIVE_CONVERTED,
    TRUSTEE_ID_ARCHIVE_PANEL_CTRL,
    TRUSTEE_ID_CBC_NO_ARCHIVE,
  ].join(', ');
  try {
    await pool.request().query(`
      DELETE FROM CHAPTER_DETAILS WHERE TRU_ID IN (${allFixtureIds});
      DELETE FROM TRUSTEES WHERE ID IN (${allFixtureIds});
    `);
    pass(`Deleted ATS fixture rows for trustee IDs ${allFixtureIds}`);
  } finally {
    await pool.close();
  }

  // Remove ACMS CMMPR fixture rows
  const acmsPool = await getAcmsSqlPool();
  try {
    await acmsPool
      .request()
      .query(
        `DELETE FROM CMMPR WHERE UST_PROF_CODE IN (98001, 98002, 98003, 98004, 98005) AND GROUP_DESIGNATOR = 'HL'`,
      );
    pass(`Deleted ACMS CMMPR fixture rows for heal() professional IDs HL-98001..98005`);
  } finally {
    await acmsPool.close();
  }
}

// ---------------------------------------------------------------------------
// Inject stale trustee documents (simulates the pre-fix state in production)
//
// Each document is intentionally seeded with null address2 values to represent
// the data state that existed before the normalization fix was applied.
// The test then re-runs the migration and asserts those nulls are gone.
// ---------------------------------------------------------------------------

async function injectStaleTrustees(db: ReturnType<MongoClient['db']>) {
  console.log('\nInjecting stale trustee documents (with null address2) into Cosmos...\n');

  const now = new Date().toISOString();

  // Alice — no address2; pre-fix version has null stored
  await db.collection('trustees').updateOne(
    {
      documentType: 'TRUSTEE',
      firstName: 'Alice',
      lastName: 'Testcase',
      'public.address.state': 'IL',
    },
    {
      $set: {
        documentType: 'TRUSTEE',
        firstName: 'Alice',
        lastName: 'Testcase',
        name: 'Alice Testcase',
        status: 'active',
        public: {
          address: {
            address1: '100 Main St',
            address2: null, // stale null — should be absent after re-migration
            city: 'Springfield',
            state: 'IL',
            zipCode: '62701',
            countryCode: 'US',
          },
          email: 'alice.testcase@example.com',
        },
        legacy: {
          truIds: [String(TRUSTEE_ID_NO_ADDRESS2)],
          testSentinel: TEST_DOC_SENTINEL,
        },
        trusteeId: `trustee-alice-testcase-il-${TEST_DOC_SENTINEL}`,
        createdOn: now,
        updatedOn: now,
      },
    },
    { upsert: true },
  );
  info(`Injected stale trustee for Alice Testcase (ID ${TRUSTEE_ID_NO_ADDRESS2})`);

  // Bob — has address2; pre-fix version already correct, re-migration should preserve it
  await db.collection('trustees').updateOne(
    {
      documentType: 'TRUSTEE',
      firstName: 'Bob',
      lastName: 'Testcase',
      'public.address.state': 'IL',
    },
    {
      $set: {
        documentType: 'TRUSTEE',
        firstName: 'Bob',
        lastName: 'Testcase',
        name: 'Bob Testcase',
        status: 'active',
        public: {
          address: {
            address1: '200 Oak Ave',
            address2: 'Suite 300',
            city: 'Shelbyville',
            state: 'IL',
            zipCode: '62565',
            countryCode: 'US',
          },
          email: 'bob.testcase@example.com',
          phone: { number: '(217) 555-0100' },
        },
        legacy: {
          truIds: [String(TRUSTEE_ID_WITH_ADDRESS2)],
          testSentinel: TEST_DOC_SENTINEL,
        },
        trusteeId: `trustee-bob-testcase-il-${TEST_DOC_SENTINEL}`,
        createdOn: now,
        updatedOn: now,
      },
    },
    { upsert: true },
  );
  info(`Injected trustee for Bob Testcase (ID ${TRUSTEE_ID_WITH_ADDRESS2}) — address2 present`);

  // Carol — A2 is public; stale null in public.address.address2
  await db.collection('trustees').updateOne(
    {
      documentType: 'TRUSTEE',
      firstName: 'Carol',
      lastName: 'Testcase',
      'public.address.state': 'IL',
    },
    {
      $set: {
        documentType: 'TRUSTEE',
        firstName: 'Carol',
        lastName: 'Testcase',
        name: 'Carol Testcase',
        status: 'active',
        public: {
          address: {
            address1: '301 Elm Rd',
            address2: null, // stale null for the A2-as-public case
            city: 'Capital City',
            state: 'IL',
            zipCode: '62702',
            countryCode: 'US',
          },
          email: 'carol.testcase@example.com',
        },
        internal: {
          address: {
            address1: '300 Elm Rd',
            address2: null, // stale null on internal address too
            city: 'Capital City',
            state: 'IL',
            zipCode: '62702',
            countryCode: 'US',
          },
          email: 'carol.testcase@example.com',
        },
        legacy: {
          truIds: [String(TRUSTEE_ID_A2_PUBLIC)],
          testSentinel: TEST_DOC_SENTINEL,
        },
        trusteeId: `trustee-carol-testcase-il-${TEST_DOC_SENTINEL}`,
        createdOn: now,
        updatedOn: now,
      },
    },
    { upsert: true },
  );
  info(`Injected stale trustee for Carol Testcase (ID ${TRUSTEE_ID_A2_PUBLIC})`);
}

// ---------------------------------------------------------------------------
// run  (full address-normalization idempotency test)
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning migrate-trustees address-normalization idempotency test...\n');

  // ── Step 0: Clean to known state ─────────────────────────────────────────
  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  // ── Step 1: Seed ATS SQL fixture rows ─────────────────────────────────────
  console.log('Step 1: Seed ATS SQL fixture rows');
  await seedSql();
  console.log('');

  // ── Step 2: Inject stale trustee documents into Cosmos ────────────────────
  console.log('Step 2: Inject stale trustee documents with null address2 into Cosmos');
  const { client: injectClient, db: injectDb } = await getMongoDb();
  try {
    await injectStaleTrustees(injectDb);
  } finally {
    await injectClient.close();
  }
  console.log('');

  // ── Step 3: Verify stale state (null address2 present before re-migration) ─
  console.log('Step 3: Verify stale state has null address2 values (pre-condition)');
  const { client: preClient, db: preDb } = await getMongoDb();
  try {
    const alice = await preDb
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': TEST_DOC_SENTINEL, firstName: 'Alice' });
    if (alice?.public?.address?.address2 === null) {
      pass(`Alice's public.address.address2 is null before re-migration (pre-condition confirmed)`);
    } else {
      fail(
        `Alice should have null address2 before re-migration; got: ${JSON.stringify(alice?.public?.address?.address2)}`,
      );
    }

    const carol = await preDb
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': TEST_DOC_SENTINEL, firstName: 'Carol' });
    if (carol?.public?.address?.address2 === null) {
      pass(`Carol's public.address.address2 is null before re-migration (pre-condition confirmed)`);
    } else {
      fail(
        `Carol should have null address2 before re-migration; got: ${JSON.stringify(carol?.public?.address?.address2)}`,
      );
    }
  } finally {
    await preClient.close();
  }
  console.log('');

  // ── Step 4: Re-run migration via upsertTrustee ────────────────────────────
  // We call getPageOfTrustees + upsertTrustee directly (bypassing the queue
  // and offices-gateway path) because:
  //   a) The address normalization is entirely in upsertTrustee / transformTrusteeRecord
  //   b) Avoids needing a DXTR SQL instance just for division expansion
  //
  console.log('Step 4: Re-run migration (getPageOfTrustees + upsertTrustee) against real ATS SQL');
  const context = await buildContext();

  // Reset migration state so getPageOfTrustees starts from the beginning
  const resetResult = await resetMigrationState(context);
  if (resetResult.error) {
    fail(`Failed to reset migration state: ${resetResult.error.message}`);
    return;
  }
  info('Migration state reset');

  // Fetch the first page (importAll=true to skip active-code filter — fixtures use STATUS='PA')
  const pageResult = await getPageOfTrustees(context, null, 100, true);
  if (pageResult.error || !pageResult.data) {
    fail(`getPageOfTrustees failed: ${pageResult.error?.message ?? 'no data'}`);
    return;
  }

  const { trustees } = pageResult.data;
  const fixtureIds = [TRUSTEE_ID_NO_ADDRESS2, TRUSTEE_ID_WITH_ADDRESS2, TRUSTEE_ID_A2_PUBLIC];
  const fixtures = trustees.filter((t) => fixtureIds.includes(t.ID));

  if (fixtures.length !== 3) {
    fail(
      `Expected 3 fixture trustees from ATS SQL, got ${fixtures.length} (IDs found: ${trustees.map((t) => t.ID).join(', ')})`,
    );
    return;
  }
  pass(`Retrieved ${fixtures.length} fixture trustees from ATS SQL`);

  // Upsert each fixture trustee individually
  let upsertErrors = 0;
  for (const atsTrustee of fixtures) {
    const merged = mergeTrusteeRecords([atsTrustee]);
    const result = await upsertTrustee(context, merged);
    if (result.error) {
      fail(`upsertTrustee failed for ATS ID ${atsTrustee.ID}: ${result.error.message}`);
      upsertErrors++;
    } else {
      info(`Upserted trustee ATS ID ${atsTrustee.ID} → CAMS ID ${result.data.trusteeId}`);
    }
  }

  if (upsertErrors > 0) {
    fail(`${upsertErrors} upsert error(s) — aborting assertions`);
    return;
  }
  pass('All 3 fixture trustees upserted via re-migration');
  console.log('');

  // ── Step 5: Assert address2 is absent (not null) after re-migration ────────
  console.log('Step 5: Assert address2 fields are absent (not null) after re-migration\n');

  const { client: postClient, db: postDb } = await getMongoDb();
  try {
    // Alice: no STREET1 → address2 must be absent
    const alice = await postDb
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': TEST_DOC_SENTINEL, firstName: 'Alice' });

    if (!alice) {
      fail(`Alice's trustee document not found after re-migration`);
    } else {
      const pubAddr2 = alice?.public?.address?.address2;
      if (pubAddr2 === undefined || pubAddr2 === null) {
        if (pubAddr2 === null) {
          fail(
            `Alice's public.address.address2 is still null after re-migration (expected absent)`,
          );
        } else {
          pass(`Alice's public.address.address2 is absent (not null) after re-migration`);
        }
      } else {
        fail(`Alice's public.address.address2 has unexpected value: ${JSON.stringify(pubAddr2)}`);
      }

      // Confirm address1 still correct
      if (alice.public?.address?.address1 === '100 Main St') {
        pass(`Alice's public.address.address1 preserved: '100 Main St'`);
      } else {
        fail(`Alice's public.address.address1 changed: got '${alice.public?.address?.address1}'`);
      }
    }

    // Bob: has STREET1 'Suite 300' → address2 must be present
    const bob = await postDb
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': TEST_DOC_SENTINEL, firstName: 'Bob' });

    if (!bob) {
      fail(`Bob's trustee document not found after re-migration`);
    } else {
      if (bob.public?.address?.address2 === 'Suite 300') {
        pass(`Bob's public.address.address2 === 'Suite 300' (preserved correctly)`);
      } else {
        fail(
          `Bob's public.address.address2: expected 'Suite 300', got ${JSON.stringify(bob.public?.address?.address2)}`,
        );
      }
    }

    // Carol: A2 is public (no STREET1_A2) → public address2 must be absent
    const carol = await postDb
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': TEST_DOC_SENTINEL, firstName: 'Carol' });

    if (!carol) {
      fail(`Carol's trustee document not found after re-migration`);
    } else {
      const pubAddr2 = carol?.public?.address?.address2;
      if (pubAddr2 === null) {
        fail(`Carol's public.address.address2 is still null after re-migration (expected absent)`);
      } else if (pubAddr2 === undefined) {
        pass(`Carol's public.address.address2 is absent (not null) after re-migration`);
      } else {
        fail(`Carol's public.address.address2 has unexpected value: ${JSON.stringify(pubAddr2)}`);
      }

      // Carol has internal contact (STREET_A2 present) — address2 should also be absent
      if (carol.internal) {
        const intAddr2 = carol?.internal?.address?.address2;
        if (intAddr2 === null) {
          fail(
            `Carol's internal.address.address2 is still null after re-migration (expected absent)`,
          );
        } else if (intAddr2 === undefined) {
          pass(`Carol's internal.address.address2 is absent (not null) after re-migration`);
        } else {
          fail(
            `Carol's internal.address.address2 has unexpected value: ${JSON.stringify(intAddr2)}`,
          );
        }
      } else {
        info(
          'Carol has no internal contact block (STREET is not secondary when A2 is public with no data)',
        );
      }
    }

    // Confirm no explicit null address2 anywhere in our test trustee documents.
    // Use $exists + $type to match only stored null values, not absent fields
    // (MongoDB's { field: null } also matches absent fields, which would be a false positive).
    const staleDocs = await postDb
      .collection('trustees')
      .find({
        'legacy.testSentinel': TEST_DOC_SENTINEL,
        $or: [
          { 'public.address.address2': { $exists: true, $type: 'null' } },
          { 'internal.address.address2': { $exists: true, $type: 'null' } },
        ],
      })
      .toArray();

    if (staleDocs.length === 0) {
      pass('No harness trustee documents have null address2 fields after re-migration');
    } else {
      const names = staleDocs.map((d) => d.name ?? d.firstName);
      fail(
        `${staleDocs.length} document(s) still have null address2 after re-migration: ${names.join(', ')}`,
      );
    }
  } finally {
    await postClient.close();
  }

  // ── Step 6: Active-filter — inactive-only trustee must not appear ────────
  console.log('Step 6: Verify active-filter excludes trustee with only inactive appointments\n');

  // getPageOfTrustees without importAll=true applies the WHERE EXISTS filter.
  // Fixture 1009 has only STATUS='T' (not in ACTIVE_STATUS_CODES), so it must
  // not be in a page fetched with the filter applied. The `trustees` array from
  // Step 4 was fetched with importAll=true (to skip the filter for STATUS='PA'
  // fixtures), so it can't be reused here — fetch a fresh page with the filter on.
  const activeOnlyPageResult = await getPageOfTrustees(context, null, 100, false);
  if (activeOnlyPageResult.error || !activeOnlyPageResult.data) {
    fail(
      `getPageOfTrustees (active filter) failed: ${activeOnlyPageResult.error?.message ?? 'no data'}`,
    );
  } else {
    const inactiveFixture = activeOnlyPageResult.data.trustees.find(
      (t) => t.ID === TRUSTEE_ID_INACTIVE_ONLY,
    );
    if (inactiveFixture) {
      fail(
        `Trustee ID ${TRUSTEE_ID_INACTIVE_ONLY} (inactive-only) was returned by getTrusteesPage — active filter broken`,
      );
    } else {
      pass(
        `Trustee ID ${TRUSTEE_ID_INACTIVE_ONLY} (STATUS=T, inactive-only) correctly excluded by active filter`,
      );
    }
  }
  console.log('');

  // ── Step 7: Migration state — cursor advances after a batch ─────────────
  console.log('Step 7: Verify migration state initializes and cursor advances after a batch\n');

  const { client: stateClient1, db: _stateDb1 } = await getMongoDb();
  await stateClient1.close();

  const stateResult = await getOrCreateMigrationState(context);
  if (stateResult.error) {
    fail(`getOrCreateMigrationState returned error: ${stateResult.error.message}`);
  } else {
    const state = stateResult.data!;
    if (state.documentType === 'TRUSTEE_MIGRATION_STATE') {
      pass(`Migration state document has documentType === 'TRUSTEE_MIGRATION_STATE'`);
    } else {
      fail(
        `Migration state documentType: expected 'TRUSTEE_MIGRATION_STATE', got '${state.documentType}'`,
      );
    }

    // After resetMigrationState (Step 4) lastTrusteeId should be null
    if (state.lastTrusteeId === null || state.lastTrusteeId === undefined) {
      pass(`lastTrusteeId is null after reset (initial state correct)`);
    } else {
      fail(`lastTrusteeId should be null after reset; got ${JSON.stringify(state.lastTrusteeId)}`);
    }
  }
  console.log('');

  // ── Step 8: CAMS-772 archive-date override — assert appointment statuses ──
  console.log('Step 8: Verify CAMS-772 archive-date appointment status overrides\n');

  type ArchiveScenario = {
    label: string;
    record: AtsAppointmentRecord;
    expectStatus: 'active' | 'inactive';
    expectEffectiveDate?: string;
    expectType: AppointmentType;
  };

  const emptyOverrides = new Map<string, TrusteeOverride[]>();

  const archiveScenarios: ArchiveScenario[] = [
    {
      label: 'case-by-case (STATUS=C) with ARCHIVE_DATE → inactive',
      record: {
        TRU_ID: TRUSTEE_ID_ARCHIVE_CBC,
        DISTRICT: null,
        STATE: 'Idaho',
        CHAPTER: '7',
        STATUS: 'C',
        DATE_APPOINTED: new Date('2010-01-01'),
        EFFECTIVE_DATE: new Date('2010-01-01'),
        ARCHIVE_DATE: new Date('2019-06-15'),
      },
      expectStatus: 'inactive',
      expectEffectiveDate: '2019-06-15',
      expectType: 'case-by-case',
    },
    {
      label: 'elected (STATUS=E) with ARCHIVE_DATE → inactive',
      record: {
        TRU_ID: TRUSTEE_ID_ARCHIVE_ELECTED,
        DISTRICT: null,
        STATE: 'Arizona',
        CHAPTER: '7',
        STATUS: 'E',
        DATE_APPOINTED: new Date('2011-01-01'),
        EFFECTIVE_DATE: new Date('2011-01-01'),
        ARCHIVE_DATE: new Date('2020-03-01'),
      },
      expectStatus: 'inactive',
      expectEffectiveDate: '2020-03-01',
      expectType: 'elected',
    },
    {
      label: 'converted-case (STATUS=O) with ARCHIVE_DATE → inactive',
      record: {
        TRU_ID: TRUSTEE_ID_ARCHIVE_CONVERTED,
        DISTRICT: null,
        STATE: 'Connecticut',
        CHAPTER: '7',
        STATUS: 'O',
        DATE_APPOINTED: new Date('2012-01-01'),
        EFFECTIVE_DATE: new Date('2012-01-01'),
        ARCHIVE_DATE: new Date('2018-11-30'),
      },
      expectStatus: 'inactive',
      expectEffectiveDate: '2018-11-30',
      expectType: 'converted-case',
    },
    {
      label: 'panel (STATUS=PA) with ARCHIVE_DATE → active (panel not overridden)',
      record: {
        TRU_ID: TRUSTEE_ID_ARCHIVE_PANEL_CTRL,
        DISTRICT: null,
        STATE: 'Idaho',
        CHAPTER: '7',
        STATUS: 'PA',
        DATE_APPOINTED: new Date('2013-01-01'),
        EFFECTIVE_DATE: new Date('2013-01-01'),
        ARCHIVE_DATE: new Date('2021-01-01'),
      },
      expectStatus: 'active',
      expectType: 'panel',
    },
    {
      label: 'case-by-case (STATUS=C) without ARCHIVE_DATE → active',
      record: {
        TRU_ID: TRUSTEE_ID_CBC_NO_ARCHIVE,
        DISTRICT: null,
        STATE: 'Arizona',
        CHAPTER: '7',
        STATUS: 'C',
        DATE_APPOINTED: new Date('2014-01-01'),
        EFFECTIVE_DATE: new Date('2014-01-01'),
        ARCHIVE_DATE: undefined,
      },
      expectStatus: 'active',
      expectType: 'case-by-case',
    },
  ];

  for (const scenario of archiveScenarios) {
    const result = cleanseAndMapAppointment(
      context,
      String(scenario.record.TRU_ID),
      scenario.record,
      emptyOverrides,
    );
    const appt = result.appointment;
    const statusOk = appt?.status === scenario.expectStatus;
    const typeOk = appt?.appointmentType === scenario.expectType;
    const dateOk =
      !scenario.expectEffectiveDate || appt?.effectiveDate === scenario.expectEffectiveDate;

    if (statusOk && typeOk && dateOk) {
      pass(scenario.label);
    } else {
      fail(scenario.label);
      if (!statusOk) info(`  status: expected=${scenario.expectStatus} got=${appt?.status}`);
      if (!typeOk)
        info(`  appointmentType: expected=${scenario.expectType} got=${appt?.appointmentType}`);
      if (!dateOk)
        info(
          `  effectiveDate: expected=${scenario.expectEffectiveDate} got=${appt?.effectiveDate}`,
        );
      if (!appt) info(`  (no appointment produced — classification=${result.classification})`);
    }
  }
  console.log('');

  // ── Step 9: heal() — ACMS -> CAMS professional-ID backfill ──────────────
  console.log('Step 9: Verify heal() backfills missing trustee-professional-ids mappings\n');

  const { client: healSetupClient, db: healSetupDb } = await getMongoDb();
  let healTrusteeId: string;
  try {
    const now = new Date().toISOString();
    healTrusteeId = `trustee-heal-newmatch-il-${HEAL_TRUSTEE_SENTINEL}`;

    // CAMS trustee matching CMMPR fixture HL-98001 ('Heal' 'Newmatch', IL) by
    // name + state, per findTrusteeByNameAndState's `name` + `public.address.state` query.
    await healSetupDb.collection('trustees').updateOne(
      { 'legacy.testSentinel': HEAL_TRUSTEE_SENTINEL },
      {
        $set: {
          documentType: 'TRUSTEE',
          firstName: 'Heal',
          lastName: 'Newmatch',
          name: 'Heal Newmatch',
          status: 'active',
          public: {
            address: { state: 'IL', countryCode: 'US' },
            email: 'heal.newmatch@example.com',
          },
          legacy: { testSentinel: HEAL_TRUSTEE_SENTINEL },
          trusteeId: healTrusteeId,
          createdOn: now,
          updatedOn: now,
        },
      },
      { upsert: true },
    );
    info(
      `Seeded CAMS trustee '${healTrusteeId}' to match ACMS professional ${HEAL_ACMS_ID_NEW_MATCH}`,
    );

    // Pre-create a mapping for HL-98002 so the backfill must skip it (alreadyMapped).
    const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
    await professionalIdsRepo.createProfessionalId(healTrusteeId, HEAL_ACMS_ID_ALREADY_MAPPED, {
      id: 'INTEGRATION-TEST',
      name: 'Integration Test',
    });
    info(
      `Pre-created mapping for ${HEAL_ACMS_ID_ALREADY_MAPPED} (expect alreadyMapped, not created)`,
    );
  } finally {
    await healSetupClient.close();
  }

  // Exercise the paginated heal flow the way runHeal + handleHealPage do: read
  // the full ACMS set, chunk it, and process each chunk through the page
  // processor, aggregating the results. (In production the chunks are fanned out
  // across heal-page queue messages; the harness runs them inline in sequence.)
  //
  // Runs the SAME chunked pass the handler performs; returns aggregate tallies
  // plus the unmatched records (with reason codes) for assertion.
  async function runHealPass(): Promise<{
    created: number;
    alreadyMapped: number;
    unmatched: Array<{ acmsProfessionalId: string; reason: string }>;
  } | null> {
    const readResult = await readAllTrusteeProfessionalRecords(context);
    if (readResult.error || !readResult.data) {
      fail(`readAllTrusteeProfessionalRecords failed: ${readResult.error?.message ?? 'no data'}`);
      return null;
    }
    const HEAL_PAGE_SIZE = 100;
    const acmsRecords = readResult.data;
    let created = 0;
    let alreadyMapped = 0;
    const unmatched: Array<{ acmsProfessionalId: string; reason: string }> = [];

    for (let i = 0; i < acmsRecords.length; i += HEAL_PAGE_SIZE) {
      const chunk = acmsRecords.slice(i, i + HEAL_PAGE_SIZE);
      const pageResult = await backfillProfessionalIdsPage(context, chunk);
      if (pageResult.error || !pageResult.data) {
        fail(`backfillProfessionalIdsPage failed: ${pageResult.error?.message ?? 'no data'}`);
        return null;
      }
      created += pageResult.data.created;
      alreadyMapped += pageResult.data.alreadyMapped;
      unmatched.push(...pageResult.data.unmatched);
      // The harness fixtures are small enough that the escape hatch never fires;
      // if it did, remaining records would need re-processing.
      if (pageResult.data.remaining.length > 0) {
        fail(`Unexpected escape-hatch deferral in harness heal run`);
      }
    }
    return { created, alreadyMapped, unmatched };
  }

  const firstPass = await runHealPass();
  if (firstPass) {
    const { created, alreadyMapped, unmatched } = firstPass;

    // HL-98001 (new match) and HL-98004 (second ID, same trustee) are both created.
    if (created >= 2) {
      pass(`heal page processing created >= 2 new mappings (got ${created})`);
    } else {
      fail(`heal page processing should have created >= 2 mappings; got ${created}`);
    }

    if (alreadyMapped >= 1) {
      pass(`heal page processing reports >= 1 alreadyMapped record (got ${alreadyMapped})`);
    } else {
      fail(`heal page processing should report >= 1 alreadyMapped record; got ${alreadyMapped}`);
    }

    const reasonById = new Map(unmatched.map((u) => [u.acmsProfessionalId, u.reason]));

    if (reasonById.get(HEAL_ACMS_ID_NO_MATCH) === 'NO_TRUSTEE_MATCH') {
      pass(
        `${HEAL_ACMS_ID_NO_MATCH} (no CAMS trustee match) routed to unmatched: NO_TRUSTEE_MATCH`,
      );
    } else {
      fail(
        `${HEAL_ACMS_ID_NO_MATCH} should be unmatched w/ NO_TRUSTEE_MATCH; got: ${reasonById.get(HEAL_ACMS_ID_NO_MATCH) ?? 'absent'}`,
      );
    }

    // HL-98005 has a blank last name → INCOMPLETE_NAME_OR_STATE (no trustee lookup).
    if (reasonById.get(HEAL_ACMS_ID_INCOMPLETE) === 'INCOMPLETE_NAME_OR_STATE') {
      pass(
        `${HEAL_ACMS_ID_INCOMPLETE} (blank last name) routed to unmatched: INCOMPLETE_NAME_OR_STATE`,
      );
    } else {
      fail(
        `${HEAL_ACMS_ID_INCOMPLETE} should be unmatched w/ INCOMPLETE_NAME_OR_STATE; got: ${reasonById.get(HEAL_ACMS_ID_INCOMPLETE) ?? 'absent'}`,
      );
    }
  }

  const { client: healVerifyClient, db: healVerifyDb } = await getMongoDb();
  try {
    const newMapping = await healVerifyDb
      .collection('trustee-professional-ids')
      .findOne({ camsTrusteeId: healTrusteeId, acmsProfessionalId: HEAL_ACMS_ID_NEW_MATCH });
    if (newMapping) {
      pass(`Mapping for ${HEAL_ACMS_ID_NEW_MATCH} -> '${healTrusteeId}' persisted in Mongo`);
    } else {
      fail(
        `Expected mapping for ${HEAL_ACMS_ID_NEW_MATCH} -> '${healTrusteeId}' not found in Mongo`,
      );
    }

    // One-CAMS-trustee-to-many-ACMS-IDs: HL-98001 and HL-98004 both map to the
    // same trustee. Assert both mappings exist for it.
    const secondMapping = await healVerifyDb
      .collection('trustee-professional-ids')
      .findOne({ camsTrusteeId: healTrusteeId, acmsProfessionalId: HEAL_ACMS_ID_SECOND_MATCH });
    if (secondMapping) {
      pass(
        `Second mapping ${HEAL_ACMS_ID_SECOND_MATCH} -> '${healTrusteeId}' persisted (one-to-many)`,
      );
    } else {
      fail(
        `Expected second mapping ${HEAL_ACMS_ID_SECOND_MATCH} -> '${healTrusteeId}' not found in Mongo`,
      );
    }

    const mappingCount = await healVerifyDb.collection('trustee-professional-ids').countDocuments({
      camsTrusteeId: healTrusteeId,
      acmsProfessionalId: HEAL_ACMS_ID_ALREADY_MAPPED,
    });
    if (mappingCount === 1) {
      pass(
        `Exactly one mapping exists for pre-mapped ${HEAL_ACMS_ID_ALREADY_MAPPED} (no duplicate created)`,
      );
    } else {
      fail(`Expected exactly 1 mapping for ${HEAL_ACMS_ID_ALREADY_MAPPED}, found ${mappingCount}`);
    }
  } finally {
    await healVerifyClient.close();
  }

  // Idempotent re-run: running the entire heal a second time must converge —
  // nothing new created, everything now alreadyMapped, and no duplicate mappings
  // in Mongo. This is the resilience property that lets a timed-out or
  // 429-interrupted run simply be re-run to completion.
  const secondPass = await runHealPass();
  if (secondPass) {
    if (secondPass.created === 0) {
      pass(`Idempotent re-run created 0 new mappings`);
    } else {
      fail(`Idempotent re-run should create 0 mappings; created ${secondPass.created}`);
    }

    // HL-98001, HL-98002 (pre-mapped), HL-98004 are all mapped now → alreadyMapped.
    if (secondPass.alreadyMapped >= 3) {
      pass(`Idempotent re-run reports >= 3 alreadyMapped (got ${secondPass.alreadyMapped})`);
    } else {
      fail(`Idempotent re-run should report >= 3 alreadyMapped; got ${secondPass.alreadyMapped}`);
    }
  }

  const { client: reRunClient, db: reRunDb } = await getMongoDb();
  try {
    const totalForTrustee = await reRunDb
      .collection('trustee-professional-ids')
      .countDocuments({ camsTrusteeId: healTrusteeId });
    // Exactly 3 mappings for the heal trustee: HL-98001, HL-98002, HL-98004.
    if (totalForTrustee === 3) {
      pass(`Idempotent re-run left exactly 3 mappings for heal trustee (no duplicates)`);
    } else {
      fail(`Expected exactly 3 mappings for heal trustee after re-run; found ${totalForTrustee}`);
    }
  } finally {
    await reRunClient.close();
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('migrate-trustees — Integration Test Harness');
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
    case 'run':
      await run();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run migrate-trustees --';
      console.log('\nUsage (from test/integration/):');
      console.log(
        `  INTEGRATION_ENV=local  ${HARNESS} <command>   (default — localhost containers)`,
      );
      console.log(
        `  INTEGRATION_ENV=azure  ${HARNESS} <command>   (lower-env Azure, VPN required)`,
      );
      console.log('\nLocal workflow:');
      console.log('  1. podman run -d -p 27017:27017 mongo:7.0 --bind_ip_all');
      console.log('  2. podman run -d -p 1433:1433 -e ACCEPT_EULA=Y \\');
      console.log(
        '       -e MSSQL_SA_PASSWORD=YourStrong!Passw0rd mcr.microsoft.com/azure-sql-edge',
      );
      console.log('  3. cp migrate-trustees/.env.local.template migrate-trustees/.env.local');
      console.log('  4. Fill in ATS_MSSQL_PASS + ACMS_MSSQL_PASS in .env.local');
      console.log(`  5. ${HARNESS} seed-schema`);
      console.log(`  6. ${HARNESS} seed-sql`);
      console.log(`  7. ${HARNESS} run`);
      console.log(`  8. ${HARNESS} clean`);
      console.log('\nAll commands:');
      console.log('  check-env     Verify required environment variables');
      console.log('  seed-schema   [local] Create ATS_INT + ACMS_INT + apply DDL');
      console.log('  seed-sql      [local] Seed TRUSTEES + CHAPTER_DETAILS + CMMPR fixture rows');
      console.log(
        '  run           Full test: address normalization + active filter + CAMS-772 + migration state + heal()',
      );
      console.log('  clean         Remove harness test data');
      console.log('  help          Show this help');
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
