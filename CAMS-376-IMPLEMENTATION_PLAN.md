# Vector Search Implementation Plan for Case Name Fuzzy Matching

**Feature Branch:** `CAMS-376-vector-encodings`
**Date Created:** 2026-01-12
**Status:** Planning Phase

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Technical Decisions](#technical-decisions)
4. [Implementation Steps](#implementation-steps)
5. [Testing Strategy](#testing-strategy)
6. [Deployment Guide](#deployment-guide)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting](#troubleshooting)

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
- **Speed:** ~50-100ms per encoding
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
- [ ] Model loads in <200ms on warm start
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
   - Verify embedding generation times (~50-100ms)
   - Check for any errors

### Rollback Plan

If issues occur:

1. **Disable vector search:**
   - Deploy without vector search code (comment out in repository)
   - Traditional search continues to work

2. **Remove vector index:**
   ```javascript
   db.cases.dropIndex('keywordsVector_index');
   ```

3. **Revert to previous deployment:**
   ```bash
   az functionapp deployment source config-zip \
     --resource-group <rg> \
     --name <app> \
     --src previous-version.zip
   ```

---

## Performance Considerations

### Expected Performance Metrics

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Model load (cold start) | 100-200ms | With bundled model |
| Model load (download) | 2-3 seconds | Without bundled model |
| Text → Vector | 50-100ms | Per embedding |
| Vector search | 100-500ms | Depends on dataset size |
| Total search latency | 200-700ms | Including all overhead |

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
- `embedding_generation_duration`: Should be 50-100ms
- `vector_search_duration`: Should be 100-500ms
- `vector_search_results_count`: Track result quality
- `embedding_model_load_time`: Should be <200ms with bundled model

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

## Contact & Support

For questions or issues with this implementation:
- Review this document first
- Check troubleshooting section
- Consult Application Insights logs
- Review Azure Cosmos DB metrics

**Feature Branch:** `CAMS-376-vector-encodings`
**Last Updated:** 2026-01-12
