# ACMS Trustee-Professional-IDs Backfill — Threshold Validation Plan

See `TRUSTEE-ACMS-BACKFILL_CONVERGED_DESIGN.md` (`/tmp/cams-816-collab/` at design time) for the
full design. This is the follow-up procedure the design doc's "Auto-match threshold" section called
for: `ACMS_AUTO_MATCH_THRESHOLD` (90) and `ACMS_FUZZY_MATCH_MIN_GAP` (5), defined in
`acms-trustee-match.helpers.ts`, are principled defaults (matched to CAMS-809's own precedent), not
numbers measured against real ACMS score data. Nobody has run this validation yet — this document
describes how to do it, not a record that it happened.

## What the code already supports

`resolveAcmsProfessionalMatch` takes an optional `onCandidateScored` callback, invoked once per
scored candidate — not just the eventual winner — with that candidate's full
`CandidateScoreBreakdown` (`nameScore`, `addressScore`, `phoneScore`, `districtScore`,
`chapterScore`, `totalScore`), before the accept-rule decision is applied to any of them. The real
caller, `scoreAndResolveRecord` in `backfill-trustee-professional-ids.ts`, wires this to a
`context.logger.debug` call per candidate. `handleStart` (in
`function-apps/dataflows/migrations/backfill-trustee-professional-ids.ts`) already logs the elapsed
time of the full bulk read-and-dispatch pass, converting the design doc's "~6,000 records fits in
the 1-hour budget" estimate into a real measurement the first time this runs anywhere.

## How to run the validation pass in a lower environment

1. Deploy this dataflow to a lower environment (dev/test) with real ACMS SQL Server connectivity and
   a Mongo instance seeded with real (or a realistic snapshot of) CAMS trustee data.
2. Ensure the dataflows function app's log level is set to `debug` (or whatever this environment's
   equivalent is) so the per-candidate score-breakdown lines are actually emitted — they are
   deliberately logged at `debug`, not `info`, since they fire once per scored candidate rather than
   once per record.
3. Send a `{}` START message to trigger `handleStart`. Let the run complete (`handleStart` does one
   bulk read-and-dispatch pass; `handlePage` messages drain shortly after).
4. Collect the `handleStart` elapsed-time log line and the `Backfill candidate score: ...` debug
   lines from App Insights / the log stream for the whole run.
5. From the collected candidate-score lines, sample across the score distribution:
   - **Near-threshold**: totalScore within ~±5 of 90 (the threshold) and cases where the gap between
     the winning and runner-up candidate is within ~±3 of 5 (the gap constant) — this is the
     boundary that most needs checking.
   - **Well above**: totalScore comfortably above 90 (e.g. >95) — confirm these are in fact correct
     matches, not false positives the threshold is letting through.
   - **Well below**: totalScore comfortably below 90 (e.g. <70) — spot-check that at least some of
     these really are non-matches, not correct matches the threshold is wrongly rejecting.
6. For each sampled record, manually cross-reference the ACMS professional record and the CAMS
   trustee candidate (name, address, phone, district/chapter history) to judge whether the
   auto-match/no-match outcome was actually correct — the same manual-sample process CAMS-809's own
   threshold derivation used.
7. If the sample shows the boundary is systematically off in either direction (e.g. near-threshold
   matches are mostly wrong, or well-below-threshold candidates are frequently correct matches),
   adjust `ACMS_AUTO_MATCH_THRESHOLD` and/or `ACMS_FUZZY_MATCH_MIN_GAP` in
   `acms-trustee-match.helpers.ts` accordingly, and re-run the sample check against the new values
   before signing off.
8. Only once the sample confirms the threshold/gap boundary is producing correct outcomes should
   this dataflow be run against production ACMS data.

This is a one-time tuning pass ahead of the one-time production run, not a recurring validation step
— once the production run has happened, this document (and the diagnostic logging it depends on) has
no further purpose for this effort.
