# Trustee Identity Verification - Slice 4 Implementation Prompts

## Metadata

- **Slice:** 4 of 7
- **Slice Name:** Approval preview (Confirm Trustee Match)
- **Ticket:** CAMS-953 (GitHub #3187); bead `cams-c45pn.7`
- **Branch:** `CAMS-953-slice-4-case-coverage` (PRs target `CAMS-953-full-feature`)
- **Total Tasks:** 2
- **Status:** Ready for Implementation (2026-10-29)

## Implementation Overview

This slice replaces the identity task's "Confirm Trustee" modal with a "Confirm Trustee Match"
preview, and routes manual trustee search through the same preview. It is frontend only: no backend,
API or `common` behavior changes. The approval call stays
`Api2.patchTrusteeVerificationOrderApproval`.

## Task Sequence

1. **Confirm Trustee Match modal for candidates.** Rewrite `TrusteeMatchConfirmationModal` and wire
   it to the comparison table's Match Trustee button.
2. **Manual search opens the same modal, with no coverage check.** `TrusteeSearchModal` becomes a
   picker, and its appointment-coverage gate is removed.

Each task leaves the app deployable: all tests pass, typecheck, lint and build succeed.

---

## Task 1: Confirm Trustee Match modal for candidates

### Context

CAMS (bankruptcy case management for the U.S. Trustee Program) has a Data Verification screen. One
task type there is the trustee identity task, where a DXTR trustee record could not be matched
automatically to a CAMS trustee. Each task stores the matching pipeline's output as `findings`. The
accordion
`user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`
renders a comparison table. Its first column is the source record and each other column is a
candidate CAMS trustee. Each candidate column has a "Match Trustee" button
(`data-testid="approve-candidate-{trusteeId}"`, `aria-label="Match Trustee {name}"`, in
`TrusteeComparisonTable.tsx`).

The table model comes from `buildTrusteeComparison(findings, source)` in `trustee-comparison.ts`. It
returns:

```ts
type TrusteeComparison = {
  rows: { key: ComparisonRowKey; label: string }[]; // Name, Phone, Street, City, State, Zip, Email (DXTR only), Found by
  source: Record<ComparisonRowKey, string | undefined>;
  candidates: ComparisonCandidate[]; // { trusteeId, trusteeName, camsRaw, cells: Record<ComparisonRowKey, { value?: string; differs: boolean }> }
};
```

`differs` is read from the pipeline's stored scores. This is a project rule: the UI never re-runs or
re-invents a comparison. `TrusteeComparisonTable.tsx` has a local `DifferenceIcon` component, a
warning `Icon` whose accessible name is "{label} differs from the source record". A cell shows "Not
Provided" when it has no value, and a cell with no value never gets the icon.

Today, clicking Match Trustee calls `openConfirmation(candidate)`. That maps the candidate through
`toConfirmationCandidate` (accordion ~line 59) and opens `TrusteeMatchConfirmationModal.tsx`, which
has:

- heading "Confirm Trustee" and the text "Are you sure you want to confirm the appointment of the
  following trustee?"
- the trustee's contact block
- a "Confirm Appointment" submit, and a footer `LoadingSpinner` captioned "Confirming
  appointment..."

`handleApprove` in the accordion performs the approval. It guards with `isSubmittingRef`, sets
`isProcessing`, and always hides the modal in `finally`. Keep that behavior.

### Requirements

Replace the modal's content and behavior to match the UX mock:

1. **Heading** "Confirm Trustee Match".
2. **Question** paragraph: "Is this the same trustee as the information sent to CAMS?"
3. **Two side-by-side columns**, each a section with an `h3`:
   - **"Information Sent to CAMS"**: the source record's values, with no icons.
   - **"Selected CAMS Trustee"**: the chosen trustee's values. The name is a `NewTabLink` to
     `/trustees/{trusteeId}`.
   - Show one labelled field per comparison row, **excluding `foundBy`**. Use the rows from
     `comparison.rows`, so Email appears only for DXTR sources. Use the existing
     `AccessibleFieldValue` component
     (`@/lib/components/cams/AccessibleFieldValue/AccessibleFieldValue`) for each field.
   - A missing value shows "Not Provided".
   - Each field whose cell has `differs: true` **and** a value gets the warning icon. Export the
     existing `DifferenceIcon` from `TrusteeComparisonTable.tsx` and reuse it. Do not copy it.
4. **"What Happens Next"** `h3` followed by one sentence:
   - `"{n} cases will be assigned to {trusteeName}."`
   - `"1 case will be assigned to {trusteeName}."` when n is 1
   - `n` is the accordion's `headerCaseCount` (already computed as
     `Math.max(affectedCaseCount, 1)`). Zero-case text belongs to a later slice. Do not handle it.
