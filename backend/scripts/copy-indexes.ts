#!/usr/bin/env tsx
/**
 * Copy Indexes from Dev to Experimental Database
 *
 * This script copies all index definitions (except the _id index) from the dev
 * database to the experimental database to support all query patterns.
 */

import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEV_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DEV_DATABASE_NAME = 'cams';
const EXPERIMENTAL_DATABASE_NAME =
  process.env.EXPERIMENTAL_DATABASE_NAME || 'cams-vector-experiment';
const COLLECTION_NAME = 'cases';

async function copyIndexes(): Promise<number> {
  console.log('='.repeat(70));
  console.log('COPY INDEXES TO EXPERIMENTAL DATABASE');
  console.log('='.repeat(70));

  if (!DEV_CONNECTION_STRING) {
    console.error('\n✗ Error: MONGO_CONNECTION_STRING environment variable is required');
    return 1;
  }

  const client = new MongoClient(DEV_CONNECTION_STRING);

  try {
    await client.connect();
    console.log('✓ Connected to Cosmos DB\n');

    const devDb = client.db(DEV_DATABASE_NAME);
    const experimentDb = client.db(EXPERIMENTAL_DATABASE_NAME);

    const devCollection = devDb.collection(COLLECTION_NAME);
    const experimentCollection = experimentDb.collection(COLLECTION_NAME);

    // Get indexes from dev database
    console.log(`Fetching indexes from ${DEV_DATABASE_NAME}...`);
    const devIndexes = await devCollection.listIndexes().toArray();
    console.log(`  Found ${devIndexes.length} indexes\n`);

    // Get existing indexes from experimental database
    const experimentIndexes = await experimentCollection.listIndexes().toArray();
    const experimentIndexNames = new Set(experimentIndexes.map((idx) => idx.name));

    console.log('Existing indexes in experimental database:');
    experimentIndexes.forEach((idx) => {
      console.log(`  - ${idx.name}`);
    });
    console.log();

    // Copy indexes (skip _id_ and existing indexes)
    let copiedCount = 0;
    for (const index of devIndexes) {
      // Skip the default _id index
      if (index.name === '_id_') {
        continue;
      }

      // Skip if index already exists
      if (experimentIndexNames.has(index.name)) {
        console.log(`⊘ Skipping ${index.name} (already exists)`);
        continue;
      }

      try {
        console.log(`Creating index: ${index.name}`);

        // Extract the key and options from the index spec
        const { key, name, ...options } = index;

        // Remove fields that shouldn't be passed to createIndex
        delete options.v;
        delete options.ns;

        await experimentCollection.createIndex(key, { name, ...options });
        console.log(`  ✓ Created ${name}`);
        copiedCount++;
      } catch (error: unknown) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 48) {
          console.log(`  ⚠ Index ${index.name} already exists`);
        } else {
          console.error(`  ✗ Failed to create ${index.name}:`, error);
        }
      }
    }

    console.log('\n' + '='.repeat(70));
    console.log(`✓ Successfully copied ${copiedCount} indexes`);
    console.log('='.repeat(70));

    return 0;
  } catch (error) {
    console.error('\n✗ Error during copy:', error);
    return 1;
  } finally {
    await client.close();
    console.log('\n✓ Connection closed\n');
  }
}

copyIndexes()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
