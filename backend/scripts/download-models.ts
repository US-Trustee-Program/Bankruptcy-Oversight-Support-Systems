#!/usr/bin/env tsx
import { pipeline, env } from '@xenova/transformers';
import * as fs from 'fs';
import * as path from 'path';

// Configure model cache directory
const MODELS_DIR = path.resolve(__dirname, '../models');
env.cacheDir = MODELS_DIR;

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

async function downloadModel(): Promise<number> {
  console.log(`Downloading model: ${MODEL_NAME}`);
  console.log(`Cache directory: ${MODELS_DIR}`);

  try {
    // This will download the model to MODELS_DIR
    const extractor = await pipeline('feature-extraction', MODEL_NAME);

    console.log('✓ Model downloaded successfully');
    console.log(`✓ Model files saved to: ${MODELS_DIR}`);

    // Test the model to ensure it works
    console.log('Testing model...');
    const testOutput = await extractor('test', { pooling: 'mean', normalize: true });
    console.log(`✓ Model test successful (output dimensions: ${testOutput.data.length})`);

    return 0;
  } catch (error) {
    console.error('✗ Failed to download model:', error);
    return 1;
  }
}

downloadModel()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
