# Sync ACMS Professional IDs — Audit

Exploratory harness (NOT a regression gate) that sanity-checks the persisted
`trustee-professional-ids` collection after a real `sync-acms-professional-ids` dataflow run: for
every `TRUSTEE_PROFESSIONAL_ID` record, decode its `variant` (the ACMS demographic snapshot) and
score it against CAMS trustees using the exact same scoring functions production matching uses
(`calculateNameScore`, `calculateAddressScore`, `calculatePhoneScore`, `calculateEmailScore` from
`trustee-match.helpers.ts`).

Two passes:

1. **Linked records** — score the variant against the trustee it was actually linked to, to surface
   a past auto-link that looks like a poor match (false positive). Same approach as
   `trustee-variation-audit`, applied to the professional-id fast path instead of the
   trustee-variation fast path.
2. **Error records** (`no-match`/`ambiguous`) — score the variant against every trustee in the
   export and report the best-scoring candidate, to surface a real match production's matcher missed
   (false negative). This pass has no live-repository equivalent to call directly
   (`matchTrusteeByName` requires a database-backed `ApplicationContext`), so it re-implements the
   same name-then-corroborate logic as a plain in-memory scan instead.

**Makes no changes to the as-built matching logic or to any collection.** This harness is
investigation only — no database is used; fixture files are read directly and compared in memory.

## Known finding (2026-08-25 export)

Running this harness against a real staging export surfaced a systemic data bug, not a matcher bug:
**100% of error records (1311/1311) have an unparseable `cityStateZipCountry`**, because ACMS's
`PROF_ZIP` column is cast straight to `VARCHAR(9)` with no dash inserted for the ZIP+4 format and no
zero-padding for shorter zips (`backend/lib/adapters/gateways/acms/acms.gateway.ts:356`).
`parseCityStateZip` requires a `\d{5}(-\d{4})?` token and finds none, so `calculateAddressScore`
returns 0 unconditionally for every one of these records — address corroboration was structurally
unavailable for the entire name-match fallback path, not just weak in some cases. 766 of the 1311
error records (58%) have a best-candidate name match scoring 100 (many with phone=100 too) that
still didn't auto-link, consistent with a single exact name match alone correctly not being trusted
without corroboration — but with that corroboration path silently starved for the whole error
population. Linked records never hit this at all (they carry no `variant` — they matched via the
fingerprint bucket, not the name-match fallback).

This does not mean production's matcher logic is wrong; it means the ACMS zip data feeding into it
was unusable for this whole population. Worth a fix at the gateway/query layer (proper `NNNNN-NNNN`
formatting from `PROF_ZIP`) before revisiting whether the address-corroboration gate itself needs
adjustment.

## Known finding: the `no-name-candidate` bucket (2026-08-26 export)

Following the zip-formatting fix above, a full investigation of the 2229-record error population
from a 2026-08-26 export found 935 records where
`calculateNameScore` never clears the auto-link threshold against *any* trustee in the export at
all — the largest single outcome bucket. This is not a matcher gap:

- **20 records (0.9%) are literal ACMS sentinel/placeholder rows** — `PROF_LAST_NAME` values like
  `"NO TRUSTEE"`, `"NO TRUSTEE ASSIGNED"`, `"CASE STRICKEN: NO TRUSTEE"` — always with
  `PROF_FIRST_NAME` empty. These were never real professionals and were never going to match
  anything. Fixed at the source: `acms.gateway.ts`'s `getTrusteeProfessionalRecordsPage` query now
  excludes `PROF_LAST_NAME LIKE '%NO TRUSTEE%'` alongside its existing `DELETE_CODE`/`PROF_TYPE`
  filters, so these rows never reach the matcher or generate an error record at all.
- **The remaining 915 records (97.9%) are genuinely-named ACMS professionals with no CAMS
  counterpart.** The trustees export used throughout this investigation is 100% `status: active` —
  a real but inactive/historical ACMS professional has no active-trustee row to match against *by
  design*, not because the matcher failed to find one. This is expected and not something to fix
  in the matching algorithm; if this population needs addressing, it would be a separate
  active/inactive-trustee-data question, not a `sync-acms-professional-ids` change.

## Known finding: `ambiguous` false negatives are corroboration-policy, not a data or fuzzy-match gap (2026-09-14 export)

A 6392-record export (3658 linked, 2734 errored: 2456 `ambiguous`, 278 `no-match`) found 1566
notable misses (best-candidate nameScore ≥ 60 on a record production did NOT auto-link) —
**every one of them is on an `ambiguous`-disposition record; zero of the 278 `no-match` records
have a notable-scoring candidate at all.** Genuine no-matches are, in this export, genuinely
unmatchable — the entire opportunity for tightening lives in the ambiguous bucket.

Cross-referencing each notable miss against its persisted `error.trustees` candidate-id list
(`sync-acms-professional-ids.ts:287-297`, `processNameMatch`) splits that bucket into two
different phenomena:

