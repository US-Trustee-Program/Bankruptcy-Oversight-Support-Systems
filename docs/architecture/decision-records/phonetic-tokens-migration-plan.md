# Data Migration Plan: Add Phonetic Tokens to Existing Cases

## Overview
Create a data migration script to add phonetic tokens to all existing SYNCED_CASE documents in the database. This migration supports the debtor name search feature from PR #1857 by backfilling the `debtor.phoneticTokens` and `jointDebtor.phoneticTokens` fields on existing cases.

## Approach Decision

### Recommended: Dataflow-Based Migration
Create a dataflow migration following the existing patterns in the codebase (like `migrate-childcases-to-membercases.ts`). This approach provides:
- Azure Function infrastructure integration
- Built-in error handling and logging to Application Insights
- Queue-based processing for scalability
- Consistent with other CAMS migrations

### Alternative: Script-Based Migration
A standalone script could be created in `/backend/scripts/migrations/` but this is less integrated with the existing infrastructure.

## Implementation Steps

### Step 1: Create the Use Case Layer
**File:** `/backend/lib/use-cases/dataflows/migrate-phonetic-tokens.ts`

This file will contain the business logic:
- Query for SYNCED_CASE documents without phoneticTokens
- Generate tokens using `generateSearchTokens()` from phonetic-helper
- Update documents in batches of 100
- Track progress and report statistics

**Key functions:**
- `migratePhoneticTokens(context)` - Main migration logic
- `processPhoneticTokenBatch(cases)` - Batch processing
- `verifyMigration()` - Post-migration verification

### Step 2: Create the Azure Function Handler
**File:** `/backend/function-apps/dataflows/migrations/migrate-phonetic-tokens.ts`

Structure following the pattern from `migrate-childcases-to-membercases.ts`:
- Simple start function that triggers the migration
- Error handling with HARD_STOP queue for failures
- Logging and monitoring integration

### Step 3: Register the Dataflow
**File:** `/backend/function-apps/dataflows/dataflows.ts`

Add the new migration to the dataflow registry:
```typescript
import MigratePhoneticTokens from './migrations/migrate-phonetic-tokens';
// ...
dataflows.register(
  // ... existing dataflows
  MigratePhoneticTokens,
);
```

### Step 4: Create Tests
**Files:**
- `/backend/lib/use-cases/dataflows/migrate-phonetic-tokens.test.ts`
- Test the migration logic with mock data
- Verify token generation accuracy
- Test error handling scenarios

### Step 5: Create MongoDB Indexes
After migration, ensure these indexes exist:
- `{ 'debtor.phoneticTokens': 1 }`
- `{ 'jointDebtor.phoneticTokens': 1 }`
- Compound index for search performance

## Migration Logic Details

### Query Strategy
```typescript
// Find cases without phonetic tokens
const query = and(
  doc('documentType').equals('SYNCED_CASE'),
  or(
    doc('debtor.phoneticTokens').notExists(),
    doc('jointDebtor.phoneticTokens').notExists()
  )
);
```

### Token Generation
```typescript
// For each case, generate tokens if missing
if (caseDoc.debtor?.name && !caseDoc.debtor.phoneticTokens) {
  updates['debtor.phoneticTokens'] = generateSearchTokens(caseDoc.debtor.name);
}
if (caseDoc.jointDebtor?.name && !caseDoc.jointDebtor.phoneticTokens) {
  updates['jointDebtor.phoneticTokens'] = generateSearchTokens(caseDoc.jointDebtor.name);
}
```

### Batch Processing
- Process in batches of 100 cases
- Use MongoDB bulkWrite for efficiency
- Log progress after each batch
- Handle errors gracefully with retry logic

## Using the CAMS Dataflow Scaffold

The user mentioned using `/cams-dataflow-scaffold` - this is a skill available in Claude Code. To use it:

1. Invoke the skill with: `/cams-dataflow-scaffold`
2. Follow the guided workflow to create the migration files
3. The skill will generate boilerplate code following CAMS patterns

## Verification Plan

### Pre-Migration
1. Count total SYNCED_CASE documents
2. Count cases without phoneticTokens
3. Estimate processing time

### Post-Migration
1. Verify all cases have tokens where debtor/jointDebtor names exist
2. Sample token verification (manually check a few cases)
3. Test search functionality with phonetic variations
4. Monitor query performance

### Success Criteria
- 100% of cases with debtor names have phoneticTokens
- 100% of cases with jointDebtor names have jointDebtor.phoneticTokens
- Search queries using phonetic tokens return expected results
- No performance degradation

## Configuration

### Environment Variables
Add to `CAMS_ENABLED_DATAFLOWS`:
```
MIGRATE_PHONETIC_TOKENS
```

### Feature Flag
The phonetic search feature is controlled by the `phonetic-search-enabled` flag in LaunchDarkly.

## Rollback Strategy

If issues occur:
1. Disable the dataflow via environment variable
2. Remove phoneticTokens using reverse update query if needed:
   ```typescript
   { $unset: { 'debtor.phoneticTokens': '', 'jointDebtor.phoneticTokens': '' } }
   ```
3. Investigate and fix issues before re-running

## Timeline

1. **Development**: Create migration files and tests
2. **Testing**: Run in local/staging environment
3. **Staging Deployment**: Test with production-like data
4. **Production Deployment**: Run during maintenance window
5. **Verification**: Confirm all cases migrated successfully

## Notes

- The migration is idempotent - safe to run multiple times
- New cases automatically get phoneticTokens via `ExportAndLoadCase.addPhoneticTokens()`
- The `generateSearchTokens()` function creates both bigrams (lowercase) and phonetic codes (uppercase)
- Token format example: "John Smith" → ["jo", "oh", "hn", "sm", "mi", "it", "th", "J500", "JN", "S530", "SM0"]