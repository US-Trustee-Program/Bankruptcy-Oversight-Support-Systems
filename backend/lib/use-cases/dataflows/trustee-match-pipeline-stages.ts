import * as natural from 'natural';
import { getNameVariations } from 'name-match/src/name-normalizer';
import { ApplicationContext } from '../../adapters/types/basic';
import { Trustee } from '@common/cams/trustees';
import {
  calculateAddressScore,
  calculateNameScore,
  calculatePhoneScore,
  CONTACT_CORROBORATION_ADDRESS_THRESHOLD,
  CONTACT_CORROBORATION_NAME_THRESHOLD,
  findAnchoredLevenshteinCandidates,
  findSurnameExactCandidates,
  findTokenIntersectionCandidates,
  parseCityStateZip,
  resolveByContactCorroboration,
  resolveDuplicateNameCandidates,
  STATE_OVERRIDE_MIN_NAME_SCORE,
} from './trustee-match.helpers';
import {
  addCandidate,
  addScore,
  mergedScore,
  normalize,
  NormalizedMemo,
  PipelineCandidate,
  PipelineState,
  projectTrustee,
  ScoreByScorer,
  ScoreRecord,
  Stage,
  withGuard,
} from './trustee-match-pipeline';

/**
 * Discovery stage wrapping the existing findSurnameExactCandidates unchanged - proposes every
 * surname-exact candidate to the pipeline (see addCandidate: idempotent, never resets a candidate
 * another stage already discovered). Discovery stages never score; a separate scoring stage reads
 * whatever is in state.candidates regardless of which discovery stage put it there.
 */
export function surnameExactDiscoveryStage(context: ApplicationContext): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const found = await findSurnameExactCandidates(context, state.acmsRaw);
    for (const trustee of found) {
      addCandidate(state, projectTrustee(trustee));
    }
    return state;
  });
}

/** Discovery stage wrapping findTokenIntersectionCandidates unchanged - see
 * surnameExactDiscoveryStage for the shared discovery-stage shape/rationale. */
export function tokenIntersectionDiscoveryStage(context: ApplicationContext): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const found = await findTokenIntersectionCandidates(context, state.acmsRaw);
    for (const trustee of found) {
      addCandidate(state, projectTrustee(trustee));
    }
    return state;
  });
}

/** Discovery stage wrapping findAnchoredLevenshteinCandidates unchanged - see
 * surnameExactDiscoveryStage for the shared discovery-stage shape/rationale. */
export function anchoredLevenshteinDiscoveryStage(context: ApplicationContext): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const found = await findAnchoredLevenshteinCandidates(context, state.acmsRaw);
    for (const trustee of found) {
      addCandidate(state, projectTrustee(trustee));
    }
    return state;
  });
}

/**
 * Scoring stage wrapping the existing calculateNameScore unchanged. Runs against every candidate
 * currently in state.candidates, regardless of which discovery stage proposed it - scoring and
 * discovery are independent concerns (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md). calculateNameScore only reads
 * firstName/middleName/lastName, all present on the projected camsRaw shape, so the cast here is
 * safe despite calculateNameScore's parameter type predating this pipeline.
 */
export function nameScoreStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    for (const candidate of state.candidates.values()) {
      const nameScore = calculateNameScore(state.acmsRaw, candidate.camsRaw as unknown as Trustee);
      addScore(candidate, 'calculateNameScore', {
        value: nameScore,
        threshold: CONTACT_CORROBORATION_NAME_THRESHOLD,
        pass: nameScore >= CONTACT_CORROBORATION_NAME_THRESHOLD,
      });
    }
    return state;
  });
}

