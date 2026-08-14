/**
 * Scoring helpers for the ACMS trustee-professional-ids backfill (a one-time migration). Kept as a
 * separate file from trustee-match.helpers.ts (the live DXTR-sync scoring path) deliberately --
 * this file's functions have a different lifecycle and caller, and should not grow the live-sync
 * path's edit surface.
 */

import {
  calculateNamePartsScore,
  calculatePhoneScore,
  calculateTotalScore,
  normalizeChapter,
} from './trustee-match.helpers';
import { Address, PhoneNumber } from '@common/cams/contact';
import { Trustee } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { AcmsTrusteeProfessionalRecord } from '../gateways.types';

/**
 * Calculates a name match score between an ACMS professional record and a CAMS trustee.
 * Delegates to `calculateNamePartsScore` (`trustee-match.helpers.ts`) -- the actual comparison
 * logic shared with the live DXTR-sync path's `calculateNameScore`, taking plain
 * `{firstName, lastName, middleName}` strings directly rather than requiring a fabricated
 * `DxtrTrusteeParty` (a DXTR-specific type from an unrelated subsystem) just to satisfy a
 * parameter type.
 *
 * ACMS's `PROF_MI` column is `CHAR(1)` -- it can only ever hold a bare single-character initial,
 * never a full middle name. This means the "both sides have a full identical middle name"
 * 100-point branch can structurally never fire when called from the ACMS side: any non-neutral
 * comparison lands on either the initial-vs-full (85) or conflict (15) branch, never the
 * full-match branch, even when the CAMS side happens to have a full middle name that matches the
 * initial.
 */
export function calculateAcmsNameScore(
  acmsProfessional: { firstName: string; lastName: string; middleInitial: string | null },
  camsTrustee: Trustee,
): number {
  return calculateNamePartsScore(
    {
      firstName: acmsProfessional.firstName,
      lastName: acmsProfessional.lastName,
      middleName: acmsProfessional.middleInitial ?? undefined,
    },
    camsTrustee,
  );
}

/**
 * Calculates an address match score between an ACMS professional's already-structured address
 * fields and a CAMS trustee's address. Unlike `trustee-match.helpers.ts`'s `calculateAddressScore`
 * (which parses a single DXTR free-text `cityStateZipCountry` field), ACMS provides `city`,
 * `state`, and `zip` as separate, already-structured fields -- there is no string to parse.
 *
 * Uses the same 4-tier point scale as `calculateAddressScore` for consistency:
 * - City + State + Zip match: 100 points (perfect match)
 * - Zip match (state implied): 60 points (high confidence - zip is specific)
 * - City match (state implied): 40 points (medium confidence)
 * - State match only: 30 points (low confidence)
 * - No match: 0 points
 *
 * Zip is compared on the first 5 digits only (ACMS's `PROF_ZIP` is normalized to a string
 * upstream, at the gateway boundary). City/state comparison is case-insensitive and trimmed.
 */
export function calculateAcmsAddressScore(
  acmsAddress: { city: string | null; state: string | null; zip: string | null },
  camsAddress: Address,
): number {
  const normalizeField = (field?: string | null) => field?.trim().toLowerCase() || '';
  const normalizeZip5 = (zip?: string | null) => normalizeField(zip).slice(0, 5);

  const acmsCity = normalizeField(acmsAddress.city);
  const acmsState = normalizeField(acmsAddress.state);
  const acmsZip = normalizeZip5(acmsAddress.zip);

  const camsCity = normalizeField(camsAddress.city);
  const camsState = normalizeField(camsAddress.state);
  const camsZip = normalizeZip5(camsAddress.zipCode);

  const stateMatch = acmsState && camsState && acmsState === camsState;
  const cityMatch = acmsCity && camsCity && acmsCity === camsCity;
  const zipMatch = acmsZip && camsZip && acmsZip === camsZip;

  // Perfect match: city, state, and zip all match
  if (cityMatch && stateMatch && zipMatch) return 100;

  // High confidence: zip match (zip is more specific than city)
  if (zipMatch) return 60;

  // Medium confidence: city match (zip differs or missing)
  if (cityMatch) return 40;

  // State only (both city and zip missing): low confidence
  if (stateMatch) return 30;

  // No match
  return 0;
}

