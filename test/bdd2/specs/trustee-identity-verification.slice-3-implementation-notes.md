# CAMS-953 Slice 3: Explanations — Implementation Notes

In progress, started 2026-10-28. Bead: cams-c45pn.6 (Task 1: cams-c45pn.6.1).

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
