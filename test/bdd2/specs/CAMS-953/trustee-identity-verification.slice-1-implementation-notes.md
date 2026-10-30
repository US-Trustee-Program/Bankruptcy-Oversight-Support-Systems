# CAMS-953 Slice 1: Data Verification queue labeling fixes — Implementation Notes

Implemented 2026-10-27. Bead: cams-c45pn.1.

## What Was Built

- `user-interface/src/lib/utils/labels.ts`: `taskType.get('trustee-match')` now returns
  `'Trustee Identity'` (was `'Trustee Mismatch'`). The stored value `'trustee-match'` is unchanged.
- `user-interface/src/data-verification/DataVerificationScreen.tsx`:
  - Removed `regionHeader` ('Region 02') and its `<h2>` entirely.
  - Added a screen-reader-only
    `<h2 id="data-verification-tasks-heading" className="usa-sr-only">Data Verification Tasks</h2>`
    inside the (now `aria-labelledby`'d) `order-list-container` section — see Heading Order below.
  - `accordionFieldHeaders[0]` is now `'Subject'` (was `'Court District'`).
  - Added `getTaskTypeOptions(flags)`, a single ordered helper (Consolidation, Transfer, Trustee
    Identity — alphabetical), each entry flag-gated and labeled from the `taskType` map. Used for
    both the ComboBox `options` and the defaults `useEffect`, so order/labels can't drift between
    them.
  - Session-stored type-filter selections are re-derived from current `taskType` labels before being
    passed to the ComboBox (`typeSelectionsWithCurrentLabels`), so a stale
    `{value:'trustee-match', label:'Trustee Mismatch'}` in `sessionStorage` displays as "Trustee
    Identity". Filtering still keys on `value`; the session key is unchanged.
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`:
  - The Subject cell now renders `order.dxtrTrustee.fullName` (was the court name), with
    `aria-label="Subject – {fullName}."`.
  - Removed the now-unused `courtName` local; `courtDetails` is kept (still feeds the search modal's
    `courtId`).
  - Both "Search for a different trustee" / "Search for a different trustee." link labels are now
    "Search for a trustee".
  - Reason-based headings ("Multiple Matches", "Inactive Trustee") are untouched.

## Heading Order Outcome

Deleting the "Region 02" `<h2>` would otherwise leave `h1` → `h3` (column headers) → `h4` (shared
`Accordion.tsx`, hard-coded, out of scope to change — used by 4 other screens), skipping level 2 —
an axe `heading-order` violation. Fixed by adding a new, visually-hidden
`<h2 className="usa-sr-only">Data Verification Tasks</h2>` (not a re-introduction of the region
heading) immediately inside the task-list section, restoring `h1→h2→h3→h4`. Verified with a one-off
axe scan (`AxeBuilder(...).withRules(['heading-order'])` against the running a11y build) — zero
violations. Note: `heading-order` is globally disabled in
`user-interface/test/accessibility/test-constants.ts` (pre-existing, for an unrelated
`<h3>Filters</h3>` issue elsewhere), so the standing a11y suite does not itself re-verify this; a
unit test (`DataVerificationScreen.test.tsx`) asserts the sr-only `h2` exists and contains no
"Region" text.

## Key Integration Points

- `user-interface/src/lib/utils/labels.ts` — single source of truth for the `'trustee-match'`
  display label.
- `user-interface/src/data-verification/DataVerificationScreen.tsx` — `getTaskTypeOptions`,
  `typeSelectionsWithCurrentLabels`, `accordionFieldHeaders`.
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`
  — Subject cell / aria-label, `TrusteeSearchLink` labels.
- `test/e2e/playwright/{transfer-orders,consolidation-orders,trustee-match-verification}.spec.ts` —
  task-type filter interactions.
- `user-interface/test/accessibility/data-verification.test.ts` — unchanged; already selected filter
  options by `#option-<value>` id, not index.

## Learnings for Future Slices

- The shared `Accordion.tsx` (`user-interface/src/lib/components/uswds/Accordion.tsx`) hard-codes
  its row heading at `<h4>`, with no level prop. Any future heading-structure work on this screen
  (or the identity-task rebuild in later slices) needs to account for this fixed level, or plan a
  wider change across its other consumers (trustee panels/filters).
- `ComboBox`'s single-selection display falls back to the option's own stored `label` (not a fresh
  lookup), so any session-persisted `{value, label}` filter needs explicit re-derivation wherever
  it's displayed — the "value is canonical, label can go stale" pattern. The pattern applied here
  (`typeSelectionsWithCurrentLabels`) is reusable if another persisted label mapping changes in a
  later slice.
- Playwright specs that select ComboBox options by numeric index (`task-type-filter-option-item-N`)
  are fragile to list-order changes. Switched all three affected specs to the
  `[id="option-<value>"]` selector pattern already used by the a11y test — order-independent going
  forward.

## Challenges Encountered

- Two pre-existing test "Search for a different trustee" assertions and one "no search button"
  assertion in `TrusteeMatchVerificationAccordion.test.tsx` relied on an incidental phrase mismatch
  (the single-candidate state's "Search for a different trustee" link vs. the no-candidates state's
  "Search for a trustee" link were distinguishable only by wording, not state). Unifying both to
  "Search for a trustee" collapsed that distinction, so one test's `not.toBeInTheDocument()`
  assertion on the search button had to be removed — the button genuinely renders in that state; the
  text rename just made an already-passing assertion newly (and correctly) fail.
- `getTaskTypeOptions` takes `FeatureFlagSet` (from `@common/feature-flags`), not
  `Record<string, boolean>` — `FeatureFlagSet`'s index signature is `string | number | boolean`,
  which TypeScript won't narrow implicitly.

## Testing Notes

- Unit (`user-interface`, `npm run test`): all new/updated specs pass. Full suite: 4091 passed, 2
  pre-existing unrelated failures (`consolidationsUseCase.test.ts`, `OktaSession.test.tsx`) —
  confirmed present identically on `main` with this change stashed, i.e. not caused by this slice.
- `npm run typecheck`: pass. `npm run lint`: pass (0 errors; 504 pre-existing warnings, unrelated to
  this change). `npm run build`: pass.
- Playwright a11y (`CAMS_USE_FAKE_API=true CAMS_LOGIN_PROVIDER=none npm run start:a11y`, then
  `npm run test:a11y`): `data-verification.test.ts` passes (chromium + Edge).
- Playwright e2e (`test/e2e`): NOT run. The local `npm run e2e` (podman-based workflow:
  sqledge/mongo/azurite/backend/frontend/playwright pod) failed immediately in this sandbox on an
  unrelated `.env` parsing issue (`CAMS_LOGIN_PROVIDER = 'okta'` with spaces, pre-existing local
  config, not part of this change), and no podman images were cached locally to retry a full cold
  build within this session. The three affected spec files were verified via `tsc --noEmit` and
  `eslint` (both clean) in the `test/e2e` workspace. A follow-up session with a working e2e
  environment should run `transfer-orders.spec.ts`, `consolidation-orders.spec.ts`, and
  `trustee-match-verification.spec.ts` to confirm the id-based filter selectors behave as expected
  end-to-end.

## Deviations from Design

None from the bead's Task 1 requirements. One test-only deviation (see Challenges Encountered):
removed an assertion in `TrusteeMatchVerificationAccordion.test.tsx` that was never actually
validating "no search link in this state" — only an incidental phrase difference the label
unification removed.
