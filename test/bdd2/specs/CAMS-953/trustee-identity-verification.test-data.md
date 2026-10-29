# Test Data — Trustee Identity Verification

Ticket: CAMS-953 (GitHub #3187)

## Overview

The feature needs trustee identity tasks (`trustee-match-verification` collection) in the Data
Verification queue, alongside transfer and consolidation orders.

- Slice 1 changes only labels, so it uses the existing seeds.
- Slice 2 changes the task shape to store the matching pipeline's `findings`, which means every seed
  that writes identity tasks must be rewritten.
- Later slices add scenarios: no case, partial coverage, more than 5 candidates, and an ACMS
  professional id.

## Seed Scripts

Every identity task is seeded the way the DXTR sync writes it: `source: 'DXTR'`, the pipeline's
serialized state as `findings`, and `mismatchReason` `'ambiguous'` (2+ candidates) or `'no match'`
(0 or 1 candidate). No seed writes `matchCandidates`.

| Script                                                                         | npm command                         | Slice         | Notes                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`                | seed:local + seed:main              | 3 (generated) | 11 identity tasks: `noCandidates`; `multipleCandidates` (ambiguous, 2 tied candidates); `oneCandidateAddressAndPhoneDiffer`; `oneCandidateStateDiffers`; `oneCandidateNameAddressEmailDiffer`; `oneCandidateExactName`; `oneCandidateNothingDiffers`; pending `multiCase` and `divisionMismatch` bundles; 2 approved tasks (`resolvedNoSurrogates`, `resolvedWithSnapshot`) |
| `dev-tools/db_scripts/scenarios/trustee-data.ts`                               | seed:local + seed:main              | 3 (generated) | 1 ambiguous task (`seedTrusteeNickname`): Samuel Seedtrustee recalls Sam (nickname) and Pat Seedtrustee                                                                                                                                                                                                                                                                     |
| `test/e2e/fixtures/mongo-fixture.json` via `test/e2e/scripts/seed-database.ts` | e2e seed                            | 3 (generated) | 4 identity tasks, each naming a `findingsScenario` that the seed resolves: `pending-1` `multipleCandidates`, `pending-2` `oneCandidateAddressAndPhoneDiffer`, `pending-3` `noCandidates`, `approved` `oneCandidateExactName`                                                                                                                                                |
| `test/ui-sandbox/scripts/seed.ts`                                              | ui-sandbox seed                     | 3 (generated) | 1 no-match task (`oneCandidateAddressAndPhoneDiffer`)                                                                                                                                                                                                                                                                                                                       |
| `user-interface/src/lib/testing/mock-api2.ts`                                  | fake API (`CAMS_USE_FAKE_API=true`) | 3 (generated) | 1 ambiguous task (`multipleCandidates`), imported from the JSON without `MockData`                                                                                                                                                                                                                                                                                          |

Findings are generated, never hand-scored (Slice 3, Task 1). The scenario inputs are in
`common/src/cams/test-utilities/trustee-match-findings.scenarios.ts`, and the real pipeline's output
is in `trustee-match-findings.generated.json`, which
`backend/lib/use-cases/dataflows/trustee-match-findings.generator.test.ts` writes. After changing a
scenario or a scorer, regenerate with `npm test -- -u trustee-match-findings.generator` in
`backend/`. Seeds read findings through `MockData.getTrusteeMatchScenarioFindings` (dev-tools uses
the `trustee-match-scenario-seeds.ts` helpers) and insert the scenarios' CAMS trustees with the same
`trusteeId`s. The seed validator `assertTrusteeMatchFindingsValid`
(`dev-tools/db_scripts/lib/test-data-utils.ts`) still rejects a score recorded for a comparison with
no data on one side.

## Migration Steps

| Sequence | Action                                        | Slice | Notes                                                                                                              |
| -------- | --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| —        | none                                          | 1     | —                                                                                                                  |
| 1        | Purge and reseed `trustee-match-verification` | 2     | No migration: the DXTR sync never ran in production and staging is purged; documents in the old shape are not read |
| 2        | Purge and reseed `trustee-match-verification` | 3     | Seeds now use generated findings and new fixture trustees                                                          |
| —        | none                                          | 4     | No new seeds; existing multi-case (3 cases) and single-case pending tasks cover the Confirm Trustee Match preview  |

## Environment Notes

Slice 1 needs no reseeding. Slice 2 needs every environment's `trustee-match-verification`
collection reseeded from the scripts above.
