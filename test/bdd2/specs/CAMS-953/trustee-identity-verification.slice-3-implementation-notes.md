# CAMS-953 Slice 3: Explanations — Implementation Notes

Started 2026-10-28. Bead: cams-c45pn.6 (Task 1: cams-c45pn.6.1, closed; Tasks 2-4 tracked only in
trustee-identity-verification.slice-3-prompts.md).

## What Was Built

- **Findings generator (Task 1).** The scenario inputs are in
  `common/src/cams/test-utilities/trustee-match-findings.scenarios.ts` (plain data). The backend
  test `backend/lib/use-cases/dataflows/trustee-match-findings.generator.test.ts` runs
  `runTrusteeMatchPipeline` over each scenario and writes the serialized states to
  `common/src/cams/test-utilities/trustee-match-findings.generated.json` with `toMatchFileSnapshot`.
  To regenerate, run `npm test -- -u trustee-match-findings.generator` in `backend/`.
  `MockData.getTrusteeMatchScenarioFindings(key)` returns a copy of one scenario's findings.
  - The generator does what the DXTR sync does before matching: it attaches
    `legacy.parsedCityStateZip = parseCityStateZip(cityStateZipCountry)`. Each `sourceRaw` in the
    JSON is therefore the record the sync would store as `dxtrTrustee`.
  - Only recall is simulated. The four trustees-repository lookups are served from the scenario's
    pool, using the predicates of `trustees.mongo.repository.ts`. `searchTrusteesByNameScored`
    reimplements the `SCORE` stage of `mongo-aggregate-renderer.ts` in JS. Every score comes from
    the real scorers.
  - `common/tsconfig.json` and `tsconfig.build.json` now include `src/**/*.json`. The project is
    `composite`, so an imported JSON file must be listed or tsc fails with TS6307. The build copies
    the JSON into `dist/`.
  - Verified by hand: changing `PHONE_TYPO_MAX_DIGIT_DISTANCE` from 2 to 4 failed the snapshot test
    and the `oneCandidateExactName` outcome test. The change was reverted.

## Decisions Made During Implementation

- **`oneCandidateNothingDiffers` is kept.** The pipeline produces it: an exact name whose CAMS
  trustee has no contact data. `resolveByNameOnly` declines when
  `doesCamsTrusteeHaveAddressAndPhone` fails, and nothing else is compared.
- **One-candidate tasks with an exact name always show a state difference or nothing at all.**
  `resolveByNameOnly` resolves a sole exact-name candidate unless its state conflicts or it has no
  contact data. As a result, the mock's sentence "Trustee address and phone ... do not exactly
  match" cannot come from real data. `oneCandidateAddressAndPhoneDiffer` uses a misspelled surname
  (name quality `weak`), so its sentence is "name, address and phone". Raise this with the UX
  sign-off.
- **Other constraints that shaped the scenarios.** A passing name plus an exact phone, a matching
  email, or 3+ address points resolves. A surname match with an agreeing state resolves
  (`resolveByStateOnly`). So `oneCandidateStateDiffers` sends only "Texarkana TX", with no zip,
  street or phone. `oneCandidateNameAddressEmailDiffer` sends "Chicago 60611", which has no state.

## Findings for Task 2 (seed migration)

Generated values that differ from the current hand-written seeds:

- **`multipleCandidates`**: the old `T Multimatch` source had Taylor's exact phone, which would
  resolve to Taylor. The scenario source now has a phone and street that differ from both
  candidates. Both score `moderate` (3 points, street closeness 0), with phone distance 4.
- **`multiCase`**: Casey vs Cassidy scores
  `{ pass: true, quality: 'strong', firstNameBySpellingOnly: true }`. The seed hand-wrote
  `{ pass: false }`.
- **`seedTrusteeNickname`** (trustee-data): Pat Seedtrustee shares the surname, so the real pipeline
  recalls Sam and Pat. That is 2 candidates, so `mismatchReason` becomes `'ambiguous'`, not
  `'no match'`.
