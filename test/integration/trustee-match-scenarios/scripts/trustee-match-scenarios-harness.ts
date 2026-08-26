/**
 * Integration test harness: trustee matching algorithm correctness.
 *
 * Exercises `SyncTrusteeCaseAppointmentsUseCase` (backend/lib/use-cases/dataflows/
 * sync-trustee-case-appointments.ts) directly against a real DXTR SQL Server instance
 * (mimicked locally with SQL Edge) — same pattern as ../trustee-petition-match — with twelve
 * fixture cases (numbered 2-13; #1 (reserved-id-skip) was removed once ACMS professional ID
 * matching was retired, and case #2's original professional-id-fast-path outcome was replaced
 * by an equivalent auto-link path — see #2 below), each exercising one distinct
 * outcome branch of the matching algorithm (trustee-match.helpers.ts + processAppointments's
 * decision tree):
 *
 *   2.  perfect-match-ambiguous-name-resolved-by-scoring - two CAMS trustees share this DXTR
 *                                       party's exact name; fuzzy scoring picks the clear winner
 *                                       on demographics, same as any other resolved trusteeId
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
 * Scenarios 12-13 exercise the fingerprint/variant memoization mechanism
 * (backend/lib/use-cases/dataflows/trustee-variant.helpers.ts, TRUSTEE_VARIATION) layered on
 * top of the same algorithm scenarios 2-11 cover. They run in a separate processAppointments()
 * call AFTER the main first pass, so scenario 2's TRUSTEE_VARIATION write (which only happens
 * once scenario 2 itself resolves) is guaranteed to exist before scenario 12/13's events are
 * read — sidestepping the DXTR query's TX_DATE DESC ordering entirely rather than relying on
 * intra-batch processing order.
 *
 * Further stages, independent of the 12 DXTR-driven scenarios above, guard regressions real
 * Cosmos/Mongo can catch but a fully-mocked unit test cannot (Stages 8-10 round-trip through
 * real DXTR/Mongo reads instead of seeding Cosmos fixtures directly):
 *
 *   Stage 5 (sort/index) - getActiveByCaseId (trustee-case-appointments.mongo.repository.ts)
 *     sorts by assignedOn DESCENDING (with createdOn DESCENDING as a tiebreaker) and relies on
 *     the {caseId:1, assignedOn:1} compound index declared in cosmos-collections.bicep for
 *     case-trustee-appointments. Seeds two active appointments for one case with different
 *     assignedOn values and asserts the real repository returns the MOST RECENTLY ASSIGNED one
 *     — the class of bug (Cosmos index-policy enforcement) that only a real Cosmos instance can
 *     catch (see trustee-match-verification-search/scripts/run-tests.ts's Test 1 for the same
 *     pattern applied to a different collection/index).
 *
 *   Stage 6 (stable-assignedOn idempotency) - applyResolvedTrustee/writeSurrogateAppointment
 *     derive assignedOn from event.appointedDate (not wall-clock time) specifically so upsert's
 *     natural key (documentType + caseId + trusteeId + assignedOn) stays stable across repeated
 *     processing of the same event. Reprocesses one identical fixture event twice through the
 *     real SyncTrusteeCaseAppointmentsUseCase.processAppointments() and asserts exactly one
 *     case-trustee-appointments document exists afterward — proof against a real replaceOne
 *     upsert, which a mocked repository's recorded call args cannot provide.
 *
 *   Stage 7 (dual-partition divergence repair) - upsert()/updateCaseAppointment() write
 *     casePartition then trusteePartition sequentially and non-transactionally; a transient
 *     failure on the second write leaves casePartition showing a trustee active while
 *     trusteePartition never received the matching row. Seeds exactly that divergence directly
 *     (casePartition active, trusteePartition empty) and asserts applyResolvedTrustee's
 *     existsInTrusteePartition check detects it and repairs trusteePartition via
 *     replaceOneInTrusteePartition — proof against a real trustee partition collection, which a
 *     mocked repository's recorded call args cannot provide.
 *
 *   Stage 8 (bad REC date fallback) - proves CasesDxtrGateway.getTrusteeAppointments falls back
 *     to TX.TX_DATE when REC's fixed-width embedded appointment date is blank/unparseable,
 *     against a real SQL Server row rather than a mocked query result.
 *
 *   Stage 9 (sentinel professional code skip rule) - proves the skip rule against a real DXTR
 *     round trip: both that profCode is correctly extracted from REC's fixed-width offset, and
 *     that isSentinelWithNoIdentity/isBogusTrusteeName correctly decide skip vs. proceed against
 *     real query results rather than a hand-built mock event.
 *
 *   Stage 10 (district/chapter cross-appointment scoring) - seeds one trustee with two active
 *     TrusteeAppointments in different divisions/chapters, then calls
 *     resolveNameCollisionByScoring directly against real Mongo for a case whose division
 *     matches only the FIRST appointment and whose chapter matches only the SECOND
 *     (unrelated-division) appointment. Asserts chapterScore is 0 — calculateChapterScore scopes
 *     chapter evidence to only the appointments that also cover the case's division, so a
 *     trustee's chapter can never be credited from an appointment in an unrelated division.
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
 *   seed-cosmos   Seed synced cases, trustees, appointments
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
import { resolveNameCollisionByScoring } from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';
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
// other collection this harness seeds (cases, trustees, trustee-appointments,
// trustee-case-appointments, trustee-match-verification, trustee-variation, runtime-state) is
// queried in this harness only by equality/findOne, which Mongo/Cosmos can satisfy without a
// declared index — so standUpEphemeralCosmosDatabase (which materializes a database by creating
// exactly one collection's index) is only called for this one. clean() also defensively deletes
// any stale trustee-professional-ids rows left over from before this harness stopped seeding
// that collection, though nothing here seeds it anymore.
const INDEXED_COLLECTION = 'case-trustee-appointments';
const INDEXED_COLLECTION_KEY = { caseId: 1 as const, assignedOn: 1 as const };

// Set once run() provisions an ephemeral database in azure mode, so clean-up (finally block) can
// tear down the exact same database — never derived twice, which could tear down the wrong name.
let ephemeralDatabaseName: string | null = null;

// ---------------------------------------------------------------------------
// Test fixtures - see seed/01-seed-dxtr-data.sql for the matching DXTR rows
// ---------------------------------------------------------------------------

const COURT_ID = '0210';
const DIV = '083';
const CHAPTER = '7';

const CASES = {
  perfectMatchAmbiguousName: { caseId: '083-26-88901' },
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
  // Shares perfectPid's exact name — this is what makes scenario 2 itself an ambiguous-name
  // collision resolved by resolveNameCollisionByScoring (perfectPid wins on demographics), and
  // is also used by scenarios 12/13 to exercise the fingerprint bucket against that same
  // ambiguity.
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
const IDEMPOTENCY_APPOINTED_DATE = '2026-01-14';

// Stage 7: one case seeded with a genuinely diverged dual-write — active in casePartition,
// missing from trusteePartition — to prove applyResolvedTrustee's existsInTrusteePartition
// check detects and repairs the divergence on the next retry, against real Mongo semantics a
// mocked-repository unit test cannot exercise.
const DIVERGENCE_CASE_ID = '083-26-88922';
const DIVERGENCE_TRUSTEE = { id: 'ms-trustee-divergence', name: 'Divergence P Trustee' };
const DIVERGENCE_ASSIGNED_ON = '2026-01-20';

const STAGE_5_6_7_CASE_IDS = [SORT_INDEX_CASE_ID, IDEMPOTENCY_CASE_ID, DIVERGENCE_CASE_ID];
const STAGE_5_6_7_TRUSTEE_IDS = [
  SORT_INDEX_TRUSTEE_OLDER,
  SORT_INDEX_TRUSTEE_NEWER,
  IDEMPOTENCY_TRUSTEE.id,
  DIVERGENCE_TRUSTEE.id,
];

// Stage 8: unlike Stages 5-7, this DOES round-trip through DXTR (seed/01-seed-dxtr-data.sql
// scenario 14, CS_CASEID 999999413) — it exists specifically to prove the real SQL fallback,
// which Stages 5-7 have no need to exercise. Excluded from ALL_CASE_IDS/the 12-scenario
// matching pipeline (no Cosmos synced-case fixture, no trustee, never passed to
// processAppointments) since it's read directly via casesGateway.getTrusteeAppointments.
const BAD_REC_DATE_CASE_ID = '083-26-88913';
const BAD_REC_DATE_TX_DATE = '2026-01-14';

// Stage 9: sentinel professional code skip rule. Like Stage 8, these round-trip
// through DXTR directly (seed/01-seed-dxtr-data.sql fixtures 15a-15d, CS_CASEID 999999414-417)
// rather than joining the 13-scenario Cosmos matching pipeline — excluded from ALL_CASE_IDS, no
// Cosmos synced-case/trustee fixtures needed for the two cases expected to be skipped before
// matching ever runs (15a, 15d). The two cases expected to proceed to matching (15b, 15c) are
// each asserted only via a pending NO_TRUSTEE_MATCH verification doc, not via a full auto-link
// outcome — dedicated trustee fixtures for those two cases aren't worth the setup for what
// sync-trustee-case-appointments.test.ts's mocked unit tests already cover exhaustively; this
// stage's job is proving the real REC SUBSTRING extraction and skip decision, not re-proving the
// matching algorithm itself.
const SENTINEL_NO_NAME_NO_ADDRESS_CASE_ID = '083-26-88914';
const SENTINEL_BOGUS_NAME_WITH_CONTACT_CASE_ID = '083-26-88915';
const SENTINEL_GENUINE_NAME_AND_ADDRESS_CASE_ID = '083-26-88916';
const NON_SENTINEL_EMPTY_DEMOGRAPHICS_CASE_ID = '083-26-88917';
// Like BAD_REC_DATE_CASE_ID, these DO have DXTR rows (so they're covered by the
// 999999400-999999417 SQL DELETE range in clean() already) but aren't part of ALL_CASE_IDS —
// tracked separately here purely so clean() also removes the two Cosmos SYNCED_CASE fixtures
// runSentinelProfCodeStage seeds for the two non-skipped cases (15b, 15c).
const STAGE_9_CASE_IDS = [
  SENTINEL_NO_NAME_NO_ADDRESS_CASE_ID,
  SENTINEL_BOGUS_NAME_WITH_CONTACT_CASE_ID,
  SENTINEL_GENUINE_NAME_AND_ADDRESS_CASE_ID,
  NON_SENTINEL_EMPTY_DEMOGRAPHICS_CASE_ID,
];

// Stage 10: direct-Cosmos proof, no DXTR round trip needed — calculateChapterScore/
// calculateDistrictDivisionScore/calculateCandidateScore consume TrusteeAppointment[] +
// court/division/chapter values only. One trustee, two active appointments in DIFFERENT
// divisions/chapters. A case in the FIRST appointment's division but the SECOND appointment's
// chapter reproduces the scoring bug this stage guards against: chapter evidence must never be
// credited from an appointment that doesn't also cover the case's division.
const CROSS_APPOINTMENT_TRUSTEE = {
  id: 'ms-trustee-cross-appointment',
  name: 'CrossAppt M ScoringTrustee',
};
const CROSS_APPOINTMENT_DIV_A = '083';
const CROSS_APPOINTMENT_CHAPTER_A = '7';
const CROSS_APPOINTMENT_DIV_B = '084';
const CROSS_APPOINTMENT_CHAPTER_B = '13';
// The case under verification: division A (matches the trustee's first appointment) but
// chapter 13 (matches only the trustee's second, unrelated-division appointment).
const CROSS_APPOINTMENT_CASE_COURT_ID = COURT_ID;
const CROSS_APPOINTMENT_CASE_DIVISION = CROSS_APPOINTMENT_DIV_A;
const CROSS_APPOINTMENT_CASE_CHAPTER = CROSS_APPOINTMENT_CHAPTER_B;

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
    pass(
      '01-seed-dxtr-data.sql seeded (12 scenario cases + Stage 8 bad-REC-date case + Stage 9 sentinel-profCode cases)',
    );
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed-cosmos
// ---------------------------------------------------------------------------

async function seedCosmos() {
  console.log('\nSeeding synced cases, trustees, and appointments into Cosmos...\n');

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
      DELETE FROM dbo.AO_TX WHERE CS_CASEID BETWEEN '999999400' AND '999999417' AND COURT_ID = '${COURT_ID}';
      DELETE FROM dbo.AO_PY WHERE CS_CASEID BETWEEN '999999400' AND '999999417' AND COURT_ID = '${COURT_ID}';
      DELETE FROM dbo.AO_CS WHERE CS_CASEID BETWEEN '999999400' AND '999999417' AND COURT_ID = '${COURT_ID}';
      DELETE FROM dbo.AO_CS_DIV WHERE (CS_DIV = '083' AND GRP_DES = 'MS') OR (CS_DIV = '084' AND GRP_DES = 'XX');
    `);
    pass('Deleted DXTR fixture rows for cases 999999400-999999417');
  } finally {
    await pool.close();
  }

  // Stage 5/6/7 fixtures are seeded directly into Cosmos (no DXTR row), so their case/trustee
  // ids are tracked separately from ALL_CASE_IDS/ALL_TRUSTEE_IDS — see the STAGE_5_6_7_*
  // constants' own comment for why they aren't folded into those arrays. Stage 10 has no case
  // fixture at all (resolveNameCollisionByScoring is called directly against a synthetic event,
  // not a synced case/case-appointment doc), only a trustee id to tear down.
  const allCaseIds = [...ALL_CASE_IDS, ...STAGE_5_6_7_CASE_IDS, ...STAGE_9_CASE_IDS];
  const allTrusteeIds = [
    ...ALL_TRUSTEE_IDS,
    ...STAGE_5_6_7_TRUSTEE_IDS,
    CROSS_APPOINTMENT_TRUSTEE.id,
  ];

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

  console.log('Step 2: Seed Cosmos fixtures (synced cases, trustees, appointments)');
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
    // perfect-match-ambiguous-name-resolved-by-scoring + perfect-match-by-name +
    // multiple-match-high-confidence (a clear fuzzy-scoring winner auto-links exactly like an
    // exact-name match — see resolveByScoring's 'resolved' case in
    // sync-trustee-case-appointments.ts)
    ['autoMatchCount', dist.autoMatchCount, 3],
    ['perfectMatchInactiveCount', dist.perfectMatchInactiveCount, 1],
    // Scenario 5 (imperfect-match) now reclassifies to NO_TRUSTEE_MATCH: a uniquely-name-matched
    // trustee with zero appointment evidence in this case's court/division is no different from a
    // name search that found nothing - see applyMatchOutcome's hasDistrictDivisionMatch gate
    // in sync-trustee-case-appointments.ts. imperfectMatchCount is now 0 for this fixture set;
    // noMatchCount absorbs both scenario 5 and scenario 6 (no-match).
    ['imperfectMatchCount', dist.imperfectMatchCount, 0],
    ['noMatchCount', dist.noMatchCount, 2],
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
    // 2. perfect-match-ambiguous-name-resolved-by-scoring: perfectPid and perfectPidDecoy share
    // this DXTR party's exact name, so matchTrusteeByName reports an ambiguous collision;
    // resolveNameCollisionByScoring picks perfectPid as the clear winner on demographics
    // (address/phone/email match perfectPid, not the decoy) and auto-links exactly like any
    // other resolved trusteeId — no verification doc written (auto-matched cases were never
    // reviewed by a human, so nothing belongs in the human-review queue).
    const appt2 = await db.collection('case-trustee-appointments').findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: CASES.perfectMatchAmbiguousName.caseId,
    });
    if (appt2?.trusteeId === TRUSTEES.perfectPid.id) {
      pass(
        '2. perfect-match-ambiguous-name-resolved-by-scoring: case appointment linked to expected trustee',
      );
    } else {
      fail(
        `2. perfect-match-ambiguous-name-resolved-by-scoring: expected trusteeId ${TRUSTEES.perfectPid.id}, got: ${JSON.stringify(appt2)}`,
      );
    }
    const verification2 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.perfectMatchAmbiguousName.caseId });
    if (verification2 === null) {
      pass(
        '2. perfect-match-ambiguous-name-resolved-by-scoring: no verification doc written for auto-matched case',
      );
    } else {
      fail(
        `2. perfect-match-ambiguous-name-resolved-by-scoring: expected no verification doc, got: ${JSON.stringify(verification2)}`,
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

    // 5. imperfect-match: resolves uniquely by name, but the trustee has zero appointments
    // anywhere - districtDivisionScore is trivially 0, same as a trustee whose real appointments
    // just don't cover this case's court/division. Neither shape offers any evidence connecting
    // this trustee to this case's court/division, so applyMatchOutcome reclassifies both as
    // NO_TRUSTEE_MATCH (no candidates) rather than surfacing a same-name coincidence as a
    // suggested match. See sync-trustee-case-appointments.ts's hasDistrictDivisionMatch gate.
    const verification5 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.imperfectMatch.caseId });
    if (
      verification5?.status === 'pending' &&
      verification5?.mismatchReason === 'NO_TRUSTEE_MATCH' &&
      (verification5?.matchCandidates?.length ?? -1) === 0
    ) {
      pass(
        '5. imperfect-match: pending verification reclassified to NO_TRUSTEE_MATCH, no candidates',
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

    // 7. multiple-match-high-confidence: a clear fuzzy-scoring winner now auto-links (same
    // isAppointmentMatch gate as any other resolved trusteeId) — no verification doc, no
    // surrogate; a real case-trustee-appointment is written directly to the real trustee.
    const verification7 = await db
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.multipleMatchHighConfidence.caseId });
    if (verification7 === null) {
      pass('7. multiple-match-high-confidence: no verification doc written for auto-linked case');
    } else {
      fail(
        `7. multiple-match-high-confidence: expected no verification doc, got: ${JSON.stringify(verification7)}`,
      );
    }
    const appt7 = await db.collection('case-trustee-appointments').findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: CASES.multipleMatchHighConfidence.caseId,
    });
    if (appt7?.trusteeId === TRUSTEES.ambiguousWinnerReal.id && appt7?.isSurrogate !== true) {
      pass(
        '7. multiple-match-high-confidence: real case appointment auto-linked to the real trustee',
      );
    } else {
      fail(
        `7. multiple-match-high-confidence: expected a real appointment linked to ${TRUSTEES.ambiguousWinnerReal.id}, got: ${JSON.stringify(appt7)}`,
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

  // Both events auto-link in this single processAppointments call — event 12 via the
  // TRUSTEE_VARIATION fingerprint hit (no name-matching needed), event 13 via a fingerprint miss
  // that falls through to fuzzy scoring and finds a clear winner. Both outcomes are counted via
  // the same autoMatchCount counter (see applyMatchOutcome/autoLinkTrustee), so the combined
  // total is 2, not 1 — checking fingerprintHitCount/fingerprintMissCount below is what actually
  // distinguishes event 12's fingerprint-hit path from event 13's fingerprint-miss path.
  if (fingerprintResult.scenarioDistribution.autoMatchCount === 2) {
    pass('12/13: autoMatchCount === 2 (event 12 via fingerprint hit, event 13 via fuzzy scoring)');
  } else {
    fail(
      `12/13: expected autoMatchCount 2, got ${fingerprintResult.scenarioDistribution.autoMatchCount}`,
    );
  }
  if (
    fingerprintResult.scenarioDistribution.fingerprintHitCount === 1 &&
    fingerprintResult.scenarioDistribution.fingerprintMissCount === 1
  ) {
    pass(
      '12. fingerprint-repeat: fingerprintHitCount === 1 (no name-matching needed); ' +
        '13. fingerprint-no-false-collapse: fingerprintMissCount === 1 (fell through to fuzzy matching)',
    );
  } else {
    fail(
      `12/13: expected fingerprintHitCount 1 / fingerprintMissCount 1, got ` +
        `${fingerprintResult.scenarioDistribution.fingerprintHitCount} / ` +
        `${fingerprintResult.scenarioDistribution.fingerprintMissCount}`,
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

    // 13. fingerprint-no-false-collapse: a clear fuzzy-scoring winner (the decoy, not perfectPid)
    // now auto-links — no verification doc, no surrogate; a real appointment is written directly.
    const verification13 = await db4
      .collection('trustee-match-verification')
      .findOne({ caseId: CASES.fingerprintNoFalseCollapse.caseId });
    if (verification13 === null) {
      pass('13. fingerprint-no-false-collapse: no verification doc written for auto-linked case');
    } else {
      fail(
        `13. fingerprint-no-false-collapse: expected no verification doc, got: ${JSON.stringify(verification13)}`,
      );
    }

    const appt13 = await db4.collection('case-trustee-appointments').findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: CASES.fingerprintNoFalseCollapse.caseId,
    });
    if (appt13?.trusteeId === TRUSTEES.perfectPidDecoy.id && appt13?.isSurrogate !== true) {
      pass(
        '13. fingerprint-no-false-collapse: real case appointment auto-linked to the decoy, not perfectPid',
      );
    } else {
      fail(
        `13. fingerprint-no-false-collapse: expected a real appointment linked to ${TRUSTEES.perfectPidDecoy.id}, got: ${JSON.stringify(appt13)}`,
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

  // First resolution: zero appointments -> districtDivisionScore 0 -> reclassified to
  // NO_TRUSTEE_MATCH, verification created pending (see the imperfect-match scenario 5 comment
  // above for why zero-appointment evidence is treated the same as no name match at all).
  const firstResolution = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [
    reVerifyEvent,
  ]);
  if (firstResolution.scenarioDistribution.noMatchCount === 1) {
    pass(
      '11. re-verification: first pass resolves as NO_TRUSTEE_MATCH (pending verification created)',
    );
  } else {
    fail(
      `11. re-verification: expected first-pass noMatchCount 1, got ${firstResolution.scenarioDistribution.noMatchCount}`,
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

  // ── Stage 7: dual-partition divergence repair proof ───────────────────────
  await runDivergenceRepairStage(deps);

  // ── Stage 8: bad REC date falls back to TX_DATE ───────────────────────────
  await runBadRecDateFallbackStage(deps);

  // ── Stage 9: sentinel professional code skip rule ─────────────────────────
  await runSentinelProfCodeStage(deps);

  // ── Stage 10: district/chapter cross-appointment scoring ─────────────────
  await runCrossAppointmentScoringStage(context);
}

// ---------------------------------------------------------------------------
// Stage 5 — getActiveByCaseId sort/index proof
// ---------------------------------------------------------------------------

/**
 * Proves getActiveByCaseId (trustee-case-appointments.mongo.repository.ts) returns the NEWEST
 * of several active appointments on one case (assignedOn DESCENDING — the newer trustee wins a
 * momentary duplicate-active-appointment race), and — in azure mode, where index-policy
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
    active?.trusteeId === SORT_INDEX_TRUSTEE_NEWER &&
    active?.assignedOn === SORT_INDEX_ASSIGNED_ON_NEWER
  ) {
    pass(
      '5. getActiveByCaseId returns the MOST RECENTLY ASSIGNED active appointment (assignedOn DESCENDING), not an arbitrary one',
    );
  } else {
    fail(`5. getActiveByCaseId: expected the newer appointment, got: ${JSON.stringify(active)}`);
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
    pass('6. seeded synced case, trustee, and active appointment');
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
  };

  const firstPass = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [event]);
  const secondPass = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [event]);
  if (firstPass.scenarioDistribution.autoMatchCount === 1) {
    pass('6. first pass auto-matches (name match, unique fixture name)');
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
// Stage 7 — dual-partition divergence repair proof
// ---------------------------------------------------------------------------

/**
 * Proves applyResolvedTrustee's existsInTrusteePartition check (see
 * sync-trustee-case-appointments.ts) detects and repairs a genuinely diverged dual-write against
 * real Mongo: seeds an active row directly into casePartition (case-trustee-appointments) only,
 * leaving trusteePartition (trustee-case-appointments) with no matching document — the exact
 * state a transient failure on the second half of upsert()'s sequential dual-write would leave
 * behind. Then runs the same event through processAppointments once and checks that
 * trusteePartition now has the matching row. A mocked-repository unit test can only assert
 * existsInTrusteePartition/replaceOneInTrusteePartition were called with the right arguments —
 * it cannot prove the repaired document is actually queryable back out of a real trustee
 * partition collection afterward, which is what this stage checks directly.
 */