function normalizeForSimilarity(name: string): string {
  return name.toLowerCase().replaceAll("'", '').replace(/[.,-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Memoizes normalizeForSimilarity's result once per memo (the ACMS side is invariant across every
 * candidate in a record; a candidate's own name is invariant across fullNameSimilarity and
 * tokenNameMatchRate both needing it) rather than recomputing the same string transform
 * repeatedly. Fingerprints on the raw name itself (see normalize) - a memo storing only
 * function-name-keyed calls with no fingerprint would conflate two different inputs to the same
 * function into one cached result. The raw name is used as-is, no quoting/escaping - a
 * fingerprint only needs to be unique per input, not a faithfully round-trippable serialization.
 */
function memoizedNormalizeForSimilarity(memo: NormalizedMemo, name: string): string {
  return normalize(memo, 'normalizeForSimilarity', name, () => normalizeForSimilarity(name));
}

/** Jaro-Winkler character-level similarity between the ACMS full name and a candidate's composed
 * name, rounded to 3 decimals - a diagnostic signal for reviewers, never used for control flow
 * (calculateNameScore's discrete field-by-field comparison remains the only scoring input). */
function fullNameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round(natural.JaroWinklerDistance(a, b) * 1000) / 1000;
}

function isInitialOf(a: string, b: string): boolean {
  return a.length === 1 && b.length > 0 && b.startsWith(a);
}

/** Whether a and b are a known nickname/formal-name pair, via name-match's getNameVariations
 * (e.g. "Bill"/"William"). Each direction is tried independently and defensively, since
 * getNameVariations throws for a name it has no variation data for at all. */
function isNicknamePair(a: string, b: string): boolean {
  try {
    if ((getNameVariations(a) as string[]).includes(b)) return true;
  } catch {
    // No variations available for a.
  }
  try {
    if ((getNameVariations(b) as string[]).includes(a)) return true;
  } catch {
    // No variations available for b.
  }
  return false;
}

/** Fraction of ACMS name tokens that find a corresponding CAMS token via exact match, initial
 * match in either direction, or a known nickname pair - a diagnostic signal for catching
 * name-part reordering or nicknames that calculateNameScore's discrete comparison misses, never
 * used for control flow. */
function tokenNameMatchRate(normalizedAcms: string, normalizedCams: string): number {
  const acmsTokens = normalizedAcms.split(' ').filter(Boolean);
  const camsTokens = normalizedCams.split(' ').filter(Boolean);
  if (acmsTokens.length === 0) return 0;
  let matched = 0;
  for (const at of acmsTokens) {
    const hit = camsTokens.some(
      (ct) => at === ct || isInitialOf(at, ct) || isInitialOf(ct, at) || isNicknamePair(at, ct),
    );
    if (hit) matched++;
  }
  return Math.round((matched / acmsTokens.length) * 1000) / 1000;
}

/**
 * Memoizes two name-similarity DIAGNOSTIC signals onto every candidate currently in the pipeline -
 * fullNameSimilarity (character-level) and tokenNameMatchRate (token-level, nickname/reorder
 * aware) - under candidate.camsNormalized, never as a ScoreEntry: neither signal gates match/skip
 * or feeds corroborationStage's resolution logic, they exist purely so a persisted, unresolved
 * record's serialized state already carries the same nickname/reorder-detection hints a reviewer
 * would otherwise have to re-derive by hand (or via separate backtest tooling) when investigating
 * why an ACMS record didn't auto-link.
 *
 * The ACMS-side normalized name is memoized once on state.acmsNormalized and reused across every
 * candidate in the loop (see memoizedNormalizeForSimilarity) rather than recomputed per candidate -
 * it depends only on state.acmsRaw, which is invariant for the whole record.
 */
export function similarityDiagnosticsStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const normalizedAcms = memoizedNormalizeForSimilarity(
      state.acmsNormalized,
      state.acmsRaw.fullName,
    );
    for (const candidate of state.candidates.values()) {
      const normalizedCams = memoizedNormalizeForSimilarity(
        candidate.camsNormalized,
        candidate.camsRaw.name,
      );
      const fingerprint = `${normalizedAcms}|${normalizedCams}`;
      normalize(candidate.camsNormalized, 'fullNameSimilarity', fingerprint, () =>
        fullNameSimilarity(normalizedAcms, normalizedCams),
      );
      normalize(candidate.camsNormalized, 'tokenNameMatchRate', fingerprint, () =>
        tokenNameMatchRate(normalizedAcms, normalizedCams),
      );
    }
    return state;
  });
}

