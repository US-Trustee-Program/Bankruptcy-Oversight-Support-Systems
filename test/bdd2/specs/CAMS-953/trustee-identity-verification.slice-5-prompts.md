# Trustee Identity Verification - Slice 5 Implementation Prompts

## Metadata

- **Slice:** 5 of 7
- **Slice Name:** Identity tasks with no case
- **Total Tasks:** 3
- **Status:** Ready for Implementation

## Implementation Overview

`TrusteeMatchVerification.caseId`/`.courtId` become optional, so a trustee identity task can exist
before any case is attached to it. Task 1 makes the type change and every call site that currently
assumes a `caseId` safe (common, backend use-case, frontend accordion) without changing any visible
copy. Task 2 adds the new caseless/zero-case copy: a distinct pending message for "never had a case"
and a new resolved-task message for "approved with an empty affected-cases snapshot" (which also
changes behavior for one existing non-caseless seed task — intentional, see Task 2). Task 3 adds a
caseless seed scenario and wires it into e2e, a11y and the integration harness.

## Task Sequence

1. Make `caseId`/`courtId` optional end to end (type, backend, frontend guards) — no visible copy
   change yet.
2. New copy: pending "No cases yet" message, resolved "No cases affected" message, modal zero-case
   sentence.
3. Caseless seed scenario + e2e/a11y/integration coverage.

---

## Task 1: Optional caseId/courtId, with every current call site made safe

### Context

