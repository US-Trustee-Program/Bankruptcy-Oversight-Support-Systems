# Testing Trustee Migration Locally

This guide explains how to test the trustee profile migration from ATS to CAMS locally.

## Prerequisites

1. **VPN Connection**: Connect to the USTPBNC VPN to access the Azure SQL databases
2. **Environment Variables**: Ensure your `.env` file has the ATS database configuration:
   ```
   ATS_MSSQL_HOST=sql-ustp-cams.database.usgovcloudapi.net
   ATS_MSSQL_DATABASE=ATS_REP_SUB
   ATS_MSSQL_USER=CloudSA32e9dec1
   ATS_MSSQL_PASS=<password>
   ATS_MSSQL_ENCRYPT=true
   ATS_MSSQL_TRUST_UNSIGNED_CERT=true
   ```

3. **MongoDB**: Ensure MongoDB is running locally or you have a connection string in your `.env`:
   ```
   MONGO_CONNECTION_STRING=mongodb://localhost:27017/cams-local
   ```

## Testing Methods

### Method 1: Using the Test Script (Recommended)

A test script is provided at `backend/scripts/test-trustee-migration-local.ts` for easy testing:

```bash
# Test database connection
npx tsx scripts/test-trustee-migration-local.ts test

# Preview first 10 trustees without migrating
npx tsx scripts/test-trustee-migration-local.ts preview 10

# Check current migration state
npx tsx scripts/test-trustee-migration-local.ts state

# Run a migration batch of 50 trustees
npx tsx scripts/test-trustee-migration-local.ts run 50

# Reset migration to start over
npx tsx scripts/test-trustee-migration-local.ts reset
```

#### Testing Workflow

1. **Test Connection First**:
   ```bash
   npx tsx scripts/test-trustee-migration-local.ts test
   ```
   This verifies you can connect to the ATS database and shows the total trustee count.

2. **Preview Data**:
   ```bash
   npx tsx scripts/test-trustee-migration-local.ts preview 10
   ```
   This shows you sample trustee data with their appointments without actually migrating.

3. **Run Migration in Batches**:
   ```bash
   # Run small batch first
   npx tsx scripts/test-trustee-migration-local.ts run 10

   # Check state
   npx tsx scripts/test-trustee-migration-local.ts state

   # Continue with larger batches
   npx tsx scripts/test-trustee-migration-local.ts run 100
   ```

4. **Reset if Needed**:
   ```bash
   npx tsx scripts/test-trustee-migration-local.ts reset
   ```

### Method 2: Using Azure Functions Runtime

You can also test using the Azure Functions runtime locally:

1. **Build the Functions**:
   ```bash
   npm run build:dataflows
   ```

2. **Start the Functions Runtime**:
   ```bash
   npm run start:dataflows
   ```
   This will start the Azure Functions runtime on port 7072.

3. **Trigger the Migration**:
   ```bash
   curl -X POST http://localhost:7072/api/migrate-trustees \
     -H "Content-Type: application/json" \
     -d '{}'
   ```

4. **Monitor Progress**:
   - Check the terminal running the Functions for log output
   - Use the test script to check state:
     ```bash
     npx tsx scripts/test-trustee-migration-local.ts state
     ```

### Method 3: Running Tests

Run the unit tests for the migration logic:

```bash
# Run all migration tests
npm test -- lib/use-cases/dataflows/migrate-trustees.test.ts

# Run with coverage
npm test -- --coverage lib/use-cases/dataflows/migrate-trustees.test.ts
```

## Monitoring Migration Progress

### Check Migration State

The migration maintains state in MongoDB for resumability:

```bash
npx tsx scripts/test-trustee-migration-local.ts state
```

This shows:
- Current status (IN_PROGRESS, COMPLETED, FAILED)
- Number of trustees processed
- Number of appointments processed
- Number of errors
- Last processed trustee ID

### View Migrated Data in MongoDB

You can use MongoDB Compass or the mongo shell to view migrated data:

```javascript
// Connect to MongoDB
use cams-local

// Check migration state
db['runtime-state'].findOne({ _id: 'TRUSTEE_MIGRATION_STATE' })

// View migrated trustees
db.trustees.find().limit(5)

// Count migrated trustees
db.trustees.countDocuments()
```

