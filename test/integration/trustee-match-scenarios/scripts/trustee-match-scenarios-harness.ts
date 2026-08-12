/**
 * Integration test harness: trustee matching algorithm correctness (CAMS-809).
 *
 * Exercises `SyncTrusteeCaseAppointmentsUseCase` (backend/lib/use-cases/dataflows/
 * sync-trustee-case-appointments.ts) directly against a real DXTR SQL Server instance
 * (mimicked locally with SQL Edge) — same pattern as ../trustee-petition-match — with thirteen
 * fixture cases, each exercising one distinct outcome branch of the matching algorithm
 * (trustee-match.helpers.ts + processAppointments's decision tree):
 *
 *   1.  reserved-id-skip             - reserved acmsProfessionalId, no matching attempted
 *   2.  perfect-match-professional-id - professional-id fast path, active appointment match
 *   3.  perfect-match-by-name         - name fast path, active appointment match
 *   4.  perfect-match-inactive-status - resolves uniquely, but matching appointment is inactive
 *   5.  imperfect-match               - resolves uniquely, zero appointments at all
 *   6.  no-match                     - name matches no CAMS trustee
 *   7.  multiple-match-high-confidence - ambiguous name, fuzzy scoring picks a clear winner
 *   8.  multiple-match-no-winner      - ambiguous name, fuzzy scoring ties (no clear winner)
 *   9.  case-not-yet-synced          - resolves fine, but no SYNCED_CASE doc exists yet
 *   10. case-moved                   - resolves fine, but the case was moved (skipped)
 *   11. re-verification              - a second sync of an already-resolved case
 *   12. fingerprint-repeat (Slice 5)  - byte-identical repeat of #2's trustee auto-links via the
 *                                       TRUSTEE_VARIATION bucket, bypassing matchTrusteeByName
 *   13. fingerprint-no-false-collapse (Slice 5) - a genuinely different person sharing #2's
 *                                       ambiguous name does NOT false-collapse to #2's trustee
 *
 * Scenarios 12-13 exercise the CAMS-809 Slice 5 fingerprint/variant memoization mechanism
 * (backend/lib/use-cases/dataflows/trustee-variant.helpers.ts, TRUSTEE_VARIATION) layered on
 * top of the same algorithm scenarios 1-11 cover. They run in a separate processAppointments()
 * call AFTER the main first pass, so scenario 2's TRUSTEE_VARIATION write (which only happens
 * once scenario 2 itself resolves) is guaranteed to exist before scenario 12/13's events are
 * read — sidestepping the DXTR query's TX_DATE DESC ordering entirely rather than relying on
 * intra-batch processing order.
 *
 * Two further stages, independent of the 13 DXTR-driven scenarios above, guard regressions real
 * Cosmos can catch but a fully-mocked unit test cannot:
 *
 *   Stage 5 (sort/index) - getActiveByCaseId (trustee-case-appointments.mongo.repository.ts)
 *     sorts by assignedOn ASCENDING and relies on the {caseId:1, assignedOn:1} compound index
 *     declared in cosmos-collections.bicep for case-trustee-appointments. Seeds two active
 *     appointments for one case with different assignedOn values and asserts the real
 *     repository returns the OLDEST one — the class of bug (Cosmos index-policy enforcement)
 *     that only a real Cosmos instance can catch (see
 *     trustee-match-verification-search/scripts/run-tests.ts's Test 1 for the same pattern
 *     applied to a different collection/index).
 *
 *   Stage 6 (stable-assignedOn idempotency) - applyResolvedTrustee/writeSurrogateAppointment
 *     derive assignedOn from event.appointedDate (not wall-clock time) specifically so upsert's
 *     natural key (documentType + caseId + trusteeId + assignedOn) stays stable across repeated
 *     processing of the same event. Reprocesses one identical fixture event twice through the
 *     real SyncTrusteeCaseAppointmentsUseCase.processAppointments() and asserts exactly one
 *     case-trustee-appointments document exists afterward — proof against a real replaceOne
 *     upsert, which a mocked repository's recorded call args cannot provide.
 *
 * This is a one-shot script - NOT a Vitest test.
 *
 * Two environments via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh, pointed at directly
 *                       via COSMOS_DATABASE_NAME from .env.local. Plain MongoDB has no concept
 *                       of Cosmos's index-policy enforcement, so this mode validates query LOGIC
 *                       only — it cannot catch the indexing-policy bug Stage 5 exists for.
 *   azure            — a real, EPHEMERAL Cosmos DB Mongo API database (a new database name
 *                       within the same Cosmos account backend/.env's MONGO_CONNECTION_STRING
 *                       already points to), stood up fresh per run by
 *                       ../../_lib/ephemeral-cosmos-database.ts and torn down the same way
 *                       (try/finally — never leaked on a failed run). Never the persistent
 *                       shared database backend/.env's COSMOS_DATABASE_NAME otherwise points at.
 *                       Only this mode can catch the Stage 5 indexing bug, because only the real
 *                       Cosmos RU engine enforces index-policy restrictions. See
 *                       test/integration/README.md (_lib section) for why this uses the Mongo
 *                       driver rather than the Azure `az` CLI.
 *
 * Usage (from test/integration/):
 *   npm run trustee-match-scenarios -- [command]
 *
 * Local workflow:
 *   1. cd trustee-match-scenarios/scripts && ./start-services.sh
 *   2. npm run trustee-match-scenarios -- seed-schema
 *   3. npm run trustee-match-scenarios -- seed-sql
 *   4. npm run trustee-match-scenarios -- seed-cosmos
 *   5. npm run trustee-match-scenarios -- run
 *   6. npm run trustee-match-scenarios -- clean
 *   7. cd trustee-match-scenarios/scripts && ./stop-services.sh
 *
 * Azure workflow (manual only — not wired into CI):
 *   Requires MONGO_CONNECTION_STRING in the environment (e.g. sourced from backend/.env).
 *   `run` provisions/tears down its own ephemeral database — no COSMOS_DATABASE_NAME setup
 *   needed beforehand:
 *     INTEGRATION_ENV=azure npm run trustee-match-scenarios -- run
 *
 * Commands:
 *   check-env     Verify required environment variables are set
 *   seed-schema   [local] Create DXTR_INT database + apply AO_* DDL
 *   seed-sql      Drop/recreate DXTR fixture rows (idempotent)
 *   seed-cosmos   Seed synced cases, trustees, appointments, professional ids
 *   run           Full test: clean → seed → read DXTR → process (multiple passes) → assert
 *   clean         Remove test documents/rows from both databases
 *   help          Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import * as mssql from 'mssql';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import SyncTrusteeCaseAppointmentsUseCase from '../../../../backend/lib/use-cases/dataflows/sync-trustee-case-appointments';
import { TrusteeCaseAppointmentsMongoRepository } from '../../../../backend/lib/adapters/gateways/mongo/trustee-case-appointments.mongo.repository';
import {
  buildVariant,
  computeFingerprint,
} from '../../../../backend/lib/use-cases/dataflows/trustee-variant.helpers';
import { TrusteeAppointmentSyncEvent } from '../../../../common/src/cams/dataflow-events';
import {
  standUpEphemeralCosmosDatabase,
  tearDownEphemeralCosmosDatabase,
} from '../../_lib/ephemeral-cosmos-database';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

// The one collection this harness needs an index pre-created on before seeding — see Stage 5
// below and cosmos-collections.bicep's case-trustee-appointments compound index comment. Every
// other collection this harness seeds (cases, trustees, trustee-professional-ids,
// trustee-appointments, trustee-case-appointments, trustee-match-verification, trustee-variation,
// runtime-state) is queried in this harness only by equality/findOne, which Mongo/Cosmos can
// satisfy without a declared index — so standUpEphemeralCosmosDatabase (which materializes a
// database by creating exactly one collection's index) is only called for this one.
const INDEXED_COLLECTION = 'case-trustee-appointments';
const INDEXED_COLLECTION_KEY = { caseId: 1 as const, assignedOn: 1 as const };

// Set once run() provisions an ephemeral database in azure mode, so clean-up (finally block) can
// tear down the exact same database — never derived twice, which could tear down the wrong name.
let ephemeralDatabaseName: string | null = null;

// ---------------------------------------------------------------------------
// Test fixtures - see seed/01-seed-dxtr-data.sql for the matching DXTR rows
// ---------------------------------------------------------------------------

const COURT_ID = '0210';
const DIV = '083'; // all scenarios except reserved-id-skip
const CHAPTER = '7';

const CASES = {
  reservedIdSkip: { caseId: '084-26-88900' },
  perfectMatchProfessionalId: { caseId: '083-26-88901' },
  perfectMatchByName: { caseId: '083-26-88902' },
  perfectMatchInactiveStatus: { caseId: '083-26-88903' },
  imperfectMatch: { caseId: '083-26-88904' },
  noMatch: { caseId: '083-26-88905' },
  multipleMatchHighConfidence: { caseId: '083-26-88906' },
  multipleMatchNoWinner: { caseId: '083-26-88907' },
  caseNotYetSynced: { caseId: '083-26-88908' },
  caseMoved: { caseId: '083-26-88909' },
  reVerification: { caseId: '083-26-88910' },
  fingerprintRepeat: { caseId: '083-26-88911' },
  fingerprintNoFalseCollapse: { caseId: '083-26-88912' },
} as const;
const ALL_CASE_IDS = Object.values(CASES).map((c) => c.caseId);

const TRUSTEES = {
  perfectPid: { id: 'ms-trustee-perfect-pid', name: 'Perfect M ProfessionalId' },
  // Shares perfectPid's exact name — used only by scenarios 12/13. Harmless to scenario 2
  // itself, since scenario 2 resolves via the professional-id fast path, never via
  // matchTrusteeByName, so the ambiguity is never in play for scenario 2's own outcome.
  perfectPidDecoy: { id: 'ms-trustee-perfect-pid-decoy', name: 'Perfect M ProfessionalId' },
  perfectName: { id: 'ms-trustee-perfect-name', name: 'Perfect N ByName' },
  inactiveStatus: { id: 'ms-trustee-inactive-status', name: 'Inactive S StatusTrustee' },
  imperfect: { id: 'ms-trustee-imperfect', name: 'Imperfect M MatchTrustee' },
  ambiguousWinnerReal: { id: 'ms-trustee-amb-winner-real', name: 'Ambiguous H Winner' },
  ambiguousWinnerDecoy: { id: 'ms-trustee-amb-winner-decoy', name: 'Ambiguous H Winner' },
  ambiguousTie1: { id: 'ms-trustee-amb-tie-1', name: 'Ambiguous T Tie' },
  ambiguousTie2: { id: 'ms-trustee-amb-tie-2', name: 'Ambiguous T Tie' },
  notYetSynced: { id: 'ms-trustee-not-yet-synced', name: 'NotYet S Synced' },
  caseMoved: { id: 'ms-trustee-case-moved', name: 'Case H Moved' },
  reVerification: { id: 'ms-trustee-reverify', name: 'Reverify M Trustee' },
} as const;
const ALL_TRUSTEE_IDS = Object.values(TRUSTEES).map((t) => t.id);

const RESERVED_PROFESSIONAL_ID = 'XX-99999';
const PID_PERFECT = 'MS-00001';
const PID_INACTIVE = 'MS-00002';
const PID_IMPERFECT = 'MS-00003';
const PID_NOT_YET_SYNCED = 'MS-00004';
const PID_CASE_MOVED = 'MS-00005';
const PID_REVERIFICATION = 'MS-00006';

// ---------------------------------------------------------------------------
// Stage 5/6 fixtures — direct Cosmos proofs, no DXTR round trip. Distinct caseIds from the
// 13 DXTR-driven scenarios above so clean()'s ALL_CASE_IDS filter and the DXTR seed script
// never need to know about them.
// ---------------------------------------------------------------------------

// Stage 5: two active appointments seeded directly for the same case, different assignedOn.
const SORT_INDEX_CASE_ID = '083-26-88920';
const SORT_INDEX_TRUSTEE_OLDER = 'ms-trustee-sort-index-older';
const SORT_INDEX_TRUSTEE_NEWER = 'ms-trustee-sort-index-newer';
const SORT_INDEX_ASSIGNED_ON_OLDER = '2020-01-01T00:00:00.000Z';
const SORT_INDEX_ASSIGNED_ON_NEWER = '2024-06-01T00:00:00.000Z';

// Stage 6: one case, one synthetic event (no DXTR row needed — TrusteeAppointmentSyncEvent is
// fully constructible in-harness), processed twice to prove the real repository's upsert
// natural key holds across reprocessing.
const IDEMPOTENCY_CASE_ID = '083-26-88921';
const IDEMPOTENCY_TRUSTEE = { id: 'ms-trustee-idempotency', name: 'Idempotency P Trustee' };
const IDEMPOTENCY_PID = 'MS-00007';
const IDEMPOTENCY_APPOINTED_DATE = '2026-01-14';

const STAGE_5_6_CASE_IDS = [SORT_INDEX_CASE_ID, IDEMPOTENCY_CASE_ID];
const STAGE_5_6_TRUSTEE_IDS = [
  SORT_INDEX_TRUSTEE_OLDER,
  SORT_INDEX_TRUSTEE_NEWER,
  IDEMPOTENCY_TRUSTEE.id,
];

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

function loadEnv() {
  if (IS_LOCAL) {
    const localEnvPath = path.join(HARNESS_DIR, '.env.local');
    if (!fs.existsSync(localEnvPath)) {
      console.error(
        `Missing ${localEnvPath} - run start-services.sh first, then create .env.local (see README.md).`,
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
// Ephemeral Cosmos database (azure mode only)
// ---------------------------------------------------------------------------

/**
 * Provisions a fresh, disposable Cosmos DB Mongo API database for this run and points
 * COSMOS_DATABASE_NAME at it — azure mode only. Never touches the shared/persistent database
 * backend/.env's COSMOS_DATABASE_NAME otherwise names. Only the `case-trustee-appointments`
 * collection gets its index pre-created here (see INDEXED_COLLECTION/INDEXED_COLLECTION_KEY) —
 * every other collection this harness seeds is materialized implicitly by seedCosmos()'s own
 * inserts, since none of their queries in this harness depend on a declared index. Must be
 * paired with tearDownEphemeralDatabase in a finally block so a failed run never leaks the
 * ephemeral database.
 */
