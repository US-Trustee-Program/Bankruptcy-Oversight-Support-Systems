/**
 * Integration harness for the three ustDivisionCode backfill migrations (CAMS-936, cams-4m7g0),
 * driven against a real MongoDB and a real SQL Server. No mocks.
 *
 * Why all three live in one harness rather than three: they are *sequenced*. The verification
 * backfill reads what the case backfill writes, and the appointment backfill has to land before
 * trustee sync resumes or a re-synced case cannot match its own trustee. The ordering is the
 * riskiest part of the rollout and no per-migration harness can exercise it, so `run-all` runs
 * them in the documented production order and asserts the intermediate states.
 *
 * Why a real SQL Server and not just Mongo: backfill-appointment-ust-division-codes resolves its
 * ACMS -> bare code map from OfficesDxtrGateway.getOffices(), whose ustDivisionCode column is the
 * CASE expression built by ustDivisionCodeSelect. Unit tests can only assert that SQL's *text* —
 * their mocked recordsets already contain whatever ustDivisionCode the test wants — so
 * `run-offices` is the only place the expression's actual behaviour is proven, including that
 * court 113E, whose codes also diverge but which sits outside the scoped court list, still
 * returns its ACMS code.
 *
 * Covers, per cams-4m7g0:
 *   - Winchester (494) and Johnson City (495) resolved distinctly from the Chattanooga (491) and
 *     Greeneville (492) siblings that share their ACMS code.
 *   - Documents outside court 0649 left untouched.
 *   - An existing ustDivisionCode never overwritten.
 *   - Idempotent re-run: a second pass is a no-op.
 *   - Ordering: the verification backfill skips rather than guesses when the case backfill has not
 *     run yet, and picks those documents up on a later pass once it has.
 *
 * Usage (from test/integration/):
 *   npm run ust-division-backfills -- <command>
 *
 * Local workflow:
 *   1. cd ust-division-backfills/scripts && cp .env.template .env   # set MSSQL_PASS
 *   2. ./start-services.sh
 *   3. cd ../.. && cp ust-division-backfills/.env.local.template ust-division-backfills/.env.local
 *   4. npm run ust-division-backfills -- seed-schema
 *   5. npm run ust-division-backfills -- seed-sql
 *   6. npm run ust-division-backfills -- run-all
 *   7. npm run ust-division-backfills -- clean
 *   8. cd ust-division-backfills/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed-schema         Create DXTR_INT and apply the offices DDL
 *   seed-sql            Load the DXTR offices fixture rows (0649 + 113E)
 *   seed                Insert the Cosmos before-state documents
 *   run-offices         Prove ustDivisionCodeSelect against real SQL
 *   run-cases           BACKFILL-UST-DIVISION-CODE over SYNCED_CASE
 *   run-appointments    BACKFILL-APPOINTMENT-UST-DIVISION-CODES over TRUSTEE_APPOINTMENT
 *   run-verifications   BACKFILL-VERIFICATION-UST-DIVISION-CODE over TRUSTEE_MATCH_VERIFICATION
 *   run-ordering        Prove verifications skip before the case backfill has run
 *   run-all             seed + every run above, in production rollout order
 *   clean               Remove all fixture documents and backfill state
 *   help                Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as sql from 'mssql';
import { MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { finalizeDeferrable } from '../../../../backend/lib/deferrable/finalize-deferrable';
import { ApplicationContext } from '../../../../backend/lib/adapters/types/basic';
import OfficesDxtrGateway from '../../../../backend/lib/adapters/gateways/dxtr/offices.dxtr.gateway';
import BackfillUstDivisionCodeUseCase from '../../../../backend/lib/use-cases/dataflows/backfill-ust-division-code';
import BackfillAppointmentUstDivisionCodesUseCase from '../../../../backend/lib/use-cases/dataflows/backfill-appointment-ust-division-codes';
import BackfillVerificationUstDivisionCodeUseCase from '../../../../backend/lib/use-cases/dataflows/backfill-verification-ust-division-code';

const HARNESS_DIR = path.resolve(__dirname, '../');
const SEED_DIR = path.join(HARNESS_DIR, 'seed');

const CASES_COLLECTION = 'cases';
const APPOINTMENTS_COLLECTION = 'trustee-appointments';
const VERIFICATIONS_COLLECTION = 'trustee-match-verification';
const RUNTIME_STATE_COLLECTION = 'runtime-state';

// Every fixture document carries this so `clean` removes exactly what the harness created and
// nothing else, even when pointed at a shared lower environment.
const FIXTURE_TAG = 'UST-DIVISION-BACKFILL-HARNESS';

// Small enough that every backfill has to paginate — a cursor that fails to advance shows up as a
// non-terminating run rather than passing silently on a single page.
const PAGE_SIZE = 2;
const MAX_PAGES = 20;

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} — copy .env.local.template and fill it in (see this file's header).`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath });

  for (const required of ['MONGO_CONNECTION_STRING', 'MSSQL_PASS']) {
    if (!process.env[required]) {
      console.error(`${required} is not set in .env.local.`);
      process.exit(1);
    }
  }
}

loadEnv();

const DXTR_DATABASE = process.env.MSSQL_DATABASE_DXTR || 'DXTR_INT';

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

let failures = 0;

const pass = (msg: string) => console.log(`  ✓ ${msg}`);
const info = (msg: string) => console.log(`    ${msg}`);
const heading = (msg: string) => console.log(`\n${msg}\n${'─'.repeat(msg.length)}`);

function fail(msg: string, detail?: unknown) {
  failures++;
  console.error(`  ✗ ${msg}`);
  if (detail !== undefined) console.error(`      got: ${JSON.stringify(detail)}`);
}

function check(condition: boolean, msg: string, detail?: unknown) {
  if (condition) pass(msg);
  else fail(msg, detail);
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

async function withMongo<T>(fn: (db: ReturnType<MongoClient['db']>) => Promise<T>): Promise<T> {
  const client = new MongoClient(process.env.MONGO_CONNECTION_STRING!);
  await client.connect();
  try {
    return await fn(client.db(process.env.COSMOS_DATABASE_NAME || 'cams-integration'));
  } finally {
    await client.close();
  }
}

/**
 * The backfills run through the production factory, so they read the same env the function app
 * would; `.env.local` points that env at the harness containers.
 *
 * Each caller gets its own context and finalizes it, matching backfill-unassigned-on — a context
 * left unfinalized holds Mongo connections open and the process never exits.
 */
