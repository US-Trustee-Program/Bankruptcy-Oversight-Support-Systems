# Trustee Identity Verification - Feature Q&A Transcript

## Session Information

- **Date:** 2026-10-27
- **Ticket:** CAMS-953 (GitHub #3187, ticket 1 of 5; beads `cams-c45pn`)
- **Feature:** trustee-identity-verification
- **Branch:** `CAMS-953-trustee-mismatch-verification-on-pipeline` (no commits ahead of `main` at
  2012d0160)

## Sources

- GitHub #3187 (acceptance criteria, 6 refinement decisions, technical notes).
- Beads `cams-c45pn`, including the UX mock findings from Brian Posey's screens, reviewed
  2026-10-26: reason sentences, label changes, Confirm Trustee Match modal, "(Not yet in CAMS)".
- `bd` memory `professional-id-never-multi-linked`: an ACMS professional id links to at most one
  CAMS trustee. There is NO "multiple linked trustees" reason; the `cams-c45pn` description is wrong
  to list it.
- Sibling tickets #3188 (ACMS sync creates identity tasks), #3189 (daily ACMS appointment sync),
  #3190 (appointment tasks; removes CAMS-905 gate A), #3191 (DXTR switch).
- The claude.ai artifact `Gqe7YYhv9riCHPFAhtLjE8` could not be read (access denied). The user chose
  to proceed without it.

## Code baseline findings (main @ 2012d0160)

- `TrusteeMatchVerification`: `common/src/cams/trustee-match-verification.ts`. `CandidateScore`:
  `common/src/cams/dataflow-events.ts`. Reasons come from `TrusteeAppointmentSyncErrorCode`.
- The pipeline (`backend/lib/use-cases/dataflows/trustee-match-pipeline.ts`) is only called by the
  ACMS professional-id sync, which writes no verification tasks.
- Identity tasks are created only by the DXTR sync (`sync-trustee-case-appointments.ts`,
  `upsertMatchVerification`), using the old numeric scoring in `trustee-match.helpers.ts`.
- `PipelineMatch` is not exported. The pipeline `error` is a `CamsError`.
- The approval use case never writes `trustee-professional-ids`. `linkMethod: 'manual'` exists but
  has no writer.
- `upsertVerification` uses `replaceOne`.
- The GET controller has no DataVerifier role check; only PATCH has one.
- `backend/express/server.ts` has no trustee-match-verification route.
- UI: `TrusteeMatchVerificationAccordion.tsx` (1083 lines, not MVVM). `DataVerificationScreen.tsx`
  hard-codes `regionHeader = 'Region 02'`.
- No "gate A" or "appointment task" exists in code. CAMS-905 left `getUncoveredCases`
  (`common/src/cams/trustee-appointments.ts`), plus UI warnings and the use-case
  `isAppointmentMatch` check that rejects approval.

## Q&A Session

### Q: Decision 6. Are facts computed at match time or recomputed when the task opens?

A: **Stored at match time.** The screen renders the stored `findings`, with no recompute-on-open.
This overrides the ticket's recommendation.

### Q: Decision 4. Should candidates the pipeline drops for a state conflict be shown?

A: **No, not for T1.**

### Q: Decision 5. Should the approval preview only inform, or require acknowledgment?

A: **Inform only.** This matches the mocks' "What Happens Next" section.

### Q: Decision 3. How are possible duplicate CAMS trustees handled?

A: **Flag only.** There is no merge-workflow link.

### Q: Decision 2. What is the grade wording?

A: **exact / strong / weak.**

### Q: (2026-10-28, S2.6) How do stored scores map to the comparison table's markers?

A: **Binary, one marker.** The prototypes show a single warning icon on a field that differs; there
is no Agrees/Close/Differs/Conflicts/Not comparable scale.

- A field matches only on an exact stored agreement: name quality `exact`, phone `exact`, street
  closeness 1, city/state/zip/email `pass: true`. Anything else (including name `strong`/`weak` and
  a 1-2 digit phone typo) gets the warning icon.
- A field the pipeline could not compare (no score recorded, e.g. one side has no email) shows its
  value or "Not Provided" with no icon.
- State uses the same icon as every other field. This supersedes Decision 1's "only state gets
  conflict styling".

### Q: Decision 1. Is styling for phone, street and email differences neutral or a warning?

A: Neutral, as the acceptance criteria state. Only state gets conflict styling.

### Q: In T1, what should the DXTR writer do, given `matchCandidates` is removed?

A: **Refactor the DXTR sync/import onto the matching pipeline**, so the evidence output is stored on
the verification record as `findings`.

### Q: #3191 gates retiring the DXTR-only matcher on a backtest. Who decides match vs. task in T1?

A: **The pipeline decides.**

- A resolved match writes the appointment.
- Ambiguous or no-match creates an identity task with `findings`.
- The old DXTR numeric scoring is removed for identity matching.
- Follow-up: #3191's backtest wording needs updating to reflect this.

### Q: What happens to the IMPERFECT_MATCH, PERFECT_MATCH_INACTIVE_STATUS and CANDIDATE_LOAD_FAILED reasons?

A: Identity tasks use **only "ambiguous" and "no match"**.

- PERFECT_MATCH_INACTIVE_STATUS is an appointment mismatch, not trustee matching. It was wrongly
  conflated with matching.
- CANDIDATE_LOAD_FAILED is a transient dataflow error.
- Both are out of scope here: "we don't need to worry about this right now."
- "Imperfect" and "state differs" become "Why CAMS needs you" sentences derived from findings.

### Q: Should T1 include BDD tests?

A: **No.** The team has no BDD coverage and doesn't use BDD in its spec suite.

### Q: Which tests are required?

A: Unit tests, Playwright e2e (`test/e2e/playwright/trustee-match-verification.spec.ts`), Playwright
accessibility (`user-interface/test/accessibility/data-verification.test.ts`), and **new automated
integration tests under `test/integration/`**. The user mentioned "a ui harness for integration
tests separate from e2e". The assumption is that this means `test/ui-sandbox` (seed via
`scripts/seed.ts`). Confirm in Slice 2's Phase 2.

