# Database Migration Scripts

This directory contains MongoDB migration scripts for the CAMS system.

## Available Migrations

### Phonetic Tokens Migration

**Script**: `add-phonetic-tokens.ts`

Adds phonetic tokens to existing cases in MongoDB for fuzzy name searching.

**What it does**:
1. Processes all `SYNCED_CASE` documents in batches
2. Generates phonetic tokens (Soundex + Metaphone) for debtor and joint debtor names
3. Updates documents with the new `phoneticTokens` field
4. Creates indexes on `debtor.phoneticTokens` and `jointDebtor.phoneticTokens`

**Usage**:
```bash
# From project root
npm run migrate:phonetic-tokens

# Or from backend directory
cd backend
npm run migrate:phonetic-tokens
```

**Required Environment Variables**:
- `MONGO_CONNECTION_STRING`: MongoDB connection string
- `COSMOS_DATABASE_NAME`: Database name

**Example**:
```bash
export MONGO_CONNECTION_STRING="mongodb://localhost:27017"
export COSMOS_DATABASE_NAME="cams"
npm run migrate:phonetic-tokens
```

**Output**:
```
🔄 Starting phonetic tokens migration...
📊 Database: cams
✅ Connected to MongoDB
📁 Found 12,345 cases to process
📝 Batch 1: Updated 1000 documents
⏳ Progress: 1000/12345 (8%)
...
📊 Migration Summary:
   Total cases processed: 12345
   Cases updated: 12000
   Cases skipped (already migrated): 345

🔨 Creating indexes for phonetic search...
✅ Created index on debtor.phoneticTokens
✅ Created index on jointDebtor.phoneticTokens
✅ Created compound index on phonetic tokens

✅ Migration completed successfully!
```

### Phonetic Indexes Verification

**Script**: `verify-phonetic-indexes.ts`

Verifies that phonetic search indexes exist and measures their performance.

**What it does**:
1. Lists all indexes on the `cases` collection
2. Verifies required phonetic token indexes exist
3. Runs EXPLAIN queries to show query execution plans
4. Measures query performance metrics
5. Displays index size statistics

**Usage**:
```bash
# From project root
npm run verify:phonetic-indexes

# Or from backend directory
cd backend
npm run verify:phonetic-indexes
```

**Required Environment Variables**:
- `MONGO_CONNECTION_STRING`: MongoDB connection string
- `COSMOS_DATABASE_NAME`: Database name

**Example Output**:
```
🔍 Phonetic Search Index Verification
============================================================
📊 Database: cams

✅ Connected to MongoDB

📋 Checking indexes on cases collection...

Found indexes:
  - _id_: { _id }
  - debtor.phoneticTokens_1: { debtor.phoneticTokens }
  - jointDebtor.phoneticTokens_1: { jointDebtor.phoneticTokens }
  - debtor.phoneticTokens_1_jointDebtor.phoneticTokens_1: { debtor.phoneticTokens, jointDebtor.phoneticTokens }

✅ Required Index Status:
  ✅ EXISTS: debtor.phoneticTokens
  ✅ EXISTS: jointDebtor.phoneticTokens

📈 Index Statistics

Collection: cases
  Total Documents: 12345
  Total Size: 145.32 MB
  Index Count: 8
  Total Index Size: 23.45 MB

  Individual Index Sizes:
    _id_: 245.12 KB
    debtor.phoneticTokens_1: 512.34 KB
    jointDebtor.phoneticTokens_1: 387.56 KB
    ...

📊 Testing Phonetic Search Performance
============================================================

🔍 EXPLAIN: Search debtor by phonetic tokens (John)
   Query: {"documentType":"SYNCED_CASE","debtor.phoneticTokens":{"$in":["J500","JN"]}}

   Query Plan:
     Stage: FETCH
     Input Stage: IXSCAN
     ✅ Using Index: debtor.phoneticTokens_1

   Execution Stats:
     Execution Time: 23ms
     Documents Examined: 127
     Keys Examined: 127
     Documents Returned: 127
     Query Efficiency: 100.00%
     ✅ Excellent efficiency!

============================================================
✅ Verification completed successfully!
============================================================
```

