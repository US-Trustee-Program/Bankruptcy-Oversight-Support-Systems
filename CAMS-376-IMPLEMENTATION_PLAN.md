# Vector Search Implementation Plan for Case Name Fuzzy Matching

**Feature Branch:** `CAMS-376-vector-encodings`
**Date Created:** 2026-01-12
**Last Updated:** 2026-01-14
**Status:** Implementation Complete - Awaiting Infrastructure Integration

## Table of Contents
1. [Current Status](#current-status)
2. [Overview](#overview)
3. [Architecture](#architecture)
4. [Technical Decisions](#technical-decisions)
5. [Implementation Steps](#implementation-steps)
6. [Testing Strategy](#testing-strategy)
7. [Deployment Guide](#deployment-guide)
8. [Performance Considerations](#performance-considerations)
9. [Troubleshooting](#troubleshooting)

---

## Current Status

### ✅ Implementation Complete (January 14, 2026)

All code implementation for vector search has been completed and thoroughly tested:

**Repositories:**
- ✅ `CasesAtlasRepository` - MongoDB Atlas with `$vectorSearch` operator
- ✅ `CasesDocumentDbRepository` - Azure DocumentDB with `$search.cosmosSearch` operator
- ✅ `CasesMongoRepository` - Preserved as-is for Cosmos DB RU-based (no vector search)

**Adapters:**
- ✅ `MongoAtlasCollectionAdapter` - Uses `MongoAtlasAggregateRenderer`
- ✅ `MongoDocumentDbCollectionAdapter` - Uses `MongoDocumentDbAggregateRenderer`

**Renderers:**
- ✅ `MongoAtlasAggregateRenderer` - Renders `$vectorSearch` for Atlas
- ✅ `MongoDocumentDbAggregateRenderer` - Renders `$search.cosmosSearch` for DocumentDB

**Test Coverage:**
- ✅ 18 unit tests (9 for Atlas, 9 for DocumentDB) - all passing
- ✅ Tests cover encoding, fallback, pipeline construction, edge cases
- ✅ Both repositories demonstrate where vector encoding occurs

**Code Location:**
- All production code in `backend/lib/adapters/gateways/mongo/`
- Test convention: Using `test()` instead of `it()`
- Docker compose file moved to: `test/vector-search/docker-compose.local-mongo.yml`

### ⚠️ Awaiting Integration Testing

**CasesDocumentDbRepository Status:**
- ✅ Implementation complete with comprehensive unit tests
- ⏳ Awaiting integration testing with actual DocumentDB instance
- ⏳ Requires Azure DocumentDB with vector search support

**Next Steps for Integration:**
1. Provision DocumentDB instance (see Phase 7 in this document)
2. Run integration tests with actual database
3. Verify `$search.cosmosSearch` syntax works as expected
4. Performance testing with real data
5. Production readiness assessment

---

## Overview

### Goal
Implement fuzzy name search for bankruptcy cases using Azure Cosmos DB vector search capabilities. This allows users to find cases by debtor/co-debtor names even with typos, variations, or partial matches.

### User Story
As a CAMS user, I want to search for cases by debtor name using fuzzy matching so that I can find cases even when I don't know the exact spelling or have incomplete information.

### Approach
- **Augment** existing search (not replace)
- **Pre-filter** cases using traditional filters (division, chapter, etc.)
- **Apply vector search** on the filtered subset
- **Embed model** in deployment package for fast cold starts
- **Local embeddings** using @xenova/transformers (no external API)

---

## Architecture

### High-Level Flow

```
User Search Request (name: "John Smith")
    ↓
1. Apply traditional filters (division, chapter, etc.)
    ↓
2. Generate query vector from search name
    ↓
3. Azure Cosmos DB Vector Search on filtered subset
    ↓
4. Return ranked results
```

### Data Model Changes

#### Before (SyncedCase)
```typescript
export type SyncedCase = DxtrCase & Auditable & {
  documentType: 'SYNCED_CASE';
  id?: string;
};
```

#### After (SyncedCase with Vector Search)
```typescript
export type SyncedCase = DxtrCase & Auditable & {
  documentType: 'SYNCED_CASE';
  id?: string;
  keywords?: string[];        // Human-readable: ["John Doe", "Jane Doe"]
  keywordsVector?: number[];  // 384-dimensional embedding vector
};
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Interface                          │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓ CasesSearchPredicate { name: "John" }
┌─────────────────────────────────────────────────────────────┐
│               Case Management Use Case                      │
│  - Validates predicate                                      │
│  - Calls repository with search criteria                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ↓
┌─────────────────────────────────────────────────────────────┐
│            Cases Mongo Repository                           │
│  1. Build traditional filter conditions                     │
│  2. If name search: call EmbeddingService                   │
│  3. Build pipeline: match → vectorSearch → sort → paginate  │
└─────────────────────┬───────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ↓                           ↓
┌──────────────────┐      ┌─────────────────────┐
│ EmbeddingService │      │ Cosmos DB (MongoDB) │
│ - Local model    │      │ - Vector index      │
│ - text → vector  │      │ - $search stage     │
└──────────────────┘      └─────────────────────┘
```

---

## Technical Decisions

### 1. Embedding Model: `Xenova/all-MiniLM-L6-v2`
- **Dimensions:** 384 (good balance of speed vs. quality)
- **Size:** ~25 MB
- **Speed:** Fast inference time
- **Quality:** Sufficient for name matching

**Why not larger models?**
- Faster inference time
- Smaller deployment package
- Lower memory footprint
- Good enough accuracy for name matching

### 2. Local Embedding Generation: `@xenova/transformers`
- **No external API calls** → No latency, no cost per request
- **Runs in Node.js** → Same process as API
- **ONNX Runtime** → Good performance
- **Production-ready** → Actively maintained by Hugging Face

**Alternatives considered:**
- TensorFlow.js: Larger, more complex
- Azure OpenAI: External dependency, latency, cost
- Python microservice: Additional deployment complexity

### 3. Hybrid Search Strategy
**Vector search is applied AFTER traditional filters:**

```typescript
pipeline(
  match(and(...traditionalConditions)),  // Pre-filter first
  vectorSearch(queryVector, 'keywordsVector', k),  // Then semantic search
  sort(descending(dateFiled)),
  paginate(offset, limit)
)
```

**Benefits:**
- Reduced vector search scope = faster queries
- Traditional filters still work independently
- Graceful degradation if vector search fails

### 4. Keywords Selection
**Initially include:**
- Debtor name
- Joint debtor name (if present)

**Future expansion possibilities:**
- Case title
- Attorney names
- Custom tags

### 5. Repository Architecture: Separation of Concerns

**ARCHITECTURAL IMPLEMENTATION COMPLETE** (January 14, 2026):

The existing `CasesMongoRepository` is specifically designed for **Azure Cosmos DB with MongoDB API (RU-based model)**, which does NOT support vector search operations. Therefore, we implemented a multi-repository architecture with renderer-specific adapters.

#### ✅ Implemented Repository Strategy

1. **CasesMongoRepository** (Unchanged - Cosmos DB RU-based)
   - ✅ Original implementation preserved for traditional search
   - ✅ No vector search capabilities (by design)
   - ✅ Used with existing Cosmos DB MongoDB API infrastructure
   - **Location**: `backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts`

2. **✅ CasesAtlasRepository** (NEW - for MongoDB Atlas)
   - ✅ Implements `CasesRepository` interface
   - ✅ Uses `$vectorSearch` operator (MongoDB Atlas syntax)
   - ✅ Overrides `getAdapter()` to return `MongoAtlasCollectionAdapter`
   - ✅ Comprehensive unit tests (9 tests, all passing)
   - **Location**: `backend/lib/adapters/gateways/mongo/cases.atlas.repository.ts`
   - **Tests**: `backend/lib/adapters/gateways/mongo/cases.atlas.repository.test.ts`

3. **✅ CasesDocumentDbRepository** (NEW - for Azure DocumentDB)
   - ✅ Implements `CasesRepository` interface
   - ✅ Uses `$search.cosmosSearch` operator (Azure DocumentDB syntax)
   - ✅ Overrides `getAdapter()` to return `MongoDocumentDbCollectionAdapter`
   - ✅ Comprehensive unit tests (9 tests, all passing)
   - **Location**: `backend/lib/adapters/gateways/mongo/cases.documentdb.repository.ts`
   - **Tests**: `backend/lib/adapters/gateways/mongo/cases.documentdb.repository.test.ts`
   - **Status**: Awaiting integration testing with actual DocumentDB instance

#### ✅ Implemented Query Renderer Architecture

1. **MongoAggregateRenderer** (Base - Cosmos DB RU-based)
   - ✅ Handles all traditional MongoDB aggregation stages
   - ✅ Throws `CamsError` with "Unsupported Operation" for vector search
   - ✅ Clear indication that base renderer doesn't support vector operations
   - **Location**: `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts`

2. **✅ MongoAtlasAggregateRenderer** (extends base)
   - ✅ Renders `$vectorSearch` operator for MongoDB Atlas
   - ✅ Uses `index`, `queryVector`, `numCandidates`, `limit` parameters
   - ✅ All other stages delegated to base renderer
   - **Location**: `backend/lib/adapters/gateways/mongo/utils/mongo-atlas-aggregate-renderer.ts`

3. **✅ MongoDocumentDbAggregateRenderer** (extends base)
   - ✅ Renders `$search.cosmosSearch` operator for Azure DocumentDB / DocumentDB
   - ✅ Uses `vector`, `path`, `k`, `similarity` parameters
   - ✅ All other stages delegated to base renderer
   - **Location**: `backend/lib/adapters/gateways/mongo/utils/mongo-documentdb-aggregate-renderer.ts`

#### ✅ Implemented Adapter Architecture (NEW)

To properly separate renderer concerns, we created renderer-specific collection adapters:

1. **✅ MongoCollectionAdapter** (Base adapter)
   - ✅ Uses base `MongoAggregateRenderer`
   - ✅ No vector search support (by design)
   - **Location**: `backend/lib/adapters/gateways/mongo/utils/mongo-adapter.ts`

2. **✅ MongoAtlasCollectionAdapter** (NEW - extends base)
   - ✅ Uses `MongoAtlasAggregateRenderer` for vector search
   - ✅ Overrides `aggregate()` and `paginate()` methods
   - ✅ Factory method: `newAtlasAdapter()`
   - **Location**: `backend/lib/adapters/gateways/mongo/utils/mongo-atlas-adapter.ts`

3. **✅ MongoDocumentDbCollectionAdapter** (NEW - extends base)
   - ✅ Uses `MongoDocumentDbAggregateRenderer` for vector search
   - ✅ Overrides `aggregate()` and `paginate()` methods
   - ✅ Factory method: `newDocumentDbAdapter()`
   - **Location**: `backend/lib/adapters/gateways/mongo/utils/mongo-documentdb-adapter.ts`

#### Test Results

**All tests passing (18 total):**
```bash
✓ cases.atlas.repository.test.ts (9 tests) 21ms
✓ cases.documentdb.repository.test.ts (9 tests) 19ms

Test Files  2 passed (2)
     Tests  18 passed (18)
```

**Test coverage:**
- ✅ Vector encoding occurs when `predicate.name` is provided
- ✅ Encoding produces 384-dimensional vectors
- ✅ No encoding when name is not provided or empty
- ✅ Fallback behavior when encoding fails
- ✅ Pipeline construction with filters
- ✅ k parameter calculation
- ✅ Traditional search path (no vector encoding)

#### Benefits of This Approach

- ✅ **Separation of Concerns**: Each repository targets specific infrastructure
- ✅ **Open/Closed Principle**: Extended for new capabilities without modifying existing code
- ✅ **Clear Capabilities**: Easy to see which repository supports which features
- ✅ **Zero Risk to Existing**: Current Cosmos DB implementation untouched
- ✅ **Easy Migration**: Switch repositories via configuration, no code changes in use cases
- ✅ **Testability**: Each repository has comprehensive unit tests
- ✅ **Renderer Isolation**: Adapters properly separate renderer concerns

---

## Implementation Steps

### Phase 0: Create Experimental Database (PRECONDITION)

**Purpose:** Set up an isolated testing environment with realistic test data before implementing vector search in the codebase.

#### Why This is First
- Provides a safe environment to test vector search without affecting development data
- Generates test cases with known name patterns for validation
- Includes vector embeddings pre-generated for all test cases
- Allows performance testing and index tuning before production

#### Step 0.1: Ensure Models are Downloaded

Before running the seed script, download the embedding model:

```bash
cd backend
npm install @xenova/transformers
npm run download:models
```

Verify the models directory exists:
```bash
ls -la backend/models/Xenova/all-MiniLM-L6-v2/
```

Should see:
```
tokenizer.json
tokenizer_config.json
config.json
onnx/model.onnx
```

#### Step 0.2: Run the Seed Script

The seed script uses MockData for well-formed documents:

```bash
cd backend

# Set environment variables
export MONGO_CONNECTION_STRING="<your-dev-cosmos-connection-string>"
export EXPERIMENTAL_DATABASE_NAME="cams-vector-experiment"
export NUM_TEST_CASES=500

# Run the seed script
npx tsx scripts/seed-experimental-database.ts
```

**Expected output:**
```
======================================================================
EXPERIMENTAL DATABASE SEEDING SCRIPT (TypeScript)
Using MockData for realistic test cases
======================================================================

Connecting to Cosmos DB...
✓ Connected to Cosmos DB

Loading embedding model (Xenova/all-MiniLM-L6-v2)...
✓ Embedding model loaded

Generating 480 test cases using MockData...
  Generated 50/480 cases with embeddings...
  Generated 100/480 cases with embeddings...
  ...
✓ Generated 480 test cases with MockData

Generating special test cases with known name patterns...
✓ Generated 20 special test cases for validation

Clearing existing SYNCED_CASE documents in cases collection...
✓ Deleted 0 existing documents

Inserting 500 test cases...
  Inserted 100/500 cases...
  Inserted 200/500 cases...
  ...
✓ Successfully inserted 500 test cases

Creating vector index on cases collection...
✓ Vector index created successfully

Verifying seeded data...
✓ Total cases: 500
✓ Cases with keywords: 500
✓ Cases with vectors: 500
✓ Cases with joint debtors: ~150

Sample document:
  Case ID: 081-23-12345
  Chapter: 11
  Division: 081 - Manhattan
  Debtor: John Smith
  Joint Debtor: Jane Smith
  Keywords: ['John Smith', 'Jane Smith']
  Vector dimensions: 384

Special test cases for fuzzy search validation:
  - 091-45-67890: John Smith
  - 081-23-45678: Jon Smith
  - 101-89-01234: John Smyth
  - 111-56-78901: Jonathan Smith

Vector index: ✓ Present
  Type: vector-ivf
  Dimensions: 384
  Similarity: COS

======================================================================
EXPERIMENTAL DATABASE SETUP COMPLETE
======================================================================

Database: cams-vector-experiment
Collection: cases
Test cases: 500 (generated with MockData)

All cases include:
  ✓ Realistic case structure from MockData
  ✓ keywords: [debtor name, joint debtor name]
  ✓ keywordsVector: 384-dimensional embedding
  ✓ Special test cases for fuzzy search validation

Test Name Patterns Included:
  • John Smith / Jon Smith / John Smyth (typos)
  • Michael Johnson / Mike Johnson (nickname)
  • William Brown / Bill Brown (nickname)
  • Elizabeth Wilson / Liz Wilson / Elizabeth Willson (variants)

Next Steps:
  1. Update .env to use experimental database:
     DATABASE_NAME=cams-vector-experiment

  2. Restart your API with experimental database

  3. Test fuzzy name searches:
     GET /api/cases?name=Jon+Smith (should find John Smith)
     GET /api/cases?name=Mike+Johnson (should find Michael Johnson)

  4. Compare with traditional search:
     GET /api/cases (without name parameter)

======================================================================
```

#### Step 0.3: Verify Database Setup

**Check the experimental database:**

```bash
# Using MongoDB shell
mongosh "<connection-string>"

use cams-vector-experiment

// Count documents
db.cases.countDocuments({ documentType: 'SYNCED_CASE' })

// Check a sample with keywords and vector
db.cases.findOne({
  documentType: 'SYNCED_CASE',
  keywords: { $exists: true }
})

// Verify vector dimensions
const doc = db.cases.findOne({ keywordsVector: { $exists: true } })
print("Vector dimensions:", doc.keywordsVector.length)

// Check index
db.cases.getIndexes()
```

**Expected results:**
- Count: 500 documents
- All documents have `keywords` array
- All documents have `keywordsVector` array with 384 elements
- Vector index `keywordsVector_index` exists with `cosmosSearchOptions`

#### Step 0.4: Update Environment Configuration

Create a separate environment configuration for testing:

**File:** `backend/.env.experiment`

```bash
# Copy from .env and modify:
DATABASE_NAME=cams-vector-experiment
MONGO_CONNECTION_STRING=<your-connection-string>

# Keep other settings the same
CAMS_LOGIN_PROVIDER=mock
DATABASE_MOCK=false
# ... other vars
```

**To use experimental database:**
```bash
cd backend
cp .env .env.backup
cp .env.experiment .env
npm start
```

**To restore:**
```bash
cd backend
cp .env.backup .env
```

#### Step 0.5: Document Test Cases

The seed script generates specific test cases for validation. Document these for QA:

**File:** `backend/scripts/TEST_CASES.md`

```markdown
# Vector Search Test Cases

## Exact Match Tests
- Search: "John Smith" → Should find case with debtor "John Smith"
- Search: "Michael Johnson" → Should find case with debtor "Michael Johnson"

## Typo/Spelling Variant Tests
- Search: "Jon Smith" → Should find "John Smith"
- Search: "John Smyth" → Should find "John Smith"
- Search: "Michael Johnston" → Should find "Michael Johnson" (similar)

## Nickname Tests
- Search: "Mike Johnson" → Should find "Michael Johnson"
- Search: "Bill Brown" → Should find "William Brown"
- Search: "Liz Wilson" → Should find "Elizabeth Wilson"

## Partial Name Tests
- Search: "John" → Should return all Johns
- Search: "Smith" → Should return all Smiths

## Joint Debtor Tests
- Search: "Sarah Johnson" → Should find cases where Sarah is joint debtor

## Combined Filters
- Search: "John Smith", Division: 081 → Only Manhattan cases
- Search: "Mike", Chapter: 11 → Only Chapter 11 cases
```

#### Troubleshooting Phase 0

**Issue: "Model not found"**
```bash
# Download models first
cd backend
npm run download:models
ls models/Xenova/all-MiniLM-L6-v2/
```

**Issue: "Connection refused"**
```bash
# Check connection string
echo $MONGO_CONNECTION_STRING

# Test connection
mongosh "$MONGO_CONNECTION_STRING" --eval "db.adminCommand('ping')"
```

**Issue: "Vector index creation failed"**
- Ensure you're using Azure Cosmos DB for MongoDB (vCore)
- Regular MongoDB doesn't support `cosmosSearchOptions`
- Check Cosmos DB tier supports vector search

**Issue: "Embedding generation too slow"**
```bash
# Reduce test case count
export NUM_TEST_CASES=100
npx tsx scripts/seed-experimental-database.ts
```

**Issue: "TypeScript compilation errors"**
```bash
# Install dependencies
cd backend
npm install

# Ensure tsx is available
npx tsx --version
```

---

### Phase 1: Setup Dependencies and Download Models

#### Step 1.1: Install Dependencies

**Backend package:**
```bash
cd backend
npm install @xenova/transformers
```

**Expected package.json addition:**
```json
{
  "dependencies": {
    "@xenova/transformers": "^3.0.0"
  }
}
```

#### Step 1.2: Create Model Download Script

**File:** `backend/scripts/download-models.mjs`

```javascript
#!/usr/bin/env node
import { pipeline, env } from '@xenova/transformers';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure model cache directory
const MODELS_DIR = path.resolve(__dirname, '../models');
env.cacheDir = MODELS_DIR;

// Ensure models directory exists
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

async function downloadModel() {
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
```

Make executable:
```bash
chmod +x backend/scripts/download-models.mjs
```

#### Step 1.3: Update Build Scripts

**File:** `backend/package.json`

```json
{
  "scripts": {
    "build": "npm run build:all",
    "build:all": "npm run download:models && npm run build:api && npm run build:dataflows",
    "build:api": "(cd function-apps/api && npm run build)",
    "build:dataflows": "(cd function-apps/dataflows && npm run build)",
    "download:models": "node scripts/download-models.mjs",
    "test:models": "node scripts/test-local-model.mjs"
  }
}
```

**File:** `backend/function-apps/api/package.json`

```json
{
  "scripts": {
    "build": "npm run build:esbuild && npm run copy:models",
    "build:esbuild": "node esbuild.config.mjs",
    "copy:models": "mkdir -p dist/models && cp -r ../../models/* dist/models/ 2>/dev/null || true",
    "clean": "rm -rf ./dist *.zip"
  }
}
```

#### Step 1.4: Update .gitignore

**File:** `backend/.gitignore`

Add:
```
# Embedding models (downloaded during build)
models/
```

#### Step 1.5: Verify Models Directory Structure

After running `npm run download:models`, you should see:

```
backend/models/
└── Xenova/
    └── all-MiniLM-L6-v2/
        ├── tokenizer.json
        ├── tokenizer_config.json
        ├── config.json
        ├── special_tokens_map.json
        └── onnx/
            └── model.onnx
```

**Total size:** ~25-30 MB

---

### Phase 2: Create Embedding Service

#### Step 2.1: Create Service File

**File:** `backend/lib/services/embedding.service.ts`

```typescript
import { pipeline, Pipeline, env } from '@xenova/transformers';
import { ApplicationContext } from '../adapters/types/basic';
import * as path from 'path';
import * as fs from 'fs';

const MODULE_NAME = 'EMBEDDING-SERVICE';

/**
 * Determine the correct path to the models directory based on environment.
 * Tries multiple locations to support both development and production.
 */
function getModelsPath(): string {
  const possiblePaths = [
    path.join(__dirname, '../../models'),           // Development: backend/lib/services -> backend/models
    path.join(__dirname, '../models'),              // Production: dist/services -> dist/models
    path.join(process.cwd(), 'models'),             // Fallback: root/models
    path.join(process.cwd(), 'dist/models'),        // Fallback: root/dist/models
  ];

  for (const modelsPath of possiblePaths) {
    if (fs.existsSync(modelsPath)) {
      return modelsPath;
    }
  }

  // If no local models found, fall back to download cache (for dev environments)
  return path.join(process.cwd(), '.cache/models');
}

// Configure transformers library to use local models
env.cacheDir = getModelsPath();
env.allowLocalModels = true;      // Allow loading from local cache
env.allowRemoteModels = false;    // Disable downloading in production

/**
 * Singleton service for generating text embeddings using a local transformer model.
 * Uses all-MiniLM-L6-v2 for fast inference with 384-dimensional vectors.
 */
export class EmbeddingService {
  private static instance: EmbeddingService;
  private model: Pipeline | null = null;
  private readonly modelName = 'Xenova/all-MiniLM-L6-v2';
  private initPromise: Promise<void> | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of EmbeddingService.
   */
  public static getInstance(): EmbeddingService {
    if (!EmbeddingService.instance) {
      EmbeddingService.instance = new EmbeddingService();
    }
    return EmbeddingService.instance;
  }

  /**
   * Lazy-load the embedding model on first use.
   * Model is cached in memory after first load.
   */
  private async initialize(context: ApplicationContext): Promise<void> {
    if (this.model) return;

    if (!this.initPromise) {
      this.initPromise = (async () => {
        try {
          const modelsPath = getModelsPath();
          context.logger.info(MODULE_NAME, `Models directory: ${modelsPath}`);
          context.logger.info(MODULE_NAME, `Loading embedding model: ${this.modelName}`);

          const startTime = Date.now();
          this.model = await pipeline('feature-extraction', this.modelName);
          const loadTime = Date.now() - startTime;

          context.logger.info(MODULE_NAME, `Embedding model loaded successfully in ${loadTime}ms`);
        } catch (error) {
          context.logger.error(MODULE_NAME, 'Failed to load embedding model', error);
          this.initPromise = null;
          throw error;
        }
      })();
    }

    await this.initPromise;
  }

  /**
   * Generate a 384-dimensional embedding vector for a single text string.
   *
   * @param context Application context for logging
   * @param text Input text to embed
   * @returns Array of 384 numbers, or null if generation fails
   */
  async generateEmbedding(
    context: ApplicationContext,
    text: string,
  ): Promise<number[] | null> {
    if (!text || text.trim().length === 0) {
      return null;
    }

    try {
      await this.initialize(context);

      const output = await this.model(text, {
        pooling: 'mean',      // Average token embeddings
        normalize: true       // L2 normalization for cosine similarity
      });

      return Array.from(output.data);
    } catch (error) {
      context.logger.error(MODULE_NAME, `Failed to generate embedding for text: ${text}`, error);
      return null;
    }
  }

  /**
   * Generate embedding from multiple keywords by combining them.
   * Keywords are joined with spaces to preserve semantic meaning.
   *
   * @param context Application context for logging
   * @param keywords Array of keyword strings
   * @returns Array of 384 numbers, or null if generation fails
   */
  async generateKeywordsEmbedding(
    context: ApplicationContext,
    keywords: string[],
  ): Promise<number[] | null> {
    if (!keywords || keywords.length === 0) {
      return null;
    }

    // Join keywords with spaces for semantic encoding
    const combinedText = keywords.filter(k => k && k.trim()).join(' ');
    return this.generateEmbedding(context, combinedText);
  }

  /**
   * Extract searchable keywords from case data.
   * Currently extracts debtor and joint debtor names.
   *
   * @param caseData Case data with debtor information
   * @returns Array of keyword strings
   */
  extractCaseKeywords(caseData: {
    debtor?: { name?: string };
    jointDebtor?: { name?: string };
    caseTitle?: string;
  }): string[] {
    const keywords: string[] = [];

    if (caseData.debtor?.name) {
      keywords.push(caseData.debtor.name);
    }

    if (caseData.jointDebtor?.name) {
      keywords.push(caseData.jointDebtor.name);
    }

    // Optional: include case title for additional context
    // if (caseData.caseTitle) {
    //   keywords.push(caseData.caseTitle);
    // }

    return keywords;
  }

  /**
   * Get the dimensions of the embedding vectors produced by this service.
   * Used for validation and index configuration.
   */
  getDimensions(): number {
    return 384; // all-MiniLM-L6-v2 produces 384-dimensional vectors
  }
}

/**
 * Factory function to get the singleton EmbeddingService instance.
 */
export function getEmbeddingService(): EmbeddingService {
  return EmbeddingService.getInstance();
}
```

#### Step 2.2: Create Test Script

**File:** `backend/scripts/test-local-model.mjs`

```javascript
#!/usr/bin/env node
import { pipeline, env } from '@xenova/transformers';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    'John Smythe',  // Similar to "John Smith"
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
```

Make executable:
```bash
chmod +x backend/scripts/test-local-model.mjs
```

**Run tests:**
```bash
cd backend
npm run test:models
```

**Expected output:**
```
Testing local model loading...
Models directory: /path/to/backend/models
✓ Model loaded from local cache in 150ms

Generating embeddings for test names:
  "John Smith": 384 dims in 45ms
  "Jane Doe": 384 dims in 38ms
  "John Smythe": 384 dims in 41ms

✓ All tests passed!
```

---

### Phase 3: Update Data Models

#### Step 3.1: Update SyncedCase Type

**File:** `common/src/cams/cases.ts`

Find the `SyncedCase` type definition and update:

```typescript
export type SyncedCase = DxtrCase &
  Auditable & {
    documentType: 'SYNCED_CASE';
    id?: string;
    keywords?: string[];        // Human-readable keywords for debugging/audit
    keywordsVector?: number[];  // 384-dimensional embedding vector for search
  };
```

#### Step 3.2: Update CasesSearchPredicate

**File:** `common/src/api/search.ts`

Add the `name` field:

```typescript
export type CasesSearchPredicate = SearchPredicate & {
  caseNumber?: string;
  divisionCodes?: string[];
  chapters?: string[];
  assignments?: CamsUserReference[];
  caseIds?: string[];
  excludedCaseIds?: string[];
  excludeMemberConsolidations?: boolean;
  excludeClosedCases?: boolean;
  includeOnlyUnassigned?: boolean;
  name?: string;  // NEW: Fuzzy name search using vector similarity
};
```

---

### Phase 4: Extend Query Infrastructure

#### Step 4.1: Add Vector Search Condition Type

**File:** `backend/lib/query/query-builder.ts`

Update the `Condition` type to include `VECTOR_SEARCH`:

```typescript
export type Condition<T = unknown> = {
  condition:
    | 'EQUALS'
    | 'GREATER_THAN'
    | 'GREATER_THAN_OR_EQUAL'
    | 'CONTAINS'
    | 'LESS_THAN'
    | 'LESS_THAN_OR_EQUAL'
    | 'NOT_EQUALS'
    | 'NOT_CONTAINS'
    | 'EXISTS'
    | 'REGEX'
    | 'VECTOR_SEARCH';  // NEW
  leftOperand: Field<T>;
  rightOperand: unknown;
};
```

#### Step 4.2: Add Vector Search Pipeline Stage

**File:** `backend/lib/query/query-pipeline.ts`

Add the new stage type and builder function:

```typescript
// Add to the type definitions
export type VectorSearch = {
  stage: 'VECTOR_SEARCH';
  vector: number[];
  path: string;
  k: number;
  similarity?: 'COS' | 'IP' | 'L2';
};

// Update the Stage union type
export type Stage<T = never> =
  | Paginate
  | Sort
  | Match
  | Join
  | AddFields<T>
  | ExcludeFields
  | IncludeFields
  | Group
  | VectorSearch;  // NEW

// Add builder function (place with other stage builders)
function vectorSearch(
  vector: number[],
  path: string,
  k: number,
  similarity: 'COS' | 'IP' | 'L2' = 'COS',
): VectorSearch {
  return { stage: 'VECTOR_SEARCH', vector, path, k, similarity };
}

// Add to exports
const QueryPipeline = {
  addFields,
  additionalField,
  ascending,
  count,
  descending,
  exclude,
  first,
  group,
  include,
  join,
  match,
  paginate,
  pipeline,
  sort,
  source,
  vectorSearch,  // NEW
};
```

#### Step 4.3: Add Vector Search Renderer

**File:** `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts`

Add the vector search rendering function:

```typescript
import {
  Accumulator,
  AddFields,
  ExcludeFields,
  Group,
  IncludeFields,
  Join,
  Paginate,
  Pipeline,
  Sort,
  VectorSearch,  // NEW import
} from '../../../../query/query-pipeline';

// Add new rendering function
function toMongoVectorSearch(stage: VectorSearch) {
  return {
    $search: {
      cosmosSearch: {
        vector: stage.vector,
        path: stage.path,
        k: stage.k,
        ...(stage.similarity && { similarity: stage.similarity }),
      },
      returnStoredSource: true,
    },
  };
}

// Update toMongoAggregate to handle the new stage
function toMongoAggregate(pipeline: Pipeline): AggregateQuery {
  return pipeline.stages.map((stage) => {
    if (stage.stage === 'SORT') {
      return toMongoAggregateSort(stage);
    }
    if (stage.stage === 'PAGINATE') {
      return toMongoPaginatedFacet(stage);
    }
    if (stage.stage === 'MATCH') {
      return { $match: toMongoQuery(stage) };
    }
    if (stage.stage === 'JOIN') {
      return toMongoLookup(stage);
    }
    if (stage.stage === 'ADD_FIELDS') {
      return toMongoAddFields(stage);
    }
    if (stage.stage === 'EXCLUDE') {
      return toMongoProjectExclude(stage);
    }
    if (stage.stage === 'INCLUDE') {
      return toMongoProjectInclude(stage);
    }
    if (stage.stage === 'GROUP') {
      return toMongoGroup(stage);
    }
    if (stage.stage === 'VECTOR_SEARCH') {  // NEW
      return toMongoVectorSearch(stage);
    }
  });
}

// Add to exports
const MongoAggregateRenderer = {
  toMongoAggregateSort,
  toMongoLookup,
  toMongoAddFields,
  toMongoAccumulatorOperator,
  toMongoGroup,
  toMongoProjectExclude,
  toMongoProjectInclude,
  toMongoFilterCondition,
  translateCondition,
  toMongoAggregate,
  toMongoVectorSearch,  // NEW
};
```

---

### Phase 5: Integrate into Case Sync Process

#### Step 5.1: Update Export and Load Case

**File:** `backend/lib/use-cases/dataflows/export-and-load-case.ts`

Update the imports and modify the `loadCase` function:

```typescript
import { createAuditRecord } from '@common/cams/auditable';
import { SyncedCase } from '@common/cams/cases';
import { ApplicationContext } from '../../adapters/types/basic';
import { getCamsError, getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getCasesGateway, getCasesRepository } from '../../factory';
import { CaseSyncEvent } from '@common/queue/dataflow-types';
import { getEmbeddingService } from '../../services/embedding.service';  // NEW

const MODULE_NAME = 'EXPORT-AND-LOAD';

async function loadCase(context: ApplicationContext, event: CaseSyncEvent) {
  try {
    const casesRepo = getCasesRepository(context);
    const embeddingService = getEmbeddingService();  // NEW

    // Extract keywords from case data
    const keywords = embeddingService.extractCaseKeywords(event.bCase);

    // Generate vector embedding
    const keywordsVector = await embeddingService.generateKeywordsEmbedding(
      context,
      keywords,
    );

    if (keywordsVector) {
      context.logger.debug(MODULE_NAME,
        `Generated ${keywordsVector.length}-dim vector for case ${event.caseId} with keywords: ${keywords.join(', ')}`
      );
    }

    // Create synced case with keywords and vector
    const synced = createAuditRecord<SyncedCase>({
      ...event.bCase,
      documentType: 'SYNCED_CASE',
      keywords,
      keywordsVector: keywordsVector || undefined,
    });

    await casesRepo.syncDxtrCase(synced);
  } catch (originalError) {
    event.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: {
        message: `Failed to sync DXTR case ${event.caseId}.`,
        module: MODULE_NAME,
      },
    });
  }
  return event;
}

// Keep exportCase and exportAndLoad functions unchanged

const ExportAndLoadCase = {
  exportAndLoad,
  exportCase,
  loadCase,
};

export default ExportAndLoadCase;
```

---

### Phase 6: Implement Vector Search in Repository

#### Step 6.1: Update Cases Mongo Repository

**File:** `backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts`

Add the import and modify the `searchCases` method:

```typescript
import { getEmbeddingService } from '../../../services/embedding.service';  // NEW import
import QueryPipeline, { vectorSearch } from '../../../query/query-pipeline';  // Add vectorSearch

// In the CasesMongoRepository class, update the searchCases method:

async searchCases(predicate: CasesSearchPredicate): Promise<CamsPaginationResponse<SyncedCase>> {
  try {
    if (predicate.includeOnlyUnassigned) {
      return await this.searchForUnassignedCases(predicate);
    }

    const conditions = this.addConditions(predicate);

    if (!hasRequiredSearchFields(predicate)) {
      throw new CamsError(MODULE_NAME, {
        message: 'Case Search requires a pagination predicate with a valid limit and offset',
      });
    }

    const [dateFiled, caseNumber] = source<SyncedCase>().fields('dateFiled', 'caseNumber');

    // NEW: Check if vector search is requested
    if (predicate.name && predicate.name.trim().length > 0) {
      return await this.searchCasesWithVectorSearch(predicate, conditions, dateFiled, caseNumber);
    }

    // Fall back to traditional search
    const spec = pipeline(
      match(and(...conditions)),
      sort(descending(dateFiled), descending(caseNumber)),
      paginate(predicate.offset, predicate.limit),
    );

    return await this.getAdapter<SyncedCase>().paginate(spec);
  } catch (originalError) {
    const error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: {
        message: `Failed to retrieve cases${predicate.caseIds ? ' for ' + predicate.caseIds.join(', ') : ''}.`,
        module: MODULE_NAME,
      },
    });
    throw error;
  }
}

// NEW: Add private method for vector search
private async searchCasesWithVectorSearch(
  predicate: CasesSearchPredicate,
  conditions: ConditionOrConjunction<SyncedCase>[],
  dateFiled: FieldReference<SyncedCase>,
  caseNumber: FieldReference<SyncedCase>,
): Promise<CamsPaginationResponse<SyncedCase>> {
  const embeddingService = getEmbeddingService();

  // Generate query vector from search name
  this.context.logger.debug(MODULE_NAME, `Generating query vector for name: "${predicate.name}"`);
  const queryVector = await embeddingService.generateEmbedding(this.context, predicate.name);

  if (!queryVector) {
    this.context.logger.warn(
      MODULE_NAME,
      'Failed to generate query vector, falling back to traditional search',
    );
    // Fall back to traditional search
    const spec = pipeline(
      match(and(...conditions)),
      sort(descending(dateFiled), descending(caseNumber)),
      paginate(predicate.offset, predicate.limit),
    );
    return await this.getAdapter<SyncedCase>().paginate(spec);
  }

  this.context.logger.debug(MODULE_NAME, `Query vector generated: ${queryVector.length} dimensions`);

  // Build pipeline with vector search AFTER traditional filters
  // Strategy: Pre-filter with traditional conditions, then apply vector search
  const k = Math.max(predicate.limit * 2, 50); // Get more candidates for ranking

  const spec = pipeline(
    match(and(...conditions)),  // Pre-filter with traditional conditions FIRST
    vectorSearch(queryVector, 'keywordsVector', k, 'COS'),  // Cosine similarity search
    sort(descending(dateFiled), descending(caseNumber)),
    paginate(predicate.offset, predicate.limit),
  );

  this.context.logger.debug(MODULE_NAME,
    `Vector search pipeline built: ${conditions.length} filters, k=${k}, limit=${predicate.limit}`
  );

  return await this.getAdapter<SyncedCase>().paginate(spec);
}
```

---

### Phase 7: Configure Azure Cosmos DB Vector Index

#### Step 7.1: Create Index Script

**File:** `backend/scripts/create-vector-index.mjs`

```javascript
#!/usr/bin/env node
import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const COSMOS_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DATABASE_NAME = process.env.DATABASE_NAME || 'cams';
const COLLECTION_NAME = 'cases';

async function createVectorIndex() {
  if (!COSMOS_CONNECTION_STRING) {
    console.error('Error: MONGO_CONNECTION_STRING not set in environment');
    process.exit(1);
  }

  console.log(`Connecting to Cosmos DB...`);
  const client = new MongoClient(COSMOS_CONNECTION_STRING);

  try {
    await client.connect();
    console.log('✓ Connected to Cosmos DB');

    const db = client.db(DATABASE_NAME);
    const collection = db.collection(COLLECTION_NAME);

    console.log(`\nCreating vector index on ${DATABASE_NAME}.${COLLECTION_NAME}...`);

    // Create vector index for keywordsVector field
    const indexSpec = {
      name: 'keywordsVector_index',
      key: {
        keywordsVector: 'cosmosSearch',
      },
      cosmosSearchOptions: {
        kind: 'vector-ivf',    // Inverted File Index (good for most use cases)
        numLists: 100,         // Number of clusters (tune based on dataset size)
        similarity: 'COS',     // Cosine similarity
        dimensions: 384,       // all-MiniLM-L6-v2 dimensions
      },
    };

    await collection.createIndex(
      { keywordsVector: 1 },
      indexSpec
    );

    console.log('✓ Vector index created successfully');
    console.log('\nIndex details:');
    console.log(`  Name: ${indexSpec.name}`);
    console.log(`  Type: ${indexSpec.cosmosSearchOptions.kind}`);
    console.log(`  Dimensions: ${indexSpec.cosmosSearchOptions.dimensions}`);
    console.log(`  Similarity: ${indexSpec.cosmosSearchOptions.similarity}`);

    // List all indexes to verify
    const indexes = await collection.listIndexes().toArray();
    console.log('\nAll indexes on collection:');
    indexes.forEach((idx) => {
      console.log(`  - ${idx.name}`);
    });

  } catch (error) {
    console.error('✗ Error creating vector index:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✓ Connection closed');
  }
}

createVectorIndex().catch(console.error);
```

Make executable:
```bash
chmod +x backend/scripts/create-vector-index.mjs
```

**Run (after deploying to Azure):**
```bash
cd backend
node scripts/create-vector-index.mjs
```

#### Step 7.2: Alternative: Terraform/IaC Configuration

If using Infrastructure as Code, add to your Cosmos DB configuration:

```hcl
# terraform/cosmos-db.tf
resource "azurerm_cosmosdb_mongo_collection" "cases" {
  name                = "cases"
  resource_group_name = azurerm_resource_group.main.name
  account_name        = azurerm_cosmosdb_account.main.name
  database_name       = azurerm_cosmosdb_mongo_database.cams.name

  # ... existing configuration ...

  index {
    keys = ["keywordsVector"]

    # Vector index configuration
    cosmos_search_options {
      kind       = "vector-ivf"
      num_lists  = 100
      similarity = "COS"
      dimensions = 384
    }
  }
}
```

---

### Phase 8: Update Deployment Pipeline

#### Step 8.1: Modify pack.sh

**File:** `backend/pack.sh`

No changes needed if using the `copy:models` approach in api/package.json.

The models will be in `dist/models/` and included automatically.

To verify, check the zip contents:
```bash
cd backend/function-apps/api
npm run build
npm run pack
unzip -l api.zip | grep models
```

Should see:
```
dist/models/Xenova/all-MiniLM-L6-v2/...
```

#### Step 8.2: Update CI/CD Pipeline

**File:** `.github/workflows/backend-build.yml` (or equivalent)

Add model download step:

```yaml
- name: Download embedding models
  working-directory: ./backend
  run: npm run download:models

- name: Build backend
  working-directory: ./backend
  run: npm run build:all

- name: Package API
  working-directory: ./backend/function-apps/api
  run: npm run pack
```

---

## Testing Strategy

### Unit Tests

#### Test 1: EmbeddingService

**File:** `backend/lib/services/embedding.service.test.ts`

```typescript
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { EmbeddingService, getEmbeddingService } from './embedding.service';
import { createMockApplicationContext } from '../testing/mock-context';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockContext: ApplicationContext;

  beforeAll(() => {
    service = getEmbeddingService();
    mockContext = createMockApplicationContext();
  });

  it('should return a singleton instance', () => {
    const instance1 = getEmbeddingService();
    const instance2 = getEmbeddingService();
    expect(instance1).toBe(instance2);
  });

  it('should generate 384-dimensional embeddings', async () => {
    const embedding = await service.generateEmbedding(mockContext, 'John Smith');

    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
    expect(embedding[0]).toBeTypeOf('number');
  });

  it('should return null for empty text', async () => {
    const embedding = await service.generateEmbedding(mockContext, '');
    expect(embedding).toBeNull();
  });

  it('should generate embeddings for keywords', async () => {
    const keywords = ['John Doe', 'Jane Smith'];
    const embedding = await service.generateKeywordsEmbedding(mockContext, keywords);

    expect(embedding).not.toBeNull();
    expect(embedding).toHaveLength(384);
  });

  it('should extract keywords from case data', () => {
    const caseData = {
      debtor: { name: 'John Doe' },
      jointDebtor: { name: 'Jane Doe' },
    };

    const keywords = service.extractCaseKeywords(caseData);

    expect(keywords).toEqual(['John Doe', 'Jane Doe']);
  });

  it('should handle missing debtor names', () => {
    const caseData = { debtor: {} };
    const keywords = service.extractCaseKeywords(caseData);
    expect(keywords).toEqual([]);
  });

  it('should produce similar embeddings for similar names', async () => {
    const embedding1 = await service.generateEmbedding(mockContext, 'John Smith');
    const embedding2 = await service.generateEmbedding(mockContext, 'John Smythe');

    // Cosine similarity function
    const cosineSimilarity = (a: number[], b: number[]) => {
      const dotProduct = a.reduce((sum, val, i) => sum + val * b[i], 0);
      return dotProduct; // Vectors are already normalized
    };

    const similarity = cosineSimilarity(embedding1, embedding2);

    // Similar names should have high similarity (> 0.8)
    expect(similarity).toBeGreaterThan(0.8);
  });
});
```

#### Test 2: Query Pipeline with Vector Search

**File:** `backend/lib/query/query-pipeline.test.ts`

Add test cases:

```typescript
import { describe, it, expect } from 'vitest';
import QueryPipeline from './query-pipeline';

describe('QueryPipeline - Vector Search', () => {
  it('should create vector search stage', () => {
    const vector = new Array(384).fill(0.1);
    const stage = QueryPipeline.vectorSearch(vector, 'keywordsVector', 25, 'COS');

    expect(stage).toEqual({
      stage: 'VECTOR_SEARCH',
      vector,
      path: 'keywordsVector',
      k: 25,
      similarity: 'COS',
    });
  });

  it('should default to cosine similarity', () => {
    const vector = new Array(384).fill(0.1);
    const stage = QueryPipeline.vectorSearch(vector, 'keywordsVector', 25);

    expect(stage.similarity).toBe('COS');
  });
});
```

### Integration Tests

#### Test 3: Case Sync with Vector Embedding

**File:** `backend/lib/use-cases/dataflows/export-and-load-case.test.ts`

Add test:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ExportAndLoadCase from './export-and-load-case';
import { createMockApplicationContext } from '../../testing/mock-context';
import { MockCasesRepository } from '../../testing/mock-gateways/mock-mongo.repository';

describe('ExportAndLoadCase with Vector Embeddings', () => {
  it('should add keywords and vector to synced case', async () => {
    const mockContext = createMockApplicationContext();
    const mockRepo = new MockCasesRepository();

    const syncSpy = vi.spyOn(mockRepo, 'syncDxtrCase');

    const event = {
      type: 'CASE_CHANGED',
      caseId: '101-23-12345',
      bCase: {
        caseId: '101-23-12345',
        debtor: { name: 'John Doe' },
        jointDebtor: { name: 'Jane Doe' },
        // ... other case fields
      },
    };

    await ExportAndLoadCase.loadCase(mockContext, event);

    expect(syncSpy).toHaveBeenCalled();
    const syncedCase = syncSpy.mock.calls[0][0];

    expect(syncedCase.keywords).toEqual(['John Doe', 'Jane Doe']);
    expect(syncedCase.keywordsVector).toBeDefined();
    expect(syncedCase.keywordsVector).toHaveLength(384);
  });
});
```

### End-to-End Tests

#### Test 4: Vector Search Query

**File:** `backend/lib/adapters/gateways/mongo/cases.mongo.repository.test.ts`

```typescript
describe('CasesMongoRepository - Vector Search', () => {
  it('should search cases by name using vector similarity', async () => {
    const context = createMockApplicationContext();
    const repo = CasesMongoRepository.getInstance(context);

    const predicate: CasesSearchPredicate = {
      name: 'John Smith',
      divisionCodes: ['101'],
      limit: 25,
      offset: 0,
    };

    const results = await repo.searchCases(predicate);

    expect(results.data.length).toBeGreaterThan(0);
    expect(results.data[0].keywords).toBeDefined();
  });

  it('should fall back to traditional search if vector generation fails', async () => {
    const context = createMockApplicationContext();
    const repo = CasesMongoRepository.getInstance(context);

    // Mock embedding service to return null
    vi.spyOn(getEmbeddingService(), 'generateEmbedding').mockResolvedValue(null);

    const predicate: CasesSearchPredicate = {
      name: 'John Smith',
      limit: 25,
      offset: 0,
    };

    // Should not throw, should fall back to traditional search
    await expect(repo.searchCases(predicate)).resolves.toBeDefined();
  });
});
```

### Manual Testing Checklist

- [ ] Model downloads successfully with `npm run download:models`
- [ ] Model loads quickly on warm start
- [ ] Test script passes: `npm run test:models`
- [ ] Unit tests pass
- [ ] Case sync adds keywords and vector to documents
- [ ] Vector search returns relevant results
- [ ] Traditional search still works without `name` parameter
- [ ] Fallback to traditional search works if vector generation fails
- [ ] Deployment package includes models in `dist/models/`
- [ ] Azure function starts successfully with bundled model
- [ ] Vector index exists in Cosmos DB
- [ ] Search API returns results within acceptable latency (<1s)

---

## Deployment Guide

### Pre-Deployment

1. **Download models locally:**
   ```bash
   cd backend
   npm run download:models
   ```

2. **Run tests:**
   ```bash
   npm test
   npm run test:models
   ```

3. **Build and package:**
   ```bash
   npm run build:all
   cd function-apps/api
   npm run pack
   ```

4. **Verify package contents:**
   ```bash
   unzip -l api.zip | grep -E "(models|keywordsVector)"
   ```

### Deployment Steps

#### Step 1: Deploy Application Code

```bash
# Using Azure CLI
az functionapp deployment source config-zip \
  --resource-group <resource-group> \
  --name <function-app-name> \
  --src api.zip
```

Or use your existing deployment pipeline.

#### Step 2: Create Vector Index

**Option A: Using script**
```bash
# Set environment variables
export MONGO_CONNECTION_STRING="<cosmos-connection-string>"
export DATABASE_NAME="cams"

# Run index creation script
node backend/scripts/create-vector-index.mjs
```

**Option B: Using Azure Portal**
1. Navigate to Azure Portal → Cosmos DB → Data Explorer
2. Select `cases` collection
3. Go to "Indexes" tab
4. Add new index with vector configuration:
   - Path: `keywordsVector`
   - Type: Vector IVF
   - Dimensions: 384
   - Similarity: Cosine

#### Step 3: Backfill Existing Cases

After deployment, existing cases need vectors generated.

**File:** `backend/scripts/backfill-vectors.mjs`

```javascript
#!/usr/bin/env node
import { MongoClient } from 'mongodb';
import { getEmbeddingService } from '../lib/services/embedding.service.js';
import * as dotenv from 'dotenv';

dotenv.config();

const COSMOS_CONNECTION_STRING = process.env.MONGO_CONNECTION_STRING;
const DATABASE_NAME = process.env.DATABASE_NAME || 'cams';

async function backfillVectors() {
  const client = new MongoClient(COSMOS_CONNECTION_STRING);
  const embeddingService = getEmbeddingService();

  try {
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const collection = db.collection('cases');

    // Find all cases without vectors
    const cases = await collection
      .find({
        documentType: 'SYNCED_CASE',
        keywordsVector: { $exists: false },
      })
      .toArray();

    console.log(`Found ${cases.length} cases to process`);

    let processed = 0;
    for (const bCase of cases) {
      const keywords = [];
      if (bCase.debtor?.name) keywords.push(bCase.debtor.name);
      if (bCase.jointDebtor?.name) keywords.push(bCase.jointDebtor.name);

      if (keywords.length > 0) {
        const vector = await embeddingService.generateKeywordsEmbedding(
          mockContext,
          keywords
        );

        if (vector) {
          await collection.updateOne(
            { _id: bCase._id },
            {
              $set: {
                keywords,
                keywordsVector: vector,
              },
            }
          );
          processed++;
        }
      }

      if (processed % 100 === 0) {
        console.log(`Processed ${processed} / ${cases.length}`);
      }
    }

    console.log(`✓ Backfill complete: ${processed} cases updated`);
  } finally {
    await client.close();
  }
}

backfillVectors().catch(console.error);
```

Run backfill:
```bash
node backend/scripts/backfill-vectors.mjs
```

#### Step 4: Verify Deployment

1. **Check function health:**
   ```bash
   curl https://<function-app-name>.azurewebsites.net/api/health
   ```

2. **Test vector search:**
   ```bash
   curl -X GET "https://<function-app-name>.azurewebsites.net/api/cases?name=John+Smith&divisionCodes=101&limit=10" \
     -H "Authorization: Bearer <token>"
   ```

3. **Check Application Insights:**
   - Look for log messages: "Embedding model loaded successfully"
   - Verify embedding generation is performing well
   - Check for any errors

---

## Performance Considerations

### Optimization Tips

1. **Adjust k parameter:**
   - Higher k = more results, slower search
   - Current: `k = limit * 2`
   - For large datasets, consider: `k = Math.min(limit * 2, 100)`

2. **Index tuning:**
   - `numLists`: Increase for larger datasets (100 → 1000)
   - Use `diskANN` instead of `vector-ivf` for >100K documents

3. **Caching:**
   - Cache common query embeddings (e.g., "John Smith")
   - Consider Redis for distributed caching

4. **Batch operations:**
   - During backfill, process in batches of 100
   - Use bulk write operations

### Monitoring

Add Application Insights metrics:

```typescript
async generateEmbedding(context: ApplicationContext, text: string): Promise<number[] | null> {
  const startTime = Date.now();

  try {
    await this.initialize(context);
    const output = await this.model(text, { pooling: 'mean', normalize: true });

    const duration = Date.now() - startTime;
    context.logger.metric('embedding_generation_duration', duration, {
      text_length: text.length,
    });

    return Array.from(output.data);
  } catch (error) {
    context.logger.error(MODULE_NAME, `Failed to generate embedding`, error);
    return null;
  }
}
```

Monitor these metrics:
- `embedding_generation_duration`: Track embedding generation performance
- `vector_search_duration`: Track vector search performance
- `vector_search_results_count`: Track result quality
- `embedding_model_load_time`: Track model initialization time

---

## Troubleshooting

### Issue: Model not loading

**Symptoms:**
- Error: "Model not found"
- Long startup times
- Downloading model on every request

**Solutions:**
1. Check models directory exists in deployment:
   ```bash
   unzip -l api.zip | grep models
   ```

2. Verify models path:
   ```typescript
   env.cacheDir = getModelsPath();
   console.log('Models path:', env.cacheDir);
   ```

3. Ensure models are copied during build:
   ```bash
   npm run build
   ls -la function-apps/api/dist/models
   ```

### Issue: Vector search returns no results

**Symptoms:**
- Traditional search works
- Vector search returns empty array

**Solutions:**
1. Check vector index exists:
   ```javascript
   db.cases.getIndexes();
   // Should see 'keywordsVector_index'
   ```

2. Verify documents have vectors:
   ```javascript
   db.cases.findOne({ documentType: 'SYNCED_CASE', keywordsVector: { $exists: true } });
   ```

3. Check vector dimensions match:
   ```javascript
   // Should be 384
   db.cases.findOne({ keywordsVector: { $exists: true } }).keywordsVector.length;
   ```

4. Enable debug logging:
   ```typescript
   context.logger.debug(MODULE_NAME, `Query vector: ${queryVector.slice(0, 5)}...`);
   ```

### Issue: Slow performance

**Symptoms:**
- Search takes >2 seconds
- High CPU usage

**Solutions:**
1. Check if model is being loaded multiple times:
   ```typescript
   // Should only see this once per instance
   context.logger.info(MODULE_NAME, 'Embedding model loaded successfully');
   ```

2. Verify pre-filtering is working:
   ```typescript
   context.logger.debug(MODULE_NAME, `Filtering ${totalCases} cases before vector search`);
   ```

3. Tune k parameter:
   ```typescript
   const k = Math.min(predicate.limit * 2, 100); // Cap at 100
   ```

4. Consider index optimization:
   - Increase `numLists` for larger datasets
   - Switch to `diskANN` index type

### Issue: Memory issues

**Symptoms:**
- Out of memory errors
- Function instance crashes

**Solutions:**
1. Ensure model is singleton:
   ```typescript
   private static instance: EmbeddingService;
   ```

2. Check for memory leaks in vector array handling

3. Increase function app memory:
   ```bash
   az functionapp config set \
     --resource-group <rg> \
     --name <app> \
     --max-memory 1024
   ```

### Issue: Deployment package too large

**Symptoms:**
- Deployment fails
- Zip file > 1.5 GB

**Solutions:**
1. Verify only necessary files are included:
   ```bash
   unzip -l api.zip | head -20
   ```

2. Ensure models are not duplicated:
   ```bash
   unzip -l api.zip | grep -c "model.onnx"
   # Should be 1
   ```

3. Use smaller model if needed:
   - Switch to `Xenova/all-MiniLM-L6-v2` (current, 25MB)
   - Or consider `Xenova/paraphrase-MiniLM-L3-v2` (smaller, 17MB)

---

## Next Steps

### Phase 1: Initial Implementation (Current)
- [ ] Set up embedding service
- [ ] Integrate into case sync
- [ ] Add vector search to repository
- [ ] Create vector index
- [ ] Deploy and test

### Phase 2: Optimization
- [ ] Add query embedding caching
- [ ] Tune vector index parameters
- [ ] Optimize k parameter based on usage
- [ ] Add A/B testing for search quality

### Phase 3: Enhanced Features
- [ ] Add relevance scoring
- [ ] Implement hybrid ranking (vector + traditional)
- [ ] Add search analytics
- [ ] Consider additional keyword sources (attorney names, case titles)

### Phase 4: Production Hardening
- [ ] Set up monitoring dashboards
- [ ] Create runbooks for common issues
- [ ] Implement circuit breaker for embedding service
- [ ] Add performance benchmarking

---

## References

### Architecture Decision Record
- [Vector Search for Fuzzy Name Matching ADR](docs/architecture/decision-records/VectorSearchForFuzzyNameMatching.md) - Full rationale and decision context

### Documentation
- [Azure Cosmos DB Vector Search](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/vcore/vector-search)
- [@xenova/transformers](https://huggingface.co/docs/transformers.js)
- [all-MiniLM-L6-v2 Model Card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)

### Related Files
- `backend/lib/services/embedding.service.ts` - Embedding generation
- `backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts` - Vector search implementation
- `backend/lib/use-cases/dataflows/export-and-load-case.ts` - Case sync with vectors
- `backend/lib/query/query-pipeline.ts` - Query DSL with vector search
- `common/src/cams/cases.ts` - Data models
- `common/src/api/search.ts` - Search predicates

### Key Commands
```bash
# Download models
npm run download:models

# Test models
npm run test:models

# Build with models
npm run build:all

# Package for deployment
cd function-apps/api && npm run pack

# Create vector index
node scripts/create-vector-index.mjs

# Backfill existing cases
node scripts/backfill-vectors.mjs
```

---

## Implementation Status (January 2026)

### ✅ Completed: Application Code Implementation

**Date Completed:** January 12, 2026
**Branch:** `CAMS-376-vector-encodings`
**Status:** Code complete, infrastructure pending

All application code for vector search has been successfully implemented and tested locally:

#### Phase 1-3: Core Services ✅
- ✅ `EmbeddingService` created with singleton pattern (`backend/lib/adapters/services/embedding.service.ts`)
  - Model: Xenova/all-MiniLM-L6-v2 (384 dimensions)
  - Fast loading from local cache
  - Fast embedding generation per text
  - Successfully tested with high similarity scores for similar names
- ✅ Data model updates (`common/src/api/search.ts`, `common/src/cams/cases.ts`)
  - Added `name?: string` to `CasesSearchPredicate`
  - Added `keywords?: string[]` and `keywordsVector?: number[]` to `SyncedCase`
- ✅ Test script created and verified (`backend/scripts/test-embedding-service.ts`)

#### Phase 4: Query Builder Infrastructure ✅
- ✅ Added `VectorSearch` type to `backend/lib/query/query-pipeline.ts:94-100`
- ✅ Updated `Stage` union type to include `VectorSearch` (line 138)
- ✅ Created `vectorSearch()` builder function (lines 237-244)
- ✅ Added to QueryPipeline exports (line 262)
- ✅ Implemented `toMongoVectorSearch()` renderer in `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts:37-49`
- ✅ Integrated into `toMongoAggregate()` pipeline renderer (lines 198-200)

#### Phase 6: Repository Implementation ✅
- ✅ Updated `CasesMongoRepository` to use query builder pattern (`backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts:341-400`)
- ✅ Implemented `searchCasesWithVectorSearch()` method with:
  - Embedding generation with fallback to traditional search
  - Hybrid search: vector search → match → sort → paginate
  - Proper pipeline ordering ($search must be first for Cosmos DB)
  - k parameter tuning (2x limit, max 100)
- ✅ Graceful fallback if embedding generation fails

### ⚠️ Blocked: Infrastructure Requirements

**Root Cause:** The existing Cosmos DB instance is **not compatible** with vector search.

#### Current Database Configuration
```bash
# Verified via: az cosmosdb show --name cosmos-mongo-ustp-cams-dev --resource-group bankruptcy-oversight-support-systems
Name: cosmos-mongo-ustp-cams-dev
Type: Azure Cosmos DB for MongoDB (RU-based/Serverless)
Server Version: 7.0
Capabilities: EnableServerless, EnableMongo, EnableMongoRoleBasedAccessControl
```

**Problem:** This is the RU-based Cosmos DB for MongoDB, which does **NOT support** the `$search` stage or vector search capabilities.

#### Required Infrastructure
To complete testing and deployment, the project requires:

**Azure DocumentDB** (NOT RU-based)
- Supports `$search` aggregation stage with `cosmosSearch` operator
- Supports vector indexing on array fields
- Required for all vector similarity operations

### Next Steps to Complete Implementation

---

## Phase 7 (Infrastructure): Provision Azure DocumentDB

**IMPORTANT:** This requires team approval due to cost implications and is a prerequisite for testing the vector search implementation.

### Cost Considerations

**Azure DocumentDB** has different pricing than the current RU-based model:

- **Current (RU-based):** Scales to zero when idle, pay-per-request
- **vCore model:** Always-on compute, charged hourly even when idle
- **Minimum cost:** ~$100-150/month for smallest tier (M25)
- **Recommendation:** Start with M25 tier, single shard, no HA for experimentation

### Option 1: Create New vCore Cluster for Experimentation (Recommended)

This approach creates a separate cluster specifically for testing vector search without impacting existing systems.

#### Step 1: Provision vCore Cluster

**Prerequisites:**
```bash
# Ensure Azure CLI is authenticated to US Government cloud
az cloud show --query name -o tsv
# Expected: AzureUSGovernment

az account show --query "{subscription:name, user:user.name}"
# Verify you have appropriate permissions
```

**Provisioning Command:**
```bash
# Set variables
CLUSTER_NAME="cosmos-vcore-cams-experiment"
RESOURCE_GROUP="bankruptcy-oversight-support-systems"  # Or create new RG
LOCATION="usgovvirginia"  # Match existing resources
ADMIN_USER="camsadmin"
ADMIN_PASSWORD="<generate-secure-password>"  # 16+ chars, mixed case, numbers, symbols

# Install preview extension (first time only)
az extension add --name cosmosdb-preview

# Create vCore cluster (takes 15-30 minutes)
az cosmosdb mongocluster create \
  --cluster-name "${CLUSTER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --location "${LOCATION}" \
  --administrator-login "${ADMIN_USER}" \
  --administrator-login-password "${ADMIN_PASSWORD}" \
  --server-version "7.0" \
  --shard-node-tier "M25" \
  --shard-node-ha false \
  --shard-node-disk-size-gb 32 \
  --shard-node-count 1 \
  --tags "Project=CAMS" "Environment=Experiment" "Feature=VectorSearch"

# Monitor creation status
az cosmosdb mongocluster show \
  --cluster-name "${CLUSTER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "{name:name, state:provisioningState, connectionString:connectionString}" \
  --output table
```

**Expected Output:**
```
Name                              ProvisioningState    ConnectionString
--------------------------------  -------------------  -------------------------------------------------
cosmos-vcore-cams-experiment      Succeeded           mongodb+srv://camsadmin:***@<cluster>.mongodbv...
```

#### Step 2: Configure Firewall Rules

```bash
# Allow Azure services
az cosmosdb mongocluster firewall rule create \
  --cluster-name "${CLUSTER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --rule-name "AllowAzureServices" \
  --start-ip-address "0.0.0.0" \
  --end-ip-address "0.0.0.0"

# Allow your development IP (for local testing)
MY_IP=$(curl -s https://api.ipify.org)
az cosmosdb mongocluster firewall rule create \
  --cluster-name "${CLUSTER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --rule-name "DevelopmentIP" \
  --start-ip-address "${MY_IP}" \
  --end-ip-address "${MY_IP}"

# Verify firewall rules
az cosmosdb mongocluster firewall rule list \
  --cluster-name "${CLUSTER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --output table
```

#### Step 3: Get Connection String

```bash
# Retrieve connection string
CONNECTION_STRING=$(az cosmosdb mongocluster show \
  --cluster-name "${CLUSTER_NAME}" \
  --resource-group "${RESOURCE_GROUP}" \
  --query "connectionString" -o tsv)

echo "Connection String (save securely):"
echo "${CONNECTION_STRING}"

# Format for .env file (replace password placeholder)
echo "MONGO_CONNECTION_STRING=${CONNECTION_STRING/\<password\>/${ADMIN_PASSWORD}}"
```

#### Step 4: Update Environment Configuration

Create experimental environment file:

**File:** `backend/.env.experiment`
```bash
# Azure DocumentDB (with vector search support)
MONGO_CONNECTION_STRING="mongodb+srv://camsadmin:<password>@<cluster>.mongodbv.cosmos.azure.us/cams-vector-experiment?tls=true&authMechanism=SCRAM-SHA-256&retrywrites=false"

# Experimental database name
COSMOS_DATABASE_NAME=cams-vector-experiment
EXPERIMENTAL_DATABASE_NAME=cams-vector-experiment

# Number of test cases to generate
NUM_TEST_CASES=500

# Mock login for testing
CAMS_LOGIN_PROVIDER=mock
DATABASE_MOCK=false

# ADMIN_KEY (get from existing .env or generate new one)
ADMIN_KEY=<your-admin-key>

# Other settings (copy from existing .env as needed)
```

**Usage:**
```bash
# Switch to experimental database
cd backend
cp .env .env.backup
cp .env.experiment .env

# Verify connection
mongo "${MONGO_CONNECTION_STRING//<password>/${ADMIN_PASSWORD}}" --eval "db.adminCommand('ping')"
```

#### Step 5: Seed Experimental Database

**Prerequisites:**
- Models must be downloaded: `cd backend && npm run download:models`
- Verify models exist: `ls backend/models/Xenova/all-MiniLM-L6-v2/`

**Run Seed Script:**
```bash
cd backend

# Set environment variables
export MONGO_CONNECTION_STRING="<from-step-3>"
export EXPERIMENTAL_DATABASE_NAME="cams-vector-experiment"
export NUM_TEST_CASES=500

# Run seed script (takes 5-10 minutes)
npx tsx scripts/seed-experimental-database.ts
```

**Expected Output:**
```
======================================================================
EXPERIMENTAL DATABASE SEEDING SCRIPT (TypeScript)
======================================================================

Connecting to Cosmos DB...
✓ Connected to Cosmos DB

Loading embedding model (Xenova/all-MiniLM-L6-v2)...
✓ Embedding model loaded

Generating 480 test cases using MockData...
  Generated 50/480 cases with embeddings...
  Generated 100/480 cases with embeddings...
  ...
✓ Generated 480 test cases with MockData

Generating special test cases with known name patterns...
✓ Generated 20 special test cases for validation

Clearing existing SYNCED_CASE documents in cases collection...
✓ Deleted 0 existing documents

Inserting 500 test cases...
✓ Successfully inserted 500 test cases

Creating vector index on cases collection...
✓ Vector index created successfully

Verifying seeded data...
✓ Total cases: 500
✓ Cases with keywords: 500
✓ Cases with vectors: 500

Vector index: ✓ Present
  Type: vector-ivf
  Dimensions: 384
  Similarity: COS

======================================================================
EXPERIMENTAL DATABASE SETUP COMPLETE
======================================================================
```

**Troubleshooting Seed Script:**

If you encounter errors:

1. **"Cannot connect to database"**
   ```bash
   # Verify connection string
   echo $MONGO_CONNECTION_STRING

   # Test connection
   mongo "$MONGO_CONNECTION_STRING" --eval "db.adminCommand('ping')"

   # Check firewall rules include your IP
   az cosmosdb mongocluster firewall rule list \
     --cluster-name "${CLUSTER_NAME}" \
     --resource-group "${RESOURCE_GROUP}"
   ```

2. **"Model not found"**
   ```bash
   # Download models
   cd backend
   npm run download:models
   ls models/Xenova/all-MiniLM-L6-v2/
   # Should show: config.json, tokenizer.json, onnx/model.onnx
   ```

3. **"Vector index creation failed"**
   - This is normal if running seed script multiple times
   - Index only needs to be created once
   - Verify: `mongo "$MONGO_CONNECTION_STRING" --eval "db.cases.getIndexes()"`

#### Step 6: Test Vector Search

**Start API with Experimental Database:**
```bash
cd backend/function-apps/api

# Ensure .env.experiment is copied to .env
cp ../../../.env.experiment ../../.env

# Build and start
npm run build
npm start
```

**Test Vector Search Endpoint:**
```bash
# Wait for API to start (look for "Host lock lease acquired")

# Set ADMIN_KEY from your .env file
export ADMIN_KEY=$(grep ADMIN_KEY backend/.env | cut -d'=' -f2)

# Test 1: Search for "John Smith"
curl -s http://localhost:7071/api/cases \
  -X POST \
  -H "Authorization: ApiKey ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","limit":3,"offset":0}' \
  | jq '.data[] | {caseId, debtor: .debtor.name, jointDebtor: .jointDebtor.name}'

# Expected: Should return cases with "John Smith" or similar names

# Test 2: Fuzzy search - typo in name
curl -s http://localhost:7071/api/cases \
  -X POST \
  -H "Authorization: ApiKey ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"Jon Smith","limit":3,"offset":0}' \
  | jq '.data[] | {caseId, debtor: .debtor.name}'

# Expected: Should still find "John Smith" (fuzzy matching)

# Test 3: Combined filters
curl -s http://localhost:7071/api/cases \
  -X POST \
  -H "Authorization: ApiKey ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","divisionCodes":["081"],"limit":3,"offset":0}' \
  | jq '.data[] | {caseId, division: .courtDivisionCode, debtor: .debtor.name}'

# Expected: Only cases from division 081 with similar names
```

**Verify in Logs:**
```bash
# Check API logs for vector search activity
# Should see:
# - "Loading embedding model: Xenova/all-MiniLM-L6-v2"
# - "Embedding model loaded successfully in XXms"
# - "Generating embedding for name: John Smith"
# - "Vector search with k=6, offset=0, limit=3"
# - "Vector search for 'John Smith' returned X results"
```

#### Step 7: Performance Testing

Once basic functionality is verified:

```bash
# Ensure ADMIN_KEY is set (from previous step)
# export ADMIN_KEY=$(grep ADMIN_KEY backend/.env | cut -d'=' -f2)

# Test 1: Measure embedding generation time
# - First request (cold start): Model load + generation
# - Subsequent requests: Generation only (model cached)

# Test 2: Measure end-to-end search latency
time curl -s http://localhost:7071/api/cases \
  -X POST \
  -H "Authorization: ApiKey ${ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","limit":25,"offset":0}' > /dev/null

# Timing will vary based on:
# - Embedding generation (cold start vs cached model)
# - Vector search (depends on k parameter and dataset size)
# - Traditional filters, sorting, and pagination

# Test 3: Verify fallback to traditional search
# (Stop API, break vector index, restart API, test)
```

### Option 2: Migrate Existing Database (NOT Recommended for Initial Testing)

**Why not recommended:**
- Requires downtime for production/dev systems
- No direct migration path from RU-based to vCore
- Would need to export/import all data
- Risk to existing functionality

**If team decides to migrate later:**
1. Create vCore cluster (as above)
2. Use `mongodump` / `mongorestore` to migrate data
3. Update application connection strings
4. Run vector backfill script on migrated data
5. Update infrastructure as code (Terraform/Bicep)

---

## Phase 8: Deploy to Azure (After Infrastructure Provisioned)

Once the vCore cluster is provisioned and tested locally, deploy to Azure:

### Step 1: Update Application Settings

```bash
# Add connection string to Azure Function App
az functionapp config appsettings set \
  --name ustp-cams-node-api \
  --resource-group rg-cams-app \
  --slot development \
  --settings "MONGO_CONNECTION_STRING=<vcore-connection-string>"

# Update database name
az functionapp config appsettings set \
  --name ustp-cams-node-api \
  --resource-group rg-cams-app \
  --slot development \
  --settings "COSMOS_DATABASE_NAME=cams-vector-experiment" # pragma: allowlist secret
```

### Step 2: Deploy Code

The vector search code is already implemented in branch `CAMS-376-vector-encodings`.

```bash
# Deploy via existing pipeline or manual deployment
cd backend/function-apps/api
npm run build
npm run pack

# Deploy to Azure
az functionapp deployment source config-zip \
  --resource-group rg-cams-app \
  --name ustp-cams-node-api \
  --slot development \
  --src api.zip \
  --build-remote false \
  --timeout 600
```

### Step 3: Verify Deployment

```bash
# Check function app logs
az webapp log tail \
  --name ustp-cams-node-api \
  --resource-group rg-cams-app \
  --slot development

# Look for:
# - "Embedding model loaded successfully in XXms"
# - "Vector search for '<name>' returned X results"

# Test endpoint
curl "https://ustp-cams-node-api-development.azurewebsites.us/api/cases" \
  -X POST \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","limit":10,"offset":0}'
```

---

## Files Modified/Created in This Implementation

### ✅ Repository Implementations (NEW)
- `backend/lib/adapters/gateways/mongo/cases.atlas.repository.ts` - **NEW** - MongoDB Atlas repository with $vectorSearch
- `backend/lib/adapters/gateways/mongo/cases.atlas.repository.test.ts` - **NEW** - Comprehensive unit tests (9 tests)
- `backend/lib/adapters/gateways/mongo/cases.documentdb.repository.ts` - **NEW** - Azure DocumentDB repository with $search.cosmosSearch
- `backend/lib/adapters/gateways/mongo/cases.documentdb.repository.test.ts` - **NEW** - Comprehensive unit tests (9 tests)
- `backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts` - **UNCHANGED** - Preserved vanilla implementation

### ✅ Adapter Implementations (NEW)
- `backend/lib/adapters/gateways/mongo/utils/mongo-atlas-adapter.ts` - **NEW** - Atlas-specific collection adapter
- `backend/lib/adapters/gateways/mongo/utils/mongo-documentdb-adapter.ts` - **NEW** - DocumentDB-specific collection adapter
- `backend/lib/adapters/gateways/mongo/utils/mongo-adapter.ts` - **UNCHANGED** - Base adapter preserved

### ✅ Renderer Implementations (NEW)
- `backend/lib/adapters/gateways/mongo/utils/mongo-atlas-aggregate-renderer.ts` - **NEW** - $vectorSearch renderer for Atlas
- `backend/lib/adapters/gateways/mongo/utils/mongo-documentdb-aggregate-renderer.ts` - **NEW** - $search.cosmosSearch renderer for DocumentDB
- `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts` - **MODIFIED** - Added toVectorSearch() that throws error

### ✅ Core Service Files
- `backend/lib/adapters/services/embedding.service.ts` - NEW (from previous implementation)
- `backend/lib/query/query-pipeline.ts` - MODIFIED (added VectorSearch stage)
- `common/src/api/search.ts` - MODIFIED (added name field)
- `common/src/cams/cases.ts` - MODIFIED (added keywords/keywordsVector fields)

### ✅ Test and Script Files
- `backend/scripts/test-embedding-service.ts` - NEW
- `backend/scripts/seed-experimental-database.ts` - EXISTING
- `test/vector-search/docker-compose.local-mongo.yml` - **MOVED** from root

### Configuration Files
- `backend/esbuild-shared.mjs` - MODIFIED (externalized transformer deps)
- `backend/.env.experiment` - NEW (not in git)
- `test/vector-search/README.md` - MODIFIED (updated docker-compose path references)
- `CAMS-376-LOCAL-POC-SUCCESS.md` - MODIFIED (updated docker-compose path)

---

## Summary for Team Discussion

### What's Ready
✅ All application code is complete and follows established patterns
✅ Query builder infrastructure properly extended
✅ Embedding service tested and working with fast model load and embedding generation
✅ Repository implements hybrid search correctly (vector → filter → sort → paginate)
✅ Graceful fallback if embedding generation fails

### What's Blocked
⚠️ Testing requires **Azure DocumentDB** infrastructure

---

## MongoDB Atlas Implementation (January 14, 2026)

### ✅ Completed: Atlas Validation and Alternative Path

**Date Completed:** January 14, 2026
**Status:** Atlas vector search validated, production integration pending

#### Findings: MongoDB Atlas vs Azure DocumentDB

Testing revealed that **MongoDB Atlas uses different syntax** than Azure DocumentDB:
- **Atlas:** Uses `$vectorSearch` operator with `index`, `queryVector`, `numCandidates`, `limit` parameters
- **Azure DocumentDB:** Uses `$search.cosmosSearch` operator with `vector`, `path`, `k` parameters

**Impact:** The current implementation targeting Azure DocumentDB needs Atlas-specific rendering for MongoDB Atlas deployment.

#### Files Created for Atlas Support

**Atlas Repository Implementation:**
- `test/vector-search/cases.atlas.repository.ts` - Repository implementation using Atlas syntax
  - Implements `CasesRepository` interface
  - Uses `$vectorSearch` operator
  - Index name: `vector_index`
  - Successfully tested with real Atlas cluster

**Atlas Query Renderer:**
- `backend/lib/adapters/gateways/mongo/utils/mongo-atlas-aggregate-renderer.ts`
  - Extends base MongoDB aggregate renderer
  - Renders `$vectorSearch` stages for Atlas
  - Converts `k` parameter to `numCandidates` (k × 2) and `limit`
  - Includes required `index` parameter

**Test Scripts:**
- `test/vector-search/test-mongodb-atlas-repository.ts` - Integration tests (✅ ALL PASSING)
- `test/vector-search/seed-mongodb-atlas.ts` - Atlas database seeding script
- `test/vector-search/test-atlas-renderer.ts` - Renderer validation (✅ PASSING)

#### Validation Results

**Test Environment:**
- MongoDB Atlas Free Tier (M0)
- Database: `cams-vector-test`
- Collection: `cases`
- Index: `vector_index` (384 dimensions, cosine similarity)
- Test data: 60 cases with vector embeddings using MockData

**Test Results:**
```
✅ Traditional Search: PASS
   - Found 19 cases in division 081
   - Pagination working correctly

✅ Vector Search: PASS
   - Searching "John" returned 7 results
   - Found "Jon Smith" (typo variant) ✓
   - Found "John Smyth" (spelling variant) ✓

✅ Nickname Matching: PASS
   - Searching "Michael" found "Mike Johnson" ✓

✅ Renderer Validation: PASS
   - Atlas renderer produces correct $vectorSearch syntax
   - Cosmos renderer produces correct $search.cosmosSearch syntax
```

### Next Steps: Production Integration

#### Option 1: Deploy with MongoDB Atlas (Recommended)

**Prerequisites:**
- MongoDB Atlas US Government account (FedRAMP High authorized)
- Production cluster provisioned

**Implementation Steps:**

**Step 1: Update Production Code to Use Atlas Renderer**

The production `CasesMongoRepository` currently uses `mongo-aggregate-renderer.ts` which targets Azure DocumentDB. Update to use Atlas renderer:

**Option A: Conditional renderer based on environment**
```typescript
// backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts

import MongoAggregateRenderer from '../utils/mongo-aggregate-renderer';
import MongoAtlasAggregateRenderer from '../utils/mongo-atlas-aggregate-renderer';

// Determine which renderer to use based on connection string or config
const isAtlas = context.config.mongoConnectionString?.includes('mongodb.net');
const renderer = isAtlas ? MongoAtlasAggregateRenderer : MongoAggregateRenderer;

// Use renderer throughout the repository
const query = renderer.toMongoAggregate(pipeline);
```

**Option B: Environment variable configuration**
```bash
# .env
MONGO_VECTOR_SEARCH_PROVIDER=atlas  # or "cosmos-vcore"
```

```typescript
// backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts
const provider = process.env.MONGO_VECTOR_SEARCH_PROVIDER || 'cosmos-vcore';
const renderer = provider === 'atlas'
  ? MongoAtlasAggregateRenderer
  : MongoAggregateRenderer;
```

**Step 2: Configure Atlas Search Index Name**

Make index name configurable instead of hardcoded:

```typescript
// backend/lib/adapters/gateways/mongo/utils/mongo-atlas-aggregate-renderer.ts

function toMongoAtlasVectorSearch(stage: VectorSearch, indexName?: string) {
  return {
    $vectorSearch: {
      index: indexName || process.env.ATLAS_VECTOR_INDEX_NAME || 'vector_index',
      path: stage.path,
      queryVector: stage.vector,
      numCandidates: stage.k * 2,
      limit: stage.k,
      ...(stage.similarity && { similarity: stage.similarity }),
    },
  };
}
```

**Step 3: Create Atlas Search Index**

Using MongoDB Atlas UI:
1. Navigate to: Database → Browse Collections → Search tab
2. Click "Create Search Index"
3. Select JSON Editor
4. Configuration:
```json
{
  "fields": [
    {
      "type": "vector",
      "path": "keywordsVector",
      "numDimensions": 384,
      "similarity": "cosine"
    }
  ]
}
```
5. Index name: `vector_index`
6. Wait for index to build (typically 1-5 minutes)

**Step 4: Update Connection String**

```bash
# .env or Azure App Settings
MONGO_CONNECTION_STRING="mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<database>?retryWrites=true&w=majority"
MONGO_VECTOR_SEARCH_PROVIDER=atlas
ATLAS_VECTOR_INDEX_NAME=vector_index
```

**Step 5: Deploy and Validate**

```bash
# Build with existing process
cd backend
npm run build:all

# Deploy
cd function-apps/api
npm run pack

# Deploy to Azure (use existing deployment process)
# ...

# Test vector search endpoint
curl -X POST "https://<function-app>.azurewebsites.us/api/cases" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"John Smith","divisionCodes":["081"],"limit":10,"offset":0}'
```

**Step 6: Monitor and Validate**

Check Application Insights for:
- "Embedding model loaded successfully" (should appear once per instance)
- "Vector search for '<name>' returned X results"
- Latency metrics for search operations
- Error rates (should remain low)

#### Option 2: Deploy with Azure DocumentDB

If team decides to use Azure DocumentDB instead:

**Prerequisites:**
- Azure DocumentDB cluster provisioned
- Vector index created with `cosmosSearch` configuration

**Steps:**
1. Follow Phase 7 instructions in this document (lines 2152-2504)
2. Use existing `mongo-aggregate-renderer.ts` (no changes needed)
3. Create vector index using `cosmosSearch` syntax
4. Deploy and test

**Note:** Azure DocumentDB is not currently available in Azure US Government cloud.

### Testing Checklist

Before production deployment:

- [ ] Atlas Search index created and active
- [ ] Environment variables configured (`MONGO_VECTOR_SEARCH_PROVIDER=atlas`)
- [ ] Index name matches configuration
- [ ] Integration tests passing with Atlas connection
- [ ] Traditional search (without name) still works
- [ ] Vector search (with name) returns relevant results
- [ ] Fuzzy matching working (typos, nicknames)
- [ ] Combined filters (name + division + chapter) work correctly
- [ ] Fallback to traditional search if embedding fails
- [ ] Performance acceptable (<1s end-to-end)
- [ ] Application Insights logging working
- [ ] Error handling tested (invalid names, empty results)

### Cost Comparison

**MongoDB Atlas (US Government):**
- Free tier (M0): $0/month (limited to 512MB storage, no SLA)
- M10 (development): ~$60/month
- M30 (production): ~$300/month
- Includes vector search at no additional cost

**Azure DocumentDB:**
- M25 (minimum): ~$154/month
- Always-on compute (no scale-to-zero)
- Currently unavailable in US Government cloud

**Recommendation:** Start with MongoDB Atlas for faster deployment and proven functionality.

---
