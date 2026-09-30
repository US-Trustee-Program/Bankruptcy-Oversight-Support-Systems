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
  resolveByComparativeCorroboration,
  resolveBySoleContactMatch,
  resolveBySoleExactNameInState,
  resolveBySoleFuzzyNameMatchAndState,
  recallByNameThenResolveMatch,
  resolveByPhoneTypoTolerance,
  resolveByStateAndCity,
  resolveByZipCode,
  resolveByCityAndZipCode,
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
 * RESOLVE stages every discovery tier shares (see docs/architecture/decision-records/
 * TrusteeMatchingPipeline.md on the RESOLVE role). ONE shared list rather than one copy per
 * discovery tier - a candidate is resolved the same way no matter which tier discovered it, so the
 * resolution rules belong in exactly one place.
 *
 * Deliberately contains NO separate FILTER/SCORE stages - every candidate is already fully scored
 * (doesNameMatch, doesCityMatch/doesStateMatch/doesZipCodeMatch,
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
    // outcomes hold. Swapping resolveBySoleContactMatch/resolveByComparativeCorroboration/
    // resolveByPhoneTypoTolerance against each other (the only 3 of these stages with no read
    // dependency on one another - the atomic corroboration families below have their own strict
    // ordering requirements) held the outcome identical to this order EXCEPT moving
    // resolveByComparativeCorroboration before resolveBySoleContactMatch, which cost real
    // resolutions - once the weaker (multi-candidate arbitration) stage resolves or fails to,
    // runPipeline never lets the other run. This order is "richest evidence first," not arbitrary.
    // resolveBySoleContactMatch is pure - see its own doc comment on why it deliberately never
    // falls back to resolveDuplicateNameCandidates.
    resolveBySoleContactMatch(),
    resolveByComparativeCorroboration(),
    resolveByPhoneTypoTolerance(),
    // Atomic stages, one per corroboration signal - address/phone/email/zip each independently
    // sufficient alone; state+city is the one pair that requires both fields together, since
    // neither is trusted alone (see stateAndCity/zipCodeMatches' own doc comment).
    // resolveByStateAndCity/resolveByZipCode each internally check the exact-name tier before the
    // strong (fuzzy) tier, richest evidence first - see their own doc comments. Order among these
    // stages doesn't change outcomes today (real records satisfying one typically satisfy
    // several), but address/phone/email run first as the stronger evidence class.
    resolveByAddress(),
    resolveByPhone(),
    resolveByEmailAddress(),
    resolveByStateAndCity(),
    resolveByZipCode(),
    resolveByCityAndZipCode(),
    // resolveBySoleFuzzyNameMatchAndState's state-only bar is strictly weaker than the stages
    // above's corroboration gates, so it must run after them - it only ever catches what those
    // already declined for lack of city/zip/contact corroboration.
    resolveBySoleFuzzyNameMatchAndState(),
    // Deliberately LAST-RESORT - see resolveBySoleExactNameInState's own doc comment. Every other
    // resolver above (including the weaker fuzzy-tier ones) gets first attempt at a candidate
    // before a unique exact-name match with no other corroborating evidence at all is trusted.
    resolveBySoleExactNameInState(),
  ];
}

/**
 * Runs one discovery stage's candidates through the shared resolve pipeline, in its OWN nested
 * state (see docs/architecture/decision-records/TrusteeMatchingPipeline.md on nesting). Returns the
 * nested result so the caller can inspect whether this tier resolved, and separately, whether its
 * non-resolving candidates are worth merging into a broader pool (see runTrusteeMatchPipeline).
 *
 * Every candidate promoted here already survived discovery-time eviction (see
 * addAndScoreCandidate/shouldEvictFromDiscovery in trustee-match-pipeline-stages.ts) - an oversized
 * candidate pool for a common surname fragment (hundreds of candidates from
 * recallByTokenIntersection/recallByAnchoredLevenshtein's own fuzzy discovery) is cut down to
 * genuinely relevant survivors AT THE MOMENT each candidate is scored, before it ever occupies a
 * Map entry in nestedState.candidates, rather than filtered here after the fact. No promotion
 * filter is needed here: shouldEvictFromDiscovery already reads doesStateMatch directly (only ever
 * set when both sides have real comparable state data) plus the already-computed doesNameMatch as
 * its counterbalancing exception.
 * Every candidate remaining in nestedResult.candidates by the time this loop runs is therefore
 * already known-relevant; promotion here is unconditional.
 */
