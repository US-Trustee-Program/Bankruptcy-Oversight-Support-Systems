/**
 * Integration test harness for the trustee-verification-remap dataflow (CAMS-894 / GitHub #2943).
 *
 * Approving a trustee match in Data Verification is split into a synchronous approval step and
 * an asynchronous remap step — the actual CaseAppointment write only happens in the second step,
 * which runs as a queue-triggered dataflow. This harness exercises the real path end to end
 * against real infrastructure:
 *
 *   TrusteeMatchVerificationUseCase.approveVerification() [real use case, real repo]
 *     -> enqueues to the real trustee-match-verification-remap queue
 *   Azurite queue -> real dataflows function app (containerized or host-run)
 *     -> TrusteeVerificationRemapUseCase.remapPage() [real]
 *   Assert: case-trustee-appointments + trustee-case-appointments (both dual-write partitions)
 *
 * Fixtures are seeded via the real repository/use-case methods wherever possible (upsert(),
 * upsertVerification(), approveVerification()) rather than raw Mongo inserts — a hand-inserted
 * surrogate with a harness-chosen id would fabricate the exact invariant (same id across both
 * partitions) whose violation is what run-divergence exists to reproduce.
 *
 * Two environments are supported via INTEGRATION_ENV:
 *   local  (default) — localhost containers started by start-services.sh
 *   azure            — lower-env Azure Government databases (VPN required)
 *
 * This is a one-shot script — NOT a Vitest test, NOT a Playwright E2E test.
 *
 * Usage (from test/integration/):
 *   npm run trustee-verification-remap -- [command]
 *
 * Local workflow:
 *   1. cd trustee-verification-remap && cp local.settings.integration.json.template local.settings.integration.json
 *   2. cp .env.local.template .env.local
 *   3. cd scripts && ./start-services.sh
 *   4. cd ../.. && npm run trustee-verification-remap -- run
 *   5. npm run trustee-verification-remap -- run-divergence
 *   6. npm run trustee-verification-remap -- clean
 *   7. cd trustee-verification-remap/scripts && ./stop-services.sh
 *
 * Commands:
 *   check-env        Verify required environment variables are set
 *   run              Happy path: one fingerprint across 4 cases, all resolve correctly
 *   run-pagination   Seed 30 surrogates (> REMAP_PAGE_SIZE=25) to exercise requeue-and-re-query
 *   run-divergence   Regression test for CAMS-894: simulates dual-write divergence on a surrogate,
 *                    reproducing the staging 404 ("Matched and deleted 0 items"). Fails until
 *                    delete() is made idempotent.
 *   run-replay       Delivers the same remap message twice; asserts no duplicates, no errors
 *   clean            Remove all fixtures and clear queues
 *   help             Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { QueueServiceClient } from '@azure/storage-queue';
import { MongoClient, Db } from 'mongodb';
import ContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import factory from '../../../../backend/lib/factory';
import { ApplicationContext } from '../../../../backend/lib/adapters/types/basic';
import { TrusteeMatchVerificationUseCase } from '../../../../backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case';
import {
  buildVariant,
  computeFingerprint,
} from '../../../../backend/lib/use-cases/dataflows/trustee-variant.helpers';
import { createAuditRecord } from '../../../../common/src/cams/auditable';
import MockData from '../../../../common/src/cams/test-utilities/mock-data';
import {
  TrusteeMatchVerification,
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
} from '../../../../common/src/cams/trustee-match-verification';
import { DxtrTrusteeParty } from '../../../../common/src/cams/dataflow-events';

// Resolve paths relative to the repo root
const REPO_ROOT = path.resolve(__dirname, '../../../../');
const HARNESS_DIR = path.resolve(__dirname, '../');

// Environment selection: local (default) or azure
const INTEGRATION_ENV = process.env.INTEGRATION_ENV || 'local';
const IS_LOCAL = INTEGRATION_ENV !== 'azure';

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
    // Azure: load backend/.env then dataflows local.settings.json
    dotenv.config({ path: path.join(REPO_ROOT, 'backend/.env') });
    loadLocalSettings(path.join(REPO_ROOT, 'backend/function-apps/dataflows/local.settings.json'));
  }
}

function loadLocalSettings(settingsPath: string) {
  const resolved = path.resolve(settingsPath);
  if (!fs.existsSync(resolved)) return;
  try {
    const settings = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
    const values: Record<string, string> = settings?.Values ?? {};
    for (const [key, value] of Object.entries(values)) {
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Non-fatal
  }
}

loadEnv();

// ---------------------------------------------------------------------------
// Constants — must match production source (see file header comment for why
// fixtures are seeded through real code instead of hardcoding these directly
// where avoidable)
// ---------------------------------------------------------------------------

const CASE_PARTITION_COLLECTION = 'case-trustee-appointments';
const TRUSTEE_PARTITION_COLLECTION = 'trustee-case-appointments';
const VERIFICATION_COLLECTION = 'trustee-match-verification';
const VARIATION_COLLECTION = 'trustee-variation';

// Queue names — buildQueueName(ModuleNames.TRUSTEE_MATCH_VERIFICATION_REMAP[, 'DLQ']).
// See backend/lib/storage-queues.ts.
const REMAP_QUEUE = 'trustee-match-verification-remap';
const REMAP_DLQ = 'trustee-match-verification-remap-dlq';

// Must match REMAP_PAGE_SIZE in backend/function-apps/dataflows/trustee-verification-remap.ts
const REMAP_PAGE_SIZE = 25;

const COURT_DIVISION_CODE = '081';
const RESOLVED_TRUSTEE_ID = 'INTEGRATION-TRUSTEE-CAMS894-001';
const RESOLVED_TRUSTEE_NAME = 'Integration Test Trustee';
const APPOINTED_DATE = '2024-01-15';
const DATE_FILED = '2024-01-01';

function makeDxtrTrustee(discriminator: string): DxtrTrusteeParty {
  // discriminator keeps each scenario's variant (and therefore fingerprint) distinct so
  // concurrent/leftover runs of different scenarios never collide on the same bucket.
  return {
    firstName: 'Kevin',
    middleName: 'M',
    lastName: `Coffey-${discriminator}`,
    fullName: `Kevin M. Coffey (${discriminator})`,
    legacy: {
      address1: '100 Integration Ave',
      cityStateZipCountry: 'Washington DC 20001 USA',
      phone: '202-555-0199',
      fax: '',
      email: 'integration.trustee@example.com',
    },
  };
}

function caseId(discriminator: string, n: number): string {
  // 081-26-8xxxx — fixture case numbers unlikely to collide with real data
  return `081-26-8${discriminator}${String(n).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Pass / fail / info helpers (matches canonical harness pattern)
// ---------------------------------------------------------------------------

function pass(msg: string) {
  console.log(`  ✓ PASS: ${msg}`);
}

let hasFailures = false;

function fail(msg: string) {
  hasFailures = true;
  console.log(`  ✗ FAIL: ${msg}`);
}

function info(msg: string) {
  console.log(`  ℹ  ${msg}`);
}

// ---------------------------------------------------------------------------
// Connection / context helpers
// ---------------------------------------------------------------------------

async function getMongo(): Promise<{ client: MongoClient; db: Db }> {
  const uri = process.env.MONGO_CONNECTION_STRING;
  const dbName = process.env.COSMOS_DATABASE_NAME;
  if (!uri || !dbName) {
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  }
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

/**
 * Builds a real ApplicationContext against real infrastructure — the same recipe
 * createMockApplicationContext uses (backend/lib/testing/testing-utilities.ts), minus setting
 * DATABASE_MOCK. Never set DATABASE_MOCK here: factory.ts:663 switches every repository to an
 * in-memory mock when it's 'true', which would silently stop this harness from touching real
 * Mongo at all.
 */
