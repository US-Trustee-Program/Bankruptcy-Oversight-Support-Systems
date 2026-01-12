#!/usr/bin/env tsx
/**
 * Copy Supporting Data to Experimental Database
 *
 * This script copies non-case data (offices, consolidations, etc.) from the dev
 * database to the experimental database to support case management functionality.
 */

import { MongoClient, Db, Document } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const DEV_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DEV_DATABASE_NAME = 'cams';
const EXPERIMENTAL_DATABASE_NAME =
  process.env.EXPERIMENTAL_DATABASE_NAME || 'cams-vector-experiment';
const COLLECTION_NAME = 'cases';

// Document types to copy (everything except SYNCED_CASE which we already have)
const DOCUMENT_TYPES_TO_COPY = [
  'CONSOLIDATION_FROM',
  'CONSOLIDATION_TO',
  'TRANSFER',
  'CASE_ASSIGNMENT',
  'OFFICE',
  'AUDIT',
];

async function copyCollection(
  sourceDb: Db,
  targetDb: Db,
  collectionName: string,
  filter: Document = {},
) {
  const sourceCollection = sourceDb.collection(collectionName);
  const targetCollection = targetDb.collection(collectionName);

  console.log(`\nCopying from ${collectionName} with filter:`, JSON.stringify(filter));

  const documents = await sourceCollection.find(filter).toArray();
  console.log(`  Found ${documents.length} documents to copy`);

  if (documents.length > 0) {
    // Clear existing documents of this type in target
    const deleteResult = await targetCollection.deleteMany(filter);
    console.log(`  Deleted ${deleteResult.deletedCount} existing documents`);

    // Insert the documents
    await targetCollection.insertMany(documents);
    console.log(`  ✓ Inserted ${documents.length} documents`);
  }

  return documents.length;
}

async function main(): Promise<number> {
  console.log('='.repeat(70));
  console.log('COPY SUPPORTING DATA TO EXPERIMENTAL DATABASE');
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

    let totalCopied = 0;

    // Copy each document type
    for (const docType of DOCUMENT_TYPES_TO_COPY) {
      const count = await copyCollection(devDb, experimentDb, COLLECTION_NAME, {
        documentType: docType,
      });
      totalCopied += count;
    }

    // Verify what we have now
    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION');
    console.log('='.repeat(70));

    const collection = experimentDb.collection(COLLECTION_NAME);

    for (const docType of ['SYNCED_CASE', ...DOCUMENT_TYPES_TO_COPY]) {
      const count = await collection.countDocuments({ documentType: docType });
      console.log(`  ${docType}: ${count} documents`);
    }

    console.log('\n' + '='.repeat(70));
    console.log(`✓ Successfully copied ${totalCopied} supporting documents`);
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

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
