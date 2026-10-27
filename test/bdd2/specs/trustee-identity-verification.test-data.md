# Test Data — Trustee Identity Verification
Ticket: CAMS-953 (GitHub #3187)

## Overview
The feature needs trustee identity tasks (`trustee-match-verification` collection) in the Data Verification queue, alongside transfer and consolidation orders.
- Slice 1 changes only labels, so it uses the existing seeds.
- Slice 2 changes the task shape to store the matching pipeline's `findings`, which means every seed that writes identity tasks must be rewritten.
- Later slices add scenarios: no case, partial coverage, more than 5 candidates, and an ACMS professional id.

## Seed Scripts

| Script | npm command | Slice | Notes |
|---|---|---|---|
| `dev-tools/db_scripts/scenarios/trustee-match-all-scenarios.ts` | seed:local + seed:main | 1 (existing, unchanged) | 15 identity tasks in the old `matchCandidates` shape; rewritten in Slice 2 |
| `test/e2e/scripts/seed-database.ts` | e2e seed | 1 (existing, unchanged) | Feeds the Playwright specs |
| `test/ui-sandbox/scripts/seed.ts` | ui-sandbox seed | 1 (existing, unchanged) | Trustee-match mismatch fixture |

## Migration Steps

| Sequence | Action | Slice | Notes |
|---|---|---|---|
| — | none | 1 | — |

## Environment Notes
Slice 1 needs no reseeding.
