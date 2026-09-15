import { ApplicationContext } from '../../adapters/types/basic';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import factory from '../../factory';
import { matchTrusteeByName } from './trustee-match.helpers';
import {
  createInitialState,
  mergedScore,
  PipelineCandidate,
  PipelineState,
  projectTrustee,
  promoteCandidate,
  runPipeline,
} from './trustee-match-pipeline';
import {
  anchoredLevenshteinDiscoveryStage,
  cityMatchStage,
  comparativeCorroborationStage,
  corroborationStage,
  nameScoreStage,
  phoneTypoToleranceStage,
  similarityDiagnosticsStage,
  soleCandidateConsensusStage,
  stateFilterStage,
  surnameExactDiscoveryStage,
  tokenIntersectionDiscoveryStage,
  zipMatchStage,
} from './trustee-match-pipeline-stages';

/**
 * Runs one candidate-discovery tier as its OWN nested pipeline (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md on nesting), then promotes only
 * the candidates that cleared the tier's own quality bar (mergedScore(c).calculateNameScore?.pass
 * === true from nameScoreStage, or the candidate resolved within the tier) into the outer state.
 * An oversized
 * internal candidate pool (500+ candidates for a common surname fragment) never becomes top-level
 * pipeline state - only genuinely relevant survivors do. Returns the NESTED result state so the
 * orchestrator can inspect whether this tier found anything at all (nestedResult.candidates.size)
 * to decide whether to try the next tier - a tier that discovered zero candidates says nothing
 * about a later tier's chances, but a tier that discovered ANY candidates and still didn't resolve
 * may still need to block further tiers (see runSurnameExactTier) or may not (see
 * runMatchTrusteeByNameTier's levenshtein rescue) - that asymmetry is tier-specific and decided by
 * the caller, not by this helper.
 */
async function runNestedTier(
  context: ApplicationContext,
  acmsRaw: DxtrTrusteeParty,
  outerState: PipelineState,
  discoveryStage: (context: ApplicationContext) => (state: PipelineState) => Promise<PipelineState>,
): Promise<PipelineState> {
  const nestedState = createInitialState(acmsRaw);
  const nestedResult = await runPipeline(nestedState, [
    discoveryStage(context),
    stateFilterStage(),
    nameScoreStage(),
    similarityDiagnosticsStage(),
    cityMatchStage(),
    zipMatchStage(),
    corroborationStage(context),
    comparativeCorroborationStage(),
    phoneTypoToleranceStage(),
    soleCandidateConsensusStage(),
  ]);

  for (const candidate of nestedResult.candidates.values()) {
    if (mergedScore(candidate).stateFilterStage?.pass === false) continue;
    promoteCandidate(outerState, candidate);
  }

  return nestedResult;
}

/**
 * Full priority-ordered tier sequence, replicating processNameMatch's exact behavior
 * (sync-acms-professional-ids.ts) via reusable pipeline stages instead of nested if/else
 * branches. Tier priority and fallthrough rules are preserved exactly as they exist today:
 *
 * 1. surnameExact: if it finds ANY candidates (resolved or not), the pipeline stops here - no
 *    other tier runs, matching processNameMatch's "surname-exact wins outright" rule.
 * 2. matchTrusteeByName (only tried if surnameExact found nothing): its own internal exact/fuzzy
 *    logic can resolve directly, or return an ambiguous CandidateScore[] pool. If ambiguous and
 *    the pool is large, it is re-fetched and passed through the state filter before corroboration
 *    (mirroring processNameMatch's STATE_FILTER_POOL_SIZE_THRESHOLD-gated re-fetch). If THAT still
 *    doesn't resolve, anchoredLevenshtein is tried as a rescue before giving up - unlike
 *    surnameExact, an unresolved matchTrusteeByName does NOT block anchoredLevenshtein.
 * 3. tokenIntersection (only tried if matchTrusteeByName found nothing at all, not merely
 *    ambiguous).
 * 4. anchoredLevenshtein (only tried if tokenIntersection didn't resolve).
 *
 * Every promoted candidate's full score history (including from its nested tier's internal
 * discovery/scoring/corroboration attempts) is preserved on the returned state for later
 * persistence/review, regardless of whether the pipeline as a whole ends in a match.
 */
