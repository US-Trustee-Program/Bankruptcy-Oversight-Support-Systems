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

| Script                                                                         | npm command                         | Slice         | Notes                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ----------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts`                | seed:local + seed:main              | 2 (rewritten) | 7 identity tasks: no match with no candidates; ambiguous with 2 candidates (one exact, one with a phone typo and a different street); no match with 1 candidate (city, zip and phone differ); pending multi-case and division-mismatch bundles; 2 approved tasks. The 7 inactive-status tasks were dropped: they are appointment concerns (CAMS-956), not identity tasks |
| `dev-tools/db_scripts/scenarios/trustee-data.ts`                               | seed:local + seed:main              | 2 (rewritten) | 1 no-match task with 1 candidate (nickname name match, no contact data to compare)                                                                                                                                                                                                                                                                                       |
| `test/e2e/fixtures/mongo-fixture.json` via `test/e2e/scripts/seed-database.ts` | e2e seed                            | 2 (rewritten) | 4 identity tasks: `pending-1` ambiguous (2 candidates), `pending-2` and `approved` no match (1 candidate), `pending-3` no match (none); the inactive-status task was dropped. The Playwright spec is updated in S2.8                                                                                                                                                     |
| `test/ui-sandbox/scripts/seed.ts`                                              | ui-sandbox seed                     | 2 (rewritten) | 1 no-match task whose candidate differs on every field but State                                                                                                                                                                                                                                                                                                         |
| `user-interface/src/lib/testing/mock-api2.ts`                                  | fake API (`CAMS_USE_FAKE_API=true`) | 2 (rewritten) | 1 ambiguous task with 2 candidates; the detail route returns it with findings                                                                                                                                                                                                                                                                                            |

Stored scores are derived by hand from the scorer rules in `trustee-match-pipeline-stages.ts`. The
seed validator `assertTrusteeMatchFindingsValid` (`dev-tools/db_scripts/lib/test-data-utils.ts`)
rejects a score recorded for a comparison with no data on one side, which would render a false
warning marker.

## Migration Steps

| Sequence | Action                                        | Slice | Notes                                                                                                              |
| -------- | --------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------ |
| —        | none                                          | 1     | —                                                                                                                  |
| 1        | Purge and reseed `trustee-match-verification` | 2     | No migration: the DXTR sync never ran in production and staging is purged; documents in the old shape are not read |

## Environment Notes

Slice 1 needs no reseeding. Slice 2 needs every environment's `trustee-match-verification`
collection reseeded from the scripts above.
