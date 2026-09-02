/**
 * Prod-dump validation for BACKFILL-UNASSIGNED-ON, run against a real (local/disposable) MongoDB
 * instance — never against staging or prod. CAMS-888's backfill only gets one shot at the actual
 * data, so this proves processBackfillPage's real behavior against the ACTUAL affected records
 * before that run, rather than trusting the synthetic scenario A-E fixtures in run-tests.ts alone.
 *
 * Input: fixtures/<dump>.json — a raw case-trustee-appointments collection export (extended-JSON
 * `_id: { $oid }`), covering every unassignedOn-affected document plus adjacent same-caseId
 * records. Never committed (see test/integration/.gitignore) — local-only, re-created per
 * validation session.
 *
 * The dump only contains case-partition documents. Since updateCaseAppointment dual-writes to
 * both case-trustee-appointments and trustee-case-appointments (matched by `id`), and prod
 * already carries matching copies in both partitions, `seed` mirrors every record into both
 * collections unchanged.
 *
 * An independent oracle (computeExpected below) re-derives, in plain TypeScript with no
 * dependency on the use-case module, what each candidate's outcome SHOULD be (skip / no-op /
 * corrected-to-X) directly from the dump. `run` executes the real use case against real Mongo,
 * paginating until exhausted, then diffs its outcomes against the oracle — so this validates the
 * use case's actual behavior against real data, not just that it runs without throwing.
 *
 * Usage (from test/integration/):
 *   npm run backfill-unassigned-on:prod-dump -- [command]
 *
 * Local workflow:
 *   1. cd backfill-unassigned-on/scripts && ./start-services.sh
 *   2. Ensure backfill-unassigned-on/.env.local exists (see run-tests.ts's header)
 *   3. Drop the dump at backfill-unassigned-on/fixtures/<name>.json
 *   4. npm run backfill-unassigned-on:prod-dump -- seed fixtures/<name>.json
 *   5. npm run backfill-unassigned-on:prod-dump -- run
 *   6. npm run backfill-unassigned-on:prod-dump -- clean fixtures/<name>.json
 *   7. cd backfill-unassigned-on/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed <file>   Mirror every record in <file> into both partition collections
 *   run           Run processBackfillPage to exhaustion, diff against the independent oracle
 *   clean <file>  Remove every record in <file> (by id) from both partition collections
 *   help          Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import BackfillUnassignedOnUseCase from '../../../../backend/lib/use-cases/dataflows/backfill-unassigned-on';
import { SENTINEL_TRUSTEE_ID } from '../../../../backend/lib/use-cases/dataflows/migrate-case-appointments-constants';
import { finalizeDeferrable } from '../../../../backend/lib/deferrable/finalize-deferrable';
import DateHelper from '../../../../common/src/date-helper';

const HARNESS_DIR = path.resolve(__dirname, '../');

const CASE_COLLECTION = 'case-trustee-appointments';
const TRUSTEE_COLLECTION = 'trustee-case-appointments';

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} — create it with MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME set (see run-tests.ts's usage header).`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

loadEnv();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string) {
  console.error(`  ✗ FAIL: ${msg}`);
  process.exitCode = 1;
}

function info(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

function assertEqual<T>(actual: T, expected: T, msg: string) {
  if (actual === expected) {
    pass(`${msg} (${String(actual)})`);
  } else {
    fail(`${msg} — expected ${String(expected)}, got ${String(actual)}`);
  }
}

async function getMongoClient() {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await client.connect();
  return { client, db: client.db(dbName) };
}

async function getAppContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

function resolveFixturePath(argPath: string | undefined): string {
  if (!argPath) {
    console.error(
      'Missing <file> argument — usage: npm run backfill-unassigned-on:prod-dump -- seed|clean fixtures/<name>.json',
    );
    process.exit(1);
  }
  return path.isAbsolute(argPath) ? argPath : path.join(HARNESS_DIR, argPath);
}

// ---------------------------------------------------------------------------
// Dump record shape (raw extended-JSON export)
// ---------------------------------------------------------------------------

type DumpRecord = {
  _id: { $oid: string };
  id: string;
  caseId: string;
  trusteeId: string;
  assignedOn: string;
  appointedDate?: string;
  unassignedOn?: string;
  dateFiled?: string;
  chapter?: string;
  courtDivisionCode?: string;
  closedDate?: string;
  acmsProfessionalId?: string;
  caseStatus?: string;
  documentType: string;
  isSurrogate?: boolean;
  createdOn?: string;
  createdBy?: unknown;
  updatedOn?: string;
  updatedBy?: unknown;
};

function loadDump(filePath: string): DumpRecord[] {
  if (!fs.existsSync(filePath)) {
    console.error(`Fixture file not found: ${filePath}`);
    process.exit(1);
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const records = JSON.parse(raw) as DumpRecord[];
  const ids = new Set(records.map((r) => r.id));
  if (ids.size !== records.length) {
    console.error(
      `Dump contains duplicate 'id' values (${records.length} records, ${ids.size} unique ids).`,
    );
    process.exit(1);
  }
  return records;
}

// Strips the extended-JSON _id wrapper — Mongo's driver assigns its own _id per collection on
// insert, and the case/trustee partitions get independently-assigned _ids for the same logical
// appointment in prod, so a dump _id must never be written back as-is (mirrors stripMongoId in
// the repository).
function toInsertDoc(record: DumpRecord): Record<string, unknown> {
  const { _id: _dumpMongoId, ...rest } = record;
  return rest;
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed(filePath: string) {
  console.log(`\nSeeding prod dump from ${filePath}...\n`);
  const records = loadDump(filePath);
  const { client, db } = await getMongoClient();
  try {
    const docs = records.map(toInsertDoc);
    const caseResult = await db.collection(CASE_COLLECTION).insertMany(docs.map((d) => ({ ...d })));
    const trusteeResult = await db
      .collection(TRUSTEE_COLLECTION)
      .insertMany(docs.map((d) => ({ ...d })));
    pass(
      `Inserted ${caseResult.insertedCount} case-partition and ${trusteeResult.insertedCount} trustee-partition document(s) from ${records.length} dump records`,
    );
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// Independent oracle — re-derives expected outcomes directly from the dump, without importing
// the use case under test, so a bug shared between the oracle and the use case can't hide itself.
// ---------------------------------------------------------------------------

type ExpectedOutcome =
  | { kind: 'skip-placeholder' }
  | { kind: 'skip-no-superseding' }
  | { kind: 'no-op'; unassignedOn: string }
  | { kind: 'corrected'; unassignedOn: string }
  | { kind: 'invalid-superseding-date' };

function isPlaceholder(r: DumpRecord): boolean {
  return r.isSurrogate === true || r.trusteeId === SENTINEL_TRUSTEE_ID;
}

function subtractOneDay(isoDate: string): string {
  return DateHelper.subtractDays(isoDate, 1);
}

function computeExpected(records: DumpRecord[]): Map<string, ExpectedOutcome> {
  const byCaseId = new Map<string, DumpRecord[]>();
  for (const r of records) {
    const list = byCaseId.get(r.caseId) ?? [];
    list.push(r);
    byCaseId.set(r.caseId, list);
  }

  const expected = new Map<string, ExpectedOutcome>();

  for (const r of records) {
    const hasUnassignedOn = r.unassignedOn !== undefined && r.unassignedOn !== null;
    if (!hasUnassignedOn || isPlaceholder(r)) {
      // Not a processBackfillPage candidate at all (findClosedAppointments excludes it) —
      // tracked separately from 'skip-no-superseding' so the harness can report candidate
      // counts that match findClosedAppointments' own filter, not just final outcomes.
      continue;
    }

    const history = byCaseId.get(r.caseId) ?? [];
    const laterReal = history.filter(
      (a) => a.id !== r.id && !isPlaceholder(a) && a.assignedOn > r.assignedOn,
    );
    const differentTrustee = laterReal.filter((a) => a.trusteeId !== r.trusteeId);
    const pool = differentTrustee.length > 0 ? differentTrustee : laterReal;

    if (pool.length === 0) {
      expected.set(r.id, { kind: 'skip-no-superseding' });
      continue;
    }

    const superseding = pool.reduce((earliest, candidate) =>
      candidate.assignedOn < earliest.assignedOn ? candidate : earliest,
    );

    if (!DateHelper.isValidDateString(superseding.assignedOn)) {
      expected.set(r.id, { kind: 'invalid-superseding-date' });
      continue;
    }

    const correctValue = subtractOneDay(superseding.assignedOn);
    if (r.unassignedOn === correctValue) {
      expected.set(r.id, { kind: 'no-op', unassignedOn: correctValue });
    } else {
      expected.set(r.id, { kind: 'corrected', unassignedOn: correctValue });
    }
  }

  return expected;
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function run(filePath: string) {
  console.log(`\nRunning processBackfillPage against prod dump from ${filePath}...\n`);
  const records = loadDump(filePath);
  const expected = computeExpected(records);

  const expectedCorrected = [...expected.values()].filter((e) => e.kind === 'corrected').length;
  const expectedNoOp = [...expected.values()].filter((e) => e.kind === 'no-op').length;
  const expectedSkip = [...expected.values()].filter(
    (e) => e.kind === 'skip-no-superseding',
  ).length;
  const expectedInvalid = [...expected.values()].filter(
    (e) => e.kind === 'invalid-superseding-date',
  ).length;
  info(
    `Oracle (independent of the use case): ${expected.size} candidates — ${expectedCorrected} need correction, ${expectedNoOp} already correct, ${expectedSkip} have no superseding appointment, ${expectedInvalid} have an invalid superseding date`,
  );

  const context = await getAppContext();
  try {
    const PAGE_SIZE = 200;
    let cursor: string | null = null;
    let page = 0;
    let totalProcessed = 0;
    let totalFailed = 0;
    const failures: { id: string; caseId: string; error?: string }[] = [];
    const seenIds = new Set<string>();

    for (;;) {
      page += 1;
      const result = await BackfillUnassignedOnUseCase.processBackfillPage(
        context,
        cursor,
        PAGE_SIZE,
      );
      if (result.status === 'error') {
        fail(`Page ${page}: processBackfillPage returned an error: ${result.error.message}`);
        break;
      }
      if (result.status === 'empty') {
        info(`Page ${page}: empty — no more candidates`);
        break;
      }

      totalProcessed += result.appointments.length;
      totalFailed += result.failedResults.length;
      for (const f of result.failedResults) {
        failures.push({ id: f._id, caseId: f.caseId, error: f.error });
      }
      for (const a of result.appointments) {
        if (seenIds.has(a.id)) {
          fail(
            `Page ${page}: duplicate appointment id ${a.id} seen across pages — pagination overlap`,
          );
        }
        seenIds.add(a.id);
      }

      info(
        `Page ${page}: ${result.appointments.length} candidate(s), ${result.successCount} succeeded, ${result.failedResults.length} failed, hasMore=${result.nextCursor !== null}`,
      );

      if (!result.nextCursor) break;
      cursor = result.nextCursor.lastId;
    }

    console.log('');
    assertEqual(totalProcessed, expected.size, 'total candidates processed matches oracle count');
    assertEqual(totalFailed, 0, 'no candidates failed correction');
    if (failures.length > 0) {
      for (const f of failures) {
        info(`  failed: id=${f.id} caseId=${f.caseId} error=${f.error}`);
      }
    }

    // Diff actual DB state against the oracle for every candidate.
    console.log('\nDiffing actual Mongo state against the independent oracle...\n');
    const { client, db } = await getMongoClient();
    try {
      let matched = 0;
      let mismatched = 0;
      let dualWriteMismatched = 0;
      const mismatches: string[] = [];

      for (const [id, outcome] of expected) {
        if (outcome.kind !== 'no-op' && outcome.kind !== 'corrected') {
          continue;
        }
        const caseDoc = await db.collection(CASE_COLLECTION).findOne({ id });
        const trusteeDoc = await db.collection(TRUSTEE_COLLECTION).findOne({ id });

        if (caseDoc?.unassignedOn === outcome.unassignedOn) {
          matched += 1;
        } else {
          mismatched += 1;
          mismatches.push(
            `id=${id} expected unassignedOn=${outcome.unassignedOn} actual=${caseDoc?.unassignedOn}`,
          );
        }

        if (caseDoc?.unassignedOn !== trusteeDoc?.unassignedOn) {
          dualWriteMismatched += 1;
          mismatches.push(
            `id=${id} dual-write mismatch — case partition=${caseDoc?.unassignedOn} trustee partition=${trusteeDoc?.unassignedOn}`,
          );
        }
      }

      assertEqual(
        mismatched,
        0,
        `unassignedOn matches oracle for all ${matched + mismatched} corrected/no-op candidates`,
      );
      assertEqual(
        dualWriteMismatched,
        0,
        'case and trustee partitions agree on unassignedOn for every candidate',
      );

      // Placeholder (surrogate/sentinel) rows must never be corrected themselves — real
      // findClosedAppointments excludes them from candidates entirely, so their unassignedOn
      // must be byte-for-byte unchanged from the seeded dump value.
      const placeholders = records
        .filter(isPlaceholder)
        .filter((r) => r.unassignedOn !== undefined);
      let placeholderMismatches = 0;
      for (const original of placeholders) {
        const caseDoc = await db.collection(CASE_COLLECTION).findOne({ id: original.id });
        if (caseDoc?.unassignedOn !== original.unassignedOn) {
          placeholderMismatches += 1;
          mismatches.push(
            `id=${original.id} placeholder row's unassignedOn changed — seeded=${original.unassignedOn} actual=${caseDoc?.unassignedOn}`,
          );
        }
      }
      assertEqual(
        placeholderMismatches,
        0,
        `all ${placeholders.length} placeholder (surrogate/sentinel) rows with unassignedOn set were never corrected as candidates`,
      );

      if (mismatches.length > 0) {
        console.log('\nMismatches:');
        for (const m of mismatches.slice(0, 50)) {
          console.log(`  - ${m}`);
        }
        if (mismatches.length > 50) {
          console.log(`  ... and ${mismatches.length - 50} more`);
        }
      }
    } finally {
      await client.close();
    }
  } finally {
    await finalizeDeferrable(context);
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean(filePath: string) {
  console.log(`\nCleaning up prod-dump fixtures from ${filePath}...\n`);
  const records = loadDump(filePath);
  const ids = records.map((r) => r.id);
  const { client, db } = await getMongoClient();
  try {
    const r1 = await db.collection(CASE_COLLECTION).deleteMany({ id: { $in: ids } });
    const r2 = await db.collection(TRUSTEE_COLLECTION).deleteMany({ id: { $in: ids } });
    pass(
      `Deleted ${r1.deletedCount} case-partition and ${r2.deletedCount} trustee-partition document(s)`,
    );
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';
  const fileArg = process.argv[3];

  console.log('='.repeat(60));
  console.log('BACKFILL-UNASSIGNED-ON — Prod Dump Validation');
  console.log('='.repeat(60));

  switch (command) {
    case 'seed':
      await seed(resolveFixturePath(fileArg));
      break;
    case 'run':
      await run(resolveFixturePath(fileArg));
      break;
    case 'clean':
      await clean(resolveFixturePath(fileArg));
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run backfill-unassigned-on:prod-dump --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  ${HARNESS} <command> [fixtures/<file>.json]`);
      console.log('\nLocal workflow:');
      console.log('  1. ./backfill-unassigned-on/scripts/start-services.sh');
      console.log('  2. Ensure backfill-unassigned-on/.env.local exists (see run-tests.ts)');
      console.log('  3. Drop the dump at backfill-unassigned-on/fixtures/<name>.json');
      console.log(`  4. ${HARNESS} seed fixtures/<name>.json`);
      console.log(`  5. ${HARNESS} run fixtures/<name>.json`);
      console.log(`  6. ${HARNESS} clean fixtures/<name>.json`);
      console.log('  7. ./backfill-unassigned-on/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  seed <file>   Mirror dump records into both partition collections');
      console.log(
        '  run <file>    Run processBackfillPage to exhaustion, diff vs. independent oracle',
      );
      console.log('  clean <file>  Remove dump records (by id) from both partition collections');
      console.log('  help          Show this help');
    }
  }

  console.log('\n' + '='.repeat(60));
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
