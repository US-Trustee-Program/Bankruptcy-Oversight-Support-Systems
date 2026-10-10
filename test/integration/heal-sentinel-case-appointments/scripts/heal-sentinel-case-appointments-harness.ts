/**
 * End-to-end local harness for the heal-sentinel-case-appointments dataflow.
 *
 * Seeds invented, deterministic fixtures (heal-sentinel-fixtures.ts) into the pod's MongoDB,
 * enqueues start messages to the pod's Azurite, lets the REAL dataflows Functions host process
 * them, waits for the queues to drain and Mongo to settle, then asserts the resulting state.
 *
 * Runs three scenarios in order against one seeding:
 *   1. {}                                 heals every linked, unflagged, single-link record
 *   2. { ignoreSentinelsHealedOn: true }  additionally heals the pre-flagged record
 *   3. {}                                 changes nothing
 *
 * Usage (from test/integration/, after scripts/start-services.sh):
 *   npm run heal-sentinel-case-appointments            # seed + all three runs
 *   npm run heal-sentinel-case-appointments -- seed    # seed only
 *
 * Environment overrides (defaults match start-services.sh):
 *   HEAL_MONGO_PORT, HEAL_AZURITE_QUEUE_PORT, HEAL_SEED, HEAL_TIMEOUT_MS
 */
import { execFileSync } from 'child_process';
import { QueueClient, QueueServiceClient } from '@azure/storage-queue';
import { Db, Document, MongoClient } from 'mongodb';
import { SENTINEL_TRUSTEE_ID } from '../../../../backend/lib/use-cases/dataflows/migrate-case-appointments-constants';
import {
  AppointmentFixture,
  DEFAULT_SEED,
  Fixtures,
  pagesToHeal,
  ProfessionalIdFixture,
  SentinelGroup,
  synthesizeFixtures,
} from './heal-sentinel-fixtures';

const MONGO_PORT = process.env.HEAL_MONGO_PORT ?? '27317';
const QUEUE_PORT = process.env.HEAL_AZURITE_QUEUE_PORT ?? '10301';
const SEED = Number(process.env.HEAL_SEED ?? DEFAULT_SEED);
const TIMEOUT_MS = Number(process.env.HEAL_TIMEOUT_MS ?? 10 * 60 * 1000);

const DATABASE = 'cams-heal-sentinels';
const MONGO_URI = `mongodb://127.0.0.1:${MONGO_PORT}/?directConnection=true`;
// Azurite's publicly documented development account key; it only opens the local emulator.
const AZURITE_KEY =
  'Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=='; // pragma: allowlist secret
const QUEUE_CONNECTION = `DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=${AZURITE_KEY};QueueEndpoint=http://127.0.0.1:${QUEUE_PORT}/devstoreaccount1`;
const DATAFLOWS_CONTAINER = 'cams-dataflows-heal-sentinel-case-appointments';

const START_QUEUE = 'heal-sentinel-case-appointments-start';
const PAGE_QUEUE = 'heal-sentinel-case-appointments-page';
const DLQ_QUEUE = 'heal-sentinel-case-appointments-dlq';
const ALL_QUEUES = [
  START_QUEUE,
  PAGE_QUEUE,
  DLQ_QUEUE,
  `${START_QUEUE}-poison`,
  `${PAGE_QUEUE}-poison`,
];

const CASE_COLLECTION = 'case-trustee-appointments';
const TRUSTEE_COLLECTION = 'trustee-case-appointments';
const PROFESSIONAL_IDS_COLLECTION = 'trustee-professional-ids';

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

const failures: string[] = [];
let passCount = 0;

function check(condition: boolean, label: string, detail?: unknown): void {
  if (condition) {
    passCount++;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
  }
}

function info(message: string): void {
  console.log(`  ....  ${message}`);
}

// ---------------------------------------------------------------------------
// Indexes mirrored from production
// ---------------------------------------------------------------------------

/**
 * case-trustee-appointments and trustee-professional-ids: cosmos-collections.bicep.
 * trustee-case-appointments: TARGET_INDEXES in index-trustee-case-appointments.js, plus the
 * trusteeId shard key that Cosmos indexes automatically.
 */