5. **Submit button** label "Match Trustee". While `isProcessing` is true:
   - the label is "Matching Trustee..."
   - submit and Cancel are disabled
   - `closeOnClick: false` stays, so the modal stays open until the request settles
   - Replace the footer spinner caption "Confirming appointment..." with a `LoadingSpinner` that
     does not repeat the label. If an uncaptioned `LoadingSpinner` produces an axe violation, drop
     the footer spinner. The label change is the requirement.
6. **Inform only.** There is no acknowledgment checkbox, and nothing about appointment coverage
   appears in the modal.
7. Keep `modalId` `trustee-confirmation-modal-${id}` and the `data-testid`, so existing selectors in
   the e2e and a11y tests still resolve.

**Modal input.** Replace `ConfirmationCandidate` with a model built from the comparison, so the
modal's icons cannot disagree with the table's. Suggested shape, added to `trustee-comparison.ts`:

```ts
export type SelectedTrustee = Pick<ComparisonCandidate, 'trusteeId' | 'trusteeName' | 'cells'>;
```

`show(selected: SelectedTrustee)` takes the trustee. The modal also takes props for the source
values and rows (`comparison.rows` without `foundBy`, and `comparison.source`) and the case count.
Delete `ConfirmationCandidate` and `toConfirmationCandidate` once nothing uses them. Task 2 still
needs `handleManualMatch`, which passes `{ trusteeId, trusteeName }` to `approveTrustee`, so it does
not depend on `ConfirmationCandidate`. The candidate's appointments line in the old modal is
removed.

### Implementation Guidelines

- Follow TDD (Vitest + Testing Library). Write the modal tests first.
- Mock with `vi.spyOn`, not `vi.mock`. Select by id or `data-testid` first, then role and name.
- Put modal styles in `TrusteeMatchConfirmationModal.scss`. For the two-column layout, look at the
  existing `.trustee-comparison` / `.court-trustee-details` / `.trustee-details` styles in
  `TrusteeSearchModal.scss` and reuse that pattern. Use USWDS utilities and tokens, not hard-coded
  colors.
- The modal heading is an `h2` (rendered by `Modal`), so the section headings are `h3`.
- Write comments and copy with no temporal references ("new", "now", "previously").

### Files to Create/Modify

- `user-interface/src/data-verification/trustee-verification/TrusteeMatchConfirmationModal.tsx`:
  rewrite.
- `.../TrusteeMatchConfirmationModal.scss`: two-column layout.
- `.../TrusteeMatchConfirmationModal.test.tsx`: rewrite.
- `.../trustee-comparison.ts`: `SelectedTrustee` type, plus a helper if one helps.
- `.../TrusteeComparisonTable.tsx`: export `DifferenceIcon`.
- `.../TrusteeMatchVerificationAccordion.tsx`:
  - pass `comparison` rows and source plus `headerCaseCount` to the modal
  - `openConfirmation` passes the candidate's `SelectedTrustee`
  - `handleApprove` takes `SelectedTrustee`
- `.../TrusteeMatchVerificationAccordion.test.tsx`: update modal assertions.
- `test/e2e/playwright/trustee-match-verification.spec.ts`: update the "opens the confirmation
  modal" test.
- `user-interface/test/accessibility/data-verification.test.ts`: the existing confirmation-modal
  test (~line 120) keeps passing with the new content. Adjust waits or selectors only if needed.

### Acceptance Criteria

- [ ] Clicking Match Trustee on a candidate opens "Confirm Trustee Match" with the question text.
- [ ] Both column headings render. Every non-"Found by" row appears in both columns, and Email only
      for DXTR.
