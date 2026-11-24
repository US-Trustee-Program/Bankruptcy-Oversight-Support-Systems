/**
 * Integration harness for the trustee data report (CAMS-977).
 *
 * Seeds synthetic TOD rows into SQL Edge and CAMS trustees into MongoDB, starts runs through the
 * real start use case (which claims the run lock and enqueues the start message to Azurite), lets
 * the real dataflows function app process the pages, then asserts on what the run stored in the
 * trustee-data-report collection.
 *
 * Local only. The report reads every TOD trustee and every CAMS trustee, so its counts are only
 * predictable against databases that hold nothing but these fixtures; a shared lower-environment
 * TOD or Cosmos database does not qualify.
 *
 * This is a one-shot script, not a Vitest or Playwright test, and is not run in CI.
 *
 * Usage (from test/integration/):
 *   npm run trustee-data-report -- [command]
 *
 * Commands:
 *   check-env    Verify the environment the harness and the start use case need
 *   seed-schema  Create ATS_INT (TRUSTEES, CHAPTER_DETAILS) and DXTR_INT (offices tables)
 *   seed-sql     Replace all TOD rows with the fixtures
 *   seed-cosmos  Replace the fixture CAMS trustees and create the bicep-declared indexes
 *   run          clean, seed, then run every scenario and lifecycle check
 *   clean        Remove report results, fixture trustees and the run lock; clear the queues
 *   help         Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { QueueServiceClient } from '@azure/storage-queue';
import { Db, MongoClient } from 'mongodb';
import * as sql from 'mssql';
import {
  ExpectedDifference,
  FILLER_TOD_IDS,
  SCENARIOS,
  Scenario,
  TRUSTEE_ID_PREFIX,
  expectedSummary,
} from './trustee-data-report-fixtures';

const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

// Well-known Azurite development account key: public, not a secret.
const AZURITE_CONNECTION_STRING =
  'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;QueueEndpoint=http://localhost:10001/devstoreaccount1;TableEndpoint=http://localhost:10002/devstoreaccount1'; // pragma: allowlist secret

const ATS_DATABASE = 'ATS_INT';
const DXTR_DATABASE = 'DXTR_INT';

function loadEnv() {
  dotenv.config({ path: path.join(REPO_ROOT, 'backend/.env') });
  const scriptsEnvPath = path.join(HARNESS_DIR, 'scripts/.env');
  if (!fs.existsSync(scriptsEnvPath)) {
    console.error(
      `Missing ${scriptsEnvPath}: copy scripts/.env.template to scripts/.env and set MSSQL_PASS.`,
    );
    process.exit(1);
  }
  dotenv.config({ path: scriptsEnvPath, override: true });

  // Point everything at the local containers started by start-services.sh, whatever
  // backend/.env says.
  Object.assign(process.env, {
    DATABASE_MOCK: 'false',
    MONGO_CONNECTION_STRING: 'mongodb://localhost:27017/cams-integration?retrywrites=false',
    COSMOS_DATABASE_NAME: 'cams-integration',
    ATS_MSSQL_HOST: 'localhost',
    ATS_MSSQL_DATABASE: ATS_DATABASE,
    ATS_MSSQL_USER: 'sa',
    ATS_MSSQL_PASS: process.env.MSSQL_PASS,
    ATS_MSSQL_ENCRYPT: 'false',
    ATS_MSSQL_TRUST_UNSIGNED_CERT: 'true',
    MSSQL_HOST: 'localhost',
    MSSQL_DATABASE_DXTR: DXTR_DATABASE,
    MSSQL_USER: 'sa',
    MSSQL_ENCRYPT: 'false',
    MSSQL_TRUST_UNSIGNED_CERT: 'true',
    AzureWebJobsStorage: AZURITE_CONNECTION_STRING,
    AzureWebJobsDataflowsStorage: AZURITE_CONNECTION_STRING,
  });
}

loadEnv();

// buildQueueName('TRUSTEE-DATA-REPORT', suffix)
const START_QUEUE = 'trustee-data-report-start';
const PAGE_QUEUE = 'trustee-data-report-page';
const DLQ_QUEUE = 'trustee-data-report-dlq';

const REPORT_COLLECTION = 'trustee-data-report';
const APPOINTMENTS_COLLECTION = 'trustee-appointments';
const LOCK_DOCUMENT_TYPE = 'TRUSTEE_DATA_REPORT_RUN';
const RUN_TIMEOUT_MS = 3 * 60 * 1000;

// Scenarios whose assertion fails because the report does not handle the case yet. Each stays
// strict; the harness reports it as a known gap instead of a failure only while the actual result
// matches the documented one (`knownGapActual` in the fixtures). Keep in step with README.md.
const KNOWN_GAPS: Record<string, string> = {
  S10: 'Latent: the comparison ignores the CAMS phone extension, and TOD keeps extension digits inside TELEPHONE, so once CAMS stores an extension separately the same phone is reported as a difference. No CAMS trustee has one today.',
  S45: 'Follows from S10: one false phone difference.',
};

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

type Outcome = 'PASS' | 'FAIL' | 'KNOWN GAP' | 'GAP CLOSED';
const results: { id: string; title: string; outcome: Outcome; detail?: string }[] = [];

/**
 * `matchesKnownGap` says whether a failed known-gap assertion still produced the documented
 * result. A known gap that fails any other way is a FAIL, so a regression cannot hide behind it.
 */
