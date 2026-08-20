# Trustee Match Normalization — Exploratory Investigation

Exploratory harness (NOT a regression gate) investigating why `matchTrusteeByName`
(`backend/lib/use-cases/dataflows/trustee-match.helpers.ts`) fails to find obvious CAMS trustee
matches for a sample of real DXTR trustee names pulled from a staging `trustee-match-verification`
export. Seeds a real, unmocked local MongoDB with a real trustee export and replays a hand-built
ground truth through the actual `matchTrusteeByName` function — no mocks.

**Makes no changes to the as-built matching logic.** This harness is for investigation only; any fix
belongs in `trustee-match.helpers.ts` / `sync-trustee-case-appointments.ts` itself, decided and
implemented separately.

## Why `fixtures/` is never committed

`fixtures/` contains real trustee PII (names, addresses, phone numbers, emails) pulled from a
staging export, plus a ground-truth file derived from it. Both are gitignored
(`test/integration/.gitignore`'s `trustee-match-normalization/fixtures/` rule) and must never be
committed. Re-create them locally per the format below before running this harness.

## Required fixture files

Place these three files in `fixtures/` (create the directory — it does not exist in the repo):

### How the original sample was pulled from staging

- `2026-08-18-trustee-verification.json` was a verbatim export of the `trustee-match-verification`
  collection — no query filter.
- `2026-08-18-trustees.json` was an export of the `trustees` collection filtered to
  `{"documentType": "TRUSTEE"}`.

### `2026-08-18-trustees.json`

A raw MongoDB export (as JSON array) of the `trustees` collection's `TRUSTEE` documents — i.e. the
shape produced by `mongoexport --collection=trustees --query='{"documentType":"TRUSTEE"}'` or
equivalent. Each element matches `TrusteeDocument`
(`backend/lib/adapters/gateways/mongo/trustees.mongo.repository.ts`): a `Trustee`
(`common/src/cams/trustees.ts`) plus `documentType: "TRUSTEE"`. Minimum fields the harness/ground
truth work depends on:

```jsonc
{
  "_id": { "$oid": "..." }, // Mongo extended-JSON id wrapper — seed() unwraps this
  "trusteeId": "uuid",
  "name": "Full Name As Stored In CAMS",
  "firstName": "...",
  "lastName": "...",
  "documentType": "TRUSTEE",
  "public": { "address": {/* Address */}, "phone": { "number": "..." }, "email": "..." },
  // ...remaining Trustee fields as exported
}
```

### `2026-08-18-trustee-verification.json`

A raw MongoDB export (as JSON array) of `trustee-match-verification` collection documents —
`TrusteeMatchVerification` (`common/src/cams/trustee-match-verification.ts`), which is a
`TrusteeAppointmentSyncError` (`common/src/cams/dataflow-events.ts`) plus verification-workflow
fields. Fields the ground-truth derivation scripts read:

```jsonc
{
  "id": "verification-record-uuid", // used as ground-truth.json's verificationId
  "caseId": "...",
  "courtId": "...",
  "dxtrTrustee": {
    "firstName": "...",
    "middleName": "...",
    "lastName": "...",
    "fullName": "As DXTR Sent It", // the string matchTrusteeByName is called with
    "legacy": { "address1": "...", "cityStateZipCountry": "...", "phone": "...", "email": "..." },
  },
  "mismatchReason": "NO_TRUSTEE_MATCH", // records of interest have this + empty matchCandidates
  "matchCandidates": [], // this harness's ground truth targets the empty-array subset
  "acmsProfessionalId": "GG-NNNNN", // group prefix + 5-digit code; sentinel suffixes are -99999/-00000/-98000
  "resolvedTrusteeId": "uuid", // present ONLY if a human already resolved it — strongest ground truth signal
  "resolvedTrusteeName": "...",
}
```

The records of interest are the subset where `matchCandidates` is empty (`[]`) — i.e.
`matchTrusteeByName` found zero exact matches via `findTrusteesByName`'s case-insensitive
whitespace-normalized full-name regex.

### `ground-truth.json`

Hand-derived by a human + BOB inspecting each no-candidate `dxtrTrustee.fullName` against
`2026-08-18-trustees.json` for a plausible corresponding CAMS trustee. Structure:

```jsonc
{
  "$comment": "...",
  "sourceFiles": { "verification": "2026-08-18-trustee-verification.json", "trustees": "2026-08-18-trustees.json" },
  "pairs": [
    {
      "verificationId": "...",              // the verification doc's `id`
      "dxtrFullName": "...",                // verbatim dxtrTrustee.fullName
      "expectedTrusteeIds": ["uuid", ...],  // 0 = genuinely no CAMS match exists; 1 = confident single match; 2+ = genuinely ambiguous, should surface for human review
      "expectedTrusteeNames": ["...", ...], // parallel array of `name` values, for human readability
      "confidence": "confirmed-by-human | high | medium | low | ambiguous | not-found-in-export",
      "notes": "why this is/isn't a punctuation-only gap, and what specifically differs"
    }
  ]
}
```

`confidence` is a human judgment call, not a score any matching code produced:

- `confirmed-by-human` — the verification record itself carries a human-set `resolvedTrusteeId`
- `high` — the only difference from an exact match is punctuation/spacing/a suffix (missing period,
  missing comma before a generational suffix, trailing `(TR)`/`Trustee`/`tr`, etc.)
- `medium` — a dropped/added middle name or initial, or a suffix combined with another small gap
- `low` — a nickname/given-name variant (Nikki/Nichole, Rod/Rodney) or a real name-abbreviation
  expansion (M./Michael) — NOT a punctuation gap, flagged for discussion rather than treated as a
  clean case
- `ambiguous` — multiple plausible CAMS trustees share the name; ground truth expects the matcher to
  surface all of them for human review, not resolve to one
- `not-found-in-export` — no plausible CAMS trustee exists in this export at all

### Regenerating `ground-truth.json` with an AI agent

`ground-truth.json` does not exist in the repo (see above) and takes real analysis effort to
rebuild, not a mechanical transform. If you need an agent to (re)produce it from a fresh pair of
exports, brief it with a prompt along these lines — the actual derivation still requires human
review of each proposed pair (see the `confidence` level descriptions above), not blind automation:

> You have two real MongoDB exports: `2026-08-18-trustee-verification.json` (verbatim export of the
> `trustee-match-verification` collection) and `2026-08-18-trustees.json` (export of the `trustees`
> collection filtered to `{"documentType": "TRUSTEE"}`). Filter the verification export to records
> where `mismatchReason == "NO_TRUSTEE_MATCH"` and `matchCandidates` is empty — these are cases
> where `matchTrusteeByName`/`findTrusteesByName` (exact, case-insensitive, whitespace-only-
> normalized full-name regex) found zero matches. For each such record's `dxtrTrustee.fullName`,
> search `2026-08-18-trustees.json`'s `name` field for a plausible corresponding trustee (by last
> name / token overlap — do not assume normalization rules, just look for the person). Exclude
> non-person placeholder strings (e.g. "Not Assigned - SF", "No Trustee", "TRUSTEE NOT APPOINTED",
> "CHAPTER 11 - LV") — those are a separate investigation, not part of this ground truth. For every
> remaining record, propose zero, one, or multiple candidate trustee matches and STOP to get human
> confirmation before finalizing each one — do not silently encode a guess. Record honest
> `confidence` levels rather than dropping uncertain cases: `high` for pure punctuation/spacing/
> suffix differences, `medium` for a dropped/added middle name or initial, `low` for a nickname or
> name-abbreviation variant (not a punctuation gap — flag it, don't hide it), `ambiguous` when 2+
> CAMS trustees plausibly match, and `not-found-in-export` when no plausible match exists at all.
> Write the result as `ground-truth.json` per the structure documented in this README, including a
> `notes` field on every pair explaining specifically what differs and why the confidence level was
> chosen.

## Junk/placeholder records — out of scope for this harness

13 of the 167 no-candidate records are non-person placeholder strings (`"Not Assigned - SF"`,
`"No Trustee"`, `"TRUSTEE NOT APPOINTED"`, etc.) rather than real trustee names. These are a
separate investigation (whether `RESERVED_PROFESSIONAL_IDS`/`isReservedProfessionalIdEvent` in
`sync-trustee-case-appointments.ts` should catch them by professional-id suffix, independent of
group prefix) and are deliberately excluded from `ground-truth.json`.

## Usage (from test/integration/)

```bash
cd trustee-match-normalization/scripts
./start-services.sh
cp .env.template .env.local

cd ../..
npm run trustee-match-normalization -- seed
npm run trustee-match-normalization -- run
npm run trustee-match-normalization -- clean

cd trustee-match-normalization/scripts
./stop-services.sh
```

Runs on `localhost:27018` (not the default `27017`) so it can coexist with another
`test/integration/` harness's Mongo container if one is already running.

## Commands

| Command | Description                                                                                                                         |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `seed`  | Load `fixtures/2026-08-18-trustees.json` into MongoDB as-is (drops/recreates the `trustees` collection first)                       |
| `run`   | Replay every `fixtures/ground-truth.json` pair through the real `matchTrusteeByName()`, report outcome counts and per-record detail |
| `clean` | Drop the seeded `trustees` collection                                                                                               |
| `help`  | Show usage                                                                                                                          |

`run`'s outcome categories:

- `exact-match` — resolved to exactly the expected trustee (already works today)
- `wrong-match` — resolved, but to a trustee NOT in `expectedTrusteeIds`
- `false-ambiguous` — came back ambiguous, but ground truth expects exactly one trustee
- `correctly-ambiguous` — came back ambiguous, and ground truth also expects 2+ candidates
- `false-no-match` — came back no-match, but ground truth says a real trustee exists (the gap this
  investigation is measuring)
- `correctly-no-match` — came back no-match, and ground truth also expects zero (genuinely absent)