async function createIndexes(db: Db): Promise<void> {
  await db
    .collection(CASE_COLLECTION)
    .createIndexes([
      { key: { caseId: 1 } },
      { key: { trusteeId: 1 } },
      { key: { caseId: 1, assignedOn: 1 } },
    ]);
  await db
    .collection(TRUSTEE_COLLECTION)
    .createIndexes([
      { key: { trusteeId: 1 } },
      { key: { unassignedOn: 1, dateFiled: 1, caseStatus: 1 } },
      { key: { dateFiled: -1, caseId: 1 } },
      { key: { chapter: 1 } },
      { key: { caseId: 1 } },
      { key: { acmsProfessionalId: 1 } },
    ]);
  await db
    .collection(PROFESSIONAL_IDS_COLLECTION)
    .createIndexes([
      { key: { camsTrusteeId: 1, acmsProfessionalId: 1, documentType: 1 }, unique: true },
      { key: { camsTrusteeId: 1, documentType: 1 } },
      { key: { acmsProfessionalId: 1 } },
      { key: { documentType: 1, disposition: 1, nameMatchCount: 1 } },
    ]);
}

// ---------------------------------------------------------------------------
// Queues
// ---------------------------------------------------------------------------

function queue(name: string): QueueClient {
  return QueueServiceClient.fromConnectionString(QUEUE_CONNECTION).getQueueClient(name);
}

async function resetQueues(): Promise<void> {
  for (const name of ALL_QUEUES) {
    const client = queue(name);
    await client.createIfNotExists();
    await client.clearMessages();
  }
}

async function queueDepth(name: string): Promise<number> {
  const client = queue(name);
  if (!(await client.exists())) return 0;
  return (await client.getProperties()).approximateMessagesCount ?? 0;
}

async function enqueueStart(message: object): Promise<void> {
  // The Functions host's queue trigger expects base64 message bodies.
  await queue(START_QUEUE).sendMessage(Buffer.from(JSON.stringify(message)).toString('base64'));
}

// ---------------------------------------------------------------------------
// Host log counters
// ---------------------------------------------------------------------------

type InvocationCounts = { started: number; succeeded: number; failed: number };

/** Counts handlePage invocations in the host's log; null when podman logs is unavailable. */
function pageInvocations(): InvocationCounts | null {
  try {
    const logs = execFileSync('podman', ['logs', DATAFLOWS_CONTAINER], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 512 * 1024 * 1024,
    });
    const fn = 'Functions.HEAL-SENTINEL-CASE-APPOINTMENTS-handlePage';
    const count = (needle: string) => logs.split(needle).length - 1;
    return {
      started: count(`Executing '${fn}'`),
      succeeded: count(`Executed '${fn}' (Succeeded`),
      failed: count(`Executed '${fn}' (Failed`),
    };
  } catch {
    return null;
  }
}

function diffCounts(after: InvocationCounts | null, before: InvocationCounts | null) {
  if (!after || !before) return null;
  return {
    started: after.started - before.started,
    succeeded: after.succeeded - before.succeeded,
    failed: after.failed - before.failed,
  };
}

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

function stripScenario(record: ProfessionalIdFixture): Omit<ProfessionalIdFixture, 'scenario'> {
  const { scenario: _scenario, ...rest } = record;
  return rest;
}

async function seed(db: Db, fixtures: Fixtures): Promise<void> {
  await db.dropDatabase();
  await createIndexes(db);
  await db
    .collection(PROFESSIONAL_IDS_COLLECTION)
    .insertMany(fixtures.professionalIds.map(stripScenario));

  // Each appointment is written to both partitions with the same id, as upsert() does; each
  // partition assigns its own _id. Copies keep the fixture objects free of driver-added _ids.
  const appointments = [...fixtures.sentinels, ...fixtures.ordinary];
  for (const collection of [CASE_COLLECTION, TRUSTEE_COLLECTION]) {
    for (let i = 0; i < appointments.length; i += 1000) {
      await db
        .collection(collection)
        .insertMany(appointments.slice(i, i + 1000).map((a) => ({ ...a })));
    }
  }
  await resetQueues();
}

// ---------------------------------------------------------------------------
// Snapshots
// ---------------------------------------------------------------------------

type Snapshot = Map<string, string>;

async function snapshot(db: Db, collection: string): Promise<Snapshot> {
  const docs = await db.collection(collection).find({}).toArray();
  return new Map(docs.map((d) => [String(d._id), JSON.stringify(d)]));
}

type World = {
  cases: Snapshot;
  trustees: Snapshot;
  professionalIds: Snapshot;
};

async function world(db: Db): Promise<World> {
  return {
    cases: await snapshot(db, CASE_COLLECTION),
    trustees: await snapshot(db, TRUSTEE_COLLECTION),
    professionalIds: await snapshot(db, PROFESSIONAL_IDS_COLLECTION),
  };
}

