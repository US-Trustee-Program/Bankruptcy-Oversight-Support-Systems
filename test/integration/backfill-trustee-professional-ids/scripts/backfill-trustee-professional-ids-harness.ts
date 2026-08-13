/**
 * Integration test harness: ACMS trustee-professional-ids backfill (CAMS-816 / CAMS-2-bko epic).
 *
 * Exercises the NEW gateway methods added by this epic (AcmsGatewayImpl.getAllTrusteeProfessionalRecords
 * (widened), .getCmmapAppointmentsForProfessionalIds (new, batched), .getDivisionToCourtMap (new,
 * live CMMDO join) — backend/lib/adapters/gateways/acms/acms.gateway.ts) together with the real
 * matching/scoring logic (processAcmsProfessionalRecordsPage,
 * backend/lib/use-cases/dataflows/backfill-trustee-professional-ids.ts, which in turn calls
 * resolveAcmsProfessionalMatch in acms-trustee-match.helpers.ts) against a real SQL Edge instance
 * (mimicking ACMS) and a real MongoDB instance (mimicking Cosmos).
 *
 * Per Brian's standing preference (mocks can pass while the real query is subtly wrong — "mocks
 * lie"), this harness calls the real gateway and real use-case functions directly, with NO mocked
 * gateways/repositories anywhere in the path — see TRUSTEE-ACMS-BACKFILL_CONVERGED_DESIGN.md's
 * "Implementation-scope note on integration testing" section for the scoping rationale.
 *
 * SCOPE NOTE: this harness exercises the gateway + use-case layer only (calls
 * processAcmsProfessionalRecordsPage directly), NOT the Azure Functions dataflow handler —
 * backend/function-apps/dataflows/migrations/backfill-trustee-professional-ids.ts does not exist
 * yet as of when this harness was authored (CAMS-2-bko.7's use case landed, but no queue-triggered
 * handler wiring it up has landed). Handler-level coverage (START/PAGE queue wiring, StartMessage
 * flags, ensureContainersExist) is a follow-up once that handler exists — see README.md.
 *
 * Six scenarios (see README.md's coverage table for the full rationale):
 *   1. tier1-only            - exact name+state match; Tier 2 misses it (no phoneticTokens seeded
 *                              on the CAMS trustee, simulating a trustee never phonetic-backfilled)
 *   2. tier2-only            - ACMS state is stale/wrong so Tier 1's exact-match query fails on
 *                              state; Tier 2 (name-only, no state filter) still finds it
 *   3. gap-check             - two CAMS trustees share the same name; both individually clear the
 *                              auto-match threshold, but the winner's gap over the runner-up is
 *                              < ACMS_FUZZY_MATCH_MIN_GAP -> unmatched despite both clearing 90
 *   4. below-threshold       - a lone candidate is found, but corroboration is too weak to clear
 *                              the auto-match threshold -> permanently unmatched, NO artifact
 *   5. closed-pre-2018       - (THE most important regression case) every CMMAP appointment row
 *                              for this professional is a closed, pre-2018 case; proves the new
 *                              getCmmapAppointmentsForProfessionalIds genuinely dropped the
 *                              open-case filter (these rows still populate district/chapter sets
 *                              and the professional still matches a currently-active trustee)
 *   6. already-mapped        - a trustee-professional-ids mapping is pre-seeded before the page
 *                              runs; re-running is a safe no-op (idempotency)
 *
 * This is a one-shot script - NOT a Vitest test.
 *
 * Environment: local only (Podman containers via start-services.sh) — no Azure mode, per the
 * dataflow-integration-testing skill's "all integration tests run against local Podman
 * containers" convention for this harness's scope.
 *
 * Usage (from test/integration/):
 *   npm run backfill-trustee-professional-ids -- [command]
 *
 * Local workflow:
 *   1. cd backfill-trustee-professional-ids/scripts && ./start-services.sh
 *   2. npm run backfill-trustee-professional-ids -- seed-schema
 *   3. npm run backfill-trustee-professional-ids -- seed-sql
 *   4. npm run backfill-trustee-professional-ids -- seed-cosmos
 *   5. npm run backfill-trustee-professional-ids -- run
 *   6. npm run backfill-trustee-professional-ids -- clean
 *   7. cd backfill-trustee-professional-ids/scripts && ./stop-services.sh
 *
 * Commands:
 *   check-env     Verify required environment variables are set
 *   seed-schema   Create ACMS_INT database + apply CMMPR/CMMAP/CMMDB/CMMDO DDL
 *   seed-sql      Drop/recreate ACMS fixture rows for the 6 scenarios (idempotent)
 *   seed-cosmos   Seed CAMS trustees, trustee-appointments, and the scenario-6 pre-existing mapping
 *   run           Full test: clean -> seed -> getDivisionToCourtMap -> process page (x2) -> assert
 *   clean         Remove test rows/documents from both databases
 *   help          Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import * as mssql from 'mssql';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';
import {
  readAllAcmsProfessionalRecords,
  processAcmsProfessionalRecordsPage,
} from '../../../../backend/lib/use-cases/dataflows/backfill-trustee-professional-ids';
import { generateSearchTokens } from '../../../../backend/lib/adapters/utils/phonetic-helper';
import { AcmsTrusteeProfessionalRecord } from '../../../../backend/lib/use-cases/gateways.types';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

// ---------------------------------------------------------------------------
// Scenario identifiers — see README.md's coverage table for full rationale.
// ---------------------------------------------------------------------------

const ACMS_IDS = {
  tier1Only: 'BT-97001',
  tier2Only: 'BT-97002',
  gapCheck: 'BT-97003',
  belowThreshold: 'BT-97004',
  closedPre2018: 'BT-97005',
  alreadyMapped: 'BT-97006',
} as const;
const ALL_ACMS_IDS = Object.values(ACMS_IDS);

const TRUSTEES = {
  tier1Only: 'bkotp-s1-correct',
  tier2Only: 'bkotp-s2-correct',
  gapWinner: 'bkotp-s3-winner',
  gapRunnerUp: 'bkotp-s3-runnerup',
  belowThreshold: 'bkotp-s4-weak',
  closedPre2018: 'bkotp-s5-active',
  alreadyMapped: 'bkotp-s6-existing',
} as const;
const ALL_TRUSTEE_IDS = Object.values(TRUSTEES);

// Scenario 3's ten shared courts (S301..S310) plus the runner-up's 11th, different court
// (S311) — see fixtures/01-seed-acms-scenarios.sql's CMMDO block for the CASE_DIV mapping.
const GAP_CHECK_SHARED_COURTS = Array.from(
  { length: 10 },
  (_, i) => `S3${String(i + 1).padStart(2, '0')}`,
);
const GAP_CHECK_WINNER_COURTS = GAP_CHECK_SHARED_COURTS; // exactly the ACMS-side 10 courts
const GAP_CHECK_RUNNER_UP_COURTS = [...GAP_CHECK_SHARED_COURTS.slice(0, 9), 'S311']; // 9 shared + 1 different

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
// Environment loading
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} - run start-services.sh first, then create .env.local (see README.md).`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

loadEnv();

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

async function getAcmsSqlPool(database: string): Promise<mssql.ConnectionPool> {
  const server = process.env.ACMS_MSSQL_HOST;
  if (!server) throw new Error('ACMS_MSSQL_HOST is not set');

  const port = Number(process.env.ACMS_MSSQL_PORT) || 1433;
  const encrypt = process.env.ACMS_MSSQL_ENCRYPT?.toLowerCase() === 'true';
  const trustServerCertificate =
    process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true';
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
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required: [string, string][] = [
    ['MONGO_CONNECTION_STRING', 'MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos/Mongo database name'],
    ['ACMS_MSSQL_HOST', 'ACMS SQL Server host'],
  ];

  const optional: [string, string][] = [
    ['ACMS_MSSQL_DATABASE', 'ACMS database name (default: ACMS_INT)'],
    ['ACMS_MSSQL_USER', 'ACMS SQL user (omit for Azure AD auth)'],
    ['ACMS_MSSQL_PASS', 'ACMS SQL password'],
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
// seed-schema (create ACMS_INT database + apply CMMPR/CMMAP/CMMDB/CMMDO DDL)
// ---------------------------------------------------------------------------

async function seedSchema() {
  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
  console.log(`\nCreating ${acmsDatabase} database + applying schema...\n`);

  const masterPool = await getAcmsSqlPool('master');
  try {
    await masterPool
      .request()
      .query(
        `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${acmsDatabase}') CREATE DATABASE [${acmsDatabase}]`,
      );
    pass(`Database '${acmsDatabase}' ready`);
  } finally {
    await masterPool.close();
  }

  const pool = await getAcmsSqlPool(acmsDatabase);
  try {
    const schemaDir = path.join(HARNESS_DIR, 'database', 'schema');
    await executeSqlFile(pool, path.join(schemaDir, '00-schema.sql'));
    pass('00-schema.sql applied (CMMPR, CMMAP, CMMDB, CMMDO created)');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-sql (drop/recreate ACMS fixture rows — idempotent)
// ---------------------------------------------------------------------------

async function seedSql() {
  console.log('\nSeeding ACMS fixture rows...\n');

  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
  const pool = await getAcmsSqlPool(acmsDatabase);
  try {
    const fixturesDir = path.join(HARNESS_DIR, 'fixtures');
    await executeSqlFile(pool, path.join(fixturesDir, '01-seed-acms-scenarios.sql'));
    pass('01-seed-acms-scenarios.sql seeded (6 scenarios)');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos
// ---------------------------------------------------------------------------

type TrusteeAddressSpec = {
  address1: string;
  city: string;
  state: string;
  zipCode: string;
};

type TrusteeSpec = {
  trusteeId: string;
  firstName: string;
  lastName: string;
  address: TrusteeAddressSpec;
  phone?: string;
  seedPhoneticTokens: boolean; // false only for scenario 1, to prove Tier 2 misses it
};

async function seedCosmos() {
  console.log(
    '\nSeeding CAMS trustees, appointments, and the scenario-6 pre-existing mapping...\n',
  );

  const now = new Date().toISOString();
  const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
  const { client, db } = await getMongoDb();
  try {
    const trusteeSpecs: TrusteeSpec[] = [
      // Scenario 1: full corroboration, but NO phoneticTokens — simulates a trustee that was
      // never run through backfill-trustee-phonetic-tokens.ts. Tier 2's own $match pre-filter
      // (doc('phoneticTokens').contains(allTokens)) excludes it unconditionally, regardless of
      // score, while Tier 1 (a pure name+state regex query, independent of phoneticTokens)
      // still finds it — proving Tier 1's "free additive recall path" role in the design.
      {
        trusteeId: TRUSTEES.tier1Only,
        firstName: 'Robert',
        lastName: 'Ashworth-Quintela',
        address: {
          address1: '100 Ashworth Ln',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
        },
        phone: '217-555-0001',
        seedPhoneticTokens: false,
      },
      // Scenario 2: real (current) state 'NM', differing from ACMS's stale 'ZZ' — Tier 1's
      // exact-match query (which gates on state) fails; Tier 2 (name-only) still finds it.
      {
        trusteeId: TRUSTEES.tier2Only,
        firstName: 'Jonathan',
        lastName: 'Villareal',
        address: { address1: '200 Villareal Ave', city: 'Santa Fe', state: 'NM', zipCode: '87501' },
        phone: '505-555-0002',
        seedPhoneticTokens: true,
      },
      // Scenario 3: two trustees sharing the identical name+state+address+phone — isolates the
      // gap-check to the district-set dimension (see GAP_CHECK_*_COURTS above).
      {
        trusteeId: TRUSTEES.gapWinner,
        firstName: 'Delphine',
        lastName: 'Okonkwo-Reyes',
        address: { address1: '300 Okonkwo Way', city: 'Seattle', state: 'WA', zipCode: '98101' },
        phone: '206-555-0003',
        seedPhoneticTokens: true,
      },
      {
        trusteeId: TRUSTEES.gapRunnerUp,
        firstName: 'Delphine',
        lastName: 'Okonkwo-Reyes',
        address: { address1: '300 Okonkwo Way', city: 'Seattle', state: 'WA', zipCode: '98101' },
        phone: '206-555-0003',
        seedPhoneticTokens: true,
      },
      // Scenario 4: lone candidate below threshold — address deliberately mismatched, no phone
      // on file, no appointment history on either side.
      {
        trusteeId: TRUSTEES.belowThreshold,
        firstName: 'Simone',
        lastName: 'Okafor',
        address: {
          address1: '999 Somewhere Else Dr',
          city: 'Faraway',
          state: 'FA',
          zipCode: '99999',
        },
        seedPhoneticTokens: true,
      },
      // Scenario 5: full corroboration; currently-active trustee whose ACMS-side appointment
      // history (seeded in SQL) is entirely closed/pre-2018.
      {
        trusteeId: TRUSTEES.closedPre2018,
        firstName: 'Harriet',
        lastName: 'Kowalski',
        address: { address1: '500 Kowalski Blvd', city: 'Columbus', state: 'OH', zipCode: '43085' },
        phone: '614-555-0005',
        seedPhoneticTokens: true,
      },
      // Scenario 6: arbitrary data — the pre-existing mapping short-circuits scoring entirely.
      {
        trusteeId: TRUSTEES.alreadyMapped,
        firstName: 'Otis',
        lastName: 'Vance',
        address: { address1: '600 Vance Ct', city: 'Pittsburgh', state: 'PA', zipCode: '15201' },
        phone: '412-555-0006',
        seedPhoneticTokens: true,
      },
    ];

    for (const t of trusteeSpecs) {
      const name = `${t.firstName} ${t.lastName}`;
      await db.collection('trustees').replaceOne(
        { documentType: 'TRUSTEE', trusteeId: t.trusteeId },
        {
          documentType: 'TRUSTEE',
          trusteeId: t.trusteeId,
          name,
          firstName: t.firstName,
          lastName: t.lastName,
          public: {
            address: { ...t.address, countryCode: 'US' },
            ...(t.phone ? { phone: { number: t.phone } } : {}),
          },
          // Real production tokens, generated the same way the trustees repository does on
          // write (generateSearchTokens) — NOT a hand-rolled substitute — except scenario 1,
          // which deliberately omits this field (see the comment on its TrusteeSpec above).
          ...(t.seedPhoneticTokens ? { phoneticTokens: generateSearchTokens(name) } : {}),
          updatedOn: now,
          updatedBy: systemUser,
        },
        { upsert: true },
      );
    }
    pass(`Upserted ${trusteeSpecs.length} trustees`);

    // trustee-appointments: courtId/chapter sets driving the CAMS-side of each scoring
    // comparison. `status: 'active'` throughout — deliberately irrelevant, since
    // resolveAcmsProfessionalMatch/buildAcmsAppointmentSets apply NO active-only filtering (see
    // the converged design doc's "No active-only filtering" decision) — using a uniform status
    // here proves the harness isn't accidentally relying on status filtering to pass.
    type AppointmentSpec = { trusteeId: string; courtId: string; chapter: string };
    const appointments: AppointmentSpec[] = [
      { trusteeId: TRUSTEES.tier1Only, courtId: 'BT01', chapter: '7' },
      { trusteeId: TRUSTEES.tier2Only, courtId: 'BT02', chapter: '11' },
      // Scenario 3: winner gets exactly the ACMS-side 10 courts; runner-up gets 9 shared + 1
      // different (S311) — see GAP_CHECK_*_COURTS above for the exact court lists.
      ...GAP_CHECK_WINNER_COURTS.map((courtId) => ({
        trusteeId: TRUSTEES.gapWinner,
        courtId,
        chapter: '7',
      })),
      ...GAP_CHECK_RUNNER_UP_COURTS.map((courtId) => ({
        trusteeId: TRUSTEES.gapRunnerUp,
        courtId,
        chapter: '7',
      })),
      // Scenario 4: no appointments (none pushed here).
      // Scenario 5: matches what the closed pre-2018 ACMS rows would produce if correctly
      // included — court BT03/chapter 7 and court BT04/chapter 13.
      { trusteeId: TRUSTEES.closedPre2018, courtId: 'BT03', chapter: '7' },
      { trusteeId: TRUSTEES.closedPre2018, courtId: 'BT04', chapter: '13' },
    ];
    for (const [i, a] of appointments.entries()) {
      await db.collection('trustee-appointments').replaceOne(
        {
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: a.trusteeId,
          courtId: a.courtId,
          chapter: a.chapter,
        },
        {
          documentType: 'TRUSTEE_APPOINTMENT',
          id: `bkotp-appt-${i}`,
          trusteeId: a.trusteeId,
          chapter: a.chapter,
          appointmentType: 'panel',
          courtId: a.courtId,
          divisionCode: a.courtId,
          appointedDate: '2020-01-01',
          status: 'active',
          effectiveDate: '2020-01-01',
          updatedOn: now,
          updatedBy: systemUser,
          createdOn: now,
          createdBy: systemUser,
        },
        { upsert: true },
      );
    }
    pass(`Upserted ${appointments.length} TrusteeAppointments`);

    // Scenario 6: pre-existing mapping, seeded BEFORE the page runs — this is the idempotency
    // fixture. createProfessionalId's own idempotent check-then-insert means seeding this via a
    // direct Mongo write (rather than calling createProfessionalId itself) is representative —
    // the use case never distinguishes "how" an existing mapping got there.
    await db.collection('trustee-professional-ids').replaceOne(
      { camsTrusteeId: TRUSTEES.alreadyMapped, acmsProfessionalId: ACMS_IDS.alreadyMapped },
      {
        documentType: 'TRUSTEE_PROFESSIONAL_ID',
        camsTrusteeId: TRUSTEES.alreadyMapped,
        acmsProfessionalId: ACMS_IDS.alreadyMapped,
        updatedOn: now,
        updatedBy: systemUser,
      },
      { upsert: true },
    );
    pass('Upserted 1 pre-existing TrusteeProfessionalId mapping (scenario 6)');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up test data...\n');

  const acmsDatabase = process.env.ACMS_MSSQL_DATABASE || 'ACMS_INT';
  const pool = await getAcmsSqlPool(acmsDatabase);
  try {
    await pool.request().query(`
      DELETE FROM dbo.CMMAP WHERE GROUP_DESIGNATOR = 'BT';
      DELETE FROM dbo.CMMDB WHERE CASE_DIV IN (601, 602, 603, 604, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711);
      DELETE FROM dbo.CMMPR WHERE GROUP_DESIGNATOR = 'BT';
      DELETE FROM dbo.CMMDO WHERE CASE_DIV IN (601, 602, 603, 604, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710, 711);
    `);
    pass('Deleted ACMS fixture rows (CMMAP, CMMDB, CMMPR, CMMDO)');
  } finally {
    await pool.close();
  }

  const { client, db } = await getMongoDb();
  try {
    const r1 = await db
      .collection('trustee-professional-ids')
      .deleteMany({ camsTrusteeId: { $in: ALL_TRUSTEE_IDS } });
    pass(`Deleted ${r1.deletedCount} TrusteeProfessionalId mapping(s)`);

    const r2 = await db
      .collection('trustee-appointments')
      .deleteMany({ documentType: 'TRUSTEE_APPOINTMENT', trusteeId: { $in: ALL_TRUSTEE_IDS } });
    pass(`Deleted ${r2.deletedCount} TrusteeAppointment(s)`);

    const r3 = await db
      .collection('trustees')
      .deleteMany({ documentType: 'TRUSTEE', trusteeId: { $in: ALL_TRUSTEE_IDS } });
    pass(`Deleted ${r3.deletedCount} Trustee doc(s)`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('\nRunning full pipeline integration test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed ACMS fixture rows');
  await seedSql();
  console.log('');

  console.log('Step 2: Seed Cosmos fixtures (trustees, appointments, scenario-6 mapping)');
  await seedCosmos();
  console.log('');

  const context = await getAppContext();

  // ── Stage 1: Read path — getAllTrusteeProfessionalRecords (widened) ────────
  console.log('Stage 1: readAllAcmsProfessionalRecords() — getAllTrusteeProfessionalRecords\n');

  const readResult = await readAllAcmsProfessionalRecords(context);
  if (readResult.error || !readResult.data) {
    fail(`readAllAcmsProfessionalRecords failed: ${JSON.stringify(readResult.error)}`);
    console.log('\nAborting — cannot continue without the ACMS record set.');
    return;
  }
  const allRecords = readResult.data;
  const testRecords = allRecords.filter((r) =>
    (ALL_ACMS_IDS as string[]).includes(r.acmsProfessionalId),
  );
  if (testRecords.length === ALL_ACMS_IDS.length) {
    pass(`getAllTrusteeProfessionalRecords returned all ${testRecords.length} scenario records`);
  } else {
    fail(
      `expected ${ALL_ACMS_IDS.length} scenario records, got ${testRecords.length}: ${JSON.stringify(testRecords.map((r) => r.acmsProfessionalId))}`,
    );
  }

  const recordFor = (acmsProfessionalId: string): AcmsTrusteeProfessionalRecord => {
    const found = testRecords.find((r) => r.acmsProfessionalId === acmsProfessionalId);
    if (!found) throw new Error(`Fixture record ${acmsProfessionalId} not found in read results`);
    return found;
  };

  // Confirms the widened columns actually round-trip (CAMS-2-bko.1's scope) — not just that a
  // row came back. CMMPR's PROF_FIRST_NAME/PROF_LAST_NAME/PROF_CITY are fixed-width CHAR columns
  // in this schema, so SQL Server right-pads them with trailing spaces on read — the gateway
  // does not trim these (only zip/phone are numeric-normalized, and empty-vs-null string
  // normalization happens via normalizeAcmsString, which does not trim non-empty values). This
  // is harmless downstream (the use case's own getCandidateTrustees trims firstName/lastName/
  // state before building Tier 1/Tier 2 queries, and calculateNameScore's normalizeNamePart
  // strips all non-alphanumeric characters including trailing padding) — but this assertion
  // trims defensively so it isn't coupled to that padding behavior either way.
  const s1Record = recordFor(ACMS_IDS.tier1Only);
  if (
    s1Record.firstName.trim() === 'Robert' &&
    s1Record.lastName.trim() === 'Ashworth-Quintela' &&
    s1Record.city?.trim() === 'Springfield' &&
    s1Record.state === 'IL' &&
    s1Record.zip === '62701' &&
    s1Record.phone === '2175550001'
  ) {
    pass(
      'getAllTrusteeProfessionalRecords: widened columns (city/state/zip/phone) round-trip correctly',
    );
  } else {
    fail(
      `getAllTrusteeProfessionalRecords: unexpected widened fields: ${JSON.stringify(s1Record)}`,
    );
  }

  // ── Stage 2: getDivisionToCourtMap (new, live CMMDO join) ───────────────────
  console.log('\nStage 2: AcmsGateway.getDivisionToCourtMap() — live CMMDO join\n');

  const acmsGateway = factory.getAcmsGateway(context);
  const divisionToCourtMap = await acmsGateway.getDivisionToCourtMap(context);

  const expectedDivisionEntries: [string, string][] = [
    ['601', 'BT01'],
    ['602', 'BT02'],
    ['603', 'BT03'],
    ['604', 'BT04'],
    ['710', 'S310'],
    ['711', 'S311'],
  ];
  let divisionMapOk = true;
  for (const [div, courtId] of expectedDivisionEntries) {
    if (divisionToCourtMap.get(div) !== courtId) {
      divisionMapOk = false;
      fail(
        `getDivisionToCourtMap: expected ${div} -> ${courtId}, got ${divisionToCourtMap.get(div)}`,
      );
    }
  }
  if (divisionMapOk) {
    pass(
      `getDivisionToCourtMap: all ${expectedDivisionEntries.length} scenario CASE_DIV -> COURT_ID entries correct`,
    );
  }

  // ── Stage 3: processAcmsProfessionalRecordsPage — first pass ───────────────
  console.log('\nStage 3: processAcmsProfessionalRecordsPage() — first pass\n');

  const firstPassResult = await processAcmsProfessionalRecordsPage(
    context,
    testRecords,
    divisionToCourtMap,
  );
  if (firstPassResult.error || !firstPassResult.data) {
    fail(`processAcmsProfessionalRecordsPage failed: ${JSON.stringify(firstPassResult.error)}`);
    console.log('\nAborting — cannot continue without a page result.');
    return;
  }
  const { matched, unmatched, alreadyMapped } = firstPassResult.data;
  info(
    `First pass result: matched=${matched} unmatched=${unmatched} alreadyMapped=${alreadyMapped}`,
  );

  // Expected: scenarios 1, 2, 5 matched; 3, 4 unmatched; 6 alreadyMapped.
  if (matched === 3) {
    pass('matched === 3 (scenarios 1, 2, 5)');
  } else {
    fail(`expected matched === 3, got ${matched}`);
  }
  if (unmatched === 2) {
    pass('unmatched === 2 (scenarios 3, 4)');
  } else {
    fail(`expected unmatched === 2, got ${unmatched}`);
  }
  if (alreadyMapped === 1) {
    pass('alreadyMapped === 1 (scenario 6)');
  } else {
    fail(`expected alreadyMapped === 1, got ${alreadyMapped}`);
  }

  // ── Stage 4: Assert Mongo state after first pass ────────────────────────────
  console.log('\nStage 4: Asserting trustee-professional-ids state after first pass\n');

  const { client, db } = await getMongoDb();
  try {
    // 1. tier1-only: matched to bkotp-s1-correct.
    const mapping1 = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: ACMS_IDS.tier1Only });
    if (mapping1?.camsTrusteeId === TRUSTEES.tier1Only) {
      pass(
        '1. tier1-only: mapped to the correct trustee (found via Tier 1 despite no phoneticTokens)',
      );
    } else {
      fail(
        `1. tier1-only: expected camsTrusteeId ${TRUSTEES.tier1Only}, got: ${JSON.stringify(mapping1)}`,
      );
    }

    // Directly confirms Tier 2 alone would have missed it (isolates WHY it matched, not just
    // THAT it matched) — calls searchTrusteesByNameScored directly, independent of the use case.
    const trusteesRepo = factory.getTrusteesRepository(context);
    const tier2AloneResults = await trusteesRepo.searchTrusteesByNameScored(
      'Robert Ashworth-Quintela',
    );
    if (!tier2AloneResults.some((t) => t.trusteeId === TRUSTEES.tier1Only)) {
      pass(
        '1. tier1-only: confirmed Tier 2 alone (searchTrusteesByNameScored) does NOT surface this trustee',
      );
    } else {
      fail(
        '1. tier1-only: Tier 2 alone unexpectedly surfaced this trustee — scenario is not isolating Tier 1',
      );
    }

    // 2. tier2-only: matched to bkotp-s2-correct, despite ACMS's stale state.
    const mapping2 = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: ACMS_IDS.tier2Only });
    if (mapping2?.camsTrusteeId === TRUSTEES.tier2Only) {
      pass(
        '2. tier2-only: mapped to the correct trustee (found via Tier 2 despite Tier 1 state mismatch)',
      );
    } else {
      fail(
        `2. tier2-only: expected camsTrusteeId ${TRUSTEES.tier2Only}, got: ${JSON.stringify(mapping2)}`,
      );
    }

    const tier1AloneResult = await trusteesRepo.findTrusteeByNameAndState(
      'Jonathan',
      'Villareal',
      'ZZ',
    );
    if (tier1AloneResult === null) {
      pass(
        '2. tier2-only: confirmed Tier 1 alone (findTrusteeByNameAndState) does NOT surface this trustee',
      );
    } else {
      fail(
        '2. tier2-only: Tier 1 alone unexpectedly surfaced this trustee — scenario is not isolating Tier 2',
      );
    }

    // 3. gap-check: NEITHER candidate should have a mapping — both cleared the auto-match
    // threshold individually, but the gap check rejected the winner.
    const mapping3Winner = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: ACMS_IDS.gapCheck, camsTrusteeId: TRUSTEES.gapWinner });
    const mapping3RunnerUp = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: ACMS_IDS.gapCheck, camsTrusteeId: TRUSTEES.gapRunnerUp });
    if (!mapping3Winner && !mapping3RunnerUp) {
      pass(
        '3. gap-check: no mapping created for either candidate (gap < 5 despite both clearing threshold)',
      );
    } else {
      fail(
        `3. gap-check: expected no mapping for either candidate, got winner=${JSON.stringify(mapping3Winner)}, runnerUp=${JSON.stringify(mapping3RunnerUp)}`,
      );
    }

    // 4. below-threshold: no mapping AND no artifact of any kind — just absence.
    const mapping4 = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: ACMS_IDS.belowThreshold });
    if (!mapping4) {
      pass('4. below-threshold: no trustee-professional-ids document exists for this ACMS id');
    } else {
      fail(`4. below-threshold: expected no mapping, got: ${JSON.stringify(mapping4)}`);
    }
    // No JSONL/manual-review collection exists in this codebase for this backfill by design
    // (see the converged design doc's "no per-record artifact implying future action" —
    // logged and counted only) — there is deliberately nothing else to assert absence of.

    // 5. closed-pre-2018 (THE most important regression case): matched despite 100% closed
    // pre-2018 appointment history on the ACMS side.
    const mapping5 = await db
      .collection('trustee-professional-ids')
      .findOne({ acmsProfessionalId: ACMS_IDS.closedPre2018 });
    if (mapping5?.camsTrusteeId === TRUSTEES.closedPre2018) {
      pass(
        '5. closed-pre-2018: mapped to the active trustee — proves getCmmapAppointmentsForProfessionalIds genuinely dropped the open-case filter',
      );
    } else {
      fail(
        `5. closed-pre-2018: expected camsTrusteeId ${TRUSTEES.closedPre2018}, got: ${JSON.stringify(mapping5)}`,
      );
    }

    // 6. already-mapped: still exactly one mapping document, untouched.
    const mappings6 = await db
      .collection('trustee-professional-ids')
      .find({ acmsProfessionalId: ACMS_IDS.alreadyMapped })
      .toArray();
    if (mappings6.length === 1 && mappings6[0].camsTrusteeId === TRUSTEES.alreadyMapped) {
      pass('6. already-mapped: exactly one mapping document exists, unchanged');
    } else {
      fail(
        `6. already-mapped: expected exactly 1 mapping, got ${mappings6.length}: ${JSON.stringify(mappings6)}`,
      );
    }
  } finally {
    await client.close();
  }

  if (hasFailures) {
    console.log('\nSkipping idempotency (second pass) — earlier assertions failed.');
    return;
  }

  // ── Stage 5: idempotency — re-run the exact same page a second time ────────
  console.log('\nStage 5: processAcmsProfessionalRecordsPage() — second pass (idempotency)\n');

  const secondPassResult = await processAcmsProfessionalRecordsPage(
    context,
    testRecords,
    divisionToCourtMap,
  );
  if (secondPassResult.error || !secondPassResult.data) {
    fail(`second pass failed: ${JSON.stringify(secondPassResult.error)}`);
    return;
  }
  const second = secondPassResult.data;
  info(
    `Second pass result: matched=${second.matched} unmatched=${second.unmatched} alreadyMapped=${second.alreadyMapped}`,
  );

  // Second pass: scenarios 1, 2, 5 are now already-mapped (from the first pass); 3 and 4 are
  // re-scored and land unmatched again (nothing persists a negative result); 6 was already
  // alreadyMapped in pass 1 and remains so.
  if (second.matched === 0) {
    pass(
      'idempotency: second pass matched === 0 (1/2/5 already mapped, nothing left to newly match)',
    );
  } else {
    fail(`idempotency: expected second pass matched === 0, got ${second.matched}`);
  }
  if (second.unmatched === 2) {
    pass('idempotency: second pass unmatched === 2 (3/4 re-scored identically, still unmatched)');
  } else {
    fail(`idempotency: expected second pass unmatched === 2, got ${second.unmatched}`);
  }
  if (second.alreadyMapped === 4) {
    pass('idempotency: second pass alreadyMapped === 4 (1, 2, 5 from pass 1, plus 6)');
  } else {
    fail(`idempotency: expected second pass alreadyMapped === 4, got ${second.alreadyMapped}`);
  }

  const { client: client2, db: db2 } = await getMongoDb();
  try {
    for (const acmsId of [
      ACMS_IDS.tier1Only,
      ACMS_IDS.tier2Only,
      ACMS_IDS.closedPre2018,
      ACMS_IDS.alreadyMapped,
    ]) {
      const count = await db2
        .collection('trustee-professional-ids')
        .countDocuments({ acmsProfessionalId: acmsId });
      if (count === 1) {
        pass(
          `idempotency: exactly 1 mapping document for ${acmsId} after two passes (no duplicate write)`,
        );
      } else {
        fail(`idempotency: expected exactly 1 mapping document for ${acmsId}, got ${count}`);
      }
    }
  } finally {
    await client2.close();
  }

  console.log(hasFailures ? '\n✗ SOME ASSERTIONS FAILED\n' : '\n✓ ALL ASSERTIONS PASSED\n');
}

// ---------------------------------------------------------------------------
// Command dispatch
// ---------------------------------------------------------------------------

const command = process.argv[2];

async function main() {
  switch (command) {
    case 'check-env':
      return checkEnv();
    case 'seed-schema':
      return seedSchema();
    case 'seed-sql':
      return seedSql();
    case 'seed-cosmos':
      return seedCosmos();
    case 'run':
      return run();
    case 'clean':
      return clean();
    case 'help':
    default:
      console.log(
        'Usage: backfill-trustee-professional-ids-harness.ts <check-env|seed-schema|seed-sql|seed-cosmos|run|clean|help>',
      );
  }
}

main()
  .then(() => {
    if (hasFailures) process.exitCode = 1;
  })
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