/**
 * Calculates a phone match score between an ACMS professional's phone and a CAMS trustee's phone.
 * A thin wrapper delegating to the existing `calculatePhoneScore` (last-10-digit comparison,
 * null when either side has fewer than 10 digits) -- not reimplemented here. The ACMS phone is
 * already normalized to a string at the gateway boundary (numeric `PROF_COMMERCIAL_PHONE_NBR`
 * converted upstream).
 */
export function calculateAcmsPhoneScore(
  acmsPhone: string | null,
  camsPhone: PhoneNumber | undefined,
): number | null {
  return calculatePhoneScore(acmsPhone ?? undefined, camsPhone);
}

/**
 * Calculates the weighted total score for an ACMS-to-CAMS trustee candidate comparison.
 *
 * NOT a sibling function with its own weight table -- this literally calls the existing
 * `calculateTotalScore` (trustee-match.helpers.ts), always passing `emailScore: null`. ACMS has
 * no email field, and the CAMS side of this comparison deliberately does not consider email
 * either, so email is null on both sides for every record -- exactly the case
 * `calculateTotalScore`'s existing null-exclusion-and-renormalization mechanism already handles
 * correctly today. This produces the converged effective weights (name 26.32%, address 5.26%,
 * phone 5.26%, district 31.58%, chapter 31.58% -- CAMS-809's original weights with email's 5%
 * excluded and the remainder proportionally renormalized) without introducing a new weight
 * constant or reimplementing the weighted-sum/renormalization math.
 */
export function calculateAcmsTotalScore(scores: {
  addressScore: number;
  nameScore: number;
  phoneScore: number | null;
  districtScore: number | null;
  chapterScore: number | null;
}): number {
  return calculateTotalScore({
    addressScore: scores.addressScore,
    nameScore: scores.nameScore,
    phoneScore: scores.phoneScore,
    emailScore: null,
    districtDivisionScore: scores.districtScore,
    chapterScore: scores.chapterScore,
  });
}

/**
 * Calculates a set-overlap score between two sets of comparable identifiers (e.g. courtId sets
 * for district, normalized chapter strings for chapter), using the overlap coefficient rather
 * than Jaccard or discrete tiering.
 *
 * Formula: `100 * |A ∩ B| / min(|A|, |B|)`.
 *
 * This is the converged resolution to a genuine design disagreement (see the converged design
 * doc's "District/chapter: the set-vs-set adaptation" section, decision 2): Jaccard
 * (`|A ∩ B| / |A ∪ B|`) badly under-scores a sparse-but-correct set fully contained in a much
 * larger one (e.g. 1-of-9 scores ~11 under Jaccard, purely as an artifact of the larger side's
 * size), while discrete 100/50/0 tiering can't distinguish an 8-of-9 containment from a 1-of-9
 * containment. The overlap coefficient scores both full-containment cases at the maximum (100),
 * correctly reading full agreement on the smaller/sparser side as strong evidence regardless of
 * how large the other side's set happens to be.
 *
 * Null handling: `min(|A|, |B|)` is 0 whenever *either* set is empty, not only when both are
 * empty. An empty set means "no data on this side," not "confirmed non-overlap" -- so returning
 * `null` (not comparable) rather than computing (and dividing by zero, or otherwise coercing to
 * 0) applies equally whether both sides are empty or just one side is. A 0 score would
 * misrepresent "we have no data to compare" as "confirmed mismatch," which is exactly the
 * failure mode the design's null-handling principle exists to avoid elsewhere (e.g.
 * calculatePhoneScore, calculateEmailScore in trustee-match.helpers.ts).
 */
export function calculateSetOverlapScore(a: Set<string>, b: Set<string>): number | null {
  const minSize = Math.min(a.size, b.size);

  if (minSize === 0) return null;

  let intersectionSize = 0;
  for (const value of a) {
    if (b.has(value)) intersectionSize++;
  }

  return (100 * intersectionSize) / minSize;
}

