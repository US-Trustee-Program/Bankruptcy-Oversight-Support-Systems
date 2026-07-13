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
// This was verified empirically (see backend/_experiments/bicep-index-probe)
// to be a true no-op -- zero rebuild, zero RU cost, confirmed via Cosmos's
// own createIndexes response ("note": "all indexes already exist") -- on
// every run after the first, for every index including the sort index
// itself. Safe to run unconditionally on every deploy.
//
// USAGE:
//   node index-trustee-case-appointments.js "<mongo-connection-string>" <databaseName>
//
// Run via ops/scripts/pipeline/az-cosmos-deploy.sh as part of every Cosmos
// deploy, immediately after the Bicep deployment that creates/updates the
// collection, for BOTH the main database and the e2e database.

const { MongoClient } = require('mongodb');

const COLLECTION_NAME = 'trustee-case-appointments';

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

async function main() {
  const [connectionString, databaseName] = process.argv.slice(2);
  if (!connectionString || !databaseName) {
    console.error(
      'Usage: index-trustee-case-appointments.js "<mongo-connection-string>" <databaseName>',
    );
    process.exit(2);
  }

  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const db = client.db(databaseName);

    for (const spec of TARGET_INDEXES) {
      const response = await db.command({
        createIndexes: COLLECTION_NAME,
        indexes: [{ key: spec.key, name: spec.name }],
      });
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
