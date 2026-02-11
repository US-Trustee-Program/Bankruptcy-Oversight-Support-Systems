# Phonetic Debtor Name Search

## Context

USTP staff need to find bankruptcy cases when the debtor's name has variations from what they're searching for. Traditional exact-match search fails for common scenarios:

- Nicknames: Searching "Mike Smith" doesn't find "Michael Smith"
- Phonetic variations: Searching "Jon" doesn't find "John"
- Misspellings: Searching "Smyth" doesn't find "Smith"

A phonetic search solution must balance two competing needs:
1. **Recall** - Find legitimate name variations (Mike should find Michael)
2. **Precision** - Avoid false positives (Mike should NOT find Mitchell or Maxwell)

Standard phonetic algorithms (Soundex, Metaphone) are intentionally "lossy" to group similar-sounding names, but this creates many false positives when used alone.

## Decision

We implement **word-level scoring with qualified phonetic matching**. This approach:

1. Scores each word in the search query against each word in the document
2. Supports multiple match types with weighted scoring
3. **Qualifies** phonetic matches to prevent false positives

### Match Types and Weights

| Match Type | Weight | Description |
|------------|--------|-------------|
| Exact Match | 10,000 | Document word equals search word exactly |
| Nickname Match | 1,000 | Document word is a nickname variant (Mike = Michael) |
| Phonetic Match | 100 | Metaphone codes match (only counted if qualified) |
| Character Prefix | 75 | Search word is a prefix of document word (Jon → Johnson) |

### Qualified Phonetic Matching

Phonetic matches alone would create too many false positives. A phonetic match only contributes to the score when **qualified** by one of:

- **Exact match** on another word in the name
- **Nickname relationship** between words
- **Character prefix match** (search word starts document word)
- **Similar word length** (both ≤4 chars or both >4 chars, with ±1 tolerance)

**Examples:**

| Search | Document | Result | Reason |
|--------|----------|--------|--------|
| Mike | Michael | Match (1000) | Nickname relationship |
| Jon | John | Match (100) | Phonetic qualified by similar length (3 vs 4) |
| Jon | Johnson | Match (75) | Character prefix ("jon" starts "johnson") |
| Smyth | Smith | Match (100) | Phonetic qualified by same length (both 5) |
| Mike | Mitchell | No Match | Lengths differ (4 vs 8), no qualification |
| Mike | Maxwell | No Match | Not a prefix, lengths differ, no nickname |

### Pre-computed Tokens

Phonetic tokens are stored on each case document for efficient querying:

- `debtor.phoneticTokens` and `jointDebtor.phoneticTokens` arrays
- Contain both bigrams (lowercase) for substring matching and Metaphone codes (uppercase) for phonetic matching
- Enables index-backed pre-filtering before expensive scoring operations

### Feature Flags

| Flag | Purpose |
|------|---------|
| `phonetic-search-enabled` | Enables phonetic scoring in search queries and debtor name field in UI |
| `show-debtor-name-column` | Shows debtor name column in search results table |

## Status

Accepted

## Consequences

### Benefits

- **High recall**: Finds legitimate name variations (nicknames, phonetic similarities, prefixes)
- **High precision**: Qualified phonetics prevent common false positives
- **Performance**: Pre-computed tokens enable index-backed pre-filtering
- **Flexibility**: Scoring weights are configurable via QueryPipeline

### Trade-offs

- **Storage overhead**: Additional `phoneticTokens` field on every case document
- **Migration required**: Existing cases need backfill via `BACKFILL_PHONETIC_TOKENS` dataflow
- **Nickname coverage**: Limited to variations in the `name-match` library
- **Feature flag dependency**: Requires flags to be enabled for functionality