### Q: Do the proposed slices and their order look right?

A: Yes. Track the slices in beads for handoff.

## Slice Summary

1. **Queue labeling fixes:**
   - dynamic region heading
   - a list header per task type
   - alphabetical type filter with "Trustee Identity"
   - "Search for a trustee"
2. **Findings foundation:**
   - shared pipeline types move to `common`
   - the DXTR sync runs on the pipeline
   - `findings`, `source`, and the ambiguous/no-match reasons
   - merge-upsert
   - DataVerifier-only findings
   - title/header, "Source record (DXTR)", and a comparison table with markers
   - seeds and tests
3. **Explanations:**
   - "Why CAMS needs you" sentences
   - "How CAMS read this name"
   - the ACMS professional id in the header
   - a possible-duplicate flag
4. **Case coverage and approval preview:**
   - the "Covers these cases" row
   - a preview endpoint using `getUncoveredCases`
   - the Confirm Trustee Match modal
   - the gate A blocking list
   - "(Not yet in CAMS)"
5. **Identity tasks with no case:**
   - optional `caseId`/`courtId`
   - "No cases yet" text
   - a caseless seed
6. **Approval links the ACMS professional id:**
   - upsert a `manual` link first
   - then delete the fingerprint-keyed records
7. **Many candidates and search:**
   - paginate 5 per page
   - coverage filter C optional in trustee search

## Open items carried to Phase 2

- Confirm which harness the "ui harness" is: `test/ui-sandbox` or a new `test/integration/<name>`.
- The `cams-c45pn` description still lists "multiple linked trustees". It should be corrected.
- #3191's "retire the DXTR-only matcher after backtest" wording conflicts with T1 retiring it now.
- The pipeline is ACMS-shaped (`normalizeAcmsSourceName`, `scoreAcmsHasAddressAndPhone`). Slice 2
  design must cover adapting a DXTR source record (`DxtrTrusteeParty`) to `ProjectedTrustee`.
- MVVM refactor of the accordion (per the #3187 technical notes): decide in Slice 2 whether to do it
  then or incrementally.
