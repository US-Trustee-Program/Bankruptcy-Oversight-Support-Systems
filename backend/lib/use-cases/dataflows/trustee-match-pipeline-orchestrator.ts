import { ApplicationContext } from '../../adapters/types/basic';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import {
  createTrusteeInitialState as createInitialState,
  mergedScore,
  TrusteePipelineState as PipelineState,
  promoteCandidate,
  runPipeline,
  TrusteeStage as Stage,
} from './trustee-match-pipeline';
import {
  recallByAnchoredLevenshtein,
  resolveByComparativeCorroboration,
  resolveBySoleContactMatch,
  resolveBySoleExactNameMatch,
  resolveBySoleExactNameMatchByStateThenGeo,
  resolveRisky,
  resolveByLastNameOnlyConsensus,
  resolveByFuzzyLastNameMatch,
  resolveBySoleFuzzyNameMatchAndState,
  recallByNameThenResolveExact,
  resolveByPhoneTypoTolerance,
  resolveByConsensus,
  normalizeAcmsSourceName,
  skipAdministrativePlaceholder,
  recallBySurnameExact,
  recallByTokenIntersection,
} from './trustee-match-pipeline-stages';

const MODULE_NAME = 'TRUSTEE-MATCH-PIPELINE-ORCHESTRATOR';

/**
 * RESOLVE stages every discovery tier shares (see docs/architecture/decision-records/
 * TrusteeMatchingPipeline.md on the RESOLVE role). ONE shared list rather than one copy per
 * discovery tier - a candidate is resolved the same way no matter which tier discovered it, so the
 * resolution rules belong in exactly one place.
 *
 * Deliberately contains NO separate FILTER/SCORE stages - every candidate is already fully scored
 * (isStateNotConflicting, doesNameMatch, doesCityMatch/doesStateMatch/doesZipCodeMatch,
 * addressDisqualifiers/nameDisqualifiers, contact corroboration, phone-typo tolerance, and every
 * other per-candidate score) the instant it's discovered, via addAndScoreCandidate in
 * trustee-match-pipeline-stages.ts - not a separate later pass. promoteCandidate (see
 * runNestedTier below) carries that already-computed score history forward when a candidate moves
 * from a nested tier into the outer pool, so no candidate this list ever sees is unscored. A
 * pool-wide re-scoring pass here would have nothing new to compute.
 */
function resolveStages(): Stage[] {
  return [
    // RESOLVE - may set state.match, in PRIORITY order (once one resolves, runPipeline makes
    // every later stage a no-op - see its own doc comment) - this order is a real behavioral
    // decision, not just sequencing, and must not be reshuffled without a backtest confirming
    // outcomes hold. Confirmed via a CAMS-876 backtest (cams-j635f, run before the SCORE/RESOLVE
    // decoupling - see resolveBySoleContactMatch's own doc comment for why it no longer needs a
    // repository fetch in its main path) that swapped resolveBySoleContactMatch/
    // resolveByComparativeCorroboration/resolveByPhoneTypoTolerance/resolveBySoleExactNameMatch
    // against each other (the only 4 of these stages with no read dependency on one another - see
    // resolveByConsensus/resolveByLastNameOnlyConsensus/resolveByFuzzyLastNameMatch's own comments
    // for why THEY can't be reordered at all): every reordering held the outcome identical to this
    // order EXCEPT moving resolveByComparativeCorroboration before resolveBySoleContactMatch,
    // which cost real resolutions - once the weaker (multi-candidate arbitration) stage resolves
    // or fails to, runPipeline never lets the other run. This order is "richest evidence first,"
    // not arbitrary. resolveBySoleContactMatch is pure - see its own doc comment on why it
    // deliberately never falls back to resolveDuplicateNameCandidates.
    resolveBySoleContactMatch(),
    resolveByComparativeCorroboration(),
    resolveByPhoneTypoTolerance(),
    resolveBySoleExactNameMatch(),
    // resolveBySoleExactNameMatchByStateThenGeo only ever sees a 2+-candidate exact-name-match
    // pool (resolveBySoleExactNameMatch's gate already claims the sole-candidate case), and runs
    // after resolveByComparativeCorroboration since that stage's contact/full-geo signal is
    // richer than this one's state/city/zip narrowing.
    resolveBySoleExactNameMatchByStateThenGeo(),
    resolveByConsensus(),
    // resolveBySoleFuzzyNameMatchAndState's state-only bar is strictly weaker than
    // resolveByConsensus's isCorroboratedByGeoOrContact gate, so it must run after it, not
    // reordered alongside the four stages above - it only ever catches what resolveByConsensus
    // already declined for lack of city/zip/contact corroboration.
    resolveBySoleFuzzyNameMatchAndState(),
    resolveByLastNameOnlyConsensus(), // composed narrow-then-score-then-resolve, see its own doc comment
    resolveByFuzzyLastNameMatch(), // composed score-then-resolve, see its own doc comment
    // HIGH-RISK, deliberately LAST-RESORT - see resolveRisky's own doc comment (and each composed
    // sub-stage's own "!!! HIGH-RISK" comment). Every richer-evidence stage above gets first
    // attempt at any candidate resolveRisky's sub-stages would also consider.
    resolveRisky(),
  ];
}

