/**
 * Integration test harness for TrusteeMatchVerificationMongoRepository.search().
 *
 * Exercises the real, unmocked repository against a real MongoDB instance — no
 * mocks, no HTTP layer. Guards against a regression class that unit tests
 * (fully mocked) cannot catch: search() filters on documentType and sorts
 * orderBy(['taskDate', 'ASCENDING']), and the Cosmos DB Mongo API collection's
 * declared index policy must cover that sort field or every call fails with
 * HTTP 500 ("The index path corresponding to the specified order-by item is
 * excluded."). See ops/cloud-deployment/lib/cosmos/mongo/cosmos-collections.bicep
 * (trusteeMatchVerificationCollection) for the index this guards.
 *
 * Two environments via INTEGRATION_ENV:
 *   local  (default) — localhost container started by start-services.sh. Plain
 *                       MongoDB has no concept of Cosmos's index-policy
 *                       enforcement, so this mode validates query LOGIC
 *                       (filter/sort/projection correctness) only — it cannot
 *                       catch the indexing-policy bug this harness exists for.
 *   azure            — a real, EPHEMERAL Cosmos DB Mongo API database (a new
 *                       database name within the same Cosmos account your
 *                       MONGO_CONNECTION_STRING already points to), stood up
 *                       fresh per run by ../../_lib/ephemeral-cosmos-database.ts
 *                       and torn down the same way. Never the persistent e2e
 *                       database the Playwright suite depends on. Only this
 *                       mode can catch the indexing bug, because only the
 *                       real Cosmos RU engine enforces index-policy
 *                       restrictions. See test/integration/README.md (_lib
 *                       section) for why this uses the Mongo driver rather
 *                       than the Azure `az` CLI.
 *
 * In azure mode, this harness's own seed step deliberately does NOT create
 * the sort index — that's ../../_lib/ephemeral-cosmos-database.ts's job
 * (via its stand-up command/function), so a future regression that
 * misdeclares the index still gets caught by Test 1 below. In local mode the
 * index is self-created for parity of the "index exists" assertion, since
 * plain Mongo has no policy to guard in the first place.
 *
 * Usage (from test/integration/):
 *   npm run trustee-match-verification-search -- [command]
 *
 * Local workflow:
 *   1. cd trustee-match-verification-search/scripts && ./start-services.sh
 *   2. Copy .env.template to .env.local
 *   3. npm run trustee-match-verification-search:local -- seed
 *   4. npm run trustee-match-verification-search:local -- run
 *   5. npm run trustee-match-verification-search:local -- clean
 *   6. cd trustee-match-verification-search/scripts && ./stop-services.sh
 *
 * Azure workflow (manual only — not wired into CI):
 *   Requires MONGO_CONNECTION_STRING in the environment (e.g. sourced from a
 *   local, gitignored .env — same convention as backend/.env) and
 *   COSMOS_DATABASE_NAME set to the ephemeral database name you provision:
 *     1. npx tsx --tsconfig ../../backend/tsconfig.json \
 *          ../../_lib/ephemeral-cosmos-database.ts stand-up \
 *          --databaseName <name-with--idxtest-> \
 *          --collection trustee-match-verification --indexKey documentType:1,taskDate:1
 *     2. export COSMOS_DATABASE_NAME=<the same --databaseName value>
 *     3. npm run trustee-match-verification-search:azure -- seed
 *     4. npm run trustee-match-verification-search:azure -- run
 *     5. npx tsx --tsconfig ../../backend/tsconfig.json \
 *          ../../_lib/ephemeral-cosmos-database.ts tear-down --databaseName <name>
 *
 * Commands:
 *   seed    Insert fixture documents into MongoDB
 *   run     Run all search()/findVerificationsMissingTaskDate assertions
 *   clean   Remove all seeded fixture documents
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import { Collection, MongoClient } from 'mongodb';
import { InvocationContext } from '@azure/functions';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { closeDeferred } from '../../../../backend/lib/deferrable/defer-close';
import { TrusteeMatchVerificationMongoRepository } from '../../../../backend/lib/adapters/gateways/mongo/trustee-match-verification.mongo.repository';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
} from '../../../../common/src/cams/trustee-match-verification';

const HARNESS_DIR = path.resolve(__dirname, '../');

const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

const COLLECTION_NAME = 'trustee-match-verification';
const SORT_INDEX_NAME = 'documentType_1_taskDate_1';

// Fixture ids — unique prefix unlikely to collide with real data
const ID_PENDING_MID = 'integration-tmv-search-pending-mid';
const ID_APPROVED_EARLY = 'integration-tmv-search-approved-early';
const ID_PENDING_LATE = 'integration-tmv-search-pending-late';
const ID_REJECTED_NO_TASKDATE = 'integration-tmv-search-rejected-no-taskdate';
const ID_REJECTED_LATEST = 'integration-tmv-search-rejected-latest';

const SYSTEM_USER = { id: 'integration-test', name: 'Integration Test Harness' };

function loadEnv() {
  if (IS_LOCAL) {
    const localEnvPath = path.join(HARNESS_DIR, '.env.local');
    if (!fs.existsSync(localEnvPath)) {
      console.error(
        `Missing ${localEnvPath} — run start-services.sh first, then copy .env.template to .env.local`,
      );
      process.exit(1);
    }
    dotenv.config({ path: localEnvPath, override: true });
  } else {
    // Ephemeral Cosmos mode: the calling CI workflow already exported
    // MONGO_CONNECTION_STRING/COSMOS_DATABASE_NAME for the freshly
    // stood-up throwaway database. No file to load, no shared/persistent
    // credentials — mirrors verify-dedup-cosmos.mjs's pure-env-var idiom.
    if (!process.env.MONGO_CONNECTION_STRING || !process.env.COSMOS_DATABASE_NAME) {
      console.error(
        'INTEGRATION_ENV=azure requires MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME to already be set in the environment.',
      );
      process.exit(1);
    }
  }
}

// ---------------------------------------------------------------------------
// Fingerprint/variant — mirrors backend/lib/use-cases/dataflows/trustee-variant.helpers.ts
// so fixture docs satisfy the (fingerprint, variant, documentType) unique
// index the same way real dataflow-written documents do.
// ---------------------------------------------------------------------------

function buildVariant(lastName: string): string {
  return JSON.stringify({
    firstName: '',
    middleName: '',
    lastName: lastName.trim().toLowerCase(),
    generation: '',
    address1: '',
    address2: '',
    address3: '',
    cityStateZipCountry: '',
    phone: '',
    fax: '',
    email: '',
  });
}

function computeFingerprint(variant: string): string {
  return createHash('sha256').update(variant).digest('hex');
}

function makeVerification(overrides: Partial<TrusteeMatchVerification>): TrusteeMatchVerification {
  const variant = buildVariant(overrides.id ?? 'integration-tmv-search');
  const fingerprint = computeFingerprint(variant);
  const base: TrusteeMatchVerification = {
    id: 'integration-tmv-search-unset',
    documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
    caseId: '081-24-00001',
    courtId: '0208',
    dxtrTrustee: { fullName: 'Integration Test Trustee' },
    matchCandidates: [],
    taskType: 'trustee-match',
    status: 'pending',
    createdOn: '2024-01-01T00:00:00.000Z',
    createdBy: SYSTEM_USER,
    updatedOn: '2024-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER,
    fingerprint,
    variant,
  };
  return { ...base, ...overrides, fingerprint, variant };
}

function buildFixtures(): TrusteeMatchVerification[] {
  return [
    makeVerification({
      id: ID_PENDING_MID,
      status: 'pending',
      taskDate: '2024-02-01T00:00:00.000Z',
    }),
    makeVerification({
      id: ID_APPROVED_EARLY,
      status: 'approved',
      taskDate: '2024-01-01T00:00:00.000Z',
    }),
    makeVerification({
      id: ID_PENDING_LATE,
      status: 'pending',
      taskDate: '2024-03-01T00:00:00.000Z',
    }),
    // No taskDate — exercises findVerificationsMissingTaskDate. status is
    // 'rejected' so it's cleanly excluded from the status:['pending','approved']
    // search() assertions below without relying on how Mongo/Cosmos orders a
    // missing sort field.
    makeVerification({
      id: ID_REJECTED_NO_TASKDATE,
      status: 'rejected',
    }),
    makeVerification({
      id: ID_REJECTED_LATEST,
      status: 'rejected',
      taskDate: '2024-04-01T00:00:00.000Z',
    }),
  ];
}

// ---------------------------------------------------------------------------
// Env + DB connection
// ---------------------------------------------------------------------------

async function getDb(): Promise<{ client: MongoClient; collection: Collection }> {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName)
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
  await client.connect();
  const db = client.db(dbName);
  return { client, collection: db.collection(COLLECTION_NAME) };
}

async function getAppContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

let passCount = 0;
let failCount = 0;

function pass(msg: string) {
  passCount++;
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string) {
  failCount++;
  console.error(`  ✗ FAIL: ${msg}`);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// seed
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding trustee-match-verification-search fixtures...\n');
  const { client, collection } = await getDb();
  try {
    const fixtures = buildFixtures();
    const ids = fixtures.map((f) => f.id);

    const deleteResult = await collection.deleteMany({ id: { $in: ids } });
    console.log(`  Cleared ${deleteResult.deletedCount} existing fixture documents`);

    const insertResult = await collection.insertMany(fixtures as never[]);
    console.log(`  Inserted ${insertResult.insertedCount} documents`);

    if (IS_LOCAL) {
      // Local-only: self-create the sort index for "index exists" assertion
      // parity. Plain MongoDB has no indexing-policy restriction to guard
      // here — see the file header for why azure mode must NOT do this.
      await collection.createIndex({ documentType: 1, taskDate: 1 }, { name: SORT_INDEX_NAME });
      console.log(`  Created local-only sort index ${SORT_INDEX_NAME} (parity only, not a guard)`);
    }

    console.log('\nSeed complete.\n');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning trustee-match-verification-search fixtures...\n');
  const { client, collection } = await getDb();
  try {
    const ids = [
      ID_PENDING_MID,
      ID_APPROVED_EARLY,
      ID_PENDING_LATE,
      ID_REJECTED_NO_TASKDATE,
      ID_REJECTED_LATEST,
    ];
    const result = await collection.deleteMany({ id: { $in: ids } });
    console.log(`  Deleted ${result.deletedCount} documents`);
    console.log('\nClean complete.\n');
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run — all assertions
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning trustee-match-verification-search assertions...\n');

  // Fast connectivity check — fails in ≤5s rather than the default 30s
  // if MongoDB/Cosmos is unreachable before we hand off to the repository.
  const { client: probeClient } = await getDb();
  await probeClient.close();

  const context = await getAppContext();
  const repository = new TrusteeMatchVerificationMongoRepository(context);

  try {
    // -------------------------------------------------------------------------
    // Test 1: sort composite index exists
    // This is the index this whole harness exists to guard — see
    // cosmos-collections.bicep's trusteeMatchVerificationCollection.
    // -------------------------------------------------------------------------
    console.log('Test 1: sort index (documentType: 1, taskDate: 1) exists');
    {
      const { client: idxClient, collection } = await getDb();
      try {
        const indexes = await collection.indexes();
        const expectedKey = { documentType: 1, taskDate: 1 };
        const hasSortIndex = indexes.some(
          (idx) => JSON.stringify(idx.key) === JSON.stringify(expectedKey),
        );
        if (hasSortIndex) {
          pass('sort index (documentType: 1, taskDate: 1) present');
        } else {
          fail('sort index MISSING on trustee-match-verification — see cosmos-collections.bicep');
        }
      } finally {
        await idxClient.close();
      }
    }

    // -------------------------------------------------------------------------
    // Test 2: search() — this is the query that fails with HTTP 500 in real
    // Cosmos when the sort index above is missing. Filters status in
    // [pending, approved]; must exclude both 'rejected' fixtures.
    // -------------------------------------------------------------------------
    console.log('\nTest 2: search({status: [pending, approved]}) — filter + sort');
    {
      const results = await repository.search({ status: ['pending', 'approved'] });
      // Filter to just this harness's fixture ids -- the shared collection may
      // hold unrelated pending/approved documents from other test runs or
      // real data, and this assertion only cares about correctness among the
      // fixtures it seeded. Uses the FULL ids array (not a subset filtered to
      // one expected list), so both a leaked rejected fixture and an
      // unexpected/duplicate id are caught by the same exact-match check.
      const fixtureIds = [
        ID_PENDING_MID,
        ID_APPROVED_EARLY,
        ID_PENDING_LATE,
        ID_REJECTED_NO_TASKDATE,
        ID_REJECTED_LATEST,
      ];
      const ids = results.map((r) => r.id).filter((id) => fixtureIds.includes(id));

      const expectedOrder = [ID_APPROVED_EARLY, ID_PENDING_MID, ID_PENDING_LATE];
      if (ids.length !== expectedOrder.length) {
        fail(
          `unexpected result count for pending/approved search among this harness's fixtures: ` +
            `expected ${expectedOrder.length}, got ${ids.length} (${ids.join(', ')})`,
        );
      } else if (!ids.every((id, index) => id === expectedOrder[index])) {
        fail(
          `pending/approved results do not match expected order.\n` +
            `expected: ${expectedOrder.join(', ')}\n` +
            `actual:   ${ids.join(', ')}`,
        );
      } else {
        pass(
          `rejected fixtures excluded and results sorted by taskDate ASCENDING: ${ids.join(' → ')}`,
        );
      }
    }

    // -------------------------------------------------------------------------
    // Test 3: findVerificationsMissingTaskDate — adjacent coverage, NOT part
    // of the bug this harness guards (sorts by _id, always auto-indexed).
    // -------------------------------------------------------------------------
    console.log(
      '\nTest 3: findVerificationsMissingTaskDate (adjacent coverage, not the guarded bug)',
    );
    {
      const missing = await repository.findVerificationsMissingTaskDate(null, 50);
      const ids = missing.map((m) => m.id);
      if (ids.includes(ID_REJECTED_NO_TASKDATE)) {
        pass('fixture missing taskDate found by findVerificationsMissingTaskDate');
      } else {
        fail('fixture missing taskDate NOT found by findVerificationsMissingTaskDate');
      }
      if (
        ids.includes(ID_PENDING_MID) ||
        ids.includes(ID_APPROVED_EARLY) ||
        ids.includes(ID_PENDING_LATE) ||
        ids.includes(ID_REJECTED_LATEST)
      ) {
        fail('a fixture WITH taskDate incorrectly appeared in missing-taskDate results');
      } else {
        pass('fixtures with taskDate correctly excluded');
      }
    }

    // -------------------------------------------------------------------------
    // Test 4 (CAMS-886): update() persists affectedCaseIds and findById() reads
    // it back unchanged — proves the real driver's replaceOne-merge round-trips
    // the snapshot field a unit test (mocked repository) cannot observe.
    // -------------------------------------------------------------------------
    console.log('\nTest 4: update() persists affectedCaseIds; findById() reads it back');
    {
      const snapshot = ['081-24-11111', '081-24-22222'];
      await repository.update(ID_APPROVED_EARLY, {
        status: 'approved',
        affectedCaseIds: snapshot,
      });
      const reloaded = await repository.findById(ID_APPROVED_EARLY);

      if (JSON.stringify(reloaded.affectedCaseIds) === JSON.stringify(snapshot)) {
        pass(`affectedCaseIds round-tripped through update()/findById(): ${snapshot.join(', ')}`);
      } else {
        fail(
          `affectedCaseIds did not round-trip: expected ${JSON.stringify(snapshot)}, ` +
            `got ${JSON.stringify(reloaded.affectedCaseIds)}`,
        );
      }
    }
  } finally {
    await repository.closeClient();
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passCount} passed, ${failCount} failed`);
  if (failCount > 0) {
    console.error('\nSome tests failed — see FAIL lines above.');
    process.exitCode = 1;
  } else {
    console.log('\nAll tests passed.');
  }

  await closeDeferred(context);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function help() {
  console.log(`
trustee-match-verification-search integration test harness

Usage (from test/integration/):
  npm run trustee-match-verification-search -- <command>

Commands:
  seed    Insert fixture documents into MongoDB
  run     Run all search()/findVerificationsMissingTaskDate assertions
  clean   Remove all seeded fixture documents
  help    Show this help

Local workflow:
  1. cd trustee-match-verification-search/scripts && ./start-services.sh
  2. Copy .env.template to .env.local
  3. npm run trustee-match-verification-search:local -- seed
  4. npm run trustee-match-verification-search:local -- run
  5. npm run trustee-match-verification-search:local -- clean
  6. cd trustee-match-verification-search/scripts && ./stop-services.sh
`);
}

loadEnv();

const command = process.argv[2] ?? 'help';

(async () => {
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
    default:
      help();
  }
})().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