async function runDivergenceRepairStage(
  deps: ReturnType<typeof SyncTrusteeCaseAppointmentsUseCase.createDeps>,
) {
  console.log(
    '\nStage 7: dual-partition divergence repair — casePartition active, trusteePartition missing, real repository\n',
  );

  const now = new Date().toISOString();
  const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
  const { client, db } = await getMongoDb();
  try {
    await db.collection('cases').replaceOne(
      { documentType: 'SYNCED_CASE', caseId: DIVERGENCE_CASE_ID },
      {
        documentType: 'SYNCED_CASE',
        caseId: DIVERGENCE_CASE_ID,
        dxtrId: DIVERGENCE_CASE_ID,
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
        caseTitle: 'Divergence Stage Debtor',
        dateFiled: '2026-01-01',
        debtor: { name: 'Divergence Stage Debtor' },
        updatedOn: now,
        updatedBy: systemUser,
      },
      { upsert: true },
    );

    await db.collection('trustees').replaceOne(
      { documentType: 'TRUSTEE', trusteeId: DIVERGENCE_TRUSTEE.id },
      {
        documentType: 'TRUSTEE',
        trusteeId: DIVERGENCE_TRUSTEE.id,
        name: DIVERGENCE_TRUSTEE.name,
        firstName: 'Divergence',
        middleName: 'P',
        lastName: 'Trustee',
        public: {
          address: {
            address1: '1 Divergence Rd',
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

    await db.collection('trustee-appointments').replaceOne(
      { documentType: 'TRUSTEE_APPOINTMENT', trusteeId: DIVERGENCE_TRUSTEE.id, courtId: COURT_ID },
      {
        documentType: 'TRUSTEE_APPOINTMENT',
        trusteeId: DIVERGENCE_TRUSTEE.id,
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

    // Seed the divergence directly: an active row in casePartition only. This is the exact
    // state left behind by a transient failure on upsert()'s trusteePartition write after its
    // casePartition write already succeeded.
    await db.collection('case-trustee-appointments').replaceOne(
      { documentType: 'CASE_APPOINTMENT', caseId: DIVERGENCE_CASE_ID },
      {
        documentType: 'CASE_APPOINTMENT',
        caseId: DIVERGENCE_CASE_ID,
        trusteeId: DIVERGENCE_TRUSTEE.id,
        assignedOn: DIVERGENCE_ASSIGNED_ON,
        appointedDate: DIVERGENCE_ASSIGNED_ON,
        chapter: CHAPTER,
        courtDivisionCode: DIV,
        updatedOn: now,
        updatedBy: systemUser,
        createdOn: now,
        createdBy: systemUser,
      },
      { upsert: true },
    );
    pass('7. seeded casePartition-only active appointment (trusteePartition deliberately empty)');

    const trusteePartitionBefore = await db
      .collection('trustee-case-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', caseId: DIVERGENCE_CASE_ID })
      .toArray();
    if (trusteePartitionBefore.length === 0) {
      pass('7. confirmed trusteePartition has no matching document before repair');
    } else {
      fail(
        `7. expected trusteePartition to be empty before repair, found ${trusteePartitionBefore.length} document(s)`,
      );
    }
  } finally {
    await client.close();
  }

  const event: TrusteeAppointmentSyncEvent = {
    caseId: DIVERGENCE_CASE_ID,
    courtId: COURT_ID,
    // firstName/lastName must be distinct from every other stage's dxtrTrustee: buildVariant
    // substitutes empty strings for missing fields (see trustee-variant.helpers.ts), so a
    // fullName-only dxtrTrustee (Stage 6's shape) produces an identical all-blank fingerprint
    // for every stage using it, colliding on the same TRUSTEE_VARIATION bucket entry.
    dxtrTrustee: {
      fullName: DIVERGENCE_TRUSTEE.name,
      firstName: 'Divergence',
      lastName: 'Trustee',
    },
    appointedDate: DIVERGENCE_ASSIGNED_ON,
    chapter: CHAPTER,
    courtDivisionCode: DIV,
  };

  const result = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, [event]);
  if (result.dlqMessages.length === 0 && result.scenarioDistribution.autoMatchCount === 1) {
    pass('7. processAppointments handles the same-trustee-already-active event without error');
  } else {
    fail(
      `7. expected no DLQ messages and autoMatchCount 1, got dlqMessages=${result.dlqMessages.length}, autoMatchCount=${result.scenarioDistribution.autoMatchCount}`,
    );
  }

  const { client: repairClient, db: repairDb } = await getMongoDb();
  try {
    const trusteePartitionAfter = await repairDb
      .collection('trustee-case-appointments')
      .find({ documentType: 'CASE_APPOINTMENT', caseId: DIVERGENCE_CASE_ID })
      .toArray();
    if (
      trusteePartitionAfter.length === 1 &&
      trusteePartitionAfter[0].trusteeId === DIVERGENCE_TRUSTEE.id &&
      trusteePartitionAfter[0].assignedOn === DIVERGENCE_ASSIGNED_ON
    ) {
      pass(
        '7. trusteePartition repaired: exactly ONE matching document now exists after reprocessing (existsInTrusteePartition + replaceOneInTrusteePartition against real Mongo)',
      );
    } else {
      fail(
        `7. expected exactly 1 repaired trusteePartition document, got ${trusteePartitionAfter.length}: ${JSON.stringify(trusteePartitionAfter)}`,
      );
    }
  } finally {
    await repairClient.close();
  }
}

// ---------------------------------------------------------------------------
// Stage 8 — bad REC date falls back to TX_DATE
// ---------------------------------------------------------------------------

/**
 * Proves CasesDxtrGateway.getTrusteeAppointments (cases.dxtr.gateway.ts) falls back to
 * TX.TX_DATE when REC's fixed-width embedded appointment date is blank/unparseable, against a
 * real SQL Server AO_TX row rather than a mocked query result. A mocked-gateway
 * unit test can assert the TypeScript fallback logic runs, but only a real database round trip
 * proves the SQL actually compiles and returns the expected value shape — this is exactly how
 * an earlier version of this fallback (using FORMAT(TX.TX_DATE, 'yyyy-MM-dd')) was caught
 * failing against a real SQL Edge container with "Common Language Runtime(CLR) is not enabled
 * on this instance." and replaced with CONVERT(VARCHAR(10), TX.TX_DATE, 120), which has no CLR
 * dependency. Standalone: not part of the 12-scenario matching pipeline, no Cosmos writes.
 */
async function runBadRecDateFallbackStage(
  deps: ReturnType<typeof SyncTrusteeCaseAppointmentsUseCase.createDeps>,
) {
  console.log('\nStage 8: bad REC date falls back to TX_DATE — real DXTR round trip, no mocks\n');

  const { events } = await deps.casesGateway.getTrusteeAppointments(
    deps.context,
    '2026-01-01T00:00:00.000Z',
  );
  const event = events.find((e) => e.caseId === BAD_REC_DATE_CASE_ID);

  if (!event) {
    fail(`8. expected an event for case ${BAD_REC_DATE_CASE_ID}, found none`);
    return;
  }

  if (event.appointedDate === BAD_REC_DATE_TX_DATE) {
    pass(
      `8. appointedDate fell back to TX_DATE (${BAD_REC_DATE_TX_DATE}) when REC's embedded date was blank`,
    );
  } else {
    fail(
      `8. expected appointedDate ${BAD_REC_DATE_TX_DATE} (TX_DATE fallback), got ${event.appointedDate}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Stage 9 — sentinel professional code skip rule
// ---------------------------------------------------------------------------

/**
 * Proves the sentinel professional code skip rule against a real DXTR round trip —
 * both that CasesDxtrGateway correctly extracts profCode from REC's fixed-width offset (17-21
 * for TX_TYPE='A'/TX_CODE='TR'), and that sync-trustee-case-appointments.ts's
 * isSentinelWithNoIdentity/isBogusTrusteeName correctly decide skip vs. proceed against real
 * query results rather than a hand-built mock event. Standalone: not part of the 13-scenario
 * matching pipeline (seed/01-seed-dxtr-data.sql fixtures 15a-15d, CS_CASEID 999999414-417,
 * excluded from ALL_CASE_IDS) — this stage seeds only the two Cosmos SYNCED_CASE fixtures the
 * two non-skipped cases (15b, 15c) need to reach NO_TRUSTEE_MATCH, rather than joining the full
 * pipeline's shared fixture set and expectation counts.
 */
async function runSentinelProfCodeStage(
  deps: ReturnType<typeof SyncTrusteeCaseAppointmentsUseCase.createDeps>,
) {
  console.log('\nStage 9: sentinel professional code skip rule — real DXTR round trip, no mocks\n');

  const now = new Date().toISOString();
  const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
  // 15b (bogus name, real contact) and 15c (genuine name and address) are both expected to
  // reach matching — a bogus-looking name must never override real contact info — so both need
  // a SYNCED_CASE fixture. 15a and 15d have no usable demographics at all and are skipped
  // before ever reaching the cases collection.
  const casesReachingMatching = [
    { caseId: SENTINEL_BOGUS_NAME_WITH_CONTACT_CASE_ID, debtorName: 'Scenario Debtor Sentinel B' },
    { caseId: SENTINEL_GENUINE_NAME_AND_ADDRESS_CASE_ID, debtorName: 'Scenario Debtor Sentinel C' },
  ];
  const { client, db } = await getMongoDb();
  try {
    for (const { caseId, debtorName } of casesReachingMatching) {
      await db.collection('cases').replaceOne(
        { documentType: 'SYNCED_CASE', caseId },
        {
          documentType: 'SYNCED_CASE',
          caseId,
          dxtrId: caseId,
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
          caseTitle: debtorName,
          dateFiled: '2026-01-01',
          debtor: { name: debtorName },
          updatedOn: now,
          updatedBy: systemUser,
        },
        { upsert: true },
      );
    }
  } finally {
    await client.close();
  }

  const stageCaseIds = [
    SENTINEL_NO_NAME_NO_ADDRESS_CASE_ID,
    SENTINEL_BOGUS_NAME_WITH_CONTACT_CASE_ID,
    SENTINEL_GENUINE_NAME_AND_ADDRESS_CASE_ID,
    NON_SENTINEL_EMPTY_DEMOGRAPHICS_CASE_ID,
  ];

  const { events } = await deps.casesGateway.getTrusteeAppointments(
    deps.context,
    '2026-01-01T00:00:00.000Z',
  );
  const stageEvents = events.filter((e) => stageCaseIds.includes(e.caseId));

  if (stageEvents.length === stageCaseIds.length) {
    pass(`9. getTrusteeAppointments returned all ${stageCaseIds.length} Stage 9 events`);
  } else {
    fail(`9. expected ${stageCaseIds.length} Stage 9 events, got ${stageEvents.length}`);
    return;
  }

  const profCodeByCase = new Map(stageEvents.map((e) => [e.caseId, e.profCode]));
  const expectedProfCodes: [string, string][] = [
    [SENTINEL_NO_NAME_NO_ADDRESS_CASE_ID, '00000'],
    [SENTINEL_BOGUS_NAME_WITH_CONTACT_CASE_ID, '99999'],
    [SENTINEL_GENUINE_NAME_AND_ADDRESS_CASE_ID, '00000'],
    [NON_SENTINEL_EMPTY_DEMOGRAPHICS_CASE_ID, '12345'],
  ];
  for (const [caseId, expected] of expectedProfCodes) {
    if (profCodeByCase.get(caseId) === expected) {
      pass(`9. ${caseId} profCode correctly extracted from REC offset 17-21 as "${expected}"`);
    } else {
      fail(`9. ${caseId}: expected profCode "${expected}", got "${profCodeByCase.get(caseId)}"`);
    }
  }

  const result = await SyncTrusteeCaseAppointmentsUseCase.processAppointments(deps, stageEvents);

  // 15a and 15d are both expected to be skipped before matching — neither has any usable
  // demographics at all — via the pre-existing empty-demographics rule (15a's sentinel profCode
  // is irrelevant here since the record has nothing to found an identity on either way; 15d's
  // non-sentinel profCode never even reaches the sentinel-specific logic). Asserted individually
  // below (not just via the aggregate counter) so a mix-up between which case skipped can't hide
  // behind a correct total.
  if (result.scenarioDistribution.emptyDemographicsSkippedCount === 2) {
    pass('9. emptyDemographicsSkippedCount is 2 (15a, 15d)');
  } else {
    fail(
      `9. expected emptyDemographicsSkippedCount 2, got ${result.scenarioDistribution.emptyDemographicsSkippedCount}`,
    );
  }
  if (result.scenarioDistribution.sentinelBogusNameSkippedCount === 0) {
    pass('9. sentinelBogusNameSkippedCount is 0 — 15b was NOT skipped (real contact present)');
  } else {
    fail(
      `9. expected sentinelBogusNameSkippedCount 0, got ${result.scenarioDistribution.sentinelBogusNameSkippedCount}`,
    );
  }

  const { client: verifyClient, db: verifyDb } = await getMongoDb();
  try {
    // 15a, 15d: skipped before matching — no verification doc should exist for either.
    for (const [label, caseId] of [
      ['15a', SENTINEL_NO_NAME_NO_ADDRESS_CASE_ID],
      ['15d', NON_SENTINEL_EMPTY_DEMOGRAPHICS_CASE_ID],
    ] as const) {
      const verification = await verifyDb
        .collection('trustee-match-verification')
        .findOne({ caseId });
      if (!verification) {
        pass(`9. ${label} (${caseId}) was skipped — no verification doc written`);
      } else {
        fail(
          `9. ${label} (${caseId}) expected no verification doc, got: ${JSON.stringify(verification)}`,
        );
      }
    }

    // 15b, 15c: both expected to proceed to matching, resolve to NO_TRUSTEE_MATCH (no seeded
    // trustee named "Not Assigned - XX" or "Jane A Example"), and write a pending
    // trustee-match-verification doc — proof neither was skipped, since a skipped event never
    // reaches upsertMatchVerification at all.
    for (const [label, caseId] of [
      ['15b', SENTINEL_BOGUS_NAME_WITH_CONTACT_CASE_ID],
      ['15c', SENTINEL_GENUINE_NAME_AND_ADDRESS_CASE_ID],
    ] as const) {
      const verification = await verifyDb
        .collection('trustee-match-verification')
        .findOne({ caseId });
      if (
        verification?.status === 'pending' &&
        verification?.mismatchReason === 'NO_TRUSTEE_MATCH'
      ) {
        pass(
          `9. ${label} (${caseId}) was NOT skipped — reached matching and wrote a pending NO_TRUSTEE_MATCH verification`,
        );
      } else {
        fail(
          `9. ${label} (${caseId}) expected a pending NO_TRUSTEE_MATCH verification, got: ${JSON.stringify(verification)}`,
        );
      }
    }
  } finally {
    await verifyClient.close();
  }
}

// ---------------------------------------------------------------------------
// Stage 10 — district/chapter cross-appointment scoring
// ---------------------------------------------------------------------------

/**
 * Proves calculateChapterScore (trustee-match.helpers.ts) scopes chapter evidence to only the
 * active appointments that also cover the case's court+division, against a real Mongo read (no
 * mocked repositories) — direct-Cosmos proof, no DXTR round trip needed since
 * resolveNameCollisionByScoring/calculateCandidateScore consume TrusteeAppointment[] +
 * court/division/chapter values only.
 *
 * Seeds one trustee with two active appointments in different divisions/chapters (division A/
 * chapter 7, division B/chapter 13), then calls resolveNameCollisionByScoring directly for a case
 * whose division matches ONLY the first appointment and whose chapter matches ONLY the second
 * (unrelated-division) appointment. If chapter evidence weren't scoped to division-matching
 * appointments, this exact fixture would score chapterScore=100 despite no single appointment
 * covering the case's division+chapter combination. Asserts chapterScore=0 and
 * districtDivisionScore=100 (the division score is unaffected — only chapter evidence needed
 * scoping).
 */
async function runCrossAppointmentScoringStage(context: Awaited<ReturnType<typeof getAppContext>>) {
  console.log(
    '\nStage 10: district/chapter cross-appointment scoring — real Mongo read, no mocks\n',
  );

  const now = new Date().toISOString();
  const systemUser = { id: 'SYSTEM', name: 'SYSTEM' };
  const { client, db } = await getMongoDb();
  try {
    await db.collection('trustees').replaceOne(
      { documentType: 'TRUSTEE', trusteeId: CROSS_APPOINTMENT_TRUSTEE.id },
      {
        documentType: 'TRUSTEE',
        trusteeId: CROSS_APPOINTMENT_TRUSTEE.id,
        name: CROSS_APPOINTMENT_TRUSTEE.name,
        firstName: 'CrossAppt',
        middleName: 'M',
        lastName: 'ScoringTrustee',
        public: {
          address: {
            address1: '10 Cross Appointment Rd',
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

    const appointmentSpecs = [
      {
        id: 'appointment-cross-div-a',
        divisionCode: CROSS_APPOINTMENT_DIV_A,
        chapter: CROSS_APPOINTMENT_CHAPTER_A,
      },
      {
        id: 'appointment-cross-div-b',
        divisionCode: CROSS_APPOINTMENT_DIV_B,
        chapter: CROSS_APPOINTMENT_CHAPTER_B,
      },
    ];
    for (const spec of appointmentSpecs) {
      await db.collection('trustee-appointments').replaceOne(
        { documentType: 'TRUSTEE_APPOINTMENT', id: spec.id },
        {
          documentType: 'TRUSTEE_APPOINTMENT',
          id: spec.id,
          trusteeId: CROSS_APPOINTMENT_TRUSTEE.id,
          chapter: spec.chapter,
          appointmentType: 'panel',
          courtId: COURT_ID,
          divisionCode: spec.divisionCode,
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
    pass(
      `10. seeded trustee ${CROSS_APPOINTMENT_TRUSTEE.id} with active appointments in division ${CROSS_APPOINTMENT_DIV_A}/chapter ${CROSS_APPOINTMENT_CHAPTER_A} and division ${CROSS_APPOINTMENT_DIV_B}/chapter ${CROSS_APPOINTMENT_CHAPTER_B}`,
    );
  } finally {
    await client.close();
  }

  const event: TrusteeAppointmentSyncEvent = {
    caseId: 'cross-appointment-scoring-case',
    courtId: CROSS_APPOINTMENT_CASE_COURT_ID,
    courtDivisionCode: CROSS_APPOINTMENT_CASE_DIVISION,
    chapter: CROSS_APPOINTMENT_CASE_CHAPTER,
    dxtrTrustee: {
      fullName: CROSS_APPOINTMENT_TRUSTEE.name,
      firstName: 'CrossAppt',
      lastName: 'ScoringTrustee',
    },
  };

  const outcome = await resolveNameCollisionByScoring(context, event, [
    CROSS_APPOINTMENT_TRUSTEE.id,
  ]);

  if (outcome.kind === 'no-match') {
    fail('10. resolveNameCollisionByScoring returned no-match — expected a scored candidate');
    return;
  }

  const candidate = outcome.candidateScores.find(
    (c) => c.trusteeId === CROSS_APPOINTMENT_TRUSTEE.id,
  );
  if (!candidate) {
    fail(
      `10. no candidateScore found for ${CROSS_APPOINTMENT_TRUSTEE.id}: ${JSON.stringify(outcome.candidateScores)}`,
    );
    return;
  }

  if (candidate.districtDivisionScore === 100) {
    pass('10. districtDivisionScore=100 (case division matches the first appointment)');
  } else {
    fail(`10. expected districtDivisionScore=100, got ${candidate.districtDivisionScore}`);
  }

  if (candidate.chapterScore === 0) {
    pass(
      "10. chapterScore=0 — chapter evidence correctly scoped to division-matching appointments only, not the trustee's full appointment history",
    );
  } else {
    fail(
      `10. REGRESSION: expected chapterScore=0, got ${candidate.chapterScore} — chapter is being credited from an appointment in an unrelated division`,
    );
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
      console.log(`  4. ${HARNESS} seed-cosmos  (seed synced cases, trustees, appointments)`);
      console.log(`  5. ${HARNESS} run          (read DXTR → match → write, then assert)`);
      console.log(`  6. ${HARNESS} clean        (remove all test data from both databases)`);
      console.log('  7. ./trustee-match-scenarios/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env    Verify required environment variables');
      console.log('  seed-schema  [local] Create DXTR_INT + apply AO_* DDL');
      console.log('  seed-sql     Seed AO_CS_DIV/AO_CS/AO_PY/AO_TX fixture rows for 13 scenarios');
      console.log('  seed-cosmos  Seed synced cases, trustees, appointments');
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