- [ ] A warning icon appears on exactly the fields where the candidate's cell `differs` and has a
      value. The source column has none.
- [ ] "What Happens Next" reads "1 case will be assigned to {name}." or "{n} cases will be assigned
      to {name}."
- [ ] The submit reads "Match Trustee", then "Matching Trustee..." (disabled, with Cancel disabled)
      while approval is in flight.
- [ ] Approval success and failure behave as before: success alert and focus on the resolved
      statement; error alert and the modal closes.
- [ ] No coverage or appointment information is shown in the modal.
- [ ] `npm run typecheck`, `npm run lint` and `npm run build` pass in `user-interface`. All
      `user-interface` tests pass.

### Testing Requirements

- [ ] **Modal unit tests:**
  - question and headings
  - fields per row, with Email absent for ACMS rows
  - icon only on differing fields with values
  - "Not Provided"
  - singular and plural sentence
  - "Match Trustee" / "Matching Trustee..." and disabled states
  - Cancel calls `onCancel` and hides
  - Submit calls `onConfirm` with the selected trustee
- [ ] **Accordion unit test:** Match Trustee on the second-ranked candidate opens the modal with
      that candidate's name and the task's case count. Confirm calls
      `patchTrusteeVerificationOrderApproval` with that trustee's id and name.
- [ ] **e2e** (`trustee-match-verification.spec.ts`) on the ambiguous task
      `e2e-trustee-match-verification-pending-1`:
  - choose `approve-candidate-seed-trustee-match-multi-b` (Tyler Multimatch)
  - assert the question text, both column headings and "1 case will be assigned to Tyler
    Multimatch."
  - assert the warning icons inside the "Selected CAMS Trustee" column, by accessible name: Name,
    Phone and Street differ for this candidate
  - Cancel
  - Do **not** submit. Backend coverage gate A rejects approval for this fixture trustee. The
    approval e2e specs are deferred to CAMS-956 (bead `cams-n9937`), which removes gate A. See "e2e
    specs deferred to CAMS-956" at the end of this file.
- [ ] **a11y:** the existing confirmation-modal axe test passes with the new modal open.

### Regression Testing

- [ ] The comparison table, "Why CAMS needs you" sentence and "How CAMS read this name" section are
      unchanged (Slice 3 tests pass).
- [ ] Manual search still approves exactly as before (Task 2 changes it).

---

## Task 2: Manual search opens Confirm Trustee Match, with no coverage check

### Context

On the trustee identity task (see Task 1 for the screen), "Search for a trustee" opens
`TrusteeSearchModal.tsx`. The verifier picks a district and searches by name
(`Api2.searchTrustees`), and the selected `TrusteeSearchResult`
(`{ trusteeId, name, address?, phone?, email?, appointments, matchType }`) is shown beside
"Information sent by court". Today the search modal's own "Confirm Appointment" submit approves
directly through the accordion's `handleManualMatch`.

The search modal also enforces case coverage:

- the `affectedCases` prop
- `getUncoveredCases(selectedTrustee.appointments, affectedCases)` at ~lines 208-219
- Confirm disabled, plus the message "Does not have an appointment covering case(s) …"

The product decision (2026-10-29) is that this screen shows no appointment-coverage information at
all; a separate case appointment verification screen handles uncovered cases. The **backend** gate
in `approveVerification`
(`backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.ts` ~lines
226-275) stays exactly as it is. An approval it rejects surfaces as the accordion's existing error
alert.

The accordion fetches a case summary for **every** affected case (`affectedCaseSummaries`, ~lines
270-300), but only two things use them:

- the search modal's coverage gate
- `originatingCaseSummary?.chapter`, which feeds the search modal's `chapter` prop (a server-side
  search filter, kept)

Task 1 added the "Confirm Trustee Match" modal (`TrusteeMatchConfirmationModal`, opened with
`show(selected: SelectedTrustee)`, where
`SelectedTrustee = Pick<ComparisonCandidate, 'trusteeId' | 'trusteeName' | 'cells'>` from
`trustee-comparison.ts`).

### Requirements

1. **Search modal becomes a picker.**
   - Its submit label becomes "Select Trustee".
   - The submit is disabled only when no trustee is selected (or `isProcessing`).
   - Its `onConfirm` callback hands the selected `TrusteeSearchResult` to the accordion. It does not
     approve.
