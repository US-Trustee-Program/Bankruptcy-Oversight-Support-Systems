# Trustee Identity Verification - Slice 1 Implementation Prompts

## Metadata

- **Slice:** 1 of 7
- **Slice Name:** Queue labeling fixes
- **Ticket:** CAMS-953 (GitHub #3187); beads `cams-c45pn.1`
- **Total Tasks:** 1
- **Status:** Ready for Implementation (2026-10-27)

## Implementation Overview

Slice 1 is a UI-only relabeling of the Data Verification queue in `user-interface/`. It has no
backend, API or data changes. It is a single task because reordering the filter breaks index-based
Playwright selectors, and they must be fixed in the same change to stay shippable.

## Task Sequence

1. Data Verification queue labeling fixes, with the unit, e2e and a11y updates.

---

## Task 1: Data Verification queue labeling fixes

### Context

CAMS (bankruptcy case management for the U.S. Trustee Program) is a TypeScript monorepo: React 19 +
Vite in `user-interface/`, Vitest + Testing Library unit tests colocated as `*.test.tsx`, and
Playwright e2e in `test/e2e/playwright/`.

The Data Verification screen (`user-interface/src/data-verification/DataVerificationScreen.tsx`)
lists three task types in one mixed accordion list:

- transfer orders (`TransferOrderAccordion.tsx`)
- consolidation orders (`consolidation/ConsolidationOrderAccordion.tsx`)
- trustee identity tasks (`trustee-verification/TrusteeMatchVerificationAccordion.tsx`, task type
  value `'trustee-match'`)

Users with the DataVerifier role work this queue. This change (CAMS-953, GitHub #3187) fixes stale
and hard-coded labels before a larger rebuild of the trustee identity screen. The UX mocks and team
decisions on 2026-10-27 set the following:

- The hard-coded region heading is removed, not made dynamic.
- One mixed list stays. Its first column header becomes "Subject": the court for orders, the source
  trustee's name for trustee identity tasks.
- The task-type label "Trustee Mismatch" becomes "Trustee Identity". The stored value
  `'trustee-match'` does not change, because it is persisted on documents and in session storage.
- The task-type filter is alphabetical. A "Trustee Appointment" option is NOT added; ticket #3190
  adds it later.

### Requirements

1. **Remove the region heading.** In `DataVerificationScreen.tsx`, delete
   `const regionHeader = 'Region 02';`, its `// TODO: This needs to be dynamic!` comment, and the
   `<h2>{regionHeader}</h2>` it renders.
2. **Rename the first column header to "Subject".**
   - In `DataVerificationScreen.tsx`, `accordionFieldHeaders` becomes
     `['Subject', 'Order Filed', 'Task Type', 'Task Status']`.
   - Transfer and consolidation accordion rows keep rendering the court name in that cell. They
     already read `fieldHeaders[0]` for `aria-label` and `data-cell`, so they need no change beyond
     picking up the new header text.
3. **Show the trustee's name in the Subject cell of trustee identity rows.**
   - In `TrusteeMatchVerificationAccordion.tsx`, the accordion heading's first cell (currently
     `{courtName}`, with `aria-label={`${fieldHeaders[0]} – ${courtName}.`}`) renders
     `order.dxtrTrustee.fullName` instead.
   - Change the aria-label to match: `Subject – {fullName}.`
   - Keep `courtName` wherever else the accordion uses it (the expanded body).
4. **Relabel the task type.** In `user-interface/src/lib/utils/labels.ts`, `taskType` maps
   `'trustee-match'` → `'Trustee Identity'`. Check `TrusteeMatchVerificationAccordion.tsx` for its
   own reason-based heading labels ("Multiple Matches", "Inactive Trustee"): leave those as they are
   and change only the fallback that comes from `taskType`.
5. **Make the task-type filter alphabetical.**
   - In `DataVerificationScreen.tsx`, the `#task-type-filter` `ComboBox` options and the defaults
     `useEffect` both use the order Consolidation, Transfer, Trustee Identity.
   - Each option stays gated by its feature flag (`CONSOLIDATIONS_ENABLED`,
     `TRANSFER_ORDERS_ENABLED`, `TRUSTEE_VERIFICATION_ENABLED`).
   - Define the ordered options once (one array or a small function) and use it in both places, so
     order and labels cannot drift.
6. **Fix stale session-stored labels.**
   - `typeSelections` is persisted through `useSessionState(TYPE_FILTER_SESSION_KEY, [])`, with key
     `'cams:filter:data-verification:type'`, as `{value, label}` objects.
   - A user whose session holds `[{value:'trustee-match', label:'Trustee Mismatch'}]` must see
     "Trustee Identity".
   - When using the stored selections, re-derive each label from the current options by `value`. Do
     not change the session key, since that would drop the user's saved filter.
7. **Change the link text.** In `TrusteeMatchVerificationAccordion.tsx`, the two `linkLabel` values
   "Search for a different trustee" and "Search for a different trustee." become "Search for a
   trustee".

### Implementation Guidelines

- Follow TDD: update or add the failing test first, then change the code.
- Unit tests:
  - Mock with `vi.spyOn()`.
  - Selector priority: ID, then `data-testid`, then class.
  - Testing Library `getByRole` with a `name` is already used in these files for links and headings.
- Keep labels in `lib/utils/labels.ts`. Don't scatter string literals.
- Don't add a "Trustee Appointment" option, and don't change the `'trustee-match'` value anywhere.
- No backend, common or seed changes.

### Files to Create/Modify

- `user-interface/src/data-verification/DataVerificationScreen.tsx`: remove the heading, rename the
  header to Subject, add the ordered filter options, re-derive session labels.
- `user-interface/src/data-verification/DataVerificationScreen.test.tsx`: update the assertions that
  expect "Trustee Mismatch" (around lines 509, 931, 990) and add the new cases.
- `user-interface/src/lib/utils/labels.ts`: `'trustee-match'` → `'Trustee Identity'`.
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`:
  Subject cell shows the trustee name; link text.
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.test.tsx`:
  - `fieldHeaders` fixture (line ~19)
  - "Trustee Mismatch" assertions (lines ~163, ~2106–2112, ~2256–2260; the `not.toContain` cases at
    ~2000 and ~2253 stay valid but update their wording)
  - "Search for a different trustee" assertions (lines ~916, ~925, ~951)
- `user-interface/src/data-verification/TransferOrderAccordion.test.tsx` (line ~85) and
  `consolidation/ConsolidationOrderAccordion.test.tsx` (line ~79): `fieldHeaders` fixtures become
  `'Subject'`, and any aria-label assertion that includes "Court District".
- `test/e2e/playwright/transfer-orders.spec.ts` (lines ~35–38),
  `test/e2e/playwright/consolidation-orders.spec.ts` (lines ~28–31),
  `test/e2e/playwright/trustee-match-verification.spec.ts` (lines ~26–29):
  - These deselect filter options BY INDEX (`task-type-filter-option-item-N`).
  - Old order: 0 Transfer, 1 Consolidation, 2 Trustee. New order: 0 Consolidation, 1 Transfer, 2
    Trustee Identity.
  - Preferred fix: select options by visible label text, if `ComboBox` option items expose it. That
    makes the specs order-independent.
  - Otherwise update the indices:
    - transfer-orders deselects 0 and 2
    - consolidation-orders deselects 1 and 2
    - trustee-match-verification still deselects 0 and 1
  - Update the comments that say "Trustee Mismatch".
- `user-interface/test/accessibility/data-verification.test.ts`: change only if needed (see the
  heading-order criterion).

### Acceptance Criteria

- [ ] The Data Verification screen renders no "Region 02" text and no region `<h2>`.
- [ ] The first column header reads "Subject".
- [ ] Transfer and consolidation rows show the court name in the Subject cell.
- [ ] Trustee identity rows show `dxtrTrustee.fullName` in the Subject cell, with aria-label
      `Subject – {fullName}.`
- [ ] Filter options appear as Consolidation, Transfer, Trustee Identity, each only when its flag is
      on. "Trustee Mismatch" and "Trustee Appointment" do not appear.
- [ ] Default filter selections use the same order and labels.
- [ ] A session-stored selection `{value:'trustee-match', label:'Trustee Mismatch'}` renders as
      "Trustee Identity" and still filters to trustee identity tasks.
- [ ] Task Type cells for trustee identity rows read "Trustee Identity". Reason-based labels such as
      "Multiple Matches" and "Inactive Trustee" are unchanged.
- [ ] The accordion shows a "Search for a trustee" link in both places that used to say "Search for
      a different trustee".
- [ ] Heading order is valid after removing the h2: `h1` "Data Verification" is followed by the `h3`
      column headers. If axe reports `heading-order`, fix the markup (e.g. make the column headers
      `h2`, or make them non-heading table-style headers) and note the choice in the PR.
- [ ] No change to `'trustee-match'` values, backend, `common/`, or seed scripts.
- [ ] All tests pass. TypeScript compiles (`npm run typecheck` in `user-interface/`). Build
      succeeds. Lint passes (`npm run lint`).
- [ ] No breaking changes to existing functionality.

### Testing Requirements

- [ ] Unit (`user-interface`, `npm run test`): one test per acceptance criterion above, including
      the stale session label case (seed `sessionStorage` with the old JSON before render, as the
      existing tests at ~931/~990 do).
- [ ] Playwright e2e (`test/e2e`): `transfer-orders.spec.ts`, `consolidation-orders.spec.ts` and
      `trustee-match-verification.spec.ts` pass with the new filter order.
- [ ] Playwright a11y (`user-interface`, `npm run test:a11y`; run the app with
      `CAMS_USE_FAKE_API=true CAMS_LOGIN_PROVIDER=none npm run start:a11y`):
      `data-verification.test.ts` passes.
- [ ] Integration (`test/integration/`): not required for this task; there is no backend or data
      change.

---

## Slice Completion Checklist

- [ ] Task 1 complete, all acceptance criteria met
- [ ] Unit, Playwright e2e and Playwright a11y tests passing
- [ ] `npm run lint`, `npm run typecheck`, `npm run build` pass in `user-interface/`
- [ ] Write
      `test/bdd2/specs/CAMS-953/trustee-identity-verification.slice-1-implementation-notes.md`,
      recording:
  - deviations from this plan
  - the heading-order outcome
  - whether e2e moved to label-based option selection
- [ ] Update beads: `bd update cams-c45pn.1 --append-notes="Slice 1 implementation complete"` then
      `bd close cams-c45pn.1`
- [ ] Ready for code review