/**
 * Reimplements filterNoisyStateMismatches' logic (see that function's doc comment in
 * trustee-match.helpers.ts for the full rationale) as an ANNOTATION rather than an array filter -
 * the pipeline's candidate list is append-only, so state agreement is recorded as a score entry
 * (stateMatch: boolean) for a later resolution stage to read, never used to remove a candidate
 * outright. Reimplemented rather than called through a type cast because
 * filterNoisyStateMismatches reads candidate.public.address/phone (Trustee's real nested shape),
 * which ProjectedTrustee deliberately flattens - a cast would compile but read undefined at
 * runtime. calculateNameScore/calculatePhoneScore/parseCityStateZip/the override threshold are
 * reused unchanged; only the nested-vs-flat field access differs.
 *
 * Deliberately diverges from filterNoisyStateMismatches' own STATE_FILTER_POOL_SIZE_THRESHOLD
 * skip: that skip exists to avoid a wasted computation on a pool already small enough that state
 * was never going to be a useful discriminator, which only made sense when the filter's result
 * was consumed as an eliminate-or-keep decision. As an ANNOTATION every candidate keeps regardless
 * (see corroborationStage's stateMatch !== false read), so there is no such thing as a
 * "wasted" computation here - every candidate gets a real, checked stateMatch value every time,
 * independent of pool size.
 *
 * A candidate this stage never evaluates (which cannot happen today, since every candidate in
 * state.candidates is visited) is left with no stateMatch key at all, rather than a fabricated
 * true - mergedScore(candidate).stateMatch reads as undefined, not a false claim that the check
 * ran and passed.
 */
/** stateFilterStage's stateMatch is a pure pass/fail with no natural numeric magnitude - value
 * mirrors pass (100/0) purely so it conforms to ScoreRecord's shared vocabulary. */
function stateMatchRecord(stateMatch: boolean): ScoreRecord {
  return { value: stateMatch ? 100 : 0, threshold: 100, pass: stateMatch };
}

export function stateFilterStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const candidates = [...state.candidates.values()];

    const parsedAcmsAddress = parseCityStateZip(state.acmsRaw.legacy?.cityStateZipCountry);
    if (!parsedAcmsAddress) {
      for (const candidate of candidates) {
        addScore(candidate, 'stateFilterStage', stateMatchRecord(true));
      }
      return state;
    }

    const acmsState = parsedAcmsAddress.state.toLowerCase();
    for (const candidate of candidates) {
      const camsState = candidate.camsRaw.address?.state?.toLowerCase();
      if (!camsState || camsState === acmsState) {
        addScore(candidate, 'stateFilterStage', stateMatchRecord(true));
        continue;
      }

      const phoneScore = calculatePhoneScore(state.acmsRaw.legacy?.phone, candidate.camsRaw.phone);
      if (phoneScore === 100) {
        addScore(candidate, 'stateFilterStage', stateMatchRecord(true));
        continue;
      }

      const nameScore = calculateNameScore(state.acmsRaw, candidate.camsRaw as unknown as Trustee);
      const stateMatch = nameScore >= STATE_OVERRIDE_MIN_NAME_SCORE;
      addScore(candidate, 'stateFilterStage', stateMatchRecord(stateMatch));
    }
    return state;
  });
}

/**
 * Independent city-agreement scorer, for the sole-candidate consensus vote (see
 * soleCandidateConsensusStage) - a new, cheap corroborating signal distinct from
 * calculateAddressScore's bigram-similarity comparison of the FULL address line.
 * Case-insensitive exact match on the parsed city name alone (not a fuzzy/bigram compare,
 * unlike calculateAddressScore - city names are short enough that a typo either round-trips
 * through parseCityStateZip's tokenization exactly or doesn't, and a partial-credit scheme adds
 * complexity with no evidence yet that it's needed). No record is added when either side's city
 * is unavailable (unparseable ACMS address, or a candidate with no address on file) - absence is
 * not evidence either way, so it should not count as a vote (see soleCandidateConsensusStage's
 * "scorers that actually ran" framing).
 */
export function cityMatchStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const parsedAcmsAddress = parseCityStateZip(state.acmsRaw.legacy?.cityStateZipCountry);
    const acmsCity = parsedAcmsAddress?.city.toLowerCase();
    if (!acmsCity) return state;

    for (const candidate of state.candidates.values()) {
      const camsCity = candidate.camsRaw.address?.city?.toLowerCase();
      if (!camsCity) continue;

      const pass = camsCity === acmsCity;
      addScore(candidate, 'cityMatchStage', { value: pass ? 100 : 0, threshold: 100, pass });
    }
    return state;
  });
}