async function getAppContext(): Promise<ApplicationContext> {
  const invocationContext = new InvocationContext();
  const context = await ContextCreator.getApplicationContext({
    invocationContext,
    logger: ContextCreator.getLogger(invocationContext),
  });
  context.session = MockData.getCamsSession({
    user: { id: 'integration-harness', name: 'Integration Harness' },
  });
  return context;
}

function getStorageConnectionString(): string {
  const cs = process.env.AzureWebJobsDataflowsStorage || process.env.AzureWebJobsStorage;
  if (!cs) throw new Error('AzureWebJobsStorage or AzureWebJobsDataflowsStorage must be set');
  return cs;
}

async function getQueueClient(queueName: string) {
  const queueService = QueueServiceClient.fromConnectionString(getStorageConnectionString());
  const client = queueService.getQueueClient(queueName);
  await client.createIfNotExists();
  return client;
}

async function getDlqMessageCount(): Promise<number> {
  try {
    const client = await getQueueClient(REMAP_DLQ);
    const props = await client.getProperties();
    return props.approximateMessagesCount ?? 0;
  } catch {
    return 0;
  }
}

async function clearQueues(): Promise<void> {
  for (const queueName of [REMAP_QUEUE, REMAP_DLQ]) {
    try {
      const client = await getQueueClient(queueName);
      await client.clearMessages();
      info(`Cleared queue: ${queueName}`);
    } catch {
      // Queue may not exist yet — that's fine
    }
  }
}

