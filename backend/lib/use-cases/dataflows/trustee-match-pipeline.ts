import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import {
  KleeneBoolean,
  MemoEntry,
  NormalizedTrustee,
  PipelineMatch,
  ProjectedTrustee,
  ScoreByScorer,
  ScoreRecord,
  SerializedState,
} from '@common/cams/trustee-match-pipeline';
import { SerializedCamsError } from '@common/cams/serialized-cams-error';
import { CamsError } from '../../common-errors/cams-error';

export type {
  KleeneBoolean,
  MemoEntry,
  NormalizedTrustee,
  ProjectedTrustee,
  ScoreByScorer,
  ScoreRecord,
  SerializedCandidate,
  SerializedState,
  TrusteeSerializedState,
} from '@common/cams/trustee-match-pipeline';

/** The sole conversion point from a full Trustee to a ProjectedTrustee. */
export function projectTrustee(trustee: Trustee): ProjectedTrustee {
  return {
    trusteeId: trustee.trusteeId,
    firstName: trustee.firstName,
    middleName: trustee.middleName,
    lastName: trustee.lastName,
    name: trustee.name,
    address: trustee.public?.address,
    phone: trustee.public?.phone,
    email: trustee.public?.email,
  };
}

/**
 * Runs exactly one of three lambdas, selected by the value. Preferred over `if (!value)`, which
 * treats a recorded conflict (`false`) the same as neutral (`null`).
 */
export function foldKleene<T>(
  value: KleeneBoolean,
  onNeutral: () => T,
  onAgreement: () => T,
  onConflict: () => T,
): T {
  if (value === null) return onNeutral();
  return value ? onAgreement() : onConflict();
}

/**
 * One candidate under consideration, plus its evaluation history. camsRaw never changes; origin is
 * the RECALL stage that first discovered the candidate.
 */
export type PipelineCandidate<TCandidate> = {
  camsRaw: TCandidate;
  camsNormalized: NormalizedTrustee;
  memo: NormalizedMemo;
  scores: ScoreByScorer;
  origin: string;
};

/** The candidate pool as a list; state.candidates is a Map keyed by trusteeId for deduplication. */
export function candidatePool<TSource, TCandidate>(
  state: PipelineState<TSource, TCandidate>,
): PipelineCandidate<TCandidate>[] {
  return [...state.candidates.values()];
}

/**
 * The state every pipeline stage reads and returns (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md). Once `match`, `skip`, or `error`
 * is set, runPipeline invokes no later stage. `skip` means the source names no real identity to
 * match; it is not an error.
 */
export type PipelineState<TSource, TCandidate> = {
  sourceRaw: TSource;
  sourceNormalized: NormalizedTrustee;
  memo: NormalizedMemo;
  candidates: Map<string, PipelineCandidate<TCandidate>>;
  match: PipelineMatch | null;
  skip: boolean;
  error: CamsError | null;
};

/**
 * Seeds a normalized record as a copy of the raw record's passthrough fields, so normalizers can
 * mutate it without touching the raw record. Excludes `address` and `name`: both are computed and
 * cached on first use, keyed on being undefined.
 */
function cloneNormalizableFields<TRaw extends Partial<NormalizedTrustee>>(
  raw: TRaw,
): NormalizedTrustee {
  return {
    firstName: raw.firstName,
    middleName: raw.middleName,
    lastName: raw.lastName,
    phone: raw.phone,
    email: raw.email,
    legacy: raw.legacy,
    fullName: raw.fullName,
  };
}

function createInitialState<TSource extends Partial<NormalizedTrustee>, TCandidate>(
  sourceRaw: TSource,
): PipelineState<TSource, TCandidate> {
  return {
    sourceRaw,
    sourceNormalized: cloneNormalizableFields(sourceRaw),
    memo: new Map(),
    candidates: new Map(),
    match: null,
    skip: false,
    error: null,
  };
}

/** Adds a candidate to the pool, or returns the existing entry unchanged if its trusteeId is
 * already present, preserving its score history and origin. */
