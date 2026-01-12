#!/usr/bin/env tsx
import { pipeline, env } from '@xenova/transformers';
import * as path from 'path';

env.cacheDir = path.resolve(__dirname, '../models');
env.allowLocalModels = true;
env.allowRemoteModels = false;

async function test() {
  console.log('Testing local model loading...');
  console.log('Models directory:', env.cacheDir);

  const startTime = Date.now();
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
  const loadTime = Date.now() - startTime;

  console.log(`✓ Model loaded from local cache in ${loadTime}ms`);

  // Test with sample names
  const testNames = [
    'John Smith',
    'Jane Doe',
    'John Smythe', // Similar to "John Smith"
  ];

  console.log('\nGenerating embeddings for test names:');
  for (const name of testNames) {
    const embeddingStart = Date.now();
    const output = await extractor(name, { pooling: 'mean', normalize: true });
    const embeddingTime = Date.now() - embeddingStart;

    console.log(`  "${name}": ${output.data.length} dims in ${embeddingTime}ms`);
  }

  console.log('\n✓ All tests passed!');
}

test().catch(console.error);