/**
 * Independent zip-agreement scorer, for the sole-candidate consensus vote (see
 * soleCandidateConsensusStage) - compares only the 5-digit zip prefix (never the +4 extension,
 * which is far more granular than a professional's on-file mailing address is likely to stay
 * current with) between the ACMS record's parsed zip and a candidate's zipCode. No record is
 * added when either side has fewer than 5 digits to compare (unparseable ACMS address, or a
 * candidate with no/blank zipCode) - same "absence is not evidence" rule as cityMatchStage.
 */
export function zipMatchStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const parsedAcmsAddress = parseCityStateZip(state.acmsRaw.legacy?.cityStateZipCountry);
    const acmsZip5 = parsedAcmsAddress?.zipCode.slice(0, 5);
    if (!acmsZip5 || acmsZip5.length < 5) return state;

    for (const candidate of state.candidates.values()) {
      const camsZip5 = candidate.camsRaw.address?.zipCode?.slice(0, 5);
      if (!camsZip5 || camsZip5.length < 5) continue;

      const pass = camsZip5 === acmsZip5;
      addScore(candidate, 'zipMatchStage', { value: pass ? 100 : 0, threshold: 100, pass });
    }
    return state;
  });
}

/**
 * Resolution stage wrapping the existing resolveByContactCorroboration and
 * resolveDuplicateNameCandidates unchanged, in the same order sync-acms-professional-ids.ts's
 * resolveCandidatesByCorroboration already composes them: contact corroboration first, duplicate-
 * name resolution only if that leaves the group unresolved. Both re-fetch and re-score candidates
 * by id internally, so this stage passes trusteeIds, not PipelineCandidate objects - the pipeline's
 * own accumulated scores are not reused here, since these functions need their own controlled
 * fetch (email/appointments alongside name/address/phone) that camsRaw does not carry.
 *
 * Only considers candidates whose merged score does NOT have stateMatch: false (see
 * stateFilterStage) - a candidate a state-filter annotated as noise is excluded from the id list
 * passed to corroboration, without ever being removed from state.candidates itself.
 */
export function corroborationStage(context: ApplicationContext): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const candidateTrusteeIds = [...state.candidates.entries()]
      .filter(([, candidate]) => mergedScore(candidate).stateFilterStage?.pass !== false)
      .map(([trusteeId]) => trusteeId);

    if (candidateTrusteeIds.length === 0) return state;

    const corroboration = await resolveByContactCorroboration(
      context,
      state.acmsRaw,
      candidateTrusteeIds,
    );
    if (corroboration.kind === 'resolved') {
      const score = corroboration.candidateScores.find(
        (c) => c.trusteeId === corroboration.trusteeId,
      );
      return { ...state, match: { trusteeId: corroboration.trusteeId, score: score ?? {} } };
    }

    const duplicateResolution = await resolveDuplicateNameCandidates(
      context,
      state.acmsRaw,
      candidateTrusteeIds,
    );
    if (duplicateResolution.kind === 'resolved-duplicate') {
      const score = duplicateResolution.candidateScores.find(
        (c) => c.trusteeId === duplicateResolution.trusteeId,
      );
      return {
        ...state,
        match: { trusteeId: duplicateResolution.trusteeId, score: score ?? {} },
      };
    }

    return state;
  });
}

/**
 * Rescues the specific case resolveByContactCorroboration deliberately refuses to arbitrate:
 * MULTIPLE candidates independently clear calculateNameScore's auto-link threshold (see
 * CONTACT_CORROBORATION_NAME_THRESHOLD), so that function bails out with 'unresolved' rather than
 * guess between them - even when one candidate has decisive contact evidence (an exact phone
 * match, or a strong address match) and the others have none at all. Confirmed via a CAMS-876
 * backtest finding (an ACMS record with two same-surname candidates in different states, both
 * scoring nameScore=85, only one with an exact phone match) that this is a real, recoverable gap,
 * not a genuine ambiguity - resolveByContactCorroboration's single-candidate-only rule exists to
 * avoid guessing when there's NO differentiating evidence, not to discard differentiating evidence
 * that does exist.
 *
 * Resolves only when EXACTLY ONE name-qualifying candidate clears
 * CONTACT_CORROBORATION_ADDRESS_THRESHOLD or has an exact phone match (phoneScore 100) and no
 * OTHER qualifying candidate does - the same "strong evidence" bar
 * resolveByContactCorroboration itself uses for the single-candidate case, just applied
 * comparatively across the qualifying set instead of requiring the set to already be size 1.
 * Every qualifying candidate's address/phone corroboration is recorded via addScore regardless of
 * whether this stage ultimately resolves anything (as independent contactCorroborationAddress/
 * contactCorroborationPhone entries - nameScore itself is already recorded separately by
 * nameScoreStage, so it is not duplicated here) - so the evidence this stage considered remains
 * visible in a persisted, unresolved record's serialized state even when it correctly declines to
 * guess.
 */
