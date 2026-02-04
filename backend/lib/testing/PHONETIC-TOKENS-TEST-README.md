# Phonetic Tokens Integration Test

## Overview

This integration test script validates the debtor/joint debtor phonetic token functionality by:
1. Creating synthetic test data in the MongoDB database
2. Testing the backfill use case that populates missing phonetic tokens
3. Validating phonetic search with various name matching scenarios
4. Cleaning up all test data

## Prerequisites

### 1. Environment Setup
- Ensure `backend/.env` contains valid MongoDB connection variables:
  ```
  MONGO_CONNECTION_STRING=mongodb://...
  MONGO_DATABASE_NAME=cams
  ```
- VPN connection required if accessing remote database
- Database user must have INSERT/DELETE permissions on the `cases` collection

### 2. Feature Flag
The test automatically enables the `phonetic-search-enabled` feature flag in the test context.

## Usage

```bash
cd backend
DATABASE_MOCK='false' npx tsx lib/testing/phonetic-tokens-data-synthesis-and-test.ts
```

**Important:** This script requires `DATABASE_MOCK='false'` to connect to the real MongoDB database (not mocked).

## Test Cases

### Test Data Scenarios (14 Cases)

| Test Case | Debtor Name | Joint Debtor | Purpose |
|-----------|-------------|--------------|---------|
| TC-PHON-001 | Jon Snow | - | Phonetic match test (Jon/John) |
| TC-PHON-002 | John Doe | - | Phonetic match test (Jon/John) |
| TC-PHON-003 | Mike Smith | - | Nickname match test (Mike/Michael) |
| TC-PHON-004 | Michael Johnson | - | Nickname match test (Mike/Michael) |
| TC-PHON-005 | Bob Williams | Robert Wilson | Joint debtor nickname match (Bob/Robert) |
| TC-PHON-006 | Patrick O'Brien | - | Special character handling (apostrophe) |
| TC-PHON-007 | Mary Jane Watson | - | Multi-word name handling |
| TC-PHON-008 | Li Wu | - | Short names (2 characters) |
| TC-PHON-009 | Susan Davis | - | Already has tokens (backfill skip) |
| TC-PHON-010 | Richard Parker | - | Control (no match with test queries) |
| TC-PHON-011 | Andy Yang | - | Stop word test - "andy" NOT a stop word |
| TC-PHON-012 | Anderson Malone | - | Stop word test - "anderson" NOT a stop word |
| TC-PHON-013 | King and James | - | Stop word test - "and" IS filtered out |
| TC-PHON-014 | Smith or Co | - | Stop word test - "or"/"co" ARE filtered out |

All cases use:
- Court ID: `081` (New York Southern)
- Division: `081`
- Case ID format: `081-TC-PHON-XXX`
- Date Filed: `2025-01-15`

## Test Sequence

### 1. Data Staging ✓
Creates 14 test cases in MongoDB with various debtor name patterns. Only TC-PHON-009 (Susan Davis) is pre-populated with phonetic tokens.

### 2. Data Verification ✓
Verifies all 14 test cases were successfully inserted into the database.

### 3. Count Cases Needing Backfill ✓
**Expected:** At least 13 cases need backfill (all except TC-PHON-009)

Tests the `BackfillPhoneticTokens.countCasesNeedingBackfill()` method which identifies cases missing phonetic tokens.

### 4. Backfill Tokens ✓
**Expected:** Phonetic tokens successfully generated and stored

Tests the backfill use case:
- `BackfillPhoneticTokens.getPageOfCasesNeedingBackfill(offset, limit)`
- `BackfillPhoneticTokens.backfillTokensForCases(cases)`

Validates that:
- Cases without tokens receive generated tokens
- Tokens include both bigrams (lowercase) and phonetic codes (uppercase)
- Joint debtor tokens are also generated where applicable

### 5. Phonetic Search - Jon/John Match ✓
**Query:** `debtorName: "Jon"`
**Expected:** Both "Jon Snow" (TC-PHON-001) and "John Doe" (TC-PHON-002) found

Tests phonetic matching using Soundex/Metaphone algorithms:
- Jon → J500, JN (phonetic codes)
- John → J500, JN (same phonetic codes)
- Result: Phonetic match despite different spelling

