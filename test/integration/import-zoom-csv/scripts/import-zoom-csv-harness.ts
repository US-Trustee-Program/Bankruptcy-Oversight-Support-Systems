/**
 * Integration test harness: importZoomCsv use case.
 *
 * Exercises all four match-outcome paths and accountEmail normalization by
 * seeding real trustee documents into MongoDB, uploading a fixture TSV to
 * Azurite (local Azure Blob Storage emulator), calling importZoomCsv(), then
 * asserting the resulting Cosmos documents and the written report blob.
 *
 * Scenarios covered:
 *   1. MATCHED — TRU_ID found → trustee.zoomInfo written; accountEmail present
 *   2. MATCHED (blank accountEmail) — blank TSV email → accountEmail absent (undefined)
 *   3. UNMATCHED — TRU_ID not in Cosmos, no name fallback match → skipped
 *   4. AMBIGUOUS — two TRU_IDs resolve to different CAMS trustees → skipped
 *   5. ERROR — row missing meetingId + link → processed as error, import continues
 *   6. Report blob — zoom-import-report.tsv written to object storage after run
 *
 * Infrastructure (local only):
 *   MongoDB   → localhost:27017   (container: cams-import-zoom-csv-mongodb)
 *   Azurite   → localhost:10000   (container: cams-import-zoom-csv-azurite)
 *
 * Usage (from test/integration/):
 *   npm run import-zoom-csv -- [command]
 *
 * Local workflow:
 *   1. ./import-zoom-csv/scripts/start-services.sh
 *   2. cp import-zoom-csv/scripts/.env.template import-zoom-csv/scripts/.env.local
 *   3. npm run import-zoom-csv -- run
 *   4. npm run import-zoom-csv -- clean
 *   5. ./import-zoom-csv/scripts/stop-services.sh
 *
 * Commands:
 *   check-env   Verify required environment variables
 *   run         Full test: seed → import → assert → report
 *   clean       Remove harness trustee documents and blobs from storage
 *   help        Show this help
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import { BlobServiceClient } from '@azure/storage-blob';
import { InvocationContext } from '@azure/functions';

import ApplicationContextCreator from '../../../../backend/function-apps/azure/application-context-creator';
import { importZoomCsv } from '../../../../backend/lib/use-cases/dataflows/import-zoom-csv';

const HARNESS_DIR = path.resolve(__dirname, '../');

// Sentinel used to find our test documents in Cosmos so we never touch real data.
const TEST_SENTINEL = 'INTEGRATION-IMPORT-ZOOM-CSV-TEST';

// ATS TRU_IDs used as legacy.truIds on the seeded trustees.
const TRU_ID_MATCHED = '9001'; // exact match; has accountEmail
const TRU_ID_NO_EMAIL = '9002'; // exact match; blank accountEmail → absent
const TRU_ID_UNMATCHED = '9003'; // not in Cosmos at all
const TRU_ID_AMBIG_A = '9004'; // one of two different trustees → ambiguous
const TRU_ID_AMBIG_B = '9005'; // second of two different trustees → ambiguous

// Blob / container names (must match the use case source).
const INPUT_BLOB = 'zoom-import.tsv';
const REPORT_BLOB = 'zoom-import-report.tsv';

// ---------------------------------------------------------------------------
// Environment loading
// ---------------------------------------------------------------------------

function loadEnv() {
  const localEnvPath = path.join(HARNESS_DIR, 'scripts/.env.local');
  if (!fs.existsSync(localEnvPath)) {
    console.error(
      `Missing ${localEnvPath} — copy scripts/.env.template to scripts/.env.local and fill in values`,
    );
    process.exit(1);
  }
  dotenv.config({ path: localEnvPath, override: true });
}

loadEnv();

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
  if (!uri || !dbName)
    throw new Error('MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME must be set');
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db(dbName) };
}

function getBlobContainer() {
  const connectionString = process.env.AzureWebJobsStorage;
  const containerName = process.env.CAMS_OBJECT_CONTAINER ?? 'migration-files';
  if (!connectionString) throw new Error('AzureWebJobsStorage must be set');
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  return blobServiceClient.getContainerClient(containerName);
}

async function buildContext() {
  const invocationContext = new InvocationContext();
  return ApplicationContextCreator.getApplicationContext({ invocationContext });
}

// ---------------------------------------------------------------------------
// check-env
// ---------------------------------------------------------------------------

async function checkEnv() {
  console.log('\nChecking required environment variables...\n');

  const required: [string, string][] = [
    ['MONGO_CONNECTION_STRING', 'MongoDB connection string'],
    ['COSMOS_DATABASE_NAME', 'Cosmos/Mongo database name'],
    ['AzureWebJobsStorage', 'Azurite / Azure Blob Storage connection string'],
  ];

  const optional: [string, string][] = [
    ['CAMS_OBJECT_CONTAINER', 'Blob container name (default: migration-files)'],
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

  console.log('\nOptional:');
  for (const [name, description] of optional) {
    info(`${name}=${process.env[name] ?? '(not set)'} — ${description}`);
  }

  if (!allPresent) {
    console.log('\n  Set missing variables in scripts/.env.local before running.');
    if (!process.env.AzureWebJobsStorage) {
      console.log(
        '\n  AzureWebJobsStorage hint: use the standard Azurite local dev connection string.',
        '\n  See https://learn.microsoft.com/en-us/azure/storage/common/storage-use-azurite#well-known-storage-account-and-key',
      );
    }
  } else {
    console.log('\n  All required variables present.');
  }
}

// ---------------------------------------------------------------------------
// Seed: insert fixture trustees into MongoDB
// ---------------------------------------------------------------------------

async function seedTrustees(db: ReturnType<MongoClient['db']>) {
  console.log('\nSeeding fixture trustees into Cosmos...\n');
  const now = new Date().toISOString();

  const fixtures = [
    {
      trusteeId: `zoom-test-matched-${TEST_SENTINEL}`,
      firstName: 'Zoom',
      lastName: 'Matched',
      name: 'Zoom Matched',
      legacy: { truIds: [TRU_ID_MATCHED], testSentinel: TEST_SENTINEL },
      public: {
        email: 'zoom.matched@example.com',
        address: {
          address1: '1 Main St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          countryCode: 'US',
        },
      },
    },
    {
      trusteeId: `zoom-test-noemail-${TEST_SENTINEL}`,
      firstName: 'Zoom',
      lastName: 'NoEmail',
      name: 'Zoom NoEmail',
      legacy: { truIds: [TRU_ID_NO_EMAIL], testSentinel: TEST_SENTINEL },
      public: {
        email: 'zoom.noemail@example.com',
        address: {
          address1: '2 Oak Ave',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          countryCode: 'US',
        },
      },
    },
    {
      trusteeId: `zoom-test-ambig-a-${TEST_SENTINEL}`,
      firstName: 'Zoom',
      lastName: 'AmbigA',
      name: 'Zoom Ambiguous A',
      legacy: { truIds: [TRU_ID_AMBIG_A], testSentinel: TEST_SENTINEL },
      public: {
        email: 'ambig.a@example.com',
        address: {
          address1: '4 Elm St',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          countryCode: 'US',
        },
      },
    },
    {
      trusteeId: `zoom-test-ambig-b-${TEST_SENTINEL}`,
      firstName: 'Zoom',
      lastName: 'AmbigB',
      name: 'Zoom Ambiguous B',
      legacy: { truIds: [TRU_ID_AMBIG_B], testSentinel: TEST_SENTINEL },
      public: {
        email: 'ambig.b@example.com',
        address: {
          address1: '5 Pine Rd',
          city: 'Springfield',
          state: 'IL',
          zipCode: '62701',
          countryCode: 'US',
        },
      },
    },
  ];

  for (const fixture of fixtures) {
    await db
      .collection('trustees')
      .updateOne(
        { trusteeId: fixture.trusteeId },
        {
          $set: {
            ...fixture,
            documentType: 'TRUSTEE',
            status: 'active',
            createdOn: now,
            updatedOn: now,
          },
        },
        { upsert: true },
      );
    info(`Seeded trustee ${fixture.trusteeId}`);
  }

  // TRU_ID_UNMATCHED (9003) intentionally has no Cosmos document — testing the unmatched path.
  info(`No trustee seeded for TRU_ID ${TRU_ID_UNMATCHED} (unmatched scenario)`);
}

// ---------------------------------------------------------------------------
// Seed: upload the input TSV blob to Azurite
// ---------------------------------------------------------------------------

async function seedBlob() {
  console.log('\nUploading fixture zoom-import.tsv to Azurite...\n');

  const containerClient = getBlobContainer();
  await containerClient.createIfNotExists();

  // The use case reads 'zoom-import.tsv' (ZOOM_MATCHED_TSV_BLOB_NAME).
  // Columns: Zoom Name, Zoom Email, Meeting ID, Passcode, Phone, Link,
  //          Outcome, Strategy, ATS TRU_IDs, Matched Names, Match Count,
  //          Similarity %, Active Status, Status Codes, Ambiguous Candidates
  const header =
    'Zoom Name\tZoom Email\tMeeting ID\tPasscode\tPhone\tLink\tOutcome\tStrategy\tATS TRU_IDs\tMatched Names\tMatch Count\tSimilarity %\tActive Status\tStatus Codes\tAmbiguous Candidates';

  const rows = [
    // Row 1: TRU_ID found, accountEmail present → matched
    `Zoom Matched\tzoom.matched@example.com\t111222333\tabc1\t555-0001\thttps://zoom.us/j/111222333\tmatched\temail\t${TRU_ID_MATCHED}\tZoom Matched\t1\t100.0\tYES\tPA\t`,
    // Row 2: TRU_ID found, blank accountEmail → matched, accountEmail absent
    `Zoom NoEmail\t\t222333444\tabc2\t555-0002\thttps://zoom.us/j/222333444\tmatched\tname\t${TRU_ID_NO_EMAIL}\tZoom NoEmail\t1\t100.0\tYES\tPA\t`,
    // Row 3: TRU_ID not in Cosmos, no name fallback (no trustee named "Zoom Unmatched") → unmatched
    `Zoom Unmatched\tunknown@example.com\t333444555\tabc3\t555-0003\thttps://zoom.us/j/333444555\tunmatched\tnone\t${TRU_ID_UNMATCHED}\t\t0\t\t\t\t`,
    // Row 4: two TRU_IDs mapping to two distinct CAMS trustees → ambiguous
    `Zoom Ambiguous\tambig@example.com\t444555666\tabc4\t555-0004\thttps://zoom.us/j/444555666\tambiguous\tname\t${TRU_ID_AMBIG_A},${TRU_ID_AMBIG_B}\tZoom Ambiguous A; Zoom Ambiguous B\t2\t100.0\tYES; YES\tPA; PA\t`,
    // Row 5: missing meetingId and link → error outcome, import continues
    `Zoom ErrorRow\terror@example.com\t\t\t555-0005\t\terror\tnone\t${TRU_ID_MATCHED}\t\t0\t\t\t\t`,
  ];

  const content = [header, ...rows].join('\n');
  const buffer = Buffer.from(content, 'utf-8');
  const blobClient = containerClient.getBlockBlobClient(INPUT_BLOB);
  await blobClient.upload(buffer, buffer.length, { overwrite: true });

  pass(`Uploaded ${INPUT_BLOB} (${rows.length} data rows) to Azurite`);
}

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

async function clean() {
  console.log('\nCleaning up harness data...\n');

  const { client, db } = await getMongoDb();
  try {
    const r = await db.collection('trustees').deleteMany({ 'legacy.testSentinel': TEST_SENTINEL });
    pass(`Deleted ${r.deletedCount} harness trustee document(s)`);
  } finally {
    await client.close();
  }

  const containerClient = getBlobContainer();
  for (const blobName of [INPUT_BLOB, REPORT_BLOB]) {
    try {
      await containerClient.getBlockBlobClient(blobName).deleteIfExists();
      pass(`Deleted blob '${blobName}'`);
    } catch {
      info(`Blob '${blobName}' not found or already deleted`);
    }
  }
}

// ---------------------------------------------------------------------------
// run — full integration test
// ---------------------------------------------------------------------------

async function run() {
  console.log('\nRunning import-zoom-csv integration test...\n');

  // ── Step 0: Clean to known state ─────────────────────────────────────────
  console.log('Step 0: Reset to known state');
  await clean();
  console.log('');

  // ── Step 1: Seed MongoDB and blob ────────────────────────────────────────
  console.log('Step 1: Seed fixture trustees and input TSV');
  const { client: seedClient, db: seedDb } = await getMongoDb();
  try {
    await seedTrustees(seedDb);
  } finally {
    await seedClient.close();
  }
  await seedBlob();
  console.log('');

  // ── Step 2: Run the use case ─────────────────────────────────────────────
  console.log('Step 2: Call importZoomCsv()');
  const context = await buildContext();
  const result = await importZoomCsv(context);

  info(
    `total=${result.total}  matched=${result.matched}  unmatched=${result.unmatched}  ambiguous=${result.ambiguous}  errors=${result.errors}`,
  );
  console.log('');

  // ── Step 3: Assert outcome counts ────────────────────────────────────────
  console.log('Step 3: Assert outcome counts\n');

  if (result.total === 5) {
    pass('total === 5 (all rows processed)');
  } else {
    fail(`total: expected 5, got ${result.total}`);
  }

  if (result.matched === 2) {
    pass('matched === 2 (rows 1 and 2)');
  } else {
    fail(`matched: expected 2, got ${result.matched}`);
  }

  if (result.unmatched === 1) {
    pass('unmatched === 1 (row 3 — TRU_ID not in Cosmos)');
  } else {
    fail(`unmatched: expected 1, got ${result.unmatched}`);
  }

  if (result.ambiguous === 1) {
    pass('ambiguous === 1 (row 4 — two distinct CAMS trustees)');
  } else {
    fail(`ambiguous: expected 1, got ${result.ambiguous}`);
  }

  if (result.errors === 1) {
    pass('errors === 1 (row 5 — missing meetingId/link)');
  } else {
    fail(`errors: expected 1, got ${result.errors}`);
  }
  console.log('');

  // ── Step 4: Assert zoomInfo on matched trustees ───────────────────────────
  console.log('Step 4: Assert zoomInfo written to matched trustees\n');

  const { client: assertClient, db: assertDb } = await getMongoDb();
  try {
    // Trustee 1: accountEmail present
    const matched = await assertDb
      .collection('trustees')
      .findOne({ trusteeId: `zoom-test-matched-${TEST_SENTINEL}` });

    if (!matched) {
      fail(`Matched trustee document not found`);
    } else {
      const zi = matched.zoomInfo;
      if (zi?.link === 'https://zoom.us/j/111222333') {
        pass(`Matched trustee zoomInfo.link correct`);
      } else {
        fail(
          `Matched trustee zoomInfo.link: expected 'https://zoom.us/j/111222333', got ${JSON.stringify(zi?.link)}`,
        );
      }
      if (zi?.meetingId === '111222333') {
        pass(`Matched trustee zoomInfo.meetingId correct`);
      } else {
        fail(
          `Matched trustee zoomInfo.meetingId: expected '111222333', got ${JSON.stringify(zi?.meetingId)}`,
        );
      }
      if (zi?.accountEmail === 'zoom.matched@example.com') {
        pass(`Matched trustee zoomInfo.accountEmail present and correct`);
      } else {
        fail(
          `Matched trustee zoomInfo.accountEmail: expected 'zoom.matched@example.com', got ${JSON.stringify(zi?.accountEmail)}`,
        );
      }
    }

    // Trustee 2: blank email → accountEmail must be absent (not stored as empty string)
    const noEmail = await assertDb
      .collection('trustees')
      .findOne({ trusteeId: `zoom-test-noemail-${TEST_SENTINEL}` });

    if (!noEmail) {
      fail(`NoEmail trustee document not found`);
    } else {
      const zi = noEmail.zoomInfo;
      if (zi?.link === 'https://zoom.us/j/222333444') {
        pass(`NoEmail trustee zoomInfo.link correct`);
      } else {
        fail(
          `NoEmail trustee zoomInfo.link: expected 'https://zoom.us/j/222333444', got ${JSON.stringify(zi?.link)}`,
        );
      }
      if (zi?.accountEmail === undefined || zi?.accountEmail === '') {
        if (zi?.accountEmail === '') {
          fail(
            `NoEmail trustee zoomInfo.accountEmail is empty string — expected absent or undefined`,
          );
        } else {
          pass(
            `NoEmail trustee zoomInfo.accountEmail is absent (blank input normalized to undefined)`,
          );
        }
      } else {
        fail(
          `NoEmail trustee zoomInfo.accountEmail: expected absent, got ${JSON.stringify(zi?.accountEmail)}`,
        );
      }
    }

    // Trustee 3 (unmatched): zoomInfo must NOT be written
    const unmatched = await assertDb
      .collection('trustees')
      .findOne({ 'legacy.testSentinel': TEST_SENTINEL, 'legacy.truIds': TRU_ID_UNMATCHED });

    if (unmatched) {
      fail(`Unmatched TRU_ID ${TRU_ID_UNMATCHED} unexpectedly found a trustee document`);
    } else {
      pass(`No trustee document exists for TRU_ID ${TRU_ID_UNMATCHED} (unmatched — correct)`);
    }

    // Trustees 4a / 4b (ambiguous): zoomInfo must NOT be written to either
    const ambigA = await assertDb
      .collection('trustees')
      .findOne({ trusteeId: `zoom-test-ambig-a-${TEST_SENTINEL}` });
    const ambigB = await assertDb
      .collection('trustees')
      .findOne({ trusteeId: `zoom-test-ambig-b-${TEST_SENTINEL}` });

    if (ambigA?.zoomInfo || ambigB?.zoomInfo) {
      fail(
        `Ambiguous trustees must NOT have zoomInfo written — ambigA.zoomInfo=${JSON.stringify(ambigA?.zoomInfo)}, ambigB.zoomInfo=${JSON.stringify(ambigB?.zoomInfo)}`,
      );
    } else {
      pass(`Neither ambiguous trustee had zoomInfo written (ambiguous row skipped correctly)`);
    }
  } finally {
    await assertClient.close();
  }
  console.log('');

  // ── Step 5: Assert report blob written ───────────────────────────────────
  console.log('Step 5: Assert zoom-import-report.tsv written to blob storage\n');

  const containerClient = getBlobContainer();
  const reportBlobClient = containerClient.getBlobClient(REPORT_BLOB);
  const reportExists = await reportBlobClient.exists();

  if (!reportExists) {
    fail(`${REPORT_BLOB} was not written to blob storage after importZoomCsv()`);
  } else {
    pass(`${REPORT_BLOB} written to blob storage`);

    const downloadResponse = await reportBlobClient.download();
    if (downloadResponse.readableStreamBody) {
      const chunks: Buffer[] = [];
      for await (const chunk of downloadResponse.readableStreamBody) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const reportContent = Buffer.concat(chunks).toString('utf-8');
      const reportLines = reportContent.split('\n').filter((l) => l.trim());

      // Header + 5 data rows
      if (reportLines.length >= 6) {
        pass(`Report has ${reportLines.length} lines (header + at least 5 data rows)`);
      } else {
        fail(`Report has ${reportLines.length} lines — expected at least 6 (header + 5 data rows)`);
      }

      // Header must contain the expected columns
      const headerLine = reportLines[0];
      if (headerLine.includes('zoomName') && headerLine.includes('outcome')) {
        pass(`Report header contains required columns (zoomName, outcome)`);
      } else {
        fail(`Report header missing expected columns: ${headerLine}`);
      }
    }
  }
  console.log('');
}

// ---------------------------------------------------------------------------
// CLI dispatch
// ---------------------------------------------------------------------------

async function main() {
  const command = process.argv[2] ?? 'help';

  console.log('='.repeat(60));
  console.log('import-zoom-csv — Integration Test Harness');
  console.log('='.repeat(60));

  switch (command) {
    case 'check-env':
      await checkEnv();
      break;
    case 'run':
      await run();
      break;
    case 'clean':
      await clean();
      break;
    case 'help':
    default: {
      const HARNESS = 'npm run import-zoom-csv --';
      console.log('\nUsage (from test/integration/):');
      console.log(`  ${HARNESS} <command>`);
      console.log('\nLocal workflow:');
      console.log('  1. ./import-zoom-csv/scripts/start-services.sh');
      console.log(
        '  2. cp import-zoom-csv/scripts/.env.template import-zoom-csv/scripts/.env.local',
      );
      console.log(`  3. ${HARNESS} run`);
      console.log(`  4. ${HARNESS} clean`);
      console.log('  5. ./import-zoom-csv/scripts/stop-services.sh');
      console.log('\nAll commands:');
      console.log('  check-env   Verify required environment variables');
      console.log('  run         Full test: seed → import → assert → report');
      console.log('  clean       Remove harness trustee documents and blobs');
      console.log('  help        Show this help');
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