async function runNestedTier(
  acmsRaw: DxtrTrusteeParty,
  outerState: PipelineState,
  discoveryStage: Stage,
): Promise<PipelineState> {
  const nestedState = createInitialState(acmsRaw);
  // normalizeAcmsSourceName() runs first here too, not just in runTrusteeMatchPipeline's own flow
  // below: createInitialState always starts a fresh sourceNormalized clone (see
  // cloneNormalizableFields), and this nested state is its own object, not a copy of outerState -
  // so outerState.sourceNormalized's own recovered fields would not otherwise propagate into this
  // nested run. Re-running it is cheap (pure, no I/O) and idempotent (see its own doc comment), so
  // paying that cost once per nested tier is preferable to threading outerState's already-
  // normalized fields through as an extra parameter every discoveryStage would need to ignore.
  //
  // Deliberately does NOT also re-run skipAdministrativePlaceholder here - that check is based
  // purely on sourceRaw.fullName (see its own doc comment), which is identical between outerState
  // and every nestedState this function ever creates (both come from the same acmsRaw parameter,
  // passed unchanged by every runNestedTier call site below) - runTrusteeMatchPipeline's own gate,
  // run once before the first runNestedTier call, already covers every nested tier this function
  // will ever run for this record.
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
 * Full discovery-then-resolve sequence. Cheapest and most decisive check
 * first, before any tier runs at all: skipAdministrativePlaceholder detects an ACMS record that
 * names no real person (an administrative placeholder, not a trustee) and short-circuits the whole
 * pipeline with state.skip, since there is no identity here for any discovery tier to usefully
 * search for. Past that gate, two genuinely fast, narrow, high-confidence paths are tried next and
 * short-circuit immediately if they resolve - most records never need anything past this point:
 *
 * 1. surnameExact: cheap (single indexed query), and correct often enough to be worth trying
 *    before any fuzzier/costlier search.
 * 2. matchTrusteeByName's own internal exact-match pass (part of recallByNameThenResolveMatch,
 *    see its doc comment) - a fully-normalized name match against a UNIQUE CAMS trustee.
 *
 * Neither of these blocks the other, or any later tier, from running just because it discovered
 * SOME candidates - only an actual RESOLUTION short-circuits. A same-surname candidate that never
 * corroborates (e.g. "Aldric K. Vossey" for ACMS "Marcus L Vossey") is real evidence of nothing on
 * its own and must not prevent broader tiers from ever getting a chance: a surname-exact hit that
 * never resolves would otherwise silently block matchTrusteeByName's ambiguous pool, which
 * independently finds real corroborated candidates for the same record.
 *
 * If neither fast path resolves, every remaining discovery tier's candidates
 * (recallByNameThenResolveMatch's ambiguous pool, recallByTokenIntersection,
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
    // Cheapest possible check in the whole pipeline, run FIRST - before normalizeAcmsSourceName,
    // not after (see skipAdministrativePlaceholder's own doc comment on why checking the raw,
    // un-atomized name is what makes this check reliable regardless of which field a signal
    // landed in). An administrative placeholder names no real person, so there is nothing for
    // normalization or ANY discovery tier to usefully do - a skip-worthy record never even
    // reaches normalizeAcmsSourceName, let alone the first runNestedTier call. Based purely on
    // outerState.sourceRaw.fullName, which is identical for every runNestedTier call below (all
    // pass the same acmsRaw) - so this one check up front covers every nested tier too, and
    // runNestedTier does not need its own copy of this gate (see its own comment).
    const gateResult = await skipAdministrativePlaceholder()(outerState);
    if (gateResult.skip) {
      outerState.skip = true;
      return outerState;
    }

    // Populates outerState.sourceNormalized before any tier runs, so the top-level state graph
    // carries the recovered name right alongside outerState.sourceRaw's untouched CMMPR copy (see
    // normalizeAcmsSourceName's own doc comment) - every nested tier below also re-normalizes into
    // its own nested state (see runNestedTier), but outerState needs its own copy too since it is
    // what gets persisted/reviewed as this record's evidence.
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

    const matchByNameResult = await runNestedTier(
      acmsRaw,
      outerState,
      recallByNameThenResolveMatch(context),
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
    // Every RECALL tier above is fully error-checked before this point, so combinedResult.error
    // is never actually set today - but resolveStages() is a shared list runNestedTier's own
    // nested runs also use, and a future stage added to it that performs I/O would set it here.
    // Copying it through (not just .match) keeps that failure mode from silently discarding an
    // error the caller needs to rethrow or persist.
    outerState.error = combinedResult.error;
    return outerState;
  } catch (originalError) {
    outerState.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: { module: MODULE_NAME, message: 'runTrusteeMatchPipeline failed' },
    });
    return outerState;
  }
}
