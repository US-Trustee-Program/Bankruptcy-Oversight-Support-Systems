# Phonetic Debtor Name Search - Technical Guide

## Overview

The phonetic debtor name search feature allows USTP staff to find bankruptcy cases even when:

- Names are misspelled ("Smyth" finds "Smith")
- Nicknames are used ("Mike" finds "Michael")
- Phonetic variations exist ("Jon" finds "John")

This guide explains the technical implementation for developers working with this feature.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│  SearchScreen   │────▶│  CaseManagement  │────▶│  CasesRepository    │
│  (React)        │     │  (Use Case)      │     │  (MongoDB Gateway)  │
└─────────────────┘     └──────────────────┘     └─────────────────────┘
                                │                          │
                                ▼                          ▼
                        ┌──────────────────┐     ┌─────────────────────┐
                        │  phonetic-helper │     │  mongo-aggregate-   │
                        │  (Token Gen)     │     │  renderer (SCORE)   │
                        └──────────────────┘     └─────────────────────┘
```

### Key Components

| Component | File | Purpose |
|-----------|------|---------|
| Phonetic Helper | `backend/lib/adapters/utils/phonetic-helper.ts` | Generate tokens (Metaphone, bigrams, nicknames) |
| Query Pipeline | `backend/lib/query/query-pipeline.ts` | Fluent API for SCORE stage construction |
| Mongo Renderer | `backend/lib/adapters/gateways/mongo/utils/mongo-aggregate-renderer.ts` | Translate SCORE to MongoDB aggregation |
| Case Management | `backend/lib/use-cases/cases/case-management.ts` | Orchestrate search with feature flag check |
| Search Screen | `user-interface/src/search/SearchScreen.tsx` | UI component with debtor name field |

## The Scoring Algorithm

### Match Types

The algorithm scores documents using four match types:

| Match Type | Weight | Description |
|------------|--------|-------------|
| Exact Match | 10,000 | Document word equals search word exactly |
| Nickname Match | 1,000 | Document word is a nickname variant |
| Phonetic Match | 100 | Metaphone codes match (only if qualified) |
| Character Prefix | 75 | Search word starts document word |

### How Word-Level Matching Works

1. **Parse names into words**: Split on whitespace and hyphens
   - "Jean-Pierre Smith" becomes `["jean", "pierre", "smith"]`

2. **Calculate match counts**: For each word, count matches against search terms

3. **Apply qualification rules**: Phonetic matches only count if qualified

4. **Sum weighted scores**: Combine all match types into final score

### The Qualification System

Phonetic algorithms are intentionally "lossy" - they group similar-sounding names. This creates false positives when used alone. The qualification system prevents this.

**Phonetic matches only score when accompanied by:**
- Exact match on another word
- Nickname relationship
- Character prefix match
- Similar word length

**Similar Length Rules:**

| Search Length | Document Length | Same Size Class? | Tolerance |
|---------------|-----------------|------------------|-----------|
| ≤4 chars | ≤4 chars | Yes | ±1 char |
| >4 chars | >4 chars | Yes | ±1 char |
| ≤4 chars | >4 chars | No | 0 (exact only) |
| >4 chars | ≤4 chars | No | 0 (exact only) |

**Examples:**

```
✅ GOOD: "Jon" (3) → "John" (4)
   - Both ≤4 chars (same size class)
   - Length diff = 1 (within ±1 tolerance)
   - Phonetic match IS counted

❌ BLOCKED: "Mike" (4) → "Mitchell" (8)
   - Mike ≤4, Mitchell >4 (different size classes)
   - Tolerance = 0 for mixed classes
   - Phonetic match NOT counted

✅ GOOD: "Smyth" (5) → "Smith" (5)
   - Both >4 chars (same size class)
   - Length diff = 0 (within tolerance)
   - Phonetic match IS counted
```

## Token Generation

### Phonetic Algorithms

The `phonetic-helper.ts` module uses the `natural` library for phonetic encoding:

- **Metaphone**: Primary algorithm for phonetic matching (more precise than Soundex)
- **Soundex**: Also generated for backward compatibility

```typescript
import { generatePhoneticTokens } from './phonetic-helper';

generatePhoneticTokens("John Smith");
// Returns: ["J500", "JN", "S530", "SM0"]
//          Soundex  Metaphone  Soundex  Metaphone
```

### Bigrams

Two-character n-grams enable substring/prefix matching:

```typescript
import { generateBigrams } from './phonetic-helper';

generateBigrams("John");
// Returns: ["jo", "oh", "hn"]
```

### Nickname Expansion

The `name-match` library provides nickname relationships:

```typescript
import { generateStructuredQueryTokens } from './phonetic-helper';

