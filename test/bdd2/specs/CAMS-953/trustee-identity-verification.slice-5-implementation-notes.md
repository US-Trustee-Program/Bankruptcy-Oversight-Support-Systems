# CAMS-953 Slice 5: Identity tasks with no case — Implementation Notes

Started 2026-10-30. Bead: cams-c45pn.8. Branch: `CAMS-953-slice-5-no-case-identity-tasks`. Merged to
`CAMS-953-full-feature` via PR #3221 (`ecd945dd4`).

## What Was Built

- **Task 1: Optional `caseId`/`courtId`.** `TrusteeMatchVerification.caseId`/`.courtId` are now
  optional. `resolveCourtName` and `approveVerification`'s telemetry
  (`trustee-match-verification.use-case.ts`) no longer assume a `caseId` exists.
  `TrusteeMatchVerificationAccordion`'s division-code lookup and case-summary-fetch effect are
  guarded against a missing `caseId`. No visible copy change in this task.
- **Task 2: Caseless/zero-case copy.**
  - Pending caseless task: "No cases yet. Cases attach as appointments sync." (distinct from
    `cams-wtf4i`'s has-a-case zero-surrogate "No cases affected yet.").
  - Resolved task: any task with an empty `affectedCaseIds` snapshot now reads "Trustee {name} was
    approved. No cases affected." with no case link, regardless of why the snapshot is empty. This
    is a uniform behavior change (see Decisions below) — it also fixed a broken
    `/case-detail/undefined` link for caseless tasks.
  - Confirm Trustee Match modal's "What Happens Next" zero-case sentence is now driven by
    `caseCount === 0` directly (the `Math.max(affectedCaseCount, 1)` floor was removed), which also
    fixed a gap in `cams-wtf4i`'s own scope (its modal was never updated for the zero-case state it
    created).
  - Follow-up fix (`964bd5f4b`, Sourcery finding confirmed by mattstankey on PR #3221): the
    caseless-task success alert was picking the singular-case branch when `affectedCaseCount` was 0,
    formatting the absent case id as a blank case number. Added a dedicated zero-case message.
- **Task 3: Caseless seed + e2e/a11y coverage.**
  - New pending seed task `seed-match-no-case` (dev-tools `trustee-match-all-scenarios.ts`) with no
    `caseId`/`courtId` keys at all and no surrogate `CASE_APPOINTMENT` row, reusing a dedicated
    fixture scenario key (`multipleCandidatesNoCases`) rather than an existing key — the less-code
    option (reusing `multipleCandidates`) was available per the prompt but a dedicated key was used
    instead.
  - Fixed `CASE_NO_CASES`'s `courtId` from `'0208'` (S.D.N.Y.) to `'0209'` (Buffalo, matching every
    other Buffalo-091 seed task).
  - Playwright e2e (`trustee-match-verification.spec.ts`): expands the caseless task, asserts the
    pending copy, opens Confirm Trustee Match, asserts the modal's zero-case sentence. Does not
    submit approval (gate A still rejects fixture trustees, per Slice 4's notes).
  - Playwright a11y (`data-verification.test.ts`): axe scan of the caseless task's pending state.
  - `mock-api2.ts` fake-API fixtures updated for the new seed task.
  - Seeded into Azure dev (`cosmos-mongo-ustp-cams-dev`) via
    `npm run seed:local -- --scenario=trustee-match-all-scenarios`; confirmed no fingerprint/variant
    collisions.

## Decisions Made During Implementation

- **Uniform "No cases affected" resolved copy (supersedes `cams-0l5bm`).** Rather than adding a
  data-model flag to distinguish a legacy missing `affectedCaseIds` snapshot (pre-snapshot feature,
  real appointment exists) from a new explicit empty one (zero surrogates at approval time, no
  appointment), the resolved statement now trusts whatever is stored at face value. This
  intentionally stops distinguishing the two cases `cams-0l5bm` described; that bug was closed as
  superseded by this decision. An existing resolved-statement test's assertion was updated rather
  than only adding new tests.
- **Dedicated fixture key over reuse.** The prompt said either reusing `multipleCandidates` under a
  new seed id, or adding a dedicated fixture key, was acceptable, with reuse as the recommended
  default "unless you find a reason to add a new fixture key." A dedicated key was used instead —
  same pattern `cams-wtf4i` (zero-surrogate scenario) had used.

## Not Done / Deviations

- **Integration harness (`test/integration/trustee-match-scenarios/`) not extended for the caseless
  task**, despite slice-5-prompts.md Task 3 requirement #7 asking for store/list/open/approve
  coverage there. That harness drives `SyncTrusteeCaseAppointmentsUseCase` against a real DXTR SQL
  Server fixture — the DXTR sync write path can never produce a caseless task (no case means no DXTR
  case event to sync), so there is no way to reach this seed task through that harness as written.
  Equivalent store/list/open/approve coverage for the caseless shape instead lives in backend unit
  tests (`trustee-match-verification.use-case.test.ts`) and the dev-tools seed test
  (`trustee-match-all-scenarios.test.ts`), plus the Playwright e2e/a11y coverage above for the UI
  path. This gap should be flagged to whoever designs Slice 6 / CAMS-954 (the ACMS sync producing
  real caseless tasks) — once that producer exists, it may open a real integration-test path for
  this scenario that doesn't exist today.
- **Playwright e2e was written but not executed in this environment** — no Docker/local Mongo was
  available to run the e2e suite against a live stack. The a11y suite was run locally and passed.
  The e2e spec should be run and confirmed green in an environment with the full stack available
  before this is treated as fully verified end-to-end.

## Verification

- `common` 1432, `backend` 4524, `dev-tools` 320 (+1 skip), `user-interface` 4128 tests passing;
  typecheck/lint/knip clean across every workspace.
- Playwright a11y run locally and passing.
- Playwright e2e and the integration harness were not run/extended — see Deviations above.

## Files Changed

- `common/src/cams/trustee-match-verification.ts`
- `backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.ts`
- `user-interface/src/data-verification/trustee-verification/`:
  `TrusteeMatchVerificationAccordion.tsx`, `.test.tsx`; `TrusteeMatchConfirmationModal.tsx`,
  `.test.tsx`
- `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`, `.test.ts`
- `dev-tools/db_scripts/lib/trustee-match-scenario-seeds.ts` (via shared `identityTaskFields`
  helper)
- `common/src/cams/test-utilities/trustee-match-findings.scenarios.ts`,
  `trustee-match-findings.generated.json`
- `test/e2e/fixtures/mongo-fixture.json`
- `test/e2e/playwright/trustee-match-verification.spec.ts`
- `user-interface/test/accessibility/data-verification.test.ts`
- `user-interface/src/lib/testing/mock-api2.ts`
