# Testing Trustee Migration Locally

This guide explains how to test the trustee profile migration from ATS to CAMS locally.

## Prerequisites

1. **VPN Connection**: Connect to the USTPBNC VPN to access the Azure SQL databases
2. **Environment Variables**: Ensure your `.env` file has the ATS database configuration:
   ```
   ATS_MSSQL_HOST=sql-ustp-cams.database.usgovcloudapi.net
   ATS_MSSQL_DATABASE=ATS_SUB
   ATS_MSSQL_USER=CloudSA32e9dec1
   ATS_MSSQL_PASS=<password>
   ATS_MSSQL_ENCRYPT=true
   ATS_MSSQL_TRUST_UNSIGNED_CERT=true
   CAMS_ENABLED_DATAFLOWS=SYNC_OFFICE_STAFF,LOAD_E2E_DB,MIGRATE_TRUSTEES
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

## Phase 3: Status Mapping Corrections

### Overview

Phase 3 corrected the status mappings from ATS `TOD STATUS` codes to CAMS appointment types and statuses. The corrections ensure accurate appointment data migration.

### Key Mapping Changes

#### 1. Letter Code Corrections
- **PI**: `inactive` → `voluntarily-suspended` (Panel appointments temporarily suspended)
- **O**: `off-panel` → `converted-case` (Converted case appointments)
- **V**: `converted-case` → `pool` (Chapter 11 Subchapter V pool)
- **NP**: New code → `off-panel` / `resigned`
- **VR**: New code → `out-of-pool` / `resigned` (Chapter 11 Subchapter V)

#### 2. Numeric Code Corrections
Replaced 16 numeric codes with 9 correct codes:
- **Status 1**: `case-by-case` / `active` (default for Ch11)
- **Status 3**: `standing` / `resigned`
- **Status 5**: `standing` / `terminated`
- **Status 6**: `standing` / `terminated`
- **Status 7**: `standing` / `deceased`
- **Status 8**: `case-by-case` / `active`
- **Status 9**: `case-by-case` / `inactive`
- **Status 10**: `case-by-case` / `inactive`
- **Status 12**: `case-by-case` / `active`

#### 3. Special Case Handling

**CBC Chapter Overrides** (`12CBC`, `13CBC`):
- CBC chapters override BOTH `appointmentType` and `status` from the flat map
- All CBC appointments map to `case-by-case` appointment type
- Status codes have special meanings within CBC context:
  - 12CBC: Status 1, 2 → `active`; Status 3, 5, 7 → `inactive`
  - 13CBC: Status 1 → `active`; Status 3 → `inactive`

**Chapter 11 Subchapter V** (Status V or VR):
- When Chapter = 11 and Status = V or VR, chapter resolves to `11-subchapter-v`
- V → `pool` / `active`
- VR → `out-of-pool` / `resigned`

**Code 1 Chapter-Dependent Override** (Ch12/Ch13):
- Status code '1' with Chapter 12 or 13 maps to `standing` / `active`
- Status code '1' with Chapter 11 maps to `case-by-case` / `active` (default)

### Testing Status Mappings

#### Run Mapping Tests
```bash
# Test all status mappings (91 test cases)
npm test -- lib/adapters/gateways/ats/ats-mappings.test.ts

# Test migration logic with status derivation
npm test -- lib/use-cases/dataflows/migrate-trustees.test.ts
```

#### Mock Data for Testing
A comprehensive SQL file with 155 test records is available:
- **File**: `backend/mock-chapter-details.sql`
- **Coverage**: All letter codes, numeric codes, CBC chapters, and edge cases
- **Trustees**: 20 real TRU_IDs from ATS database
- Use this file to populate test data in ATS for local testing

#### Verify Status Mappings in MongoDB

```javascript
// Count appointments by type
db.trustees.aggregate([
  { $match: { documentType: 'TRUSTEE_APPOINTMENT' } },
  { $group: { _id: '$appointmentType', count: { $sum: 1 } } },
  { $sort: { count: -1 } }
])

// Check Subchapter V appointments
db.trustees.find({
  documentType: 'TRUSTEE_APPOINTMENT',
  chapter: '11-subchapter-v'
}).limit(5)

// Verify CBC case-by-case appointments
db.trustees.find({
  documentType: 'TRUSTEE_APPOINTMENT',
  chapter: { $in: ['12', '13'] },
  appointmentType: 'case-by-case'
}).limit(5)

// Check status distribution
db.trustees.aggregate([
  { $match: { documentType: 'TRUSTEE_APPOINTMENT' } },
  { $group: { _id: { type: '$appointmentType', status: '$status' }, count: { $sum: 1 } } },
  { $sort: { '_id.type': 1, '_id.status': 1 } }
])
```

### Status Derivation Logic

Trustee-level status is derived from appointment statuses:
1. If any appointment is `active` → Trustee is **ACTIVE**
2. If any appointment is `voluntarily-suspended` or `involuntarily-suspended` → Trustee is **SUSPENDED**
3. Otherwise → Trustee is **NOT_ACTIVE**

The derivation uses `transformAppointmentRecord()` to account for CBC overrides and chapter-dependent logic, ensuring accurate trustee status calculation.

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

- **Invalid Chapter/Appointment Type Combinations**: Some ATS records may have invalid combinations (e.g., `standing` for chapter 7). These are logged as warnings and skipped during migration.
- **Duplicate Appointments**: Duplicate records in `CHAPTER_DETAILS` (same TRU_ID, DISTRICT, DIVISION, CHAPTER, and appointment type) are deduplicated by appointment key.
- **Unrecognized TOD STATUS Values**: Unknown status codes default to `panel` / `active` and are logged with a warning. Phase 3 added support for PI, NP, VR, O, E, and V status codes.
- **NULL or Missing STATUS Values**: Records with NULL or empty STATUS are logged but may cause transformation errors. The migration includes fallback logic to use flat map defaults when full transformation fails.
- **Missing DATE_APPOINTED**: The migration defaults to the current date when `DATE_APPOINTED` is null.
- **Status Code 2**: Status code '2' is not defined in the current mapping and triggers a warning. It's handled as a special case in CBC chapters only (12CBC status 2 → `active`).

## Notes

- The migration is idempotent for completed trustees
- Trustees are identified by their TRU_ID from ATS
- The migration preserves all appointment relationships
- **Status mappings follow Phase 3 corrections** (see Phase 3 section above):
  - Letter codes: PA, PI, NP, E, O, V, VR, C, S
  - Numeric codes: 1, 3, 5, 6, 7, 8, 9, 10, 12
  - CBC chapter overrides for 12CBC and 13CBC
  - Subchapter V resolution (V, VR → 11-subchapter-v)
  - Code 1 chapter-dependent override (Ch12/13 → standing)
- All mappings are defined in `lib/adapters/gateways/ats/ats.constants.ts`
- Transformation logic is in `lib/adapters/gateways/ats/ats-mappings.ts`
- Status derivation uses full `transformAppointmentRecord()` for CBC-aware resolution
- The `findTrusteeByLegacyTruId()` method provides efficient lookup by ATS ID without scanning the full collection
- Mock data for comprehensive testing is available in `backend/mock-chapter-details.sql`