const tokens = generateStructuredQueryTokens("Mike Smith");
// tokens.searchWords = ["mike", "smith"]
// tokens.nicknameWords = ["michael", "mikey", "mick", ...]
```

### Combined Tokens

For storage, bigrams and phonetic codes are combined:

```typescript
import { generateSearchTokens } from './phonetic-helper';

generateSearchTokens("John Smith");
// Returns: ["jo", "oh", "hn", "sm", "mi", "it", "th", "J500", "JN", "S530", "SM0"]
//          ^-- bigrams (lowercase) --^            ^-- phonetics (uppercase) --^
```

## MongoDB Pipeline Implementation

The SCORE stage renders to 5 MongoDB `$addFields` stages:

### Stage 1: Parse Names into Words

Splits document names on whitespace and hyphens, converts to lowercase.

```javascript
{ $addFields: {
  _words_0: { /* expression to parse debtor.name */ },
  _words_1: { /* expression to parse jointDebtor.name */ }
}}
```

### Stage 2: Calculate Match Counts

Counts each match type for each target field.

```javascript
{ $addFields: {
  _exactMatches_0: /* count of exact word matches */,
  _nicknameMatches_0: /* count of nickname matches */,
  _phoneticMatches_0: /* count of Metaphone matches */,
  _charPrefixMatch_0: /* 1 if prefix found, 0 otherwise */,
  _similarLengthMatch_0: /* 1 if similar length found, 0 otherwise */
}}
```

### Stage 3: Calculate Per-Target Scores

Applies weights with qualification rule for phonetics.

```javascript
{ $addFields: {
  _score_0: {
    $add: [
      { $multiply: ["$_exactMatches_0", 10000] },
      { $multiply: ["$_nicknameMatches_0", 1000] },
      { $cond: {
        if: { $or: [
          { $gt: ["$_exactMatches_0", 0] },
          { $gt: ["$_nicknameMatches_0", 0] },
          { $gt: ["$_charPrefixMatch_0", 0] },
          { $gt: ["$_similarLengthMatch_0", 0] }
        ]},
        then: { $multiply: ["$_phoneticMatches_0", 100] },
        else: 0
      }},
      { $multiply: ["$_charPrefixMatch_0", 75] }
    ]
  }
}}
```

### Stage 4: Take Max Score

Takes the maximum score across debtor and joint debtor.

```javascript
{ $addFields: {
  nameScore: { $max: ["$_score_0", "$_score_1"] }
}}
```

### Stage 5: Cleanup

Removes temporary fields.

```javascript
{ $project: {
  _words_0: 0, _words_1: 0,
  _exactMatches_0: 0, _nicknameMatches_0: 0, /* etc. */
}}
```

## Feature Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `phonetic-search-enabled` | Enables phonetic scoring and debtor name search field | false |
| `show-debtor-name-column` | Shows debtor name column in search results | false |

## Code Examples

### Generating Tokens for Storage

```typescript
import { generateSearchTokens } from './phonetic-helper';

// When saving a case document
const phoneticTokens = generateSearchTokens(debtor.name);
// Store on case: { debtor: { name, phoneticTokens } }
```

### Building a Search Query with QueryPipeline

```typescript
import QueryPipeline from './query-pipeline';
import { generateStructuredQueryTokens } from './phonetic-helper';

const tokens = generateStructuredQueryTokens("Mike Smith");

const scoreStage = QueryPipeline.score({
  searchWords: tokens.searchWords,
  nicknameWords: tokens.nicknameWords,
  searchMetaphones: tokens.searchMetaphones,
  nicknameMetaphones: tokens.nicknameMetaphones,
  targetNameFields: ["debtor.name", "jointDebtor.name"],
  targetTokenFields: ["debtor.phoneticTokens", "jointDebtor.phoneticTokens"],
  outputField: "nameScore",
});
```

## Troubleshooting

### Search Not Returning Expected Results

1. **Check feature flag**: Ensure `phonetic-search-enabled` is enabled
2. **Verify tokens exist**: Check that `phoneticTokens` array exists on the case document
3. **Run backfill**: If tokens missing, run the `BACKFILL_PHONETIC_TOKENS` dataflow

### Understanding Why a Match Failed

Use the scoring rules to diagnose:

1. Is it an exact match? Check lowercase word equality
2. Is it a nickname? Check if words are in the `name-match` library
3. Is it phonetic? Check if Metaphone codes match AND qualification exists
4. Is it a prefix? Check if search word starts the document word

### Common False Positive Prevention

The qualification system prevents these common false positives:

| Search | Would Match Without Qualification | Blocked By |
|--------|-----------------------------------|------------|
| Mike | Mitchell | Length difference (4 vs 8) |
| Mike | Maxwell | Length difference (4 vs 7) |
| Bill | Bella | No exact, nickname, prefix, or similar length |
| Kris | Cross | Mixed size class (≤4 vs >4) |