export function comparativeCorroborationStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) => mergedScore(candidate).calculateNameScore?.pass === true,
    );
    if (qualifying.length < 2) return state;

    const strong: { candidate: PipelineCandidate; score: ScoreByScorer }[] = [];
    for (const candidate of qualifying) {
      const addressScore = calculateAddressScore(state.acmsRaw.legacy, candidate.camsRaw.address);
      const phoneScore = calculatePhoneScore(state.acmsRaw.legacy?.phone, candidate.camsRaw.phone);
      addScore(candidate, 'contactCorroborationAddress', {
        value: addressScore,
        threshold: CONTACT_CORROBORATION_ADDRESS_THRESHOLD,
        pass: addressScore >= CONTACT_CORROBORATION_ADDRESS_THRESHOLD,
      });
      if (phoneScore !== null) {
        addScore(candidate, 'contactCorroborationPhone', {
          value: phoneScore,
          threshold: 100,
          pass: phoneScore === 100,
        });
      }

      if (addressScore >= CONTACT_CORROBORATION_ADDRESS_THRESHOLD || phoneScore === 100) {
        strong.push({ candidate, score: candidate.scores });
      }
    }

    if (strong.length !== 1) return state;

    const winner = strong[0];
    return {
      ...state,
      match: { trusteeId: winner.candidate.camsRaw.trusteeId, score: winner.score },
    };
  });
}

/** Maximum digit-hamming-distance (see phoneDigitDistance) between an ACMS and CAMS phone number
 * for phoneTypoToleranceStage to treat the mismatch as a likely data-entry typo rather than a
 * genuinely different number. Backtested against a real 245-record population sharing this
 * stage's exact trigger shape (sole candidate, nameScore=100, a comparable-but-mismatched phone):
 * every number differing by 1-2 digits was confirmed the same real person by hand; every number
 * differing by 8+ digits was a genuinely different number. */
const PHONE_TYPO_MAX_DIGIT_DISTANCE = 2;

/** Count of differing digit positions between the last 10 digits of two phone numbers - null if
 * either side isn't a full, comparable 10-digit number (mirrors calculatePhoneScore's own
 * comparability rule). Both numbers are always exactly 10 digits once comparable, so a simple
 * position-by-position count is sufficient - no insertions/deletions are possible once both sides
 * are fixed at the same length, unlike a general edit-distance problem. */
function phoneDigitDistance(
  dxtrPhone: string | undefined,
  camsPhone: string | undefined,
): number | null {
  const dxtrDigits = (dxtrPhone ?? '').replace(/\D/g, '').slice(-10);
  const camsDigits = (camsPhone ?? '').replace(/\D/g, '').slice(-10);
  if (dxtrDigits.length < 10 || camsDigits.length < 10) return null;

  let distance = 0;
  for (let i = 0; i < 10; i++) {
    if (dxtrDigits[i] !== camsDigits[i]) distance++;
  }
  return distance;
}

/**
 * Rescues the complementary case to comparativeCorroborationStage: exactly ONE candidate clears
 * calculateNameScore's threshold (so resolveByContactCorroboration's single-candidate path
 * applies), that candidate's name is a PERFECT structured match (nameScore 100, a materially
 * higher bar than the 85 auto-link threshold since there's no other corroborating evidence to
 * lean on), but its phone is a real, comparable, MISMATCHED number - not missing, which is exactly
 * the case isNoContradictionMatch's existing fallback declines to help (it only relaxes when
 * phoneScore is null/uncomparable). calculatePhoneScore's binary 100-or-0 makes no distinction
 * between a one-digit transposition and a totally different area code; this stage adds
 * phoneDigitDistance as a new, pipeline-only signal to recover the former specifically. Confirmed
 * via a CAMS-876 backtest finding (a sole exact-name CAMS candidate whose recorded phone differs
 * from the ACMS record's phone by exactly one digit) that this is a real, recoverable gap.
 *
 * Deliberately does NOT modify calculatePhoneScore or isNoContradictionMatch themselves - both are
 * shared with the DXTR trustee-appointment dataflow (sync-trustee-case-appointments.ts) via
 * trustee-match.helpers.ts, and a change tuned for ACMS's specific typo patterns has no business
 * affecting that unrelated call path. phoneDigitDistance is defined and used only here.
 *
 * phoneDigitDistance's raw units (lower is better - 0 is an exact match) are the opposite polarity
 * of every other ScoreRecord.value (higher is better) - converted to a same-polarity similarity
 * (10 - distance, so an exact match scores 10) purely so `pass` stays computable the same way
 * everywhere (value >= threshold). The raw digit distance is kept alongside as phoneDigitDistance
 * for a reviewer who wants the human-readable count, not just the derived similarity.
 */
