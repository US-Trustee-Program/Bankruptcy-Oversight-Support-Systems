# CAMS Downstream Integration Layer

This subproject provides an **intermediate integration layer** for downstream systems during the transition from ACMS to CAMS.

## Architecture Overview

```
CAMS (Cosmos DB)
  └─> Case Assignment / Trustee Appointment Event
      └─> Azure Storage Queue
          └─> Azure Function Handler (downstream/)
              └─> Write to CMMAP_CAMS table (ACMS_REP_SUB Azure SQL)
                  └─> CMMAP_ALL View (UNION)
                      ├─> SELECT * FROM CMMAP_CAMS (CAMS data)
                      └─> UNION ALL
                          └─> SELECT * FROM CMMAP WHERE no active CAMS row exists
```

## Purpose

**Problem:** Downstream systems query ACMS tables directly. CAMS is replacing ACMS functionality incrementally.

**Solution:** Write CAMS appointment data into the existing `ACMS_REP_SUB` database alongside the ACMS replica data:
1. **`CMMAP_CAMS` table** — Stores CAMS-originated appointments
2. **`CMMAP_ALL` view** — Unions CAMS and ACMS data; CAMS rows take precedence by case + appointment type
3. **Event-driven sync** — CAMS emits events, Azure Functions write to `CMMAP_CAMS`

No separate database is needed — both objects live in `ACMS_REP_SUB`.

## Project Structure

```
downstream/
├── database/
│   └── acms-cams-transition/
│       ├── schema/
│       │   ├── cmmap-cams.sql          # CMMAP_CAMS table DDL
│       │   └── cmmap-all.sql           # CMMAP_ALL view DDL
│       └── migrations/
│           └── 001-initial-schema.sql  # Initial deployment migration
├── acms-cams-transition.ts             # Handlers, transforms, and SQL upsert logic
├── acms-cams-transition.test.ts
├── staff-assignment-downstream.ts      # Azure Function registration (staff queue)
├── trustee-appointment-downstream.ts   # Azure Function registration (trustee queue)
└── README.md
```

## Key Design Decisions

### 1. ACMS_REP_SUB as the target database
CAMS writes into the same `ACMS_REP_SUB` database where the ACMS replica already lives. No separate database is needed. Downstream systems can query `CMMAP_ALL` in place of ACMS's `CMMAP`.

### 2. Event-Driven Architecture
- **Loose coupling** — CAMS and downstream are decoupled via Azure Storage Queue
- **Eventual consistency** — Acceptable for reporting use case
- **Idempotency** — MERGE statement makes handlers safe to replay

### 3. CMMAP_ALL View Union Strategy
```sql
-- CMMAP_ALL returns CAMS rows + ACMS rows where no CAMS row exists for that case+APPT_TYPE
CREATE VIEW CMMAP_ALL AS
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

### 4. Appointment Types
- **S1** — Staff attorney assignments
- **TR** — Trustee appointments

Each handler writes to `CMMAP_CAMS` using the appropriate `APPT_TYPE`.

## Related Documentation

- [Integration Testing](../test/integration/acms-cams-transition/README.md)
