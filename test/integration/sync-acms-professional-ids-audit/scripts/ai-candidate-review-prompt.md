You are reviewing trustee identity-matching candidates for a bankruptcy case-management system.

You will be given one trustee record from a legacy system (ACMS) and a list of candidate trustee
records from the current system (CAMS) that an automated matcher considered as possible matches
for that ACMS record. Your job is to decide, for EACH candidate independently, whether the
candidate is the SAME real person as the ACMS record ("match") or is a different person, or not a
confident enough match to call the same person ("no-match").

Each candidate also carries some structured signals the automated matcher already computed:
nameScore, fullNameSimilarity, tokenNameMatchRate, surnameExactMatch, addressScore, phoneScore,
introductionStage (which matching stage surfaced this candidate), and candidateOutcome (what the
matcher ultimately decided about this candidate). Treat these as HINTS, not ground truth. Reason
about the actual name, address, and phone similarity yourself rather than simply repeating back
whatever the structured score already says. The entire point of this review is to catch cases the
structured scoring gets wrong in both directions:

- False negatives: candidates that are genuinely the same person but that the structured scoring
  rejected or scored low (for example due to a nickname, a reordered or split name, a punctuation
  difference, or a stale address/phone on one side).
- Noise: candidates that structured scoring let through (or scored deceptively high) but that are
  clearly a different real person once you look closely — for example two different people who
  happen to share a common surname.

Some important expectations:

- It is completely normal and expected for ZERO candidates in a group to be a "match." The ACMS
  record may simply have no true match among the CAMS candidates at all. Do not force a match just
  because one candidate scores higher than the others.
- It is rare, but acceptable, for MORE THAN ONE candidate to be a "match" if the CAMS data
  genuinely contains duplicate records for the same real person. Do not force artificial
  uniqueness — if two candidates both look like the same real person as the ACMS record, mark both
  "match."
- Addresses and phone numbers can be stale, missing, or use different formatting on either side.
  Weigh them as supporting or contradicting evidence, not as an automatic disqualifier or an
  automatic confirmation on their own.
- A shared surname alone is not enough for a match. A shared surname AND first name, or a shared
  surname with strong corroborating address/phone evidence, is much stronger.

For every candidate, give a CONCISE one-sentence reason for your verdict. This is read by a human
scanning across thousands of rows quickly, so keep it short and specific — not a paragraph.
Examples of the right length and specificity:

- "Same full name, address matches exactly."
- "Different first name, shared surname appears to be coincidence."
- "Corrupted ACMS firstName field, cannot compare reliably."
- "Nickname of the CAMS first name, address and phone both match."
- "Same surname and city but different first name and no phone/address corroboration."

Return your answer as structured JSON with one verdict entry per candidate listed below, in any
order, each entry containing the candidate's camsTrusteeId, your verdict ("match" or "no-match"),
and your concise reason.

---

## ACMS record to match

{{ACMS_RECORD}}

## Candidate CAMS records

{{CANDIDATES}}
