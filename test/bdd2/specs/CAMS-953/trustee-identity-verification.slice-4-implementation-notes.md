# CAMS-953 Slice 4: Confirm Trustee Match — Implementation Notes

Started 2026-10-29. Bead: cams-c45pn.7. Branch: `CAMS-953-slice-4-case-coverage`. Frontend and
`common` doc comments only; `git diff --stat` shows no `backend/` changes.

## What Was Built

- **Task 1: Confirm Trustee Match modal for candidates.**
  - `TrusteeMatchConfirmationModal.tsx` was rewritten. It shows:
    - the heading "Confirm Trustee Match" and the question
    - the columns "Information Sent to CAMS" and "Selected CAMS Trustee", one `AccessibleFieldValue`
      per comparison row except Found by
    - "What Happens Next", with the sentence "N cases / 1 case will be assigned to {name}."
    - the submit "Match Trustee", which reads "Matching Trustee..." in flight
  - Props: `rows`, `source`, `caseCount`; `show(selected: SelectedTrustee)`. The modal filters out
    `foundBy` itself, so the accordion passes `comparison.rows` unchanged.
  - `SelectedTrustee` (`Pick<ComparisonCandidate, 'trusteeId' | 'trusteeName' | 'cells'>`) and
    `ComparisonRow` are exported from `trustee-comparison.ts`. `DifferenceIcon` is exported from
    `TrusteeComparisonTable.tsx` and reused, so table and modal icons cannot disagree.
  - `ConfirmationCandidate` and `toConfirmationCandidate` are deleted.
  - The footer spinner is an uncaptioned `LoadingSpinner`; the label change carries the meaning.
  - The modal is mounted only once `comparison` exists (it is only opened from the table or from
    search, both of which need it), so there is no empty-source placeholder.
  - The icon styles are repeated in `TrusteeMatchConfirmationModal.scss`, because the accordion's
    `.difference-icon` rules are scoped under `.trustee-match-content` and the modal renders outside
    it.
- **Task 2: Search opens the same modal, with no coverage check.**
  - `TrusteeSearchModal` is a picker: its submit is "Select Trustee" and is disabled only until a
    trustee is selected. `affectedCases`, `getUncoveredCases`, the uncovered-cases message and the
    `getCaseNumber` import are removed.
  - `selectedTrusteeFromSearch(result, candidates)` in `trustee-comparison.ts` reuses a candidate's
    stored cells, or builds cells from the result with `differs: false`. It shares a `toCells`
    helper with `toCandidate`.
  - The accordion's `handleSearchSelection` hides search, then opens Confirm Trustee Match.
    `handleManualMatch` is deleted; approval always goes through `handleApprove`.
  - The case-summary fetch is narrowed to `order.caseId` and stores only its chapter
    (`originatingCaseChapter`), with the same gates as before (pending task, detail loaded).
  - `getUncoveredCases`, `AppointmentCoverageCase` and their tests stay in `common`. Their doc
    comments, and `isAppointmentMatch`'s, no longer describe a UI caller. `npm run knip` is clean.
  - The fake API's `searchTrustees` (`mock-api2.ts`) returns "Riley Searchable" for a matching name
    (previously always `[]`), for the a11y search-path test.

## Decisions Made During Implementation

- **`isProcessing` removed from `TrusteeSearchModal`.** The prompt allowed keeping it as a disable
  condition, but the search modal is hidden before approval starts, so its spinner and disabled
  state could never render. Its three isProcessing tests were removed with it.
- **Unit test boundary.** On review, the accordion's candidate-preview test was narrowed to wiring
  (chosen trustee link, icon count, case count). The modal's own tests own the copy and icon labels.

## Not Done / Deviations

- **No search-path e2e spec.** No seeded trustee can be returned by the real trustee search for any
  pending e2e task:
  - The scenario trustees (Multimatch, Imperfectmatch, Stateline) have no trustee-appointments, so
    `trustee-search.use-case.ts:38` drops them when a `courtId` is passed.
  - The fixture's "Test Trustee" (`aaaabbbb-...0001`) has the only appointment, but it has no
    `phoneticTokens`, and `regenerateTrusteePii` renames it, so `searchTrusteesByNameScored` never
    returns it.
  - pending-1 also gets chapter 15 from `getCaseSummary` (its case is in the SQL fixture), which the
    Test Trustee's chapter 7 appointment would fail.

  Per the prompts, seeds were not changed; the search path is covered by unit and a11y tests. The
  CAMS-956 search-approval spec (cams-n9937) will need a seeded trustee with phonetic tokens and an
  appointment in court 0208.

- **Approval e2e specs** stay deferred to CAMS-956 (cams-n9937), as planned.
- **Integration harness** (`test/integration/trustee-match-scenarios/`) not re-run: no backend
  change.

## Verification

- `npm test` passes in `common` (1429), `backend` (4515) and `user-interface` (4088). Run tests
  through `npm test`, not bare `npx vitest`: the npm script sets the env vars (fake API, login
  provider) that Header, router and other suites need.
- typecheck, lint (0 errors), prettier, knip and backend coverage pass. The a11y build (`vite build`
  with the fake API) succeeds.
- **Playwright a11y and e2e: not yet run.** The a11y tests hard-code `http://localhost:3000`
  (`test/accessibility/test-constants.ts`), which a local dev server was occupying.

## Files Changed

- `user-interface/src/data-verification/trustee-verification/`: `TrusteeMatchConfirmationModal.tsx`,
  `.scss`, `.test.tsx`; `TrusteeComparisonTable.tsx`; `trustee-comparison.ts`, `.test.ts`;
  `TrusteeMatchVerificationAccordion.tsx`, `.test.tsx`; `TrusteeSearchModal.tsx`, `.test.tsx`
- `user-interface/src/lib/testing/mock-api2.ts`
- `user-interface/test/accessibility/data-verification.test.ts` (candidate modal waits for the new
  content; new searched-trustee axe test)
- `test/e2e/playwright/trustee-match-verification.spec.ts` (candidate preview test)
- `common/src/cams/trustee-appointments.ts` (doc comments only)
