#!/usr/bin/env tsx
/**
 * Seed PostgreSQL with Realistic Test Data for Document DB Demo
 *
 * Uses MockData from @common to generate well-formed test documents,
 * demonstrating PostgreSQL's document database capabilities.
 *
 * Usage:
 *   npx tsx test/vector-search/seed-postgresql-with-mockdata.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { Pool } from 'pg';
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

const POSTGRES_CONFIG = {
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432', 10),
  database: process.env.POSTGRES_DATABASE || 'cams-local',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD,
};

if (!POSTGRES_CONFIG.password) {
  console.error('❌ Error: POSTGRES_PASSWORD environment variable is not set');
  console.error('Please create a .env file in test/vector-search/ with your PostgreSQL credentials');
  console.error('See .env.example for the required format');
  process.exit(1);
}

const NUM_TEST_CASES = 50; // Start with 50 for quick demo
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

    // Extract keywords and generate embedding
    const keywords = extractKeywords(syncedCase);
    const keywordsVector = keywords.length > 0
      ? await embeddingService.generateKeywordsEmbedding(mockContext, keywords)
      : null;

    // Add vector fields to case
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
        courtDivisionCode: '081', // All in Manhattan for easy filtering
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
  console.log('PostgreSQL Document Database Seeding (Using MockData)');
  console.log('═'.repeat(70));

  const pool = new Pool(POSTGRES_CONFIG);

  try {
    // Test connection
    console.log('\nConnecting to PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('✓ Connected to PostgreSQL\n');

    // Clear existing data
    console.log('Clearing existing test data...');
    const deleteResult = await pool.query('DELETE FROM cases');
    console.log(`✓ Deleted ${deleteResult.rowCount} existing cases\n`);

    // Generate test cases
    const regularCases = await generateTestCasesWithVectors(NUM_TEST_CASES);
    const specialCases = await generateSpecialTestCases();
    const allCases = [...regularCases, ...specialCases];

    // Insert cases into PostgreSQL
    console.log(`Inserting ${allCases.length} cases into PostgreSQL...`);

    let inserted = 0;
    for (const testCase of allCases) {
      const vectorString = testCase.keywordsVector
        ? `[${testCase.keywordsVector.join(',')}]`
        : null;

      await pool.query(
        `INSERT INTO cases (case_id, data, keywords, keywords_vector)
         VALUES ($1, $2, $3, $4::vector)
         ON CONFLICT (case_id) DO UPDATE SET
           data = EXCLUDED.data,
           keywords = EXCLUDED.keywords,
           keywords_vector = EXCLUDED.keywords_vector`,
        [
          testCase.caseId,
          JSON.stringify(testCase),
          testCase.keywords || [],
          vectorString,
        ]
      );

      inserted++;
      if (inserted % 10 === 0) {
        console.log(`  Inserted ${inserted}/${allCases.length} cases...`);
      }
    }

    console.log(`✓ Successfully inserted ${inserted} cases\n`);

    // Verify data
    console.log('Verifying seeded data...');
    const stats = await pool.query(`
      SELECT
        COUNT(*) as total_cases,
        COUNT(keywords) FILTER (WHERE array_length(keywords, 1) > 0) as cases_with_keywords,
        COUNT(keywords_vector) as cases_with_vectors
      FROM cases
    `);

    const { total_cases, cases_with_keywords, cases_with_vectors } = stats.rows[0];
    console.log(`✓ Total cases: ${total_cases}`);
    console.log(`✓ Cases with keywords: ${cases_with_keywords}`);
    console.log(`✓ Cases with vectors: ${cases_with_vectors}`);

    // Sample document
    const sampleResult = await pool.query(`
      SELECT
        case_id,
        data->'debtor'->>'name' as debtor_name,
        data->'jointDebtor'->>'name' as joint_debtor_name,
        data->>'chapter' as chapter,
        data->>'courtDivisionCode' as division,
        keywords,
        array_length(keywords_vector::real[], 1) as vector_dimensions
      FROM cases
      WHERE data->'jointDebtor' IS NOT NULL
      LIMIT 1
    `);

    if (sampleResult.rows.length > 0) {
      const sample = sampleResult.rows[0];
      console.log('\nSample document:');
      console.log(`  Case ID: ${sample.case_id}`);
      console.log(`  Chapter: ${sample.chapter}`);
      console.log(`  Division: ${sample.division}`);
      console.log(`  Debtor: ${sample.debtor_name}`);
      console.log(`  Joint Debtor: ${sample.joint_debtor_name}`);
      console.log(`  Keywords: ${sample.keywords}`);
      console.log(`  Vector dimensions: ${sample.vector_dimensions}`);
    }

    console.log('\n' + '═'.repeat(70));
    console.log('PostgreSQL Document Database Seeding Complete!');
    console.log('═'.repeat(70));
    console.log('\nData ready for testing:');
    console.log('  ✓ Realistic case structure from MockData');
    console.log('  ✓ JSONB documents with nested fields');
    console.log('  ✓ 384-dimensional vector embeddings');
    console.log('  ✓ Special test cases for fuzzy search validation');
    console.log('\nNext steps:');
    console.log('  1. Run test: npx tsx test/vector-search/test-postgresql-jsonb.ts');
    console.log('  2. Compare with MongoDB approach');
    console.log('  3. Evaluate PostgreSQL as document database option');
    console.log('');

  } catch (error) {
    console.error('\n❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);
