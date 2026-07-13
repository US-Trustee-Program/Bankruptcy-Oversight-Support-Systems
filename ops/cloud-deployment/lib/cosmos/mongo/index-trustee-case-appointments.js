#!/usr/bin/env node
// Ensures the out-of-band indexes on the trustee-case-appointments Cosmos DB
// Mongo API collection: a filtering index and the mixed-direction ORDER BY
// sort index required by getCasesForTrustee.
//
// WHY THIS SCRIPT EXISTS (do not delete):
// Cosmos DB Mongo API's Bicep/ARM `keys` array only supports ascending index
// directions and has no per-index opt-out -- a *present* `indexes` array is
// full declarative replace, dropping anything not listed. Since the ORDER BY
// dateFiled DESC, caseId ASC sort used by getCasesForTrustee needs a mixed
// ascending/descending composite index, which cannot be expressed in Bicep
// at all, the `indexes` property is omitted ENTIRELY from
// trusteeCaseAppointmentsCollection in cosmos-collections.bicep so ARM never
// reconciles indexes on this collection. This script owns all of that
// collection's non-default indexes instead. `_id` and the `trusteeId` shard
// key are auto-indexed by Cosmos and are not managed here.
//
// This was verified empirically to be a true no-op -- zero rebuild, zero RU
// cost, confirmed via Cosmos's own createIndexes response ("note": "all
// indexes already exist") -- on every run after the first, for every index
// including the sort index itself. Safe to run unconditionally on every
// deploy.
//
// USAGE:
//   MONGO_CONNECTION_STRING="<mongo-connection-string>" node index-trustee-case-appointments.js <databaseName>
//
// The connection string must be supplied via the MONGO_CONNECTION_STRING
// environment variable, never as a CLI argument -- a CLI argument is visible
// in shell history and `ps` output for the life of the process. This is how
// az-cosmos-deploy.sh invokes it.
//
// Run via ops/scripts/pipeline/az-cosmos-deploy.sh as part of every Cosmos
// deploy, immediately after the Bicep deployment that creates/updates the
// collection, for BOTH the main database and the e2e database.

const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'trustee-case-appointments';

// Cosmos DB request-rate-too-large error code (RU throttling). Distinct from
// the driver's own retryWrites/retryReads, which don't cover db.command().
const COSMOS_THROTTLED_ERROR_CODE = 16500;

const COMMAND_TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 500;

const TARGET_INDEXES = [
  {
    name: 'unassignedOn_1_dateFiled_1_caseStatus_1',
    key: { unassignedOn: 1, dateFiled: 1, caseStatus: 1 },
  },
  {
    name: 'dateFiled_-1_caseId_1',
    key: { dateFiled: -1, caseId: 1 },
  },
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// db.command() (backed by the driver's RunCommandOperation) is not covered
// by retryWrites/retryReads, so a transient Cosmos RU-throttle response
// would otherwise fail the whole deploy immediately. Retry only on the
// specific throttling error code, with a bounded attempt count and backoff.
async function createIndexesWithRetry(db, spec) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await db.command(
        { createIndexes: COLLECTION_NAME, indexes: [{ key: spec.key, name: spec.name }] },
        { maxTimeMS: COMMAND_TIMEOUT_MS },
      );
    } catch (err) {
      const isThrottled = err?.code === COSMOS_THROTTLED_ERROR_CODE;
      if (!isThrottled || attempt === MAX_ATTEMPTS) throw err;
      await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
  // Unreachable: the loop above always returns or throws.
  throw new Error(`[${spec.name}] exhausted retries without a definitive result`);
}

async function main() {
  const [databaseName] = process.argv.slice(2);
  const connectionString = process.env.MONGO_CONNECTION_STRING;

  if (!connectionString || !databaseName) {
    console.error(
      'Usage: MONGO_CONNECTION_STRING="<mongo-connection-string>" node index-trustee-case-appointments.js <databaseName>',
    );
    process.exit(2);
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(databaseName);

    for (const spec of TARGET_INDEXES) {
      const response = await createIndexesWithRetry(db, spec);
      if (response.ok !== 1) {
        throw new Error(
          `[${databaseName}] ${spec.name}: createIndexes did not report ok=1 (response: ${JSON.stringify(response)})`,
        );
      }

      // response.ok=1 only confirms the server accepted the command -- confirm
      // the index actually exists under the expected name before trusting it,
      // rather than trusting numIndexesBefore/After or the "note" field alone.
      const exists = await db.collection(COLLECTION_NAME).indexExists(spec.name);
      if (!exists) {
        throw new Error(
          `[${databaseName}] ${spec.name}: createIndexes reported ok=1 but index is not present in listIndexes()`,
        );
      }

      if (response.note === 'all indexes already exist') {
        console.log(`[${databaseName}] ${spec.name}: already present, no-op`);
      } else {
        console.log(
          `[${databaseName}] ${spec.name}: created (numIndexesBefore=${response.numIndexesBefore}, numIndexesAfter=${response.numIndexesAfter})`,
        );
      }
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
