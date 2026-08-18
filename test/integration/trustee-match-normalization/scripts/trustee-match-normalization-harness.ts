/**
 * Exploratory integration harness: why does matchTrusteeByName miss obvious matches?
 *
 * Investigation only — this harness makes NO changes to the as-built matching logic
 * (backend/lib/use-cases/dataflows/trustee-match.helpers.ts,
 * backend/lib/adapters/gateways/mongo/trustees.mongo.repository.ts). It seeds a real,
 * unmocked local MongoDB with a real trustees export pulled from staging
 * (../fixtures/2026-08-18-trustees.json) and replays a hand-verified ground truth of DXTR
 * fullName -> expected CAMS trustee(s) (../fixtures/ground-truth.json, built by inspecting
 * ../fixtures/2026-08-18-trustee-verification.json's no-match-candidate records against the
 * trustees export) through the REAL matchTrusteeByName() exactly as
 * sync-trustee-case-appointments.ts calls it.
 *
 * matchTrusteeByName -> findTrusteesByName does an exact, whitespace-only-normalized,
 * case-insensitive full-name regex match. Every ground-truth pair with confidence
 * high/medium/low documents a punctuation, spacing, suffix, or name-variant difference between
 * the DXTR fullName and the CAMS trustee's `name` field that this exact-match approach cannot
 * bridge. This harness's job is to PROVE that against the real regex query (not a mock), and to
 * report the shape of the gap (how many hidden matches now show as `no-match` vs
   `wrong-count` vs `right`) — not to fix it.
 *
 * This is a one-shot script - NOT a Vitest test.
 *
 * Usage (from test/integration/):
 *   npm run trustee-match-normalization -- [command]
 *
 * Local workflow:
 *   1. cd trustee-match-normalization/scripts && ./start-services.sh
 *   2. cp .env.template .env.local
 *   3. cd ../..
 *   4. npm run trustee-match-normalization -- seed
 *   5. npm run trustee-match-normalization -- run
 *   6. npm run trustee-match-normalization -- clean
 *   7. cd trustee-match-normalization/scripts && ./stop-services.sh
 *
 * Commands:
 *   seed    Load the real trustees.json export into MongoDB (drops/recreates the collection)
 *   run     Replay every ground-truth pair through the real matchTrusteeByName()
 *   clean   Drop the seeded trustees collection
 *   help    Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { InvocationContext } from '@azure/functions';
import { MongoClient } from 'mongodb';
import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { matchTrusteeByName } from '../../../../backend/lib/use-cases/dataflows/trustee-match.helpers';

const HARNESS_DIR = path.resolve(__dirname, '../');
const FIXTURES_DIR = path.join(HARNESS_DIR, 'fixtures');

const COLLECTION_NAME = 'trustees';

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, 'scripts', '.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} - run start-services.sh first, then copy .env.template to .env.local.`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

loadEnv();

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

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

async function getAppContext() {
  const invocationContext = new InvocationContext();
  const context = await ApplicationContextCreator.getApplicationContext({
    invocationContext,
    logger: ApplicationContextCreator.getLogger(invocationContext),
  });
  return context;
}

// ---------------------------------------------------------------------------
// seed — load the real trustees.json export as-is
// ---------------------------------------------------------------------------

async function seed() {
  console.log('\nSeeding real trustees.json export into MongoDB...\n');

  const trusteesPath = path.join(FIXTURES_DIR, '2026-08-18-trustees.json');
  const raw = fs.readFileSync(trusteesPath, 'utf-8');
  // Mongo extended-JSON export: strip the {"$oid": "..."} wrapper on _id, keep everything else
  // byte-for-byte as staging produced it — this harness's whole point is to seed the REAL data,
  // not a synthetic fixture.
  const docs = JSON.parse(raw).map((doc: { _id?: { $oid?: string } }) => {
    const { _id, ...rest } = doc;
    return { _id: _id?.$oid ?? _id, ...rest };
  });

  const { client, db } = await getMongoDb();
  try {
    await db.collection(COLLECTION_NAME).deleteMany({ documentType: 'TRUSTEE' });
    const result = await db.collection(COLLECTION_NAME).insertMany(docs);
    info(`Inserted ${result.insertedCount} trustee documents (source: 2026-08-18-trustees.json)`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nDropping seeded trustees collection...\n');
  const { client, db } = await getMongoDb();
  try {
    const result = await db.collection(COLLECTION_NAME).deleteMany({ documentType: 'TRUSTEE' });
    info(`Deleted ${result.deletedCount} trustee documents`);
  } finally {
    await client.close();
  }
}

// ---------------------------------------------------------------------------
// run — replay ground truth through the real matchTrusteeByName()
// ---------------------------------------------------------------------------

type GroundTruthPair = {
  verificationId: string;
  dxtrFullName: string;
  expectedTrusteeIds: string[];
  expectedTrusteeNames: string[];
  confidence: string;
  notes: string;
};

type GroundTruthFile = {
  pairs: GroundTruthPair[];
};

type ReplayOutcome =
  | 'exact-match' // matchTrusteeByName resolved to exactly the expected trusteeId(s)
  | 'wrong-match' // resolved, but to a trustee NOT in expectedTrusteeIds
  | 'false-ambiguous' // came back ambiguous, but expected exactly one trustee
  | 'correctly-ambiguous' // came back ambiguous, and expected 2+ trustees (matches ground truth)
  | 'false-no-match' // came back no-match, but a real trustee was expected
  | 'correctly-no-match'; // came back no-match, and ground truth also expects zero (placeholder/absent)

async function run() {
  console.log('\nReplaying ground-truth pairs through the REAL matchTrusteeByName()...\n');

  const groundTruthPath = path.join(FIXTURES_DIR, 'ground-truth.json');
  const groundTruth: GroundTruthFile = JSON.parse(fs.readFileSync(groundTruthPath, 'utf-8'));

  const context = await getAppContext();

  const outcomeCounts: Record<ReplayOutcome, number> = {
    'exact-match': 0,
    'wrong-match': 0,
    'false-ambiguous': 0,
    'correctly-ambiguous': 0,
    'false-no-match': 0,
    'correctly-no-match': 0,
  };

  const detail: Array<{
    dxtrFullName: string;
    confidence: string;
    outcome: ReplayOutcome;
    expected: string[];
    actual: string;
  }> = [];

  for (const pair of groundTruth.pairs) {
    const result = await matchTrusteeByName(context, pair.dxtrFullName);
    const expectedIds = new Set(pair.expectedTrusteeIds);

    let outcome: ReplayOutcome;
    let actualDescription: string;

    if (result.kind === 'resolved') {
      actualDescription = `resolved -> ${result.trusteeId}`;
      if (expectedIds.size === 1 && expectedIds.has(result.trusteeId)) {
        outcome = 'exact-match';
      } else {
        outcome = 'wrong-match';
      }
    } else if (result.kind === 'ambiguous') {
      const candidateIds = result.matchCandidates.map((c) => c.trusteeId);
      actualDescription = `ambiguous -> [${candidateIds.join(', ')}]`;
      const sameSet =
        expectedIds.size === candidateIds.length && candidateIds.every((id) => expectedIds.has(id));
      outcome = expectedIds.size >= 2 && sameSet ? 'correctly-ambiguous' : 'false-ambiguous';
    } else {
      actualDescription = 'no-match';
      outcome = expectedIds.size === 0 ? 'correctly-no-match' : 'false-no-match';
    }

    outcomeCounts[outcome]++;
    detail.push({
      dxtrFullName: pair.dxtrFullName,
      confidence: pair.confidence,
      outcome,
      expected: pair.expectedTrusteeNames,
      actual: actualDescription,
    });
  }

  console.log(`Replayed ${groundTruth.pairs.length} ground-truth pairs.\n`);
  console.log('Outcome summary:');
  for (const [outcome, count] of Object.entries(outcomeCounts)) {
    console.log(`  ${outcome.padEnd(22)} ${count}`);
  }

  console.log(
    '\nDetail — false-no-match (real trustee exists but matchTrusteeByName found nothing):',
  );
  for (const d of detail.filter((d) => d.outcome === 'false-no-match')) {
    console.log(`  [${d.confidence}] "${d.dxtrFullName}" — expected ${d.expected.join(' / ')}`);
  }

  console.log('\nDetail — wrong-match (resolved, but not to the expected trustee):');
  for (const d of detail.filter((d) => d.outcome === 'wrong-match')) {
    console.log(
      `  [${d.confidence}] "${d.dxtrFullName}" — expected ${d.expected.join(' / ')}, got ${d.actual}`,
    );
  }

  console.log(
    '\nDetail — false-ambiguous (matchTrusteeByName found multiple, ground truth expects one):',
  );
  for (const d of detail.filter((d) => d.outcome === 'false-ambiguous')) {
    console.log(
      `  [${d.confidence}] "${d.dxtrFullName}" — expected ${d.expected.join(' / ')}, got ${d.actual}`,
    );
  }

  console.log('\nDetail — exact-match (already works today, no normalization gap):');
  for (const d of detail.filter((d) => d.outcome === 'exact-match')) {
    console.log(`  [${d.confidence}] "${d.dxtrFullName}"`);
  }
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

function printHelp() {
  console.log(`
Usage: npm run trustee-match-normalization -- [command]

Commands:
  seed    Load the real trustees.json export into MongoDB (drops/recreates the collection)
  run     Replay every ground-truth pair through the real matchTrusteeByName()
  clean   Drop the seeded trustees collection
  help    Show this help
`);
}

async function main() {
  const command = process.argv[2] || 'help';

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
      printHelp();
      break;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