function record(id: string, title: string, ok: boolean, detail?: string, matchesKnownGap = false) {
  const gap = KNOWN_GAPS[id];
  let outcome: Outcome;
  if (ok) outcome = gap ? 'GAP CLOSED' : 'PASS';
  else outcome = gap && matchesKnownGap ? 'KNOWN GAP' : 'FAIL';
  results.push({ id, title, outcome, detail: ok ? undefined : detail });
  const mark = outcome === 'PASS' ? '✓' : outcome === 'FAIL' ? '✗' : '!';
  console.log(`  ${mark} ${outcome}: ${id} ${title}`);
  if (!ok && detail) console.log(`      ${detail.replace(/\n/g, '\n      ')}`);
  if (gap) console.log(`      known gap: ${gap}`);
  if (gap && !ok && !matchesKnownGap) {
    console.log('      and the result differs from the documented known-gap result');
  }
}

function info(message: string) {
  console.log(`  ℹ  ${message}`);
}

// ---------------------------------------------------------------------------
// Connections
// ---------------------------------------------------------------------------

async function getMongoDb(): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(process.env.MONGO_CONNECTION_STRING!);
  await client.connect();
  return { client, db: client.db(process.env.COSMOS_DATABASE_NAME!) };
}

/** SQL Edge opens its port before it accepts logins, so a fresh container needs a few retries. */
async function getSqlPool(database: string): Promise<sql.ConnectionPool> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await new sql.ConnectionPool({
        server: 'localhost',
        port: 1433,
        database,
        user: 'sa',
        password: process.env.MSSQL_PASS,
        options: { encrypt: false, trustServerCertificate: true },
      }).connect();
    } catch (error) {
      if (attempt === 30) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
}

async function executeSqlFile(pool: sql.ConnectionPool, fileName: string): Promise<void> {
  const content = fs.readFileSync(path.join(HARNESS_DIR, 'seed', fileName), 'utf-8');
  const batches = content
    .split(/^\s*GO\s*$/im)
    .map((batch) => batch.trim())
    .filter((batch) => batch.length > 0);
  for (const batch of batches) {
    await pool.request().query(batch);
  }
  info(`Applied ${fileName}`);
}

async function getQueueClient(queueName: string) {
  const client =
    QueueServiceClient.fromConnectionString(AZURITE_CONNECTION_STRING).getQueueClient(queueName);
  await client.createIfNotExists();
  return client;
}

async function clearQueues(): Promise<void> {
  for (const queueName of [START_QUEUE, PAGE_QUEUE, DLQ_QUEUE]) {
    await (await getQueueClient(queueName)).clearMessages();
  }
  info('Cleared the start, page and dead-letter queues');
}