2. **Accordion opens the preview.** On selection, hide the search modal, then open Confirm Trustee
   Match with a `SelectedTrustee` built from the result:
   - **If the result's `trusteeId` is one of `comparison.candidates`**, use that candidate's stored
     cells, so the icons match the table.
   - **Otherwise**, build cells from the result's values with `differs: false` for every row: name;
     phone through `formatPhoneWithExtension`; street from `address1..3` joined with ", "; city;
     state; zip; email. The pipeline never scored this trustee, and the UI must not invent a
     comparison, so the result has no warning icons.
   - Put this mapping in `trustee-comparison.ts` as a pure function, with unit tests.
3. **Approval goes through Task 1's path.** Confirming in the preview calls the same `handleApprove`
   as a candidate approval.
   - Delete `handleManualMatch`.
   - Cancel in the preview closes it. The search modal stays closed.
4. **Remove coverage gating from the search modal:**
   - the `affectedCases` prop and its doc comment
   - the `getUncoveredCases` / `AppointmentCoverageCase` imports
   - `uncoveredCases`, `hasUncoveredCases`, the `search-uncovered-cases-message` paragraph and its
     SCSS
5. **Narrow the accordion's case-summary fetch** to the originating case only (`order.caseId`), the
   only remaining consumer. Keep the existing gates (pending tasks only, after detail loads) and
   update the comment to match. Keep the search modal's `chapter`, `courtId` and `divisionCode`
   props.
6. **Keep `getUncoveredCases` and `AppointmentCoverageCase`** in
   `common/src/cams/trustee-appointments.ts`, with their tests. CAMS-956 (GitHub #3190, bead
   `cams-n9937`) reuses them. After this task no UI code calls them.
   - If `npm run knip` (repo root) flags them as unused exports, leave them and record it in the
     implementation notes. Do not delete them.
   - Rewrite doc comments that describe the removed UI check, so they no longer claim the Data
     Verification UI calls these functions. This includes the comments on `getUncoveredCases` and
     `isAppointmentMatch` ("the Data Verification UI's own pre-approval check").
   - Leave `isAppointmentMatch`'s code alone: the backend and trustee search use it.

### Implementation Guidelines

- TDD with Vitest + Testing Library. Mock with `vi.spyOn`, not `vi.mock`.
- Update the accordion test's "manual trustee search flow" block (~line 819). Its `getCaseSummary`
  fixture exists to satisfy the removed coverage gate.
  - Replace the coverage-gate tests with: select → preview opens with that trustee → confirm
    approves.
  - Add a test that a trustee whose appointments cover none of the cases can still be selected.
- Write comments and copy with no temporal references.

### Files to Create/Modify

- `user-interface/src/data-verification/trustee-verification/TrusteeSearchModal.tsx`, `.scss`,
  `.test.tsx`.
- `.../TrusteeMatchVerificationAccordion.tsx`, `.test.tsx`.
- `.../trustee-comparison.ts`, `trustee-comparison.test.ts`: search result → `SelectedTrustee`.
- `common/src/cams/trustee-appointments.ts`, `.test.ts`: remove `getUncoveredCases` if unused.
- `test/e2e/playwright/trustee-match-verification.spec.ts`: search-path test.
- `user-interface/test/accessibility/data-verification.test.ts`: search-path axe test.
- `user-interface/src/lib/testing/mock-api2.ts`: only if the fake `searchTrustees` returns nothing
  usable for the a11y test.

### Acceptance Criteria

- [ ] Selecting a search result and clicking "Select Trustee" closes search and opens "Confirm
      Trustee Match" for that trustee.
- [ ] A searched trustee who is also a candidate shows that candidate's stored warning icons. Any
      other searched trustee shows none.
- [ ] Confirming approves through the same path as a candidate (success alert, resolved statement
      focus, error alert on failure).
- [ ] The search modal never disables selection or shows a message because of appointment coverage.
- [ ] The accordion fetches a case summary only for `order.caseId`.
- [ ] `getUncoveredCases` and `AppointmentCoverageCase` remain in `common`, and their doc comments
      no longer describe a UI caller.
