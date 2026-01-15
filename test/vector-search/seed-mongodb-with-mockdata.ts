#!/usr/bin/env tsx
/**
 * Seed Local MongoDB with MockData for Vector Search Testing
 *
 * This uses the SAME MockData approach as PostgreSQL demo, ensuring
 * we're testing with identical data structures.
 *
 * Usage:
 *   npx tsx test/vector-search/seed-mongodb-with-mockdata.ts
 */

import { MongoClient } from 'mongodb';
import MockData from '../../common/src/cams/test-utilities/mock-data';
import { SyncedCase } from '../../common/src/cams/cases';
import { getEmbeddingService } from '../../backend/lib/adapters/services/embedding.service';
import { ApplicationContext } from '../../backend/lib/adapters/types/basic';

// Mock application context
const mockContext: ApplicationContext = {
  logger: {
    info: (module: string, message: string) => console.log(`[${module}] ${message}`),
    error: (module: string, message: string, error?: unknown) =>
      console.error(`[${module}] ERROR: ${message}`, error),
    warn: (module: string, message: string) => console.warn(`[${module}] ${message}`),
    debug: (module: string, message: string) => {}, // Suppress debug
  },
  session: undefined,
  request: { headers: {}, url: '', method: 'GET' },
  config: { mongoConnectionString: '' },
};

const MONGODB_URI = 'mongodb://localhost:27017/cams-local?replicaSet=rs0';
const DATABASE_NAME = 'cams-local';
const COLLECTION_NAME = 'cases';
const NUM_TEST_CASES = 50;
const DIVISION_CODES = ['081', '091', '101', '111', '121'];

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
async function generateTestCasesWithVectors(count: number): Promise<SyncedCase[]> {
  console.log(`\nGenerating ${count} test cases using MockData...`);

  const embeddingService = getEmbeddingService();
  const testCases: SyncedCase[] = [];

  for (let i = 0; i < count; i++) {
    const divisionCode = DIVISION_CODES[Math.floor(Math.random() * DIVISION_CODES.length)];

    const syncedCase = MockData.getSyncedCase({
      override: {
        courtDivisionCode: divisionCode,
        debtor: MockData.getDebtor({ entityType: 'person' }),
        ...(Math.random() < 0.3 && {
          jointDebtor: MockData.getDebtor({ entityType: 'person' }),
        }),
      },
    });

    const keywords = extractKeywords(syncedCase);
    const keywordsVector = keywords.length > 0
      ? await embeddingService.generateKeywordsEmbedding(mockContext, keywords)
      : null;

    testCases.push({
      ...syncedCase,
      keywords,
      keywordsVector: keywordsVector || undefined,
    });

    if ((i + 1) % 10 === 0) {
      console.log(`  Generated ${i + 1}/${count} cases...`);
    }
  }

  console.log(`✓ Generated ${count} test cases with MockData\n`);
  return testCases;
}

/**
 * Generate special test cases for fuzzy matching validation
 */
async function generateSpecialTestCases(): Promise<SyncedCase[]> {
  console.log('Generating special test cases with known name patterns...');

  const embeddingService = getEmbeddingService();
  const specialCases: Array<{ name: string; variant?: string }> = [
    { name: 'John Smith' },
    { name: 'Jon Smith', variant: 'typo' },
    { name: 'John Smyth', variant: 'spelling' },
    { name: 'Michael Johnson' },
    { name: 'Mike Johnson', variant: 'nickname' },
    { name: 'William Brown' },
    { name: 'Bill Brown', variant: 'nickname' },
    { name: 'Elizabeth Wilson' },
    { name: 'Liz Wilson', variant: 'nickname' },
    { name: 'Elizabeth Willson', variant: 'typo' },
  ];

  const testCases: SyncedCase[] = [];

  for (const { name } of specialCases) {
    const syncedCase = MockData.getSyncedCase({
      override: {
        debtor: { ...MockData.getDebtor({ entityType: 'person' }), name },
        courtDivisionCode: '081',
      },
    });

    const keywords = extractKeywords(syncedCase);
    const keywordsVector = await embeddingService.generateKeywordsEmbedding(mockContext, keywords);

    testCases.push({
      ...syncedCase,
      keywords,
      keywordsVector: keywordsVector || undefined,
    });
  }

  console.log(`✓ Generated ${specialCases.length} special test cases\n`);
  return testCases;
}

async function main() {
  console.log('═'.repeat(70));
  console.log('Local MongoDB Vector Search Seeding (Using MockData)');
  console.log('═'.repeat(70));

  const client = new MongoClient(MONGODB_URI);

  try {
    console.log('\nConnecting to MongoDB...');
    await client.connect();
    console.log('✓ Connected to MongoDB\n');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection<SyncedCase>(COLLECTION_NAME);

    // Clear existing SYNCED_CASE documents
    console.log('Clearing existing test data...');
    const deleteResult = await collection.deleteMany({ documentType: 'SYNCED_CASE' });
    console.log(`✓ Deleted ${deleteResult.deletedCount} existing cases\n`);

    // Generate test cases
    const regularCases = await generateTestCasesWithVectors(NUM_TEST_CASES);
    const specialCases = await generateSpecialTestCases();
    const allCases = [...regularCases, ...specialCases];

    // Insert cases
    console.log(`Inserting ${allCases.length} cases into MongoDB...`);
    const insertResult = await collection.insertMany(allCases);
    console.log(`✓ Successfully inserted ${insertResult.insertedCount} cases\n`);

    // Verify data
    console.log('Verifying seeded data...');
    const stats = {
      total: await collection.countDocuments({ documentType: 'SYNCED_CASE' }),
      withKeywords: await collection.countDocuments({
        documentType: 'SYNCED_CASE',
        keywords: { $exists: true, $ne: [] },
      }),
      withVectors: await collection.countDocuments({
        documentType: 'SYNCED_CASE',
        keywordsVector: { $exists: true },
      }),
    };

    console.log(`✓ Total cases: ${stats.total}`);
    console.log(`✓ Cases with keywords: ${stats.withKeywords}`);
    console.log(`✓ Cases with vectors: ${stats.withVectors}`);

    // Sample document
    const sample = await collection.findOne({
      documentType: 'SYNCED_CASE',
      jointDebtor: { $exists: true },
    });

    if (sample) {
      console.log('\nSample document:');
      console.log(`  Case ID: ${sample.caseId}`);
      console.log(`  Chapter: ${sample.chapter}`);
      console.log(`  Division: ${sample.courtDivisionCode}`);
      console.log(`  Debtor: ${sample.debtor?.name}`);
      console.log(`  Joint Debtor: ${sample.jointDebtor?.name}`);
      console.log(`  Keywords: ${sample.keywords?.join(', ')}`);
      console.log(`  Vector dimensions: ${sample.keywordsVector?.length || 0}`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('Local MongoDB Seeding Complete!');
    console.log('═'.repeat(70));
    console.log('\nData ready for API testing:');
    console.log('  ✓ Realistic case structure from MockData');
    console.log('  ✓ 384-dimensional vector embeddings');
    console.log('  ✓ Special test cases for fuzzy search validation');
    console.log('\nTest cases included:');
    console.log('  • John Smith (exact match baseline)');
    console.log('  • Jon Smith (typo variant)');
    console.log('  • John Smyth (spelling variant)');
    console.log('  • Mike Johnson (nickname for Michael)');
    console.log('\nNext steps:');
    console.log('  1. Update backend/.env to use local database');
    console.log('  2. Start API: cd backend/function-apps/api && npm start');
    console.log('  3. Test vector search endpoint');
    console.log('');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