This is CAMS-953 (trustee identity verification), Slice 5 of 7. Prior slices built a Data
Verification screen where a verifier resolves "identity tasks" — cases where an incoming trustee
record (from DXTR today, from ACMS in a later ticket) didn't cleanly match one CAMS trustee. Each
task is a `TrusteeMatchVerification` document (`common/src/cams/trustee-match-verification.ts`).
Today `caseId` and `courtId` on that type are required `string` fields, because every existing task
is created by the DXTR sync for one specific case. A separate, not-yet-built ticket (CAMS-954) will
make the ACMS sync create identity tasks with no case at all (the case hasn't synced yet). This task
makes the data model and every current consumer tolerate that — no new user-visible behavior, just
making `caseId`/`courtId` optional without anything crashing or failing to compile.

### Requirements

1. In `common/src/cams/trustee-match-verification.ts`, change `caseId: string;` to
   `caseId?: string;` and `courtId: string;` to `courtId?: string;` on the
   `TrusteeMatchVerification` type (around line 35-36). Update the doc comment directly above
   `caseId` (currently describes it as "The case that first created this fingerprint's verification
   document") to note it can also be absent entirely, for a task with no case attached yet. Every
   other exported type in this file (`TrusteeMatchVerificationListItem`,
   `TrusteeMatchVerificationSearchResult`, `EnrichedTrusteeMatchVerification`) derives
   `caseId`/`courtId` from this type via `Pick`/ intersection, so they become optional automatically
   — do not edit them directly.
2. In `backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.ts`,
   `resolveCourtName` (private method, takes a `TrusteeMatchVerificationSearchResult` and
   `CourtDivisionDetails[]`) currently does:
   ```ts
   private resolveCourtName(
     verification: TrusteeMatchVerificationSearchResult,
     courts: CourtDivisionDetails[],
   ): string | undefined {
     try {
       const { divisionCode } = getCaseIdParts(verification.caseId);
       const court = courts.find(
         (c) => c.courtDivisionCode === divisionCode || c.courtId === verification.courtId,
       );
       if (!court) return undefined;
       return court.courtDivisionName
         ? `${court.courtName} - ${court.courtDivisionName}`
         : court.courtName;
     } catch {
       const court = courts.find((c) => c.courtId === verification.courtId);
       if (!court) return undefined;
       return court.courtDivisionName
         ? `${court.courtName} - ${court.courtDivisionName}`
         : court.courtName;
     }
   }
   ```
   `getCaseIdParts` (`common/src/cams/cases.ts`) takes a `string`, so once `caseId` is optional this
   no longer compiles. Refactor to an explicit `if (verification.caseId)` guard instead of relying
   on the catch block, e.g.:
   ```ts
   private resolveCourtName(
     verification: TrusteeMatchVerificationSearchResult,
     courts: CourtDivisionDetails[],
   ): string | undefined {
     const findCourt = (divisionCode?: string) =>
       courts.find(
         (c) => (divisionCode && c.courtDivisionCode === divisionCode) || c.courtId === verification.courtId,
       );
     let court: CourtDivisionDetails | undefined;
     if (verification.caseId) {
       try {
         const { divisionCode } = getCaseIdParts(verification.caseId);
         court = findCourt(divisionCode);
       } catch {
         court = findCourt(undefined);
       }
     } else {
       court = findCourt(undefined);
     }
     if (!court) return undefined;
     return court.courtDivisionName
       ? `${court.courtName} - ${court.courtDivisionName}`
       : court.courtName;
   }
   ```
   (Keep the existing try/catch for a malformed-but-present `caseId` — that path is already tested.
   Feel free to restructure differently as long as: a present, well-formed `caseId` resolves by
   division first; a present-but-malformed `caseId` or an absent `caseId` both fall back to
   `courtId`-only lookup; nothing throws when `caseId` is `undefined`.)
3. In the same file, `approveVerification`'s success-path `completeTrace` call puts
   `caseId: verification.caseId` directly into `properties` (a flat object). Change it to omit the
   key entirely when `caseId` is absent, matching the existing pattern two lines below it for
   `selectedCandidateRank`:
   ```ts
   properties: {
     action: 'approve',
     ...(verification.caseId !== undefined ? { caseId: verification.caseId } : {}),
     mismatchReason: verification.mismatchReason,
     wasPreselectedConfirmed: String(wasPreselectedConfirmed),
     resolutionPath,
     ...(selectedCandidateRank !== undefined
       ? { selectedCandidateRank: String(selectedCandidateRank) }
       : {}),
   },
   ```
4. In
   `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`:
   - Line 138, `const { divisionCode } = getCaseIdParts(order.caseId);`, throws when `order.caseId`
     is `undefined` (nothing catches it). Guard it:
     ```ts
     const divisionCode = order.caseId ? getCaseIdParts(order.caseId).divisionCode : undefined;
     ```
     (`courtDetails` below it, `courts.find((c) => c.courtDivisionCode === divisionCode)`, already
     handles `divisionCode` being `undefined` fine — `find` just returns `undefined`.)
   - The chapter-fetch `useEffect` (around line 255-268) calls `Api2.getCaseSummary(order.caseId)`
     unconditionally whenever `order.status !== 'approved'` and detail has loaded. Add
     `order.caseId` to the early-return guard:
     ```ts
     useEffect(() => {
       if (order.status === 'approved' || !hasDetail || !order.caseId) return;
       let cancelled = false;
       Api2.getCaseSummary(order.caseId)
         ...
     ```
     (TypeScript needs this anyway once `caseId` is optional — `getCaseSummary` takes a `string`.)
5. Do not change any rendered copy or add any new branches in this task — that's Task 2. The
   `[order.caseId]` fallbacks inside the `affectedCaseIds` computation (lines ~236-242) are
   untouched here; they still compile because `NewTabLink`'s `to` prop and `getCaseNumber` both
   already accept `string | undefined` contexts gracefully (`getCaseNumber(undefined)` returns
   `''`), so this is a type-safety non-issue even though it stays visually imperfect until Task 2.

### Files to Modify

- `common/src/cams/trustee-match-verification.ts`
- `backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.ts`
- `backend/lib/use-cases/trustee-match-verification/trustee-match-verification.use-case.test.ts`
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.test.tsx`

### Testing Requirements (write these first, TDD)

- Backend (`trustee-match-verification.use-case.test.ts`, alongside the existing `describe` block
  with the other `resolveCourtName`-via-`getVerifications` tests around line 164): a verification
  with `caseId: undefined` and a `courtId` that matches a seeded court resolves `courtName` from
  that court. A verification with both `caseId` and `courtId` undefined/non-matching resolves
  `courtName` to `undefined` (reuse the pattern from "falls back to verification.courtName when
  caseId parses but no court matches by division or courtId" at line 233, but with
  `caseId: undefined` instead of a parseable-but-unmatched one).
- Backend `approveVerification` test (search the existing `describe('approveVerification', ...)`
  block, around line 346, for an existing `completeTrace`/telemetry assertion to model this on):
  approving a verification built with `caseId: undefined` does not throw, and the recorded
  `completeTrace` properties object has no `caseId` key (use
  `expect(...).not.toHaveProperty('caseId')` or equivalent against whatever spy/mock already
  captures `completeTrace`'s call args in this file).
- Frontend (`TrusteeMatchVerificationAccordion.test.tsx`): render the accordion with an `order`
  built via the existing local `sampleOrder`/`sampleOrderDetail` fixtures (search this test file for
  how they're constructed) but with `caseId: undefined` and `courtId: undefined`, and expand it.
  Assert the component renders without throwing and that `TrusteeSearchModal` receives no `courtId`
  prop (or receives `undefined`) — do not assert on any specific copy yet, that's Task 2's test.

### Acceptance Criteria

- [ ] `caseId` and `courtId` are optional on `TrusteeMatchVerification` and everything derived from
      it
- [ ] `resolveCourtName` does not throw and correctly falls back for an absent `caseId`
- [ ] `approveVerification`'s telemetry never sets a `caseId` property to `undefined`
- [ ] The accordion does not throw for an `order` with no `caseId`/`courtId`
- [ ] `npm test` passes in `common`, `backend`, `user-interface`
- [ ] `npm run typecheck`, `npm run lint`, `npm run knip` all pass
- [ ] No existing test's assertions or behavior changed (this task is additive/defensive only)

---

## Task 2: New copy for a caseless pending task and a zero-affected-cases resolved task

### Context

Same ticket and file set as Task 1, which this task depends on (optional `caseId`/`courtId` and the
guards from Task 1 must already be in place). This task adds the actual user-visible text changes.

There are two different pending states to keep distinct, with different copy:

- A task that has a `caseId` but currently has zero live affected cases (built in an earlier piece
  of this ticket, commit `fafe3b767`) already renders "No cases affected yet." — **do not change
  this.**
- A task with **no `caseId` at all** (this slice) should instead render "No cases yet. Cases attach
  as appointments sync." — a new, separate condition, checked first.

For the **resolved** (approved) statement, there is currently no zero-case branch at all — only the
pending statement has one. An approved task whose `affectedCaseIds` snapshot is empty currently
falls back to rendering a case link using `order.caseId`, which produces a broken
`/case-detail/undefined` link for a caseless task. The fix: whenever a resolved task's
`affectedCaseIds` snapshot is empty (`affectedCaseCount === 0`), render "Trustee {name} was
approved. No cases affected." with no case link and no "yet" — **regardless of whether the task ever
had a `caseId`.** This is a deliberate, user-directed simplification: the stored `affectedCaseIds`
snapshot is trusted at face value for _why_ it's empty, not just for the caseless case. One existing
seed-backed test asserts the old fallback-to-originating-case behavior for an approved task with an
empty snapshot — that test's expectation needs to change to match the new behavior (see below); this
is an intentional behavior change, not a regression to avoid.

The Confirm Trustee Match modal's "What Happens Next" sentence should also get a zero-case branch,
driven purely by the numeric case count being 0 (not by whether the task is caseless) — "No cases
are affected yet. Future cases sent with this information will be matched to {trustee name}
automatically." Today the modal can never actually receive a count of 0, because the accordion
floors it with `Math.max(affectedCaseCount, 1)` before passing it down as the `caseCount` prop.
Remove that floor so the new branch is reachable both for a caseless task and for the earlier
zero-live-affected-cases task (commit `fafe3b767`) — the sentence is equally correct for both, and
the earlier task's modal was never updated for its own zero-case state, so this closes that gap too.

### Requirements

1. In `TrusteeMatchVerificationAccordion.tsx`, the pending problem-statement currently has this
   shape (search for `affectedCaseCount === 0` inside the non-resolved branch):
   ```tsx
   {explanation || detailLoadError ? (
     affectedCaseCount === 0 ? (
       <p className="problem-statement">
         {explanation ? `${explanation.sentence} ` : ''}No cases affected yet.
       </p>
     ) : (
       <p className="problem-statement">
         <span>
           {explanation ? `${explanation.sentence} ` : ''}Affects{' '}
           {affectedCaseCount > 1 ? '' : '1 case: '}
         </span>
         {caseLink}
       </p>
     )
   ) : ( ... )}
   ```
   Add a new topmost condition, checked before `affectedCaseCount === 0`, for `!order.caseId`:
   ```tsx
   {explanation || detailLoadError ? (
     !order.caseId ? (
       <p className="problem-statement">
         {explanation ? `${explanation.sentence} ` : ''}No cases yet. Cases attach as appointments
         sync.
       </p>
     ) : affectedCaseCount === 0 ? (
       /* unchanged */
     ) : (
       /* unchanged */
     )
   ) : ( ... )}
   ```
2. Add a matching zero-case branch to the **resolved** statement. It currently reads:
   ```tsx
   {isResolved ? (
     <p
       className="resolved-statement"
       data-testid="resolved-statement"
       ref={resolvedStatementRef}
       tabIndex={-1}
     >
       <span>
         Trustee {getResolvedTrusteeDisplayName()} was appointed to{' '}
         {affectedCaseCount > 1 ? '' : 'case: '}
       </span>
       {caseLink}
     </p>
   ) : ( ... )}
   ```
   Change to:
   ```tsx
   {isResolved ? (
     affectedCaseCount === 0 ? (
       <p
         className="resolved-statement"
         data-testid="resolved-statement"
         ref={resolvedStatementRef}
         tabIndex={-1}
       >
         Trustee {getResolvedTrusteeDisplayName()} was approved. No cases affected.
       </p>
     ) : (
       <p
         className="resolved-statement"
         data-testid="resolved-statement"
         ref={resolvedStatementRef}
         tabIndex={-1}
       >
         <span>
           Trustee {getResolvedTrusteeDisplayName()} was appointed to{' '}
           {affectedCaseCount > 1 ? '' : 'case: '}
         </span>
         {caseLink}
       </p>
     )
   ) : ( ... )}
   ```
   (Keep both `<p>` elements with identical `data-testid`/`ref`/`tabIndex` — only the content
   changes.) Since `affectedCaseCount` for a resolved task is always consistent with
   `order.affectedCaseIds.length` (both come from the same server-side computation in
   `getVerifications`), the `affectedCaseCount === 0` branch is now the only way an empty snapshot
   is ever reached — the `[order.caseId]` fallback inside the resolved half of the `affectedCaseIds`
   computation (search for
   `isResolved ? (order.affectedCaseIds.length ? order.affectedCaseIds : [order.caseId])`) is now
   dead code for that half; simplify it to just `order.affectedCaseIds` (the pending half's own
   `[order.caseId]` fallback, for when `detail` hasn't loaded yet, stays as is — that one is still
   reachable).
3. Remove the floor on the modal's case count. Find:
   ```ts
   const headerCaseCount = Math.max(affectedCaseCount, 1);
   ```
   and the comment above it ("A task always renders at least its originating case link...", which is
   no longer accurate). Replace both the floor and the comment; pass `affectedCaseCount` directly to
   `TrusteeMatchConfirmationModal`'s `caseCount` prop instead of `headerCaseCount` (update the JSX
   prop too).
4. In `TrusteeMatchConfirmationModal.tsx`, `caseAssignmentSentence` currently reads:
   ```ts
   function caseAssignmentSentence(caseCount: number, trusteeName: string): string {
     const cases = caseCount === 1 ? '1 case' : `${caseCount} cases`;
     return `${cases} will be assigned to ${trusteeName}.`;
   }
   ```
   Add a zero-case branch:
   ```ts
   function caseAssignmentSentence(caseCount: number, trusteeName: string): string {
     if (caseCount === 0) {
       return `No cases are affected yet. Future cases sent with this information will be matched to ${trusteeName} automatically.`;
     }
     const cases = caseCount === 1 ? '1 case' : `${caseCount} cases`;
     return `${cases} will be assigned to ${trusteeName}.`;
   }
   ```

### Files to Modify

- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.tsx`
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchVerificationAccordion.test.tsx`
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchConfirmationModal.tsx`
- `user-interface/src/data-verification/trustee-verification/TrusteeMatchConfirmationModal.test.tsx`

### Testing Requirements (TDD — write/adjust these, confirm each fails against the old code first)

- **`TrusteeMatchVerificationAccordion.test.tsx`:**
  - New test: a pending task with `caseId: undefined` renders "No cases yet. Cases attach as
    appointments sync." in the `.problem-statement` element, and renders no case link.
  - New test: a pending task with `caseId` present and `affectedCaseCount: 0` (the existing
    `fafe3b767` scenario) still renders "No cases affected yet." unchanged — this is a regression
    check, confirm it already passes.
  - **Update the existing test at (search for)
    `'falls back to the originating case with no snapshot and no surviving surrogates'`** (currently
    asserts `resolved-statement` text contains `'case:'` and a link to `sampleOrder.caseId`). Change
    its name and assertions to match the new behavior: rename to something like
    `'shows no case link for a resolved task with an empty snapshot'`, and assert the resolved
    statement's text is `'Trustee {name} was approved. No cases affected.'` (fill in whatever
    trustee-name expression the surrounding tests in this file already use — match `resolvedOrder`'s
    shape) and that it contains no `role="link"` element.
  - New test: a **caseless** resolved task (`caseId: undefined`, `affectedCaseCount: 0`,
    `affectedCaseIds: []`) renders the same "Trustee {name} was approved. No cases affected." text —
    proving the behavior is driven by the empty snapshot, not by caselessness specifically.
  - New test: opening the Confirm Trustee Match modal from a task whose `affectedCaseCount` is 0
    (either the caseless task or the existing `fafe3b767` zero-surrogate task) passes
    `caseCount={0}` through to the modal (assert via the modal's rendered text, not an internal prop
    spy, matching this file's existing style for modal-content assertions).
- **`TrusteeMatchConfirmationModal.test.tsx`:** new test asserting `caseAssignmentSentence`'s
  zero-case output — render the modal with `caseCount={0}` and a selected trustee, assert the "What
  Happens Next" text equals "No cases are affected yet. Future cases sent with this information will
  be matched to {trusteeName} automatically." Keep the existing singular/plural tests unchanged as
  regression checks.

### Acceptance Criteria

- [ ] A caseless pending task shows "No cases yet. Cases attach as appointments sync." with no case
      link
- [ ] The existing has-caseId zero-surrogate pending task ("No cases affected yet.") is unchanged
- [ ] Any resolved task with an empty `affectedCaseIds` snapshot shows "Trustee {name} was approved.
      No cases affected." with no case link, whether or not it ever had a `caseId`
- [ ] The Confirm Trustee Match modal shows the new zero-case "What Happens Next" sentence whenever
      `caseCount` is 0, for both a caseless task and the existing zero-surrogate task
- [ ] `npm test` passes in `user-interface`
- [ ] `npm run typecheck`, `npm run lint`, `npm run knip` all pass
- [ ] No other existing test's behavior changed except the one explicitly updated above

### Regression Testing

- [ ] Every non-zero-case-count pending and resolved task still renders exactly as before (run the
      full `TrusteeMatchVerificationAccordion.test.tsx` and `TrusteeMatchConfirmationModal.test.tsx`
      suites and confirm nothing else changed)
- [ ] The existing `fafe3b767` zero-live-affected-cases pending scenario's text is unchanged

---

## Task 3: Caseless seed scenario + e2e, a11y and integration coverage

### Context

Same ticket. Tasks 1 and 2 made the code handle a caseless `TrusteeMatchVerification` document
correctly. This task adds one to the dev-tools seed data so it's actually viewable at
`localhost:3000/data-verification` and covered by the automated suites this ticket requires
(Playwright e2e, Playwright a11y, and the integration harness under `test/integration/`). No real
producer creates caseless tasks yet (a separate ticket, CAMS-954, will add that via the ACMS sync) —
only this seed creates one, for now.

The seed file to edit, `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`, already
builds every task in this file from a fixture in
`common/src/cams/test-utilities/trustee-match-findings.scenarios.ts` via the shared
`identityTaskFields(key)` helper in `dev-tools/db_scripts/lib/trustee-match-scenario-seeds.ts` —
that helper returns everything except `id`, `caseId`, `courtId`, `status`, `taskDate` and audit
fields, which each seed task in this file supplies itself. Every fixture key currently defined in
`trustee-match-findings.scenarios.ts` (`noCandidates`, `multipleCandidates`,
`oneCandidateStateDiffers`, `oneCandidateAddressAndPhoneDiffer`,
`oneCandidateNameAddressEmailDiffer`, `oneCandidateExactName`, `oneCandidateNothingDiffers`,
`multiCase`, `divisionMismatch`, `multipleCandidatesNoCases`, `resolvedNoSurrogates`,
`resolvedWithSnapshot`, `seedTrusteeNickname`) is already used by an existing seed task in this
file. The fixture's shape (candidates/findings) is unrelated to case data by this file's own design
(see its top-of-file doc comment), so reusing an existing key under a new seed `id` is fine and is
the pattern an earlier piece of this ticket (`multipleCandidatesNoCases`, added for the
zero-surrogate scenario) was told to follow, though it ended up adding a dedicated fixture key
instead. Either approach is acceptable here — pick whichever is less code. Reusing
`multipleCandidates` (ambiguous, 2 candidates) under a new `id` is the recommended default unless
you find a reason to add a new fixture key.

Also while in this file: the existing zero-surrogate seed task (`CASE_NO_CASES = '091-99-05433'`, in
the block with `id: \`seed-match-no-cases-${CASE_NO_CASES}\``) hardcodes `courtId:
'0208'`. Every other Buffalo-091 seed task in this file uses `'0209'`(DXTR's real courtId for Buffalo;`'0208'`is S.D.N.Y.) — this one task was added after that convention was fixed elsewhere in this file and was missed. Fix it to`'0209'`
as part of this task.

### Requirements

1. Add one new pending seed task to `generate()` in
   `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts` with **no `caseId` and no
   `courtId` key at all** (not set to `undefined` — omit the keys entirely) and **no surrogate
   `CASE_APPOINTMENT` row** (there is no case to anchor one to). Example shape, following the
   existing `SINGLE_CASE_TASKS`-derived tasks' structure but without `caseId`/`courtId`:
   ```ts
   const noCaseTask = {
     id: 'seed-match-no-case',
     ...identityTaskFields('multipleCandidates'),
     status: 'pending',
     taskDate: '2023-01-10T00:00:00.000Z',
     updatedOn: '2025-03-01T00:00:00.000Z',
     updatedBy: SEEDER,
   };
   ```
   Add `noCaseTask` to the `trustee-match-verification` collection's seed data array returned by
   `generate()` (alongside `singleCaseTasks`, the multi-case task, etc. — find where those are
   spread into the returned `SeedOperation[]` array and add this one the same way). Do not add a
   surrogate for it.
2. Fix `courtId: '0208'` to `courtId: '0209'` on the existing `CASE_NO_CASES` seed task.
3. Update the top-of-file doc comment's numbered scenario list to add this new scenario (it
   currently ends at item 8, the zero-surrogate task) and to correct the `CASE_NO_CASES` courtId
   mention if the comment references it.
4. Update `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.test.ts`: add this new task to
   whatever test(s) assert the full set of seeded pending tasks (search for the pending-count
   assertion(s) this file uses — e.g. `toHaveLength(9)`-style assertions mentioned in this file's
   own history — and increment accordingly), and add a dedicated assertion that the new task's
   stored document has no `caseId`/`courtId` field.
5. Playwright e2e (`test/e2e/playwright/trustee-match-verification.spec.ts`): add a test that
   expands the caseless task (look up the existing patterns in this file for finding a task row by
   trustee name — `identityTaskFields('multipleCandidates').dxtrTrustee.fullName`, i.e. whatever
   name the `multipleCandidates` fixture's source record uses, is the display name) and asserts the
   "No cases yet. Cases attach as appointments sync." text is visible. Then choose a candidate
   (reuse the existing candidate-selection flow this file already has for opening Confirm Trustee
   Match) and assert the modal shows the zero-case "What Happens Next" sentence. Do not assert on
   approval succeeding in this new test unless another e2e test in this file already approves a task
   from the fixture seeds (check first — the Slice 4 implementation notes record that approval e2e
   specs against fixture trustees are deferred elsewhere because backend gate A rejects them; if
   that's still true here, stop at the modal and Cancel, matching this file's existing pattern for
   preview- only assertions).
6. Playwright a11y (`user-interface/test/accessibility/data-verification.test.ts`): add an axe scan
   with the caseless task expanded (pending). If the e2e test above successfully exercises approval
   end to end for this task, also add a scan of its resolved state; otherwise skip the resolved a11y
   scan for this task (note this explicitly in the implementation notes if skipped, with why).
7. Integration harness (`test/integration/trustee-match-scenarios/` — find the existing test file(s)
   there covering store/list/open/approve for other seeded tasks and follow the same structure): add
   a case proving the caseless seed task stores correctly, appears in the list endpoint's results
   with `affectedCaseCount: 0`, its detail endpoint returns it with `affectedCaseIds: []`, and it
   approves successfully (the division-coverage check in `approveVerification` short-circuits when
   `affectedCaseIds.length` is 0 — see `trustee-match-verification.use-case.ts` around the comment
   "Reject the whole approval if the resolved trustee's configured divisions don't cover..." — so
   approval should succeed with no division check at all for this task). After approval, assert the
   stored document's `affectedCaseIds` is `[]`.

### Files to Modify

- `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`
- `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.test.ts`
- `test/e2e/playwright/trustee-match-verification.spec.ts`
- `user-interface/test/accessibility/data-verification.test.ts`
- Whichever file(s) under `test/integration/trustee-match-scenarios/` already cover store/list/open/
  approve for other seeded identity tasks

### Acceptance Criteria

- [ ] A caseless pending task is seeded for local and staging (`npm run seed:local` and the
      equivalent `seed:main`/staging script this repo already uses for this file — check
      `test-data.md` or `package.json` for the exact script names and update `test-data.md` for this
      feature with this new seed entry if that file tracks per-task seed scripts)
- [ ] The caseless task stores, lists (with `affectedCaseCount: 0`), opens (detail fetch succeeds),
      and approves without errors
- [ ] `CASE_NO_CASES`'s `courtId` is `'0209'`
- [ ] Unit tests for the seed script pass and reflect the new task
- [ ] Playwright e2e covers the caseless task's pending text and modal sentence
- [ ] Playwright a11y scans the caseless task's pending (and, if approval is exercised, resolved)
      state
- [ ] Integration harness covers store/list/open/approve for the caseless task end to end
- [ ] Full test suite passes: `common`, `backend`, `dev-tools`, `user-interface`
- [ ] `npm run typecheck`, `npm run lint`, `npm run knip` all pass

### Regression Testing

- [ ] Every other seed task in `trustee-match-all-scenarios.ts` is unaffected except the
      `CASE_NO_CASES` courtId fix
- [ ] Existing e2e, a11y and integration coverage for other trustee-match tasks still passes

---

## Slice Completion Checklist

After implementing all three tasks:

- [ ] All tasks complete, each independently shippable (tests/typecheck/lint/knip green after each)
- [ ] All acceptance criteria met across all three tasks
- [ ] All tests passing: `common`, `backend`, `dev-tools`, `user-interface`
- [ ] Playwright e2e and Playwright a11y actually run locally and pass (not just written — confirm
      the dev server/fake-API setup this ticket's earlier slices used, since Slice 4's PRs shipped
      without having run these locally at all)
- [ ] No regressions to Slices 1-4's behavior
- [ ] `cams-0l5bm` (the bug filed during `cams-wtf4i` about the resolved-statement's two
      indistinguishable empty-snapshot causes) is effectively superseded by Task 2's uniform "No
      cases affected" behavior — flag this to the user when reporting back, and ask whether to close
      it with a note, rather than closing it unilaterally
- [ ] Write `trustee-identity-verification.slice-5-implementation-notes.md` in
      `test/bdd2/specs/CAMS-953/`, covering what was built, any deviations from this prompt file,
      and anything learned that should inform Slice 6's design (approval links the ACMS professional
      id)
- [ ] Ready for code review
