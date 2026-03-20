# ACMS-CAMS Transition Integration Testing

This directory contains integration test scripts for the ACMS-CAMS transition database layer.

**IMPORTANT:** Do not commit integration test credentials or connection strings. Use `.env.test` for local configuration.

## Structure

```
test/acms-cams-transition/
├── seed/
│   ├── 01-seed-acms-replica.sql      # Mock ACMS data for testing
│   ├── 02-seed-cmmap-staging.sql     # Mock CAMS staging data
│   └── README.md
├── integration-tests/
│   ├── test-cmmap-view.sql           # Test CMMAP union view
│   └── README.md
└── README.md (this file)
```

## Prerequisites

1. Local SQL Server or Azure SQL Database
2. Create two databases:
   - `acms_replica_test` - Mock ACMS replica
   - `cams_downstream_test` - Downstream integration database
3. Run schema scripts:
   - On `cams_downstream_test`: `database/migrations/001-initial-schema.sql`
4. Update connection strings in `.env.test` (see example below)

## Setup

### 1. Environment Variables

Create `.env.test` (do NOT commit):
```bash
# Local SQL Server
ACMS_REPLICA_CONNECTION_STRING="Server=localhost;Database=acms_replica_test;Trusted_Connection=yes;"
DOWNSTREAM_SQL_CONNECTION_STRING="Server=localhost;Database=cams_downstream_test;Trusted_Connection=yes;"

# Or Azure SQL
# ACMS_REPLICA_CONNECTION_STRING="Server=tcp:YOUR_SERVER.database.windows.net,1433;Database=acms_replica_test;User ID=YOUR_USER;Password=YOUR_PASSWORD;"
# DOWNSTREAM_SQL_CONNECTION_STRING="Server=tcp:YOUR_SERVER.database.windows.net,1433;Database=cams_downstream_test;User ID=YOUR_USER;Password=YOUR_PASSWORD;"

# Azure Storage (use actual Azure Storage, matching backend convention)
AzureWebJobsStorage="DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT;AccountKey=YOUR_KEY;EndpointSuffix=core.windows.net"
```

### 2. Seed Test Data

```bash
# Seed ACMS replica with mock data
sqlcmd -S localhost -d acms_replica_test -i test/acms-cams-transition/seed/01-seed-acms-replica.sql

# Optionally seed staging table with existing CAMS data
sqlcmd -S localhost -d cams_downstream_test -i test/acms-cams-transition/seed/02-seed-cmmap-staging.sql
```

### 3. Run Integration Tests

```bash
# SQL-based tests
sqlcmd -S localhost -d cams_downstream_test -i test/acms-cams-transition/integration-tests/test-cmmap-view.sql
```

## Test Scenarios

### Scenario 1: CMMAP View Returns ACMS Data (No CAMS Override)
**Given:** ACMS has case 081-24-12345 with Ch7 trustee
**And:** CAMS staging table is empty
**When:** Query `SELECT * FROM CMMAP WHERE CASE_FULL_ACMS = '081-24-12345'`
**Then:** Returns ACMS data

### Scenario 2: CMMAP View Returns CAMS Data (CAMS Override)
**Given:** ACMS has case 081-24-99999 with Ch15 attorney
**And:** CAMS staging table has case 081-24-99999 with different attorney
**When:** Query `SELECT * FROM CMMAP WHERE CASE_FULL_ACMS = '081-24-99999'`
**Then:** Returns CAMS data (staging), NOT ACMS data

### Scenario 3: Azure Function Inserts New Assignment
**Given:** Staging table is empty
**When:** Function receives new Ch15 assignment event
**Then:** Staging table has new row with APPT_TYPE='S1'

### Scenario 4: Azure Function Updates Existing Assignment
**Given:** Staging table has active assignment for case 081-24-99999
**When:** Function receives unassignment event for same case
**Then:** Staging table row updated with DISP_DATE and APPTEE_ACTIVE='N'

## Cleanup

```bash
# Drop test databases when done
sqlcmd -Q "DROP DATABASE acms_replica_test;"
sqlcmd -Q "DROP DATABASE cams_downstream_test;"
```

## Notes

- Test data includes realistic ACMS codes and formats
- Professional codes use placeholder strategy (ZZ-* for CAMS)
- All dates use both numeric (YYYYMMDD) and datetime formats
- Test cases cover Chapter 7, 11, 13, and 15