- [ ] Backend files are unchanged (`git diff --stat` shows no `backend/` changes).
- [ ] typecheck, lint, build and all tests pass in `common` and `user-interface`.

### Testing Requirements

- [ ] Unit tests for the search-result mapping: candidate reuse, non-candidate values with no
      `differs`, and missing fields.
- [ ] Search modal unit tests: "Select Trustee" label, disabled until selection, no coverage
      message.
- [ ] Accordion unit tests: search → preview → approve. Selecting a trustee with no covering
      appointment is allowed.
- [ ] **e2e:**
  - From an e2e pending task, open "Search for a trustee", search and select a seeded trustee, then
    assert the preview opens with that trustee's name and Cancel. Do not submit; the search-path
    approval e2e spec is deferred to CAMS-956 (see the end of this file).
  - Search filters server-side by the task's court, division and chapter, so check
    `test/e2e/fixtures/mongo-fixture.json` and `test/e2e/scripts/seed-database.ts` for a trustee
    that search returns for the chosen task.
  - If no seeded trustee is returnable, record that in the implementation notes and cover the path
    in unit and a11y tests only. Do not change the seeds for this.
- [ ] **a11y:** with the fake API (`CAMS_USE_FAKE_API=true`), open search, select a trustee, open
      the preview, run axe and Cancel.

### Regression Testing

- [ ] Task 1's candidate preview and approval are unchanged.
- [ ] Trustee search still filters by district, division and chapter.
- [ ] Slice 3 explanation, name section and table tests pass.

---

## Slice Completion Checklist

After implementing both tasks:

- [ ] All acceptance criteria met. Unit tests pass in `common`, `backend` and `user-interface`.
- [ ] e2e: run `npm run e2e` from `test/e2e/` (podman, `test/e2e/.env` from `.env.local.example`).
- [ ] a11y: run `npm run start:a11y`, then
      `npx playwright test --project=chromium     test/accessibility/data-verification.test.ts` in
      `user-interface`.
- [ ] **Integration harness** (`test/integration/trustee-match-scenarios/`): run unchanged as a
      regression check. This slice changes no backend behavior.
- [ ] No regressions to Slices 1-3.
- [ ] UX sign-off: the modal copy, and the searched trustee showing no warning icons.
- [ ] Write
      `test/bdd2/specs/CAMS-953/trustee-identity-verification.slice-4-implementation-notes.md`.
- [ ] Advance `test/bdd2/specs/CAMS-953/trustee-identity-verification.workflow-state.json` to Slice
      5, Phase 2.

---

## e2e specs deferred to CAMS-956

CAMS-956 (GitHub #3190, bead `cams-n9937`) owns these specs. They can't pass while backend gate A
exists. Gate A is in `TrusteeMatchVerificationUseCase.approveVerification`
(`backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.ts` ~lines
226-275). It rejects any approval whose trustee lacks an active appointment covering every affected
case, and the e2e fixture trustees have no covering appointments. Slice 4 does not write them. Add
them to `test/e2e/playwright/trustee-match-verification.spec.ts` when CAMS-956 removes gate A:

1. **Candidate approval through Confirm Trustee Match.**
   - On a pending task, click Match Trustee on a candidate, then click Match Trustee in the modal.
   - Assert that the button reads "Matching Trustee..." and is disabled while the request is in
     flight.
   - Assert the success alert "Trustee {name} appointed to …" and that the task shows the resolved
     statement "Trustee {name} was appointed to …", with focus on it.
2. **Search-path approval.** Search for a trustee, select one and click "Select Trustee". In Confirm
   Trustee Match, click Match Trustee, then assert the same success alert and resolved statement.
3. **Approving a trustee whose appointments do not cover every case succeeds.**
   - The approval is no longer rejected.
   - "What Happens Next" lists the case-assignment outcome plus the appointment-task outcome as
     bullets, e.g. "3 cases will be assigned to Henry Green." and "1 case in E.D. New York
     (Brooklyn), Chapter 7 will become a Trustee Appointment task."
   - This needs a pending multi-case identity task in the e2e fixture, which Slice 4 does not add.

Each approval mutates the seeded task, so run these specs on tasks no other spec reads, or reseed.
