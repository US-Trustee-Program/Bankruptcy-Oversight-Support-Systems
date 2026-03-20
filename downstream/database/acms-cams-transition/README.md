# ACMS-CAMS Transition Database

This directory contains database schema and migrations for the **ACMS-to-CAMS transition layer**.

## Purpose

During the transition from ACMS to CAMS, this database serves as an integration point for downstream systems (primarily BOBJ) that cannot easily modify their queries. The database provides:

1. **Hybrid CMMAP view** - Unions CAMS Chapter 15 data with ACMS data for all other chapters
2. **Pass-through views** - Read-only views to ACMS replica tables
3. **CMMAP_STAGING table** - Stores Chapter 15 assignments from CAMS

## Directory Structure

```
acms-cams-transition/
├── README.md (this file)
├── schema/
│   ├── cmmap-staging.sql          # Staging table for CAMS Chapter 15 assignments
│   ├── cmmap-view.sql             # Hybrid view (CAMS + ACMS union)
│   └── acms-passthrough-views.sql # 60+ pass-through views to ACMS tables
└── migrations/
    └── 001-initial-schema.sql     # Initial schema deployment script
```

## Schema Components

### CMMAP_STAGING Table
- Stores Chapter 15 case assignments from CAMS
- Matches ACMS CMMAP schema structure
- Includes metadata columns (`SOURCE='CAMS'`, `CAMS_CASE_ID`, etc.)
- Updated via Azure Function when CAMS emits assignment events

### CMMAP View
**Hybrid view that returns:**
- **CAMS data** for Chapter 15 cases (from `CMMAP_STAGING`)
- **ACMS data** for all other cases (from `ACMS_REPLICA.dbo.CMMAP`)

**Logic:**
```sql
SELECT * FROM CMMAP_STAGING WHERE SOURCE = 'CAMS'
UNION ALL
SELECT * FROM ACMS_REPLICA.dbo.CMMAP
WHERE NOT EXISTS (SELECT 1 FROM CMMAP_STAGING WHERE case matches);
```

**Key Behavior:**
- CAMS data **overrides** ACMS data when both exist for the same case
- Transparent to downstream consumers (same table name, same schema)

### Pass-through Views
Read-only views for ACMS tables:
- **Core**: CMMBA, CMMDB, CMMPR, CMMPT, CMMPD
- **Hearing**: CMHHR, CMHMR, CMHNO, CMHOR, etc.
- **Reference**: CMLOC, CMMGD, CMMRG, CMMLC
- **Summary**: CMSSUM, CMSSPR, CMSSD, CMSSBO
- **Reports**: ORO*, RPT*, TOT* series

## Deployment

### Prerequisites
1. Azure SQL Server instance (existing)
2. ACMS replica database on same server
3. Create new database: `cams-downstream` (or name provided by DBA)
4. Cross-database query permissions

### Deploy Schema

**Option 1: Run migration script**
```bash
sqlcmd -S your-server.database.windows.net \
       -d cams-downstream \
       -U your-user -P your-password \
       -i migrations/001-initial-schema.sql
```

**Option 2: Run schema files individually**
```bash
sqlcmd -S your-server -d cams-downstream -i schema/cmmap-staging.sql
sqlcmd -S your-server -d cams-downstream -i schema/cmmap-view.sql
sqlcmd -S your-server -d cams-downstream -i schema/acms-passthrough-views.sql
```

### Update ACMS Database Name

If ACMS replica database has a different name, update the three-part names in SQL files:

**Current:** `ACMS_REPLICA.dbo.CMMAP`
**Update to:** `YOUR_ACMS_DB_NAME.dbo.CMMAP`

Files to update:
- `schema/cmmap-view.sql`
- `schema/acms-passthrough-views.sql`

## Verification

After deployment, verify the schema:

```sql
-- Check staging table exists
SELECT * FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_NAME = 'CMMAP_STAGING';

-- Check CMMAP view exists
SELECT * FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_NAME = 'CMMAP';

-- Check pass-through views (should be 60+)
SELECT COUNT(*) FROM INFORMATION_SCHEMA.VIEWS
WHERE TABLE_NAME LIKE 'CM%';

-- Test CMMAP view returns data
SELECT TOP 10 * FROM CMMAP;
```

## Future Migrations

As CAMS assumes responsibility for additional chapters beyond Chapter 15:

1. Update `CMMAP_STAGING` to handle new chapters
2. Modify `CMMAP` view union logic
3. Create new migration scripts (002-, 003-, etc.)
4. Eventually deprecate this database in favor of REST API

## Related Documentation

- [Downstream README](../../README.md) - Overall architecture
- [CAMS-362 Brainstorming](../../../.ustp-cams-fdp/ai/specs/CAMS-362-downstream-staff-asssignment/brainstorming/read-only/CAMS-362-DOWNSTREAM-STAFF-ASSIGNMENT-BRAINSTORMING.md)
- [Integration Tests](../../test/acms-cams-transition/README.md)