export function phoneTypoToleranceStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) => mergedScore(candidate).calculateNameScore?.pass === true,
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    if (mergedScore(candidate).calculateNameScore?.value !== 100) return state;

    const distance = phoneDigitDistance(
      state.acmsRaw.legacy?.phone,
      candidate.camsRaw.phone?.number,
    );
    if (distance === null) return state;

    const similarityThreshold = 10 - PHONE_TYPO_MAX_DIGIT_DISTANCE;
    addScore(candidate, 'phoneTypoToleranceScore', {
      value: 10 - distance,
      threshold: similarityThreshold,
      pass: 10 - distance >= similarityThreshold,
      phoneDigitDistance: distance,
    });

    if (distance > PHONE_TYPO_MAX_DIGIT_DISTANCE) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  });
}

/**
 * The corroborating scorers a sole candidate's consensus vote counts - deliberately excludes
 * calculateNameScore itself (that is the GATE into this stage, not a vote; every candidate this
 * stage considers already cleared it) and phoneTypoToleranceScore (a narrower, already-resolved
 * special case handled by phoneTypoToleranceStage - counting it here would double-count the same
 * underlying phone comparison contactCorroborationPhone already covers).
 */
const CONSENSUS_VOTING_SCORERS = [
  'stateFilterStage',
  'cityMatchStage',
  'zipMatchStage',
  'contactCorroborationAddress',
  'contactCorroborationPhone',
] as const;

/**
 * lastNameOnlyConsensusStage's voting set - CONSENSUS_VOTING_SCORERS' independent contact
 * corroboration PLUS firstNameFuzzyMatchStage's own result as one more vote, since this stage
 * (unlike soleCandidateConsensusStage) is never gated on calculateNameScore.pass, so a fuzzy
 * first-name match is real, additional evidence rather than a already-cleared precondition.
 */
const LAST_NAME_ONLY_VOTING_SCORERS = [
  ...CONSENSUS_VOTING_SCORERS,
  'firstNameFuzzyMatchStage',
] as const;

/**
 * Minimum percentage (0-100, the same scale every ScoreRecord.value/threshold uses - never a 0-1
 * fraction, so this stage's internal arithmetic never has to convert between two scales) of
 * applicable votes (see CONSENSUS_VOTING_SCORERS) that must pass for soleCandidateConsensusStage
 * to resolve. A starting point, not a derived constant - tuned against a real backtest population
 * (see test/integration/sync-acms-professional-ids-audit) rather than reasoned about in the
 * abstract, the same way CONTACT_CORROBORATION_NAME_THRESHOLD and PHONE_TYPO_MAX_DIGIT_DISTANCE
 * were each tuned against real recovered/rejected populations: 75% left a real, systematic
 * pattern unresolved (a stale zip/phone on file, but exact name/city/state agreement); 60%
 * recovers that whole pattern with every sampled resolve looking correct by hand; 50% recovers
 * only 3 more records than 60% - diminishing returns past that point.
 */
const CONSENSUS_PASS_PERCENT = 60;

/**
 * Tallies a given voting set's pass/fail into one percentage (see CONSENSUS_PASS_PERCENT for the
 * threshold and its tuning rationale) - shared by every stage that resolves a sole candidate via
 * consensus rather than a single decisive scorer, so the vote-counting rule itself (how absent
 * votes are treated, the pass bar) stays in exactly one place; only WHICH scorers count varies per
 * caller (see CONSENSUS_VOTING_SCORERS vs. LAST_NAME_ONLY_VOTING_SCORERS). Returns null when no
 * applicable scorer ran at all, so a caller can distinguish "zero corroborating evidence of any
 * kind" from "corroborating evidence that happened to fail" - the former should never resolve,
 * regardless of what a trivial 0/0 percentage would otherwise suggest.
 */