/**
 * Runs one discovery stage's candidates through the shared resolve pipeline, in its OWN nested
 * state (see docs/architecture/decision-records/TrusteeMatchingPipeline.md on nesting) - an
 * oversized internal candidate pool (500+ candidates for a common surname fragment) never becomes
 * top-level pipeline state, only genuinely relevant survivors (mergedScore(c).isStateNotConflicting?.pass
 * !== false) do. Returns the nested result so the caller can inspect whether this tier resolved,
 * and separately, whether its non-resolving candidates are worth merging into a broader pool (see
 * runTrusteeMatchPipeline).
 */
async function runNestedTier(
  acmsRaw: DxtrTrusteeParty,
  outerState: PipelineState,
  discoveryStage: Stage,
): Promise<PipelineState> {
  const nestedState = createInitialState(acmsRaw);
  // normalizeAcmsSourceName() and skipAdministrativePlaceholder() both run first here too, not
  // just in runTrusteeMatchPipeline's own flow below: createInitialState always starts a fresh
  // sourceNormalized clone (see cloneNormalizableFields)/skip:false, and this nested state is its
  // own object, not a copy of outerState - so neither outerState.sourceNormalized's own recovered
  // fields nor outerState.skip would otherwise propagate into this nested run. Re-running both is
  // cheap (pure, no I/O) and idempotent (see their own doc comments), so paying that cost once per
  // nested tier is preferable to threading outerState's already-normalized fields through as extra
  // parameters every discoveryStage would need to ignore.
  const nestedResult = await runPipeline(nestedState, [
    normalizeAcmsSourceName(),
    skipAdministrativePlaceholder(),
    discoveryStage,
    ...resolveStages(),
  ]);

  for (const candidate of nestedResult.candidates.values()) {
    if (mergedScore(candidate).isStateNotConflicting?.pass === false) continue;
    promoteCandidate(outerState, candidate);
  }

  return nestedResult;
}

