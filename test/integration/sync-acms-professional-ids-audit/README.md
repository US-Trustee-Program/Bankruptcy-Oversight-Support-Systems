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
