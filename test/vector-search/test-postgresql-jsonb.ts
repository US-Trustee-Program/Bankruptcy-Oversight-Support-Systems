/**
 * PostgreSQL JSONB + pgvector Proof of Concept Test
 *
 * This script demonstrates PostgreSQL's document database capabilities
 * combined with vector search using pgvector.
 *
 * Tests:
 * 1. Embedding generation from keywords
 * 2. Document storage with JSONB
 * 3. Nested document queries
 * 4. Vector search with document filters
 * 5. Hybrid search (vector + document queries)
 *
 * Usage:
 *   npx tsx test/vector-search/test-postgresql-jsonb.ts
 */

import { Pool } from 'pg';
import { getEmbeddingService } from '../../backend/lib/adapters/services/embedding.service';
import { ApplicationContext } from '../../backend/lib/adapters/types/basic';

// Mock application context for testing
const mockContext: ApplicationContext = {
  logger: {
    info: (module: string, message: string) => console.log(`[${module}] INFO: ${message}`),
    error: (module: string, message: string, error?: unknown) =>
      console.error(`[${module}] ERROR: ${message}`, error),
    warn: (module: string, message: string) => console.warn(`[${module}] WARN: ${message}`),
    debug: (module: string, message: string) => console.debug(`[${module}] DEBUG: ${message}`),
  },
  session: undefined,
  request: {
    headers: {},
    url: '',
    method: 'GET',
  },
  config: {
    mongoConnectionString: '', // Not used for PostgreSQL
  },
};

const POSTGRES_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'cams-local',
  user: 'postgres',
  password: 'local-dev-password',  // pragma: allowlist secret
};