async function pollUntil(predicate: () => Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}

// ---------------------------------------------------------------------------
// Real start use case
// ---------------------------------------------------------------------------

async function buildStartContext() {
  const { InvocationContext } = await import('@azure/functions');
  const ContextCreator = (
    await import('../../../../backend/function-apps/azure/application-context-creator')
  ).default;
  const context = await ContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
  });
  context.session = {
    user: { id: 'integration-harness', name: 'Integration Harness' },
    accessToken: '',
    provider: 'mock',
    issuer: '',
    expires: Number.MAX_SAFE_INTEGER,
  } as typeof context.session;
  return context;
}

let startContext: Awaited<ReturnType<typeof buildStartContext>> | undefined;

async function startRun(): Promise<string> {
  startContext ??= await buildStartContext();
  const { startTrusteeDataReport } =
    await import('../../../../backend/lib/use-cases/trustee-data-report/start-trustee-data-report');
  const run = await startTrusteeDataReport(startContext);
  info(`Started run ${run.runId}`);
  return run.runId;
}

type RunDocument = {
  runId: string;
  status: string;
  failureMessage?: string;
  summary?: ReturnType<typeof expectedSummary>;
};

async function readRun(db: Db, runId: string): Promise<RunDocument | null> {
  return db
    .collection<RunDocument>(REPORT_COLLECTION)
    .findOne({ documentType: 'TRUSTEE_DATA_REPORT_RUN', runId });
}

async function waitForRun(db: Db, runId: string): Promise<RunDocument | null> {
  let run: RunDocument | null = null;
  await pollUntil(async () => {
    run = await readRun(db, runId);
    return run?.status === 'completed' || run?.status === 'failed';
  }, RUN_TIMEOUT_MS);
  return run;
}

type DifferenceDocument = ExpectedDifference & {
  runId: string;
  camsTrusteeId?: string;
  trusteeName?: string;
  field?: string;
  camsValue?: string;
  todValue?: string;
};

async function readDifferences(db: Db, runId: string): Promise<DifferenceDocument[]> {
  return db
    .collection<DifferenceDocument>(REPORT_COLLECTION)
    .find({ documentType: 'TRUSTEE_DATA_REPORT_DIFFERENCE', runId })
    .toArray();
}

