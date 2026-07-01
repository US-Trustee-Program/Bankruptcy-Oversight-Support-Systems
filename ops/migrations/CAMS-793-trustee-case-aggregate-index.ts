/**
 * One-time migration: create compound index on `trustee-case-appointments` to
 * support the getCasesForTrustee aggregate pipeline.
 *
 * The pipeline's opening $match filters on { trusteeId, unassignedOn }. Without
 * a compound index on these fields, MongoDB performs a full collection scan on
 * every trustee case list request.
 *
 * Usage (from repo root):
 *   npx tsx --tsconfig backend/tsconfig.json \
 *     ops/migrations/CAMS-793-trustee-case-aggregate-index.ts
 *
 * After running:
 *   1. Verify the index exists in Atlas/CosmosDB under trustee-case-appointments.
 *   2. Run EXPLAIN on a getCasesForTrustee query and confirm index is used.
 */

import * as dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

dotenv.config({ path: 'backend/.env' });

async function ensureIndexes() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;
  if (!connectionString || !databaseName) return;

  console.log('Creating compound index on trustee-case-appointments collection...');
  const client = new MongoClient(connectionString);
  try {
    await client.connect();
    const collection = client.db(databaseName).collection('trustee-case-appointments');
    await collection.createIndex({ trusteeId: 1, unassignedOn: 1 });
    console.log('  ✓ Index created ({ trusteeId: 1, unassignedOn: 1 })\n');
  } finally {
    await client.close();
  }
}

ensureIndexes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