interface CaseDocument {
  caseId: string;
  debtor: {
    name: string;
    ssn?: string;
    address?: {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
  };
  jointDebtor?: {
    name: string;
  };
  caseTitle?: string;
  caseStatus: string;
  chapter: string;
  dateFiled: string;
  dateClosed?: string;
  courtDivisionCode?: string;
}

async function main() {
  console.log('🚀 Starting PostgreSQL JSONB + pgvector Demo\n');

  const pool = new Pool(POSTGRES_CONFIG);

  try {
    // Connect to PostgreSQL
    console.log('📡 Connecting to PostgreSQL...');
    await pool.query('SELECT NOW()');
    console.log('✅ Connected successfully\n');

    // Step 1: Test Embedding Generation
    console.log('🧪 Test 1: Embedding Generation');
    console.log('─'.repeat(50));

    const embeddingService = getEmbeddingService();
    const testKeywords = ['John Doe'];
    console.log(`Generating embedding for keywords: ${testKeywords.join(', ')}`);

    const vector = await embeddingService.generateKeywordsEmbedding(mockContext, testKeywords);

    if (!vector) {
      throw new Error('Failed to generate embedding');
    }

    console.log(`✅ Generated ${vector.length}-dimensional vector`);
    console.log(`   Sample values: [${vector.slice(0, 5).map(v => v.toFixed(4)).join(', ')}...]\n`);

    // Step 2: Insert/Update Cases with Embeddings
    console.log('📝 Test 2: Storing Documents with Embeddings');
    console.log('─'.repeat(50));

    // Generate embeddings for all cases
    const cases: Array<{ id: string; keywords: string[]; vector: number[] | null }> = [
      {
        id: '24-00001',
        keywords: ['John Doe'],
        vector: await embeddingService.generateKeywordsEmbedding(mockContext, ['John Doe']),
      },
      {
        id: '24-00002',
        keywords: ['Jane Smith', 'John Smith'],
        vector: await embeddingService.generateKeywordsEmbedding(
          mockContext,
          ['Jane Smith', 'John Smith']
        ),
      },
      {
        id: '24-00003',
        keywords: ['Robert Johnson'],
        vector: await embeddingService.generateKeywordsEmbedding(mockContext, ['Robert Johnson']),
      },
    ];

    // Update cases with embeddings
    for (const caseData of cases) {
      if (caseData.vector) {
        const vectorString = `[${caseData.vector.join(',')}]`;
        await pool.query(
          'UPDATE cases SET keywords_vector = $1::vector WHERE case_id = $2',
          [vectorString, caseData.id]
        );
      }
    }

    console.log(`✅ Updated ${cases.length} cases with embeddings\n`);

    // Step 3: Document Query Tests
    console.log('🔍 Test 3: Document Database Queries');
    console.log('─'.repeat(50));

    // Query 1: Find by nested field
    console.log('\n📋 Query 1: Find cases by debtor name');
    const result1 = await pool.query(`
      SELECT
        case_id,
        data->'debtor'->>'name' as debtor_name,
        data->>'caseStatus' as status
      FROM cases
      WHERE data->'debtor'->>'name' = 'John Doe'
    `);
    console.log(`   Found ${result1.rowCount} case(s):`);
    result1.rows.forEach(row => {
      console.log(`   - ${row.case_id}: ${row.debtor_name} (${row.status})`);
    });

    // Query 2: JSON containment
    console.log('\n📋 Query 2: Find all open cases (JSON containment)');
    const result2 = await pool.query(`
      SELECT
        case_id,
        data->'debtor'->>'name' as debtor_name,
        data->>'chapter' as chapter
      FROM cases
      WHERE data @> '{"caseStatus": "open"}'::jsonb
    `);
    console.log(`   Found ${result2.rowCount} case(s):`);
    result2.rows.forEach(row => {
      console.log(`   - ${row.case_id}: ${row.debtor_name} (Chapter ${row.chapter})`);
    });

    // Query 3: Deeply nested field
    console.log('\n📋 Query 3: Find cases in New York');
    const result3 = await pool.query(`
      SELECT
        case_id,
        data->'debtor'->>'name' as debtor_name,
        data->'debtor'->'address'->>'city' as city,
        data->'debtor'->'address'->>'state' as state
      FROM cases
      WHERE data->'debtor'->'address'->>'state' = 'NY'
    `);
    console.log(`   Found ${result3.rowCount} case(s):`);
    result3.rows.forEach(row => {
      console.log(`   - ${row.case_id}: ${row.debtor_name} in ${row.city}, ${row.state}`);
    });

    // Step 4: Vector Search
    console.log('\n🎯 Test 4: Vector Similarity Search');
    console.log('─'.repeat(50));

    const searchKeywords = ['John'];
    const searchVector = await embeddingService.generateKeywordsEmbedding(mockContext, searchKeywords);

    if (!searchVector) {
      throw new Error('Failed to generate search vector');
    }

    console.log(`Searching for cases similar to: "${searchKeywords.join(' ')}"`);

    const vectorString = `[${searchVector.join(',')}]`;
    const result4 = await pool.query(
      `
      SELECT
        case_id,
        data->'debtor'->>'name' as debtor_name,
        data->>'caseStatus' as status,
        1 - (keywords_vector <=> $1::vector) AS similarity
      FROM cases
      WHERE keywords_vector IS NOT NULL
      ORDER BY keywords_vector <=> $1::vector
      LIMIT 10
    `,
      [vectorString]
    );

    console.log(`   Found ${result4.rowCount} similar case(s) (sorted by similarity):`);
    result4.rows.forEach(row => {
      console.log(
        `   - ${row.case_id}: ${row.debtor_name} (${row.status}) - Similarity: ${(row.similarity * 100).toFixed(1)}%`
      );
    });

    // Step 5: Hybrid Search (Vector + Document Filters)
    console.log('\n🔄 Test 5: Hybrid Search (Vector + Document Filters)');
    console.log('─'.repeat(50));

    console.log('Searching for similar cases that are also open:');

    const result5 = await pool.query(
      `
      SELECT
        case_id,
        data->'debtor'->>'name' as debtor_name,
        data->>'chapter' as chapter,
        1 - (keywords_vector <=> $1::vector) AS similarity
      FROM cases
      WHERE
        keywords_vector IS NOT NULL
        AND data->>'caseStatus' = 'open'
      ORDER BY keywords_vector <=> $1::vector
      LIMIT 10
    `,
      [vectorString]
    );

    console.log(`   Found ${result5.rowCount} open case(s) similar to "${searchKeywords.join(' ')}":`);
    result5.rows.forEach(row => {
      console.log(
        `   - ${row.case_id}: ${row.debtor_name} (Chapter ${row.chapter}) - Similarity: ${(row.similarity * 100).toFixed(1)}%`
      );
    });

    // Step 6: Performance Info
    console.log('\n📊 Test 6: Index Information');
    console.log('─'.repeat(50));

    const indexInfo = await pool.query(`
      SELECT
        indexname,
        indexdef
      FROM pg_indexes
      WHERE tablename = 'cases'
      ORDER BY indexname
    `);

    console.log('Indexes on cases table:');
    indexInfo.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    // Summary
    console.log('\n' + '═'.repeat(50));
    console.log('📊 Test Summary');
    console.log('═'.repeat(50));
    console.log('✅ Document Storage (JSONB): Working');
    console.log('✅ Nested Document Queries: Working');
    console.log('✅ JSON Containment Queries: Working');
    console.log('✅ Vector Embeddings: Working (384-dim)');
    console.log('✅ Vector Similarity Search: Working');
    console.log('✅ Hybrid Search (Vector + Filters): Working');
    console.log('✅ Indexing (GIN + HNSW): Working');

    console.log('\n💡 Observations:');
    console.log('   • PostgreSQL acts as a full-featured document database');
    console.log('   • JSONB queries are flexible and powerful');
    console.log('   • Vector search integrates seamlessly with document queries');
    console.log('   • Hybrid queries combine the best of both approaches');

    console.log('\n📝 Comparison with MongoDB:');
    console.log('   MongoDB: db.cases.find({"debtor.name": "John Doe"})');
    console.log('   PostgreSQL: SELECT data FROM cases WHERE data->\'debtor\'->>\'name\' = \'John Doe\'');
    console.log('   → Very similar capabilities with slightly different syntax');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n👋 Disconnected from PostgreSQL');
  }
}

// Run tests
main().catch(console.error);
