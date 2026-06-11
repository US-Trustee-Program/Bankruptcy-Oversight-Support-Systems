# ACMS-CAMS Transition: Appointment Sync Architecture

## Context

During the ACMS→CAMS transition period, both ACMS and CAMS are actively managing case
appointments. Downstream consumers (BOBJ, TUFR) need a single, authoritative view of
appointment state across both systems.

The initial approach used a `CMMAP_ALL` SQL view that UNIONed `CMMAP` (ACMS) and
`CMMAP_CAMS` (CAMS) rows, excluding ACMS rows where CAMS had an active row for the
same `(case, APPT_TYPE)`. This approach was fragile: any gap in the exclusion logic
silently produced duplicate rows, and ACMS rows for cases that CAMS had superseded
retained stale disposition status (`APPT_DISP`, `DISP_DATE`, `APPTEE_ACTIVE`).

## Decision

Replace the `CMMAP_ALL` view with a physical table kept current by two independent
write paths:

**1. CAMS event handler (dual-write)**
When the downstream event handler processes a `CaseAssignmentDownstreamEvent` or
`TrusteeAppointmentDownstreamEvent`, it writes to both `CMMAP_CAMS` and `CMMAP_ALL`
in a single SQL transaction. `CMMAP_CAMS` remains the CAMS-specific audit trail;
`CMMAP_ALL` becomes the authoritative operational table. On transaction failure the
Azure queue message is retried automatically.

**2. Daily ACMS sync timer trigger**
A daily Azure Functions timer trigger polls `CMMAP` (read-only ACMS replica) for
active appointments and their immediate predecessors where `CDB_UPDATE_DATE` is
newer than the watermark stored in `CMMAP_SYNC_CONTROL`. It merges those rows into
`CMMAP_ALL` with `SOURCE='ACMS'`. The `SOURCE != 'CAMS'` guard ensures CAMS-owned
rows are never overwritten by ACMS sync.

**Ownership model**
- `SOURCE='CAMS'` rows are immutable from the ACMS sync path.
- `SOURCE='ACMS'` rows are updated by the daily sync and never written by the event handler.
- The `LAST_UPDATED` timestamp on each row enforces last-writer-wins ordering for
  the event handler path (matching the existing MERGE guard in `CMMAP_CAMS`).

**Seeding**
At cutover, `CMMAP_ALL` is seeded from `CMMAP` (active rows and their immediate
predecessors). The `CMMAP_SYNC_CONTROL` watermark is advanced to cutover time so
the daily sync only picks up changes thereafter.

**Downstream event emission hardening**
Queue failures on the staff assignment and trustee appointment paths are logged via
`context.logger.error` and do not abort remaining processing. No Cosmos error document
is written — the queue and Cosmos share the same infra failure domain, making a Cosmos
fallback unreliable during a queue outage. If a trustee has no matching ACMS professional
ID, the sentinel value `XX-99999` (`PROF_CODE=99999, GROUP_DESIGNATOR='XX'`) is used so
the downstream event is always queued. Sentinel rows are identifiable for remediation
when the professional ID is later corrected.

## Status

Accepted — supersedes the CMMAP_ALL view approach introduced in CAMS-616.

## Consequences

- Downstream consumers point to `CMMAP_ALL` (table) instead of `CMMAP` or the old view.
- ACMS mutations during the transition period are reflected in `CMMAP_ALL` within one
  sync cycle (daily cadence, aligned to the ACMS replica refresh schedule).
- CAMS appointment changes are reflected immediately via the dual-write transaction.
- Queue failures on downstream event paths are logged to Application Insights.
  Trustee rows with no matching ACMS professional ID are written with sentinel value
  `XX-99999` and are identifiable for remediation.
- `CMMAP_CAMS` is retained as a CAMS-sourced audit trail and for downstream consumers
  that require a CAMS-only feed.
