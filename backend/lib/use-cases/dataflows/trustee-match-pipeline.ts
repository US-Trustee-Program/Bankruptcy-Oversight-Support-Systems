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
 * nameScoreStage's contribution (see trustee-match-pipeline-stages.ts) - calculateNameScore's
 * result plus whether it cleared the auto-link threshold.
 */
export type NameScoreEntry = {
  nameScore: number;
  match: boolean;
};

/**
 * stateFilterStage's contribution (see trustee-match-pipeline-stages.ts) - whether this
 * candidate's state agrees with the ACMS record's state, or was excused from the check (small
 * pool, unparseable ACMS address, exact phone match, or a high enough nameScore override).
 */
export type StateFilterScoreEntry = {
  stateMatch: boolean;
};

/**
 * comparativeCorroborationStage's contribution (see trustee-match-pipeline-stages.ts) - this
 * candidate's own address/phone corroboration against the ACMS record, alongside the nameScore
 * that made it eligible for comparison in the first place. nameScore is COPIED FORWARD from
 * calculateNameScore's own entry (not recomputed) so this one entry is self-contained - a reviewer
 * reading contactCorroborationScore alone sees the full name+address+phone picture that informed
 * this stage's decision, without needing to cross-reference calculateNameScore's separate entry.
 */
export type ContactCorroborationScoreEntry = {
  nameScore: number;
  addressScore: number;
  phoneScore: number | null;
};

/**
 * Every known scorer's contribution shape, keyed by the scorer's own name - a closed map of
 * exactly the scorers that exist today. A new stage adds its own key/shape pair here; every
 * switch/narrowing consumer (see mergedScore) then requires that new case to be handled
 * deliberately rather than silently accepting an arbitrary payload shape. Keying by scorer name
 * (rather than an array of {scorer, ...fields} tags) makes a re-run of the same stage naturally
 * idempotent - it overwrites its own slot instead of appending a duplicate entry - and makes
 * "what did scorer X conclude" a direct lookup instead of a scan.
 */
export type ScoreEntryByScorer = {
  calculateNameScore: NameScoreEntry;
  stateFilterStage: StateFilterScoreEntry;
  contactCorroborationScore: ContactCorroborationScoreEntry;
};

export type ScorerName = keyof ScoreEntryByScorer;

/** A candidate's full evaluation history: one slot per scorer that has run against it. Never all
 * scorers are guaranteed present (see mergedScore). */
export type ScoreByScorer = Partial<ScoreEntryByScorer>;

/** The cumulative view of every scorer's fields flattened into one object, for consumers that
 * only care about a specific field's current value regardless of which scorer set it (see
 * mergedScore). All fields optional since no single candidate is guaranteed to have been touched
 * by every scorer. */
export type MergedScore = Partial<NameScoreEntry> &
  Partial<StateFilterScoreEntry> &
  Partial<ContactCorroborationScoreEntry>;

/**
 * One candidate under consideration, plus its evaluation history. camsRaw is set once when the
 * candidate is first proposed and never changes; camsNormalized is a memo of normalizer function
 * calls (see NormalizedMemo/normalize) - it holds ONLY derived/computed values, never a copy of
 * camsRaw itself (camsRaw is already available directly on the candidate); scores holds one slot
 * per scorer that has run against this candidate (see ScoreByScorer/addScore) - see mergedScore
 * for how pipeline logic reads a single flattened view out of the full history.
 */
export type PipelineCandidate = {
  camsRaw: ProjectedTrustee;
  camsNormalized: NormalizedMemo;
  scores: ScoreByScorer;
};

/**
 * Flattens a candidate's per-scorer score history into ONE merged view for pipeline
 * decision-making: every scorer's fields are combined into a single object, so a consumer that
 * only cares about e.g. stateMatch doesn't need to know stateFilterStage specifically produced it.
 * The per-scorer ScoreByScorer map remains the audit trail (which scorer set which value); this
 * merged view is derived, never stored.
 */
export function mergedScore(candidate: PipelineCandidate): MergedScore {
  return Object.assign({}, ...Object.values(candidate.scores));
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
 * path (name alone, no corroboration attempted), or a ContactCorroborationScoreEntry from
 * comparativeCorroborationStage's own tie-break (see ScoreEntryByScorer) - never a ScoreEntry (see
 * mergedScore), since every real producer scores a broader or narrower set of fields than any
 * single ScoreEntry case carries.
 */
export type PipelineMatch = {
  trusteeId: string;
  score:
    CandidateScore | NameOnlyMatchScore | ContactCorroborationScoreEntry | Record<string, never>;
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
 * ScoreEntryByScorer/mergedScore. Keyed by scorer name, so a stage that runs more than once
 * against the same candidate overwrites its own prior slot rather than accumulating duplicates. */
export function addScore<Name extends ScorerName>(
  candidate: PipelineCandidate,
  scorer: Name,
  score: ScoreEntryByScorer[Name],
): void {
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
