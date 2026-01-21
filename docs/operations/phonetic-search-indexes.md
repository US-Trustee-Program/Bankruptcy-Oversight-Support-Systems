# Phonetic Search MongoDB Indexes

This document describes the MongoDB indexes required for the phonetic debtor name search feature.

## Overview

The phonetic search feature uses pre-computed phonetic tokens (Soundex and Metaphone algorithms) stored on debtor names to enable fuzzy name matching. To ensure optimal query performance, specific indexes are required on these phonetic token fields.

## Required Indexes

### 1. Debtor Phonetic Tokens Index

**Field**: `debtor.phoneticTokens`
**Type**: Single field index (ascending)
**Purpose**: Enables efficient searches on primary debtor phonetic tokens

```javascript
db.cases.createIndex({ "debtor.phoneticTokens": 1 })
```

### 2. Joint Debtor Phonetic Tokens Index

**Field**: `jointDebtor.phoneticTokens`
**Type**: Single field index (ascending)
**Purpose**: Enables efficient searches on joint debtor phonetic tokens

```javascript
db.cases.createIndex({ "jointDebtor.phoneticTokens": 1 })
```

### 3. Compound Phonetic Tokens Index (Optional)

**Fields**: `debtor.phoneticTokens`, `jointDebtor.phoneticTokens`
**Type**: Compound index (both ascending)
**Purpose**: Optimizes queries that search both debtor and joint debtor simultaneously

```javascript
db.cases.createIndex({
  "debtor.phoneticTokens": 1,
  "jointDebtor.phoneticTokens": 1
})
```

## Index Creation

### Automated Creation (Recommended)

The phonetic token indexes are automatically created when you run the migration script:

```bash
npm run migrate:phonetic-tokens
```

This script will:
1. Process all existing cases in the database
2. Generate phonetic tokens for debtor and joint debtor names
3. Create the required indexes
4. Handle errors gracefully if indexes already exist

### Manual Creation

If you need to create indexes manually, connect to your MongoDB instance and run:

```javascript
// Connect to the database
use your_database_name;

// Create indexes
db.cases.createIndex({ "debtor.phoneticTokens": 1 }, { name: "idx_debtor_phonetic" });
db.cases.createIndex({ "jointDebtor.phoneticTokens": 1 }, { name: "idx_joint_debtor_phonetic" });
db.cases.createIndex(
  {
    "debtor.phoneticTokens": 1,
    "jointDebtor.phoneticTokens": 1
  },
  { name: "idx_compound_phonetic" }
);
```

## Index Verification

### Using the Verification Script

Run the verification script to check index status and performance:

```bash
npm run verify:phonetic-indexes
```

This script will:
- List all indexes on the `cases` collection
- Verify that required phonetic token indexes exist
- Run EXPLAIN queries to show query plans
- Measure query performance metrics
- Display index size statistics

### Manual Verification

You can manually verify indexes exist using MongoDB commands:

```javascript
// List all indexes
db.cases.getIndexes();

// Check specific index
db.cases.getIndexes().filter(idx =>
  Object.keys(idx.key).some(k => k.includes('phoneticTokens'))
);
```

## Query Performance

### Expected Performance Characteristics

With proper indexes in place, phonetic search queries should exhibit:

- **Index Usage**: Queries should use `IXSCAN` (index scan) rather than `COLLSCAN` (collection scan)
- **Query Efficiency**: >90% efficiency ratio (returned documents / examined documents)
- **Execution Time**: <100ms for typical searches (<1000 matching documents)
- **Keys Examined**: Proportional to the number of matching documents

### Example EXPLAIN Output

```javascript
// Query
db.cases.find({
  documentType: "SYNCED_CASE",
  "debtor.phoneticTokens": { $in: ["J500", "JN"] }
}).explain("executionStats");

// Expected output shows:
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "FETCH",
      "inputStage": {
        "stage": "IXSCAN",  // ✅ Using index
        "indexName": "debtor.phoneticTokens_1"
      }
    }
  },
  "executionStats": {
    "executionTimeMillis": 23,    // Fast execution
    "totalDocsExamined": 127,
    "totalKeysExamined": 127,     // Efficient key usage
    "nReturned": 127
  }
}
```

### Performance Without Indexes

If indexes are missing, queries will perform collection scans:

