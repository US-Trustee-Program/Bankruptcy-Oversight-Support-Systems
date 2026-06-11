# CAMS Downstream Integration Layer

This subproject provides an **intermediate integration layer** for downstream systems during the transition from ACMS to CAMS.

## Architecture Overview

```
CAMS (Cosmos DB)
  └─> Case Assignment / Trustee Appointment Event
      └─> Azure Storage Queue
          └─> Azure Function Handler (downstream/)
              └─> Dual-write transaction (AbstractMssqlClient.withTransaction)
                  ├─> CMMAP_CAMS table  (CAMS audit trail)
                  └─> CMMAP_ALL table   (authoritative operational table)

ACMS (CMMAP replica, read-only)
  └─> Daily timer trigger (AcmsDailySync)
      └─> MERGE into CMMAP_ALL (SOURCE='ACMS', never overwrites SOURCE='CAMS')
```

## Purpose

**Problem:** Downstream systems (BOBJ, TUFR) query ACMS tables directly. CAMS is replacing ACMS appointment management incrementally across divisions.

**Solution:** Maintain a unified `CMMAP_ALL` physical table in `ACMS_REP_SUB` that downstream consumers can query in place of `CMMAP`. CAMS-originated appointments write through the event handler path; ACMS appointments are synced daily.

## Key Design Decisions

### 1. Physical table, not a view
`CMMAP_ALL` is a physical table, not a UNION view. The view approach was fragile — exclusion logic gaps silently produced duplicates and ACMS rows for CAMS-managed cases retained stale disposition status. The physical table with explicit `SOURCE` ownership is unambiguous.

### 2. Dual-write transaction
When the downstream event handler processes a `CaseAssignmentDownstreamEvent` or `TrusteeAppointmentDownstreamEvent`, it writes to both `CMMAP_CAMS` and `CMMAP_ALL` in a single SQL transaction via `AbstractMssqlClient.withTransaction`. On failure the Azure queue message is retried automatically.

### 3. Ownership model
- `SOURCE='CAMS'` rows are written by the event handler and never overwritten by the ACMS daily sync.
- `SOURCE='ACMS'` rows are written and updated by the daily sync and never written by the event handler.
- `CMMAP_CAMS` is retained as a CAMS-only audit trail.

### 4. Daily ACMS sync
A daily timer trigger reads `LAST_SYNC_DATE` from `CMMAP_SYNC_CONTROL`, merges ACMS `CMMAP` rows updated since that watermark into `CMMAP_ALL`, and advances the watermark. The sync runs at 02:00 UTC after the ACMS replica refresh.

### 5. ApplicationContext threading
All handlers bridge `InvocationContext` to `ApplicationContext` via `ContextCreator.getApplicationContext()` at the entry point. SQL connections use `AcmsRepSubClient` — a subclass of `AbstractMssqlClient` — which inherits pool construction, Azure AD auth fallback, and lifecycle management from shared infrastructure.

### 6. Observability
Success/failure telemetry is emitted via `completeDataflowTrace`, which writes structured logs and custom App Insights metrics (`acms_cmmap_handler_write_success`, `acms_cmmap_handler_write_failure`, `acms_cmmap_sync_rows_merged`) on every invocation.

## Dependency Direction

**Downstream handlers may depend on shared CAMS utilities. CAMS proper must never import from the downstream layer.**

The downstream handlers are designed to be deleted cleanly when the ACMS-CAMS transition is complete. Their removal must have zero impact on CAMS proper. Any utility that the downstream handlers use must be in a direction that flows toward the downstream layer, not away from it.

## Assumptions

The following assumptions underpin design decisions in this layer. If any assumption changes, the affected logic should be reconsidered.

| # | Assumption | Impact if violated |
|---|------------|--------------------|
| 1 | ACMS does not mutate predecessor rows after CAMS takes over appointments for a division. | The incremental daily sync omits the predecessor `UNION ALL` branch. Violating this assumption means some predecessor rows in `CMMAP_ALL` could become stale. Re-add the predecessor branch to the incremental sync if this changes. |
| 2 | `CMMAP_ALL` must preserve full appointment history including inactive predecessor rows, not just active appointments. | Full-load seeding includes all `CMMAP` rows with `DELETE_CODE = ' '` (active and predecessor). This makes `CMMAP_ALL` a drop-in replacement for `CMMAP` for historical queries. |
| 3 | Downstream consumers can tolerate ACMS data being up to one sync cycle (daily) behind. | The sync runs once daily. If near-real-time ACMS consistency is required, the cadence or trigger mechanism must change. |
| 4 | The daily sync cadence is aligned with the ACMS replica refresh schedule (daily, before business hours). | The timer is set to 02:00 UTC. If the ACMS replica refresh schedule changes, the timer schedule should be updated to match. |
| 5 | Missed downstream events on queue failure are logged to Application Insights and do not abort remaining assignments. | On queue failure, `context.logger.error` is called and processing continues. If a trustee has no matching ACMS professional ID, the sentinel value `XX-99999` (`PROF_CODE=99999, GROUP_DESIGNATOR='XX'`) is used so the event is always queued. Sentinel rows are identifiable for remediation when the professional ID is corrected. |
| 6 | The downstream handlers can be deleted without any adverse effect on CAMS proper. | No CAMS-proper code imports from this layer. Verify this invariant before adding any new import in the reverse direction. |

## Project Structure

```
downstream/
├── database/
│   └── acms-cams-transition/
│       ├── schema/
│       │   ├── cmmap-cams.sql           # CMMAP_CAMS table DDL
│       │   ├── cmmap-all.sql            # CMMAP_ALL table DDL
│       │   └── cmmap-sync-control.sql   # CMMAP_SYNC_CONTROL table DDL
│       └── migrations/
│           └── 001-initial-schema.sql   # Initial deployment migration + seed
├── acms-cams-transition.ts              # Handlers, transforms, SQL logic, daily sync
├── acms-cams-transition.test.ts
├── acms-daily-sync.ts                   # Azure Function registration (timer trigger)
├── staff-assignment-downstream.ts       # Azure Function registration (staff queue)
├── trustee-appointment-downstream.ts    # Azure Function registration (trustee queue)
└── README.md
```

## Related Documentation

- [ADR: ACMS-CAMS Transition Appointment Sync](../../../../docs/architecture/decision-records/AcmsCamsTransitionAppointmentSync.md)
- [Integration Testing](../../../../test/integration/acms-cams-transition/README.md)