- **Every candidate also carries `doesCamsTrusteeHaveAddressAndPhone` and
  `doesAcmsTrusteeHaveAddressAndPhone`**, and sometimes a recall diagnostic
  (`recallByTokenIntersection`, `recallByAnchoredLevenshtein`). The hand-written seeds omitted
  these. `differingRows` ignores them.
- **`assertTrusteeMatchFindingsValid` needs a change.** It decides whether the source has
  city/state/zip by reading `legacy.parsedCityStateZip`. The pipeline instead parses
  `cityStateZipCountry` with a zipless "CITY ST" fallback. For "Texarkana TX", `parsedCityStateZip`
  is `null`, yet `doesCityMatch` and `doesStateMatch` are recorded, so the validator would reject
  real pipeline output.

## Task 2: Seeds on generated findings

All four drift items above are now in the seeds. Changes:

- **dev-tools.** The new helpers in `dev-tools/db_scripts/lib/trustee-match-scenario-seeds.ts` are
  `identityTaskFields(key)` and `scenarioTrusteeDocuments(...keys)`.
  - `identityTaskFields(key)` returns `findings`, `dxtrTrustee` (the same record as `sourceRaw`),
    `fingerprint`, `mismatchReason` and `source`.
  - `scenarioTrusteeDocuments(...keys)` returns the scenarios' trustees with `documentType` and
    `phoneticTokens`.
  - `trustee-match-all-scenarios.ts` and `trustee-data.ts` use these helpers. The hand-scoring
    helpers `candidate()`, `findings()` and `identityTask()` and the `NAME_*` constants are deleted.
  - dev-tools loads the JSON at runtime through `MockData` under tsx.
- **e2e.** Each task in `mongo-fixture.json` now carries a `findingsScenario` key, with no
  `findings`, `dxtrTrustee`, `fingerprint`, `variant` or `mismatchReason`. `seed-database.ts`
  resolves the key and removes it.
  - It computes `variant` and `fingerprint` with the production `trustee-variant.helpers.ts`.
  - It inserts the scenarios' trustees after the PII step, since they are fictional.
  - **Deviation from the prompt:** the prompt said to read the JSON with `readFileSync`. The seed
    imports common (relative path) instead, because it also needs the scenario trustees. The backend
    container already contains `/app/common` and `/app/backend`.
  - The approved task now resolves to `seed-trustee-match-relocated`.
- **ui-sandbox** seeds `oneCandidateAddressAndPhoneDiffer` the same way.
- **mock-api2** imports `trustee-match-findings.generated.json` directly, not through `MockData`, so
  faker stays out of the bundle. The fake task id is now `e8c1f0a2-identity-task-multimatch`.
- **Validator.** `assertTrusteeMatchFindingsValid` now reads the raw `cityStateZipCountry`, not
  `parsedCityStateZip`.

### Assertions changed because generated values differ

- **e2e `trustee-match-verification.spec.ts`** (ambiguous task):
  - Column headers are now Taylor Multimatch and Tyler Multimatch.
  - The approve test id is `approve-candidate-seed-trustee-match-multi-b`; the modal name is Tyler
    Multimatch.
  - The differs-icon count goes from 2 to 6: name, phone and street for both candidates. The old
    hand-written findings compared only the name.
- **a11y `data-verification.test.ts`**: uses the new fake task id and the approve id
  `seed-trustee-match-multi-b`.
- **dev-tools `scenarios.test.ts`**: the trustee-data task is `'ambiguous'`, with Sam and Pat as
  candidates.

## Task 3: Explanation mapper and accordion rendering

- **Mapper.** `trustee-explanation.ts` adds `buildTrusteeExplanation(findings)`, a pure function
  reusing `differingRows` (now exported from `trustee-comparison.ts`). Zero/2+ candidates get the
  generic sentences; one candidate maps its differing rows to groups (name; address from
  street/city/zip; state; phone; email) in that fixed order, joined with no serial comma, with
  `does`/`do` on group count. `showNameInterpretation` reuses the name row's `differs` flag as-is.
