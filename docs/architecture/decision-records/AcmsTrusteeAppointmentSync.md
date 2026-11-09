# ACMS Trustee Appointment Sync

## Context

CAMS needs ACMS (CMMAP) trustee case-appointment data kept current per region, continuing from where
the one-time nationwide migration (`migrateCaseAppointments`, July 2026, removed under CAMS-955)
left off. Two earlier approaches inform this decision:

- A rejected dual-write/side-table design (see
  [ACMS-CAMS Transition Appointment Sync](AcmsCamsTransitionAppointmentSync.md)) that replicated
  ACMS and CAMS appointment rows into a `CMMAP_ALL` table via a daily sync timer trigger. It never
  ran in production and was removed under CAMS-874.
- `syncTrusteeCaseAppointments`, a production dataflow (from CAMS-953) that reads DXTR event-sourced
  appointment data and already implements the active-trustee rule, per-write checks, surrogate
  placeholders for unidentified trustees, and identity-task creation. It had no ACMS read path and
  no professional-id-based identification step.

This record answers three questions: where an ACMS read path belongs, what signals a row has changed
and needs re-reading, and how much trust an ACMS professional id deserves as a trustee match.

No alternative to a per-region daily poll of the ACMS read replica was seriously considered: ACMS
has no outbound event stream CAMS can subscribe to, so a poll against the replica is the only
available signal source.

## Decision

**Source behind an interface, not a new dataflow.** ACMS case-appointment ingestion is a
`TrusteeAppointmentSource` implementation plugged into the existing `syncTrusteeCaseAppointments`
dataflow, rather than a standalone dataflow. `syncTrusteeCaseAppointments` already implements the
appointment-writing rules an ACMS path also needs; a parallel dataflow would duplicate that behavior
and let it drift from the DXTR path over time. The existing DXTR read path becomes a second
`TrusteeAppointmentSource` implementation, wired but left unused per region until a per-region
source switch ships separately.

**Bookmark on the central-database change date, not the regional one.** Each region's sync cursor
advances using the appointment row's central-database change date, as copied onto the read replica —
not its regional change date. A regional change reaches the central database, and so the replica,
later than it occurs there; a cursor on the regional date risks reading past a row whose
central-database write has not replicated yet, silently skipping it on replay. The cursor advances
only to a date strictly earlier than the latest change date observed in the replica for that region
on the current run, and that latest date is re-read every run rather than cached — replica lag is
absorbed by always leaving the newest known date unbookmarked, not by a fixed lookback window. A row
whose change date falls on or after the run's own calendar date is never read.

A date with no rows is complete as soon as a later date exists, the same as a date with rows. The
cursor steps through every date strictly before the newest known date, so a dormant region's cursor
advances past its empty days and later runs do not re-read them.

**A professional id matches only when it is unambiguous.** The sync's first identification step uses
an ACMS professional id to identify a trustee only when that id links to exactly one CAMS trustee
record. An id with no link, or links to more than one trustee, is not treated as a match — the row
falls through to the next identification step (known variation) instead. Resolving such an id
requires a data verifier's action on the Data Verification screen; the sync does not guess among
multiple candidate trustees.

Further design detail, including the identity-task gate definitions this sync's unknown-trustee path
relies on, lives in a design document (`trustee-appointment-sync-plan.md`) shared with the team
outside this repository.

**Source is ground truth.** DXTR and ACMS appointments are court dictates, and CAMS only records
them. Three rules follow:

- (a) A source disposition date (DISP_DATE, carried as `event.unassignedOn`) is recorded exactly as
  given. It is never clamped and never replaced by a derived date. A disposition that predates its
  appointment's own start is logged as a warning and still recorded.
- (b) When the court record holds two open appointments for one case, the later `assignedOn` is
  active. The older one is closed the day before the later one starts. A derived close date is used
  only when the source gives no disposition for that appointment.
- (c) An appointment that carries a source disposition is never re-closed or overwritten by the
  latest-wins rule in (b).

A placeholder (surrogate) records one court appointment whose trustee is not yet identified. Each
court appointment gets its own placeholder, keyed by case, fingerprint, and `assignedOn`. A
disposition closes the placeholder; it does not delete it, because a closed placeholder remains a
member of its identity task and is remapped to the resolved trustee on approval.

When two appointments for one case share an `assignedOn` date, the arriving row wins: for a
different trustee the existing row closes at its own start date, and the same trustee on the same
date is one appointment whose disposition applies in place. Replaying an older event that carries no
disposition can reopen a row the court has since closed, because the sync cannot tell a stale replay
from a new open appointment; this known limitation is tracked as cams-fd8qd.35.

## Status

Accepted

## Consequences

- One dataflow, one set of appointment-writing rules, serves both ACMS and DXTR sources; a future
  source needs only to implement `TrusteeAppointmentSource`, not reimplement the active-trustee,
  checks, or placeholder behavior.
- A region's ACMS sync can lag a full replication cycle behind the central database before its
  bookmark advances past a given date — by design, since correctness (never skipping a late-arriving
  row) is prioritized over sync latency.
- A professional id linked to more than one CAMS trustee produces no automatic match; the
  appointment falls through to weaker identification signals, or an identity task, until a data
  verifier resolves the ambiguity. Appointment data for such cases stays stale until that happens.
- The DXTR `TrusteeAppointmentSource` implementation exists but is not selectable per region yet, so
  this record may need revisiting once a region can choose between sources.