function snapshotDifferences(before: Snapshot, after: Snapshot): string[] {
  const keys = new Set([...before.keys(), ...after.keys()]);
  return [...keys].filter((k) => before.get(k) !== after.get(k));
}

// ---------------------------------------------------------------------------
// Waiting
// ---------------------------------------------------------------------------

async function settle(db: Db, label: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  let stablePolls = 0;
  let previous = '';
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const [start, page, sentinels, cases, invocations] = await Promise.all([
      queueDepth(START_QUEUE),
      queueDepth(PAGE_QUEUE),
      db.collection(TRUSTEE_COLLECTION).countDocuments({ trusteeId: SENTINEL_TRUSTEE_ID }),
      db.collection(CASE_COLLECTION).countDocuments({}),
      Promise.resolve(pageInvocations()),
    ]);
    const inFlight = invocations
      ? invocations.started - invocations.succeeded - invocations.failed
      : 0;
    const state = JSON.stringify({ start, page, sentinels, cases, invocations });
    const idle = start === 0 && page === 0 && inFlight === 0;
    stablePolls = idle && state === previous ? stablePolls + 1 : 0;
    previous = state;
    if (stablePolls === 0) {
      info(
        `${label}: start=${start} page=${page} sentinels-left=${sentinels} in-flight=${inFlight}`,
      );
    }
    if (stablePolls >= 3) return;
  }
  throw new Error(
    `${label}: queues did not drain and Mongo did not settle within ${TIMEOUT_MS} ms`,
  );
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

const SENTINEL_MARKERS = ['reason', 'acmsProfessionalId'] as const;
const PRESERVED_FIELDS = [
  'caseId',
  'assignedOn',
  'appointedDate',
  'dateFiled',
  'chapter',
  'courtDivisionCode',
  'unassignedOn',
  'closedDate',
  'reopenedDate',
  'caseStatus',
] as const;

/** Verifies every sentinel of a healed group became one healed appointment in each partition. */
async function assertGroupHealed(db: Db, group: SentinelGroup): Promise<void> {
  const label = `${group.scenario} ${group.acmsProfessionalId} (${group.sentinels.length})`;
  const caseIds = group.sentinels.map((s) => s.caseId);
  const [leftCase, leftTrustee, healedCase, healedTrustee] = await Promise.all([
    db.collection(CASE_COLLECTION).countDocuments({
      trusteeId: SENTINEL_TRUSTEE_ID,
      acmsProfessionalId: group.acmsProfessionalId,
    }),
    db.collection(TRUSTEE_COLLECTION).countDocuments({
      trusteeId: SENTINEL_TRUSTEE_ID,
      acmsProfessionalId: group.acmsProfessionalId,
    }),
    db
      .collection(CASE_COLLECTION)
      .find({ caseId: { $in: caseIds } })
      .toArray(),
    db
      .collection(TRUSTEE_COLLECTION)
      .find({ caseId: { $in: caseIds } })
      .toArray(),
  ]);

  const problems: string[] = [];
  if (leftCase + leftTrustee > 0) problems.push(`${leftCase}+${leftTrustee} sentinels remain`);
  const byCase = (docs: Document[]) => {
    const map = new Map<string, Document[]>();
    for (const d of docs) map.set(d.caseId, [...(map.get(d.caseId) ?? []), d]);
    return map;
  };
  const caseDocs = byCase(healedCase);
  const trusteeDocs = byCase(healedTrustee);

  for (const sentinel of group.sentinels) {
    const c = caseDocs.get(sentinel.caseId) ?? [];
    const t = trusteeDocs.get(sentinel.caseId) ?? [];
    if (c.length !== 1 || t.length !== 1) {
      problems.push(
        `${sentinel.caseId}: ${c.length} case-partition / ${t.length} trustee-partition docs`,
      );
      continue;
    }
    for (const [partition, doc] of [
      ['case', c[0]],
      ['trustee', t[0]],
    ] as const) {
      if (doc.trusteeId !== group.healsTo) {
        problems.push(`${sentinel.caseId} ${partition}: trusteeId ${doc.trusteeId}`);
      }
      if (doc.documentType !== 'CASE_APPOINTMENT') {
        problems.push(`${sentinel.caseId} ${partition}: documentType ${doc.documentType}`);
      }
      for (const marker of SENTINEL_MARKERS) {
        if (marker in doc) problems.push(`${sentinel.caseId} ${partition}: ${marker} survived`);
      }
      for (const field of PRESERVED_FIELDS) {
        if (doc[field] !== sentinel[field as keyof AppointmentFixture]) {
          problems.push(
            `${sentinel.caseId} ${partition}: ${field} ${doc[field]} != ${sentinel[field as keyof AppointmentFixture]}`,
          );
        }
      }
    }
    if (c[0].id !== t[0].id) problems.push(`${sentinel.caseId}: partition ids differ`);
  }
  check(problems.length === 0, `healed: ${label}`, problems.slice(0, 5));
}