async function withContext<T>(fn: (context: ApplicationContext) => Promise<T>): Promise<T> {
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
  });
  try {
    return await fn(context);
  } finally {
    await finalizeDeferrable(context);
  }
}

async function getDxtrSqlPool(database: string): Promise<sql.ConnectionPool> {
  const config: sql.config = {
    server: process.env.MSSQL_HOST || 'localhost',
    port: Number(process.env.MSSQL_PORT) || 1433,
    database,
    user: process.env.MSSQL_USER || 'sa',
    password: process.env.MSSQL_PASS,
    options: {
      encrypt: process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() !== 'false',
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
  };
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
    try {
      await pool.request().query(batches[i]);
    } catch (err) {
      throw new Error(
        `Batch ${i + 1} of ${batches.length} in ${path.basename(filePath)} failed:\n` +
          `${batches[i].slice(0, 200)}...\n\n${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Pagination driver
// ---------------------------------------------------------------------------

type PageResult =
  | { status: 'error'; error: { message: string } }
  | { status: 'empty' }
  // The appointment backfill reports only a cursor — its progress counts live in its state
  // document rather than the page result — so both count fields are optional here.
  | {
      status: 'ok';
      successCount?: number;
      skippedCount?: number;
      nextCursor: { lastId: string | null } | null;
    };

type PageTotals = { pages: number; written: number; skipped: number; counted: boolean } | null;

/**
 * Drives a backfill to completion the way its queue handler would, re-queueing the cursor until
 * the run reports no next page. Returns null on failure so callers can bail before asserting.
 *
 * The MAX_PAGES ceiling is the point of using a tiny PAGE_SIZE: a backfill whose cursor does not
 * advance past documents it skipped would otherwise re-read the same page forever, which in
 * production is an endlessly re-queueing migration rather than a visible failure.
 */
async function pageThrough(
  label: string,
  processPage: (cursor: string | null) => Promise<PageResult>,
): Promise<PageTotals> {
  let cursor: string | null = null;
  let pages = 0;
  let written = 0;
  let skipped = 0;
  let counted = false;

  for (;;) {
    const result = await processPage(cursor);
    pages++;

    if (result.status === 'error') {
      fail(`${label} page ${pages} returned an error`, result.error.message);
      return null;
    }
    if (result.status === 'empty') break;

    if (result.successCount !== undefined) {
      counted = true;
      written += result.successCount;
    }
    skipped += result.skippedCount ?? 0;

    if (!result.nextCursor) break;
    cursor = result.nextCursor.lastId;

    if (pages >= MAX_PAGES) {
      fail(`${label} did not terminate within ${MAX_PAGES} pages — the cursor is not advancing`);
      return null;
    }
  }

  info(
    counted
      ? `${label}: ${pages} page(s), ${written} written, ${skipped} skipped`
      : `${label}: ${pages} page(s) (counts recorded in the backfill state document)`,
  );
  return { pages, written, skipped, counted };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/**
 * Court 0649 cases, one per division, plus a 113E case that must be left alone.
 *
 * Winchester and Johnson City deliberately omit ustDivisionCode — they are the before-state the
 * case backfill resolves by division *name*, since their ACMS code alone cannot distinguish them
 * from Chattanooga and Greeneville.
 */
const SYNCED_CASES = [
  {
    caseId: '491-26-90001',
    courtDivisionName: 'Winchester',
    courtDivisionCode: '491',
    courtId: '0649',
    expected: '494',
    note: 'diverges — must become 494, not Chattanooga’s 491',
  },
  {
    caseId: '492-26-90002',
    courtDivisionName: 'Johnson City',
    courtDivisionCode: '492',
    courtId: '0649',
    expected: '495',
    note: 'diverges — must become 495, not Greeneville’s 492',
  },
  {
    caseId: '492-26-90003',
    courtDivisionName: 'Greeneville',
    courtDivisionCode: '492',
    courtId: '0649',
    expected: '492',
    note: 'shares ACMS 492 with Johnson City but keeps its own bare code',
  },
  {
    caseId: '493-26-90004',
    courtDivisionName: 'Knoxville',
    courtDivisionCode: '493',
    courtId: '0649',
    expected: '493',
    note: 'unshared ACMS code — falls through the map untouched',
  },
  {
    caseId: '321-26-90005',
    courtDivisionName: 'Atlanta',
    courtDivisionCode: '321',
    courtId: '113E',
    expected: undefined,
    note: 'outside court 0649 — must stay untouched',
  },
];

// Already correct before the run, to prove the write filter skips documents that need nothing.
const PRESET_CASE = {
  caseId: '491-26-90006',
  courtDivisionName: 'Chattanooga',
  courtDivisionCode: '491',
  courtId: '0649',
  preset: '491',
};

function syncedCaseDoc(c: {
  caseId: string;
  courtId: string;
  courtDivisionCode: string;
  courtDivisionName: string;
  preset?: string;
}) {
  return {
    documentType: 'SYNCED_CASE',
    caseId: c.caseId,
    courtId: c.courtId,
    courtDivisionCode: c.courtDivisionCode,
    courtDivisionName: c.courtDivisionName,
    courtName:
      c.courtId === '0649' ? 'Eastern District of Tennessee' : 'Northern District of Georgia',
    chapter: '7',
    caseTitle: `${FIXTURE_TAG} ${c.caseId}`,
    dateFiled: '2026-01-07',
    ...(c.preset ? { ustDivisionCode: c.preset } : {}),
    harnessFixture: FIXTURE_TAG,
  };
}

const APPOINTMENTS = [
  {
    id: `${FIXTURE_TAG}-appt-chattanooga`,
    courtId: '0649',
    divisionCodes: ['491'],
    expected: ['491', '494'],
    note: 'ACMS 491 expands to both bare codes it covers',
  },
  {
    id: `${FIXTURE_TAG}-appt-greeneville`,
    courtId: '0649',
    divisionCodes: ['492'],
    expected: ['492', '495'],
    note: 'ACMS 492 expands to both bare codes it covers',
  },
  {
    id: `${FIXTURE_TAG}-appt-knoxville`,
    courtId: '0649',
    divisionCodes: ['493'],
    expected: ['493'],
    note: 'unshared — unchanged',
  },
  {
    id: `${FIXTURE_TAG}-appt-atlanta`,
    courtId: '113E',
    divisionCodes: ['321'],
    expected: ['321'],
    note: 'outside court 0649 — must stay untouched',
  },
];

function appointmentDoc(a: { id: string; courtId: string; divisionCodes: string[] }) {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    documentType: 'TRUSTEE_APPOINTMENT',
    id: a.id,
    trusteeId: `${a.id}-trustee`,
    courtId: a.courtId,
    divisionCodes: a.divisionCodes,
    chapter: '7',
    appointmentType: 'panel',
    status: 'active',
    appointedDate: '2024-01-01',
    effectiveDate: '2024-01-01',
    createdOn: now,
    updatedOn: now,
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    harnessFixture: FIXTURE_TAG,
  };
}

const VERIFICATIONS = [
  {
    id: `${FIXTURE_TAG}-verify-winchester`,
    caseId: '491-26-90001',
    courtId: '0649',
    status: 'pending',
    expected: '494',
    note: 'pre-CAMS-936 pending doc — takes 494 from its own synced case',
  },
  {
    id: `${FIXTURE_TAG}-verify-resolved`,
    caseId: '492-26-90002',
    courtId: '0649',
    status: 'resolved',
    expected: undefined,
    note: 'already left the review queue — nothing left to correct',
  },
  {
    id: `${FIXTURE_TAG}-verify-atlanta`,
    caseId: '321-26-90005',
    courtId: '113E',
    status: 'pending',
    expected: undefined,
    note: 'outside court 0649 — must stay untouched',
  },
];

function verificationDoc(v: { id: string; caseId: string; courtId: string; status: string }) {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    id: v.id,
    caseId: v.caseId,
    courtId: v.courtId,
    dxtrTrustee: { fullName: `${FIXTURE_TAG} Trustee` },
    matchCandidates: [],
    mismatchReason: 'IMPERFECT_MATCH',
    taskType: 'trustee-match',
    status: v.status,
    taskDate: now,
    fingerprint: `fp-${v.id}`,
    variant: `{"harness":"${v.id}"}`,
    createdOn: now,
    updatedOn: now,
    updatedBy: { id: 'SYSTEM', name: 'SYSTEM' },
    harnessFixture: FIXTURE_TAG,
  };
}

// ---------------------------------------------------------------------------
// seed-schema / seed-sql
// ---------------------------------------------------------------------------

async function ensureDatabase(database: string): Promise<void> {
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`Database name '${database}' contains invalid characters`);
  }
  const master = await getDxtrSqlPool('master');
  try {
    await master.request().query(`
      IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${database}')
        CREATE DATABASE [${database}]
    `);
  } finally {
    await master.close();
  }
}

async function seedSchema() {
  heading(`Creating ${DXTR_DATABASE} and applying the offices DDL`);
  await ensureDatabase(DXTR_DATABASE);
  pass(`Database '${DXTR_DATABASE}' ready`);

  const pool = await getDxtrSqlPool(DXTR_DATABASE);
  try {
    await executeSqlFile(pool, path.join(SEED_DIR, '00-seed-dxtr-schema.sql'));
    pass('DXTR offices tables created');
  } finally {
    await pool.close();
  }
}

async function seedSql() {
  heading('Loading the DXTR offices fixture');
  const pool = await getDxtrSqlPool(DXTR_DATABASE);
  try {
    await executeSqlFile(pool, path.join(SEED_DIR, '01-seed-dxtr-offices.sql'));
    pass('Court 0649 (5 divisions) and court 113E (1 division) loaded');
  } finally {
    await pool.close();
  }
}

// ---------------------------------------------------------------------------
// seed / clean
// ---------------------------------------------------------------------------

async function seed() {
  heading('Seeding Cosmos before-state');
  await clean({ quiet: true });

  await withMongo(async (db) => {
    const caseDocs = [...SYNCED_CASES.map(syncedCaseDoc), syncedCaseDoc(PRESET_CASE)];
    await db.collection(CASES_COLLECTION).insertMany(caseDocs);
    pass(`${caseDocs.length} SYNCED_CASE documents`);
    for (const c of SYNCED_CASES) info(`${c.caseId} ${c.courtDivisionName} — ${c.note}`);
    info(`${PRESET_CASE.caseId} Chattanooga — already 491, must not be rewritten`);

    await db.collection(APPOINTMENTS_COLLECTION).insertMany(APPOINTMENTS.map(appointmentDoc));
    pass(`${APPOINTMENTS.length} TRUSTEE_APPOINTMENT documents`);
    for (const a of APPOINTMENTS) info(`[${a.divisionCodes.join(', ')}] — ${a.note}`);

    await db.collection(VERIFICATIONS_COLLECTION).insertMany(VERIFICATIONS.map(verificationDoc));
    pass(`${VERIFICATIONS.length} TRUSTEE_MATCH_VERIFICATION documents`);
    for (const v of VERIFICATIONS) info(`${v.status} — ${v.note}`);
  });
}

async function clean({ quiet = false }: { quiet?: boolean } = {}) {
  if (!quiet) heading('Removing fixtures and backfill state');
  await withMongo(async (db) => {
    for (const collection of [
      CASES_COLLECTION,
      APPOINTMENTS_COLLECTION,
      VERIFICATIONS_COLLECTION,
    ]) {
      const { deletedCount } = await db
        .collection(collection)
        .deleteMany({ harnessFixture: FIXTURE_TAG });
      if (!quiet) pass(`${collection}: ${deletedCount} removed`);
    }
    // Both paged backfills refuse to restart a completed run, so their state documents have to go
    // or a re-run of this harness would be a silent no-op. Same reason the production runbook says
    // to delete state before any re-run.
    const { deletedCount: stateCount } = await db.collection(RUNTIME_STATE_COLLECTION).deleteMany({
      documentType: {
        $in: ['UST_DIVISION_CODE_BACKFILL_STATE', 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE'],
      },
    });
    if (!quiet)
      pass(`${RUNTIME_STATE_COLLECTION}: ${stateCount} backfill state document(s) removed`);
  });
}

// ---------------------------------------------------------------------------
// run-offices — the assertion unit tests structurally cannot make
// ---------------------------------------------------------------------------

async function runOffices() {
  heading('ustDivisionCodeSelect against real SQL');

  const divisions = await withContext(async (context) => {
    const offices = await new OfficesDxtrGateway(context).getOffices(context);
    return offices.flatMap((o) => o.groups.flatMap((g) => g.divisions));
  });

  const byOffice = (name: string) => divisions.find((d) => d.courtOffice.courtOfficeName === name);

  // After CAMS-936 Phase 1 the gateway returns the bare code as tempCourtDivisionCode.
  const winchester = byOffice('Winchester');
  check(
    winchester?.tempCourtDivisionCode === '494' && winchester?.divisionCode === '491',
    'Winchester: bare 494 alongside ACMS 491 — the split this feature exists for',
    { temp: winchester?.tempCourtDivisionCode, acms: winchester?.divisionCode },
  );

  const johnsonCity = byOffice('Johnson City');
  check(
    johnsonCity?.tempCourtDivisionCode === '495' && johnsonCity?.divisionCode === '492',
    'Johnson City: bare 495 alongside ACMS 492',
    { temp: johnsonCity?.tempCourtDivisionCode, acms: johnsonCity?.divisionCode },
  );

  const chattanooga = byOffice('Chattanooga');
  check(
    chattanooga?.tempCourtDivisionCode === '491',
    'Chattanooga: 491, distinct from Winchester despite the shared ACMS code',
    chattanooga?.tempCourtDivisionCode,
  );

  // The regression the court scoping was added for. Court 113E's codes diverge too, but it sits
  // outside UST_DIVISION_CODE_COURT_IDS, so it must keep its ACMS code — bare 3E1 would match no
  // stored appointment in that court, and no backfill covers it.
  const atlanta = byOffice('Atlanta');
  check(
    atlanta?.tempCourtDivisionCode === '321',
    'Court 113E: ACMS 321, NOT bare 3E1 — scoping holds outside court 0649',
    atlanta?.tempCourtDivisionCode,
  );
}

// ---------------------------------------------------------------------------
// run-cases
// ---------------------------------------------------------------------------

async function runCases({ expectNoWrites = false }: { expectNoWrites?: boolean } = {}) {
  heading('BACKFILL-UST-DIVISION-CODE over SYNCED_CASE');

  const totals = await withContext((context) =>
    pageThrough('cases', (cursor) =>
      BackfillUstDivisionCodeUseCase.processBackfillPage(context, cursor, PAGE_SIZE),
    ),
  );
  if (!totals) return;

  if (expectNoWrites) {
    check(
      totals.written === 0,
      'Re-run writes nothing — every document already has its code',
      totals,
    );
  }

  await withMongo(async (db) => {
    for (const c of SYNCED_CASES) {
      const doc = await db
        .collection(CASES_COLLECTION)
        .findOne({ caseId: c.caseId, harnessFixture: FIXTURE_TAG });
      check(
        doc?.ustDivisionCode === c.expected,
        `${c.courtDivisionName}: ${c.expected ?? 'absent'} — ${c.note}`,
        doc?.ustDivisionCode,
      );
    }
    const preset = await db
      .collection(CASES_COLLECTION)
      .findOne({ caseId: PRESET_CASE.caseId, harnessFixture: FIXTURE_TAG });
    check(
      preset?.ustDivisionCode === PRESET_CASE.preset,
      'A case that already had ustDivisionCode is not rewritten',
      preset?.ustDivisionCode,
    );
  });
}

// ---------------------------------------------------------------------------
// run-appointments
// ---------------------------------------------------------------------------

async function runAppointments() {
  heading('BACKFILL-APPOINTMENT-UST-DIVISION-CODES over TRUSTEE_APPOINTMENT');

  const totals = await withContext(async (context) => {
    // Runs default to dry; a real run needs dryRun: false. The cutoff is normally the deploy
    // timestamp — anything updated later is already in the new shape.
    const cutoff = new Date(Date.now() + 60_000).toISOString();
    const started = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {
      cutoff,
      dryRun: false,
    });
    if (started.error) {
      fail('startBackfill rejected the start message', started.error.message);
      return null;
    }
    return pageThrough('appointments', (cursor) =>
      BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(context, cursor, PAGE_SIZE),
    );
  });
  if (!totals) return;

  await withMongo(async (db) => {
    for (const a of APPOINTMENTS) {
      const doc = await db
        .collection(APPOINTMENTS_COLLECTION)
        .findOne({ id: a.id, harnessFixture: FIXTURE_TAG });
      const actual = [...((doc?.divisionCodes as string[]) ?? [])].sort();
      check(
        JSON.stringify(actual) === JSON.stringify([...a.expected].sort()),
        `[${a.expected.join(', ')}] — ${a.note}`,
        actual,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// run-verifications
// ---------------------------------------------------------------------------

async function runVerifications() {
  heading('BACKFILL-VERIFICATION-UST-DIVISION-CODE over TRUSTEE_MATCH_VERIFICATION');

  const totals = await withContext((context) =>
    pageThrough('verifications', (cursor) =>
      BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(context, cursor, PAGE_SIZE),
    ),
  );
  if (!totals) return;

  await withMongo(async (db) => {
    for (const v of VERIFICATIONS) {
      const doc = await db
        .collection(VERIFICATIONS_COLLECTION)
        .findOne({ id: v.id, harnessFixture: FIXTURE_TAG });
      check(
        doc?.ustDivisionCode === v.expected,
        `${v.status} verification: ${v.expected ?? 'absent'} — ${v.note}`,
        doc?.ustDivisionCode,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// run-ordering
// ---------------------------------------------------------------------------

/**
 * The verification backfill copies each document's code from its own SYNCED_CASE, so running it
 * before the case backfill must skip rather than guess. Getting that wrong would stamp Winchester
 * verifications with the ACMS 491 and display them as Chattanooga permanently — the field would
 * then be present, so no later pass would select them again.
 */
async function runOrdering() {
  heading('Ordering: verifications before cases');
  await seed();

  const result = await withContext((context) =>
    BackfillVerificationUstDivisionCodeUseCase.processBackfillPage(context, null, 100),
  );

  if (result.status !== 'ok') {
    fail(`expected an ok result before the case backfill, got '${result.status}'`);
    return;
  }
  check(
    result.skippedCount > 0 && result.successCount === 0,
    'Winchester verification is skipped, not stamped with the ACMS code',
    { skipped: result.skippedCount, written: result.successCount },
  );

  await withMongo(async (db) => {
    const doc = await db
      .collection(VERIFICATIONS_COLLECTION)
      .findOne({ id: `${FIXTURE_TAG}-verify-winchester` });
    check(
      doc?.ustDivisionCode === undefined,
      'Skipped verification keeps the field absent, so a later pass still finds it',
      doc?.ustDivisionCode,
    );
  });

  heading('Ordering: the same documents after the case backfill');
  await runCases();
  await runVerifications();
}

// ---------------------------------------------------------------------------
// run-all — production rollout order
// ---------------------------------------------------------------------------

async function runAll() {
  await seed();
  await runOffices();

  // Appointments first, per the rollout ordering on PR #3136: a remapped appointment
  // (['491','494']) matches a Winchester case whether or not that case has been backfilled yet.
  // In the reverse order a backfilled case (494) cannot match an appointment still holding only
  // ['491'], and any trustee sync in that window leaves an ImperfectMatch verification behind
  // that the appointment backfill does not clear.
  await runAppointments();
  await runCases();
  await runVerifications();

  heading('Idempotency: a second pass over SYNCED_CASE');
  await clean({ quiet: true });
  await seed();
  await runCases();
  await runCases({ expectNoWrites: true });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const COMMANDS: Record<string, () => Promise<void>> = {
  'seed-schema': seedSchema,
  'seed-sql': seedSql,
  seed,
  'run-offices': runOffices,
  'run-cases': () => runCases(),
  'run-appointments': runAppointments,
  'run-verifications': runVerifications,
  'run-ordering': runOrdering,
  'run-all': runAll,
  clean: () => clean(),
};

function usage() {
  console.log(
    [
      '',
      'Usage (from test/integration/): npm run ust-division-backfills -- <command>',
      '',
      '  seed-schema         Create DXTR_INT and apply the offices DDL',
      '  seed-sql            Load the DXTR offices fixture rows (0649 + 113E)',
      '  seed                Insert the Cosmos before-state documents',
      '  run-offices         Prove ustDivisionCodeSelect against real SQL',
      '  run-cases           BACKFILL-UST-DIVISION-CODE over SYNCED_CASE',
      '  run-appointments    BACKFILL-APPOINTMENT-UST-DIVISION-CODES',
      '  run-verifications   BACKFILL-VERIFICATION-UST-DIVISION-CODE',
      '  run-ordering        Prove verifications skip before the case backfill has run',
      '  run-all             seed + every run above, in rollout order',
      '  clean               Remove all fixture documents and backfill state',
      '  help                Show this help',
      '',
    ].join('\n'),
  );
}

async function main() {
  const command = process.argv[2] ?? 'help';

  if (command === 'help') {
    usage();
    return;
  }

  const handler = COMMANDS[command];
  if (!handler) {
    console.error(`Unknown command '${command}'.`);
    usage();
    process.exit(1);
  }

  await handler();

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.\n`);
    process.exit(1);
  }
  console.log('\nAll checks passed.\n');
}

// The backend's Mongo repositories are reference-counted singletons shared across contexts, so
// finalizeDeferrable on each individual context does not necessarily close the last client — the
// event loop can stay alive after every check has printed. Exit explicitly rather than leaving a
// developer looking at completed output wondering whether the harness is still working.
main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\nHarness error: ${err instanceof Error ? err.stack : String(err)}\n`);
    process.exit(1);
  });