// Poll until predicate resolves true or timeout is reached.
async function pollUntil(
  predicate: () => Promise<boolean>,
  timeoutMs = 45000,
  intervalMs = 2000,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    if (await predicate()) return true;
    const remaining = Math.ceil((deadline - Date.now()) / 1000);
    info(`Attempt ${attempt}: condition not met yet, ${remaining}s remaining...`);
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required: [string, string][] = [
    ['MONGO_CONNECTION_STRING', 'Cosmos DB / MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos database name'],
  ];

  const optional: [string, string][] = [
    ['AzureWebJobsStorage', 'Azure Storage connection string (Azurite for local)'],
    ['AzureWebJobsDataflowsStorage', 'Alternative storage connection string key'],
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
    info(`${name}=${raw ?? '(not set)'} — ${description}`);
  }
  if (!process.env.AzureWebJobsStorage && !process.env.AzureWebJobsDataflowsStorage) {
    fail('At least one of AzureWebJobsStorage / AzureWebJobsDataflowsStorage must be set');
    allPresent = false;
  }

  if (!allPresent) {
    console.log('\n  Set missing variables in .env.local before running.');
  } else {
    console.log('\n  All required variables present.');
  }
}

// ---------------------------------------------------------------------------
// Seeding helpers — real repository/use-case code against real infra
// ---------------------------------------------------------------------------

type SeedResult = {
  context: ApplicationContext;
  fingerprint: string;
  variant: string;
  verificationId: string;
  caseIds: string[];
};

/**
 * Seeds a pending TrusteeMatchVerification plus one surrogate CaseAppointment per caseId, all
 * sharing one fingerprint — exactly the state a Data Verifier sees before approving a match
 * affecting multiple cases. Uses the real repositories (upsertVerification, upsert) so the
 * fixture carries the same invariants production code would produce (e.g. matching `id` across
 * both dual-write partitions).
 */
async function seedPendingVerification(
  caseIds: string[],
  discriminator: string,
): Promise<SeedResult> {
  const dxtrTrustee = makeDxtrTrustee(discriminator);
  const variant = buildVariant(dxtrTrustee);
  const fingerprint = computeFingerprint(variant);

  const context = await getAppContext();

  const verificationRepo = factory.getTrusteeMatchVerificationRepository(context);
  const verificationDoc = createAuditRecord<TrusteeMatchVerification>({
    documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
    caseId: caseIds[0],
    courtId: '0208',
    dxtrTrustee,
    matchCandidates: [],
    status: 'pending',
    taskType: 'trustee-match',
    taskDate: new Date().toISOString(),
    fingerprint,
    variant,
  });
  await verificationRepo.upsertVerification(verificationDoc);
  const saved = await verificationRepo.getVerification(caseIds[0]);
  if (!saved) {
    throw new Error(`Failed to read back seeded verification for case ${caseIds[0]}`);
  }

  const appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
  for (const id of caseIds) {
    await appointmentsRepo.upsert({
      caseId: id,
      trusteeId: fingerprint,
      assignedOn: APPOINTED_DATE,
      appointedDate: APPOINTED_DATE,
      isSurrogate: true,
      variant,
      dateFiled: DATE_FILED,
      chapter: '7',
      courtDivisionCode: COURT_DIVISION_CODE,
    });
  }
  pass(
    `Seeded pending verification (fingerprint ${fingerprint.slice(0, 12)}...) for ${caseIds.length} case(s)`,
  );

  return { context, fingerprint, variant, verificationId: saved.id, caseIds };
}