### 6. Nickname Search - Mike/Michael Match ✓
**Query:** `debtorName: "Mike"`
**Expected:** Both "Mike Smith" (TC-PHON-003) and "Michael Johnson" (TC-PHON-004) found

Tests nickname expansion using the `name-match` library:
- Mike search expands to include Michael variants
- Tests `generateQueryTokensWithNicknames()` functionality
- Validates nickname token scoring

### 7. Joint Debtor Search ✓
**Query:** `debtorName: "Robert"`
**Expected:** "Bob Williams / Robert Wilson" (TC-PHON-005) found via joint debtor match

Tests:
- Search across `jointDebtor.phoneticTokens` field
- Joint debtor nickname matching (Bob/Robert)
- Proper scoring of joint debtor matches

### 8. Special Characters Handling ✓
**Query:** `debtorName: "OBrien"`
**Expected:** "Patrick O'Brien" (TC-PHON-006) found

Tests:
- Special character normalization (apostrophes removed during token generation)
- Search works with or without apostrophe
- Phonetic codes ignore special characters

### 9. Stop Word Filtering ✓
**Expected:** Stop words like "and", "or", "co" are excluded from phonetic tokens

Tests four scenarios:
1. **Andy Yang (TC-PHON-011)**: "andy" is NOT a stop word → should have tokens
2. **Anderson Malone (TC-PHON-012)**: "anderson" contains "and" but is NOT a stop word → should have tokens
3. **King and James (TC-PHON-013)**: "and" IS a stop word → only "king" and "james" should have tokens, "and" filtered out
4. **Smith or Co (TC-PHON-014)**: "or" and "co" ARE stop words → only "smith" should have tokens, "or" and "co" filtered out

Validates:
- Names containing stop words (like "andy") are still tokenized
- Substrings of names (like "and" in "anderson") are still tokenized
- Standalone stop words (like "and" in "King and James") are properly excluded
- Multiple stop words in one name are all filtered
- Stop word list includes: and, or, the, of, in, at, to, for, a, an, as, by, inc, llc, ltd, corp, co, company, group, partners, associates

### 10. Cleanup ✓
Deletes all 14 test cases from the database to leave no test artifacts.

## Test Output

### Success Output
```
╔════════════════════════════════════════════════════════════╗
║     Phonetic Tokens - Data Synthesis & Test Suite         ║
╚════════════════════════════════════════════════════════════╝

========================================
STAGING TEST DATA
========================================
Created test case: 081-TC-PHON-001 - Jon Snow
Created test case: 081-TC-PHON-002 - John Doe
...
✓ Test data staged successfully!

========================================
TEST SUMMARY
========================================
Data Staging:              ✓ PASS
Data Verification:         ✓ PASS
Count Cases Need Backfill: ✓ PASS
Backfill Tokens:           ✓ PASS
Phonetic Search (Jon):     ✓ PASS
Nickname Search (Mike):    ✓ PASS
Joint Debtor Search:       ✓ PASS
Special Characters:        ✓ PASS
Stop Word Filtering:       ✓ PASS
========================================

🎉 ALL TESTS PASSED! 🎉
```

### Failure Output
Any test failures will show detailed error messages indicating:
- Which test failed
- Expected vs actual results
- Case IDs that were or weren't found

## What This Test Validates

### Backfill Functionality
- ✅ Correctly identifies cases missing phonetic tokens
- ✅ Generates tokens using `generateSearchTokens()` helper
- ✅ Updates MongoDB documents with new tokens
- ✅ Handles both debtor and joint debtor fields
- ✅ Skips cases that already have tokens

### Search Functionality
- ✅ Phonetic matching (Soundex + Metaphone algorithms)
- ✅ Nickname expansion (Mike→Michael, Bob→Robert, etc.)
- ✅ Bigram matching for substring/typo tolerance
- ✅ Joint debtor field searches
- ✅ Special character normalization
- ✅ Multi-word name handling
- ✅ Short name handling (2 chars)
- ✅ Hybrid scoring with two-layer filtering