async function standUpEphemeralDatabase(): Promise<void> {
  if (IS_LOCAL) return;
  ephemeralDatabaseName = `trustee-match-scenarios-idxtest-${randomUUID()}`;
  process.env.COSMOS_DATABASE_NAME = ephemeralDatabaseName;
  info(`Provisioning ephemeral Cosmos database '${ephemeralDatabaseName}'...`);
  await standUpEphemeralCosmosDatabase(
    ephemeralDatabaseName,
    INDEXED_COLLECTION,
    INDEXED_COLLECTION_KEY,
  );
}

/** Inverse of standUpEphemeralDatabase — azure mode only, no-op if nothing was provisioned. */
async function tearDownEphemeralDatabase(): Promise<void> {
  if (IS_LOCAL || !ephemeralDatabaseName) return;
  info(`Tearing down ephemeral Cosmos database '${ephemeralDatabaseName}'...`);
  await tearDownEphemeralCosmosDatabase(ephemeralDatabaseName);
  ephemeralDatabaseName = null;
}

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
  // AO_OFFICE/AO_COURT/AO_GRP_DES/AO_REGION, which aren't part of the DXTR schema this
  // harness seeds (only AO_CS_DIV/AO_CS/AO_PY/AO_TX).
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
    pass('01-seed-dxtr-data.sql seeded (13 scenario cases)');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos
