# Trustee Identity Verification - Slice 1 Design

## Metadata
- **Slice:** 1 of 7
- **Slice Name:** Queue labeling fixes
- **Ticket:** CAMS-953 (GitHub #3187); beads `cams-c45pn.1`
- **Dependencies:** None
- **User Value:** The verifier sees accurate queue labels instead of hard-coded or stale text.
- **Status:** In Design (2026-10-27)

## Slice Scope

**In scope (UI only, `user-interface/`):**
1. Remove the hard-coded region heading. `DataVerificationScreen.tsx` sets `const regionHeader = 'Region 02'` (with a `// TODO: This needs to be dynamic!`) and renders it as an `<h2>`. Delete both. Decision 2026-10-27: remove, don't derive.
2. List header. Keep one mixed accordion list. Rename the first column header from "Court District" to **"Subject"**.
   - Transfer and consolidation rows keep showing the court name.
   - Trustee identity rows show the source trustee's name: `dxtrTrustee.fullName` on `TrusteeMatchVerificationListItem`, which is available today.
   - The other headers stay as they are: "Order Filed", "Task Type", "Task Status".
3. Task type filter.
   - Options in alphabetical order: Consolidation, Transfer, Trustee Identity. Each stays gated by its feature flag.
   - Label "Trustee Identity" replaces "Trustee Mismatch".
   - The task-type value `'trustee-match'` stays unchanged.
   - The default selections (the `useEffect` that seeds `typeSelections`) use the same order and labels.
4. `taskType` label map (`user-interface/src/lib/utils/labels.ts`): `'trustee-match'` maps to "Trustee Identity". This also changes the accordion row's Task Type cell.
5. Accordion link text: "Search for a different trustee" and "Search for a different trustee." (`TrusteeMatchVerificationAccordion.tsx`, two places) become "Search for a trustee".

**Out of scope:**
- "Trustee Appointment" filter option. Deferred to #3190, when that task type exists.
- Accordion title, header badges, "Source record (…)", the comparison table. These are Slice 2.
- Renaming "Order Filed" for identity tasks. Not requested; noted as an open question.
- MVVM refactor of `TrusteeMatchVerificationAccordion.tsx`. Revisited in Slice 2.
- Any backend or data change.

## Strategic Design Decisions

### Architecture approach
This is a presentation-only change inside the `data-verification` feature folder (screaming architecture), with no new boundaries. Labels stay centralized in `lib/utils/labels.ts`, the existing shared-label home. The screen derives its filter options from one ordered list, so the alphabetical order lives in one place.

### Component responsibilities
- **UI layer:** `DataVerificationScreen.tsx` owns the heading removal, column headers and filter options. `TrusteeMatchVerificationAccordion.tsx` owns its Subject cell and link text. `TransferOrderAccordion.tsx` and the consolidation accordion read `fieldHeaders[0]` for their aria-labels and `data-cell`, so they pick up "Subject" with no other change.
- **Use case / gateway / repository / API:** no change.

### Trade-offs and decisions
1. **Remove the region heading rather than derive it.**
   - Alternative: distinct `regionName` values from the session's offices (`UstpOfficeDetails.regionName`).
   - Rationale: the #3187 AC says "removed". A user can also belong to more than one region, which makes a single heading misleading.
2. **One list with a "Subject" column, not a section per task type.**
   - Alternative: group the accordions into a section per task type, each with its own header row.
   - Rationale: smallest change, it matches the mock's "Subject" column, and it keeps sorting and filtering behavior as it is.
3. **Keep the domain value `'trustee-match'` and change only the label.**
   - Rationale: the value is stored on documents (`taskType`) and in session storage (`cams:filter:data-verification:type`). Renaming it would be a data migration with no user value.
4. **Stale session-stored filter labels.**
   - Problem: `typeSelections` is persisted with its labels (`useSessionState` under `TYPE_FILTER_SESSION_KEY`). A user with an existing session would still see "Trustee Mismatch" as a selected chip.
   - Decision: when reading the stored selections, re-derive each label from the current options by `value`. The alternative, bumping the session key, would discard the user's filter.

## Integration points
- `fieldHeaders` is passed to all three accordions and used in aria-labels. Screen-reader output changes from "Court District – X" to "Subject – X".
- Existing tests that assert the old strings:
  - `user-interface/src/data-verification/DataVerificationScreen.test.tsx` (lines ~509, ~931, ~990)
  - `TrusteeMatchVerificationAccordion.test.tsx`
  - `test/e2e/playwright/trustee-match-verification.spec.ts:26` (comment)
  - `test/e2e/playwright/transfer-orders.spec.ts:35` (comment)
  - any e2e selectors that use the filter option text "Trustee Mismatch" or the "Region 02" heading

## Testing strategy
- **Unit (Vitest + Testing Library):**
  - no "Region 02" heading
  - first column header is "Subject"
  - identity rows show the trustee's `fullName` in the Subject cell
  - filter options are in alphabetical order and include "Trustee Identity"
  - a stale stored selection labeled "Trustee Mismatch" renders as "Trustee Identity"
  - the link text reads "Search for a trustee"
- **Playwright e2e:** update `trustee-match-verification.spec.ts` and `transfer-orders.spec.ts` filter interactions to use the new label.
- **Playwright a11y:** `user-interface/test/accessibility/data-verification.test.ts` passes. Removing the `<h2>` must not break heading order: h1 "Data Verification" is followed by the list's h3 column headers. Check whether axe flags the h1→h3 skip (`heading-order`). If it does, raise the column headers' level or change the markup, and record which.
- **Integration (`test/integration/`):** none for this slice. There is no backend or data change, so a harness would assert nothing a unit test doesn't.

## Test data
No new test data. The existing seeds already produce transfer, consolidation and trustee-match tasks: `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`, `test/e2e/scripts/seed-database.ts`, `test/ui-sandbox/scripts/seed.ts`. See `trustee-identity-verification.test-data.md`.

## Open questions for Phase 3
- Does removing the h2 trigger axe `heading-order`? Answer during implementation; the fix is in scope.
- "Order Filed" is a misleading header for identity tasks (it shows `taskDate`). Should it be renamed now (e.g. "Date") or left alone? Default: left alone, raised with UX.

## Design Q&A Summary (2026-10-27)
- Q: What should replace "Region 02"? A: Remove the heading.
- Q: What does "a list header per task type" mean? A: One list; the first column becomes "Subject" (court for orders, trustee name for identity tasks).
- Q: Add the "Trustee Appointment" filter option now? A: Defer to #3190.
