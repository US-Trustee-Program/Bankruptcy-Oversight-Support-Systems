# CAMS-953 Slice 2: Findings foundation — Implementation Notes

Implemented 2026-10-27 to 2026-10-28. Bead: cams-c45pn.5 (S2.1-S2.8: cams-c45pn.5.1, .5.7, .5.2,
.5.8, .5.3, .5.4, .5.9, .5.5).

## What Was Built

- **Pipeline types in common (S2.1).** `common/src/cams/trustee-match-pipeline.ts` holds the
  trustee-match pipeline's serialized types (`TrusteeSerializedState`, `SerializedCandidate`,
  `ScoreByScorer`, ...), plus the shared ranking: `compareByNameQuality`,
  `compareByAddressPointsThenNameQuality` and `rankCandidates`. The pipeline's resolve stages and
  the UI both rank with these, so "pipeline rank order" has one definition.
- **Identity task shape (S2.2, S2.7).** `TrusteeMatchVerification` carries required `source`
  (`'ACMS' | 'DXTR'`), required `findings` (the pipeline's serialized state, stored unchanged) and
  `mismatchReason: 'ambiguous' | 'no match'`. `matchCandidates` is gone, and so is the legacy
  `TrusteeAppointmentSyncErrorCode` vocabulary (the DLQ message only ever carries
  `SoftCloseWriteFailed`). List items carry `source` but never `findings`, and no longer carry
  `candidateCount`/`preselectedCandidate`.
- **Merge-upsert (S2.3).** `upsertVerification` uses `findOneAndUpdate` + `$setOnInsert`; it never
  clears a case link and never changes a non-pending task.
- **DXTR sync on the pipeline (S2.4).** A resolved match writes the case appointment, recording
  `checks.matchedTrusteeAppointment` (does an appointment cover the case) and `checks.matchedBy`; an
  unresolved one writes a pending identity task (2+ candidates `'ambiguous'`, 0-1 `'no match'`).
- **Access and logs (S2.5).** The verification controller requires `CamsRole.DataVerifier` for every
  method (GET list, GET by id, PATCH). No logger/telemetry call or error payload carries a task
  document or findings.
- **Comparison table (S2.6).** `trustee-comparison.ts` maps findings to rows;
  `TrusteeComparisonTable` renders a semantic `<table>` (source column first, candidates in rank
  order, `<th scope>`, Match Trustee per candidate in `<tfoot>`). The accordion header shows the
  reason label (Multiple matches / No match), a DXTR `Tag` and the case count.
- **Legacy retired (S2.7, S2.8).** The numeric scorer used only by DXTR identity matching
  (`calculateCandidateScore`, `resolveNameCollisionByScoring`, district/division and chapter
  scorers, `CandidateScore`, `calculateTotalScore`, `UNSCORED`) is removed. `matchTrusteeByName`
  stays (it is the pipeline's `recallByName` stage) and its ambiguous result now returns
  `trusteeIds`. The per-field scorers (`calculateName/Phone/Email/AddressScore`) stay:
  `migrate-trustees.ts` and the CAMS-876 ACMS research scripts use them. The CAMS-880
  weight-backtest harness is deleted.
- **Seeds (S2.7).** Every seed writes source + findings as the DXTR sync would; `MockData` gained
  `getTrusteeMatchCandidate`/`getTrusteeMatchFindings`/`getTrusteeMatchVerification`; the seed
  validator `assertTrusteeMatchFindingsValid` rejects a score recorded for a comparison with no data
  on one side. See `trustee-identity-verification.test-data.md`.

## Decisions Made During Implementation

All recorded with the user on 2026-10-28; the marker decision is also in `feature-qa.md` and the
feature file.

- **Markers are binary.** One warning icon when a field does not match exactly (name quality
  `exact`, phone `exact`, street closeness 1, city/state/zip/email pass). A field the pipeline could
  not compare shows its value or "Not Provided" with no icon. State uses the same icon (supersedes
  decision 1's "only state gets conflict styling").
- **No legacy tasks exist**, so the accordion renders only from findings; there is no compatibility
  branch.
- **Approval** keeps the confirmation modal and the backend's per-case coverage check; the
  client-side coverage gate is skipped for findings candidates (they carry no appointments). Slice 4
  brings coverage back to the UI.
- **Seeds mirror real sync output** (0-1 candidates = no match, 2+ = ambiguous). The feature
  scenario "Every candidate is shown for no-match tasks" (3 candidates) is covered by a unit test,
  not a seed. Inactive-status scenarios were dropped from every seed: they are appointment concerns
  (CAMS-956), not identity tasks.
- **Telemetry** (`TrusteeMatchVerificationResolved`) keeps its property names
  (`wasPreselectedConfirmed`, `selectedCandidateRank`, `candidateCount`) so the analytics workbook
  needs no change; values are now computed from the findings in rank order.

## Key Integration Points

- `common/src/cams/trustee-match-pipeline.ts` — serialized types, ranking, `rankCandidates`.
- `common/src/cams/trustee-match-verification.ts` — task shape, `IdentityMismatchReason`.
- `backend/lib/use-cases/dataflows/sync-trustee-case-appointments.ts` — pipeline outcome →
  appointment or identity task.
- `backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.ts` — list,
  detail and approval (telemetry ranking).
- `backend/lib/controllers/trustee-match-verification/trustee-match-verification.controller.ts` —
  DataVerifier role on every method.
- `user-interface/src/data-verification/trustee-verification/` — `trustee-comparison.ts`,
  `TrusteeComparisonTable.tsx`, `TrusteeMatchVerificationAccordion.tsx`,
  `TrusteeMatchConfirmationModal.tsx` (now takes `ConfirmationCandidate`).

## Learnings for Future Slices

- **Hand-derived scores drift.** Seed findings are scored by hand from the scorer rules; two of the
  first values were wrong (street closeness for "301" vs "300 Match Ave" is 2/3, not 0.5). Slice 3's
  explanation sentences read these scores directly, so a seed generator that runs the real pipeline
  against fixture records would be safer than more hand-written findings.
- **Rebuild common before backend typecheck.** Backend resolves `@common` against the built output,
  so a stale `common` build reports false type errors.
- **The e2e compiled image used to go stale silently.** `run-e2e-workflow.sh` reused
  `localhost/e2e_built` whenever it existed; it now compares an `e2e.built.hash` label (source files
  `Dockerfile.built` copies, plus the deps image id) and rebuilds on mismatch.
  `FORCE_REBUILD_BUILT=true` forces it.
- **Fixture ids end up in ARIA.** The accordion uses the task id in `aria-controls`; an id with a
  space is two ID references. Real ids are UUIDs, but keep fixture ids space-free.
- **`mock-api2.ts` ships in the app bundle** (statically imported by `api2.ts`); importing
  `MockData` there would pull faker into production. Its fixtures are plain literals.
- **Pipeline candidates carry no appointments.** Slice 4's coverage row needs the backend to fetch
  the candidates' appointments (the detail endpoint no longer enriches anything).

## Testing Notes

- Unit: common 1417, backend 4495, user-interface 4053, dev-tools 302 — all pass. Lint, typecheck
  and knip clean.
- Integration (`test/integration/trustee-match-scenarios`, rewritten onto pipeline outcomes, run
  locally against SQL Edge + Mongo): 65 checks pass, 0 fail. Scenarios 2/3/7 auto-link with
  `matchedTrusteeAppointment: true`; 4 (inactive appointment) and 5 (no appointments) auto-link with
  `false` and no identity task; 6 is a `'no match'` task with no candidates; 8 is an `'ambiguous'`
  task with both tied trustees; 11 proves an approved task is not rewritten. Stage 10 (chapter
  scorer) removed with the scorer. The search, remap and normalization harnesses were updated and
  typecheck clean but were not run.
- A11y (`user-interface/test/accessibility/data-verification.test.ts`, new identity-task test): both
  tests pass in Microsoft Edge. Chromium did not run: its Playwright browser is not installed on
  this machine.
- E2E (`npm run e2e`, podman): 18 passed, 1 skipped (a pre-existing `test.skip` in
  `trustees.spec.ts`). `trustee-match-verification.spec.ts` was rewritten against the 4 findings
  tasks. The first run tested a 3-month-old cached compiled image (`localhost/e2e_built`), which
  crashed every Data Verification spec; `run-e2e-workflow.sh` now stamps that image with a source
  hash and rebuilds when it no longer matches.

## Deviations from Design

- The S2.8 bead proposed a new `test/integration/trustee-identity-verification` harness; the user
  chose to rewrite `trustee-match-scenarios` onto pipeline outcomes instead (one harness for DXTR
  sync correctness, reusing its SQL/Mongo seeding).
- The feature file's five-marker scale (Agrees exact/strong/weak, Close, Differs, Conflicts, Not
  comparable) was replaced by the binary marker above, per the prototypes.