/**
 * Minimum totalScore for the highest-scoring candidate to auto-match, applied unconditionally
 * regardless of how many candidates were scored -- there is no separate, lower threshold for the
 * multi-candidate case. Matches CAMS-809's own `SINGLE_CANDIDATE_AUTO_MATCH_THRESHOLD` precedent
 * (trustee-match.helpers.ts) so a future reader isn't left wondering why this migration picked an
 * unexplained different bar.
 *
 * This closes a defect in a naive design with an independent single-candidate threshold and a
 * *separate*, lower multi-candidate threshold-plus-gap: that shape lets a multi-candidate winner
 * auto-accept at a score a lone candidate with the identical score would be rejected for -- purely
 * because a weaker, irrelevant second candidate happened to also show up. `resolveAcmsProfessionalMatch`
 * below applies this one bar to the winner unconditionally, by construction, so that inversion
 * cannot occur for any value of this constant or `ACMS_FUZZY_MATCH_MIN_GAP`.
 */
export const ACMS_AUTO_MATCH_THRESHOLD = 90;

/**
 * Minimum point gap the winner must have over the runner-up, but ONLY when more than one
 * candidate was scored. For exactly one candidate, this check is skipped entirely -- not run, not
 * vacuously satisfied by a special case -- because there is no runner-up to compare against. This
 * gap does exactly one job (separating the winner from a specific competitor) and must never
 * function as a disguised second, lower confidence floor.
 */
export const ACMS_FUZZY_MATCH_MIN_GAP = 5;

export type AcmsMatchOutcome =
  { kind: 'matched'; trusteeId: string; score: number } | { kind: 'unmatched' };

type ScoredCandidate = {
  trusteeId: string;
  score: number;
};

/**
 * Full per-dimension score breakdown for one scored candidate, surfaced to callers via the
 * `onCandidateScored` hook below. A future lower-environment validation run can use every
 * candidate's full breakdown (not just the winner's total), sampled across the score distribution
 * (near-threshold, well above, well below), to confirm ACMS_AUTO_MATCH_THRESHOLD/
 * ACMS_FUZZY_MATCH_MIN_GAP line up with actual correct/incorrect matches before the production run.
 */
export type CandidateScoreBreakdown = {
  acmsProfessionalId: string;
  trusteeId: string;
  nameScore: number;
  addressScore: number;
  phoneScore: number | null;
  districtScore: number | null;
  chapterScore: number | null;
  totalScore: number;
};

/**
 * Resolves an ACMS professional record to (at most) one CAMS trustee, given an already-assembled
 * candidate shortlist and each candidate's already-fetched appointment history.
 *
 * This function is deliberately I/O-free (no repository/gateway calls) -- callers are responsible
 * for assembling `candidateTrustees` (the phonetic-search shortlist, see `getCandidateTrustees`)
 * and for fetching
 * each candidate's `TrusteeAppointment[]` (e.g. via `TrusteeAppointmentsRepository`'s batched
 * `getAppointmentsByTrusteeIds`) ahead of calling this function. This keeps the accept-rule logic
 * -- the highest-risk mechanism in this whole effort -- pure and easy to unit test without mocking
 * Mongo.
 *
 * `onCandidateScored` is an OPTIONAL diagnostic hook, not a dependency: it is invoked once per
 * scored candidate, in scoring order, with that candidate's full `CandidateScoreBreakdown` --
 * before the accept-rule decision (steps 3/4 below) is applied to any of them. Passing it does
 * not change this function's return value or behavior in any way; it exists purely so a caller
 * that owns a logger (e.g. `scoreAndResolveRecord` in backfill-trustee-professional-ids.ts) can
 * log every candidate's breakdown, not just the winner's. Omitting it (the default) keeps this
 * function exactly as pure and mock-free to unit test as before.
 *
 * CRITICAL -- NO ACTIVE-ONLY FILTERING: `candidateAppointmentsByTrusteeId` must carry each
 * candidate's FULL appointment history, any status, not just `status === 'active'` appointments.
 * This function builds the CAMS-side district/chapter sets directly from whatever appointments it
 * is given, with no status filtering of its own, and callers must not add any upstream either.
 * Filtering to active-only would empty exactly the population this backfill exists to correctly
 * resolve (genuinely legacy ACMS professionals, who are likely to have only disposed/inactive
 * appointments by now), collapsing ~60% of the scoring weight onto name+address+phone alone for
 * precisely the records where district/chapter corroboration matters most.
 *
 * Accept-rule shape (the fix -- see ACMS_AUTO_MATCH_THRESHOLD/ACMS_FUZZY_MATCH_MIN_GAP docs above
 * for the defect this closes):
 * 1. Zero candidates -> unmatched immediately. No scoring is attempted at all.
 * 2. One or more candidates -> score every candidate.
 * 3. The winner (highest score) must clear ACMS_AUTO_MATCH_THRESHOLD, unconditionally -- the same
 *    bar whether there was 1 candidate or 100.
 * 4. ONLY if there is more than one candidate, the winner must additionally clear
 *    ACMS_FUZZY_MATCH_MIN_GAP over the runner-up. This step is skipped entirely (not evaluated,
 *    not vacuously true) when there is exactly one candidate.
 * 5. Failing step 3, or failing step 4 when it applies, -> unmatched.
 */
