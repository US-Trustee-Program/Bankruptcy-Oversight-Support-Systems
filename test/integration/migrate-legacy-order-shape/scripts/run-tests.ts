/**
 * Integration test suite for MIGRATE-LEGACY-ORDER-SHAPE.
 *
 * Proves — against a real MongoDB instance, calling the actual use case
 * in-process (no mocks, no HTTP, no function app) — that legacy-shaped
 * transfer orders, consolidation orders, and trustee-match-verification
 * documents (orderType only, no taskType / taskDate) are migrated to the
 * current shape:
 *
 *   orderType (renamed) → taskType
 *   orderDate or createdOn/updatedOn (computed) → taskDate
 *
 * in a single atomic per-document update, with no dependency on a
 * separately-sequenced rename migration having run first.
 *
 * Usage (from test/integration/):
 *   npm run migrate-legacy-order-shape -- [command]
 *
 * Local workflow:
 *   1. cd migrate-legacy-order-shape/scripts && ./start-services.sh
 *   2. Copy .env.local.template to .env.local
 *   3. npm run migrate-legacy-order-shape -- seed
 *   4. npm run migrate-legacy-order-shape -- run
 *   5. npm run migrate-legacy-order-shape -- clean
 *   6. cd migrate-legacy-order-shape/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Insert legacy-shaped fixture documents into MongoDB
 *   run     Run the use case to completion and assert the resulting shape
 *   clean   Remove all fixture documents
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { Collection, MongoClient } from 'mongodb';
import { ApplicationConfiguration } from '../../../../backend/lib/configs/application-configuration';
import { LoggerImpl } from '../../../../backend/lib/adapters/services/logger.service';
import factory from '../../../../backend/lib/factory';
import { finalizeDeferrable } from '../../../../backend/lib/deferrable/finalize-deferrable';
import { ApplicationContext } from '../../../../backend/lib/adapters/types/basic';
import MigrateLegacyOrderShapeUseCase from '../../../../backend/lib/use-cases/dataflows/migrate-legacy-order-shape';

const HARNESS_DIR = path.resolve(__dirname, '../');

const ORDERS_COLLECTION = 'orders';
const CONSOLIDATIONS_COLLECTION = 'consolidations';
const VERIFICATIONS_COLLECTION = 'trustee-match-verification';
const PAGE_SIZE = 2; // small on purpose — forces multiple cursor pages in the "run" assertions

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(`Missing ${localEnvPath} — copy .env.local.template to .env.local first`);
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
  // Must be unset/false — this proves the migration against the real Mongo
  // repositories, not MockMongoRepository.
  delete process.env.DATABASE_MOCK;
}

loadEnv();

// ---------------------------------------------------------------------------
// MongoDB helpers (raw driver — used for seeding/assertions, not the migration itself)
// ---------------------------------------------------------------------------

async function getDb(): Promise<{ client: MongoClient; collections: Record<string, Collection> }> {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);
  return {
    client,
    collections: {
      orders: db.collection(ORDERS_COLLECTION),
      consolidations: db.collection(CONSOLIDATIONS_COLLECTION),
      verifications: db.collection(VERIFICATIONS_COLLECTION),
    },
  };
}

function buildApplicationContext(): ApplicationContext {
  const config = new ApplicationConfiguration();
  const logger = new LoggerImpl('migrate-legacy-order-shape-integration-test');
  return {
    config,
    featureFlags: {},
    logger,
    observability: factory.getObservability(logger),
    invocationId: 'migrate-legacy-order-shape-integration-test',
    session: undefined,
    closables: [],
    releasables: [],
    extraOutputs: { set: () => {} },
  };
}

// ---------------------------------------------------------------------------
// Legacy-shaped fixtures — orderType / orderDate only, no taskType / taskDate.
// Mirrors what production consolidation/transfer order documents looked like
// before the CAMS-746 shape change.
// ---------------------------------------------------------------------------

type LegacyTransferOrderDoc = {
  id: string;
  caseId: string;
  orderType: 'transfer';
  orderDate: string;
  status: string;
  docketEntries: unknown[];
};

type LegacyConsolidationOrderDoc = {
  consolidationId: string;
  orderType: 'consolidation';
  orderDate: string;
  status: string;
  courtName: string;
  courtDivisionCode: string;
  jobId: number;
  memberCases: unknown[];
};

const LEGACY_TRANSFER_FIXTURES: LegacyTransferOrderDoc[] = [
  {
    id: 'transfer-001',
    caseId: '091-24-10001',
    orderType: 'transfer',
    orderDate: '2024-01-15T00:00:00.000Z',
    status: 'pending',
    docketEntries: [],
  },
  {
    id: 'transfer-002',
    caseId: '091-24-10002',
    orderType: 'transfer',
    orderDate: '2024-03-20T00:00:00.000Z',
    status: 'approved',
    docketEntries: [],
  },
  {
    id: 'transfer-003',
    caseId: '091-24-10003',
    orderType: 'transfer',
    orderDate: '2024-06-01T00:00:00.000Z',
    status: 'pending',
    docketEntries: [],
  },
];

const LEGACY_CONSOLIDATION_FIXTURES: LegacyConsolidationOrderDoc[] = [
  {
    consolidationId: 'consolidation-001',
    orderType: 'consolidation',
    orderDate: '2024-02-10T00:00:00.000Z',
    status: 'pending',
    courtName: 'Southern District of New York',
    courtDivisionCode: 'SDNY',
    jobId: 100,
    memberCases: [],
  },
  {
    consolidationId: 'consolidation-002',
    orderType: 'consolidation',
    orderDate: '2024-04-05T00:00:00.000Z',
    status: 'approved',
    courtName: 'Northern District of California',
    courtDivisionCode: 'NDCA',
    jobId: 200,
    memberCases: [],
  },
  {
    consolidationId: 'consolidation-003',
    orderType: 'consolidation',
    orderDate: '2024-07-22T00:00:00.000Z',
    status: 'pending',
    courtName: 'Eastern District of Texas',
    courtDivisionCode: 'EDTX',
    jobId: 300,
    memberCases: [],
  },
];

type LegacyVerificationDoc = {
  id: string;
  documentType: 'TRUSTEE_MATCH_VERIFICATION';
  caseId: string;
  courtId: string;
  orderType: 'trustee-match';
  status: string;
  matchCandidates: unknown[];
  createdOn: string;
  updatedOn: string;
};

const LEGACY_VERIFICATION_FIXTURES: LegacyVerificationDoc[] = [
  {
    id: 'verification-001',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: '091-24-20001',
    courtId: '081',
    orderType: 'trustee-match',
    status: 'pending',
    matchCandidates: [],
    createdOn: '2024-05-01T00:00:00.000Z',
    updatedOn: '2024-05-01T00:00:00.000Z',
  },
  {
    id: 'verification-002',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: '091-24-20002',
    courtId: '081',
    orderType: 'trustee-match',
    status: 'pending',
    matchCandidates: [],
    createdOn: '2024-05-15T00:00:00.000Z',
    updatedOn: '2024-05-15T00:00:00.000Z',
  },
  {
    id: 'verification-003',
    documentType: 'TRUSTEE_MATCH_VERIFICATION',
    caseId: '091-24-20003',
    courtId: '081',
    orderType: 'trustee-match',
    status: 'pending',
    matchCandidates: [],
    createdOn: '2024-06-01T00:00:00.000Z',
    updatedOn: '2024-06-01T00:00:00.000Z',
  },
];

// Already-migrated documents — must be left untouched by the migration (no
// orderType field to match on) and must not appear in "legacy shape" pages.
const ALREADY_MIGRATED_CONSOLIDATION: Record<string, unknown> = {
  consolidationId: 'consolidation-already-migrated',
  taskType: 'consolidation',
  orderDate: '2024-08-01T00:00:00.000Z',
  taskDate: '2024-08-01T00:00:00.000Z',
  status: 'pending',
  courtName: 'District of New Jersey',
  courtDivisionCode: 'DNJ',
  jobId: 400,
  memberCases: [],
};

const ALREADY_MIGRATED_TRANSFER: Record<string, unknown> = {
  id: 'transfer-already-migrated',
  caseId: '091-24-10004',
  taskType: 'transfer',
  orderDate: '2024-08-02T00:00:00.000Z',
  taskDate: '2024-08-02T00:00:00.000Z',
  status: 'pending',
  docketEntries: [],
};

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
  passed++;
}

function fail(msg: string) {
  console.error(`  ✗ FAIL: ${msg}`);
  failed++;
  process.exitCode = 1;
}

function assertFieldAbsent(label: string, doc: Record<string, unknown>, field: string) {
  if (!(field in doc)) {
    pass(`${label} — "${field}" absent`);
  } else {
    fail(`${label} — "${field}" should be absent, got ${JSON.stringify(doc[field])}`);
  }
}

function assertFieldEquals(
  label: string,
  doc: Record<string, unknown>,
  field: string,
  expected: unknown,
) {
  if (doc[field] === expected) {
    pass(`${label} — "${field}" = ${JSON.stringify(expected)}`);
  } else {
    fail(
      `${label} — "${field}" expected ${JSON.stringify(expected)}, got ${JSON.stringify(doc[field])}`,
    );
  }
}

function assertCount(label: string, actual: number, expected: number) {
  if (actual === expected) {
    pass(`${label} — count: ${actual}`);
  } else {
    fail(`${label} — expected count ${expected}, got ${actual}`);
  }
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding integration test fixtures...\n');
  const { client, collections } = await getDb();
  try {
    await collections.orders.deleteMany({});
    await collections.consolidations.deleteMany({});
    await collections.verifications.deleteMany({});

    await collections.orders.insertMany(
      LEGACY_TRANSFER_FIXTURES as unknown as Record<string, unknown>[],
    );
    pass(
      `Inserted ${LEGACY_TRANSFER_FIXTURES.length} legacy transfer orders into "${ORDERS_COLLECTION}"`,
    );

    await collections.consolidations.insertMany(
      LEGACY_CONSOLIDATION_FIXTURES as unknown as Record<string, unknown>[],
    );
    pass(
      `Inserted ${LEGACY_CONSOLIDATION_FIXTURES.length} legacy consolidation orders into "${CONSOLIDATIONS_COLLECTION}"`,
    );

    await collections.consolidations.insertOne(ALREADY_MIGRATED_CONSOLIDATION);
    pass(`Inserted 1 already-migrated consolidation order into "${CONSOLIDATIONS_COLLECTION}"`);

    await collections.orders.insertOne(ALREADY_MIGRATED_TRANSFER);
    pass(`Inserted 1 already-migrated transfer order into "${ORDERS_COLLECTION}"`);

    await collections.verifications.insertMany(
      LEGACY_VERIFICATION_FIXTURES as unknown as Record<string, unknown>[],
    );
    pass(
      `Inserted ${LEGACY_VERIFICATION_FIXTURES.length} legacy trustee match verifications into "${VERIFICATIONS_COLLECTION}"`,
    );
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run
// ---------------------------------------------------------------------------

async function driveMigrationToCompletion(
  context: ApplicationContext,
  kind: 'transfer' | 'consolidation' | 'trustee-match',
) {
  let lastId: string | null = null;
  let totalProcessed = 0;
  let pages = 0;

  for (;;) {
    const result = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
      context,
      kind,
      lastId,
      PAGE_SIZE,
    );

    if (result.status === 'error') {
      throw new Error(`${kind} migration failed: ${result.error.message}`);
    }
    if (result.status === 'empty') {
      break;
    }

    pages++;
    totalProcessed += result.processedCount;
    if (!result.nextCursor) {
      break;
    }
    lastId = result.nextCursor.lastId;
  }

  return { totalProcessed, pages };
}

async function run() {
  console.log('\nRunning migrate-legacy-order-shape integration tests...\n');
  const { client, collections } = await getDb();
  const context = buildApplicationContext();

  try {
    // ────────────────────────────────────────────────────────────────────────
    // Drive the real use case to completion for both order kinds, across
    // multiple cursor pages (PAGE_SIZE=2 against 3 fixtures each).
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- Consolidation orders ---');
    const consolidationRun = await driveMigrationToCompletion(context, 'consolidation');
    assertCount(
      'consolidation migration processed all legacy documents',
      consolidationRun.totalProcessed,
      LEGACY_CONSOLIDATION_FIXTURES.length,
    );
    if (consolidationRun.pages > 1) {
      pass(`consolidation migration required multiple cursor pages (${consolidationRun.pages})`);
    } else {
      fail(
        `consolidation migration expected multiple cursor pages, got ${consolidationRun.pages} — PAGE_SIZE/fixture count may need adjusting`,
      );
    }

    console.log('--- Transfer orders ---');
    const transferRun = await driveMigrationToCompletion(context, 'transfer');
    assertCount(
      'transfer migration processed all legacy documents',
      transferRun.totalProcessed,
      LEGACY_TRANSFER_FIXTURES.length,
    );

    console.log('--- Trustee match verifications ---');
    const verificationRun = await driveMigrationToCompletion(context, 'trustee-match');
    assertCount(
      'trustee-match migration processed all legacy documents',
      verificationRun.totalProcessed,
      LEGACY_VERIFICATION_FIXTURES.length,
    );

    // ────────────────────────────────────────────────────────────────────────
    // Verify the resulting shape directly against MongoDB — orderType is gone
    // (renamed), taskType is present with the original value, and taskDate
    // equals the original orderDate. orderDate itself is untouched.
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- Post-migration shape: consolidations ---');
    for (const fixture of LEGACY_CONSOLIDATION_FIXTURES) {
      const doc = (await collections.consolidations.findOne({
        consolidationId: fixture.consolidationId,
      })) as Record<string, unknown>;
      assertFieldAbsent(
        `consolidation ${fixture.consolidationId}: orderType renamed away`,
        doc,
        'orderType',
      );
      assertFieldEquals(
        `consolidation ${fixture.consolidationId}: taskType set`,
        doc,
        'taskType',
        'consolidation',
      );
      assertFieldEquals(
        `consolidation ${fixture.consolidationId}: taskDate computed from orderDate`,
        doc,
        'taskDate',
        fixture.orderDate,
      );
      assertFieldEquals(
        `consolidation ${fixture.consolidationId}: orderDate preserved`,
        doc,
        'orderDate',
        fixture.orderDate,
      );
    }

    console.log('--- Post-migration shape: transfers ---');
    for (const fixture of LEGACY_TRANSFER_FIXTURES) {
      const doc = (await collections.orders.findOne({ id: fixture.id })) as Record<string, unknown>;
      assertFieldAbsent(`transfer ${fixture.id}: orderType renamed away`, doc, 'orderType');
      assertFieldEquals(`transfer ${fixture.id}: taskType set`, doc, 'taskType', 'transfer');
      assertFieldEquals(
        `transfer ${fixture.id}: taskDate computed from orderDate`,
        doc,
        'taskDate',
        fixture.orderDate,
      );
      assertFieldEquals(
        `transfer ${fixture.id}: orderDate preserved`,
        doc,
        'orderDate',
        fixture.orderDate,
      );
    }

    console.log('--- Post-migration shape: trustee match verifications ---');
    for (const fixture of LEGACY_VERIFICATION_FIXTURES) {
      const doc = (await collections.verifications.findOne({ id: fixture.id })) as Record<
        string,
        unknown
      >;
      assertFieldAbsent(`verification ${fixture.id}: orderType renamed away`, doc, 'orderType');
      assertFieldEquals(
        `verification ${fixture.id}: taskType set`,
        doc,
        'taskType',
        'trustee-match',
      );
      assertFieldEquals(
        `verification ${fixture.id}: taskDate computed from createdOn (no orderDate on this type)`,
        doc,
        'taskDate',
        fixture.createdOn,
      );
    }

    // ────────────────────────────────────────────────────────────────────────
    // The already-migrated document must be untouched — no orderType to
    // rename means it should never be selected by findOrdersWithLegacyShape.
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- Already-migrated document is left alone ---');
    const alreadyMigratedConsolidation = (await collections.consolidations.findOne({
      consolidationId: 'consolidation-already-migrated',
    })) as Record<string, unknown>;
    assertFieldEquals(
      'already-migrated consolidation: taskDate unchanged',
      alreadyMigratedConsolidation,
      'taskDate',
      ALREADY_MIGRATED_CONSOLIDATION.taskDate,
    );
    assertFieldAbsent(
      'already-migrated consolidation: still has no orderType',
      alreadyMigratedConsolidation,
      'orderType',
    );

    const alreadyMigratedTransfer = (await collections.orders.findOne({
      id: 'transfer-already-migrated',
    })) as Record<string, unknown>;
    assertFieldEquals(
      'already-migrated transfer: taskDate unchanged',
      alreadyMigratedTransfer,
      'taskDate',
      ALREADY_MIGRATED_TRANSFER.taskDate,
    );
    assertFieldAbsent(
      'already-migrated transfer: still has no orderType',
      alreadyMigratedTransfer,
      'orderType',
    );

    // ────────────────────────────────────────────────────────────────────────
    // Re-running the migration after completion must be a no-op ("empty" on
    // the first page) — this is the same claim the original bug got wrong:
    // an immediate empty result must genuinely mean nothing is left, not
    // "the precondition never ran."
    // ────────────────────────────────────────────────────────────────────────
    console.log('--- Idempotency: re-running after completion finds nothing ---');
    for (const kind of ['consolidation', 'transfer', 'trustee-match'] as const) {
      const rerun = await MigrateLegacyOrderShapeUseCase.processMigrationPage(
        context,
        kind,
        null,
        PAGE_SIZE,
      );
      if (rerun.status === 'empty') {
        pass(`re-running ${kind} migration after completion returns empty`);
      } else {
        fail(`re-running ${kind} migration expected 'empty', got '${rerun.status}'`);
      }
    }
  } finally {
    await finalizeDeferrable(context);
    await client.close();
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('='.repeat(60));
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up integration test fixtures...\n');
  const { client, collections } = await getDb();
  try {
    const r1 = await collections.orders.deleteMany({});
    pass(`Deleted ${r1.deletedCount} doc(s) from "${ORDERS_COLLECTION}"`);

    const r2 = await collections.consolidations.deleteMany({});
    pass(`Deleted ${r2.deletedCount} doc(s) from "${CONSOLIDATIONS_COLLECTION}"`);

    const r3 = await collections.verifications.deleteMany({});
    pass(`Deleted ${r3.deletedCount} doc(s) from "${VERIFICATIONS_COLLECTION}"`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('Migrate Legacy Order Shape — Integration Test Suite');
  console.log('='.repeat(60));

  switch (command) {
    case 'seed':
      await seed();
      break;
    case 'run':
      await run();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run migrate-legacy-order-shape --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  ${HARNESS} <command>`);
      console.log('\nLocal workflow:');
      console.log('  1. cd migrate-legacy-order-shape/scripts && ./start-services.sh');
      console.log('  2. Copy .env.local.template to .env.local');
      console.log(`  3. ${HARNESS} seed`);
      console.log(`  4. ${HARNESS} run`);
      console.log(`  5. ${HARNESS} clean`);
      console.log('  6. cd migrate-legacy-order-shape/scripts && ./stop-services.sh');
      console.log('\nProves orderType→taskType (rename) and taskDate (computed) migrate');
      console.log(
        'atomically per document, across orders, consolidations, and trustee-match-verification',
      );
      console.log('collections, via the real MigrateLegacyOrderShapeUseCase — no mocks.');
    }
  }

  console.log('\n' + '='.repeat(60));
  // The Mongo driver keeps handles open on the process-wide singleton
  // repositories used by MigrateLegacyOrderShapeUseCase — exit explicitly
  // rather than waiting for the event loop to drain, same as the other
  // integration harnesses in this directory.
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
