#!/usr/bin/env tsx
/**
 * Script to verify phonetic search indexes and measure performance
 *
 * Usage:
 *   npm run verify:phonetic-indexes
 *
 * Environment variables required:
 *   - MONGO_CONNECTION_STRING: MongoDB connection string
 *   - COSMOS_DATABASE_NAME: Database name
 *
 * This script will:
 * 1. Connect to the MongoDB database
 * 2. List all indexes on the cases collection
 * 3. Verify phonetic token indexes exist
 * 4. Run EXPLAIN queries to show query plans
 * 5. Measure query performance with and without indexes
 */

import { MongoClient, Db, Collection } from 'mongodb';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface IndexInfo {
  name: string;
  key: Record<string, number>;
  v?: number;
}

interface ExplainResult {
  queryPlanner: {
    winningPlan: {
      stage: string;
      inputStage?: {
        stage: string;
        indexName?: string;
      };
    };
  };
  executionStats?: {
    executionTimeMillis: number;
    totalDocsExamined: number;
    totalKeysExamined: number;
    nReturned: number;
  };
}

/**
 * Verify indexes exist and show details
 */
async function verifyIndexes(collection: Collection) {
  console.log('\n📋 Checking indexes on cases collection...\n');

  const indexes = await collection.indexes();

  const requiredIndexes = [
    { name: 'debtor.phoneticTokens', found: false },
    { name: 'jointDebtor.phoneticTokens', found: false },
  ];

  console.log('Found indexes:');
  indexes.forEach((index: IndexInfo) => {
    const indexKeys = Object.keys(index.key).join(', ');
    console.log(`  - ${index.name}: { ${indexKeys} }`);

    // Check if this is one of our required indexes
    if (indexKeys.includes('debtor.phoneticTokens')) {
      requiredIndexes[0].found = true;
    }
    if (indexKeys.includes('jointDebtor.phoneticTokens')) {
      requiredIndexes[1].found = true;
    }
  });

  console.log('\n✅ Required Index Status:');
  requiredIndexes.forEach((idx) => {
    const status = idx.found ? '✅ EXISTS' : '❌ MISSING';
    console.log(`  ${status}: ${idx.name}`);
  });

  const allIndexesPresent = requiredIndexes.every((idx) => idx.found);
  if (!allIndexesPresent) {
    console.log('\n⚠️  Some required indexes are missing!');
    console.log('   Run the migration script to create them:');
    console.log('   npm run migrate:phonetic-tokens\n');
    return false;
  }

  return true;
}

/**
 * Run EXPLAIN query and show results
 */
async function explainQuery(
  collection: Collection,
  query: Record<string, unknown>,
  queryName: string,
) {
  console.log(`\n🔍 EXPLAIN: ${queryName}`);
  console.log(`   Query: ${JSON.stringify(query)}`);

  const explainResult = (await collection
    .find(query)
    .limit(100)
    .explain('executionStats')) as unknown as ExplainResult;

  const { queryPlanner, executionStats } = explainResult;
  const winningPlan = queryPlanner.winningPlan;

  console.log(`\n   Query Plan:`);
  console.log(`     Stage: ${winningPlan.stage}`);

  if (winningPlan.inputStage) {
    console.log(`     Input Stage: ${winningPlan.inputStage.stage}`);
    if (winningPlan.inputStage.indexName) {
      console.log(`     ✅ Using Index: ${winningPlan.inputStage.indexName}`);
    }
  }

  if (executionStats) {
    console.log(`\n   Execution Stats:`);
    console.log(`     Execution Time: ${executionStats.executionTimeMillis}ms`);
    console.log(`     Documents Examined: ${executionStats.totalDocsExamined}`);
    console.log(`     Keys Examined: ${executionStats.totalKeysExamined}`);
    console.log(`     Documents Returned: ${executionStats.nReturned}`);

    // Calculate efficiency
    if (executionStats.nReturned > 0) {
      const efficiency = (executionStats.nReturned / executionStats.totalDocsExamined) * 100;
      console.log(`     Query Efficiency: ${efficiency.toFixed(2)}%`);

      if (efficiency < 50) {
        console.log(`     ⚠️  Low efficiency - consider query optimization`);
      } else if (efficiency >= 90) {
        console.log(`     ✅ Excellent efficiency!`);
      }
    }
  }
}

