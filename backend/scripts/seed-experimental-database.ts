#!/usr/bin/env tsx
/**
 * Seed Experimental Database for Vector Search Testing (TypeScript version)
 *
 * This version uses MockData from @common to generate well-formed test documents.
 *
 * Usage:
 *   MONGO_CONNECTION_STRING=<connection-string> \
 *   EXPERIMENTAL_DATABASE_NAME=cams-vector-experiment \
 *   NUM_TEST_CASES=500 \
 *   tsx backend/scripts/seed-experimental-database.ts
 */

import { MongoClient, Db, Document } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import MockData from '@common/cams/test-utilities/mock-data';
import { SyncedCase } from '@common/cams/cases';
import { pipeline, Pipeline, env as transformersEnv } from '@xenova/transformers';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration
const DEV_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const EXPERIMENTAL_DB_NAME = process.env.EXPERIMENTAL_DATABASE_NAME || 'cams-vector-experiment';
const COLLECTION_NAME = 'cases';
const NUM_TEST_CASES = parseInt(process.env.NUM_TEST_CASES || '500', 10);

// Division codes for realistic test data
const DIVISION_CODES = ['081', '091', '101', '111', '121'];

/**
 * Configure transformers to use local models
 */
function configureEmbeddingModel() {
  const modelsPath = path.resolve(__dirname, '../models');
  transformersEnv.cacheDir = modelsPath;
  transformersEnv.allowLocalModels = true;
  transformersEnv.allowRemoteModels = false;
}

/**
 * Initialize embedding model
 */
async function initializeEmbeddingModel(): Promise<Pipeline> {
  console.log('Loading embedding model (Xenova/all-MiniLM-L6-v2)...');
  const model = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  console.log('✓ Embedding model loaded\n');
  return model;
}

/**
 * Generate embedding from text
 */
async function generateEmbedding(model: Pipeline, text: string): Promise<number[]> {
  const output = await model(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}

/**
 * Extract keywords from case data
 */
function extractKeywords(syncedCase: SyncedCase): string[] {
  const keywords: string[] = [];

  if (syncedCase.debtor?.name) {
    keywords.push(syncedCase.debtor.name);
  }

  if (syncedCase.jointDebtor?.name) {
    keywords.push(syncedCase.jointDebtor.name);
  }

  return keywords;
}

/**
 * Generate test cases using MockData with vector embeddings
 */
async function generateTestCasesWithVectors(model: Pipeline, count: number): Promise<SyncedCase[]> {
  console.log(`Generating ${count} test cases using MockData...`);

  const testCases: SyncedCase[] = [];
  let processed = 0;

  for (let i = 0; i < count; i++) {
    // Randomly select division code for geographic diversity
    const divisionCode = DIVISION_CODES[Math.floor(Math.random() * DIVISION_CODES.length)];

    // Use MockData to generate a well-formed synced case
    const syncedCase = MockData.getSyncedCase({
      override: {
        courtDivisionCode: divisionCode,
        // Ensure we have debtor and potentially joint debtor
        debtor: MockData.getDebtor({ entityType: 'person' }),
        // 30% chance of joint debtor
        ...(Math.random() < 0.3 && {
          jointDebtor: MockData.getDebtor({ entityType: 'person' }),
        }),
      },
    });

    // Extract keywords from the generated case
    const keywords = extractKeywords(syncedCase);

    // Generate vector embedding if we have keywords
    let keywordsVector: number[] | undefined;
    if (keywords.length > 0) {
      const combinedText = keywords.join(' ');
      keywordsVector = await generateEmbedding(model, combinedText);
    }

    // Add vector search fields to the case
    const caseWithVectors: SyncedCase = {
      ...syncedCase,
      keywords,
      keywordsVector,
    };

    testCases.push(caseWithVectors);

    processed++;
    if (processed % 50 === 0) {
      console.log(`  Generated ${processed}/${count} cases with embeddings...`);
    }
  }

  console.log(`✓ Generated ${testCases.length} test cases with MockData\n`);
  return testCases;
}

/**
 * Generate test cases with specific name patterns for testing
 */
async function generateNamedTestCases(model: Pipeline): Promise<SyncedCase[]> {
  console.log('Generating special test cases with known name patterns...\n');

  // Test cases with similar names for fuzzy search validation
  const testPatterns = [
    { debtor: 'John Smith', jointDebtor: null },
    { debtor: 'Jon Smith', jointDebtor: null }, // Typo variant
    { debtor: 'John Smyth', jointDebtor: null }, // Spelling variant
    { debtor: 'Jonathan Smith', jointDebtor: null }, // Full name
    { debtor: 'Michael Johnson', jointDebtor: 'Sarah Johnson' },
    { debtor: 'Mike Johnson', jointDebtor: 'Sarah Johnson' }, // Nickname
    { debtor: 'Michael Johnston', jointDebtor: null }, // Similar last name
    { debtor: 'William Brown', jointDebtor: 'Mary Brown' },
    { debtor: 'Bill Brown', jointDebtor: 'Mary Brown' }, // Nickname
    { debtor: 'Robert Garcia', jointDebtor: null },
    { debtor: 'Bob Garcia', jointDebtor: null }, // Nickname
    { debtor: 'Elizabeth Wilson', jointDebtor: null },
    { debtor: 'Liz Wilson', jointDebtor: null }, // Nickname
    { debtor: 'Elizabeth Willson', jointDebtor: null }, // Typo
  ];

  const specialCases: SyncedCase[] = [];

  for (const pattern of testPatterns) {
    const divisionCode = DIVISION_CODES[Math.floor(Math.random() * DIVISION_CODES.length)];

    const baseCase = MockData.getSyncedCase({
      override: {
        courtDivisionCode: divisionCode,
        debtor: MockData.getDebtor({
          entityType: 'person',
          override: { name: pattern.debtor },
        }),
        ...(pattern.jointDebtor && {
          jointDebtor: MockData.getDebtor({
            entityType: 'person',
            override: { name: pattern.jointDebtor },
          }),
        }),
      },
    });

    const keywords = extractKeywords(baseCase);
    let keywordsVector: number[] | undefined;

    if (keywords.length > 0) {
      const combinedText = keywords.join(' ');
      keywordsVector = await generateEmbedding(model, combinedText);
    }

    specialCases.push({
      ...baseCase,
      keywords,
      keywordsVector,
    });
  }

  console.log(`✓ Generated ${specialCases.length} special test cases for validation\n`);
  return specialCases;
}

/**
 * Create vector index on the experimental collection
 */
async function createVectorIndex(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION_NAME);

  console.log(`Creating vector index on ${COLLECTION_NAME} collection...`);

  try {
    const indexSpec = {
      name: 'keywordsVector_index',
      key: {
        keywordsVector: 'cosmosSearch',
      },
      cosmosSearchOptions: {
        kind: 'vector-ivf',
        numLists: 100,
        similarity: 'COS',
        dimensions: 384,
      },
    };

    await collection.createIndex({ keywordsVector: 1 }, indexSpec);

    console.log('✓ Vector index created successfully\n');
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 48) {
      console.log('⚠ Vector index already exists, skipping creation\n');
    } else {
      throw error;
    }
  }
}