async function approve(context: ApplicationContext, verificationId: string): Promise<void> {
  const useCase = new TrusteeMatchVerificationUseCase();
  await useCase.approveVerification(
    context,
    verificationId,
    RESOLVED_TRUSTEE_ID,
    RESOLVED_TRUSTEE_NAME,
  );
  pass(`Called approveVerification(${verificationId}) — enqueued real remap message`);
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------

async function countSurrogates(
  db: Db,
  fingerprint: string,
): Promise<{ casePartition: number; trusteePartition: number }> {
  const query = { documentType: 'CASE_APPOINTMENT', trusteeId: fingerprint, isSurrogate: true };
  const casePartition = await db.collection(CASE_PARTITION_COLLECTION).countDocuments(query);
  const trusteePartition = await db.collection(TRUSTEE_PARTITION_COLLECTION).countDocuments(query);
  return { casePartition, trusteePartition };
}

async function assertCaseResolved(
  db: Db,
  caseId: string,
  expectedTrusteeId: string,
): Promise<void> {
  const query = {
    documentType: 'CASE_APPOINTMENT',
    caseId,
    trusteeId: expectedTrusteeId,
    isSurrogate: { $ne: true },
    unassignedOn: { $exists: false },
  };
  const inCasePartition = await db.collection(CASE_PARTITION_COLLECTION).findOne(query);
  const inTrusteePartition = await db.collection(TRUSTEE_PARTITION_COLLECTION).findOne(query);

  if (inCasePartition) {
    pass(
      `case ${caseId}: resolved trustee active in case-trustee-appointments (the UI's read path)`,
    );
  } else {
    fail(
      `case ${caseId}: no active appointment for ${expectedTrusteeId} in case-trustee-appointments`,
    );
  }
  if (inTrusteePartition) {
    pass(`case ${caseId}: resolved trustee active in trustee-case-appointments`);
  } else {
    fail(
      `case ${caseId}: no active appointment for ${expectedTrusteeId} in trustee-case-appointments`,
    );
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean(): Promise<void> {
  console.log('\nCleaning up test data...\n');

  const { client, db } = await getMongo();
  try {
    const casePartitionResult = await db.collection(CASE_PARTITION_COLLECTION).deleteMany({
      documentType: 'CASE_APPOINTMENT',
      trusteeId: { $regex: '^INTEGRATION-TRUSTEE-CAMS894' },
    });
    const trusteePartitionResult = await db.collection(TRUSTEE_PARTITION_COLLECTION).deleteMany({
      documentType: 'CASE_APPOINTMENT',
      trusteeId: { $regex: '^INTEGRATION-TRUSTEE-CAMS894' },
    });
    pass(
      `Deleted ${casePartitionResult.deletedCount + trusteePartitionResult.deletedCount} resolved appointment(s)`,
    );

    // Surrogates are keyed by fingerprint (trusteeId = sha256 hex), not a recognizable prefix —
    // scope the sweep to our fixture caseId prefix instead.
    const surrogateQuery = {
      documentType: 'CASE_APPOINTMENT',
      isSurrogate: true,
      caseId: { $regex: '^081-26-8' },
    };
    const r3 = await db.collection(CASE_PARTITION_COLLECTION).deleteMany(surrogateQuery);
    const r4 = await db.collection(TRUSTEE_PARTITION_COLLECTION).deleteMany(surrogateQuery);
    pass(`Deleted ${r3.deletedCount + r4.deletedCount} surrogate row(s)`);

    const r5 = await db
      .collection(VERIFICATION_COLLECTION)
      .deleteMany({
        documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
        caseId: { $regex: '^081-26-8' },
      });
    pass(`Deleted ${r5.deletedCount} verification doc(s)`);

    const r6 = await db
      .collection(VARIATION_COLLECTION)
      .deleteMany({ trusteeId: { $regex: '^INTEGRATION-TRUSTEE-CAMS894' } });
    if (r6.deletedCount > 0) pass(`Deleted ${r6.deletedCount} variation doc(s)`);
  } finally {
    await client.close();
  }

  await clearQueues();
}

// ---------------------------------------------------------------------------
// run — happy path, multi-case
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('\nRunning trustee-verification-remap happy path (multi-case) test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed pending verification + 4 surrogate appointments');
  const caseIds = [1, 2, 3, 4].map((n) => caseId('h', n));
  const { context, fingerprint, verificationId } = await seedPendingVerification(caseIds, 'happy');
  console.log('');

  console.log('Step 2: Approve — real use case enqueues the real remap message');
  await approve(context, verificationId);
  console.log('');

  console.log('Step 3: Wait for the real function app to drain all surrogates (up to 45s)');
  const { client, db } = await getMongo();
  try {
    const drained = await pollUntil(async () => {
      const { casePartition, trusteePartition } = await countSurrogates(db, fingerprint);
      return casePartition === 0 && trusteePartition === 0;
    });
    if (!drained) {
      fail('Timed out waiting for surrogates to drain — is the function app running?');
      return;
    }
    pass('All surrogates drained from both partitions');
    console.log('');

    console.log('Assertions:\n');
    for (const id of caseIds) {
      await assertCaseResolved(db, id, RESOLVED_TRUSTEE_ID);
    }

    const verificationRepo = factory.getTrusteeMatchVerificationRepository(context);
    const verification = await verificationRepo.findById(verificationId);
    if (verification.status === 'approved') {
      pass(`verification status === 'approved'`);
    } else {
      fail(`verification status: expected 'approved', got '${verification.status}'`);
    }
    const affectedSorted = [...(verification.affectedCaseIds ?? [])].sort();
    const expectedSorted = [...caseIds].sort();
    if (JSON.stringify(affectedSorted) === JSON.stringify(expectedSorted)) {
      pass(`affectedCaseIds snapshot matches all ${caseIds.length} seeded cases`);
    } else {
      fail(`affectedCaseIds mismatch: expected ${expectedSorted}, got ${affectedSorted}`);
    }

    const dlqCount = await getDlqMessageCount();
    if (dlqCount === 0) {
      pass('DLQ is empty');
    } else {
      fail(`DLQ has ${dlqCount} message(s) — check function app logs`);
    }
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-pagination — seed > REMAP_PAGE_SIZE surrogates
// ---------------------------------------------------------------------------

async function runPagination(): Promise<void> {
  console.log('\nRunning trustee-verification-remap pagination test...\n');
  console.log(
    `Seeding ${REMAP_PAGE_SIZE + 5} cases (> REMAP_PAGE_SIZE=${REMAP_PAGE_SIZE}) to force a requeue.\n`,
  );

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  const total = REMAP_PAGE_SIZE + 5;
  console.log(`Step 1: Seed pending verification + ${total} surrogate appointments`);
  const caseIds = Array.from({ length: total }, (_, i) => caseId('p', i + 1));
  const { context, fingerprint, verificationId } = await seedPendingVerification(caseIds, 'paging');
  console.log('');

  console.log('Step 2: Approve');
  await approve(context, verificationId);
  console.log('');

  console.log(
    'Step 3: Wait for the requeue-and-re-query continuation to drain all surrogates (up to 120s)',
  );
  const { client, db } = await getMongo();
  try {
    const drained = await pollUntil(
      async () => {
        const { casePartition, trusteePartition } = await countSurrogates(db, fingerprint);
        info(
          `Remaining surrogates — casePartition=${casePartition}, trusteePartition=${trusteePartition}`,
        );
        return casePartition === 0 && trusteePartition === 0;
      },
      120000,
      3000,
    );
    if (!drained) {
      fail('Timed out waiting for surrogates to drain — requeue continuation may not be working');
      return;
    }
    pass(
      `All ${total} surrogates drained — requeue-and-re-query continuation completed against a real queue`,
    );
    console.log('');

    console.log('Assertions (spot-checking first, middle, and last case):\n');
    for (const id of [caseIds[0], caseIds[Math.floor(total / 2)], caseIds[total - 1]]) {
      await assertCaseResolved(db, id, RESOLVED_TRUSTEE_ID);
    }

    const dlqCount = await getDlqMessageCount();
    if (dlqCount === 0) {
      pass('DLQ is empty');
    } else {
      fail(`DLQ has ${dlqCount} message(s)`);
    }
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-divergence — regression test for CAMS-894
// ---------------------------------------------------------------------------

/**
 * Reproduces the staging failure directly: TrusteeCaseAppointmentsMongoRepository.delete()
 * (backend/lib/adapters/gateways/mongo/trustee-case-appointments.mongo.repository.ts:492) deletes
 * the case-partition copy of a surrogate first, then the trustee-partition copy. If the
 * case-partition copy is already missing — the exact dual-write divergence
 * existsInTrusteePartition's doc comment warns about — deleteOne matches zero documents and the
 * adapter throws a 404 ("Matched and deleted 0 items", see mongo-adapter.ts:361-366) BEFORE the
 * trustee-partition delete ever runs. The surrogate then survives in the trustee partition
 * forever: remapPage's per-case catch counts it as failed and leaves it in place, so every future
 * getSurrogatesByFingerprint call rediscovers the same case and fails identically.
 *
 * This harness simulates that divergence directly (raw Mongo), since no normal code path
 * produces it on demand — normal seeding still goes through the real upsert() first, so the
 * fixture starts from the same "id shared across both partitions" state production would create,
 * and only the case-partition copy is then removed to simulate an earlier partial failure.
 */
async function runDivergence(): Promise<void> {
  console.log('\nRunning trustee-verification-remap divergence regression test (CAMS-894)...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed pending verification + 1 surrogate appointment (via real upsert())');
  const targetCaseId = caseId('d', 1);
  const { context, fingerprint, verificationId } = await seedPendingVerification(
    [targetCaseId],
    'divergence',
  );
  console.log('');

  console.log('Step 2: Simulate dual-write divergence — remove ONLY the case-partition copy');
  const { client: seedClient, db: seedDb } = await getMongo();
  let surrogateId: string;
  try {
    const surrogate = await seedDb.collection(TRUSTEE_PARTITION_COLLECTION).findOne({
      documentType: 'CASE_APPOINTMENT',
      caseId: targetCaseId,
      trusteeId: fingerprint,
      isSurrogate: true,
    });
    if (!surrogate) {
      fail(`Could not find seeded surrogate for case ${targetCaseId} to diverge`);
      return;
    }
    surrogateId = surrogate.id as string;
    const deleteResult = await seedDb.collection(CASE_PARTITION_COLLECTION).deleteOne({
      documentType: 'CASE_APPOINTMENT',
      id: surrogateId,
    });
    if (deleteResult.deletedCount === 1) {
      pass(
        `Removed surrogate ${surrogateId} from case-trustee-appointments only — trustee-case-appointments copy is now orphaned`,
      );
    } else {
      fail(
        `Expected to remove exactly 1 document from case-trustee-appointments, removed ${deleteResult.deletedCount}`,
      );
      return;
    }
  } finally {
    await seedClient.close();
  }
  console.log('');

  console.log('Step 3: Approve — real use case enqueues the real remap message');
  await approve(context, verificationId);
  console.log('');

  console.log(
    'Step 4: Wait for the surrogate to be removed from trustee-case-appointments (up to 45s)\n' +
      '  Before the fix: this times out — delete() 404s on the missing case-partition copy and\n' +
      '  never reaches the trustee-partition delete, so the surrogate is stuck there forever.',
  );
  const { client, db } = await getMongo();
  try {
    const cleaned = await pollUntil(async () => {
      const remaining = await db.collection(TRUSTEE_PARTITION_COLLECTION).countDocuments({
        documentType: 'CASE_APPOINTMENT',
        trusteeId: fingerprint,
        isSurrogate: true,
      });
      return remaining === 0;
    });

    if (!cleaned) {
      fail(
        `Surrogate ${surrogateId} is still present in trustee-case-appointments — reproduces the ` +
          `staging "Matched and deleted 0 items" 404. delete() needs to tolerate a missing partition copy.`,
      );
      return;
    }
    pass('Surrogate removed from trustee-case-appointments despite the case-partition divergence');
    console.log('');

    console.log('Assertions:\n');
    await assertCaseResolved(db, targetCaseId, RESOLVED_TRUSTEE_ID);

    const stillInCasePartition = await db.collection(CASE_PARTITION_COLLECTION).findOne({
      documentType: 'CASE_APPOINTMENT',
      id: surrogateId,
    });
    if (!stillInCasePartition) {
      pass('No stray surrogate remnant in case-trustee-appointments');
    } else {
      fail('Unexpected surrogate remnant found in case-trustee-appointments');
    }
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run-replay — deliver the same remap message twice
// ---------------------------------------------------------------------------

async function runReplay(): Promise<void> {
  console.log('\nRunning trustee-verification-remap replay (idempotency) test...\n');

  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  console.log('Step 1: Seed pending verification + 2 surrogate appointments');
  const caseIds = [1, 2].map((n) => caseId('r', n));
  const { context, fingerprint, verificationId } = await seedPendingVerification(caseIds, 'replay');
  console.log('');

  console.log('Step 2: Approve — enqueues the first delivery of the remap message');
  await approve(context, verificationId);
  console.log('');

  console.log('Step 3: Wait for the first delivery to fully drain (up to 45s)');
  const { client, db } = await getMongo();
  try {
    const drained = await pollUntil(async () => {
      const { casePartition, trusteePartition } = await countSurrogates(db, fingerprint);
      return casePartition === 0 && trusteePartition === 0;
    });
    if (!drained) {
      fail('Timed out waiting for the first delivery to drain — is the function app running?');
      return;
    }
    pass('First delivery drained cleanly');
    console.log('');

    console.log(
      'Step 4: Re-deliver the identical remap message a second time (simulates at-least-once redelivery)',
    );
    const apiToDataflows = factory.getApiToDataflowsGateway(context);
    await apiToDataflows.queueTrusteeVerificationRemap({
      fingerprint,
      resolvedTrusteeId: RESOLVED_TRUSTEE_ID,
      resolvedTrusteeName: RESOLVED_TRUSTEE_NAME,
      verificationId,
    });
    pass('Re-enqueued the identical message');
    console.log('');

    // getSurrogatesByFingerprint now returns nothing for this fingerprint — the second delivery
    // should no-op quickly. Give it a shorter window since there's nothing left to page through.
    await new Promise((r) => setTimeout(r, 8000));

    console.log('Assertions:\n');
    for (const id of caseIds) {
      const casePartitionMatches = await db.collection(CASE_PARTITION_COLLECTION).countDocuments({
        documentType: 'CASE_APPOINTMENT',
        caseId: id,
        trusteeId: RESOLVED_TRUSTEE_ID,
      });
      const trusteePartitionMatches = await db
        .collection(TRUSTEE_PARTITION_COLLECTION)
        .countDocuments({
          documentType: 'CASE_APPOINTMENT',
          caseId: id,
          trusteeId: RESOLVED_TRUSTEE_ID,
        });
      if (casePartitionMatches === 1 && trusteePartitionMatches === 1) {
        pass(`case ${id}: exactly 1 appointment in each partition (no duplicate from replay)`);
      } else {
        fail(
          `case ${id}: expected exactly 1 appointment per partition, got case-partition=${casePartitionMatches}, trustee-partition=${trusteePartitionMatches}`,
        );
      }
    }

    const dlqCount = await getDlqMessageCount();
    if (dlqCount === 0) {
      pass('DLQ is empty after replay');
    } else {
      fail(`DLQ has ${dlqCount} message(s) after replay`);
    }
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(70));
  console.log('Trustee Verification Remap — Integration Test (CAMS-894 / #2943)');
  console.log(`Environment: ${INTEGRATION_ENV}`);
  console.log('='.repeat(70));

  switch (command) {
    case 'check-env':
      await checkEnv();
      break;
    case 'run':
      await run();
      break;
    case 'run-pagination':
      await runPagination();
      break;
    case 'run-divergence':
      await runDivergence();
      break;
    case 'run-replay':
      await runReplay();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run trustee-verification-remap --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  INTEGRATION_ENV=local  ${HARNESS} <command>   (default)`);
      console.log(`  INTEGRATION_ENV=azure  ${HARNESS} <command>   (VPN required)`);
      console.log('\nCommands:');
      console.log('  check-env        Verify required environment variables');
      console.log('  run              Happy path: one fingerprint across 4 cases');
      console.log('  run-pagination   Seed 30 surrogates (> REMAP_PAGE_SIZE) to exercise requeue');
      console.log('  run-divergence   Regression test for CAMS-894 — expected to FAIL until fixed');
      console.log('  run-replay       Deliver the same message twice; asserts no duplicates');
      console.log('  clean            Remove all fixtures and clear queues');
      console.log('  help             Show this help');
    }
  }

  console.log('\n' + '='.repeat(70));
  if (hasFailures) {
    console.log('RESULT: FAIL');
  } else {
    console.log('RESULT: PASS');
  }

  // Force-exit: the repositories built via factory.ts (getTrusteeMatchVerificationRepository,
  // getTrusteeCaseAppointmentsRepository, getTrusteeVariationRepository) are process-lifetime
  // singletons holding open MongoClient connections that are never released by this one-shot
  // script, so the event loop never drains on its own.
  process.exit(hasFailures ? 1 : 0);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
