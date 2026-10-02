# Sync ACMS Professional IDs — Audit

Exploratory scripts (not a regression gate) for inspecting an export of the
`trustee-professional-ids` collection written by the `sync-acms-professional-ids` dataflow. Nothing
here changes matching logic or writes to any shared collection.

The main harness (`scripts/sync-acms-professional-ids-audit-harness.ts`) scores each record's
`evidence.sourceRaw` against CAMS trustees with `calculateNameScore`, `calculateAddressScore`,
`calculatePhoneScore`, and `calculateEmailScore` from `trustee-match.helpers.ts`. Those are the
scorers the DXTR case-appointment path uses, not the graded scorers of the ACMS matching pipeline
(`runTrusteeMatchPipeline`), so a disagreement between the harness and a persisted disposition is a
prompt to inspect the record, not proof the pipeline is wrong. To replay records through the
pipeline itself, use `pipeline-replay-backtest.ts`.

The harness runs two passes:

1. **Linked records** (`disposition === 'linked'`) — score the source against the trustee it was
   linked to, to surface a link that looks like a poor match (false positive). Same approach as
   `trustee-variation-audit`.
2. **Non-linked records** (`disposition !== 'linked'`: `no-match`, `ambiguous`, `skipped`, `error`,
   `conflict`) — score the source against every trustee in the export and report the best-scoring
   candidate, to surface a match the pipeline missed (false negative). This is a plain in-memory
   scan; no database is used.

## Invariants

- `PROF_ZIP` is `NUMERIC(9,0)`; `formatAcmsZip` (`acms-trustee-variant.helpers.ts`) must zero-pad
  before splitting, or `parseCityStateZip` fails.
- Placeholder names (`NO TRUSTEE`, `DECEASED`, `FAKE`, `PRO SE`, and similar) are recognized only in
  `shouldSkipAsNotAPerson`/`skipAdministrativePlaceholder`; the gateway query (`acms.gateway.ts`)
  must not filter them.

## Scripts

All in `scripts/`, run from `test/integration/` with
`npx tsx --tsconfig ../../backend/tsconfig.json sync-acms-professional-ids-audit/scripts/<script>`
unless an npm script is listed.

- `sync-acms-professional-ids-audit-harness.ts` (`npm run sync-acms-professional-ids-audit`) — the
  two-pass audit described above; fixtures only, no database.
- `start-services.sh` / `stop-services.sh` — start and tear down a disposable MongoDB pod on
  `localhost:27118` for `pipeline-replay-backtest.ts`, separate from the shared
  `cams-local-infra-mongo` container. `.env.template` holds the matching
  `MONGO_CONNECTION_STRING`/`COSMOS_DATABASE_NAME`.
- `pipeline-replay-backtest.ts` — seeds the disposable Mongo with the trustees fixture, replays
  every professional-ids record's `evidence.sourceRaw` through the real `runTrusteeMatchPipeline`,
  and writes `data/replay-backtest-report.jsonl` (full serialized state per record) plus
  `data/replay-backtest-divergences-detail.csv` (records where the replay disagrees with the
  exported disposition or trustee). Requires `MONGO_CONNECTION_STRING` and `COSMOS_DATABASE_NAME`
  set inline.
- `partition-backtest-report.ts` — splits `replay-backtest-report.jsonl` into per-disposition CSVs
  (`no-match`, `ambiguous`, ambiguous with `suspectDuplicateCamsTrustee`, `skipped`) under `data/`,
  one row per (ACMS record, candidate) pair.
- `auto-link-risk-triage.ts` — buckets the linked records in `replay-backtest-report.jsonl` by risk
  tier and writes the suspects to `data/auto-link-risk-suspects.csv` for human review.
- `ai-candidate-review.ts` — sharded (`--shard=N --of=M`) second-opinion review of
  `replay-backtest-report.jsonl`: one isolated `claude -p` call per record, writing
  `data/ai-review-*.csv`. Requires an authenticated `claude` CLI; prompt template in
  `ai-candidate-review-prompt.md`.

The remaining scripts (`anchored-levenshtein-*`, `auto-link-threshold-backtest.ts`,
`fuzzy-name-threshold-backtest-harness.ts`, `levenshtein-lastname-experiment.ts`,
`no-match-discovery-gap-investigation.ts`, `token-intersection-*`, `weak-corroboration-backtest.ts`)
are historical experiment scripts, not part of this workflow, and may not match the current document
shape.

