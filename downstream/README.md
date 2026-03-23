# CAMS Downstream Integration Layer

This subproject provides an **intermediate integration layer** for downstream consumers (primarily BusinessObjects/BOBJ reports) during the transition from ACMS to CAMS.

## Architecture Overview

```
CAMS (Cosmos DB)
  └─> Chapter 15 Case Assignment Event
      └─> Azure Storage Queue: "downstream-chapter15-assignments-event"
          └─> Azure Function Handler
              └─> Write to CMMAP_STAGING table (Azure SQL)
                  └─> CMMAP View (UNION)
                      ├─> SELECT * FROM CMMAP_STAGING (CAMS Ch15)
                      └─> UNION ALL
                          └─> SELECT * FROM ACMS.dbo.CMMAP WHERE chapter != 15
                              └─> BOBJ reads CMMAP view
```

## Purpose

**Problem:** BOBJ reports query ACMS tables directly and cannot be easily modified. CAMS is replacing ACMS functionality incrementally, starting with Chapter 15 case assignments.

**Solution:** Create a new database on the existing Azure SQL Server that:
1. **Pass-through views** - Most ACMS tables are read-only views pointing to ACMS replica database
2. **Hybrid CMMAP view** - Unions CAMS Chapter 15 data with ACMS data for all other chapters
3. **Event-driven sync** - CAMS emits events, Azure Function writes to staging table

## Project Structure

```
downstream/
├── database/
│   └── acms-cams-transition/
│       ├── schema/
│       │   ├── cmmap-staging.sql       # Staging table for CAMS assignments
│       │   ├── cmmap-view.sql          # Union view (CAMS + ACMS)
│       │   └── acms-passthrough-views.sql  # Pass-through views
│       └── migrations/
│           └── 001-initial-schema.sql
├── functions/
│   ├── chapter15-assignment-handler/
│   │   ├── index.ts                # Event handler entry point
│   │   ├── transform.ts            # CAMS → ACMS schema transformation
│   │   └── transform.test.ts       # Unit tests
│   └── host.json                   # Azure Functions configuration
├── package.json
├── tsconfig.json
└── README.md
```

## Key Design Decisions

### 1. Scope: Chapter 15 Only (Initial Phase)
- CAMS currently only manages Chapter 15 case assignments
- All other chapters (7, 11, 12, 13) continue to flow from ACMS
- Future: Expand to other chapters as CAMS assumes more functionality

### 2. Event-Driven Architecture
- **Loose coupling** - CAMS and downstream are decoupled via queue
- **Eventual consistency** - Acceptable for reporting use case
- **Idempotency** - Handler can process same event multiple times safely

### 3. Professional ID Placeholder Strategy
Two options under consideration:
- **Option A:** `"ZZ-{incrementing_int}"` - Generic placeholder pattern
- **Option B:** `"{GROUP_DESIGNATOR}-{decrementing_int}"` - Court-specific, starts at 99999 to avoid ACMS collisions

Current implementation uses string placeholders that can accommodate either strategy.

### 4. Staging Table Pattern
- **CMMAP_STAGING** - Separate table for CAMS data, not direct writes to ACMS
- **Upsert semantics** - Updates existing records, inserts new ones
- **Metadata tracking** - Includes `SOURCE='CAMS'`, `LAST_UPDATED`, `CAMS_CASE_ID`

### 5. View Union Strategy
```sql
-- CMMAP View returns CAMS data for Chapter 15, ACMS data for everything else
CREATE VIEW CMMAP AS
  SELECT * FROM CMMAP_STAGING WHERE SOURCE = 'CAMS'
  UNION ALL
  SELECT * FROM ACMS_REPLICA.dbo.CMMAP
  WHERE NOT EXISTS (
    SELECT 1 FROM CMMAP_STAGING s
    WHERE s.CASE_DIV = CMMAP.CASE_DIV
      AND s.CASE_YEAR = CMMAP.CASE_YEAR
      AND s.CASE_NUMBER = CMMAP.CASE_NUMBER
  );
```

## Dependencies

