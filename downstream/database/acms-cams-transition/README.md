# ACMS-CAMS Transition Database

This directory contains database schema and migrations for the **ACMS-to-CAMS transition layer**.

## Purpose

During the transition from ACMS to CAMS, this schema serves as an integration point for downstream systems (primarily BOBJ) that cannot easily modify their queries. It provides:

1. **`CMMAP_CAMS` table** - Stores CAMS-originated appointments (staff assignments, trustee appointments)
2. **`CMMAP_ALL` view** - Unions CAMS data with ACMS data, letting CAMS rows take precedence

Both objects live in the existing `ACMS_REP_SUB` database — no separate database is needed.

## Directory Structure

```
acms-cams-transition/
├── README.md (this file)
├── schema/
│   ├── cmmap-cams.sql   # CMMAP_CAMS table (CAMS appointments)
│   └── cmmap-all.sql    # CMMAP_ALL view (CAMS + ACMS union)
└── migrations/
    └── 001-initial-schema.sql  # Initial schema deployment script
```

## Schema Components

### CMMAP_CAMS Table

Stores appointments written by CAMS downstream handlers (staff assignments and trustee appointments). The schema mirrors the ACMS `CMMAP` table with additional metadata columns (`SOURCE='CAMS'`, `CAMS_CASE_ID`, `CAMS_USER_ID`, `CAMS_USER_NAME`, `LAST_UPDATED`).

### CMMAP_ALL View

Hybrid view that returns:
- **CAMS rows** from `CMMAP_CAMS` for any case+appointment type where CAMS has written a record
- **ACMS rows** from `CMMAP` for all other appointments

**Logic:**
```sql
SELECT * FROM CMMAP_CAMS
UNION ALL
SELECT * FROM CMMAP AS acms
WHERE NOT EXISTS (
  SELECT 1 FROM CMMAP_CAMS
  WHERE CASE_DIV = acms.CASE_DIV
    AND CASE_YEAR = acms.CASE_YEAR
    AND CASE_NUMBER = acms.CASE_NUMBER
    AND APPT_TYPE = acms.APPT_TYPE
);
```

**Key behavior:** CAMS data overrides ACMS data when both exist for the same case + appointment type. The view is transparent to downstream consumers.

## Deployment

### Prerequisites

1. Access to `ACMS_REP_SUB` database (or the equivalent ACMS replica database)
2. Permission to create tables and views in that database

### Deploy Schema

**Option 1: Run migration script**
```bash
sqlcmd -S your-server.database.windows.net \
       -d ACMS_REP_SUB \
       -U your-user -P your-password \
       -i migrations/001-initial-schema.sql
```

**Option 2: Run schema files individually**
```bash
sqlcmd -S your-server -d ACMS_REP_SUB -i schema/cmmap-cams.sql
sqlcmd -S your-server -d ACMS_REP_SUB -i schema/cmmap-all.sql
```

## Verification

After deployment, verify the schema:

```sql
-- Check CMMAP_CAMS table exists
SELECT * FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'CMMAP_CAMS';

-- Check CMMAP_ALL view exists
SELECT * FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_NAME = 'CMMAP_ALL';

-- Test CMMAP_ALL view returns data
SELECT TOP 10 * FROM CMMAP_ALL;
```

## Future Migrations

As CAMS takes responsibility for additional appointment types:

1. Add migration scripts (`002-`, `003-`, etc.) rather than modifying `001-initial-schema.sql`
2. The `CMMAP_ALL` view logic does not need to change — it already handles any appointment type written to `CMMAP_CAMS`

## Related Documentation

- [Downstream README](../../README.md) - Overall architecture
- [Integration Tests](../../../test/integration/acms-cams-transition/README.md)
