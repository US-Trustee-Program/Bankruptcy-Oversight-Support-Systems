# Per-Region Trustee Appointment Source Selection

## Context

The trustee-appointment sync reads case-appointment data from one of two legacy systems behind a
shared `TrusteeAppointmentSource` interface — see
[ACMS Trustee Appointment Sync](AcmsTrusteeAppointmentSync.md). ACMS has been the source every
region reads from since the sync went live. DXTR was wired in as a second implementation of that
same interface, but left unused per region until this decision set how, and when, a region picks one
source over the other.

DXTR's per-row quality cannot be assumed equal to ACMS's: DXTR can supply an incorrect ACMS
professional code, so the sync never uses it to link a trustee by professional id, and DXTR carries
its own data-quality quirks ACMS does not (for example, a default country value populated even when
no address was recorded at all). Moving a region's trustee-appointment data to DXTR is therefore a
decision with real risk to appointment accuracy, not a mechanical cutover, and that risk needs to be
taken one region at a time, provably, and without a way to make it worse by reverting a region that
has already moved.

No alternative to a per-region switch was seriously considered: appointments are already partitioned
by region everywhere else in this sync (bookmarks, identity-task court fields, division-to-source
routing), and a single global cutover would risk every region's data on one untested change.

## Decision

Each region's trustee-appointment source is a piece of persisted state, defaulting to ACMS and
recorded only when a SuperUser moves that region to DXTR. The move is one-way: once a region is
recorded on DXTR, no operation moves it back to ACMS, so a region's read path can never be silently
reinterpreted after the fact. Moving a region that is already on DXTR a second time is a no-op — it
does not overwrite who made the original switch or when.

A backtest against synthetic DXTR fixtures must pass before the first region moves. After a region
moves, a gap report is intended to compare DXTR's own transaction history for that region against
what CAMS wrote at and immediately after the switch, so a transaction DXTR already held before the
switch, but that CAMS never wrote, is detectable rather than silently lost. The gap report is a
planned follow-up and is deliberately not built yet; until it exists, the backtest is the only
pre-switch check.

## Status

Accepted

## Consequences

The trustee-match pipeline and the sync's appointment-writing rules already treat every event as
source-agnostic — see [Trustee Matching Pipeline](TrusteeMatchingPipeline.md) — so routing a region
to one source or the other required no change to either; only the sync's own per-region source
lookup needed to exist.

Because the move cannot be reversed through the system itself, a region moved to DXTR by mistake has
no built-in path back; correcting it is a manual intervention outside the normal switch. This is
accepted in exchange for a stronger guarantee: a region's appointment history can never be read
through two different, possibly conflicting sources over its lifetime without that being a
deliberate, recorded act.

Rolling out one region at a time bounds the cost of a wrong source decision to that region, at the
price of a longer rollout than a single cutover would take.
