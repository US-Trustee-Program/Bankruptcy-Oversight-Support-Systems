import { CandidateScore, DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import { NameMatchQuality } from './trustee-match.helpers';

/**
 * Projection of Trustee down to the fields matching actually reads, via Pick rather than Omit -
 * an Omit-based projection silently widens back to the full shape every time Trustee grows a new
 * field, which is exactly the coupling this projection exists to avoid. Keeps a candidate's raw
 * record symmetric with acmsRaw (both lean, matching-relevant shapes) rather than carrying the
 * full ORM-shaped Trustee (audit fields, oversight assignments, staff, appointments) through the
 * pipeline. This is the ONLY Trustee-shaped type pipeline internals traffic in - projectTrustee is
 * the single conversion point where a real Trustee becomes pipeline data; everything past that
 * point (addCandidate, promoteCandidate, every stage) reads and writes ProjectedTrustee only.
 */
export type ProjectedTrustee = Pick<
  Trustee,
  'trusteeId' | 'firstName' | 'middleName' | 'lastName' | 'name'
> & {
  address?: Trustee['public']['address'];
  phone?: Trustee['public']['phone'];
};

export function projectTrustee(trustee: Trustee): ProjectedTrustee {
  return {
    trusteeId: trustee.trusteeId,
    firstName: trustee.firstName,
    middleName: trustee.middleName,
    lastName: trustee.lastName,
    name: trustee.name,
    address: trustee.public?.address,
    phone: trustee.public?.phone,
  };
}

/**
 * One scorer's independent contribution to a candidate's evaluation history - a uniform vocabulary
 * every scorer speaks, regardless of what it actually measures (a name comparison, a state check,
 * an address/phone corroboration lookup, a digit-distance calculation). `value` is always
 * "higher is better" on a 0-100 scale (a scorer whose natural signal is the opposite polarity,
 * e.g. phoneDigitDistance where 0 is the best outcome, converts to this convention rather than
 * introducing a second polarity every consumer would need to special-case - see
 * trustee-match-pipeline-stages.ts's phoneDigitDistance usage). `threshold` is the cutoff active
 * AT THE TIME this record was produced, persisted alongside the value/pass it produced rather than
 * left implicit - a threshold constant can be retuned later, and a persisted record should remain
 * self-explaining about what it meant when it was written, not silently reinterpreted against
 * today's constant. `pass` is threshold vs value, computed once at scoring time (value>=threshold)
 * rather than re-derived by every reader. Extra stage-specific fields beyond these three are
 * allowed (e.g. a raw phoneDigitDistance count alongside the derived value) when that raw signal
 * is independently useful to a reviewer.
 */
export type ScoreRecord = {
  value: number;
  threshold: number;
  pass: boolean;
} & Record<string, unknown>;

/**
 * A candidate's full evaluation history, keyed by scorer name - direct lookup by a well-known key
 * (e.g. scores.calculateNameScore) without a scan, while every value speaks the same ScoreRecord
 * vocabulary regardless of which scorer produced it. A scorer with more than one independent
 * signal (e.g. contact corroboration's address AND phone checks) uses multiple keys
 * (contactCorroborationAddress, contactCorroborationPhone) rather than bundling unrelated
 * value/threshold/pass triples into one entry. A stage that runs more than once against the same
 * candidate overwrites its own key(s) rather than accumulating duplicates (see addScore).
 */
export type ScoreByScorer = Record<string, ScoreRecord>;

/**
 * One candidate under consideration, plus its evaluation history. camsRaw is set once when the
 * candidate is first proposed and never changes; camsNormalized is a memo of normalizer function
 * calls (see NormalizedMemo/normalize) - it holds ONLY derived/computed values, never a copy of
 * camsRaw itself (camsRaw is already available directly on the candidate); scores holds one
 * ScoreRecord per scorer key that has run against this candidate (see ScoreByScorer/addScore).
 */
export type PipelineCandidate = {
  camsRaw: ProjectedTrustee;
  camsNormalized: NormalizedMemo;
  scores: ScoreByScorer;
};

/**
 * Reads a candidate's full score history - already a flat, uniformly-shaped Record keyed by
 * scorer name, so there is nothing to merge/flatten (unlike the pre-ScoreRecord design, where each
 * scorer had its own bespoke field shape and had to be Object.assign-ed into one view). Kept as a
 * named function rather than inlining `candidate.scores` at every call site so a future change to
 * how scores are read (e.g. last-write-wins across a re-run) has one place to change.
 */
export function mergedScore(candidate: PipelineCandidate): ScoreByScorer {
  return candidate.scores;
}

/** matchTrusteeByName's exact-resolved outcome carries only its own confidence signals (see
 * trustee-match.helpers.ts's NameMatchResult 'resolved' case) - it resolves on name alone, with no
 * contact corroboration, so it has no address/phone/email score to report. */
export type NameOnlyMatchScore = {
  nameScore: number;
  nameMatchQuality: NameMatchQuality;
};

/**
 * A confirmed match, carrying the score that justified it rather than just a trusteeId - a
 * consumer should never need to re-scan the candidate's score history to answer "why was this the
 * match". `score` is whichever real outcome type actually produced this match - a CandidateScore
 * from corroborationStage's resolveByContactCorroboration/resolveDuplicateNameCandidates (contact
 * fields scored alongside name), a NameOnlyMatchScore from matchTrusteeByName's own exact-resolved
 * path (name alone, no corroboration attempted), or the winning candidate's own ScoreByScorer from
 * a stage that resolves by comparing/aggregating scorers directly (e.g.
 * comparativeCorroborationStage, phoneTypoToleranceStage) - never a single ScoreRecord, since a
 * resolving stage's justification is usually more than one scorer's contribution.
 */
export type PipelineMatch = {
  trusteeId: string;
  score: CandidateScore | NameOnlyMatchScore | ScoreByScorer | Record<string, never>;
};

/**
 * The shared state every pipeline stage reads and returns. See
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md for the full rationale: stages
 * are free to add candidates or append to a candidate's score history in any order (never
 * removing a candidate), and every stage - regardless of what it would otherwise do - must no-op
 * once `match` or `skip` is set (see withGuard). `error` is a distinct terminal signal from
 * `skip`: `skip` means "no real identity to match at all" (a valid, non-exceptional outcome);
 * `error` means something went wrong attempting to evaluate this record.
 */
export type PipelineState = {
  acmsRaw: DxtrTrusteeParty;
  acmsNormalized: NormalizedMemo;
  candidates: Map<string, PipelineCandidate>;
  match: PipelineMatch | null;
  skip: boolean;
  error: unknown | null;
};

export function createInitialState(acmsRaw: DxtrTrusteeParty): PipelineState {
  return {
    acmsRaw,
    acmsNormalized: new Map(),
    candidates: new Map(),
    match: null,
    skip: false,
    error: null,
  };
}

/**
 * Adds a candidate to the pipeline state if not already present (by trusteeId), or returns the
 * existing entry unchanged if it is - this is the ONLY way a NEW candidate enters the state, and
 * it is idempotent by design: a discovery stage that finds the same trustee another stage already
 * proposed must never reset that candidate's accumulated score history. Takes a ProjectedTrustee,
 * not a raw Trustee - callers project at the true boundary (see projectTrustee) rather than
 * passing a full Trustee through the pipeline.
 */
export function addCandidate(state: PipelineState, camsRaw: ProjectedTrustee): PipelineCandidate {
  const existing = state.candidates.get(camsRaw.trusteeId);
  if (existing) return existing;

  const candidate: PipelineCandidate = {
    camsRaw,
    camsNormalized: new Map(),
    scores: {},
  };
  state.candidates.set(camsRaw.trusteeId, candidate);
  return candidate;
}

/**
 * Merges a candidate produced by a NESTED pipeline run (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md on nesting: a stage may run its
 * own scoped discovery-then-filter pipeline internally and promote only the survivors) into the
 * outer state, preserving that candidate's full inner score history rather than discarding it -
 * the inner tier's reasoning for why this candidate survived its own quality bar is exactly the
 * kind of evidence a later reviewer needs, so it is carried forward, not re-derived from scratch.
 * Idempotent like addCandidate: promoting a trusteeId already present in the outer state is a
 * no-op that returns the outer state's existing entry unchanged.
 */
export function promoteCandidate(
  state: PipelineState,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const existing = state.candidates.get(candidate.camsRaw.trusteeId);
  if (existing) return existing;

  state.candidates.set(candidate.camsRaw.trusteeId, candidate);
  return candidate;
}

/** Records (or overwrites) a scorer's contribution to a candidate's history - see
 * ScoreByScorer/ScoreRecord. Keyed by scorer name, so a stage that runs more than once
 * against the same candidate overwrites its own prior slot rather than accumulating duplicates. */
export function addScore(candidate: PipelineCandidate, scorer: string, score: ScoreRecord): void {
  candidate.scores[scorer] = score;
}

/**
 * One cached call of a normalizer function: `key` is a caller-built fingerprint of that call's
 * actual input(s) (e.g. `"John Doe"`, or `"John Doe|Jon Doe"` for a two-argument comparison), and
 * `value` is what it returned. Fingerprinting the real inputs - not just the function's name - is
 * what makes two DIFFERENT calls to the same normalizer against the same memo distinguishable; a
 * memo keyed by function name alone cannot tell "already computed for these inputs" apart from
 * "computed once for different inputs" and would silently return the wrong cached value.
 */
export type MemoEntry = { key: string; value: unknown };

/**
 * A per-side memo (ACMS or a specific candidate) of every normalizer call made against it,
 * organized by function name - each function name maps to the list of distinct-fingerprint calls
 * made so far (see MemoEntry/normalize). Keying the outer map by function name (rather than by the
 * fingerprint directly) is what gives a downstream consumer (e.g. ai-candidate-review.ts) a
 * stable, well-known name to look under - "this candidate's fullNameSimilarity entries" - without
 * needing to know what inputs produced them.
 */
export type NormalizedMemo = Map<string, MemoEntry[]>;

/**
 * Memoizes one normalizer call keyed by function name AND a caller-built fingerprint of its actual
 * input(s) (see MemoEntry) - computed once per distinct fingerprint, read directly from the memo on
 * every later call with that same fingerprint regardless of which stage asks. A normalizer that
 * depends on another normalizer's output calls this recursively for that dependency rather than
 * recomputing it inline (see docs/architecture/decision-records/TrusteeMatchingPipeline.md).
 */
export function normalize<T>(
  memo: NormalizedMemo,
  functionName: string,
  fingerprint: string,
  compute: () => T,
): T {
  const entries = memo.get(functionName) ?? [];
  const existing = entries.find((entry) => entry.key === fingerprint);
  if (existing) return existing.value as T;

  const value = compute();
  entries.push({ key: fingerprint, value });
  memo.set(functionName, entries);
  return value;
}

export type Stage = (state: PipelineState) => Promise<PipelineState>;

/**
 * The uniform guard every stage begins with: once the pipeline has collapsed to a terminal
 * outcome (a match or a skip), every later stage no-ops regardless of what work it would
 * otherwise do. Wrapping a stage body in this guard is how a new stage gets this behavior for
 * free, rather than every stage author re-implementing the same check inline.
 */
export function withGuard(stage: Stage): Stage {
  return async (state) => {
    if (state.match || state.skip) return state;
    return stage(state);
  };
}

/** Runs an ordered list of stages left to right, threading the same state through each -
 * stage order affects only how quickly the pipeline reaches a terminal outcome, never which
 * outcome it can reach (see docs/architecture/decision-records/TrusteeMatchingPipeline.md). */
export async function runPipeline(
  initialState: PipelineState,
  stages: Stage[],
): Promise<PipelineState> {
  let state = initialState;
  for (const stage of stages) {
    state = await stage(state);
  }
  return state;
}

/** JSON-serializable projection of PipelineCandidate - Maps become plain objects. camsNormalized
 * keeps its full { functionName: MemoEntry[] } shape rather than collapsing to a single value per
 * function name - a reviewer/consumer reading this sees exactly which fingerprinted call(s) were
 * made, never an ambiguous flattened result. scores is already a plain object (ScoreByScorer), so
 * it passes through serializeState unchanged. */
export type SerializedCandidate = {
  camsRaw: ProjectedTrustee;
  camsNormalized: Record<string, MemoEntry[]>;
  scores: ScoreByScorer;
};

/** JSON-serializable projection of PipelineState - Maps become plain objects/arrays so the state
 * can be written to a JSONL file or a Mongo document for later review (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md: the full evaluation history is
 * retained even after a terminal outcome, specifically so it remains inspectable). candidates
 * becomes an array (order of discovery, not lookup, is what a reviewer scans), acmsNormalized/
 * camsNormalized become plain objects (Object.fromEntries over the memo Map) - see
 * SerializedCandidate for why each function name maps to an array rather than a single value. */
export type SerializedState = {
  acmsRaw: DxtrTrusteeParty;
  acmsNormalized: Record<string, MemoEntry[]>;
  candidates: SerializedCandidate[];
  match: PipelineMatch | null;
  skip: boolean;
  error: unknown | null;
};

export function serializeState(state: PipelineState): SerializedState {
  return {
    acmsRaw: state.acmsRaw,
    acmsNormalized: Object.fromEntries(state.acmsNormalized),
    candidates: [...state.candidates.values()].map((candidate) => ({
      camsRaw: candidate.camsRaw,
      camsNormalized: Object.fromEntries(candidate.camsNormalized),
      scores: candidate.scores,
    })),
    match: state.match,
    skip: state.skip,
    error: state.error,
  };
}
