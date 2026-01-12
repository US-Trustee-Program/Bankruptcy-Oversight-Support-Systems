# Experimental Database Setup Complete

## Summary

The experimental database (`cams-vector-experiment`) has been successfully set up and is ready for vector search implementation testing.

## What Was Accomplished

### 1. Model Setup
- Installed `@xenova/transformers` dependency
- Downloaded `Xenova/all-MiniLM-L6-v2` model (384 dimensions)
- Created scripts for model download and testing
- Model loads in ~66ms and generates embeddings in 1-3ms
- Total model size: ~23MB

### 2. Database Seeding
- Generated 494 test cases using MockData with realistic data
- Each case includes:
  - `keywords`: Array of searchable terms extracted from case data
  - `keywordsVector`: 384-dimensional embedding for semantic search
- Special test cases created for fuzzy matching validation

### 3. Indexes
- Vector index: `keywordsVector_index` (vector-ivf, cosine similarity, 384 dims)
- Copied 7 standard indexes from dev database:
  - `id_1`
  - `caseId_1`
  - `caseNumber_1`
  - `chapter_1`
  - `courtDivisionCode_1`
  - `documentType_1`
  - `dateFiled_1_caseNumber_1` (composite index for ordering)

### 4. Supporting Data
- Copied 60 supporting documents from dev database:
  - 30 CONSOLIDATION_FROM documents
  - 30 CONSOLIDATION_TO documents
- This enables case management functionality that depends on consolidation data

### 5. API Authentication
- Added ADMIN_KEY authentication bypass in `application-context-creator.ts`
- Allows testing without Okta JWT tokens
- Mock admin session with SuperUser role and Manhattan office access
- **IMPORTANT**: This is temporary for testing - remove before production

## Testing the API

### Authentication
Use the ADMIN_KEY from `.env` with `ApiKey` prefix:

```bash
Authorization: ApiKey 401e5b0e0b0f7ad455a3c133cc9339173c05911903f0b3176f009e4c8da2df2e
```

### Example Query
```bash
curl -s http://localhost:7071/api/cases \
  -X POST \
  -H "Authorization: ApiKey 401e5b0e0b0f7ad455a3c133cc9339173c05911903f0b3176f009e4c8da2df2e" \
  -H "Content-Type: application/json" \
  -d '{"limit":3,"offset":0}'
```

### Sample Response
```json
{
  "caseId": "121-99-93101",
  "debtor": "Nichole Konopelski",
  "keywords": ["Nichole Konopelski"],
  "vectorLength": 384
}
```

## Database Statistics

- **Total SYNCED_CASE documents**: 494
- **Cases with vectors**: 494 (100%)
- **Supporting documents**: 60
- **Vector dimensions**: 384
- **Indexes**: 9 total (1 vector + 7 standard + 1 default _id)

## Environment Configuration

The main `.env` file is configured to use the experimental database:

```bash
COSMOS_DATABASE_NAME=cams-vector-experiment
ADMIN_KEY=401e5b0e0b0f7ad455a3c133cc9339173c05911903f0b3176f009e4c8da2df2e
```

A backup of the original configuration is in `.env.backup`.

## Scripts Created

1. **scripts/download-models.ts** - Downloads embedding model during build
2. **scripts/test-local-model.ts** - Verifies model loads correctly
3. **scripts/seed-experimental-database.ts** - Seeds database with test cases and vectors
4. **scripts/copy-supporting-data.ts** - Copies non-case documents from dev
5. **scripts/copy-indexes.ts** - Copies index definitions from dev

## Next Steps (Phase 1 of Implementation Plan)

Now that the experimental database is ready, you can proceed with:

1. Implementing vector search query functionality
2. Creating relevance scoring algorithms
3. Building hybrid search (traditional + semantic)
4. Testing fuzzy matching with the special test cases
5. Comparing vector search performance vs traditional search

## Files Modified

- `/backend/.env` - Updated to use experimental database
- `/backend/.env.experiment` - Created experimental configuration
- `/backend/.gitignore` - Added `models/` directory
- `/backend/package.json` - Added model download scripts
- `/backend/function-apps/azure/application-context-creator.ts` - Added ADMIN_KEY bypass

## Important Notes

⚠️ **TEMPORARY ADMIN_KEY BYPASS**: The authentication bypass in `application-context-creator.ts` (lines 75-107) is for testing only and must be removed before merging to main or deploying to production.

✅ **Database Isolation**: The experimental database is completely separate from the dev database (`cams`), ensuring testing doesn't affect real data.

✅ **Realistic Data**: All test cases generated using MockData match the structure and patterns of real production data.

## Connection Details

- **Database Name**: `cams-vector-experiment`
- **Collection**: `cases`
- **Connection String**: Same as dev (from MONGO_CONNECTION_STRING env var)
- **Cosmos Endpoint**: https://cosmos-ustp-cams-dev.documents.azure.us:443/