export function addCandidate<TSource, TCandidate extends Partial<NormalizedTrustee>>(
  state: PipelineState<TSource, TCandidate>,
  camsRaw: TCandidate & { trusteeId: string },
  origin: string,
): PipelineCandidate<TCandidate> {
  const existing = state.candidates.get(camsRaw.trusteeId);
  if (existing) return existing;

  const candidate: PipelineCandidate<TCandidate> = {
    camsRaw,
    camsNormalized: cloneNormalizableFields(camsRaw),
    memo: new Map(),
    scores: {},
    origin,
  };
  state.candidates.set(camsRaw.trusteeId, candidate);
  return candidate;
}

/** Merges a candidate from a nested pipeline run into the outer state, preserving its score
 * history. Idempotent like addCandidate. */
export function promoteCandidate<TSource, TCandidate extends { trusteeId: string }>(
  state: PipelineState<TSource, TCandidate>,
  candidate: PipelineCandidate<TCandidate>,
): PipelineCandidate<TCandidate> {
  const existing = state.candidates.get(candidate.camsRaw.trusteeId);
  if (existing) return existing;

  state.candidates.set(candidate.camsRaw.trusteeId, candidate);
  return candidate;
}

/** Records a scorer's result under its name, overwriting any earlier result for that name. */
export function addScore<TCandidate>(
  candidate: PipelineCandidate<TCandidate>,
  scorer: string,
  score: ScoreRecord,
): void {
  candidate.scores[scorer] = score;
}

/** A per-side memo (source record or one candidate) of cached calls, keyed by function name. */
export type NormalizedMemo = Map<string, MemoEntry[]>;

/** Computes a value once per function name and input fingerprint. */
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

/** A pool-level pipeline stage. Pure, except that a RECALL stage queries the repository; a failed
 * query lands on state.error rather than throwing. */
export type Stage<TSource, TCandidate> = (
  state: PipelineState<TSource, TCandidate>,
) => Promise<PipelineState<TSource, TCandidate>>;

/** Runs stages in order, stopping at the first match, skip, or error. The only place that checks
 * for a terminal outcome, so individual stages never do. */
export async function runPipeline<TSource, TCandidate>(
  initialState: PipelineState<TSource, TCandidate>,
  stages: Stage<TSource, TCandidate>[],
): Promise<PipelineState<TSource, TCandidate>> {
  let state = initialState;
  for (const stage of stages) {
    if (state.match || state.skip || state.error) break;
    state = await stage(state);
  }
  return state;
}

/** Converts a PipelineState to its SerializedState. */
export function serializeState<TSource, TCandidate>(
  state: PipelineState<TSource, TCandidate>,
): SerializedState<TSource, TCandidate> {
  return {
    sourceRaw: state.sourceRaw,
    sourceNormalized: state.sourceNormalized,
    memo: Object.fromEntries(state.memo),
    candidates: [...state.candidates.values()].map((candidate) => ({
      camsRaw: candidate.camsRaw,
      camsNormalized: candidate.camsNormalized,
      memo: Object.fromEntries(candidate.memo),
      scores: candidate.scores,
      origin: candidate.origin,
    })),
    match: state.match,
    skip: state.skip,
    error: state.error && serializeError(state.error),
  };
}

/** Copies only the persistable fields, dropping camsStack and isCamsError. */
function serializeError(error: CamsError): SerializedCamsError {
  return {
    message: error.message,
    module: error.module,
    status: error.status,
    originalError: error.originalError,
    data: error.data,
  };
}

/** Trustee-matching instantiations of the generic pipeline types. */
export type TrusteePipelineCandidate = PipelineCandidate<ProjectedTrustee>;
export type TrusteePipelineState = PipelineState<CanonicalTrusteeSource, ProjectedTrustee>;
export type TrusteeStage = Stage<CanonicalTrusteeSource, ProjectedTrustee>;

/** Creates the initial trustee pipeline state for one source record. */
export function createTrusteeInitialState(sourceRaw: CanonicalTrusteeSource): TrusteePipelineState {
  return createInitialState<CanonicalTrusteeSource, ProjectedTrustee>(sourceRaw);
}