/**
 * Test phonetic search performance
 */
async function testPhoneticSearchPerformance(collection: Collection) {
  console.log('\n\n📊 Testing Phonetic Search Performance\n');
  console.log('='.repeat(60));

  // Test 1: Search by debtor phonetic tokens
  await explainQuery(
    collection,
    {
      documentType: 'SYNCED_CASE',
      'debtor.phoneticTokens': { $in: ['J500', 'JN'] }, // John
    },
    'Search debtor by phonetic tokens (John)',
  );

  // Test 2: Search by joint debtor phonetic tokens
  await explainQuery(
    collection,
    {
      documentType: 'SYNCED_CASE',
      'jointDebtor.phoneticTokens': { $in: ['M240', 'MKSHL'] }, // Michael
    },
    'Search joint debtor by phonetic tokens (Michael)',
  );

  // Test 3: Search either debtor or joint debtor
  await explainQuery(
    collection,
    {
      documentType: 'SYNCED_CASE',
      $or: [
        { 'debtor.phoneticTokens': { $in: ['S530', 'SM0'] } }, // Smith
        { 'jointDebtor.phoneticTokens': { $in: ['S530', 'SM0'] } },
      ],
    },
    'Search debtor OR joint debtor by phonetic tokens (Smith)',
  );

  // Test 4: Combined search with case number
  await explainQuery(
    collection,
    {
      documentType: 'SYNCED_CASE',
      caseNumber: { $regex: /^24-/, $options: 'i' },
      'debtor.phoneticTokens': { $in: ['J525', 'JNSN'] }, // Johnson
    },
    'Combined search: case number pattern + phonetic tokens',
  );
}

/**
 * Show index statistics
 */
async function showIndexStats(collection: Collection) {
  console.log('\n\n📈 Index Statistics\n');
  console.log('='.repeat(60));

  try {
    const stats = await collection.stats();

    console.log(`Collection: cases`);
    console.log(`  Total Documents: ${stats.count}`);
    console.log(`  Total Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Index Count: ${stats.nindexes}`);
    console.log(`  Total Index Size: ${(stats.totalIndexSize / 1024 / 1024).toFixed(2)} MB`);

    if (stats.indexSizes) {
      console.log(`\n  Individual Index Sizes:`);
      Object.entries(stats.indexSizes).forEach(([indexName, size]) => {
        console.log(`    ${indexName}: ${((size as number) / 1024).toFixed(2)} KB`);
      });
    }
  } catch (_error) {
    console.log('  ⚠️  Could not retrieve collection stats');
  }
}

/**
 * Main verification function
 */
async function verifyPhoneticIndexes() {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  const databaseName = process.env.COSMOS_DATABASE_NAME;

  if (!connectionString || !databaseName) {
    console.error('ERROR: Required environment variables are not set');
    console.error('Please set MONGO_CONNECTION_STRING and COSMOS_DATABASE_NAME');
    process.exit(1);
  }

  console.log('🔍 Phonetic Search Index Verification');
  console.log('='.repeat(60));
  console.log(`📊 Database: ${databaseName}\n`);

  let client: MongoClient | null = null;

  try {
    // Connect to MongoDB
    client = new MongoClient(connectionString);
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db: Db = client.db(databaseName);
    const collection: Collection = db.collection('cases');

    // Verify indexes exist
    const indexesExist = await verifyIndexes(collection);

    if (!indexesExist) {
      console.log('\n❌ Cannot proceed with performance tests - indexes missing');
      process.exit(1);
    }

    // Show index statistics
    await showIndexStats(collection);

    // Test query performance
    await testPhoneticSearchPerformance(collection);

    console.log('\n\n' + '='.repeat(60));
    console.log('✅ Verification completed successfully!');
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    process.exit(1);
  } finally {
    // Close the connection
    if (client) {
      await client.close();
      console.log('🔌 Disconnected from MongoDB');
    }
  }
}

// Run the verification
verifyPhoneticIndexes()
  .then(() => {
    console.log('🎉 Index verification finished successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Unexpected error:', error);
    process.exit(1);
  });