## Migration Features

### Resumability

The migration is designed to be resumable:
- State is saved after each batch
- If interrupted, it resumes from the last successful trustee ID
- No duplicate processing of trustees

### Error Handling

- Individual trustee failures don't stop the migration
- Failed trustees are logged and counted in the state
- You can review errors in the logs

### Performance

- Default batch size is 50 trustees
- Each trustee's appointments are fetched and migrated
- Adjust batch size based on your environment:
  ```bash
  # Smaller batches for testing
  npx tsx scripts/test-trustee-migration-local.ts run 10

  # Larger batches for faster migration
  npx tsx scripts/test-trustee-migration-local.ts run 200
  ```

## Troubleshooting

### Connection Issues

If you can't connect to ATS:
1. Verify VPN connection
2. Check `.env` file has correct credentials
3. Test with SQL Server Management Studio or Azure Data Studio

### Migration Stuck

If migration appears stuck:
1. Check state: `npx tsx scripts/test-trustee-migration-local.ts state`
2. Check MongoDB for partial data
3. Reset if needed: `npx tsx scripts/test-trustee-migration-local.ts reset`

### Memory Issues

For large migrations:
- Use smaller batch sizes
- Monitor memory usage
- Consider running in production-like environment

## Validation

After migration, validate the data:

1. **Check Counts**:
   ```bash
   # Check total in ATS (from test script)
   npx tsx scripts/test-trustee-migration-local.ts test

   # Check migrated count in MongoDB
   mongo cams-local --eval "db.trustees.countDocuments()"
   ```

2. **Spot Check Data**:
   - Compare specific trustees between ATS and MongoDB
   - Verify appointments are correctly associated
   - Check that transformation mappings are correct

3. **Run Application Tests**:
   - Start the CAMS application
   - Search for trustees
   - Verify trustee profiles display correctly

## Testing Appointment Data

### Running Appointment Mapping Tests

```bash
# Run all mapping tests (includes exhaustive TOD_STATUS_MAP coverage)
npm test -- lib/adapters/gateways/ats/ats-mappings.test.ts

# Run migration logic tests (includes appointment upsert/dedup)
npm test -- lib/use-cases/dataflows/migrate-trustees.test.ts
```

### MongoDB Queries for Verifying Appointment Mapping

```javascript
// Count appointments per trustee
db.trustees.aggregate([
  { $match: { documentType: 'TRUSTEE_APPOINTMENT' } },
  { $group: { _id: '$trusteeId', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: 10 }
])

// Find appointments by chapter
db.trustees.find({ documentType: 'TRUSTEE_APPOINTMENT', chapter: '7' }).limit(5)

// Check for case-by-case appointments (migrated from 12CBC/13CBC)
db.trustees.find({
  documentType: 'TRUSTEE_APPOINTMENT',
  appointmentType: 'case-by-case',
  chapter: { $in: ['12', '13'] }
})

// Verify status distribution
db.trustees.aggregate([
  { $match: { documentType: 'TRUSTEE_APPOINTMENT' } },
  { $group: { _id: '$status', count: { $sum: 1 } } }
])

// Find trustees with legacy.truId (all migrated trustees)
db.trustees.find({ documentType: 'TRUSTEE', 'legacy.truId': { $exists: true } }).count()
```

### Known ATS Data Quality Issues

- Some ATS records may have invalid chapter/appointment type combinations (e.g., `standing` for chapter 7). These are logged as warnings and skipped during migration.
- Duplicate appointment records in `CHAPTER_DETAILS` (same TRU_ID, DISTRICT, DIVISION, CHAPTER, and status) are deduplicated by appointment key.
- Some `TOD STATUS` values may be unrecognized. These default to `panel` / `active` and are logged with a warning.
- `DATE_APPOINTED` may be null in ATS; the migration defaults to the current date.

## Notes

- The migration is idempotent for completed trustees
- Trustees are identified by their TRU_ID from ATS
- The migration preserves all appointment relationships
- Status mappings follow the rules in `ats-mappings.ts`
- The `findTrusteeByLegacyTruId()` method provides efficient lookup by ATS ID without scanning the full collection