- **CAMS backend** - Emits `CaseAssignmentEvent` to Azure Storage Queue
- **ACMS replica database** - Source for non-Chapter 15 data (existing database on same server)
- **Azure SQL Database** - New database `cams-downstream` on existing SQL Server instance
- **Azure Storage Queue** - Message bus for assignment events
- **Azure Functions** - Serverless event handlers

## Development

### Local Development

1. **Install dependencies:**
```bash
npm install
```

2. **Configure local settings:**
```bash
# Copy template and update with your settings
cp functions/local.settings.json.template functions/local.settings.json
# Edit local.settings.json with your connection strings
```

3. **Run tests:**
```bash
npm test
npm run test:coverage
npm run test:mutation
```

4. **Start Azure Functions locally:**
```bash
npm run start
# Or use Azure Functions Core Tools directly
cd functions && func start
```

**Note:** `local.settings.json` is gitignored and contains local connection strings

### Queue Naming Convention

Following CAMS dataflows convention:
- **Queue Name:** `downstream-chapter15-assignments-event`
- **Pattern:** `{MODULE_NAME}-{suffix}` (lowercase)
- **Module Name:** `DOWNSTREAM-CHAPTER15-ASSIGNMENTS`
- **Suffix:** `event`

This aligns with existing CAMS queues like:
- `sync-cases-start`, `sync-cases-page`
- `migrate-trustees-start`, `migrate-trustees-page`

### Queue Message Format
The event is already defined in CAMS as `CaseAssignmentEvent`:
```typescript
interface CaseAssignmentEvent {
  caseId: string;           // CAMS case ID (e.g., "081-24-12345")
  userId: string;           // CAMS user ID
  name: string;             // Attorney name
  role: string;             // "TrialAttorney"
  assignedOn: string;       // ISO timestamp
  unassignedOn?: string;    // ISO timestamp (if unassigned)
  // Professional ID mapping TBD
}
```

## Deployment

### Azure Resources
- **SQL Server:** Existing instance (shared with ACMS replica)
- **SQL Database:** `cams-downstream` (new database on existing server)
- **Function App:** `func-cams-ch15-assign-{env}`
- **Storage Account:** Existing CAMS storage account (reuse queue infrastructure)

### Environment Variables
```bash
# Azure Function Configuration
DOWNSTREAM_SQL_CONNECTION_STRING="Server=...;Database=cams-downstream;..."
ACMS_REPLICA_DATABASE="acms-replica"  # Name of ACMS database on same server
AzureWebJobsStorage="DefaultEndpointsProtocol=https;AccountName=...;AccountKey=...;"
```

**Note:** Queue name is hardcoded as `downstream-chapter15-assignments-event` following CAMS dataflows naming convention

## Future Enhancements

1. **Expand to other chapters** - As CAMS assumes responsibility for Ch7/11/12/13
2. **Multiple staff members** - ACMS supports S1 and S2; expand staging table as needed
3. **Professional ID resolution** - Implement final strategy for CAMS → ACMS ID mapping
4. **Dead letter queue handling** - Monitor and resolve failed messages
5. **REST API** - Long-term goal to replace SQL views with HAL+JSON API

## Related Documentation

- [ACMS-CAMS Transition Database](database/acms-cams-transition/README.md) - Database schema and deployment
- [Integration Testing Guide](test/acms-cams-transition/README.md) - Local testing with seed data
- [CAMS-362 Brainstorming](../.ustp-cams-fdp/ai/specs/CAMS-362-downstream-staff-asssignment/brainstorming/read-only/CAMS-362-DOWNSTREAM-STAFF-ASSIGNMENT-BRAINSTORMING.md)
- [ACMS Data Dictionary](../.ustp-cams-fdp/ai/specs/CAMS-362-downstream-staff-asssignment/brainstorming/read-only/ACMSDataDictionary.xlsx)
- [ACMS Table Structures](../.ustp-cams-fdp/ai/specs/CAMS-362-downstream-staff-asssignment/brainstorming/read-only/acms-tables.tsv)
