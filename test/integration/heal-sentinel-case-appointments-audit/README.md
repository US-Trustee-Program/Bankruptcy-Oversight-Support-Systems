# Heal Sentinel Case Appointments — Audit

Exploratory harness (NOT a regression gate) that measures how effective
`HealSentinelCaseAppointmentsUseCase.healSentinelAppointment`
(`backend/lib/use-cases/dataflows/heal-sentinel-case-appointments.ts`) is against a real sample of
sentinel `case-trustee-appointments` from staging, replayed against the current
`trustee-professional-ids` collection.

Replays production's exact resolution rule — `findByAcmsProfessionalId`'s real query is
`acmsProfessionalId == X AND error is absent` (`notErrored()` in
`trustee-professional-ids.mongo.repository.ts`) — as a plain in-memory filter, not a new,
separately-tuned comparison. A sentinel heals only when exactly one such record exists.

**Makes no changes to the as-built healing logic or to any collection.** This harness is
investigation only — no database is used; both fixture files are read directly and compared in
memory.

## Known finding: 41.0% heal rate on a 10,000-row recent-sentinel sample (2026-09-14 export)

Sampled 10,000 sentinel appointments (`reason: 'trustee-not-found'`) out of ~1.5M unmatched
trustee case appointments in staging, biased toward recent rows so they'd plausibly correspond to
current CAMS trustees. Replayed against a same-day `trustee-professional-ids` export (6392
records: 3658 linked, 2734 errored).

- **4105 of 10,000 (41.0%) heal** — their `acmsProfessionalId` has exactly one linked
  (non-error) professional-id record.
- **5895 of 10,000 (59.0%) do not heal**, all via `no-mapping` (zero linked records for that
  `acmsProfessionalId`) — **zero rows hit `ambiguous-mapping`** (>1 linked record) or
  `missing-acms-id` in this sample; every sampled row already carries an `acmsProfessionalId`.
- The 5895 unhealed rows concentrate onto only 143 distinct `acmsProfessionalId` values — a
  handful of professional IDs (`MC-04227`: 226 rows, `FR-06572`: 170, `HU-08042`: 157, ...)
  account for a disproportionate share of stuck appointments. Improving the match for those top
  professional IDs specifically (rather than the bucket generally) would heal a large fraction of
  the remaining rows per unit of investigation effort.

Cross-referencing all 143 unresolved `acmsProfessionalId` values directly against the same-day
`trustee-professional-ids` export (not just scored/estimated — looked up by exact ID) splits the
5895 unhealed rows three ways:

| Category                                             | Distinct IDs | Rows | % of unhealed |
| ----------------------------------------------------- | -----------: | ---: | -------------: |
| `ambiguous` in trustee-professional-ids                | 97           | 4626 | 78.5%          |
| Not present in trustee-professional-ids export at all  | 45           | 1266 | 21.5%          |
| `no-match` in trustee-professional-ids                 | 1            |    3 | 0.05%          |

**78.5% of unhealed rows are already sitting on an `ambiguous` professional-id record** —
`sync-acms-professional-ids-audit`'s companion finding (same-day export: every notable
false-negative miss is on an `ambiguous` record, most with a single already-correct candidate
still failing corroboration) is very likely the same root cause blocking this population.
Improving that corroboration/ambiguity-resolution logic would raise this harness's heal rate on a
re-run without any change to `heal-sentinel-case-appointments` itself — this sample makes that
link concrete rather than speculative, though it doesn't prove causation for every individual row.
The remaining 21.5% haven't been synced into `trustee-professional-ids` at all yet (a
`sync-acms-professional-ids` coverage/scheduling question, not a matching-quality one); genuine
`no-match` accounts for essentially none of the unhealed population (3 rows).

## Why `fixtures/` is never committed

`fixtures/` contains real trustee/case PII (case IDs, ACMS professional IDs, trustee identifiers)
pulled from staging exports. Gitignored (`test/integration/.gitignore`'s
`heal-sentinel-case-appointments-audit/fixtures/` rule) and must never be committed. Re-create it
locally per the format below before running this harness.

## Required fixture files

Place these in `fixtures/` (create the directory — it does not exist in the repo):

### `<date>-case-trustee-appointments.json`

A raw MongoDB export (as JSON array) of the `case-trustee-appointments` collection, sampled to
sentinel rows (`trusteeId === '00000000-0000-0000-0000-000000000000'`, `reason:
'trustee-not-found'`) — `CaseAppointment` documents (`common/src/cams/trustee-appointments.ts`)
plus the sentinel-only `reason`/`acmsProfessionalId` markers written by `migrate-case-appointments`.

By default the harness picks the lexically-newest (date-prefixed) file matching
`*case-trustee-appointments*.json` in `fixtures/`. Override with the `APPOINTMENTS_FIXTURE` env var
(filename only, relative to `fixtures/`).

### `<date>-trustee-professional-ids.json`

A raw MongoDB export (as JSON array) of the `trustee-professional-ids` collection —
`TrusteeProfessionalId` documents (`common/src/cams/trustee-professional-ids.ts`). Same format the
`sync-acms-professional-ids-audit` harness uses — reuse an existing export if one is already on
disk from that harness's fixtures (as long as the collection hasn't changed meaningfully since).

By default the harness picks the lexically-newest file matching `*trustee-professional-ids*.json`
in `fixtures/`. Override with `PROFESSIONAL_IDS_FIXTURE`.

## Usage (from test/integration/)

```bash
npm run heal-sentinel-case-appointments-audit
```

No `start-services.sh`/`seed`/`clean` steps — this harness never touches a database.

## Outcome categories

- `healed` — exactly one linked professional-id record for this sentinel's `acmsProfessionalId`;
  production would resolve and delete this sentinel.
- `no-mapping` — zero linked professional-id records; left in place for a future run.
- `ambiguous-mapping` — more than one linked professional-id record; left in place (the use case
  intentionally refuses to guess).
- `missing-acms-id` — the sentinel itself carries no `acmsProfessionalId`; left in place
  unconditionally, by design.