`data/` is at the repo root and gitignored; its files hold the same PII as the fixtures.

## Why `fixtures/` is never committed

`fixtures/` contains real trustee PII (names, addresses, phone numbers, emails, ACMS professional
IDs) pulled from staging exports. It is gitignored (`test/integration/.gitignore`'s
`sync-acms-professional-ids-audit/fixtures/` rule) and must never be committed. Re-create it locally
per the format below.

## Required fixture files

Place these in `fixtures/` (create the directory if it does not exist).

### `<date>-trustee-professional-ids.json`

A raw MongoDB export (JSON array) of the `trustee-professional-ids` collection —
`TrusteeProfessionalId` documents
(`backend/lib/use-cases/dataflows/trustee-professional-ids.types.ts`). Shape, with invented values:

```jsonc
{
  "_id": { "$oid": "..." }, // Mongo extended-JSON id wrapper — stripped on load
  "id": "record-uuid",
  "documentType": "TRUSTEE_PROFESSIONAL_ID",
  "camsTrusteeId": "trustee-uuid", // the ACMS variant's fingerprint when not linked
  "acmsProfessionalId": "ZZ-00001",
  "disposition": "ambiguous", // 'linked' | 'no-match' | 'ambiguous' | 'skipped' | 'error' | 'conflict'
  "linkMethod": "auto", // 'auto' | 'manual'; present only when disposition is 'linked'
  "nameMatchCount": 2,
  "suspectDuplicateCamsTrustee": false, // present only when disposition is 'ambiguous'
  "evidence": {
    "sourceRaw": {
      "firstName": "Jordan",
      "lastName": "Roe",
      "fullName": "Jordan Roe",
      "legacy": { "address1": "1 Main St", "cityStateZipCountry": "Springfield ZZ 00001-0001" },
    },
    "sourceNormalized": {},
    "memo": {},
    "candidates": [], // each: { camsRaw, scores } with every scorer's result
    "match": null, // { trusteeId, score, resolvedBy } when linked
    "skip": false,
    "error": null,
    "variant": "...", // serialized ACMS variant string
    "conflictingTrusteeId": "...", // present only when disposition is 'conflict'
  },
}
```

By default the harness picks the lexically-newest file matching `*trustee-professional-ids*.json` in
`fixtures/`. Override with the `PROFESSIONAL_IDS_FIXTURE` env var (filename only, relative to
`fixtures/`).

### `<date>-trustees.json`

A raw MongoDB export (JSON array) of the `trustees` collection's `TRUSTEE` documents — the same
format the `trustee-match-normalization` and `trustee-variation-audit` harnesses use. Use a trustees
export taken the same day as the professional-ids export, so linked `camsTrusteeId`s and candidate
pools line up.

By default the harness picks the lexically-newest file matching `*trustees*.json` in `fixtures/`.
Override with `TRUSTEES_FIXTURE`.

## Usage (from test/integration/)

```bash
npm run sync-acms-professional-ids-audit
```

The harness needs no `start-services.sh`/`seed`/`clean` steps; only `pipeline-replay-backtest.ts`
needs the disposable Mongo.

## Outcome categories

Score thresholds below are `calculateNameScore`/`calculateAddressScore` points (0-100) from the
audit harness, not pipeline grades.

**Pass 1 (linked records):**

- `none` — nameScore ≥ 85 and addressScore > 0: no concern raised.
- `trustee-not-found` — the linked `camsTrusteeId` is absent from the trustees export.
- `name-mismatch` — nameScore < 85 on a linked record.
- `weak-corroboration` — nameScore ≥ 85, but addressScore is 0.

**Pass 2 (non-linked records):**

- Disposition summary — counts for every non-linked disposition present in the export.
- Unparseable-zip rate — records whose `cityStateZipCountry` `parseCityStateZip` cannot parse;
  `calculateAddressScore` returns 0 for these, so address corroboration was unavailable.
- Notable misses — a non-linked record whose best-scoring candidate in the trustees export has
  nameScore ≥ 60 (`NOTABLE_MISS_THRESHOLD` in the script). Each is tagged `[unparseable zip]` when
  its zip could not be parsed.