/**
 * Full discovery-then-resolve sequence, replicating processNameMatch's original behavior
 * (sync-acms-professional-ids.ts) via composable pipeline stages. Cheapest and most decisive check
 * first, before any tier runs at all: skipAdministrativePlaceholder detects an ACMS record that
 * names no real person (an administrative placeholder, not a trustee) and short-circuits the whole
 * pipeline with state.skip, since there is no identity here for any discovery tier to usefully
 * search for. Past that gate, two genuinely fast, narrow, high-confidence paths are tried next and
 * short-circuit immediately if they resolve - most records never need anything past this point:
 *
 * 1. surnameExact: cheap (single indexed query), and correct often enough to be worth trying
 *    before any fuzzier/costlier search.
 * 2. matchTrusteeByName's own internal exact-match pass (part of recallByNameThenResolveExact,
 *    see its doc comment) - a fully-normalized name match against a UNIQUE CAMS trustee.
 *
 * Neither of these blocks the other, or any later tier, from running just because it discovered
 * SOME candidates - only an actual RESOLUTION short-circuits. A same-surname candidate that never
 * corroborates (e.g. "Aldric K. Vossey" for ACMS "Marcus L Vossey") is real evidence of nothing on its
 * own and must not prevent broader tiers from ever getting a chance (confirmed via a CAMS-876
 * no-match investigation: 233 of 663 zero-candidate no-match records had this exact shape - a
 * surname-exact hit that never resolved, silently blocking matchTrusteeByName's ambiguous pool,
 * which independently found real corroborated candidates for the same record).
 *
 * If neither fast path resolves, every remaining discovery tier's candidates
 * (recallByNameThenResolveExact's ambiguous pool, recallByTokenIntersection,
 * recallByAnchoredLevenshtein) are pooled into ONE combined candidate set and resolved
 * together via the shared resolveStages list - a real corroborated candidate found by one tier is
 * never crowded out or hidden by an uncorroborated one found by another; every candidate from
 * every tier competes on equal footing under the same rules. surnameExact's own already-scored,
 * non-state-mismatched candidates are carried forward into this combined pool too, rather than
 * discarded, since they were real, cheap work already done.
 *
 * Every promoted candidate's full score history is preserved on the returned state for later
 * persistence/review, regardless of whether the pipeline as a whole ends in a match.
 */
export async function runTrusteeMatchPipeline(
  context: ApplicationContext,
  acmsRaw: DxtrTrusteeParty,
): Promise<PipelineState> {
  const outerState = createInitialState(acmsRaw);

  // Backstop, not the primary error-handling mechanism: a RECALL stage's own IO failure never
  // throws (see recallBySurnameExact et al. in trustee-match-pipeline-stages.ts) - it writes
  // directly to its own nested state.error, and this function inspects that explicitly at each
  // tier boundary below, the same way it already inspects .match. This catch exists only for
  // something genuinely unanticipated (e.g. a bug in a SCORE/RESOLVE stage, which are pure and
  // should never throw) - the call site should decide what to do by reading the state graph, not
  // by relying on thrown exceptions for control flow.
  try {
    // Populates outerState.sourceNormalized before anything else runs, so the top-level state
    // graph carries the recovered name right alongside outerState.sourceRaw's untouched CMMPR
    // copy (see normalizeAcmsSourceName's own doc comment) - every nested tier below also
    // re-normalizes into its own nested state (see runNestedTier), but outerState needs its own
    // copy too since it is what gets persisted/reviewed as this record's evidence.
    const normalizeResult = await normalizeAcmsSourceName()(outerState);
    outerState.sourceNormalized = normalizeResult.sourceNormalized;

    // Cheapest possible check, first, before any nested tier ever runs: an administrative
    // placeholder (see skipAdministrativePlaceholder) names no real person, so there is nothing
    // for ANY discovery tier to usefully search for. Checked again inside runNestedTier itself
    // (see its own comment on why outerState.skip does not otherwise reach that nested state),
    // but checking it here too means a skip-worthy record never even reaches the first
    // runNestedTier call, not just no-ops once inside it.
    const gateResult = await skipAdministrativePlaceholder()(outerState);
    if (gateResult.skip) {
      outerState.skip = true;
      return outerState;
    }

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

    const matchByNameResult = await runNestedTier(
      acmsRaw,
      outerState,
      recallByNameThenResolveExact(context),
    );
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

    // Combined pool: every candidate any tier above found and promoted (surname-exact,
    // matchTrusteeByName's ambiguous pool, token-intersection, anchored-Levenshtein), scored and
    // resolved together in one pass - see this function's doc comment for why they must not be
    // resolved in isolation, tier by tier.
    const combinedResult = await runPipeline(outerState, resolveStages());
    outerState.match = combinedResult.match;
    return outerState;
  } catch (originalError) {
    outerState.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: { module: MODULE_NAME, message: 'runTrusteeMatchPipeline failed' },
    });
    return outerState;
  }
}
