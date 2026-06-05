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
The `case-assignment` use case previously swallowed queue failures with only a log
message. It now writes a `STAFF_ASSIGNMENT_DOWNSTREAM_SYNC_ERROR` document to Cosmos
on failure, matching the compensation pattern already used by the trustee appointment
path. This makes missed events discoverable and replayable.

## Status

Accepted — supersedes the CMMAP_ALL view approach introduced in CAMS-616.

## Consequences

- Downstream consumers point to `CMMAP_ALL` (table) instead of `CMMAP` or the old view.
- ACMS mutations during the transition period are reflected in `CMMAP_ALL` within one
  sync cycle (daily cadence, aligned to the ACMS replica refresh schedule).
- CAMS appointment changes are reflected immediately via the dual-write transaction.
- Missed downstream events are traceable via `STAFF_ASSIGNMENT_DOWNSTREAM_SYNC_ERROR`
  and `TRUSTEE_APPOINTMENT_DOWNSTREAM_SYNC_ERROR` documents in Cosmos.
- `CMMAP_CAMS` is retained as a CAMS-sourced audit trail and for downstream consumers
  that require a CAMS-only feed.