/**
 * Re-fetches matchTrusteeByName's ambiguous CandidateScore[] pool as raw Trustee records (needed
 * for the state filter, which reads structured firstName/middleName/lastName/state -
 * CandidateScore only carries a composed trusteeName string), runs it through the state filter and
 * corroboration, promotes every non-mismatched candidate into the outer state either way, and
 * returns whether it resolved. Mirrors processNameMatch's own re-fetch-then-filter step exactly
 * (sync-acms-professional-ids.ts).
 */
async function resolveMatchTrusteeByNameAmbiguous(
  context: ApplicationContext,
  acmsRaw: DxtrTrusteeParty,
  outerState: PipelineState,
  rawCandidateIds: string[],
): Promise<boolean> {
  const trusteesRepo = factory.getTrusteesRepository(context);
  const rawTrustees = await trusteesRepo.findTrusteesByIds(rawCandidateIds);

  const nestedState = createInitialState(acmsRaw);
  for (const trustee of rawTrustees) {
    const candidate: PipelineCandidate = {
      camsRaw: projectTrustee(trustee),
      camsNormalized: new Map(),
      scores: {},
    };
    nestedState.candidates.set(trustee.trusteeId, candidate);
  }
  const nestedResult = await runPipeline(nestedState, [
    stateFilterStage(),
    nameScoreStage(),
    similarityDiagnosticsStage(),
    cityMatchStage(),
    zipMatchStage(),
    corroborationStage(context),
    comparativeCorroborationStage(),
    phoneTypoToleranceStage(),
    soleCandidateConsensusStage(),
  ]);

  for (const candidate of nestedResult.candidates.values()) {
    if (mergedScore(candidate).stateFilterStage?.pass === false) continue;
    promoteCandidate(outerState, candidate);
  }

  if (nestedResult.match) {
    outerState.match = nestedResult.match;
    return true;
  }
  return false;
}

export async function runTrusteeMatchPipeline(
  context: ApplicationContext,
  acmsRaw: DxtrTrusteeParty,
): Promise<PipelineState> {
  const outerState = createInitialState(acmsRaw);

  const surnameExactResult = await runNestedTier(
    context,
    acmsRaw,
    outerState,
    surnameExactDiscoveryStage,
  );
  if (surnameExactResult.candidates.size > 0) {
    outerState.match = surnameExactResult.match;
    return outerState;
  }

  const nameResult = await matchTrusteeByName(context, acmsRaw);

  if (nameResult.kind === 'resolved') {
    outerState.match = {
      trusteeId: nameResult.trusteeId,
      score: { nameScore: nameResult.nameScore, nameMatchQuality: nameResult.nameMatchQuality },
    };
    return outerState;
  }

  if (nameResult.kind === 'ambiguous') {
    const rawCandidateIds = nameResult.matchCandidates.map((c) => c.trusteeId);
    const resolved = await resolveMatchTrusteeByNameAmbiguous(
      context,
      acmsRaw,
      outerState,
      rawCandidateIds,
    );
    if (resolved) return outerState;

    const levenshteinResult = await runNestedTier(
      context,
      acmsRaw,
      outerState,
      anchoredLevenshteinDiscoveryStage,
    );
    if (levenshteinResult.match) {
      outerState.match = levenshteinResult.match;
    }
    return outerState;
  }

  const tokenIntersectionResult = await runNestedTier(
    context,
    acmsRaw,
    outerState,
    tokenIntersectionDiscoveryStage,
  );
  if (tokenIntersectionResult.match) {
    outerState.match = tokenIntersectionResult.match;
    return outerState;
  }

  const levenshteinResult = await runNestedTier(
    context,
    acmsRaw,
    outerState,
    anchoredLevenshteinDiscoveryStage,
  );
  if (levenshteinResult.match) {
    outerState.match = levenshteinResult.match;
  }
  return outerState;
}
