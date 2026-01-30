#!/usr/bin/env tsx
/**
 * Migration script to add phonetic tokens to existing cases in MongoDB
 *
 * Usage:
 *   npm run migrate:phonetic-tokens
 *
 * Environment variables required:
 *   - MONGO_CONNECTION_STRING: MongoDB connection string
 *   - COSMOS_DATABASE_NAME: Database name
 *
 * This script will:
 * 1. Connect to the MongoDB database
 * 2. Process all SYNCED_CASE documents in batches
 * 3. Generate phonetic tokens for debtor and jointDebtor names
 * 4. Update documents with the new phoneticTokens field
 * 5. Create indexes for efficient phonetic search
 */

import { MongoClient, Db, Collection, FindCursor } from 'mongodb';
import * as dotenv from 'dotenv';
import { generatePhoneticTokens } from '../../lib/adapters/utils/phonetic-helper';

// Type definition for case documents
interface CaseDocument {
  _id: string;
  debtor?: {
    name?: string;
    phoneticTokens?: string[];
  };
  jointDebtor?: {
    name?: string;
    phoneticTokens?: string[];
  };
}

// Load environment variables
dotenv.config();

/**
 * Main migration function
 */
async function addPhoneticTokensToExistingCases() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;

  if (!connectionString || !databaseName) {
    console.error('ERROR: Required environment variables are not set');
    console.error('Please set MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME');
    process.exit(1);
  }

  console.log('🔄 Starting phonetic tokens migration...');
  // Do not log database name to prevent information disclosure
  console.log('📊 Processing database...');

  let client: MongoClient | null = null;
  let cursor: FindCursor | null = null;

  try {
    // Connect to MongoDB
    client = new MongoClient(connectionString);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db: Db = client.db(databaseName);
    const collection: Collection = db.collection('cases');

    // Count total documents to process
    const totalCount = await collection.countDocuments({ documentType: 'SYNCED_CASE' });
    console.log(`📁 Found ${totalCount} cases to process`);

    if (totalCount === 0) {
      console.log('✅ No cases to migrate');
      return;
    }

    // Process in batches to avoid memory issues
    const batchSize = 1000;
    let processedCount = 0;
    let updatedCount = 0;
    let skipCount = 0;

    // Use cursor-based iteration for better performance on large collections
    // Also add projection to only fetch the fields we need
    cursor = collection
      .find({ documentType: 'SYNCED_CASE' })
      .project({
        _id: 1,
        'debtor.name': 1,
        'debtor.phoneticTokens': 1,
        'jointDebtor.name': 1,
        'jointDebtor.phoneticTokens': 1,
      })
      .batchSize(batchSize);

    while (await cursor.hasNext()) {
      // Build a batch of documents
      const cases: CaseDocument[] = [];
      let batchCount = 0;

      while (batchCount < batchSize && (await cursor.hasNext())) {
        const doc = await cursor.next();
        if (!doc) break;
        cases.push(doc);
        batchCount++;
      }

      if (cases.length === 0) break;

      // Prepare bulk updates
      const bulkOperations = [];

      for (const caseDoc of cases) {
        const updates: Record<string, string[]> = {};
        let hasUpdates = false;

        // Check if phonetic tokens already exist (skip if already migrated)
        if (caseDoc.debtor?.phoneticTokens || caseDoc.jointDebtor?.phoneticTokens) {
          skipCount++;
          continue;
        }

        // Generate phonetic tokens for debtor
        if (caseDoc.debtor?.name) {
          const tokens = generatePhoneticTokens(caseDoc.debtor.name);
          if (tokens.length > 0) {
            updates['debtor.phoneticTokens'] = tokens;
            hasUpdates = true;
          }
        }

        // Generate phonetic tokens for joint debtor
        if (caseDoc.jointDebtor?.name) {
          const tokens = generatePhoneticTokens(caseDoc.jointDebtor.name);
          if (tokens.length > 0) {
            updates['jointDebtor.phoneticTokens'] = tokens;
            hasUpdates = true;
          }
        }

        // Add to bulk operations if there are updates
        if (hasUpdates) {
          bulkOperations.push({
            updateOne: {
              filter: { _id: caseDoc._id },
              update: { $set: updates },
            },
          });
        }
      }

      // Execute bulk update if there are operations
      if (bulkOperations.length > 0) {
        const result = await collection.bulkWrite(bulkOperations);
        updatedCount += result.modifiedCount;
        console.log(
          `📝 Batch ${Math.floor(processedCount / batchSize) + 1}: Updated ${result.modifiedCount} documents`,
        );
      }

      processedCount += cases.length;

      // Progress indicator
      const percentComplete = Math.round((processedCount / totalCount) * 100);
      console.log(`⏳ Progress: ${processedCount}/${totalCount} (${percentComplete}%)`);
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   Total cases processed: ${processedCount}`);
    console.log(`   Cases updated: ${updatedCount}`);
    console.log(`   Cases skipped (already migrated): ${skipCount}`);

    // Create indexes for phonetic search
    console.log('\n🔨 Creating indexes for phonetic search...');

    try {
      await collection.createIndex({ 'debtor.phoneticTokens': 1 });
      console.log('✅ Created index on debtor.phoneticTokens');
    } catch (_error) {
      console.log('⚠️  Index on debtor.phoneticTokens may already exist');
    }

    try {
      await collection.createIndex({ 'jointDebtor.phoneticTokens': 1 });
      console.log('✅ Created index on jointDebtor.phoneticTokens');
    } catch (_error) {
      console.log('⚠️  Index on jointDebtor.phoneticTokens may already exist');
    }

    // Create compound index for better performance
    try {
      await collection.createIndex({
        'debtor.phoneticTokens': 1,
        'jointDebtor.phoneticTokens': 1,
      });
      console.log('✅ Created compound index on phonetic tokens');
    } catch (_error) {
      console.log('⚠️  Compound index may already exist');
    }

    console.log('\n✅ Migration completed successfully!');
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the cursor if it exists
    if (cursor) {
      await cursor.close();
    }
    // Close the connection
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the migration
addPhoneticTokensToExistingCases()
  .then(() => {
    console.log('\n🎉 Phonetic tokens migration finished successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Unexpected error:', error);
    process.exit(1);
  });
