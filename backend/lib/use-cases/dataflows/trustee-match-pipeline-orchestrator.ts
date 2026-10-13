import { ApplicationContext } from '../../adapters/types/basic';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import {
  createTrusteeInitialState as createInitialState,
  TrusteePipelineState as PipelineState,
  promoteCandidate,
  runPipeline,
  TrusteeStage as Stage,
} from './trustee-match-pipeline';
import {
  recallByAnchoredLevenshtein,
  recallByName,
  resolveByPhoneWithTypo,
  resolveByStateOnly,
  resolveByNameOnly,
  resolveByAddress,
  resolveByPhone,
  resolveByEmailAddress,
  normalizeAcmsSourceName,
  skipAdministrativePlaceholder,
  recallBySurnameExact,
  recallByTokenIntersection,
} from './trustee-match-pipeline-stages';

const MODULE_NAME = 'TRUSTEE-MATCH-PIPELINE-ORCHESTRATOR';

/**
 * RESOLVE stages every discovery tier shares, strongest signal first. Each evaluates the whole
 * pool: no survivor or a tie passes to the next stage; a unique best survivor is the match.
 */
function resolveStages(): Stage[] {
  return [
    resolveByPhone(),
    resolveByEmailAddress(),
    resolveByPhoneWithTypo(),
    resolveByAddress(),
    resolveByStateOnly(),
    resolveByNameOnly(),
  ];
}

/**
 * Runs one discovery stage and the shared resolve stages in a nested state seeded with every
 * candidate earlier tiers promoted, so a tier resolves against everything recalled so far and a
 * narrower search cannot hide a rival an earlier tier found. Then promotes every surviving
 * candidate into the outer state. Promotion is unconditional because discovery already evicted
 * irrelevant candidates (see shouldEvictFromDiscovery).
 */
async function runNestedTier(
  acmsRaw: DxtrTrusteeParty,
  outerState: PipelineState,
  discoveryStage: Stage,
): Promise<PipelineState> {
  const nestedState = createInitialState(acmsRaw);
  for (const candidate of outerState.candidates.values()) {
    promoteCandidate(nestedState, candidate);
  }
  // A fresh state starts unnormalized, so the source name is normalized again here (pure and
  // idempotent). The skip gate is not repeated: it reads only sourceRaw, which the caller checked.
  const nestedResult = await runPipeline(nestedState, [
    normalizeAcmsSourceName(),
    discoveryStage,
    ...resolveStages(),
  ]);

  for (const candidate of nestedResult.candidates.values()) {
    promoteCandidate(outerState, candidate);
  }

  return nestedResult;
}

/**
 * Matches one ACMS record to a CAMS trustee. An administrative placeholder is skipped outright.
 * Otherwise recallBySurnameExact and then recallByName each run with the resolve stages and end the
 * pipeline only if they resolve; finding candidates alone never blocks a later tier. If neither
 * resolves, recallByTokenIntersection and recallByAnchoredLevenshtein add their candidates and the
 * whole promoted pool is resolved together, so every tier's candidates compete under the same
 * rules. The returned state keeps every promoted candidate's score history, match or not.
 */
export async function runTrusteeMatchPipeline(
  context: ApplicationContext,
  acmsRaw: DxtrTrusteeParty,
): Promise<PipelineState> {
  const outerState = createInitialState(acmsRaw);

  // Backstop only: RECALL failures land on state.error and are checked at each tier boundary.
  try {
    const gateResult = await skipAdministrativePlaceholder()(outerState);
    if (gateResult.skip) {
      outerState.skip = true;
      return outerState;
    }

    // The outer state is what gets persisted, so it carries its own normalized source name.
    const normalizeResult = await normalizeAcmsSourceName()(outerState);
    outerState.sourceNormalized = normalizeResult.sourceNormalized;

    const surnameExactResult = await runNestedTier(
      acmsRaw,
      outerState,
      recallBySurnameExact(context),
    );
    if (surnameExactResult.error) {
      outerState.error = surnameExactResult.error;
      return outerState;
    }
    if (surnameExactResult.match) {
      outerState.match = surnameExactResult.match;
      return outerState;
    }

    const matchByNameResult = await runNestedTier(acmsRaw, outerState, recallByName(context));
    if (matchByNameResult.error) {
      outerState.error = matchByNameResult.error;
      return outerState;
    }
    if (matchByNameResult.match) {
      outerState.match = matchByNameResult.match;
      return outerState;
    }

    const tokenIntersectionResult = await runNestedTier(
      acmsRaw,
      outerState,
      recallByTokenIntersection(context),
    );
    if (tokenIntersectionResult.error) {
      outerState.error = tokenIntersectionResult.error;
      return outerState;
    }

    const anchoredLevenshteinResult = await runNestedTier(
      acmsRaw,
      outerState,
      recallByAnchoredLevenshtein(context),
    );
    if (anchoredLevenshteinResult.error) {
      outerState.error = anchoredLevenshteinResult.error;
      return outerState;
    }

    const combinedResult = await runPipeline(outerState, resolveStages());
    outerState.match = combinedResult.match;
    outerState.error = combinedResult.error;
    return outerState;
  } catch (originalError) {
    outerState.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: { module: MODULE_NAME, message: 'runTrusteeMatchPipeline failed' },
    });
    return outerState;
  }
}
