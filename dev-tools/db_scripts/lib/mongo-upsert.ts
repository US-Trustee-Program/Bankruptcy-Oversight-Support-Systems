import { MongoClient } from 'mongodb';

/**
 * Upserts documents into a MongoDB collection via the MongoDB driver.
 *
 * Matches on the `id` field, then deletes and re-inserts rather than using
 * replaceOne. Cosmos DB (Mongo API) collections are sharded, and a shard key's
 * value is immutable on an existing document — replaceOne fails with "Performing
 * an update would modify the immutable field '<shardKey>'" whenever a seed script
 * re-runs with a changed shard-key value under the same `id` (e.g. `cases`, sharded
 * on `caseId`). Delete-then-insert never attempts to modify a shard key in place,
 * so it's safe regardless of which field a given collection shards on.
 *
 * Logs each upserted document.
 *
 * If sharedClient is provided, reuses that connection (caller manages lifecycle).
 * Otherwise creates a new client and closes it after upsert.
 *
 * @param connectionString - MongoDB connection string (MONGO_CONNECTION_STRING)
 * @param databaseName - Database name (e.g., 'cams')
 * @param collectionName - Collection name (e.g., 'cases', 'offices')
 * @param docs - Array of documents to upsert, each must have an `id` field
 * @param sharedClient - Optional pre-connected MongoClient to reuse
 */
export async function mongoUpsert(
  connectionString: string,
  databaseName: string,
  collectionName: string,
  docs: Record<string, unknown>[],
  sharedClient?: MongoClient,
): Promise<void> {
  const client = sharedClient ?? new MongoClient(connectionString);
  const shouldClose = !sharedClient;

  try {
    if (!sharedClient) {
      await client.connect();
    }

    const db = client.db(databaseName);
    const collection = db.collection(collectionName);

    for (const doc of docs) {
      if (!doc.id) {
        throw new Error(
          `[SEED] Document missing 'id' field in collection '${collectionName}': ${JSON.stringify(doc)}`,
        );
      }

      await collection.deleteOne({ id: doc.id });
      await collection.insertOne(doc);
      console.log(`[SEED] upserted ${collectionName}/${doc.id}`);
    }
  } finally {
    if (shouldClose) {
      await client.close();
    }
  }
}
