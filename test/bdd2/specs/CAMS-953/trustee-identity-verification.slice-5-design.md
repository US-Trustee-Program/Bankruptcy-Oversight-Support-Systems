# Trustee Identity Verification - Slice 5 Design

## Metadata

- **Slice:** 5 of 7
- **Slice Name:** Identity tasks with no case
- **Ticket:** CAMS-953 (GitHub #3187); bead `cams-c45pn.8`
- **Dependencies:** Slice 4 (`cams-c45pn.7`, merged to `CAMS-953-full-feature` via PRs #3213/#3214)
- **User Value:** The verifier can resolve an identity task before any case is attached to it.
- **Status:** Approved (2026-10-30)

## Slice Scope

**In scope:**

1. `caseId` and `courtId` become optional on `TrusteeMatchVerification` (common type). The producer
   that will actually create caseless tasks is CAMS-954 (#3188); in this ticket only dev-tools seeds
   create one, for local/staging viewing and testing.
2. `resolveCourtName` (backend use-case) and approval telemetry (`approveVerification`'s
   `completeTrace` call) must not assume `caseId` is present.
3. Pending accordion: a caseless task's problem-statement reads "No cases yet. Cases attach as
   appointments sync." instead of the normal "Affects N case(s): &lt;link&gt;" clause.
4. Resolved accordion: **any** approved task whose `affectedCaseIds` snapshot is empty (caseless
   task, or any other resolution path that ends with zero affected cases) reads "Trustee {name} was
   approved. No cases affected." — no "yet" (the resolution already happened), no case link,
   regardless of why the snapshot is empty. See Decision 2 below; this is a user-directed
   simplification, not an inferred one.
5. Confirm Trustee Match modal: "What Happens Next" reads "No cases are affected yet. Future cases
   sent with this information will be matched to {trustee name} automatically." whenever the case
   count is 0 — not just for a caseless task. See Decision 3.
6. A caseless seed scenario for local and staging.

**Out of scope:**

- CAMS-954/#3188 (the real producer of caseless tasks via the ACMS sync). This slice is
  UI/data-model only; only seeds create caseless documents in T1.
- Re-deriving whether a _legacy_ document's missing (not just empty) `affectedCaseIds` implies a
  real but untracked appointment. Decision 2 deliberately stops distinguishing this — see below.

## Code baseline findings (branch `CAMS-953-full-feature` @ `a409e10d1`)

- `TrusteeMatchVerification.caseId`/`.courtId`
  (`common/src/cams/trustee-match-verification.ts:35-36`) are required `string`. Every other type
  derived from it (`TrusteeMatchVerificationListItem`, `TrusteeMatchVerificationSearchResult`,
  `EnrichedTrusteeMatchVerification`) inherits whatever this slice makes them.
- `resolveCourtName` (`trustee-match-verification.use-case.ts:160-180`) already tolerates a bad
  `caseId` by accident: `getCaseIdParts` throws on a non-3-part string, which the surrounding
  try/catch catches and falls through to a courtId-only lookup. It still needs an explicit
  `if (verification.caseId)` guard once the type goes optional, both for clarity and because
  `getCaseIdParts` is typed to take `string`, not `string | undefined`.
- `approveVerification`'s `completeTrace` call (`trustee-match-verification.use-case.ts:338-360`)
  puts `caseId: verification.caseId` directly into `properties` (a flat string-keyed object). The
  file already has the right pattern one property below it for exactly this situation
  (`...(selectedCandidateRank !== undefined ? { selectedCandidateRank: ... } : {})`) — reuse it for
  `caseId`.
- `TrusteeMatchVerificationMongoRepository.upsertVerification` puts `caseId`/`courtId` in
  `$setOnInsert`; the Mongo client's `ignoreUndefined: true` (already relied on for `id`, per that
  method's own doc comment) means an `undefined` `caseId` is simply never written. No repository
  change needed beyond the type.
- `trustee-match-verification.controller.ts` never reads or validates `caseId`. No change needed.
- **Frontend, `TrusteeMatchVerificationAccordion.tsx` — two real bugs an optional `caseId` would hit
  immediately, not yet protected by any existing branch:**
  - Line 138: `getCaseIdParts(order.caseId)` — called unconditionally, outside any try/catch, to
    derive `divisionCode` for the search modal. `getCaseIdParts(undefined)` throws
    `TypeError: Cannot read properties of undefined` with nothing to catch it — **this crashes the
    component** for any caseless task, pending or resolved.
  - Line 258: `Api2.getCaseSummary(order.caseId)` inside the chapter-fetch `useEffect` — fires for
    every non-approved task once `detail` loads, caseless or not. Needs a guard; there is no
    originating case to fetch a chapter for.
  - The _resolved_-statement branch (lines 413-425) has no `affectedCaseCount === 0` guard, unlike
    the _pending_ branch (which already has one, added by `cams-wtf4i`/commit `fafe3b767`). A
    resolved task with an empty snapshot falls back to `caseLink` → `singleCaseLink` →
    `affectedCaseIds[0]` = `order.caseId` = `undefined` →
    `NewTabLink to="/case-detail/undefined" label=""`. This is adjacent to but distinct from
    `cams-0l5bm` (filed during `wtf4i` scoping, about telling apart _why_ an approved snapshot is
    empty): this slice does not need that distinction — see Decision 2.
  - `headerCaseCount = Math.max(affectedCaseCount, 1)` (line 248) is the only thing feeding
    `TrusteeMatchConfirmationModal`'s `caseCount` prop. It floors out 0, so the modal can never
    currently render a zero-case sentence for _any_ task, caseless or not. Removing the floor is
    required for Decision 3 and is a one-line, no-downside change (every non-zero case count passes
    through unchanged).
- `TrusteeSearchModal` already treats `courtId`/`divisionCode`/`chapter` as independently optional
  ("Omitting either keeps district-only filtering, for any caller of this modal that has no case
  context to provide" — its own doc comment at `TrusteeSearchModal.tsx:19-22`). No change needed
  there: the accordion just needs to stop crashing before it reaches this component.
- `DataVerificationScreen.tsx` and the rest of the Data Verification list/filter chrome have no
  `caseId` dependency for this task type (confirmed by search) — Subject column already shows
  `dxtrTrustee.fullName`, not anything case-derived. No change needed outside the accordion, the
  modal, and the two backend call sites above.
- `order.courtName` (what `resolveCourtName` computes) is not rendered anywhere in the trustee
  identity-verification UI today (confirmed by search; it's only used by Transfer/Consolidation
  accordions). This slice's `resolveCourtName` change is about not crashing `getVerifications` for
  every pending item, not about anything currently visible.
- `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`'s existing zero-case seed task
  (`CASE_NO_CASES = '091-99-05433'`, added by `cams-wtf4i`/commit `e2e278d1b`, _after_ PR #3215's
  courtId fix) still hardcodes `courtId: '0208'` for a Buffalo (091) case, which should be `'0209'`
  per the same convention PR #3215 just established for the other Buffalo seed tasks. Drive-by fix
  since this slice is already editing this file.

## Strategic Design Decisions

### Decision 1: Caseless (no caseId ever) and zero-live-surrogates (has caseId, nothing currently

attached) are different states with different copy, not the same branch

- **What:** The pending problem-statement gets a new topmost condition, `!order.caseId`, rendering
  "No cases yet. Cases attach as appointments sync." (still prefixed by the Slice 3 explanation
  sentence, same as every other pending state — this task is still ambiguous/no-match and still
  needs a human decision, independent of whether a case exists yet). `cams-wtf4i`'s existing
  `affectedCaseCount === 0` branch (has a caseId, zero live surrogates) is unchanged and keeps its
  own copy, "No cases affected yet."
- **Alternative considered:** Unify both into one zero-case branch with one piece of copy.
- **Rationale:** The feature file (`trustee-identity-verification.feature`, Slice 5 scenario) and
  the bead text both specify different copy for this slice than what `wtf4i` already shipped. They
  are also genuinely different facts about the task (never had a case vs. has a case that currently
  matches nothing), worth keeping distinguishable to a verifier.

### Decision 2: The resolved statement trusts the stored `affectedCaseIds` snapshot at face value —

no attempt to infer why it's empty

- **What:** Add an `affectedCaseCount === 0` branch to the _resolved_ statement, mirroring the
  structure the _pending_ branch already has: "Trustee {name} was approved. No cases affected." — no
  "yet" (the resolution event already happened; there is nothing pending about it), and no case
  link. This applies uniformly to every approved task with an empty snapshot, regardless of source
  (caseless-at-creation via this slice, or any other path, including a future
  sync-trustee-professional-ids-driven resolution).
- **Alternative considered:** Distinguish "legitimately caseless" from the two scenarios
  `cams-0l5bm` describes (legacy missing snapshot vs. new explicit empty snapshot) and give each its
  own copy.
- **Rationale (user, 2026-10-30):** The document is a snapshot in time of affected cases, regardless
  of which match-event source resolved it; trust what it says. This directly implements the "new"
  half of what `cams-0l5bm` flagged (an explicit empty snapshot should not claim an appointment
  exists), and deliberately declines to keep `cams-0l5bm`'s legacy half separate.
- **Consequence for `cams-0l5bm`:** That bead's legacy case ("approved before the affectedCaseIds
  snapshot feature existed... falling back to `[order.caseId]` is correct here") is superseded, not
  fixed. The UI cannot tell a legacy-missing snapshot from this slice's legitimately-empty one at
  the list/detail level today regardless (both normalize to `[]` in `getVerifications`/
  `getEnrichedVerification` before the UI ever sees them), so there was never a way to keep both
  behaviors without a backend signal `cams-0l5bm` said would require a data-model change. This slice
  picks the simpler, uniform behavior instead. **The existing test for the old fallback behavior
  ("falls back to the originating case with no snapshot and no surviving surrogates") needs to
  change to assert the new copy.** Recommend closing `cams-0l5bm` once this ships, noting the
  superseding decision — flagged for confirmation, not done automatically.
- **Dead code this enables:** Once the resolved branch has its own zero-count guard, the
  `[order.caseId]` fallback inside the resolved half of the `affectedCaseIds` computation
  (`TrusteeMatchVerificationAccordion.tsx:236-242`) becomes unreachable (`affectedCaseCount` and
  `order.affectedCaseIds.length` can't disagree — both come from the same server-side computation).
  Phase 3 should remove it from the resolved branch specifically; the pending branch keeps its own
  `[order.caseId]` fallback (still reachable: a pending task whose detail fetch failed falls back to
  `order.affectedCaseCount`/no local `affectedCaseIds` array at all, a genuinely different case from
  the resolved path).

### Decision 3: The modal's zero-case sentence is driven by `caseCount === 0`, not by caselessness

specifically

- **What:** `caseAssignmentSentence` in `TrusteeMatchConfirmationModal.tsx` gets a zero-case branch:
  "No cases are affected yet. Future cases sent with this information will be matched to {trustee
  name} automatically." This requires removing the `Math.max(affectedCaseCount, 1)` floor
  (`TrusteeMatchVerificationAccordion.tsx:248`) that currently prevents the modal from ever
  seeing 0.
- **Alternative considered:** Special-case only the literally-caseless task; leave the floor in
  place for `wtf4i`'s zero-surrogate task (which would otherwise also incorrectly show "1 case will
  be assigned to..." today, since nothing built in `wtf4i` touched the modal).
- **Rationale:** The sentence itself ("Future cases sent with this information will be matched...
  automatically") is equally true and equally useful for both "never had a case" and "has a case,
  nothing currently matches" — there's no reason to floor one and not the other, and removing the
  floor fixes a real gap in `wtf4i`'s own scope for free (its modal was never updated for the
  zero-case state it created).

## Component Responsibilities

- **Common (`trustee-match-verification.ts`):** `caseId?: string`, `courtId?: string` on
  `TrusteeMatchVerification`. Update the `caseId` field's doc comment (currently describes it as
  "the case that first created this fingerprint's verification document" — needs a sentence covering
  the now-possible no-case-at-all state). No other type changes; everything else derives from this
  type.
- **Backend use-case (`trustee-match-verification.use-case.ts`):** `resolveCourtName` gets an
  explicit `if (verification.caseId)` guard in place of relying on the try/catch's incidental
  behavior. `approveVerification`'s telemetry spreads `caseId` conditionally, matching the existing
  `selectedCandidateRank` pattern.
- **Mongo repository, controller:** no change (confirmed above).
- **Accordion (`TrusteeMatchVerificationAccordion.tsx`):**
  - Guard the `divisionCode`/`courtDetails` computation (line 138) behind `order.caseId` presence;
    `undefined` either way is already handled by `TrusteeSearchModal`.
  - Guard the chapter-fetch `useEffect` (lines 255-268) behind `order.caseId` presence.
  - New pending branch (Decision 1) and new resolved branch (Decision 2).
  - Remove the `Math.max` floor (Decision 3); `headerCaseCount` becomes just `affectedCaseCount`
    (rename or inline — Phase 3's call).
- **Confirm Trustee Match modal (`TrusteeMatchConfirmationModal.tsx`):** zero-case sentence branch
  (Decision 3). No prop shape change — `caseCount: number` already allows 0.
- **Seeds (`dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`,
  `lib/trustee-match-scenario-seeds.ts`):** one new caseless task (no `caseId`/`courtId` keys at
  all, no surrogate row — there is no case to anchor one to), built from an existing
  `TRUSTEE_MATCH_FINDINGS_SCENARIOS` fixture key the same way every other seed task is. Drive-by
  fix: `CASE_NO_CASES`'s `courtId: '0208'` → `'0209'`.

## Integration Points

- **Slice 3/4:** `buildTrusteeExplanation` (unchanged, still runs for a caseless task — it's still
  ambiguous/no-match, independent of case attachment). `buildTrusteeComparison`,
  `TrusteeComparisonTable`, `TrusteeMatchConfirmationModal` all unchanged in shape, only the
  zero-case sentence branch is new.
- **`cams-wtf4i` / `cams-0l5bm`:** see Decisions 1 and 2. `wtf4i`'s own pending branch and seed task
  are untouched except for the courtId drive-by fix; `cams-0l5bm`'s disposition is a follow-up
  bookkeeping item, not a code dependency.
- **Existing tests:** `TrusteeMatchVerificationAccordion.test.tsx` (new pending/resolved caseless
  cases; the existing legacy-fallback resolved test needs its assertion updated — confirm it fails
  first against the new code before changing it, per TDD), `TrusteeMatchConfirmationModal.test.tsx`
  (zero-case sentence), `trustee-match-verification.use-case.test.ts` (`resolveCourtName` and
  telemetry with no `caseId`), `trustee-match-all-scenarios.test.ts` (new seed task, courtId fix).
  `test/e2e/playwright/trustee-match-verification.spec.ts` and
  `user-interface/test/accessibility/data-verification.test.ts` both need the new caseless seed
  exercised. `test/integration/trustee-match-scenarios/` needs the caseless seed to store/list/open/
  approve cleanly end to end.

## Testing Strategy

- **Unit:**
  - common: none (a type-only change; covered transitively).
  - backend: `resolveCourtName` with `caseId: undefined` and `courtId` present vs. both absent;
    `approveVerification` telemetry properties omit `caseId` when absent.
  - frontend: pending caseless task shows "No cases yet. Cases attach as appointments sync." and no
    case link; resolved task with empty `affectedCaseIds` shows "No cases affected" (no "yet", no
    link) regardless of whether `order.caseId` is set (Decision 2's uniform behavior — test both a
    caseless-resolved and a has-caseId-but-empty-snapshot-resolved case to prove it's really
    uniform); search modal receives no `courtId`/`divisionCode`/`chapter` props for a caseless task
    and doesn't crash; modal shows the zero-case sentence when `caseCount` is 0 for both a caseless
    task and (via the Decision 3 fix) a has-caseId zero-surrogate task.
- **Playwright e2e:** expand the caseless seed task, assert "No cases yet. Cases attach as
  appointments sync."; choose a candidate, assert the modal's zero-case "What Happens Next"
  sentence; approve it, assert the resolved "No cases affected" text with no case link.
- **Playwright a11y:** axe scan with the caseless task expanded (pending) and after approving it
  (resolved).
- **Integration harness (`test/integration/trustee-match-scenarios/`):** store (seed), list, open
  (detail fetch), and approve a caseless task end to end; confirm `affectedCaseIds` persists as `[]`
  and the task resolves without the division-coverage check throwing (it already short-circuits on
  `affectedCaseIds.length > 0` being false — `trustee-match-verification.use-case.ts:230` — so a
  caseless task's approval skips that check entirely, which is correct: there is nothing to check
  coverage against).

## Test Data

New seed task in `trustee-match-all-scenarios.ts`: one caseless pending task, no `caseId`/`courtId`,
no surrogate, reusing an existing `TRUSTEE_MATCH_FINDINGS_SCENARIOS` key not already claimed by a
single-case/multi-case/no-surrogate task (Phase 3 picks the exact key — likely a fresh ambiguous or
no-match fixture, or a reused one under a new seed `id`, matching the precedent `wtf4i` set reusing
`multipleCandidates` under a new slug). `testDataScripts` entry to add to `.workflow-state.json`:

```json
{
  "script": "dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts",
  "target": "trustee-match-verification (one task with no caseId/courtId, no surrogate)",
  "slice": 5,
  "populationPath": "direct seed, rewritten; purge and reseed every environment (existing CAMS-953 seed convention)"
}
```

## Open Items Carried to Phase 3

- Exact fixture scenario key and seed `id`/slug for the new caseless task.
- Exact wording check: does the pending caseless problem-statement keep the Slice 3 explanation
  sentence prefix (e.g. "Trustee information sent to CAMS matches multiple trustees in CAMS. No
  cases yet. Cases attach as appointments sync.")? Design says yes (Decision 1 rationale); Phase 3
  should write the exact test assertion so there's no ambiguity at implementation time.
- Whether to rename `headerCaseCount` to something else or just inline `affectedCaseCount` now that
  the floor is gone (no functional difference; Phase 3's call, mention in the prompt).
- `cams-0l5bm` disposition (close as superseded vs. leave open) — flagged for the user, not a
  blocker for implementing this slice.

## Design Q&A Summary (2026-10-30)

- Q: What should the resolved/approved statement say for a caseless task approved with zero affected
  cases (no Figma mock covers this)? A: Trust the stored `affectedCaseIds` snapshot uniformly,
  regardless of resolution source (DXTR sync or the future ACMS-professional-id sync path): empty
  snapshot → "Trustee {name} was approved. No cases affected." (no "yet"). This applies to any
  resolved task with an empty snapshot, not just caseless ones (Decision 2).