/** Verifies a group's sentinel docs are byte-identical to the given snapshot. */
function assertGroupUntouched(
  group: SentinelGroup,
  baseline: World,
  current: World,
  sentinelKeys: Map<string, { cases: string[]; trustees: string[] }>,
): void {
  const keys = sentinelKeys.get(group.acmsProfessionalId)!;
  const changed = [
    ...keys.cases.filter((k) => baseline.cases.get(k) !== current.cases.get(k)),
    ...keys.trustees.filter((k) => baseline.trustees.get(k) !== current.trustees.get(k)),
  ];
  check(
    changed.length === 0 && keys.cases.length === group.sentinels.length,
    `untouched: ${group.scenario} ${group.acmsProfessionalId} (${group.sentinels.length} x 2 partitions)`,
    { changed: changed.length },
  );
}

/** Maps each group to the _ids of its sentinel copies in both partitions as seeded. */
async function sentinelKeysByGroup(db: Db) {
  const keys = new Map<string, { cases: string[]; trustees: string[] }>();
  for (const [collection, field] of [
    [CASE_COLLECTION, 'cases'],
    [TRUSTEE_COLLECTION, 'trustees'],
  ] as const) {
    const docs = await db
      .collection(collection)
      .find({ trusteeId: SENTINEL_TRUSTEE_ID }, { projection: { _id: 1, acmsProfessionalId: 1 } })
      .toArray();
    for (const d of docs) {
      const entry = keys.get(d.acmsProfessionalId) ?? { cases: [], trustees: [] };
      entry[field].push(String(d._id));
      keys.set(d.acmsProfessionalId, entry);
    }
  }
  return keys;
}

async function ordinaryKeys(db: Db, fixtures: Fixtures) {
  const caseIds = fixtures.ordinary.map((o) => o.caseId);
  const ids = async (collection: string) =>
    (
      await db
        .collection(collection)
        .find({ caseId: { $in: caseIds } }, { projection: { _id: 1 } })
        .toArray()
    ).map((d) => String(d._id));
  return { cases: await ids(CASE_COLLECTION), trustees: await ids(TRUSTEE_COLLECTION) };
}

async function professionalIdsByRecordId(db: Db): Promise<Map<string, Document>> {
  const docs = await db.collection(PROFESSIONAL_IDS_COLLECTION).find({}).toArray();
  return new Map(docs.map((d) => [d.id as string, d]));
}