### Token Generation
- ✅ Soundex codes (e.g., J500, M240)
- ✅ Metaphone codes (e.g., JN, MKL)
- ✅ Bigrams for substring matching (e.g., jo, oh, hn)
- ✅ Uppercase for phonetic, lowercase for bigrams
- ✅ Deduplication of tokens
- ✅ Stop word filtering (excludes "and", "or", "co", "inc", "llc", etc.)

## Architecture Integration

This test validates the complete phonetic token feature stack:

```
┌─────────────────────────────────────────────────────────────┐
│                     Test Script                             │
│  phonetic-tokens-data-synthesis-and-test.ts                 │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─────────────────────────────────┐
                            ↓                                 ↓
              ┌─────────────────────────┐     ┌─────────────────────────┐
              │  Backfill Use Case      │     │  Search Use Case        │
              │  BackfillPhoneticTokens │     │  CaseManagement         │
              └─────────────────────────┘     └─────────────────────────┘
                            │                                 │
                            ↓                                 ↓
              ┌─────────────────────────────────────────────────────────┐
              │            Phonetic Helper Utilities                    │
              │  - generateSearchTokens()                               │
              │  - generatePhoneticTokens() (Soundex + Metaphone)       │
              │  - generateBigrams()                                    │
              │  - generateQueryTokensWithNicknames()                   │
              └─────────────────────────────────────────────────────────┘
                            │
                            ↓
              ┌─────────────────────────────────────────────────────────┐
              │         Cases Repository (MongoDB)                      │
              │  - createCases()                                        │
              │  - searchCasesWithPhoneticTokens()                      │
              │  - getCaseSummary()                                     │
              │  - deleteCases()                                        │
              └─────────────────────────────────────────────────────────┘
                            │
                            ↓
              ┌─────────────────────────────────────────────────────────┐
              │    MongoDB Aggregation Pipeline Renderer                │
              │  - Hybrid scoring (phonetic + bigram + nickname)        │
              │  - Two-layer filtering (phonetic AND bigram required)   │
              │  - Coverage bonus calculation                           │
              └─────────────────────────────────────────────────────────┘
                            │
                            ↓
              ┌─────────────────────────────────────────────────────────┐
              │              MongoDB Database                           │
              │  Collection: cases                                      │
              │  Document: SYNCED_CASE                                  │
              │    - debtor.phoneticTokens: string[]                    │
              │    - jointDebtor.phoneticTokens: string[]               │
              └─────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Test fails to connect to database
- Verify `.env` has correct MongoDB connection string
- Check VPN connection if accessing remote database
- Ensure `DATABASE_MOCK='false'` is set

### Test cases not found after staging
- Check database permissions (INSERT required)
- Verify MongoDB service is running
- Check for connection timeouts

### Cleanup fails
- Test cases may not exist (already cleaned up)
- Check DELETE permissions on database
- Review logs for specific error messages

### Search tests fail
- Verify `phonetic-search-enabled` feature flag is enabled in context
- Check that backfill test passed (tokens must exist before search)
- Review MongoDB aggregation pipeline renderer for query issues

## Related Files

- **Test Script:** `backend/lib/testing/phonetic-tokens-data-synthesis-and-test.ts`
- **Phonetic Helper:** `backend/lib/adapters/utils/phonetic-helper.ts`
- **Backfill Use Case:** `backend/lib/use-cases/dataflows/backfill-phonetic-tokens.ts`
- **Repository:** `backend/lib/adapters/gateways/mongo/cases.mongo.repository.ts`
- **Pipeline Renderer:** `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts`
- **Type Definitions:** `common/src/cams/parties.ts`
- **Unit Tests:** `backend/lib/adapters/utils/phonetic-helper.test.ts`
- **BDD Tests:** `test/bdd/features/case-management/phonetic-debtor-search.spec.tsx`

## Notes

- This is an **integration test** that requires a real database connection (not mocked)
- Test cases use the `081` court ID (New York Southern) and unique case IDs with `TC-PHON-` prefix
- All test data is cleaned up automatically, even if tests fail
- The script may find additional production cases during backfill count (expected behavior)
- Search results are filtered to only show test cases in output for clarity