- **509 of 1566 (32%) already carry exactly one candidate trusteeId.** Production's own
  `resolveCandidatesByCorroboration` (contact corroboration, then duplicate-name resolution) had
  already run against that single candidate before persisting `ambiguous` and still didn't trust
  it enough to auto-link — despite this harness's independent scoring often showing name=100 and
  phone=100 against that same candidate (857 of 1566 notable misses score phone=100). This is a
  corroboration-policy question, not a missing-data or fuzzy-matching gap: the right trustee is
  already the sole candidate on file.
- **The remaining 1057 (68%) carry genuinely multiple candidates** — median list size 3, but with a
  long tail (23 records list 100+ candidates, one lists 909). These are a large-scale ACMS-alias
  pattern: the same real trustee is filed under many `acmsProfessionalId` codes (one per
  district/chapter/spelling variant — e.g. "NAME (TR)", "NAME (TR)SA" and similar suffixed variants
  of the same base name all resolve to the same one real trustee). A single ambiguous name apparently matches
  broadly enough across the trustees collection that `matchTrusteeByName` returns a large raw
  candidate set before corroboration ever narrows it — worth checking whether the initial
  name-candidate query itself is too permissive for common surnames, independent of the
  corroboration step that follows it.

Not evaluated here: whether loosening corroboration for the single-candidate bucket, or tightening
the initial candidate query for the multi-candidate bucket, is the right lever — that requires
judgment about acceptable false-positive risk this fixture-only harness can't supply. This finding
only establishes where the opportunity is concentrated.

## Known finding: replaying the 2026-09-14 export's error population through current `main` (2026-09-17)

`pipeline-replay-backtest.ts` replays every error-disposition (`no-match`/`ambiguous`) record from
the same 2026-09-14 export through the actual, unmodified current-branch matching pipeline
(`runTrusteeMatchPipeline`) — not a reimplementation. Run after this session's CAMS-876 work
(SCORE/RESOLVE decoupling, `isCorroboratedByGeoOrContact`, the `parseCityStateZip` right-to-left
fix, middle-initial full credit, and everything else committed on
`CAMS-876-tighten-professional-id-matching` as of 2026-09-17):

  resolved      1583  (57.9%)
  ambiguous      537  (19.6%)
  no-match       606  (22.2%)
  skipped          8  (0.3%)

**A full purge + re-sync against current `main` would recover 1583 of this export's 2734
error-disposition records (57.9%) without any further matcher code change** — this branch's
accumulated CAMS-876 changes, applied retroactively to the same fixture population the
2026-09-14 finding above was measured against, already resolve the majority of what was
previously `ambiguous`/`no-match`. Of the 4585 total candidates scored across all replayed
records, 1583 resolved, 2611 were rejected on name, 252 on corroboration, and 139 as an
ambiguous group.

Not yet re-run: an updated version of the `ambiguous`-bucket breakdown from the finding above
(single-candidate vs. multi-candidate split) against this new, smaller 537-record `ambiguous`
population — worth doing before concluding which of cams-6gver/cams-k6la0/cams-4nayq would move
the number further.

## Known finding: `resolveBySoleCandidateStateOnly` recovers 154 more records (2026-09-17)

An AI-screening pass (2026-09-16, `data/ai-review-unresolved-shard-*.csv`, since deleted as
regenerable/stale — see cams-4nayq) found a large population of sole-candidate, strong-name-match
records where the ACMS and CAMS addresses disagree on city/zip but agree on state — genuine
metro-area or office-relocation variance (e.g. a same-name ACMS/CAMS pair in Anchorage AK vs.
Eagle River AK, or Gig Harbor WA vs. Puyallup WA), not a different person. `isCorroboratedByGeoOrContact`/`resolveByConsensus` deliberately never resolves
on state agreement alone (see that function's doc comment and cams-6gver) — but that gap was
scoped to a candidate with otherwise-thin evidence; a re-check against the fresh
2026-09-17 backtest found 283 unresolved records with `doesNameMatch >= 85` AND
`contactCorroborationAddress < 60`, of which 123 are true sole-candidate cases with no one else
to be ambiguous against.

Per Brian's direction, added `resolveBySoleCandidateStateOnly` (a new, narrowly-scoped RESOLVE
stage, distinct from and running strictly after `resolveByConsensus`): a sole name-qualifying
candidate resolves on state agreement alone when there is no second candidate in the pool to
weigh it against. Re-running the same 2026-09-14 export through the updated pipeline:

  resolved      1737  (63.5%, up from 1583/57.9% before this stage)
  ambiguous      383  (14.0%, down from 537/19.6%)
  no-match       606  (22.2%, unchanged)
  skipped          8  (0.3%, unchanged)

`no-match` held exactly constant — every recovered record moved from `ambiguous` to `resolved`;
nothing that previously resolved or correctly no-matched changed.