/**
 * Seed the database with test cases
 */
async function seedDatabase(db: Db, testCases: SyncedCase[]): Promise<void> {
  const collection = db.collection(COLLECTION_NAME);

  console.log(`Clearing existing SYNCED_CASE documents in ${COLLECTION_NAME} collection...`);
  const deleteResult = await collection.deleteMany({ documentType: 'SYNCED_CASE' });
  console.log(`✓ Deleted ${deleteResult.deletedCount} existing documents\n`);

  console.log(`Inserting ${testCases.length} test cases...`);

  const batchSize = 100;
  let inserted = 0;

  for (let i = 0; i < testCases.length; i += batchSize) {
    const batch = testCases.slice(i, i + batchSize);
    await collection.insertMany(batch);
    inserted += batch.length;
    console.log(`  Inserted ${inserted}/${testCases.length} cases...`);
  }

  console.log(`✓ Successfully inserted ${testCases.length} test cases\n`);
}

/**
 * Verify the seeded data
 */
async function verifyData(db: Db): Promise<void> {
  const collection = db.collection(COLLECTION_NAME);

  console.log('Verifying seeded data...\n');

  const totalCount = await collection.countDocuments({ documentType: 'SYNCED_CASE' });
  console.log(`✓ Total cases: ${totalCount}`);

  const withKeywords = await collection.countDocuments({
    documentType: 'SYNCED_CASE',
    keywords: { $exists: true, $ne: [] },
  });
  console.log(`✓ Cases with keywords: ${withKeywords}`);

  const withVectors = await collection.countDocuments({
    documentType: 'SYNCED_CASE',
    keywordsVector: { $exists: true },
  });
  console.log(`✓ Cases with vectors: ${withVectors}`);

  const withJointDebtor = await collection.countDocuments({
    documentType: 'SYNCED_CASE',
    jointDebtor: { $exists: true },
  });
  console.log(`✓ Cases with joint debtors: ${withJointDebtor}`);

  // Sample document
  const sample = await collection.findOne({ documentType: 'SYNCED_CASE' });
  if (sample) {
    console.log('\nSample document:');
    console.log('  Case ID:', sample.caseId);
    console.log('  Chapter:', sample.chapter);
    console.log('  Division:', sample.courtDivisionCode, '-', sample.courtDivisionName);
    console.log('  Debtor:', sample.debtor?.name);
    if (sample.jointDebtor) {
      console.log('  Joint Debtor:', sample.jointDebtor.name);
    }
    console.log('  Keywords:', sample.keywords);
    console.log('  Vector dimensions:', sample.keywordsVector?.length);
  }

  // Sample special test cases
  console.log('\nSpecial test cases for fuzzy search validation:');
  const specialCases = await collection
    .find({
      documentType: 'SYNCED_CASE',
      'debtor.name': { $regex: /^(John|Jon|Jonathan) Smit/ },
    })
    .limit(5)
    .toArray();

  specialCases.forEach((c: Document) => {
    console.log(`  - ${c.caseId as string}: ${c.debtor?.name as string}`);
  });

  // Check indexes
  const indexes = await collection.listIndexes().toArray();
  const vectorIndex = indexes.find((idx: Document) => idx.name === 'keywordsVector_index');
  console.log('\nVector index:', vectorIndex ? '✓ Present' : '✗ Missing');

  if (vectorIndex && vectorIndex.cosmosSearchOptions) {
    console.log('  Type:', vectorIndex.cosmosSearchOptions.kind);
    console.log('  Dimensions:', vectorIndex.cosmosSearchOptions.dimensions);
    console.log('  Similarity:', vectorIndex.cosmosSearchOptions.similarity);
  }
}