## Prerequisites

### Node.js and Dependencies

Ensure you have Node.js installed and all dependencies:

```bash
npm install
```

### MongoDB Access

You need:
- Valid MongoDB connection string
- Database user with read/write permissions
- Database user with `createIndex` permission for migrations

### Environment Variables

Create a `.env` file in the project root or export environment variables:

```bash
# .env file
MONGO_CONNECTION_STRING=
COSMOS_DATABASE_NAME=
```

## Running Migrations

### Local Development

```bash
# 1. Set environment variables
export MONGO_CONNECTION_STRING=
export COSMOS_DATABASE_NAME=

# 2. Run migration
npm run migrate:phonetic-tokens

# 3. Verify indexes
npm run verify:phonetic-indexes
```

### Production Deployment

```bash
# 1. Load production environment variables
source /path/to/production/.env

# 2. Run migration with logging
npm run migrate:phonetic-tokens 2>&1 | tee migration-$(date +%Y%m%d-%H%M%S).log

# 3. Verify indexes
npm run verify:phonetic-indexes
```

## Safety Considerations

### Backup Before Migration

**Always** create a backup before running migrations:

```bash
# MongoDB backup example
mongodump --uri="$MONGO_CONNECTION_STRING" --out=backup-$(date +%Y%m%d)
```

### Idempotency

Both scripts are idempotent:
- **Migration script**: Skips documents that already have phonetic tokens
- **Index creation**: Handles existing indexes gracefully

You can safely run them multiple times.

### Performance Impact

Migrations process data in batches to minimize memory usage and maintain database performance during operation.

**Recommendations**:
- Run during low-traffic periods
- Monitor database CPU and memory usage
- Adjust batch size if needed (default: 1000 documents)

### Rollback

If you need to rollback the migration:

```javascript
// Remove phonetic tokens from all documents
db.cases.updateMany(
  { documentType: "SYNCED_CASE" },
  {
    $unset: {
      "debtor.phoneticTokens": "",
      "jointDebtor.phoneticTokens": ""
    }
  }
);

// Drop indexes
db.cases.dropIndex("debtor.phoneticTokens_1");
db.cases.dropIndex("jointDebtor.phoneticTokens_1");
```

## Troubleshooting

### Connection Issues

```
ERROR: Failed to connect to MongoDB
```

**Solution**: Verify connection string and network access:
```bash
# Test connection with mongo shell
mongosh "$MONGO_CONNECTION_STRING"
```

### Permission Issues

```
ERROR: User is not authorized to perform action [createIndex]
```

**Solution**: Ensure MongoDB user has required permissions:
```javascript
db.grantRolesToUser("username", [{ role: "readWrite", db: "cams" }])
```

### Memory Issues

```
ERROR: JavaScript heap out of memory
```

**Solution**: Increase Node.js memory limit:
```bash
NODE_OPTIONS="--max-old-space-size=4096" npm run migrate:phonetic-tokens
```

Or reduce batch size in the script.

### Performance Degradation

If migration is very slow:

1. **Check database load**: Use `db.currentOp()` to see active operations
2. **Reduce batch size**: Edit script to use smaller batches (e.g., 500 instead of 1000)
3. **Schedule during off-hours**: Run when database usage is low

## Support

For issues or questions:
- Create an issue in the repository
- Contact the backend development team
- Review logs at `migration-YYYYMMDD-HHMMSS.log`

## Related Documentation

- [Phonetic Search Indexes Documentation](../../../docs/operations/phonetic-search-indexes.md)
- [Database Operations Guide](../../../docs/operations/README.md)
- [Architecture Documentation](../../../docs/architecture/README.md)