async function readLock(db: Db) {
  return db.collection('runtime-state').findOne({ documentType: LOCK_DOCUMENT_TYPE });
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

async function seedSchema() {
  const master = await getSqlPool('master');
  try {
    for (const database of [ATS_DATABASE, DXTR_DATABASE]) {
      await master
        .request()
        .query(
          `IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = '${database}') CREATE DATABASE [${database}]`,
        );
    }
  } finally {
    await master.close();
  }
  const pool = await getSqlPool(ATS_DATABASE);
  try {
    await executeSqlFile(pool, '00-seed-ats-schema.sql');
  } finally {
    await pool.close();
  }
  const dxtr = await getSqlPool(DXTR_DATABASE);
  try {
    await executeSqlFile(dxtr, '00-seed-dxtr-offices-schema.sql');
  } finally {
    await dxtr.close();
  }
}

async function seedSql() {
  const pool = await getSqlPool(ATS_DATABASE);
  try {
    for (const file of [
      '01-seed-trustees.sql',
      '02-seed-chapter-details.sql',
      '03-seed-filler.sql',
      '05-seed-appointments.sql',
    ]) {
      await executeSqlFile(pool, file);
    }
  } finally {
    await pool.close();
  }
  const dxtr = await getSqlPool(DXTR_DATABASE);
  try {
    await executeSqlFile(dxtr, '04-seed-dxtr-offices.sql');
  } finally {
    await dxtr.close();
  }
}

/**
 * Indexes as cosmos-collections.bicep declares them (trusteeDataReportCollection and the
 * trustees single-field legacy.truIds index; Cosmos rejects nested paths in compound indexes).
 * Keep in step with the bicep.
 */
async function createIndexes(db: Db) {
  await db.collection(REPORT_COLLECTION).createIndex({ documentType: 1, runId: 1 });
  await db.collection(REPORT_COLLECTION).createIndex({ runId: 1, pageKey: 1 });
  await db.collection('trustees').createIndex({ 'legacy.truIds': 1 });
  info('Created the bicep-declared indexes');
}

async function seedCosmos() {
  const { client, db } = await getMongoDb();
  try {
    await db.collection('trustees').deleteMany({ trusteeId: { $regex: `^${TRUSTEE_ID_PREFIX}` } });
    const now = new Date().toISOString();
    const trustees = SCENARIOS.flatMap((scenario) => (scenario.cams ? [scenario.cams] : [])).map(
      (cams) => ({
        ...cams,
        id: cams.trusteeId,
        documentType: 'TRUSTEE',
        status: 'active',
        updatedOn: now,
        updatedBy: { id: 'integration-harness', name: 'Integration Harness' },
      }),
    );
    await db.collection('trustees').insertMany(trustees);
    info(`Seeded ${trustees.length} CAMS trustees`);

    await db
      .collection(APPOINTMENTS_COLLECTION)
      .deleteMany({ trusteeId: { $regex: `^${TRUSTEE_ID_PREFIX}` } });
    const appointments = SCENARIOS.flatMap(({ cams, camsAppointments }) =>
      cams && camsAppointments
        ? camsAppointments.map((appointment) => ({
            ...appointment,
            id: `${cams.trusteeId}-${appointment.chapter}-${appointment.appointmentType}`,
            documentType: 'TRUSTEE_APPOINTMENT',
            trusteeId: cams.trusteeId,
            updatedOn: now,
            updatedBy: { id: 'integration-harness', name: 'Integration Harness' },
          }))
        : [],
    );
    await db.collection(APPOINTMENTS_COLLECTION).insertMany(appointments);
    info(`Seeded ${appointments.length} CAMS trustee appointments`);
    await createIndexes(db);
  } finally {
    await client.close();
  }
}

async function clean() {
  const { client, db } = await getMongoDb();
  try {
    const report = await db.collection(REPORT_COLLECTION).deleteMany({});
    const trustees = await db
      .collection('trustees')
      .deleteMany({ trusteeId: { $regex: `^${TRUSTEE_ID_PREFIX}` } });
    const appointments = await db
      .collection(APPOINTMENTS_COLLECTION)
      .deleteMany({ trusteeId: { $regex: `^${TRUSTEE_ID_PREFIX}` } });
    const lock = await db
      .collection('runtime-state')
      .deleteMany({ documentType: LOCK_DOCUMENT_TYPE });
    info(
      `Deleted ${report.deletedCount} report, ${trustees.deletedCount} trustee, ${appointments.deletedCount} appointment and ${lock.deletedCount} lock document(s)`,
    );
  } finally {
    await client.close();
  }
  await clearQueues();
}

/**
 * The report reads every trustee in both systems, so anything else would skew its counts. Only
 * CAMS needs checking: seeding deletes every TOD row before inserting the fixtures, but deletes
 * only the fixture trustees from CAMS.
 */
async function checkCamsHoldsOnlyFixtures(db: Db): Promise<boolean> {
  const others = await db.collection('trustees').countDocuments({
    documentType: 'TRUSTEE',
    trusteeId: { $not: { $regex: `^${TRUSTEE_ID_PREFIX}` } },
  });
  if (others > 0) {
    console.log(`  ✗ CAMS must hold only the fixture trustees: found ${others} other trustee(s).`);
  }
  return others === 0;
}

// ---------------------------------------------------------------------------
// Scenario assertions
// ---------------------------------------------------------------------------

function comparable(difference: DifferenceDocument | ExpectedDifference) {
  const d = difference as DifferenceDocument;
  switch (d.kind) {
    case 'field':
      return {
        kind: d.kind,
        field: d.field,
        camsValue: d.camsValue,
        todValue: d.todValue,
        todIds: d.todIds,
      };
    case 'tod-only':
      return {
        kind: d.kind,
        trusteeName: d.trusteeName,
        todIds: d.todIds,
        todStatusMissing: d.todStatusMissing ?? false,
      };
    case 'cams-only':
      return { kind: d.kind, todIds: d.todIds };
    case 'appointment-tod-only':
    case 'appointment-cams-only':
    case 'appointment-field':
    case 'appointment-divisions-narrowed': {
      const { courtId, chapter, appointmentType } = d.appointment;
      return {
        kind: d.kind,
        appointment: { courtId, chapter, appointmentType },
        field: d.field,
        camsValue: d.camsValue,
        todValue: d.todValue,
        todIds: d.todIds,
      };
    }
  }
}

const sortedJson = (items: object[]) => items.map((item) => JSON.stringify(item)).sort();

function belongsTo(scenario: Scenario, difference: DifferenceDocument): boolean {
  if (scenario.cams && difference.camsTrusteeId === scenario.cams.trusteeId) return true;
  return (
    difference.kind === 'tod-only' &&
    !!scenario.todIds?.some((id) => difference.todIds.includes(id))
  );
}

function assertScenarios(differences: DifferenceDocument[]) {
  for (const scenario of SCENARIOS) {
    const actual = sortedJson(differences.filter((d) => belongsTo(scenario, d)).map(comparable));
    const expected = sortedJson(scenario.expected.map(comparable));
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    const matchesKnownGap =
      !!scenario.knownGapActual &&
      JSON.stringify(actual) ===
        JSON.stringify(sortedJson(scenario.knownGapActual.map(comparable)));
    record(
      scenario.id,
      scenario.title,
      ok,
      `expected ${JSON.stringify(expected)}\nactual   ${JSON.stringify(actual)}`,
      matchesKnownGap,
    );
  }

  const unclaimed = differences.filter((d) => !SCENARIOS.some((s) => belongsTo(s, d)));
  record(
    'S32',
    'Filler TOD trustees (unlinked, no appointments) and anything else outside the scenarios report nothing',
    unclaimed.length === 0,
    `unexpected rows: ${JSON.stringify(unclaimed.map(comparable))}`,
  );
  const fillerReported = differences.some((d) =>
    d.todIds.some((id) => FILLER_TOD_IDS.includes(id)),
  );
  if (fillerReported) info('A filler TOD trustee was reported');
}

/**
 * Split in two so the known gaps, which only change difference counts, cannot hide a change in
 * which trustees are compared: most scenarios expect no rows and pass whether compared or not.
 */
function assertSummary(summary: RunDocument['summary']) {
  const counted = (s: RunDocument['summary']) => ({
    trusteesCompared: s?.trusteesCompared,
    camsOnly: s?.camsOnly,
  });
  const differences = (s: RunDocument['summary']) => ({
    todOnly: s?.todOnly,
    todOnlyStatusMissing: s?.todOnlyStatusMissing,
    fieldDifferences: s?.fieldDifferences,
    fieldDifferencesByField: s?.fieldDifferencesByField,
  });
  const compare = (
    id: string,
    title: string,
    pick: (s: RunDocument['summary']) => object,
    matchesKnownGap = false,
  ) => {
    const expected = JSON.stringify(pick(expectedSummary()));
    const actual = JSON.stringify(pick(summary));
    record(
      id,
      title,
      actual === expected,
      `expected ${expected}\nactual   ${actual}`,
      matchesKnownGap,
    );
  };

  compare(
    'S33',
    'The run counts compared and CAMS-only trustees as the scenarios add up to',
    counted,
  );
  compare(
    'S58',
    'The run counts appointment differences, narrowed divisions and untranslated TOD appointments as the scenarios add up to',
    (s) => ({
      appointmentsTodOnly: s?.appointmentsTodOnly,
      appointmentsCamsOnly: s?.appointmentsCamsOnly,
      appointmentFieldDifferences: s?.appointmentFieldDifferences,
      appointmentFieldDifferencesByField: s?.appointmentFieldDifferencesByField,
      appointmentsDivisionsNarrowed: s?.appointmentsDivisionsNarrowed,
      todAppointmentsNotTranslated: s?.todAppointmentsNotTranslated,
    }),
  );
  compare(
    'S45',
    'The run counts TOD-only trustees and field differences as the scenarios add up to',
    differences,
    JSON.stringify(differences(summary)) === JSON.stringify(differences(expectedSummary(true))),
  );
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nResetting and seeding...\n');
  await clean();
  await seedSchema();
  await seedSql();
  await seedCosmos();

  const { client, db } = await getMongoDb();
  try {
    if (!(await checkCamsHoldsOnlyFixtures(db))) {
      process.exitCode = 1;
      return;
    }

    console.log('\nL1: a run started through the start use case completes\n');
    const firstRunId = await startRun();
    const first = await waitForRun(db, firstRunId);
    record(
      'L1',
      'A run started through the start use case completes on real infrastructure',
      first?.status === 'completed',
      `run status: ${first?.status ?? 'not found'} ${first?.failureMessage ?? ''}`,
    );
    if (first?.status !== 'completed') return;

    console.log('\nScenarios (run 1)\n');
    const firstDifferences = await readDifferences(db, firstRunId);
    assertScenarios(firstDifferences);
    assertSummary(first.summary);
    record(
      'L2',
      'The lock is released when a run completes',
      !(await readLock(db)),
      'lock still held',
    );

    console.log('\nL3-L4: one run at a time; a completed run replaces the previous one\n');
    const secondRunId = await startRun();
    let refused = false;
    try {
      await startRun();
    } catch (error) {
      refused = (error as { status?: number }).status === 409;
    }
    record(
      'L3',
      'A start while a run is active is refused with 409',
      refused,
      'second start was not refused',
    );
    const second = await waitForRun(db, secondRunId);
    // The run is marked completed before older runs are removed, so wait for the removal.
    const countFirstRun = () =>
      db.collection(REPORT_COLLECTION).countDocuments({ runId: firstRunId });
    await pollUntil(async () => (await countFirstRun()) === 0, 10_000);
    const firstLeft = await countFirstRun();
    record(
      'L4',
      'A completed run replaces the previous run, which is removed with all of its rows',
      second?.status === 'completed' && firstLeft === 0,
      `second run ${second?.status}; ${firstLeft} document(s) of the first run remain`,
    );
    if (second?.status !== 'completed') return;
    const secondRowCount = (await readDifferences(db, secondRunId)).length;

    console.log('\nL5: a failed run keeps the previous results\n');
    await assertFailedRunKeepsResults(db, secondRunId, secondRowCount);

    console.log('\nL6: a start takes over a lock older than 2 hours\n');
    const fourthRunId = await assertStaleLockTakeover(db);
    if (!fourthRunId) return;

    console.log('\nL7: a page message delivered again after the run completed changes nothing\n');
    await assertRedeliveredPageChangesNothing(db, fourthRunId);
  } finally {
    await client.close();
  }
}

async function withTodTableHidden<T>(action: () => Promise<T>): Promise<T> {
  const pool = await getSqlPool(ATS_DATABASE);
  try {
    await pool.request().query("EXEC sp_rename 'TRUSTEES', 'TRUSTEES_HIDDEN'");
    return await action();
  } finally {
    await pool.request().query("EXEC sp_rename 'TRUSTEES_HIDDEN', 'TRUSTEES'");
    await pool.close();
  }
}

async function assertFailedRunKeepsResults(
  db: Db,
  previousRunId: string,
  previousRowCount: number,
) {
  const failed = await withTodTableHidden(async () => waitForRun(db, await startRun()));
  info(`Failure message recorded: ${JSON.stringify(failed?.failureMessage)}`);
  const previous = await readRun(db, previousRunId);
  const previousRows = (await readDifferences(db, previousRunId)).length;
  record(
    'L5',
    'A run that cannot read TOD fails with a readable reason, keeps the previous results and releases the lock',
    failed?.status === 'failed' &&
      failed.failureMessage ===
        "Could not read from TOD. Check the dataflows app's ATS_MSSQL_* settings and its logs" &&
      previous?.status === 'completed' &&
      previousRows === previousRowCount &&
      !(await readLock(db)),
    `failed run: ${failed?.status} "${failed?.failureMessage}"; previous run: ${previous?.status} with ${previousRows}/${previousRowCount} rows`,
  );
}

async function assertStaleLockTakeover(db: Db): Promise<string | undefined> {
  const staleRunId = 'stale-run';
  const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
  await db.collection(REPORT_COLLECTION).insertOne({
    documentType: 'TRUSTEE_DATA_REPORT_RUN',
    runId: staleRunId,
    status: 'running',
    startedBy: { id: 'integration-harness', name: 'Integration Harness' },
    queuedAt: threeHoursAgo,
    startedAt: threeHoursAgo,
  });
  await db.collection('runtime-state').insertOne({
    documentType: LOCK_DOCUMENT_TYPE,
    runId: staleRunId,
    startedAt: threeHoursAgo,
  });

  const runId = await startRun();
  const stale = await readRun(db, staleRunId);
  const completed = await waitForRun(db, runId);
  record(
    'L6',
    'A start takes over a lock older than 2 hours, marks that run failed and completes',
    stale?.status === 'failed' &&
      stale.failureMessage ===
        'The run did not finish within 2 hours and was replaced by a new run.' &&
      completed?.status === 'completed',
    `stale run: ${stale?.status} "${stale?.failureMessage}"; new run: ${completed?.status}`,
  );
  return completed?.status === 'completed' ? runId : undefined;
}

async function assertRedeliveredPageChangesNothing(db: Db, runId: string) {
  const before = await readRun(db, runId);
  const rowsBefore = (await readDifferences(db, runId)).length;
  const dlq = await getQueueClient(DLQ_QUEUE);
  await dlq.clearMessages();

  const page = await getQueueClient(PAGE_QUEUE);
  await page.sendMessage(Buffer.from(JSON.stringify({ runId, cursor: null })).toString('base64'));
  const deadLettered = await pollUntil(async () => {
    const properties = await dlq.getProperties();
    return (properties.approximateMessagesCount ?? 0) > 0;
  }, 60_000);

  const after = await readRun(db, runId);
  const rowsAfter = (await readDifferences(db, runId)).length;
  record(
    'L7',
    'A page message delivered again after the run completed is dead-lettered and changes no results',
    deadLettered &&
      after?.status === 'completed' &&
      rowsAfter === rowsBefore &&
      JSON.stringify(after.summary) === JSON.stringify(before?.summary),
    `dead-lettered: ${deadLettered}; status ${after?.status}; rows ${rowsBefore} → ${rowsAfter}`,
  );
}

function printTable() {
  console.log('\n| Scenario | Result |\n| --- | --- |');
  for (const result of results) {
    console.log(`| ${result.id} ${result.title} | ${result.outcome} |`);
  }
  const counts = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.outcome] = (acc[result.outcome] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`\n${JSON.stringify(counts)}`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

function checkEnv() {
  for (const name of ['MSSQL_PASS', 'MONGO_CONNECTION_STRING', 'AzureWebJobsDataflowsStorage']) {
    console.log(`  ${process.env[name] ? '✓' : '✗'} ${name}`);
  }
}

const HELP = `Commands: check-env | seed-schema | seed-sql | seed-cosmos | run | clean | help`;

async function main() {
  const command = process.argv[2] ?? 'help';
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
      await run();
      printTable();
      if (results.some((result) => result.outcome === 'FAIL' || result.outcome === 'GAP CLOSED')) {
        process.exitCode = 1;
      }
      return;
    case 'clean':
      return clean();
    default:
      console.log(HELP);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The start use case leaves Mongo clients open; exit explicitly once done.
  .finally(() => process.exit());
