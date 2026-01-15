#!/usr/bin/env tsx
/**
 * Seed MongoDB Atlas with Test Data for Vector Search Validation
 *
 * This seeds the Atlas cluster with the same MockData test cases used
 * for local testing, allowing us to validate the actual API implementation.
 *
 * Usage:
 *   npx tsx test/vector-search/seed-mongodb-atlas.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { MongoClient } from 'mongodb';
import MockData from '../../common/src/cams/test-utilities/mock-data';
import { SyncedCase } from '../../common/src/cams/cases';
import { getEmbeddingService } from '../../backend/lib/adapters/services/embedding.service';
import { ApplicationContext } from '../../backend/lib/adapters/types/basic';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '.env') });

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

const ATLAS_URI = process.env.ATLAS_CONNECTION_STRING;
const DATABASE_NAME = process.env.ATLAS_DATABASE_NAME || 'cams-vector-test';
const COLLECTION_NAME = 'cases';
const NUM_TEST_CASES = 50;
const DIVISION_CODES = ['081', '091', '101', '111', '121'];

if (!ATLAS_URI) {
  console.error('❌ Error: ATLAS_CONNECTION_STRING environment variable is not set');
  console.error('Please create a .env file in test/vector-search/ with your Atlas credentials');
  console.error('See .env.example for the required format');
  process.exit(1);
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
  console.log('Seed MongoDB Atlas for Vector Search Testing');
  console.log('═'.repeat(70));
  console.log('\nConnection: MongoDB Atlas');
  console.log('Database:', DATABASE_NAME);
  console.log('Collection:', COLLECTION_NAME);
  console.log('');

  const client = new MongoClient(ATLAS_URI);

  try {
    console.log('Connecting to MongoDB Atlas...');
    await client.connect();
    console.log('✓ Connected to MongoDB Atlas\n');

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
    console.log(`Inserting ${allCases.length} cases into MongoDB Atlas...`);
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
    console.log('MongoDB Atlas Seeding Complete!');
    console.log('═'.repeat(70));
    console.log('\n⚠️  IMPORTANT: Atlas Search Index Required');
    console.log('\nBefore running vector search tests, create an Atlas Search index:');
    console.log('\n1. Go to Atlas UI → Database → Search');
    console.log('2. Create Search Index with this configuration:');
    console.log('\n{');
    console.log('  "mappings": {');
    console.log('    "dynamic": false,');
    console.log('    "fields": {');
    console.log('      "keywordsVector": {');
    console.log('        "type": "knnVector",');
    console.log('        "dimensions": 384,');
    console.log('        "similarity": "cosine"');
    console.log('      }');
    console.log('    }');
    console.log('  }');
    console.log('}');
    console.log('\n3. Wait for index to build (may take a few minutes)');
    console.log('\nNext steps:');
    console.log('  1. Create Atlas Search index (see above)');
    console.log('  2. Run: npx tsx test/vector-search/test-mongodb-atlas-repository.ts');
    console.log('  3. Validate vector search implementation!');
    console.log('');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

main().catch(console.error);
