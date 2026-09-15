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
      addScore(candidate, { scorer: 'calculateNameScore', nameScore, match: nameScore >= 85 });
    }
    return state;
  });
}

/**
 * Reimplements filterNoisyStateMismatches' logic (see that function's doc comment in
 * trustee-match.helpers.ts for the full rationale) as an ANNOTATION rather than an array filter -
 * the pipeline's candidate list is append-only, so a state mismatch is recorded as a score entry
 * (stateMismatch: boolean) for a later resolution stage to read, never used to remove a candidate
 * outright. Reimplemented rather than called through a type cast because
 * filterNoisyStateMismatches reads candidate.public.address/phone (Trustee's real nested shape),
 * which ProjectedTrustee deliberately flattens - a cast would compile but read undefined at
 * runtime. calculateNameScore/calculatePhoneScore/parseCityStateZip/the two threshold constants
 * are reused unchanged; only the nested-vs-flat field access differs.
 *
 * Only activates once the pool already exceeds STATE_FILTER_POOL_SIZE_THRESHOLD - below that, every
 * candidate is annotated stateMismatch: false unconditionally, matching
 * filterNoisyStateMismatches' own early return.
 */
export function stateFilterStage(): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const candidates = [...state.candidates.values()];
    if (candidates.length <= STATE_FILTER_POOL_SIZE_THRESHOLD) {
      for (const candidate of candidates) {
        addScore(candidate, { scorer: 'stateFilterStage', stateMismatch: false });
      }
      return state;
    }

    const parsedAcmsAddress = parseCityStateZip(state.acmsRaw.legacy?.cityStateZipCountry);
    if (!parsedAcmsAddress) {
      for (const candidate of candidates) {
        addScore(candidate, { scorer: 'stateFilterStage', stateMismatch: false });
      }
      return state;
    }

    const acmsState = parsedAcmsAddress.state.toLowerCase();
    for (const candidate of candidates) {
      const camsState = candidate.camsRaw.address?.state?.toLowerCase();
      if (!camsState || camsState === acmsState) {
        addScore(candidate, { scorer: 'stateFilterStage', stateMismatch: false });
        continue;
      }

      const phoneScore = calculatePhoneScore(state.acmsRaw.legacy?.phone, candidate.camsRaw.phone);
      if (phoneScore === 100) {
        addScore(candidate, { scorer: 'stateFilterStage', stateMismatch: false });
        continue;
      }

      const nameScore = calculateNameScore(state.acmsRaw, candidate.camsRaw as unknown as Trustee);
      const stateMismatch = nameScore < STATE_OVERRIDE_MIN_NAME_SCORE;
      addScore(candidate, { scorer: 'stateFilterStage', stateMismatch });
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
 * Only considers candidates whose merged score does NOT have stateMismatch: true (see
 * stateFilterStage) - a candidate a state-filter annotated as noise is excluded from the id list
 * passed to corroboration, without ever being removed from state.candidates itself.
 */
export function corroborationStage(context: ApplicationContext): Stage {
  return withGuard(async (state: PipelineState): Promise<PipelineState> => {
    const candidateTrusteeIds = [...state.candidates.entries()]
      .filter(([, candidate]) => mergedScore(candidate).stateMismatch !== true)
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