Per further direction from Brian, `resolveByExactNameAndState` was split into two clearly-named
stages and its exact-match rule relaxed further: `resolveBySoleExactNameMatch` (a SOLE exact-name
candidate resolves immediately, no state/city/zip check needed at all - stronger than the prior
"state + a second city/zip signal" requirement) and `resolveBySoleExactNameMatchByStateThenGeo`
(2+ exact-name candidates: narrow by state, then by city-or-zip, as discriminators rather than
requirements). Re-running the same 2026-09-14 export again after this refactor:

  resolved      1796  (65.7%, up from 1737/63.5% after resolveBySoleFuzzyNameMatchAndState alone)
  ambiguous      324  (11.9%)
  no-match       606  (22.2%, unchanged)
  skipped          8  (0.3%, unchanged)

`no-match` again held exactly constant.

## Known finding: extended the ACMS placeholder-name filter (2026-09-17)

The same AI-screening pass found 13 records in the unresolved population (2026-09-17 fresh
backtest) carrying placeholder/junk ACMS names the existing `PROF_LAST_NAME NOT LIKE
'%NO TRUSTEE%'`/`'%DECEASED%'` filter (`acms.gateway.ts`'s `getTrusteeProfessionalRecordsPage`)
does not catch: `REOPENED_CASE`/`RE OPENED (JACKSON)`/`REOPENED CASE`, `NO TRRUSTEE` (a
misspelling `LIKE '%NO TRUSTEE%'` misses), `NO TR APT`, `I.M. FAKE`/`I M FAKE`/`FAKE`, `PRO SE`,
and `TRUSTEE_UNASSIGNED`. None of these carry a real person's identity — no matcher tuning could
ever resolve them — so they were excluded at the source query rather than tolerated downstream.
This is a small population (13 of 1143 unresolved records, 1.1%) — not the 37.9%-of-all-2029-rows
figure the original stale 2026-09-16 AI-screening CSVs suggested, which was inflated by noise
since resolved by `resolveBySoleCandidateStateOnly` above and the fuzzy-lastname corroboration
work earlier this session. Not independently backtestable via `pipeline-replay-backtest.ts` (it
replays an already-exported fixture; this fix only takes effect on the next live ACMS sync/export)
— verified instead via `acms.gateway.test.ts`'s SQL-clause assertions.

## Why `fixtures/` is never committed

`fixtures/` contains real trustee PII (names, addresses, phone numbers, emails, ACMS professional
IDs) pulled from staging exports. Gitignored (`test/integration/.gitignore`'s
`sync-acms-professional-ids-audit/fixtures/` rule) and must never be committed. Re-create it locally
per the format below before running this harness.

## Required fixture files

Place these in `fixtures/` (create the directory — it does not exist in the repo):

### `<date>-trustee-professional-ids.json`

A raw MongoDB export (as JSON array) of the `trustee-professional-ids` collection —
`TrusteeProfessionalId` documents (`common/src/cams/trustee-professional-ids.ts`). Minimum fields:

```jsonc
{
  "_id": { "$oid": "..." }, // Mongo extended-JSON id wrapper — stripped on load
  "id": "record-uuid",
  "documentType": "TRUSTEE_PROFESSIONAL_ID",
  "camsTrusteeId": "uuid-or-fingerprint",
  "acmsProfessionalId": "NY-00063",
  "variant": "{\"firstName\":\"...\", ...}", // present on error records; absent when fingerprint-linked
  "error": { "disposition": "no-match" }, // present only on unlinked records
}
```

By default the harness picks the lexically-newest (date-prefixed) file matching
`*trustee-professional-ids*.json` in `fixtures/`. Override with the `PROFESSIONAL_IDS_FIXTURE` env
var (filename only, relative to `fixtures/`).

### `<date>-trustees.json`

A raw MongoDB export (as JSON array) of the `trustees` collection's `TRUSTEE` documents — same
format the `trustee-match-normalization` and `trustee-variation-audit` harnesses use. Re-use an
existing export if one is already on disk from those harnesses' fixtures (as long as the trustees
collection hasn't changed meaningfully since).

By default the harness picks the lexically-newest file matching `*trustees*.json` in `fixtures/`.
Override with `TRUSTEES_FIXTURE`.

## Usage (from test/integration/)

```bash
npm run sync-acms-professional-ids-audit
```

No `start-services.sh`/`seed`/`clean` steps — this harness never touches a database.

## Outcome categories

**Pass 1 (linked records):**

- `none` — nameScore ≥ 85 and addressScore > 0: no concern raised.
- `trustee-not-found` — the linked `camsTrusteeId` isn't present in the trustees export at all.
- `name-mismatch` — nameScore < 85 on a record production auto-linked.
- `weak-corroboration` — name matched, but addressScore is 0.

**Pass 2 (error records):**

- Disposition summary (`no-match`/`ambiguous` counts, straight from the source data).
- Unparseable-zip rate — see "Known finding" above; interpret notable misses in light of this.
- Notable misses — a `no-match`/`ambiguous` record whose best-scoring candidate in the trustees
  export has nameScore ≥ 60 (see `NOTABLE_MISS_THRESHOLD` in the script). Each is tagged
  `[unparseable zip]` when address corroboration was structurally unavailable for that record.

None of these categories are proof of a bad outcome on their own — they are worth a human glance
because the harness's own scoring functions are the same ones production trusts to make
match/no-match decisions.
