import { ApplicationContext } from '../../adapters/types/basic';
import { Trustee } from '@common/cams/trustees';
import { calculateNameScore, findSurnameExactCandidates } from './trustee-match.helpers';
import {
  addCandidate,
  addScore,
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