// ---------------------------------------------------------------------------

async function seedCosmos() {
  console.log(
    '\nSeeding synced cases, trustees, appointments, and professional ids into Cosmos...\n',
  );

  const now = new Date().toISOString();
  const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
  const { client, db } = await getMongoDb();
  try {
    // Synced cases — all except caseNotYetSynced (deliberately not seeded).
    const syncedCaseIds = ALL_CASE_IDS.filter((id) => id !== CASES.caseNotYetSynced.caseId);
    for (const [i, caseId] of syncedCaseIds.entries()) {
      const isMoved = caseId === CASES.caseMoved.caseId;
      await db.collection('cases').replaceOne(
        { documentType: 'SYNCED_CASE', caseId },
        {
          documentType: 'SYNCED_CASE',
          caseId,
          dxtrId: caseId,
          courtId: COURT_ID,
          courtName: 'Integration Test Court',
          courtDivisionCode: caseId.startsWith('084-') ? '084' : DIV,
          courtDivisionName: 'Matching Scenarios Division',
          officeCode: '1',
          officeName: 'Matching Scenarios Division',
          groupDesignator: caseId.startsWith('084-') ? 'XX' : 'MS',
          regionId: '02',
          regionName: 'Region 2',
          chapter: CHAPTER,
          caseTitle: `Scenario Debtor ${i + 1}`,
          dateFiled: '2026-01-01',
          debtor: { name: `Scenario Debtor ${i + 1}` },
          ...(isMoved ? { movedToCaseId: '083-26-99999' } : {}),
          updatedOn: now,
          updatedBy: systemUser,
        },
        { upsert: true },
      );
    }
    pass(
      `Upserted ${syncedCaseIds.length} synced cases (case-not-yet-synced deliberately omitted)`,
    );

    // Trustees
    const trusteeDocs: Array<{
      id: string;
      name: string;
      address: { address1: string; city: string; state: string; zipCode: string };
      phone?: string;
      email?: string;
    }> = [
      {
        id: TRUSTEES.perfectPid.id,
        name: TRUSTEES.perfectPid.name,
        address: {
          address1: '1 Perfect Pid Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0001',
        email: 'perfect.pid@example.com',
      },
      {
        // Slice 5 (scenarios 12/13): shares perfectPid's exact name so matchTrusteeByName
        // alone would be ambiguous between them. Demographics match scenario 13's DXTR data,
        // not scenario 2/12's, so the untouched fuzzy-scoring pipeline should resolve scenario
        // 13 here (not to perfectPid) once the fingerprint bucket misses.
        id: TRUSTEES.perfectPidDecoy.id,
        name: TRUSTEES.perfectPidDecoy.name,
        address: {
          address1: '999 Decoy Fingerprint Ave',
          city: 'Faraway',
          state: 'FA',
          zipCode: '99999',
        },
        phone: '555-999-0000',
        email: 'decoy.fingerprint@example.com',
      },
      {
        id: TRUSTEES.perfectName.id,
        name: TRUSTEES.perfectName.name,
        address: {
          address1: '2 Perfect Name Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0002',
        email: 'perfect.byname@example.com',
      },
      {
        id: TRUSTEES.inactiveStatus.id,
        name: TRUSTEES.inactiveStatus.name,
        address: {
          address1: '3 Inactive Status Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0003',
        email: 'inactive.status@example.com',
      },
      {
        id: TRUSTEES.imperfect.id,
        name: TRUSTEES.imperfect.name,
        // Deliberately mismatched vs. DXTR's "4 Imperfect Rd, Nowhere ZZ 00000" -> addressScore 0
        address: {
          address1: '999 Somewhere Else Ave',
          city: 'Faraway',
          state: 'FA',
          zipCode: '99999',
        },
        phone: '555-100-0004',
        email: 'imperfect.match@example.com',
      },
      {
        id: TRUSTEES.ambiguousWinnerReal.id,
        name: TRUSTEES.ambiguousWinnerReal.name,
        address: {
          address1: '7 Real Winner Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0007',
        email: 'amb.winner.real@example.com',
      },
      {
        id: TRUSTEES.ambiguousWinnerDecoy.id,
        name: TRUSTEES.ambiguousWinnerDecoy.name,
        // Mismatched demographics and (below) no appointment at all -> loses the fuzzy match.
        address: {
          address1: '77 Decoy Ave',
          city: 'Faraway',
          state: 'FA',
          zipCode: '99999',
        },
      },
      {
        id: TRUSTEES.ambiguousTie1.id,
        name: TRUSTEES.ambiguousTie1.name,
        // Both tie trustees: no address/phone/email match, both get an identical active
        // appointment below -> identical totalScore -> genuine tie, no clear winner.
        address: { address1: '1 Tie Ave', city: 'Faraway', state: 'FA', zipCode: '99999' },
      },
      {
        id: TRUSTEES.ambiguousTie2.id,
        name: TRUSTEES.ambiguousTie2.name,
        address: { address1: '2 Tie Ave', city: 'Faraway', state: 'FA', zipCode: '99999' },
      },
      {
        id: TRUSTEES.notYetSynced.id,
        name: TRUSTEES.notYetSynced.name,
        address: {
          address1: '9 Not Yet Synced Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0009',
        email: 'notyet.synced@example.com',
      },
      {
        id: TRUSTEES.caseMoved.id,
        name: TRUSTEES.caseMoved.name,
        address: {
          address1: '10 Moved Case Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0010',
        email: 'case.moved@example.com',
      },
      {
        id: TRUSTEES.reVerification.id,
        name: TRUSTEES.reVerification.name,
        address: {
          address1: '11 Reverify Rd',
          city: 'Scenario City',
          state: 'SC',
          zipCode: '11111',
        },
        phone: '555-100-0011',
        email: 'reverify.trustee@example.com',
      },
    ];

    for (const t of trusteeDocs) {
      const [firstName, middleName, ...lastRest] = t.name.split(' ');
      await db.collection('trustees').replaceOne(
        { documentType: 'TRUSTEE', trusteeId: t.id },
        {
          documentType: 'TRUSTEE',
          trusteeId: t.id,
          name: t.name,
          firstName,
          middleName,
          lastName: lastRest.join(' '),
          public: {
            address: { ...t.address, countryCode: 'US' },
            ...(t.phone ? { phone: { number: t.phone } } : {}),
            ...(t.email ? { email: t.email } : {}),
          },
          updatedOn: now,
          updatedBy: systemUser,
        },
        { upsert: true },
      );
    }
    pass(`Upserted ${trusteeDocs.length} trustees`);

    // Professional id mappings
    const professionalIds: Array<[string, string]> = [
      [PID_PERFECT, TRUSTEES.perfectPid.id],
      [PID_INACTIVE, TRUSTEES.inactiveStatus.id],
      [PID_IMPERFECT, TRUSTEES.imperfect.id],
      [PID_NOT_YET_SYNCED, TRUSTEES.notYetSynced.id],
      [PID_CASE_MOVED, TRUSTEES.caseMoved.id],
      [PID_REVERIFICATION, TRUSTEES.reVerification.id],
    ];
    for (const [acmsProfessionalId, camsTrusteeId] of professionalIds) {
      await db.collection('trustee-professional-ids').replaceOne(
        { acmsProfessionalId, camsTrusteeId },
        {
          documentType: 'TRUSTEE_PROFESSIONAL_ID',
          camsTrusteeId,
          acmsProfessionalId,
          updatedOn: now,
          updatedBy: systemUser,
        },
        { upsert: true },
      );
    }
    pass(`Upserted ${professionalIds.length} TrusteeProfessionalId mappings`);

    // Appointments
    type AppointmentSpec = {
      trusteeId: string;
      courtId: string;
      divisionCode: string;
      chapter: string;
      status: 'active' | 'voluntarily-suspended';
    };
    const appointments: AppointmentSpec[] = [
      {
        trusteeId: TRUSTEES.perfectPid.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      // Slice 5 (scenarios 12/13): same court/div/chapter as perfectPid, so scenario 13's
      // fuzzy-match district/chapter scores tie between the two candidates, isolating the
      // winner to address/name/phone/email — where the decoy's data (matching scenario 13)
      // clearly wins.
      {
        trusteeId: TRUSTEES.perfectPidDecoy.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      {
        trusteeId: TRUSTEES.perfectName.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      // Inactive-status scenario: only a non-active appointment in this exact court/div/chapter.
      {
        trusteeId: TRUSTEES.inactiveStatus.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'voluntarily-suspended',
      },
      // imperfect: zero appointments (none seeded).
      {
        trusteeId: TRUSTEES.ambiguousWinnerReal.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      // ambiguousWinnerDecoy: zero appointments (none seeded) -> loses on district/chapter too.
      {
        trusteeId: TRUSTEES.ambiguousTie1.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      {
        trusteeId: TRUSTEES.ambiguousTie2.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      {
        trusteeId: TRUSTEES.notYetSynced.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      {
        trusteeId: TRUSTEES.caseMoved.id,
        courtId: COURT_ID,
        divisionCode: DIV,
        chapter: CHAPTER,
        status: 'active',
      },
      // reVerification: zero appointments (none seeded) -> imperfect match on first pass.
    ];
    for (const a of appointments) {
      await db.collection('trustee-appointments').replaceOne(
        { documentType: 'TRUSTEE_APPOINTMENT', trusteeId: a.trusteeId, courtId: a.courtId },
        {
          documentType: 'TRUSTEE_APPOINTMENT',
          trusteeId: a.trusteeId,
          chapter: a.chapter,
          appointmentType: 'panel',
          courtId: a.courtId,
          divisionCode: a.divisionCode,
          appointedDate: '2020-01-01',
          status: a.status,
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
      DELETE FROM dbo.AO_TX WHERE CS_CASEID BETWEEN '999999400' AND '999999412' AND COURT_ID = '${COURT_ID}';
      DELETE FROM dbo.AO_PY WHERE CS_CASEID BETWEEN '999999400' AND '999999412' AND COURT_ID = '${COURT_ID}';
      DELETE FROM dbo.AO_CS WHERE CS_CASEID BETWEEN '999999400' AND '999999412' AND COURT_ID = '${COURT_ID}';
      DELETE FROM dbo.AO_CS_DIV WHERE (CS_DIV = '083' AND GRP_DES = 'MS') OR (CS_DIV = '084' AND GRP_DES = 'XX');
    `);
    pass('Deleted DXTR fixture rows for cases 999999400-999999412');
  } finally {
    await pool.close();
  }

  // Stage 5/6 fixtures are seeded directly into Cosmos (no DXTR row), so their case/trustee ids
  // are tracked separately from ALL_CASE_IDS/ALL_TRUSTEE_IDS — see the STAGE_5_6_* constants'
  // own comment for why they aren't folded into those arrays.
  const allCaseIds = [...ALL_CASE_IDS, ...STAGE_5_6_CASE_IDS];
  const allTrusteeIds = [...ALL_TRUSTEE_IDS, ...STAGE_5_6_TRUSTEE_IDS];

  const { client, db } = await getMongoDb();
  try {
    const r1a = await db
      .collection('case-trustee-appointments')
      .deleteMany({ documentType: 'CASE_APPOINTMENT', caseId: { $in: allCaseIds } });
    const r1b = await db
      .collection('trustee-case-appointments')
      .deleteMany({ documentType: 'CASE_APPOINTMENT', caseId: { $in: allCaseIds } });
    pass(`Deleted ${r1a.deletedCount + r1b.deletedCount} CASE_APPOINTMENT(s)`);

    const r2 = await db
      .collection('trustee-match-verification')
      .deleteMany({ caseId: { $in: allCaseIds } });
    pass(`Deleted ${r2.deletedCount} trustee-match-verification doc(s)`);

    const rVariation = await db
      .collection('trustee-variation')
      .deleteMany({ documentType: 'TRUSTEE_VARIATION', trusteeId: { $in: allTrusteeIds } });
    pass(`Deleted ${rVariation.deletedCount} TRUSTEE_VARIATION doc(s)`);

    const r3 = await db
      .collection('trustee-appointments')
      .deleteMany({ documentType: 'TRUSTEE_APPOINTMENT', trusteeId: { $in: allTrusteeIds } });
    pass(`Deleted ${r3.deletedCount} TrusteeAppointment(s)`);

    const r4 = await db.collection('trustee-professional-ids').deleteMany({
      camsTrusteeId: { $in: allTrusteeIds },
    });
    pass(`Deleted ${r4.deletedCount} TrusteeProfessionalId(s)`);

    const r5 = await db
      .collection('trustees')
      .deleteMany({ documentType: 'TRUSTEE', trusteeId: { $in: allTrusteeIds } });
    pass(`Deleted ${r5.deletedCount} Trustee doc(s)`);

    const r6 = await db
      .collection('cases')
      .deleteMany({ documentType: 'SYNCED_CASE', caseId: { $in: allCaseIds } });
    pass(`Deleted ${r6.deletedCount} synced case doc(s)`);

    // Dataflow-wide singleton watermarks (documentType only, no caseId) — no case-scoped
    // filter possible here. This harness must only be run against an isolated local/test
    // Cosmos database (see README).
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

/**
 * Entry point for the `run` command. In azure mode, provisions a disposable Cosmos database
 * before runScenarios() and tears it down afterward — success or failure — so a failed run never
 * leaks the ephemeral database. Local mode is unchanged: runScenarios() runs directly against
 * whatever COSMOS_DATABASE_NAME .env.local names.
 */
async function run(): Promise<void> {
  await standUpEphemeralDatabase();
  try {
    await runScenarios();
  } finally {
    await tearDownEphemeralDatabase();
  }
}

async function runScenarios() {
  console.log('\nRunning full pipeline integration test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed DXTR fixture rows');
  await seedSql();
  console.log('');

  console.log(
    'Step 2: Seed Cosmos fixtures (synced cases, trustees, appointments, professional ids)',
  );
  await seedCosmos();
  console.log('');

  // ── Stage 1: Read path ────────────────────────────────────────────────────
  console.log('Stage 1: SyncTrusteeCaseAppointmentsUseCase.getAppointmentEvents()');

  const context = await getAppContext();
  const deps = SyncTrusteeCaseAppointmentsUseCase.createDeps(context);

  const { events } = await SyncTrusteeCaseAppointmentsUseCase.getAppointmentEvents(
    deps,
    undefined,
    true,
  );
  const testEvents = events.filter((e) => (ALL_CASE_IDS as string[]).includes(e.caseId));

  if (testEvents.length === ALL_CASE_IDS.length) {
    pass(`getAppointmentEvents returned ${testEvents.length} events`);
  } else {
    fail(`expected ${ALL_CASE_IDS.length} events, got ${testEvents.length}`);
    return;
  }

  const eventFor = (caseId: string) => testEvents.find((e) => e.caseId === caseId);

  // ── Stage 2: Match + write path (first pass) ──────────────────────────────
  console.log('\nStage 2: SyncTrusteeCaseAppointmentsUseCase.processAppointments() — first pass\n');

  // Reserve the re-verification case (Stage 4) and the Slice 5 fingerprint cases (Stage 3.5)
  // for their own later passes, so their outcomes don't affect scenarioDistribution
  // assertions below. Scenarios 12/13 specifically MUST run after this pass completes:
  // scenario 2's TRUSTEE_VARIATION is only written once scenario 2 itself resolves, and
  // running 12/13 in a separate later call (rather than relying on same-batch ordering)
  // sidesteps the DXTR query's TX_DATE DESC ordering entirely.
  const deferredCaseIds: string[] = [
    CASES.reVerification.caseId,
    CASES.fingerprintRepeat.caseId,
    CASES.fingerprintNoFalseCollapse.caseId,
  ];
  const firstPassEvents = testEvents.filter((e) => !deferredCaseIds.includes(e.caseId));
  const result = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(
    deps,
    firstPassEvents,
  );

  const dist = result.scenarioDistribution;
  const expectations: [string, number, number][] = [
    ['reservedIdSkippedCount', dist.reservedIdSkippedCount, 1],
    ['autoMatchCount', dist.autoMatchCount, 2], // perfect-match-professional-id + perfect-match-by-name
    ['perfectMatchInactiveCount', dist.perfectMatchInactiveCount, 1],
    ['imperfectMatchCount', dist.imperfectMatchCount, 1],
    ['noMatchCount', dist.noMatchCount, 1],
    ['highConfidenceMatchCount', dist.highConfidenceMatchCount, 1],
    ['multipleMatchCount', dist.multipleMatchCount, 1],
  ];
  for (const [label, actual, expected] of expectations) {
    if (actual === expected) {
      pass(`scenarioDistribution.${label} === ${expected}`);
    } else {
      fail(`scenarioDistribution.${label}: expected ${expected}, got ${actual}`);
    }
  }

  if (
    result.notYetSyncedEvents.length === 1 &&
    result.notYetSyncedEvents[0].caseId === CASES.caseNotYetSynced.caseId
  ) {
    pass('notYetSyncedEvents contains exactly the case-not-yet-synced event');
  } else {
    fail(
      `expected notYetSyncedEvents = [${CASES.caseNotYetSynced.caseId}], got: ${JSON.stringify(result.notYetSyncedEvents.map((e) => e.caseId))}`,
    );
  }

  if (result.dlqMessages.length === 0) {
    pass('No DLQ messages');
  } else {
    fail(
      `expected 0 DLQ messages, got ${result.dlqMessages.length}: ${JSON.stringify(result.dlqMessages)}`,
    );
  }

  // ── Stage 3: Assert Cosmos side effects (first pass) ──────────────────────
  console.log('\nStage 3: Asserting Cosmos state after first pass\n');

  const { client, db } = await getMongoDb();
  try {
    // 1. reserved-id-skip: no verification, no appointment.
    const reservedVerification = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.reservedIdSkip.caseId });
    if (!reservedVerification) {
      pass('1. reserved-id-skip: no trustee-match-verification created');
    } else {
      fail(
        `1. reserved-id-skip: expected no verification, got: ${JSON.stringify(reservedVerification)}`,
      );
    }
    if (eventFor(CASES.reservedIdSkip.caseId)?.acmsProfessionalId === RESERVED_PROFESSIONAL_ID) {
      pass(`1. reserved-id-skip: event carries reserved id ${RESERVED_PROFESSIONAL_ID}`);
    } else {
      fail(`1. reserved-id-skip: expected acmsProfessionalId ${RESERVED_PROFESSIONAL_ID}`);
    }

    // 2. perfect-match-professional-id: auto-linked, no verification doc written (auto-matched
    // cases were never reviewed by a human, so nothing belongs in the human-review queue).
    const appt2 = await db.collection('case-trustee-appointments').findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: CASES.perfectMatchProfessionalId.caseId,
    });
    if (appt2?.trusteeId === TRUSTEES.perfectPid.id) {
      pass('2. perfect-match-professional-id: case appointment linked to expected trustee');
    } else {
      fail(
        `2. perfect-match-professional-id: expected trusteeId ${TRUSTEES.perfectPid.id}, got: ${JSON.stringify(appt2)}`,
      );
    }
    const verification2 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.perfectMatchProfessionalId.caseId });
    if (verification2 === null) {
      pass('2. perfect-match-professional-id: no verification doc written for auto-matched case');
    } else {
      fail(
        `2. perfect-match-professional-id: expected no verification doc, got: ${JSON.stringify(verification2)}`,
      );
    }

    // 3. perfect-match-by-name: auto-linked, no verification doc written (same as #2).
    const appt3 = await db
      .collection('case-trustee-appointments')
      .findOne({ documentType: 'CASE_APPOINTMENT', caseId: CASES.perfectMatchByName.caseId });
    if (appt3?.trusteeId === TRUSTEES.perfectName.id) {
      pass('3. perfect-match-by-name: case appointment linked to expected trustee');
    } else {
      fail(
        `3. perfect-match-by-name: expected trusteeId ${TRUSTEES.perfectName.id}, got: ${JSON.stringify(appt3)}`,
      );
    }

    // 4. perfect-match-inactive-status: verification pending, PERFECT_MATCH_INACTIVE_STATUS.
    const verification4 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.perfectMatchInactiveStatus.caseId });
    if (
      verification4?.status === 'pending' &&
      verification4?.mismatchReason === 'PERFECT_MATCH_INACTIVE_STATUS' &&
      verification4?.inactiveAppointmentStatus === 'voluntarily-suspended'
    ) {
      pass(
        '4. perfect-match-inactive-status: pending verification with correct mismatchReason/status',
      );
    } else {
      fail(
        `4. perfect-match-inactive-status: unexpected verification: ${JSON.stringify(verification4)}`,
      );
    }

    // 5. imperfect-match: verification pending, IMPERFECT_MATCH, districtDivision/chapter=0.
    const verification5 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.imperfectMatch.caseId });
    const candidate5 = verification5?.matchCandidates?.[0];
    if (
      verification5?.status === 'pending' &&
      verification5?.mismatchReason === 'IMPERFECT_MATCH' &&
      candidate5?.districtDivisionScore === 0 &&
      candidate5?.chapterScore === 0 &&
      candidate5?.addressScore === 0 &&
      candidate5?.nameScore === 100
    ) {
      pass(
        '5. imperfect-match: pending verification with expected score breakdown (name=100, address/district/chapter=0)',
      );
    } else {
      fail(`5. imperfect-match: unexpected verification: ${JSON.stringify(verification5)}`);
    }

    // 6. no-match: verification pending, NO_TRUSTEE_MATCH, no candidates.
    const verification6 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.noMatch.caseId });
    if (
      verification6?.status === 'pending' &&
      verification6?.mismatchReason === 'NO_TRUSTEE_MATCH' &&
      (verification6?.matchCandidates?.length ?? 0) === 0
    ) {
      pass('6. no-match: pending verification with NO_TRUSTEE_MATCH, no candidates');
    } else {
      fail(`6. no-match: unexpected verification: ${JSON.stringify(verification6)}`);
    }

    // 7. multiple-match-high-confidence: pending, AMBIGUOUS_MATCH_RESOLVED, winner is the "real" trustee.
    const verification7 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.multipleMatchHighConfidence.caseId });
    const winner7 = verification7?.matchCandidates?.find(
      (c: { totalScore: number }) => c.totalScore > 75,
    );
    if (
      verification7?.status === 'pending' &&
      verification7?.mismatchReason === 'AMBIGUOUS_MATCH_RESOLVED' &&
      winner7?.trusteeId === TRUSTEES.ambiguousWinnerReal.id
    ) {
      pass('7. multiple-match-high-confidence: pending verification, winner is the real trustee');
    } else {
      fail(
        `7. multiple-match-high-confidence: unexpected verification: ${JSON.stringify(verification7)}`,
      );
    }
    const appt7 = await db.collection('case-trustee-appointments').findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: CASES.multipleMatchHighConfidence.caseId,
    });
    const event7 = eventFor(CASES.multipleMatchHighConfidence.caseId);
    const expectedFingerprint7 = event7 && computeFingerprint(buildVariant(event7.dxtrTrustee));
    if (appt7?.isSurrogate === true && appt7?.trusteeId === expectedFingerprint7) {
      pass(
        '7. multiple-match-high-confidence: surrogate case appointment written, keyed by fingerprint (still awaits human approval)',
      );
    } else {
      fail(
        `7. multiple-match-high-confidence: expected a surrogate appointment keyed by fingerprint ${expectedFingerprint7}, got: ${JSON.stringify(appt7)}`,
      );
    }

    // 8. multiple-match-no-winner: pending, AMBIGUOUS_MATCH_UNRESOLVED, tied candidates.
    const verification8 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.multipleMatchNoWinner.caseId });
    const scores8 = (verification8?.matchCandidates ?? []).map(
      (c: { totalScore: number }) => c.totalScore,
    );
    if (
      verification8?.status === 'pending' &&
      verification8?.mismatchReason === 'AMBIGUOUS_MATCH_UNRESOLVED' &&
      scores8.length === 2 &&
      scores8[0] === scores8[1]
    ) {
      pass(
        `8. multiple-match-no-winner: pending verification, tied candidates (${scores8[0]} each)`,
      );
    } else {
      fail(
        `8. multiple-match-no-winner: unexpected verification: ${JSON.stringify(verification8)}`,
      );
    }

    // 9. case-not-yet-synced: no verification, no appointment (already asserted via
    //    notYetSyncedEvents above).
    const verification9 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.caseNotYetSynced.caseId });
    if (!verification9) {
      pass('9. case-not-yet-synced: no trustee-match-verification created');
    } else {
      fail(
        `9. case-not-yet-synced: expected no verification, got: ${JSON.stringify(verification9)}`,
      );
    }

    // 10. case-moved: no verification, no appointment.
    const verification10 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.caseMoved.caseId });
    const appt10 = await db
      .collection('case-trustee-appointments')
      .findOne({ documentType: 'CASE_APPOINTMENT', caseId: CASES.caseMoved.caseId });
    if (!verification10 && !appt10) {
      pass('10. case-moved: no verification, no case appointment (skipped)');
    } else {
      fail(
        `10. case-moved: expected no verification/appointment, got verification=${JSON.stringify(verification10)}, appointment=${JSON.stringify(appt10)}`,
      );
    }
  } finally {
    await client.close();
  }

  if (hasFailures) {
    console.log(
      '\nSkipping Slice 5 fingerprint pass and re-verification pass (earlier assertions failed).',
    );
    console.log('\n' + JSON.stringify(result, null, 2));
    return;
  }

  // ── Stage 3.5: Slice 5 fingerprint pass ───────────────────────────────────
  console.log('\nStage 3.5: Slice 5 fingerprint memoization — scenarios 12/13\n');
  console.log(
    '  12. fingerprint-repeat: byte-identical repeat of scenario 2 -> fingerprint hit -> auto-link to perfectPid',
  );
  console.log(
    '  13. fingerprint-no-false-collapse: genuinely different person, same ambiguous name -> fingerprint miss -> fuzzy match -> decoy\n',
  );

  const fingerprintEvent12 = eventFor(CASES.fingerprintRepeat.caseId);
  const fingerprintEvent13 = eventFor(CASES.fingerprintNoFalseCollapse.caseId);
  if (!fingerprintEvent12 || !fingerprintEvent13) {
    fail('12/13: fingerprint scenario events not found in first-pass read');
    return;
  }

  const fingerprintResult = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [
    fingerprintEvent12,
    fingerprintEvent13,
  ]);

  if (fingerprintResult.scenarioDistribution.autoMatchCount === 1) {
    pass('12. fingerprint-repeat: autoMatchCount === 1 (fingerprint hit, no name-matching needed)');
  } else {
    fail(
      `12. fingerprint-repeat: expected autoMatchCount 1, got ${fingerprintResult.scenarioDistribution.autoMatchCount}`,
    );
  }
  if (fingerprintResult.scenarioDistribution.highConfidenceMatchCount === 1) {
    pass(
      '13. fingerprint-no-false-collapse: highConfidenceMatchCount === 1 (fell through to fuzzy matching)',
    );
  } else {
    fail(
      `13. fingerprint-no-false-collapse: expected highConfidenceMatchCount 1, got ${fingerprintResult.scenarioDistribution.highConfidenceMatchCount}`,
    );
  }

  const { client: client4, db: db4 } = await getMongoDb();
  try {
    // 12. fingerprint-repeat: auto-linked to perfectPid, no TRUSTEE_VARIATION duplicate.
    const appt12 = await db4
      .collection('case-trustee-appointments')
      .findOne({ documentType: 'CASE_APPOINTMENT', caseId: CASES.fingerprintRepeat.caseId });
    if (appt12?.trusteeId === TRUSTEES.perfectPid.id) {
      pass('12. fingerprint-repeat: case appointment linked to perfectPid (not the decoy)');
    } else {
      fail(
        `12. fingerprint-repeat: expected trusteeId ${TRUSTEES.perfectPid.id}, got: ${JSON.stringify(appt12)}`,
      );
    }

    const variations = await db4
      .collection('trustee-variation')
      .find({ documentType: 'TRUSTEE_VARIATION', trusteeId: TRUSTEES.perfectPid.id })
      .toArray();
    if (variations.length === 1) {
      pass(
        '12. fingerprint-repeat: exactly 1 TRUSTEE_VARIATION doc for perfectPid (written once on scenario 2, not rewritten)',
      );
    } else {
      fail(
        `12. fingerprint-repeat: expected exactly 1 TRUSTEE_VARIATION doc, got ${variations.length}`,
      );
    }

    // 13. fingerprint-no-false-collapse: pending verification, AMBIGUOUS_MATCH_RESOLVED, decoy wins.
    const verification13 = await db4
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.fingerprintNoFalseCollapse.caseId });
    const winner13 = verification13?.matchCandidates?.find(
      (c: { totalScore: number }) => c.totalScore > 75,
    );
    if (
      verification13?.status === 'pending' &&
      verification13?.mismatchReason === 'AMBIGUOUS_MATCH_RESOLVED' &&
      winner13?.trusteeId === TRUSTEES.perfectPidDecoy.id
    ) {
      pass(
        '13. fingerprint-no-false-collapse: pending verification, fuzzy-match winner is the decoy, not perfectPid',
      );
    } else {
      fail(
        `13. fingerprint-no-false-collapse: unexpected verification: ${JSON.stringify(verification13)}`,
      );
    }

    const appt13 = await db4.collection('case-trustee-appointments').findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: CASES.fingerprintNoFalseCollapse.caseId,
    });
    const expectedFingerprint13 = computeFingerprint(buildVariant(fingerprintEvent13.dxtrTrustee));
    if (appt13?.isSurrogate === true && appt13?.trusteeId === expectedFingerprint13) {
      pass(
        '13. fingerprint-no-false-collapse: surrogate case appointment written, keyed by fingerprint (still awaits human approval)',
      );
    } else {
      fail(
        `13. fingerprint-no-false-collapse: expected a surrogate appointment keyed by fingerprint ${expectedFingerprint13}, got: ${JSON.stringify(appt13)}`,
      );
    }
  } finally {
    await client4.close();
  }

  if (hasFailures) {
    console.log('\nSkipping re-verification pass (earlier assertions failed).');
    console.log('\n' + JSON.stringify(result, null, 2));
    return;
  }

  // ── Stage 4: re-verification (second pass) ────────────────────────────────
  console.log('\nStage 4: re-verification — reprocessing an already-resolved case\n');

  const reVerifyEvent = eventFor(CASES.reVerification.caseId);
  if (!reVerifyEvent) {
    fail('11. re-verification: event not found in first-pass read');
    return;
  }

  // First resolution: zero appointments -> imperfect match, verification created pending.
  const firstResolution = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [
    reVerifyEvent,
  ]);
  if (firstResolution.scenarioDistribution.imperfectMatchCount === 1) {
    pass(
      '11. re-verification: first pass resolves as imperfect-match (pending verification created)',
    );
  } else {
    fail(
      `11. re-verification: expected first-pass imperfectMatchCount 1, got ${firstResolution.scenarioDistribution.imperfectMatchCount}`,
    );
  }

  // Simulate a human resolution directly in Mongo (approveVerification's write shape is out
  // of scope for this harness — this harness tests the matching algorithm, not the approval
  // API — so the status flip is done directly here).
  const { client: client2, db: db2 } = await getMongoDb();
  try {
    await db2
      .collection('trustee-match-verification')
      .updateOne(
        { caseId: CASES.reVerification.caseId },
        { $set: { status: 'approved', resolvedTrusteeId: TRUSTEES.reVerification.id } },
      );
    pass('11. re-verification: simulated human approval (status -> approved)');
  } finally {
    await client2.close();
  }

  // Second resolution: same event reprocessed. Since the verification is no longer 'pending',
  // upsertMatchVerification must not rewrite it — it should just count as a re-verification.
  const secondResolution = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [
    reVerifyEvent,
  ]);
  if (secondResolution.scenarioDistribution.reVerificationCount === 1) {
    pass('11. re-verification: second pass counted as a re-verification');
  } else {
    fail(
      `11. re-verification: expected second-pass reVerificationCount 1, got ${secondResolution.scenarioDistribution.reVerificationCount}`,
    );
  }

  const { client: client3, db: db3 } = await getMongoDb();
  try {
    const finalVerification = await db3
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.reVerification.caseId });
    if (
      finalVerification?.status === 'approved' &&
      finalVerification?.resolvedTrusteeId === TRUSTEES.reVerification.id
    ) {
      pass(
        '11. re-verification: already-approved verification was not overwritten by the re-verification pass',
      );
    } else {
      fail(
        `11. re-verification: verification was unexpectedly modified: ${JSON.stringify(finalVerification)}`,
      );
    }
  } finally {
    await client3.close();
  }

  console.log('\nFirst-pass result summary:');
  console.log(JSON.stringify(result, null, 2));

  // ── Stage 5: getActiveByCaseId sort/index proof ───────────────────────────
  await runSortIndexStage(context);

  // ── Stage 6: stable-assignedOn idempotency proof ──────────────────────────
  await runIdempotencyStage(deps);
}

// ---------------------------------------------------------------------------
// Stage 5 — getActiveByCaseId sort/index proof
// ---------------------------------------------------------------------------

/**
 * Proves getActiveByCaseId (trustee-case-appointments.mongo.repository.ts) returns the OLDEST
 * of several active appointments on one case, and — in azure mode, where index-policy
 * enforcement is real — that the supporting {caseId:1, assignedOn:1} index actually exists.
 * This is the class of bug (Cosmos index-policy enforcement) a fully-mocked unit test cannot
 * catch: an unindexed sort fails against real Cosmos with HTTP 500 ("index path... excluded"),
 * not merely a wrong result, so this stage also serves as an early-warning check for the index
 * declaration itself, mirroring trustee-match-verification-search/scripts/run-tests.ts's Test 1.
 */
async function runSortIndexStage(context: Awaited<ReturnType<typeof getAppContext>>) {
  console.log(
    '\nStage 5: getActiveByCaseId sort/index — two active appointments, one case, real repository\n',
  );

  const { client, db } = await getMongoDb();
  try {
    const now = new Date().toISOString();
    const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
    const appointmentDocs = [
      {
        trusteeId: SORT_INDEX_TRUSTEE_OLDER,
        assignedOn: SORT_INDEX_ASSIGNED_ON_OLDER,
      },
      {
        trusteeId: SORT_INDEX_TRUSTEE_NEWER,
        assignedOn: SORT_INDEX_ASSIGNED_ON_NEWER,
      },
    ];
    for (const appt of appointmentDocs) {
      await db.collection('case-trustee-appointments').replaceOne(
        {
          documentType: 'CASE_APPOINTMENT',
          caseId: SORT_INDEX_CASE_ID,
          trusteeId: appt.trusteeId,
        },
        {
          documentType: 'CASE_APPOINTMENT',
          caseId: SORT_INDEX_CASE_ID,
          trusteeId: appt.trusteeId,
          assignedOn: appt.assignedOn,
          appointedDate: appt.assignedOn,
          chapter: CHAPTER,
          courtDivisionCode: DIV,
          updatedOn: now,
          updatedBy: systemUser,
          createdOn: now,
          createdBy: systemUser,
        },
        { upsert: true },
      );
    }
    pass(
      `5. seeded 2 active case-trustee-appointments for case ${SORT_INDEX_CASE_ID} (assignedOn ${SORT_INDEX_ASSIGNED_ON_OLDER} and ${SORT_INDEX_ASSIGNED_ON_NEWER})`,
    );

    if (!IS_LOCAL) {
      const indexes = await db.collection(INDEXED_COLLECTION).indexes();
      const hasSortIndex = indexes.some(
        (idx) => JSON.stringify(idx.key) === JSON.stringify(INDEXED_COLLECTION_KEY),
      );
      if (hasSortIndex) {
        pass(
          `5. sort index ${JSON.stringify(INDEXED_COLLECTION_KEY)} present on ${INDEXED_COLLECTION}`,
        );
      } else {
        fail(
          `5. sort index ${JSON.stringify(INDEXED_COLLECTION_KEY)} MISSING on ${INDEXED_COLLECTION} — see cosmos-collections.bicep`,
        );
      }
    }
  } finally {
    await client.close();
  }

  const repository = TrusteeCaseAppointmentsMongoRepository.getInstance(context);
  const active = await repository.getActiveByCaseId(SORT_INDEX_CASE_ID);
  if (
    active?.trusteeId === SORT_INDEX_TRUSTEE_OLDER &&
    active?.assignedOn === SORT_INDEX_ASSIGNED_ON_OLDER
  ) {
    pass(
      '5. getActiveByCaseId returns the OLDEST active appointment (assignedOn ASCENDING), not an arbitrary one',
    );
  } else {
    fail(`5. getActiveByCaseId: expected the older appointment, got: ${JSON.stringify(active)}`);
  }
}

// ---------------------------------------------------------------------------
// Stage 6 — stable-assignedOn idempotency proof
// ---------------------------------------------------------------------------

/**
 * Proves applyResolvedTrustee's stable, event.appointedDate-derived assignedOn (see
 * sync-trustee-case-appointments.ts) keeps upsert's natural key (documentType + caseId +
 * trusteeId + assignedOn) identical across repeated processing of the same event, so a real
 * Mongo/Cosmos replaceOne(..., upsert: true) replaces rather than inserts. A mocked-repository
 * unit test can only assert the recorded call args are identical between calls — it cannot prove
 * the real repository actually collapses them to one document, which is what this stage checks
 * directly against Cosmos/Mongo afterward.
 */
async function runIdempotencyStage(
  deps: ReturnType<typeof SyncTrusteeCaseAppointmentsUseCase.createDeps>,
) {
  console.log(
    '\nStage 6: stable assignedOn idempotency — same event processed twice, real repository\n',
  );

  const now = new Date().toISOString();
  const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
  const { client, db } = await getMongoDb();
  try {
    await db.collection('cases').replaceOne(
      { documentType: 'SYNCED_CASE', caseId: IDEMPOTENCY_CASE_ID },
      {
        documentType: 'SYNCED_CASE',
        caseId: IDEMPOTENCY_CASE_ID,
        dxtrId: IDEMPOTENCY_CASE_ID,
        courtId: COURT_ID,
        courtName: 'Integration Test Court',
        courtDivisionCode: DIV,
        courtDivisionName: 'Matching Scenarios Division',
        officeCode: '1',
        officeName: 'Matching Scenarios Division',
        groupDesignator: 'MS',
        regionId: '02',
        regionName: 'Region 2',
        chapter: CHAPTER,
        caseTitle: 'Idempotency Stage Debtor',
        dateFiled: '2026-01-01',
        debtor: { name: 'Idempotency Stage Debtor' },
        updatedOn: now,
        updatedBy: systemUser,
      },
      { upsert: true },
    );

    await db.collection('trustees').replaceOne(
      { documentType: 'TRUSTEE', trusteeId: IDEMPOTENCY_TRUSTEE.id },
      {
        documentType: 'TRUSTEE',
        trusteeId: IDEMPOTENCY_TRUSTEE.id,
        name: IDEMPOTENCY_TRUSTEE.name,
        firstName: 'Idempotency',
        middleName: 'P',
        lastName: 'Trustee',
        public: {
          address: {
            address1: '1 Idempotency Rd',
            city: 'Scenario City',
            state: 'SC',
            zipCode: '11111',
            countryCode: 'US',
          },
        },
        updatedOn: now,
        updatedBy: systemUser,
      },
      { upsert: true },
    );

    await db.collection('trustee-professional-ids').replaceOne(
      { acmsProfessionalId: IDEMPOTENCY_PID, camsTrusteeId: IDEMPOTENCY_TRUSTEE.id },
      {
        documentType: 'TRUSTEE_PROFESSIONAL_ID',
        camsTrusteeId: IDEMPOTENCY_TRUSTEE.id,
        acmsProfessionalId: IDEMPOTENCY_PID,
        updatedOn: now,
        updatedBy: systemUser,
      },
      { upsert: true },
    );

    await db.collection('trustee-appointments').replaceOne(
      { documentType: 'TRUSTEE_APPOINTMENT', trusteeId: IDEMPOTENCY_TRUSTEE.id, courtId: COURT_ID },
      {
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: IDEMPOTENCY_TRUSTEE.id,
        chapter: CHAPTER,
        appointmentType: 'panel',
        courtId: COURT_ID,
        divisionCode: DIV,
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
    pass('6. seeded synced case, trustee, professional id, and active appointment');
  } finally {
    await client.close();
  }

  // Constructed directly rather than read from DXTR — TrusteeAppointmentSyncEvent needs no DXTR
  // round trip to build, and this stage's whole point (same event, reprocessed) is clearer when
  // the identical object reference is passed to processAppointments both times.
  const event: TrusteeAppointmentSyncEvent = {
    caseId: IDEMPOTENCY_CASE_ID,
    courtId: COURT_ID,
    dxtrTrustee: { fullName: IDEMPOTENCY_TRUSTEE.name },
    appointedDate: IDEMPOTENCY_APPOINTED_DATE,
    chapter: CHAPTER,
    courtDivisionCode: DIV,
    acmsProfessionalId: IDEMPOTENCY_PID,
  };

  const firstPass = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [event]);
  const secondPass = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [event]);
  if (firstPass.scenarioDistribution.autoMatchCount === 1) {
    pass('6. first pass auto-matches (professional-id fast path)');
  } else {
    fail(
      `6. first pass: expected autoMatchCount 1, got ${firstPass.scenarioDistribution.autoMatchCount}`,
    );
  }
  if (secondPass.scenarioDistribution.autoMatchCount === 1) {
    pass('6. second (reprocessed) pass also auto-matches — same event, same outcome');
  } else {
    fail(
      `6. second pass: expected autoMatchCount 1, got ${secondPass.scenarioDistribution.autoMatchCount}`,
    );
  }

  const { client: idempotencyClient, db: idempotencyDb } = await getMongoDb();
  try {
    const documents = await idempotencyDb
      .collection('case-trustee-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', caseId: IDEMPOTENCY_CASE_ID })
      .toArray();
    if (documents.length === 1 && documents[0].assignedOn === IDEMPOTENCY_APPOINTED_DATE) {
      pass(
        '6. exactly ONE case-trustee-appointments document exists after reprocessing (real replaceOne upsert replaced, not inserted)',
      );
    } else {
      fail(
        `6. expected exactly 1 document with assignedOn ${IDEMPOTENCY_APPOINTED_DATE}, got ${documents.length}: ${JSON.stringify(documents)}`,
      );
    }
  } finally {
    await idempotencyClient.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('Trustee Match Scenarios — Matching Algorithm Correctness Integration Test');
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
      const HARNESS = 'npm run trustee-match-scenarios --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  INTEGRATION_ENV=local  ${HARNESS} <command>   (default)`);
      console.log(`  INTEGRATION_ENV=azure  ${HARNESS} <command>   (VPN required)`);
      console.log('\nLocal workflow:');
      console.log('  1. ./trustee-match-scenarios/scripts/start-services.sh');
      console.log(`  2. ${HARNESS} seed-schema  (create DXTR_INT + apply AO_* DDL)`);
      console.log(`  3. ${HARNESS} seed-sql     (seed 13 scenario cases)`);
      console.log(
        `  4. ${HARNESS} seed-cosmos  (seed synced cases, trustees, appointments, professional ids)`,
      );
      console.log(`  5. ${HARNESS} run          (read DXTR → match → write, then assert)`);
      console.log(`  6. ${HARNESS} clean        (remove all test data from both databases)`);
      console.log('  7. ./trustee-match-scenarios/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env    Verify required environment variables');
      console.log('  seed-schema  [local] Create DXTR_INT + apply AO_* DDL');
      console.log('  seed-sql     Seed AO_CS_DIV/AO_CS/AO_PY/AO_TX fixture rows for 13 scenarios');
      console.log('  seed-cosmos  Seed synced cases, trustees, appointments, professional ids');
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
