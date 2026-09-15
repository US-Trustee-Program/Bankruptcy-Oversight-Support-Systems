import * as natural from 'natural';
import { getNameVariations } from 'name-match/src/name-normalizer';
import { ApplicationContext } from '../../adapters/types/basic';
import { Trustee } from '@common/cams/trustees';
import {
  calculateNameScore,
  calculatePhoneScore,
  findAnchoredLevenshteinCandidates,
  findSurnameExactCandidates,
  findTokenIntersectionCandidates,
  parseCityStateZip,
  resolveByContactCorroboration,
  resolveDuplicateNameCandidates,
  STATE_FILTER_POOL_SIZE_THRESHOLD,
  STATE_OVERRIDE_MIN_NAME_SCORE,
} from './trustee-match.helpers';
import {
  addCandidate,
  addScore,
  mergedScore,
  normalize,
  PipelineState,
  projectTrustee,
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
      addScore(candidate, 'calculateNameScore', { nameScore, match: nameScore >= 85 });
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
 * repeatedly. Keys on the function name AND its input argument together
 * (`normalizeForSimilarity(John Doe)`), not just the bare function name - a memo map keyed by bare
 * name alone would silently return a stale value for a different input if this normalizer were
 * ever called twice against the same memo with two different names (normalize has no way to
 * detect that mismatch itself; it only knows "has this key been computed before"). The raw name is
 * embedded directly, no quoting/escaping - a memoization key only needs to be unique per input, not
 * a faithfully round-trippable serialization.
 */
function memoizedNormalizeForSimilarity(memo: Map<string, unknown>, name: string): string {
  return normalize(memo, `normalizeForSimilarity(${name})`, () => normalizeForSimilarity(name));
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
      normalize(candidate.camsNormalized, 'fullNameSimilarity', () =>
        fullNameSimilarity(normalizedAcms, normalizedCams),
      );
      normalize(candidate.camsNormalized, 'tokenNameMatchRate', () =>
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
 * runtime. calculateNameScore/calculatePhoneScore/parseCityStateZip/the two threshold constants
 * are reused unchanged; only the nested-vs-flat field access differs.
 *
 * Only activates once the pool already exceeds STATE_FILTER_POOL_SIZE_THRESHOLD - below that, every
 * candidate is annotated stateMatch: true unconditionally, matching filterNoisyStateMismatches' own
 * early return.
 */
export function stateFilterStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const candidates = [...state.candidates.values()];
    if (candidates.length <= STATE_FILTER_POOL_SIZE_THRESHOLD) {
      for (const candidate of candidates) {
        addScore(candidate, 'stateFilterStage', { stateMatch: true });
      }
      return state;
    }

    const parsedAcmsAddress = parseCityStateZip(state.acmsRaw.legacy?.cityStateZipCountry);
    if (!parsedAcmsAddress) {
      for (const candidate of candidates) {
        addScore(candidate, 'stateFilterStage', { stateMatch: true });
      }
      return state;
    }

    const acmsState = parsedAcmsAddress.state.toLowerCase();
    for (const candidate of candidates) {
      const camsState = candidate.camsRaw.address?.state?.toLowerCase();
      if (!camsState || camsState === acmsState) {
        addScore(candidate, 'stateFilterStage', { stateMatch: true });
        continue;
      }

      const phoneScore = calculatePhoneScore(state.acmsRaw.legacy?.phone, candidate.camsRaw.phone);
      if (phoneScore === 100) {
        addScore(candidate, 'stateFilterStage', { stateMatch: true });
        continue;
      }

      const nameScore = calculateNameScore(state.acmsRaw, candidate.camsRaw as unknown as Trustee);
      const stateMatch = nameScore >= STATE_OVERRIDE_MIN_NAME_SCORE;
      addScore(candidate, 'stateFilterStage', { stateMatch });
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
      .filter(([, candidate]) => mergedScore(candidate).stateMatch !== false)
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
