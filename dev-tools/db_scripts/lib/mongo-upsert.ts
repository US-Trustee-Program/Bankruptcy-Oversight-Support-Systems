import { MongoClient } from 'mongodb';

/**
 * Upserts documents into a MongoDB collection via the MongoDB driver.
 *
 * Uses replaceOne with upsert:true, matching on the `id` field.
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

      await collection.replaceOne({ id: doc.id }, doc, { upsert: true });
      console.log(`[SEED] upserted ${collectionName}/${doc.id}`);
    }
  } finally {
    if (shouldClose) {
      await client.close();
    }
  }
}
