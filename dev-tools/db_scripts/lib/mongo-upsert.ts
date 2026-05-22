import { MongoClient } from 'mongodb';

/**
 * Upserts documents into a MongoDB collection via the MongoDB driver.
 *
 * Uses replaceOne with upsert:true, matching on the `id` field.
 * Logs each upserted document and closes the connection in a finally block.
 *
 * @param connectionString - MongoDB connection string (MONGO_CONNECTION_STRING)
 * @param databaseName - Database name (e.g., 'cams')
 * @param collectionName - Collection name (e.g., 'cases', 'offices')
 * @param docs - Array of documents to upsert, each must have an `id` field
 */
export async function mongoUpsert(
  connectionString: string,
  databaseName: string,
  collectionName: string,
  docs: Record<string, unknown>[],
): Promise<void> {
  const client = new MongoClient(connectionString);

  try {
    await client.connect();
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
    await client.close();
  }
}