async function assertQueuesEmpty(label: string): Promise<void> {
  for (const name of ALL_QUEUES) {
    const depth = await queueDepth(name);
    check(depth === 0, `${label}: ${name} empty`, { depth });
  }
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

type RunSummary = {
  name: string;
  message: object;
  wallMs: number;
  pages: ReturnType<typeof diffCounts>;
  expectedPages: number;
  healed: number;
};

async function executeRun(
  db: Db,
  name: string,
  message: object,
  expectedPages: number,
): Promise<RunSummary> {
  console.log(`\n== ${name}: enqueue ${JSON.stringify(message)} ==`);
  const sentinelsBefore = await db
    .collection(TRUSTEE_COLLECTION)
    .countDocuments({ trusteeId: SENTINEL_TRUSTEE_ID });
  const before = pageInvocations();
  const started = Date.now();
  await enqueueStart(message);
  await settle(db, name);
  const wallMs = Date.now() - started;
  const pages = diffCounts(pageInvocations(), before);
  const sentinelsAfter = await db
    .collection(TRUSTEE_COLLECTION)
    .countDocuments({ trusteeId: SENTINEL_TRUSTEE_ID });
  info(`settled in ${(wallMs / 1000).toFixed(1)} s; healed ${sentinelsBefore - sentinelsAfter}`);
  if (pages) {
    check(
      pages.succeeded === expectedPages && pages.failed === 0 && pages.started === expectedPages,
      `${name}: ${expectedPages} handlePage invocations, none failed or retried`,
      pages,
    );
  } else {
    info('podman logs unavailable; page invocation count not checked');
  }
  await assertQueuesEmpty(name);
  return { name, message, wallMs, pages, expectedPages, healed: sentinelsBefore - sentinelsAfter };
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'run';
  const fixtures = synthesizeFixtures(SEED);
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DATABASE);
  try {
    console.log(`Seeding (seed=${SEED})...`);
    await seed(db, fixtures);
    const groupCounts = new Map<string, { records: number; sentinels: number }>();
    for (const g of fixtures.groups) {
      const entry = groupCounts.get(g.scenario) ?? { records: 0, sentinels: 0 };
      entry.records++;
      entry.sentinels += g.sentinels.length;
      groupCounts.set(g.scenario, entry);
    }
    console.log('Fixture sentinel groups by scenario:');
    console.table(Object.fromEntries(groupCounts));
    console.log(
      `professional-id records=${fixtures.professionalIds.length} sentinels=${fixtures.sentinels.length} (x2 partitions) ordinary=${fixtures.ordinary.length} (x2 partitions)`,
    );
    if (command === 'seed') return;

    const baseline = await world(db);
    const sentinelKeys = await sentinelKeysByGroup(db);
    const ordinary = await ordinaryKeys(db, fixtures);
    const linkedSingle = (scenarios: string[]) =>
      fixtures.professionalIds.filter((p) => scenarios.includes(p.scenario));
    const groupSize = (acmsId: string) =>
      fixtures.groups.find((g) => g.acmsProfessionalId === acmsId)?.sentinels.length ?? 0;
    const doubleLinked = fixtures.professionalIds.filter((p) => p.scenario === 'double-linked');
    const run1Records = linkedSingle([
      'linked-heavy',
      'linked-medium',
      'linked-small',
      'linked-zero',
    ]);
    const preFlagged = fixtures.professionalIds.find((p) => p.scenario === 'pre-flagged')!;

    const expectedRun1 =
      run1Records.reduce((n, r) => n + pagesToHeal(groupSize(r.acmsProfessionalId)), 0) +
      doubleLinked.length;
    const expectedRun2 =
      run1Records.length +
      pagesToHeal(groupSize(preFlagged.acmsProfessionalId)) +
      doubleLinked.length;
    const expectedRun3 = doubleLinked.length;

    const summaries: RunSummary[] = [];

    // ---- Run 1 -------------------------------------------------------------
    summaries.push(await executeRun(db, 'run 1 (plain)', {}, expectedRun1));
    const afterRun1 = await world(db);
    for (const group of fixtures.groups) {
      if (group.healsOnRun === 1) await assertGroupHealed(db, group);
      else assertGroupUntouched(group, baseline, afterRun1, sentinelKeys);
    }
    const ordinaryChanged = [
      ...ordinary.cases.filter((k) => baseline.cases.get(k) !== afterRun1.cases.get(k)),
      ...ordinary.trustees.filter((k) => baseline.trustees.get(k) !== afterRun1.trustees.get(k)),
    ];
    check(
      ordinaryChanged.length === 0 && ordinary.cases.length === fixtures.ordinary.length,
      `run 1: ${fixtures.ordinary.length} ordinary appointments untouched in both partitions`,
      { changed: ordinaryChanged.length },
    );
    const expectedTotal = fixtures.sentinels.length + fixtures.ordinary.length;
    check(
      afterRun1.cases.size === expectedTotal && afterRun1.trustees.size === expectedTotal,
      `run 1: each partition still holds ${expectedTotal} appointments (one-for-one replacement)`,
      { cases: afterRun1.cases.size, trustees: afterRun1.trustees.size },
    );
    const records1 = await professionalIdsByRecordId(db);
    const flaggedProblems: string[] = [];
    for (const record of fixtures.professionalIds) {
      const doc = records1.get(record.id)!;
      const shouldFlag = run1Records.some((r) => r.id === record.id);
      if (shouldFlag && typeof doc.sentinelsHealedOn !== 'string') {
        flaggedProblems.push(`${record.scenario} ${record.acmsProfessionalId} not flagged`);
      }
      if (record.scenario === 'pre-flagged') {
        if (doc.sentinelsHealedOn !== record.sentinelsHealedOn) {
          flaggedProblems.push('pre-flagged record sentinelsHealedOn changed');
        }
      } else if (!shouldFlag && doc.sentinelsHealedOn !== undefined) {
        flaggedProblems.push(`${record.scenario} ${record.acmsProfessionalId} flagged`);
      }
    }
    check(
      flaggedProblems.length === 0,
      `run 1: sentinelsHealedOn set on exactly the ${run1Records.length} linked unflagged single-link records`,
      flaggedProblems,
    );
    const conflictTrustees = fixtures.professionalIds
      .filter((p) => p.disposition !== 'linked')
      .map((p) => p.camsTrusteeId);
    const misdirected = await db
      .collection(CASE_COLLECTION)
      .countDocuments({ trusteeId: { $in: conflictTrustees } });
    check(misdirected === 0, "run 1: nothing written under a non-linked record's camsTrusteeId", {
      misdirected,
    });

    // ---- Run 2 -------------------------------------------------------------
    summaries.push(
      await executeRun(
        db,
        'run 2 (ignoreSentinelsHealedOn)',
        { ignoreSentinelsHealedOn: true },
        expectedRun2,
      ),
    );
    const afterRun2 = await world(db);
    for (const group of fixtures.groups) {
      if (group.healsOnRun === 2 || group.healsOnRun === 1) await assertGroupHealed(db, group);
      else assertGroupUntouched(group, baseline, afterRun2, sentinelKeys);
    }
    const preFlaggedCaseIds = new Set(
      fixtures.groups.find((g) => g.scenario === 'pre-flagged')!.sentinels.map((s) => s.caseId),
    );
    const isPreFlaggedDoc = (json: string | undefined) =>
      json !== undefined && preFlaggedCaseIds.has(JSON.parse(json).caseId);
    const unexpected = [
      ...snapshotDifferences(afterRun1.cases, afterRun2.cases).filter(
        (k) => !isPreFlaggedDoc(afterRun1.cases.get(k)) && !isPreFlaggedDoc(afterRun2.cases.get(k)),
      ),
      ...snapshotDifferences(afterRun1.trustees, afterRun2.trustees).filter(
        (k) =>
          !isPreFlaggedDoc(afterRun1.trustees.get(k)) &&
          !isPreFlaggedDoc(afterRun2.trustees.get(k)),
      ),
    ];
    check(unexpected.length === 0, "run 2: only the pre-flagged record's appointments changed", {
      unexpected: unexpected.length,
    });
    const records2 = await professionalIdsByRecordId(db);
    const preFlaggedDoc = records2.get(preFlagged.id)!;
    check(
      typeof preFlaggedDoc.sentinelsHealedOn === 'string' &&
        preFlaggedDoc.sentinelsHealedOn > preFlagged.sentinelsHealedOn!,
      'run 2: pre-flagged record re-flagged with a newer sentinelsHealedOn',
      preFlaggedDoc.sentinelsHealedOn,
    );
    check(
      doubleLinked.every((r) => records2.get(r.id)!.sentinelsHealedOn === undefined),
      'run 2: double-linked records still unflagged',
    );

    // ---- Run 3 -------------------------------------------------------------
    summaries.push(await executeRun(db, 'run 3 (plain, idempotent)', {}, expectedRun3));
    const afterRun3 = await world(db);
    for (const [name, a, b] of [
      ['case-trustee-appointments', afterRun2.cases, afterRun3.cases],
      ['trustee-case-appointments', afterRun2.trustees, afterRun3.trustees],
      ['trustee-professional-ids', afterRun2.professionalIds, afterRun3.professionalIds],
    ] as const) {
      const changed = snapshotDifferences(a, b);
      check(changed.length === 0, `run 3: ${name} unchanged (${b.size} docs)`, {
        changed: changed.length,
      });
    }

    // ---- Summary -----------------------------------------------------------
    console.log('\n== Summary ==');
    console.table(
      summaries.map((s) => ({
        run: s.name,
        message: JSON.stringify(s.message),
        'wall s': (s.wallMs / 1000).toFixed(1),
        'sentinels healed': s.healed,
        'handlePage expected': s.expectedPages,
        'handlePage observed': s.pages ? s.pages.succeeded : 'n/a',
      })),
    );
    const remaining = await db
      .collection(TRUSTEE_COLLECTION)
      .countDocuments({ trusteeId: SENTINEL_TRUSTEE_ID });
    console.log(`Sentinels left (non-healable by design): ${remaining}`);
  } finally {
    await client.close();
  }

  console.log(`\n${passCount} passed, ${failures.length} failed`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  - ${f}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
