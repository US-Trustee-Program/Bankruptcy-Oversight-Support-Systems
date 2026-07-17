/**
 * Integration test harness: SyncTrusteeCaseAppointmentsUseCase against real DXTR SQL.
 *
 * Exercises the full pipeline:
 *   1. Seeds a case + trustee party + two AO_TX rows (an 'A'/'TR' appointment
 *      transaction and a '1'/'1' petition transaction) into a local DXTR mimic.
 *   2. Seeds a synced case, a Trustee, a TrusteeProfessionalId mapping, and an
 *      active TrusteeAppointment (perfect-match target) into Cosmos.
 *   3. Calls SyncTrusteeCaseAppointmentsUseCase.getAppointmentEvents() — reads DXTR,
 *      asserts both event types (appointment + petition) are parsed correctly.
 *   4. Calls .processAppointments(events) — asserts professional-id fast-path
 *      matching auto-links both events to the seeded trustee and writes a
 *      case appointment + an approved trustee-match-verification record.
 *
 * Two environments via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh
 *   azure            — lower-env Azure Gov databases (VPN required)
 *
 * This is a one-shot script — NOT a Vitest test.
 *
 * Usage (from test/integration/):
 *   npm run trustee-petition-match -- [command]
 *
 * Local workflow:
 *   1. cd trustee-petition-match/scripts && ./start-services.sh
 *   2. npm run trustee-petition-match -- seed-schema
 *   3. npm run trustee-petition-match -- seed-sql
 *   4. npm run trustee-petition-match -- seed-cosmos
 *   5. npm run trustee-petition-match -- run
 *   6. npm run trustee-petition-match -- clean
 *   7. cd trustee-petition-match/scripts && ./stop-services.sh
 *
 * Commands:
 *   check-env     Verify required environment variables are set
 *   seed-schema   [local] Create DXTR_INT database + apply AO_* DDL
 *   seed-sql      Drop/recreate DXTR fixture rows (idempotent)
 *   seed-cosmos   Seed synced case, Trustee, ProfessionalId, TrusteeAppointment
 *   run           Full test: clean → seed → read DXTR → process → assert
 *   clean         Remove test documents/rows from both databases
 *   help          Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import * as mssql from 'mssql';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import SyncTrusteeCaseAppointmentsUseCase from '../../../../backend/lib/use-cases/dataflows/sync-trustee-case-appointments';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

// ---------------------------------------------------------------------------
// Test fixtures — see seed/01-seed-dxtr-data.sql for the matching DXTR rows
// ---------------------------------------------------------------------------

const TEST_CS_CASEID = '999999001';
const TEST_COURT_ID = '0208';
const TEST_CS_DIV = '081';
const TEST_GRP_DES = 'NY';
const TEST_CASE_ID = '081-26-99999'; // CS_DIV_ACMS + '-' + CASE_ID
const TEST_CHAPTER = '7';

const TEST_PROF_CODE = '00063';
const TEST_ACMS_PROFESSIONAL_ID = `${TEST_GRP_DES}-${TEST_PROF_CODE}`;

const TEST_TRUSTEE_ID = 'integration-trustee-petition-match-001';
const TEST_TRUSTEE_NAME = 'Integration Trustee';

const APPOINTMENT_DATE = '2026-06-01'; // packed into the 'A'/'TR' AO_TX row's REC
const PETITION_DATE = '2026-03-01'; // packed into the '1'/'1' AO_TX row's REC

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

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
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function getDxtrSqlPool(database: string): Promise<mssql.ConnectionPool> {
  const server = process.env.MSSQL_HOST;
  if (!server) throw new Error('MSSQL_HOST is not set');

  const port = Number(process.env.MSSQL_PORT) || 1433;
  const encrypt = process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate = process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
  const user = process.env.MSSQL_USER;
  const password = process.env.MSSQL_PASS;

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
    config.authentication = { type: 'azure-active-directory-default', options: {} };
  }

  return mssql.connect(config);
}

async function executeSqlFile(pool: mssql.ConnectionPool, filePath: string): Promise<void> {
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

async function getAppContext() {
  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  // Out of scope for this test: the downstream notification path queries
  // AO_OFFICE/AO_COURT/AO_GRP_DES/AO_REGION, which aren't part of the DXTR
  // schema this harness seeds (only AO_CS_DIV/AO_CS/AO_PY/AO_TX).
  context.featureFlags['downstream-trustee-appointments-enabled'] = false;
  return context;
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required: [string, string][] = [
    ['MONGO_CONNECTION_STRING', 'MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos/Mongo database name'],
    ['MSSQL_HOST', 'DXTR SQL Server host'],
  ];

  const optional: [string, string][] = [
    ['MSSQL_DATABASE_DXTR', 'DXTR database name (default: DXTR_INT)'],
    ['MSSQL_USER', 'DXTR SQL user (omit for Azure AD auth)'],
    ['MSSQL_PASS', 'DXTR SQL password'],
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
// seed-schema  (create DXTR_INT database + apply AO_* DDL)
// ---------------------------------------------------------------------------

async function seedSchema() {
  if (!IS_LOCAL) {
    console.error('seed-schema is only for local container runs. Schema already exists in Azure.');
    process.exit(1);
  }
  const dxtrDatabase = process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';
  console.log(`\nCreating ${dxtrDatabase} database + applying schema...\n`);

  const masterPool = await getDxtrSqlPool('master');
  try {
    await masterPool
      .request()
      .query(
        `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${dxtrDatabase}') CREATE DATABASE [${dxtrDatabase}]`,
      );
    pass(`Database '${dxtrDatabase}' ready`);
  } finally {
    await masterPool.close();
  }

  const pool = await getDxtrSqlPool(dxtrDatabase);
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(pool, path.join(seedDir, '00-seed-dxtr-schema.sql'));
    pass('00-seed-dxtr-schema.sql applied (AO_CS_DIV, AO_CS, AO_PY, AO_TX tables created)');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-sql  (drop/recreate DXTR fixture rows — idempotent)
// ---------------------------------------------------------------------------

async function seedSql() {
  console.log('\nSeeding DXTR fixture rows into DXTR_INT...\n');

  const dxtrDatabase = process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';
  const pool = await getDxtrSqlPool(dxtrDatabase);
  try {
    const seedDir = path.join(HARNESS_DIR, 'seed');
    await executeSqlFile(pool, path.join(seedDir, '01-seed-dxtr-data.sql'));
    pass(
      `01-seed-dxtr-data.sql seeded (case ${TEST_CASE_ID}, trustee party, appointment + petition AO_TX rows)`,
    );
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos  (synced case, Trustee, ProfessionalId, TrusteeAppointment)
// ---------------------------------------------------------------------------

async function seedCosmos() {
  console.log(
    '\nSeeding synced case, Trustee, ProfessionalId, and TrusteeAppointment into Cosmos...\n',
  );

  const now = new Date().toISOString();
  const { client, db } = await getMongoDb();
  try {
    await db.collection('cases').replaceOne(
      { documentType: 'SYNCED_CASE', caseId: TEST_CASE_ID },
      {
        documentType: 'SYNCED_CASE',
        caseId: TEST_CASE_ID,
        dxtrId: TEST_CASE_ID,
        courtId: TEST_COURT_ID,
        courtName: 'Integration Test Court',
        courtDivisionCode: TEST_CS_DIV,
        courtDivisionName: 'Manhattan',
        officeCode: '1',
        officeName: 'Manhattan',
        groupDesignator: TEST_GRP_DES,
        regionId: '02',
        regionName: 'Region 2',
        chapter: TEST_CHAPTER,
        caseTitle: 'Integration Test Debtor',
        dateFiled: '2026-01-01',
        debtor: { name: 'Integration Test Debtor' },
        updatedOn: now,
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      },
      { upsert: true },
    );
    pass(`Upserted synced case: ${TEST_CASE_ID}`);

    await db.collection('trustees').replaceOne(
      { documentType: 'TRUSTEE', trusteeId: TEST_TRUSTEE_ID },
      {
        documentType: 'TRUSTEE',
        trusteeId: TEST_TRUSTEE_ID,
        name: TEST_TRUSTEE_NAME,
        firstName: 'Integration',
        lastName: 'Trustee',
        public: {
          address: {
            address1: '100 Integration Ave',
            city: 'Washington',
            state: 'DC',
            zipCode: '20001',
            countryCode: 'US',
          },
          phone: '202-555-0199',
          email: 'integration.trustee@example.com',
        },
        updatedOn: now,
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
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
        updatedOn: now,
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
      },
      { upsert: true },
    );
    pass(`Upserted TrusteeProfessionalId: ${TEST_ACMS_PROFESSIONAL_ID} → ${TEST_TRUSTEE_ID}`);

    // Active appointment in the same court/division/chapter as the DXTR events —
    // the "perfect match" target so professional-id-matched events auto-link.
    await db.collection('trustee-appointments').replaceOne(
      { documentType: 'TRUSTEE_APPOINTMENT', trusteeId: TEST_TRUSTEE_ID, courtId: TEST_COURT_ID },
      {
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: TEST_TRUSTEE_ID,
        chapter: TEST_CHAPTER,
        appointmentType: 'panel',
        courtId: TEST_COURT_ID,
        divisionCode: TEST_CS_DIV,
        appointedDate: '2020-01-01',
        status: 'active',
        effectiveDate: '2020-01-01',
        updatedOn: now,
        updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
        createdOn: now,
        createdBy: { id: 'SYSTEM', name: 'SYSTEM' },
      },
      { upsert: true },
    );
    pass(
      `Upserted active TrusteeAppointment for ${TEST_TRUSTEE_ID} (court ${TEST_COURT_ID}, div ${TEST_CS_DIV}, chapter ${TEST_CHAPTER})`,
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

  const dxtrDatabase = process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';
  const pool = await getDxtrSqlPool(dxtrDatabase);
  try {
    await pool.request().query(`
      DELETE FROM dbo.AO_TX WHERE CS_CASEID = '${TEST_CS_CASEID}' AND COURT_ID = '${TEST_COURT_ID}';
      DELETE FROM dbo.AO_PY WHERE CS_CASEID = '${TEST_CS_CASEID}' AND COURT_ID = '${TEST_COURT_ID}';
      DELETE FROM dbo.AO_CS WHERE CS_CASEID = '${TEST_CS_CASEID}' AND COURT_ID = '${TEST_COURT_ID}';
      DELETE FROM dbo.AO_CS_DIV WHERE CS_DIV = '${TEST_CS_DIV}' AND GRP_DES = '${TEST_GRP_DES}';
    `);
    pass(`Deleted DXTR fixture rows for case ${TEST_CASE_ID}`);
  } finally {
    await pool.close();
  }

  const { client, db } = await getMongoDb();
  try {
    const r1a = await db
      .collection('case-trustee-appointments')
      .deleteMany({ documentType: 'CASE_APPOINTMENT', caseId: TEST_CASE_ID });
    const r1b = await db
      .collection('trustee-case-appointments')
      .deleteMany({ documentType: 'CASE_APPOINTMENT', caseId: TEST_CASE_ID });
    pass(
      `Deleted ${r1a.deletedCount + r1b.deletedCount} CASE_APPOINTMENT(s) for case ${TEST_CASE_ID}`,
    );

    const r2 = await db
      .collection('trustee-match-verification')
      .deleteMany({ caseId: TEST_CASE_ID });
    pass(`Deleted ${r2.deletedCount} trustee-match-verification doc(s) for case ${TEST_CASE_ID}`);

    const r3 = await db
      .collection('trustee-appointments')
      .deleteMany({ documentType: 'TRUSTEE_APPOINTMENT', trusteeId: TEST_TRUSTEE_ID });
    pass(`Deleted ${r3.deletedCount} TrusteeAppointment(s) for ${TEST_TRUSTEE_ID}`);

    const r4 = await db.collection('trustee-professional-ids').deleteMany({
      acmsProfessionalId: TEST_ACMS_PROFESSIONAL_ID,
      camsTrusteeId: TEST_TRUSTEE_ID,
    });
    pass(`Deleted ${r4.deletedCount} TrusteeProfessionalId(s)`);

    const r5 = await db
      .collection('trustees')
      .deleteMany({ documentType: 'TRUSTEE', trusteeId: TEST_TRUSTEE_ID });
    pass(`Deleted ${r5.deletedCount} Trustee doc(s) for trusteeId ${TEST_TRUSTEE_ID}`);

    const r6 = await db
      .collection('cases')
      .deleteMany({ documentType: 'SYNCED_CASE', caseId: TEST_CASE_ID });
    pass(`Deleted ${r6.deletedCount} synced case doc(s) for ${TEST_CASE_ID}`);

    // These are dataflow-wide singleton watermarks (documentType only, no caseId) —
    // there is no case-scoped filter possible here. This harness must only be run
    // against an isolated local/test Cosmos database (see README): running it
    // against a shared environment would reset the sync cursor for every case the
    // real dataflow is tracking, not just this test's fixture.
    await db.collection('runtime-state').deleteMany({
      documentType: { $in: ['TRUSTEE_APPOINTMENTS_SYNC_STATE', 'TRUSTEE_PETITION_SYNC_STATE'] },
    });
    pass(
      'Removed TRUSTEE_APPOINTMENTS_SYNC_STATE and TRUSTEE_PETITION_SYNC_STATE from runtime-state',
    );
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning full pipeline integration test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed DXTR fixture rows');
  await seedSql();
  console.log('');

  console.log(
    'Step 2: Seed Cosmos fixtures (synced case, Trustee, ProfessionalId, TrusteeAppointment)',
  );
  await seedCosmos();
  console.log('');

  // ── Stage 1: Read path ────────────────────────────────────────────────────
  console.log('Stage 1: SyncTrusteeCaseAppointmentsUseCase.getAppointmentEvents()');
  console.log('  Reads AO_TX/AO_CS/AO_CS_DIV/AO_PY from DXTR SQL\n');

  const context = await getAppContext();
  const useCase = new SyncTrusteeCaseAppointmentsUseCase(context);

  const { events } = await useCase.getAppointmentEvents(undefined, true);
  const testEvents = events.filter((e) => e.caseId === TEST_CASE_ID);

  if (testEvents.length === 2) {
    pass(`getAppointmentEvents returned 2 events for case ${TEST_CASE_ID}`);
  } else {
    fail(`expected 2 events for case ${TEST_CASE_ID}, got ${testEvents.length}`);
    return;
  }

  const appointmentEvent = testEvents.find((e) => e.appointedDate === APPOINTMENT_DATE);
  const petitionEvent = testEvents.find((e) => e.appointedDate === PETITION_DATE);

  if (appointmentEvent) {
    pass(`Found 'A'/'TR' appointment event with appointedDate=${APPOINTMENT_DATE}`);
  } else {
    fail(`No event found with appointedDate=${APPOINTMENT_DATE} (appointment transaction)`);
  }
  if (petitionEvent) {
    pass(`Found '1'/'1' petition event with appointedDate=${PETITION_DATE}`);
  } else {
    fail(`No event found with appointedDate=${PETITION_DATE} (petition transaction)`);
  }

  for (const [label, event] of [
    ['appointment', appointmentEvent],
    ['petition', petitionEvent],
  ] as const) {
    if (!event) continue;
    if (event.dxtrTrustee.fullName === TEST_TRUSTEE_NAME) {
      pass(`${label} event dxtrTrustee.fullName === "${TEST_TRUSTEE_NAME}"`);
    } else {
      fail(
        `${label} event dxtrTrustee.fullName: expected "${TEST_TRUSTEE_NAME}", got "${event.dxtrTrustee.fullName}"`,
      );
    }
    if (event.acmsProfessionalId === TEST_ACMS_PROFESSIONAL_ID) {
      pass(`${label} event acmsProfessionalId === "${TEST_ACMS_PROFESSIONAL_ID}"`);
    } else {
      fail(
        `${label} event acmsProfessionalId: expected "${TEST_ACMS_PROFESSIONAL_ID}", got "${event.acmsProfessionalId}"`,
      );
    }
    if (
      event.courtId === TEST_COURT_ID &&
      event.courtDivisionCode === TEST_CS_DIV &&
      event.chapter === TEST_CHAPTER
    ) {
      pass(`${label} event courtId/courtDivisionCode/chapter match seeded case`);
    } else {
      fail(
        `${label} event court fields mismatch: courtId=${event.courtId}, courtDivisionCode=${event.courtDivisionCode}, chapter=${event.chapter}`,
      );
    }
  }

  if (hasFailures) {
    console.log('\nAborting — read-path assertions failed.');
    return;
  }

  // ── Stage 2: Match + write path ───────────────────────────────────────────
  console.log('\nStage 2: SyncTrusteeCaseAppointmentsUseCase.processAppointments()');
  console.log(
    '  Matches by acmsProfessionalId, auto-links perfect match, writes case appointment\n',
  );

  const result = await useCase.processAppointments(testEvents);

  if (result.successCount === 2) {
    pass(`processAppointments successCount === 2`);
  } else {
    fail(`expected successCount 2, got ${result.successCount}`);
  }
  if (result.scenarioDistribution.autoMatchCount === 2) {
    pass(`scenarioDistribution.autoMatchCount === 2 (both events perfect-matched)`);
  } else {
    fail(`expected autoMatchCount 2, got ${result.scenarioDistribution.autoMatchCount}`);
  }
  if (result.dlqMessages.length === 0) {
    pass('No DLQ messages');
  } else {
    fail(
      `expected 0 DLQ messages, got ${result.dlqMessages.length}: ${JSON.stringify(result.dlqMessages)}`,
    );
  }
  if (result.notYetSyncedEvents.length === 0) {
    pass('No notYetSyncedEvents (synced case was found)');
  } else {
    fail(`expected 0 notYetSyncedEvents, got ${result.notYetSyncedEvents.length}`);
  }

  // ── Stage 3: Assert Cosmos side effects ───────────────────────────────────
  console.log('\nStage 3: Asserting Cosmos state\n');

  const { client, db } = await getMongoDb();
  try {
    const appointment = await db
      .collection('case-trustee-appointments')
      .findOne({ documentType: 'CASE_APPOINTMENT', caseId: TEST_CASE_ID });

    if (appointment?.trusteeId === TEST_TRUSTEE_ID) {
      pass(`case-trustee-appointments has 1 doc for ${TEST_CASE_ID} linked to ${TEST_TRUSTEE_ID}`);
    } else {
      fail(
        `expected a case appointment linked to ${TEST_TRUSTEE_ID}, got: ${JSON.stringify(appointment)}`,
      );
    }

    const verification = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: TEST_CASE_ID });

    if (
      verification?.status === 'approved' &&
      verification?.resolvedTrusteeId === TEST_TRUSTEE_ID
    ) {
      pass(`trustee-match-verification approved for ${TEST_TRUSTEE_ID}`);
    } else {
      fail(
        `expected approved verification for ${TEST_TRUSTEE_ID}, got: ${JSON.stringify(verification)}`,
      );
    }
  } finally {
    await client.close();
  }

  console.log('\nResult summary:');
  console.log(JSON.stringify(result, null, 2));
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('Trustee Petition Match — Integration Test');
  console.log(`Environment: ${INTEGRATION_ENV}`);
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
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run trustee-petition-match --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  INTEGRATION_ENV=local  ${HARNESS} <command>   (default)`);
      console.log(`  INTEGRATION_ENV=azure  ${HARNESS} <command>   (VPN required)`);
      console.log('\nLocal workflow:');
      console.log('  1. ./trustee-petition-match/scripts/start-services.sh');
      console.log(`  2. ${HARNESS} seed-schema  (create DXTR_INT + apply AO_* DDL)`);
      console.log(`  3. ${HARNESS} seed-sql     (seed case/trustee/AO_TX rows in SQL)`);
      console.log(
        `  4. ${HARNESS} seed-cosmos  (seed synced case/Trustee/ProfessionalId/TrusteeAppointment)`,
      );
      console.log(`  5. ${HARNESS} run          (read DXTR → match → write, then assert)`);
      console.log(`  6. ${HARNESS} clean        (remove all test data from both databases)`);
      console.log('  7. ./trustee-petition-match/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env    Verify required environment variables');
      console.log('  seed-schema  [local] Create DXTR_INT + apply AO_* DDL');
      console.log('  seed-sql     Seed AO_CS_DIV/AO_CS/AO_PY/AO_TX fixture rows');
      console.log('  seed-cosmos  Seed synced case, Trustee, ProfessionalId, TrusteeAppointment');
      console.log('  run          Full test: clean → seed → read DXTR → process → assert');
      console.log('  clean        Remove seeded data from DXTR SQL + Cosmos');
      console.log('  help         Show this help');
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
