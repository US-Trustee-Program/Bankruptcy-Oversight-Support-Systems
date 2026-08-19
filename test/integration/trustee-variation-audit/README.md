# Trustee Variation Audit — Exploratory Investigation

Exploratory harness (NOT a regression gate) that sanity-checks the persisted
`trustee-variation` collection: for every `TRUSTEE_VARIATION` record (a DXTR
demographic snapshot recorded alongside the `trusteeId` it was auto-linked or
human-approved to), decode the snapshot and score it against the CAMS trustee
it points to using the exact same scoring functions production matching uses
(`calculateNameScore`, `calculateAddressScore`, `calculatePhoneScore`,
`calculateEmailScore` from `trustee-match.helpers.ts`). Surfaces anything that
looks like a poor match, which would mean a past auto-link (or approval)
recorded the wrong person.

**Makes no changes to the as-built matching logic or to any collection.** This
harness is investigation only — no database is used; both fixture files are
read directly and compared in memory.

## Why `fixtures/` is never committed

`fixtures/` contains real trustee PII (names, addresses, phone numbers,
emails) pulled from staging exports. Gitignored
(`test/integration/.gitignore`'s `trustee-variation-audit/fixtures/` rule) and
must never be committed. Re-create it locally per the format below before
running this harness.

## Required fixture files

Place these two files in `fixtures/` (create the directory — it does not
exist in the repo):

### `trustee-variants.json`

A raw MongoDB export (as JSON array) of the `trustee-variation` collection —
`TrusteeVariation` documents
(`common/src/cams/trustee-variation.ts`). Minimum fields:

```jsonc
{
  "_id": { "$oid": "..." }, // Mongo extended-JSON id wrapper — stripped on load
  "id": "variation-record-uuid",
  "fingerprint": "sha256 hex string",
  "variant": "{\"firstName\":\"...\",\"middleName\":\"...\",\"lastName\":\"...\",\"generation\":\"...\",\"address1\":\"...\",\"address2\":\"...\",\"address3\":\"...\",\"cityStateZipCountry\":\"...\",\"phone\":\"...\",\"fax\":\"...\",\"email\":\"...\"}",
  "trusteeId": "uuid" // the CAMS trustee this DXTR variant was linked to
}
```

`variant` is a JSON-encoded string (see `buildVariant` in
`backend/lib/use-cases/dataflows/trustee-variant.helpers.ts`) — this harness
decodes it before scoring.

### `2026-08-18-trustees.json`

A raw MongoDB export (as JSON array) of the `trustees` collection's
`TRUSTEE` documents — same format the `trustee-match-normalization` harness
uses (see its own README for the exact shape). Re-use the same export file if
one is already on disk from that harness's fixtures.

## Usage (from test/integration/)

```bash
npm run trustee-variation-audit
```

No `start-services.sh`/`seed`/`clean` steps — this harness never touches a
database.

## Outcome categories

- `none` — nameScore ≥ 85 and addressScore > 0: no concern raised.
- `trustee-not-found` — the variant's `trusteeId` isn't present in the
  trustees export at all. Worth checking whether the trustee was deleted/
  merged since the variant was recorded.
- `name-mismatch` — nameScore < 85. In practice this usually means a compound
  name (e.g. "Lou Ann" or "Reed Outlaw") landed in a different
  firstName/middleName/lastName field split between DXTR and CAMS, or a
  genuine middle-initial disagreement — not necessarily a wrong trusteeId.
  Worth a human glance, especially if address/phone/email also fail to
  corroborate.
- `weak-corroboration` — nameScore is fine, but addressScore is 0 (DXTR's
  `cityStateZipCountry` didn't parse — a malformed ZIP, a two-letter
  jurisdiction code like "DC" the parser doesn't expect, etc.). Usually a
  DXTR data-quality artifact, not a wrong match, since name still
  corroborates strongly.

None of these categories are proof of a bad auto-link on their own — they are
worth a human glance because the harness's own scoring functions are the same
ones production trusts to make match/no-match decisions, so a low score here
means production's own logic would have hesitated too, had this variant been
evaluated fresh instead of trusted via the fast path.