```javascript
{
  "queryPlanner": {
    "winningPlan": {
      "stage": "COLLSCAN"  // ❌ Full collection scan - SLOW!
    }
  },
  "executionStats": {
    "executionTimeMillis": 2340,     // Very slow
    "totalDocsExamined": 150000,     // Examines ALL documents
    "nReturned": 127
  }
}
```

## Query Patterns Using Indexes

### Pattern 1: Search by Primary Debtor

```javascript
db.cases.find({
  documentType: "SYNCED_CASE",
  "debtor.phoneticTokens": { $in: ["J500", "JN", "S530", "SM0"] }
})
```

**Index Used**: `debtor.phoneticTokens_1`

### Pattern 2: Search by Joint Debtor

```javascript
db.cases.find({
  documentType: "SYNCED_CASE",
  "jointDebtor.phoneticTokens": { $in: ["M240", "MKSHL"] }
})
```

**Index Used**: `jointDebtor.phoneticTokens_1`

### Pattern 3: Search Either Debtor (OR Query)

```javascript
db.cases.find({
  documentType: "SYNCED_CASE",
  $or: [
    { "debtor.phoneticTokens": { $in: ["S530", "SM0"] } },
    { "jointDebtor.phoneticTokens": { $in: ["S530", "SM0"] } }
  ]
})
```

**Index Used**: Both `debtor.phoneticTokens_1` and `jointDebtor.phoneticTokens_1` (OR optimization)

### Pattern 4: Combined Search with Other Fields

```javascript
db.cases.find({
  documentType: "SYNCED_CASE",
  caseNumber: { $regex: /^24-/, $options: "i" },
  "debtor.phoneticTokens": { $in: ["J525", "JNSN"] }
})
```

**Index Used**: `debtor.phoneticTokens_1` (phonetic tokens filter applied first, then regex)

## Index Maintenance

### Monitoring Index Size

Phonetic token indexes typically add 5-10% to the total collection size. Monitor index sizes regularly:

```javascript
// Check collection and index statistics
db.cases.stats();
```

### Rebuilding Indexes

If index performance degrades over time, rebuild the indexes:

```javascript
// Rebuild specific index
db.cases.reIndex("debtor.phoneticTokens_1");

// Or rebuild all indexes (use with caution in production)
db.cases.reIndex();
```

### Dropping Indexes

To remove phonetic token indexes (if feature is disabled):

```javascript
db.cases.dropIndex("debtor.phoneticTokens_1");
db.cases.dropIndex("jointDebtor.phoneticTokens_1");
db.cases.dropIndex("idx_compound_phonetic");  // If compound index exists
```

## Troubleshooting

### Index Not Being Used

If queries aren't using the index:

1. **Verify index exists**: Run `db.cases.getIndexes()`
2. **Check query structure**: Ensure `$in` operator is used with phonetic tokens array
3. **Analyze query plan**: Use `.explain("executionStats")` to see why index wasn't selected
4. **Check selectivity**: Very broad queries may cause MongoDB to choose collection scan

### Slow Query Performance

If queries are slow despite indexes:

1. **Check token array size**: Large `$in` arrays (>100 tokens) can be slower
2. **Verify Jaro-Winkler filtering**: Post-query filtering may be bottleneck
3. **Monitor database resources**: Check CPU, memory, and disk I/O
4. **Consider query result size**: Limit results to reasonable page size (default 25)

### Migration Script Failures

If the migration script fails:

1. **Check connection string**: Ensure `MONGO_CONNECTION_STRING` is valid
2. **Verify permissions**: MongoDB user must have `createIndex` privilege
3. **Check disk space**: Index creation requires available disk space
4. **Monitor memory**: Large collections may need batching adjustments

## Related Documentation

- [Phonetic Search Feature](../architecture/phonetic-search.md)
- [Database Schema](../architecture/database-schema.md)
- [Search Performance Tuning](./performance-tuning.md)
- [Migration Scripts](../../scripts/migrations/README.md)

## References

- [MongoDB Indexes Documentation](https://docs.mongodb.com/manual/indexes/)
- [Query Performance Analysis](https://docs.mongodb.com/manual/tutorial/analyze-query-plan/)
- [Index Strategies](https://docs.mongodb.com/manual/applications/indexes/)
