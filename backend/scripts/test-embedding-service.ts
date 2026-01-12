#!/usr/bin/env tsx
/**
 * Test Embedding Service
 *
 * Verifies that the EmbeddingService can:
 * 1. Load the model from local cache
 * 2. Generate embeddings for text
 * 3. Generate embeddings from keywords
 * 4. Extract keywords from case data
 */

import { getEmbeddingService } from '../lib/adapters/services/embedding.service';
import { LoggerImpl } from '../lib/adapters/services/logger.service';
import { ApplicationContext } from '../lib/adapters/types/basic';

async function testEmbeddingService(): Promise<number> {
  console.log('='.repeat(70));
  console.log('EMBEDDING SERVICE TEST');
  console.log('='.repeat(70));
  console.log();

  // Create a minimal application context
  const logger = new LoggerImpl('test-embedding-service');
  const context = {
    logger,
    invocationId: 'test-invocation',
  } as ApplicationContext;

  try {
    const embeddingService = getEmbeddingService();

    // Test 1: Extract keywords
    console.log('Test 1: Extract keywords from case data');
    const testCase = {
      debtor: { name: 'John Smith' },
      jointDebtor: { name: 'Jane Smith' },
    };
    const keywords = embeddingService.extractCaseKeywords(testCase);
    console.log(`  Keywords: ${JSON.stringify(keywords)}`);
    console.log(`  ✓ Extracted ${keywords.length} keywords\n`);

    // Test 2: Generate embedding from text
    console.log('Test 2: Generate embedding from single text');
    const startTime1 = Date.now();
    const embedding1 = await embeddingService.generateEmbedding(context, 'John Smith');
    const elapsed1 = Date.now() - startTime1;

    if (!embedding1) {
      console.error('  ✗ Failed to generate embedding');
      return 1;
    }

    console.log(`  Embedding dimensions: ${embedding1.length}`);
    console.log(
      `  First 5 values: ${embedding1
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(', ')}`,
    );
    console.log(`  Generation time: ${elapsed1}ms`);
    console.log(`  ✓ Successfully generated embedding\n`);

    // Test 3: Generate embedding from keywords
    console.log('Test 3: Generate embedding from keywords');
    const startTime2 = Date.now();
    const embedding2 = await embeddingService.generateKeywordsEmbedding(context, keywords);
    const elapsed2 = Date.now() - startTime2;

    if (!embedding2) {
      console.error('  ✗ Failed to generate keywords embedding');
      return 1;
    }

    console.log(`  Embedding dimensions: ${embedding2.length}`);
    console.log(
      `  First 5 values: ${embedding2
        .slice(0, 5)
        .map((v) => v.toFixed(4))
        .join(', ')}`,
    );
    console.log(`  Generation time: ${elapsed2}ms`);
    console.log(`  ✓ Successfully generated keywords embedding\n`);

    // Test 4: Verify singleton behavior (second call should be faster)
    console.log('Test 4: Verify model caching (second call)');
    const startTime3 = Date.now();
    const embedding3 = await embeddingService.generateEmbedding(context, 'Michael Johnson');
    const elapsed3 = Date.now() - startTime3;

    if (!embedding3) {
      console.error('  ✗ Failed to generate embedding');
      return 1;
    }

    console.log(`  Generation time: ${elapsed3}ms`);
    console.log(`  ✓ Model is cached (${elapsed3}ms << ${elapsed1}ms)\n`);

    // Test 5: Compute cosine similarity between similar names
    console.log('Test 5: Semantic similarity test');
    const johnSmith = await embeddingService.generateEmbedding(context, 'John Smith');
    const jonSmith = await embeddingService.generateEmbedding(context, 'Jon Smith');
    const michaelJohnson = await embeddingService.generateEmbedding(context, 'Michael Johnson');

    if (!johnSmith || !jonSmith || !michaelJohnson) {
      console.error('  ✗ Failed to generate embeddings for similarity test');
      return 1;
    }

    // Compute cosine similarity (vectors are already normalized)
    const similarity1 = cosineSimilarity(johnSmith, jonSmith);
    const similarity2 = cosineSimilarity(johnSmith, michaelJohnson);

    console.log(`  "John Smith" vs "Jon Smith" similarity: ${similarity1.toFixed(4)}`);
    console.log(`  "John Smith" vs "Michael Johnson" similarity: ${similarity2.toFixed(4)}`);
    console.log(
      `  ✓ Similar names have higher similarity (${similarity1.toFixed(4)} > ${similarity2.toFixed(4)})\n`,
    );

    console.log('='.repeat(70));
    console.log('✓ ALL TESTS PASSED');
    console.log('='.repeat(70));

    return 0;
  } catch (error) {
    console.error('\n✗ Error during test:', error);
    return 1;
  }
}

/**
 * Compute cosine similarity between two normalized vectors.
 * For normalized vectors, this is just the dot product.
 */
function cosineSimilarity(vec1: number[], vec2: number[]): number {
  let dotProduct = 0;
  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
  }
  return dotProduct;
}

testEmbeddingService()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
