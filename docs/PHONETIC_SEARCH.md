# Phonetic Search for Debtor Names

## Overview

The phonetic search feature enhances the debtor name search functionality by using phonetic matching algorithms to find cases even when there are name variations, nicknames, or common misspellings. This feature builds upon the existing regex-based search and provides more accurate and user-friendly search results.

## Features

### 1. Phonetic Token Generation
- **Soundex Algorithm**: Encodes names based on their pronunciation
- **Metaphone Algorithm**: More sophisticated phonetic encoding for English words
- Pre-computed tokens stored in MongoDB for fast querying

### 2. Nickname Expansion
- Automatically expands common nicknames (e.g., "Mike" → "Michael", "Bob" → "Robert")
- Uses the `name-match` library for comprehensive nickname mappings
- Handles both formal and informal name variations

### 3. Similarity Scoring
- **Jaro-Winkler Algorithm**: Calculates string similarity (0.0 to 1.0)
- Default threshold: 0.83 (configurable)
- Filters out false positives while maintaining high recall
- Supports partial name matching with prefix detection

### 4. Performance Optimizations
- Indexed phonetic tokens in MongoDB for O(log n) lookups
- Result limiting to prevent overwhelming the UI
- Regex fallback for partial matches within phonetic search

## Configuration

### Environment Variables

Phonetic search is controlled by a feature flag. Configure these parameters in your `.env` file:

```bash
# Enable/disable phonetic search feature (default: false)
PHONETIC_SEARCH_ENABLED=true

# Minimum similarity threshold for Jaro-Winkler matching (default: 0.83)
PHONETIC_SIMILARITY_THRESHOLD=0.83

# Maximum number of results to return (default: 100)
PHONETIC_MAX_RESULTS=100

# Enable specific algorithms (default: true for both)
PHONETIC_USE_SOUNDEX=true
PHONETIC_USE_METAPHONE=true
```

## Installation

### 1. Install Dependencies

```bash
cd backend
npm install
```

The following packages will be installed:
- `natural`: Provides phonetic algorithms (Soundex, Metaphone)
- `name-match`: Handles nickname expansion

### 2. Run Database Migration

For existing deployments, run the migration script to add phonetic tokens to existing cases:

```bash
cd backend
npm run migrate:phonetic-tokens
```

The migration script will:
- Process all existing SYNCED_CASE documents
- Generate phonetic tokens for debtor and joint debtor names
- Create MongoDB indexes for optimized querying
- Show progress and summary statistics

### 3. Enable Feature Flag

To enable phonetic search, set the feature flag in your `.env` file:

```bash
PHONETIC_SEARCH_ENABLED=true
```

You can also adjust the similarity threshold or other parameters using environment variables as shown in the Configuration section above.

## Usage Examples

### Search Scenarios

1. **Nickname Matching**
   - Search: "Mike Johnson"
   - Finds: "Michael Johnson", "Mike Johnson", "Mikey Johnson"

2. **Phonetic Similarity**
   - Search: "Jon Smith"
   - Finds: "John Smith", "Jon Smith"
   - Excludes: "Jane Smith" (different phonetic profile)

3. **International Names**
   - Search: "Muhammad"
   - Finds: "Muhammad Ali", "Mohammed Ali", "Mohammad Ali"

4. **Partial Names**
   - Search: "John Sm"
   - Finds: All cases where "John" and "Sm*" match as prefixes

5. **Misspellings**
   - Search: "Micheal"
   - Finds: "Michael" (common misspelling)

## Technical Architecture

### Data Flow

```
User Input
    ↓
Query Expansion (Nicknames)
    ↓
Phonetic Token Generation
    ↓
MongoDB Query (Indexed)
    ↓
In-Memory Filtering (Jaro-Winkler)
    ↓
Sorted Results
```

### MongoDB Schema

```javascript
{
  documentType: "SYNCED_CASE",
  debtor: {
    name: "Michael Johnson",
    phoneticTokens: ["M240", "MXL", "J525", "JNSN"]
  },
  jointDebtor: {
    name: "Sarah Johnson",
    phoneticTokens: ["S600", "SR", "J525", "JNSN"]
  }
}
```

### Indexes

```javascript
// Single field indexes
db.cases.createIndex({ "debtor.phoneticTokens": 1 })
db.cases.createIndex({ "jointDebtor.phoneticTokens": 1 })

// Compound index for better performance
db.cases.createIndex({
  "debtor.phoneticTokens": 1,
  "jointDebtor.phoneticTokens": 1
})
```

## Testing

### Unit Tests

Run the phonetic utilities tests:

```bash
cd backend
npm test -- phonetic-utils.test.ts
```

### BDD Tests

The feature includes comprehensive BDD scenarios:

```bash
cd test/bdd
npm test -- --grep "Phonetic Debtor Name Search"
```

### Manual Testing

1. **Enable phonetic search** in your environment
2. **Create test cases** with various name variations:
   - Michael Johnson
   - Mike Johnson
   - Jon Smith
   - John Smith
3. **Search for variations** and verify results
4. **Test performance** with large datasets

## Performance Considerations

### Query Performance

- **Indexed lookups**: O(log n) complexity
- **Target response time**: < 250ms for 1M cases
- **Result limiting**: Max 100 results by default

### Memory Usage

- **Phonetic tokens**: ~20-40 bytes per name
- **In-memory filtering**: Processes results in batches
- **Caching**: Consider Redis for frequently searched terms (future)

### Scaling

- **Horizontal scaling**: Phonetic tokens replicate with MongoDB
- **Batch processing**: Migration handles millions of records
- **Progressive enhancement**: Falls back to regex if needed

## Troubleshooting

### Common Issues

1. **Phonetic search not working**
   - Verify `PHONETIC_SEARCH_ENABLED=true` is set in .env files
   - Verify migration has been run
   - Check MongoDB indexes exist
   - Ensure phonetic tokens are present in case documents

2. **Too many/few results**
   - Adjust `PHONETIC_SIMILARITY_THRESHOLD`
   - Lower threshold = more results
   - Higher threshold = more precise

3. **Performance issues**
   - Check MongoDB indexes are created
   - Reduce `PHONETIC_MAX_RESULTS`
   - Monitor query execution plans

### Debug Logging

Enable debug logging to see phonetic processing:

```javascript
// In case-management.ts
context.logger.info(MODULE_NAME,
  `Phonetic search: ${results.length} results after filtering`);
```

## Future Enhancements

### Phase 2 Improvements
- [ ] Language-specific phonetic algorithms
- [ ] Machine learning for name matching
- [ ] Redis caching for common searches
- [ ] Fuzzy matching for typos
- [ ] Custom nickname dictionaries

### Phase 3 Features
- [ ] Search history and suggestions
- [ ] Phonetic search for other fields
- [ ] Batch search API
- [ ] Analytics and search metrics

## References

- [Soundex Algorithm](https://en.wikipedia.org/wiki/Soundex)
- [Metaphone Algorithm](https://en.wikipedia.org/wiki/Metaphone)
- [Jaro-Winkler Distance](https://en.wikipedia.org/wiki/Jaro%E2%80%93Winkler_distance)
- [Natural NLP Library](https://github.com/NaturalNode/natural)
- [Name-Match Library](https://www.npmjs.com/package/name-match)