- **Spec-vs-reality gap, resolved by reusing the existing flag.** The prompt's wording for
  `showNameInterpretation` ("missing, failed, or non-exact quality") reads as true for a missing
  `doesNameMatch` record, but `differingRows`' existing `isExactGrade` treats a missing scorer as
  neutral/not-differing for every field (a scorer that wrote nothing found nothing to compare).
  Since the task says to reuse the same condition as the name row's `differs` flag, the
  implementation follows that flag's actual behavior rather than the prose: a missing name score
  does not show the section. This never arises with real findings anyway - the pipeline always
  scores name, since it drives recall.
- **Loading state covers more than "fetching."** The accordion only fetches `findings` on first
  expand (`handleExpand`), so "before expansion" and "actively fetching" are both states where no
  explanation exists yet. The implementation shows the `Loading…` placeholder (reusing the existing
  `affected-cases-loading` test id) whenever `buildTrusteeExplanation`'s input isn't available yet,
  covering both - this is harmless since the collapsed panel isn't visible either way, and it
  matches "until detail loads, show only the loading placeholder, not the generic sentence."
- **No duplicated case count.** The sentence now says "Affects N case(s):" itself, so the case-link
  rendering for pending tasks no longer prints its own "{n} cases:" prefix (the resolved-task view's
  rendering is untouched and keeps its own).
- Five pre-existing `TrusteeMatchVerificationAccordion.test.tsx` tests asserted the old
  pre-explanation behavior (case count visible before any expand, independent of findings); these
  were updated to reflect the new behavior rather than preserved, since the old behavior is exactly
  what this task changes.

## Task 4: Playwright e2e, Playwright a11y and integration coverage

- **e2e fixture.** Added a fifth `trustee-match-verification` task
  (`e2e-trustee-match-verification-pending-4`, case `081-94-55601`) using the
  `oneCandidateStateDiffers` scenario, so the fixture now covers all five sentence/name-section
  states: 0 candidates, 2+ candidates, 1 candidate address+phone differing (non-exact name), 1
  candidate state-only differing (exact name), plus the existing approved task.
- **e2e assertions** (`trustee-match-verification.spec.ts`): one test asserts each sentence kind's
  text; one asserts the name section shows only for the non-exact-name task and is absent on the
  exact-name, multi-candidate and no-candidate tasks.
- **a11y.** The fake API (`mock-api2.ts`) only ever served one ambiguous (2-candidate) ask, which
  never shows the name section, so a second fake-API task was added
  (`f3b2c1d0-identity-task-name-nonexact`, the `oneCandidateAddressAndPhoneDiffer` scenario, a
  non-exact name) and the detail endpoint now looks up by id instead of always returning the one
  task. A new a11y test expands it, asserts no axe violations, and checks the heading order
  (`How CAMS read this name` directly before `Potential Matches`, both `h3`).
- **Integration (`trustee-match-scenarios-harness.ts`).** Added `assertCandidateScoresForUi`, called
  for scenario 6 (no-match) and scenario 8 (ambiguous, two candidates): asserts every candidate's
  stored `doesNameMatch` is a graded pass, and that `doesStateMatch` is recorded whenever both the
  source and the candidate have a state. Scenario 6 has zero candidates, so its call is a documented
  no-op kept only for parity with the task's wording; the real assertions run against scenario 8.
  Not run in this session (requires SQL Edge + Mongo infrastructure); typechecked standalone against
  `backend/tsconfig.json`.

## Slice Completion Checklist status

- Tasks 1-4 implemented; `cams-c45pn.6.1` closed after Task 1.
- Unit tests pass (`trustee-explanation.test.ts`, updated
  `TrusteeMatchVerificationAccordion.test.tsx`, all other `user-interface` and `backend` tests green
  aside from two pre-existing, unrelated flakes: `consolidationsUseCase.test.ts` and an
  unhandled-rejection warning in `Session.test.tsx` under full-suite parallel runs, both reproduced
  identically on the unmodified branch).