function computeConsensus(
  candidate: PipelineCandidate,
  votingScorers: readonly string[],
): ScoreRecord | null {
  const scores = mergedScore(candidate);
  const votes = votingScorers
    .map((scorer) => scores[scorer])
    .filter((record): record is ScoreRecord => record !== undefined);
  if (votes.length === 0) return null;

  const passCount = votes.filter((record) => record.pass).length;
  const passPercent = Math.round((passCount / votes.length) * 100);
  return {
    value: passPercent,
    threshold: CONSENSUS_PASS_PERCENT,
    pass: passPercent >= CONSENSUS_PASS_PERCENT,
  };
}

/**
 * Resolves a SOLE name-qualifying candidate (comparativeCorroborationStage's multi-candidate case,
 * and phoneTypoToleranceStage's narrower phone-typo case, both do not apply) using a
 * pass-fraction vote across every independent corroborating scorer that actually produced a
 * record for this candidate (see CONSENSUS_VOTING_SCORERS) - state, city, zip, address, phone.
 * A scorer that never ran (e.g. no comparable phone/zip data on either side) does not count as a
 * vote either way, so a thin-data candidate is judged only on the evidence that actually exists,
 * never penalized for missing data. Requires at least one scorer to have run at all - a candidate
 * with ZERO corroborating evidence of any kind never resolves via consensus, regardless of how
 * high the (trivially 0/0) pass fraction would otherwise compute to.
 *
 * Complements comparativeCorroborationStage/phoneTypoToleranceStage rather than replacing them:
 * this stage is the general fallback for the shape neither of those two covers - exactly one
 * name-qualifying candidate whose nameScore is below 100 (so phoneTypoToleranceStage's stricter
 * gate does not apply) with no second candidate to compare against (so
 * comparativeCorroborationStage's gate does not apply either).
 */
export function soleCandidateConsensusStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) => mergedScore(candidate).calculateNameScore?.pass === true,
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    const consensus = computeConsensus(candidate, CONSENSUS_VOTING_SCORERS);
    if (!consensus) return state;
    addScore(candidate, 'soleCandidateConsensusStage', consensus);

    if (!consensus.pass) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  });
}

/**
 * calculateNameScore's lastNameTokensMatch requires an (almost) exact lastName token match before
 * it will even consider the first name (see trustee-match.helpers.ts) - a real first-name
 * NICKNAME or spelling variant (Geoff/Geoffrey, Randy/Randolph, Phillip/Philip) still tanks the
 * WHOLE nameScore to 0, because calculateNameScore has no fuzzy first-name path at all. Confirmed
 * via a CAMS-876 backtest: 105 sole-candidate, exact-lastName-match records score nameScore=0 this
 * way, and hand-sampling shows this population is genuinely MIXED - real nickname/typo matches
 * interspersed with coincidentally-shared-surname, different-person pairs (e.g. "George
 * Itule"/"Margo Itule", "Harry Campbell"/"Kevin Campbell").
 *
 * A single fuzzy-first-name metric is not safe alone: natural's JaroWinklerDistance catches
 * prefix-style nicknames well (Geoff/Geoffrey=0.925) but misses non-prefix real nicknames
 * (Dick/Richard=0.595, Jay/John=0.575), while phonetic matching (SoundEx/Metaphone) catches
 * spelling variants (Phillip/Philip, Gregory/Greogry) but misses truncation nicknames entirely.
 * Combining both with OR (either clears FIRST_NAME_JARO_WINKLER_THRESHOLD, or either phonetic
 * algorithm agrees) still lets at least one real false positive through on first-name evidence
 * alone (Joseph/Joshua scores 0.844, well above the 0.8 threshold, despite not actually being a
 * nickname pair) - which is why this stage NEVER resolves on the fuzzy-name signal by itself. It
 * only records the fuzzy-name evidence as its own vote (firstNameFuzzyMatchStage) for
 * lastNameOnlyConsensusStage to weigh alongside independent contact corroboration (state, city,
 * zip, address, phone) - the same "many independent signals, no single one decisive" model
 * CONSENSUS_VOTING_SCORERS already uses.
 */
