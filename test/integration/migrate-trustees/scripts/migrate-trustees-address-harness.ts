/**
 * Integration test harness: trustee migration idempotent address normalization.
 *
 * Confirms that re-running the trustee migration with real MongoDB and ATS SQL
 * databases removes stale null address2 fields from existing trustee documents.
 *
 * The fix under test: `transformTrusteeRecord` in ats-mappings.ts maps
 * STREET1 / STREET1_A2 with `|| undefined` so that missing source fields produce
 * `address2: undefined` (absent from the document) rather than `address2: null`.
 * When `upsertTrustee` merges an existing trustee with the fresh ATS record, the
 * spread-merge picks up the normalized value, eliminating any previously-stored null.
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
 *   seed-schema   Create ATS_INT database + apply schema
 *   seed-sql      Drop/recreate ATS fixture rows (idempotent)
 *   run           Full test: inject stale docs → re-run migration → assert no nulls
 *   clean         Remove test documents from MongoDB + ATS fixture rows
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
} from '../../../../backend/lib/use-cases/dataflows/migrate-trustees';
import { resetMigrationState } from '../../../../backend/lib/use-cases/dataflows/trustee-migration-state.service';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

// ATS fixture trustee IDs (must match 01-seed-trustees.sql)
const TRUSTEE_ID_NO_ADDRESS2 = 1001; // Alice — no STREET1
const TRUSTEE_ID_WITH_ADDRESS2 = 1002; // Bob — has STREET1 "Suite 300"
const TRUSTEE_ID_A2_PUBLIC = 1003; // Carol — A2 is public, no STREET1_A2

// Sentinel used to find our test documents in Cosmos
const TEST_DOC_SENTINEL = 'INTEGRATION-MIGRATE-TRUSTEES-ADDRESS-TEST';

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
    pass('01-seed-trustees.sql seeded (TRUSTEES + CHAPTER_DETAILS rows recreated)');
  } finally {
    await pool.close();
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
  } finally {
    await client.close();
  }

  // Remove ATS fixture rows
  const atsDatabase = process.env.ATS_MSSQL_DATABASE || 'ATS_INT';
  const pool = await getAtsSqlPool(atsDatabase);
  try {
    await pool.request().query(`
      DELETE FROM CHAPTER_DETAILS WHERE TRU_ID IN (${TRUSTEE_ID_NO_ADDRESS2}, ${TRUSTEE_ID_WITH_ADDRESS2}, ${TRUSTEE_ID_A2_PUBLIC});
      DELETE FROM TRUSTEES WHERE ID IN (${TRUSTEE_ID_NO_ADDRESS2}, ${TRUSTEE_ID_WITH_ADDRESS2}, ${TRUSTEE_ID_A2_PUBLIC});
    `);
    pass(
      `Deleted ATS fixture rows for trustee IDs ${TRUSTEE_ID_NO_ADDRESS2}, ${TRUSTEE_ID_WITH_ADDRESS2}, ${TRUSTEE_ID_A2_PUBLIC}`,
    );
  } finally {
    await pool.close();
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
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('migrate-trustees — Address Normalization Integration Test');
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
      console.log('  4. Fill in ATS_MSSQL_PASS in .env.local');
      console.log(`  5. ${HARNESS} seed-schema`);
      console.log(`  6. ${HARNESS} seed-sql`);
      console.log(`  7. ${HARNESS} run`);
      console.log(`  8. ${HARNESS} clean`);
      console.log('\nAll commands:');
      console.log('  check-env     Verify required environment variables');
      console.log('  seed-schema   [local] Create ATS_INT + apply DDL');
      console.log('  seed-sql      [local] Seed TRUSTEES + CHAPTER_DETAILS fixture rows');
      console.log('  run           Full test: inject stale docs → re-migrate → assert no nulls');
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