- **a11y**: run locally (`npm run start:a11y` +
  `npx playwright test --project=chromium test/accessibility/data-verification.test.ts`) - all 3
  tests pass, including the new name-section coverage.
- **Integration harness**: run locally against containerized SQL Edge + Mongo
  (`test/integration/trustee-match-scenarios/scripts/start-services.sh`, then `seed-schema`,
  `seed-sql`, `seed-cosmos`, `run`, `clean`, `stop-services.sh`) - all scenarios pass, including the
  new scenario 6/8 scorer-coverage assertions.
- **e2e**: `npm run e2e` from `test/e2e/` passes, 20 passed and 1 skipped (`trustees.spec.ts`
  "should assign an auditor to a trustee", skipped before this slice). The first run failed one
  assertion: the `oneCandidateAddressAndPhoneDiffer` task expected "Trustee address and phone ...",
  but its source name "Jordan Imperfectmach" differs from the candidate "Jordan Imperfectmatch", so
  the mapper correctly renders "Trustee name, address and phone sent to CAMS do not exactly match a
  trustee in CAMS." The spec's expected text was corrected. The local-environment blockers recorded
  in an earlier session (`slirp4netns` removed, `test/e2e/.env` pointing at Azure SQL) were specific
  to that machine: podman 5.8.1 on macOS still supports `slirp4netns`, and a `test/e2e/.env` built
  from `.env.local.example` works.
- **UX sign-off**: the sentence for each seeded scenario was reviewed and approved by Kelly
  Diabagate, 2026-10-29, including "does not exactly match" for the state sentence and "Trustee
  information sent to CAMS does not exactly match a trustee in CAMS." when one candidate differs in
  no compared field.
- `trustee-identity-verification.workflow-state.json` advanced to Slice 4.

## Dev seed realism (after Tasks 1-4)

Expanding an identity task in Azure dev crashed the accordion in `buildTrusteeComparison` for tasks
with no `findings`: 8 retired seed tasks from before PR #3202 and 12 tasks the DXTR sync wrote
before Slice 2. All 20 were deleted from dev. Every other environment must run
`npm run unseed:local` before `npm run seed:local` once this branch merges.

Seed changes, each covered by `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.test.ts`
or `scenarios.test.ts`:

- `trustee-match-all-scenarios.ts` seeds one pending task per explanation-sentence shape, adding
  `oneCandidateStateDiffers`, `oneCandidateNameAddressEmailDiffer`, `oneCandidateExactName` and
  `oneCandidateNothingDiffers`.
- Every pending task has a surrogate `CASE_APPOINTMENT` for its own case in both
  `case-trustee-appointments` and `trustee-case-appointments`, as the sync writes. Without one,
  approval skipped the division check and remapped nothing.
- No identity task, `affectedCaseIds` snapshot or surrogate is on a `dxtr-historical-trustees` case
  (`091-99-86706`, `091-99-87899`, `091-99-99943`, `091-99-97816`, `091-99-98483`); the sync never
  raises a task for a case whose trustee it resolved. The multi-case bundle and its approved
  snapshot use `091-99-25850`, `091-99-26681`, `091-99-26914`; the approved no-surrogate task uses
  `091-99-28263`. `trustee-data.ts`'s task moved to `091-99-16994`.

Multi-case coverage: no code path branches on candidate count and case count together, so the seeded
multi-case tasks (one candidate each) exercise the same paths a 0- or 2+-candidate multi-case task
would. The one multi-case behavior no seed reaches is `TrusteeSearchModal`'s coverage check (Confirm
disabled when the searched trustee does not cover every affected case,
`TrusteeSearchModal.tsx:206-219`), which is unit-tested only with a single case.