export function resolveAcmsProfessionalMatch(
  acmsProfessional: AcmsTrusteeProfessionalRecord,
  acmsAppointmentSets: { districts: Set<string>; chapters: Set<string> },
  candidateTrustees: Trustee[],
  candidateAppointmentsByTrusteeId: Map<string, TrusteeAppointment[]>,
  onCandidateScored?: (breakdown: CandidateScoreBreakdown) => void,
): AcmsMatchOutcome {
  if (candidateTrustees.length === 0) {
    return { kind: 'unmatched' };
  }

  const scoredCandidates: ScoredCandidate[] = candidateTrustees.map((candidate) => {
    const appointments = candidateAppointmentsByTrusteeId.get(candidate.trusteeId) ?? [];

    // CAMS-side district/chapter sets, built from the FULL appointment history handed to this
    // function -- no active-only filtering here (see the function doc above).
    const candidateDistricts = new Set(appointments.map((a) => a.courtId));
    const candidateChapters = new Set(
      appointments.map((a) => normalizeChapterForOverlap(a.chapter)),
    );

    const nameScore = calculateAcmsNameScore(acmsProfessional, candidate);
    const addressScore = calculateAcmsAddressScore(
      {
        city: acmsProfessional.city,
        state: acmsProfessional.state,
        zip: acmsProfessional.zip,
      },
      candidate.public.address,
    );
    const phoneScore = calculateAcmsPhoneScore(acmsProfessional.phone, candidate.public.phone);
    const districtScore = calculateSetOverlapScore(
      acmsAppointmentSets.districts,
      candidateDistricts,
    );
    const chapterScore = calculateSetOverlapScore(acmsAppointmentSets.chapters, candidateChapters);

    const score = calculateAcmsTotalScore({
      addressScore,
      nameScore,
      phoneScore,
      districtScore,
      chapterScore,
    });

    onCandidateScored?.({
      acmsProfessionalId: acmsProfessional.acmsProfessionalId,
      trusteeId: candidate.trusteeId,
      nameScore,
      addressScore,
      phoneScore,
      districtScore,
      chapterScore,
      totalScore: score,
    });

    return { trusteeId: candidate.trusteeId, score };
  });

  scoredCandidates.sort((a, b) => b.score - a.score);

  const winner = scoredCandidates[0];
  const runnerUp = scoredCandidates[1];

  if (winner.score < ACMS_AUTO_MATCH_THRESHOLD) {
    return { kind: 'unmatched' };
  }

  if (scoredCandidates.length > 1) {
    const gap = winner.score - runnerUp.score;
    if (gap < ACMS_FUZZY_MATCH_MIN_GAP) {
      return { kind: 'unmatched' };
    }
  }

  return { kind: 'matched', trusteeId: winner.trusteeId, score: winner.score };
}

/**
 * Local re-export of `normalizeChapter` (trustee-match.helpers.ts) under a name that makes clear,
 * at the call site above, that this normalization feeds a set-overlap comparison rather than a
 * scalar chapter match.
 */
function normalizeChapterForOverlap(chapter: string): string {
  return normalizeChapter(chapter);
}
