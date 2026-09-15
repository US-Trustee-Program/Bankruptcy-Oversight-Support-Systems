import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Address, PhoneNumber } from '@common/cams/contact';
import { Trustee } from '@common/cams/trustees';

/**
 * Projection of Trustee down to the fields matching actually reads - keeps a candidate's raw
 * record symmetric with acmsRaw (both lean, matching-relevant shapes) rather than carrying the
 * full ORM-shaped Trustee (audit fields, oversight assignments, staff, appointments) through the
 * pipeline untouched.
 */
export type ProjectedTrustee = {
  trusteeId: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  name: string;
  address?: Address;
  phone?: PhoneNumber;
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
 * One stage's contribution to a candidate's evaluation history. `scorer` is passive attribution -
 * which function/stage produced this entry - never used for control flow, only for the audit
 * trail (see PipelineCandidate.scores). Remaining fields are whatever metrics that scorer
 * computed; a scorer only writes the keys it actually computed; every prior key from earlier
 * scores in the same candidate's history keeps its last-written value in the MERGED view (see
 * mergedScore) even though this individual entry doesn't repeat it.
 */
export type ScoreEntry = { scorer: string } & Record<string, unknown>;

/**
 * One candidate under consideration, plus its append-only evaluation history. camsRaw is set once
 * when the candidate is first proposed and never changes; camsNormalized is a memo of on-demand
 * normalizations keyed by normalizer name (see memoize); scores is append-only - see mergedScore
 * for how pipeline logic reads a single current view out of the full history.
 */
export type PipelineCandidate = {
  camsRaw: ProjectedTrustee;
  camsNormalized: Map<string, unknown>;
  scores: ScoreEntry[];
};

/**
 * Reduces a candidate's full score history down to ONE merged view for pipeline decision-making:
 * later entries' keys override earlier entries' keys (last write wins per key), but a key an
 * earlier entry set and a later entry never touched is NOT lost - this is what lets one stage
 * contribute just e.g. {stateMismatch: true} without also having to recompute and re-carry
 * forward nameScore from an earlier stage. The full scores array remains the audit trail (which
 * scorer set which value and when); this merged view is derived, never stored.
 */
export function mergedScore(candidate: PipelineCandidate): Record<string, unknown> {
  return Object.assign({}, ...candidate.scores);
}

/**
 * A confirmed match, carrying the score that justified it (see mergedScore) rather than just a
 * trusteeId - a consumer should never need to re-scan the candidate's score history to answer
 * "why was this the match".
 */
export type PipelineMatch = {
  trusteeId: string;
  score: Record<string, unknown>;
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
  acmsNormalized: Map<string, unknown>;
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
 * existing entry unchanged if it is - this is the ONLY way a candidate enters the state, and it
 * is idempotent by design: a discovery stage that finds the same trustee another stage already
 * proposed must never reset that candidate's accumulated score history.
 */
export function addCandidate(state: PipelineState, trustee: Trustee): PipelineCandidate {
  const existing = state.candidates.get(trustee.trusteeId);
  if (existing) return existing;

  const candidate: PipelineCandidate = {
    camsRaw: projectTrustee(trustee),
    camsNormalized: new Map(),
    scores: [],
  };
  state.candidates.set(trustee.trusteeId, candidate);
  return candidate;
}

/** Appends a new score entry to a candidate's history - see ScoreEntry/mergedScore. Never
 * overwrites or removes a prior entry. */
export function addScore(candidate: PipelineCandidate, score: ScoreEntry): void {
  candidate.scores.push(score);
}

/**
 * Memoizes a per-side normalization (ACMS or a specific candidate) keyed by normalizer name -
 * computed once on first access, read directly from the memo on every later access regardless of
 * which stage asks. A normalizer that depends on another normalizer's output calls this
 * recursively for that dependency rather than recomputing it inline (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md).
 */
export function normalize<T>(memo: Map<string, unknown>, key: string, compute: () => T): T {
  if (!memo.has(key)) {
    memo.set(key, compute());
  }
  return memo.get(key) as T;
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