/**
 * Print summary
 */
function printSummary(dbName: string, caseCount: number): void {
  console.log('\n' + '='.repeat(70));
  console.log('EXPERIMENTAL DATABASE SETUP COMPLETE');
  console.log('='.repeat(70));
  console.log(`\nDatabase: ${dbName}`);
  console.log(`Collection: ${COLLECTION_NAME}`);
  console.log(`Test cases: ${caseCount} (generated with MockData)`);
  console.log('\nAll cases include:');
  console.log('  ✓ Realistic case structure from MockData');
  console.log('  ✓ keywords: [debtor name, joint debtor name]');
  console.log('  ✓ keywordsVector: 384-dimensional embedding');
  console.log('  ✓ Special test cases for fuzzy search validation');

  console.log('\nTest Name Patterns Included:');
  console.log('  • John Smith / Jon Smith / John Smyth (typos)');
  console.log('  • Michael Johnson / Mike Johnson (nickname)');
  console.log('  • William Brown / Bill Brown (nickname)');
  console.log('  • Elizabeth Wilson / Liz Wilson / Elizabeth Willson (variants)');

  console.log('\nNext Steps:');
  console.log('  1. Update .env to use experimental database:');
  console.log(`     DATABASE_NAME=${dbName}`);
  console.log('\n  2. Restart your API with experimental database');
  console.log('\n  3. Test fuzzy name searches:');
  console.log('     GET /api/cases?name=Jon+Smith (should find John Smith)');
  console.log('     GET /api/cases?name=Mike+Johnson (should find Michael Johnson)');
  console.log('\n  4. Compare with traditional search:');
  console.log('     GET /api/cases (without name parameter)');

  console.log('\n' + '='.repeat(70) + '\n');
}

/**
 * Main execution
 */
async function main(): Promise<number> {
  console.log('='.repeat(70));
  console.log('EXPERIMENTAL DATABASE SEEDING SCRIPT (TypeScript)');
  console.log('Using MockData for realistic test cases');
  console.log('='.repeat(70));

  if (!DEV_CONNECTION_STRING) {
    console.error('\n✗ Error: MONGO_CONNECTION_STRING environment variable is required');
    return 1;
  }

  const client = new MongoClient(DEV_CONNECTION_STRING);

  try {
    // Configure and initialize embedding model
    configureEmbeddingModel();
    const embeddingModel = await initializeEmbeddingModel();

    // Connect to database
    console.log('Connecting to Cosmos DB...');
    await client.connect();
    console.log('✓ Connected to Cosmos DB\n');

    const db = client.db(EXPERIMENTAL_DB_NAME);

    // Generate test data
    const regularCases = await generateTestCasesWithVectors(embeddingModel, NUM_TEST_CASES - 20);
    const specialCases = await generateNamedTestCases(embeddingModel);
    const allTestCases = [...regularCases, ...specialCases];

    // Seed database
    await seedDatabase(db, allTestCases);

    // Create vector index
    await createVectorIndex(db);

    // Verify
    await verifyData(db);

    // Print summary
    printSummary(EXPERIMENTAL_DB_NAME, allTestCases.length);

    return 0;
  } catch (error: unknown) {
    console.error('\n✗ Error during seeding:', error);
    if (error instanceof Error) {
      console.error('\nStack trace:', error.stack);
    }
    return 1;
  } finally {
    await client.close();
    console.log('✓ Connection closed\n');
  }
}

// Run the script
main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