const FIRST_NAME_JARO_WINKLER_THRESHOLD = 0.8;

function isFuzzyFirstNameMatch(acmsFirstName: string, camsFirstName: string): boolean {
  const a = acmsFirstName.toLowerCase();
  const b = camsFirstName.toLowerCase();
  if (natural.JaroWinklerDistance(a, b) >= FIRST_NAME_JARO_WINKLER_THRESHOLD) return true;

  const soundex = new natural.SoundEx();
  const metaphone = new natural.Metaphone();
  return soundex.compare(a, b) || metaphone.compare(a, b);
}

/**
 * Records a fuzzy first-name comparison as its OWN vote (see isFuzzyFirstNameMatch for why this
 * signal is never trusted alone) - only for a sole candidate whose lastName is an exact token
 * match (mirrors calculateNameScore's own lastNameTokensMatch gate) but whose overall nameScore is
 * 0 (a fuzzy-but-not-exact first name is exactly what tanks calculateNameScore to 0 despite a real
 * lastName match - see calculateNameScore's doc comment). A candidate whose lastName does NOT
 * match is left alone entirely; that is a genuinely different surname, not this pattern.
 */
function isExactLastNameMatch(acmsLastName: string, camsLastName: string): boolean {
  const acmsLast = acmsLastName.trim().toLowerCase();
  const camsLast = camsLastName.trim().toLowerCase();
  return acmsLast.length > 0 && acmsLast === camsLast;
}

/** The sole candidate eligible for a fuzzy first-name vote - a real lastName match (see
 * isExactLastNameMatch) whose overall nameScore was tanked to 0, with both sides having a first
 * name to actually compare. Returns undefined when zero or multiple candidates qualify, or when
 * either side has no first name to compare - firstNameFuzzyMatchStage no-ops in every such case. */
function findSoleZeroNameScoreCandidateWithMatchingLastName(
  state: PipelineState,
): PipelineCandidate | undefined {
  const qualifying = [...state.candidates.values()].filter(
    (candidate) =>
      mergedScore(candidate).calculateNameScore?.value === 0 &&
      isExactLastNameMatch(state.acmsRaw.lastName ?? '', candidate.camsRaw.lastName ?? ''),
  );
  if (qualifying.length !== 1) return undefined;

  const candidate = qualifying[0];
  return state.acmsRaw.firstName && candidate.camsRaw.firstName ? candidate : undefined;
}

export function firstNameFuzzyMatchStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const candidate = findSoleZeroNameScoreCandidateWithMatchingLastName(state);
    if (candidate) {
      const acmsFirst = (state.acmsRaw.firstName ?? '').toLowerCase();
      const camsFirst = (candidate.camsRaw.firstName ?? '').toLowerCase();
      addScore(candidate, 'firstNameFuzzyMatchStage', {
        value: Math.round(natural.JaroWinklerDistance(acmsFirst, camsFirst) * 100),
        threshold: Math.round(FIRST_NAME_JARO_WINKLER_THRESHOLD * 100),
        pass: isFuzzyFirstNameMatch(acmsFirst, camsFirst),
      });
    }
    return state;
  });
}

/**
 * The complementary gate to soleCandidateConsensusStage: resolves a sole candidate whose lastName
 * matches exactly but whose OVERALL nameScore was 0 (see firstNameFuzzyMatchStage), using the same
 * consensus vote (see computeConsensus/CONSENSUS_VOTING_SCORERS) PLUS the fuzzy first-name result
 * as one more independent vote. Never runs for a candidate soleCandidateConsensusStage already
 * covers (that stage's gate is calculateNameScore.pass===true; this stage's gate is
 * calculateNameScore.value===0 - the two gates are mutually exclusive for any nameScore between 0
 * and 85 exclusive, calculateNameScore never actually returns a value in that open range - see
 * calculateNameScore's discrete field-by-field comparison, so no candidate is ever double-counted
 * by both stages).
 */
export function lastNameOnlyConsensusStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) => mergedScore(candidate).firstNameFuzzyMatchStage !== undefined,
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    const consensus = computeConsensus(candidate, LAST_NAME_ONLY_VOTING_SCORERS);
    if (!consensus) return state;
    addScore(candidate, 'lastNameOnlyConsensusStage', consensus);

    if (!consensus.pass) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  });
}
