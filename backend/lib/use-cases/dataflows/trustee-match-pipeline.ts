import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import { CamsError } from '../../common-errors/cams-error';

/** The only Trustee-shaped type pipeline internals read or write. Pick rather than Omit so a new
 * Trustee field doesn't silently widen this back to the full shape. */
export type ProjectedTrustee = Pick<
  Trustee,
  'trusteeId' | 'firstName' | 'middleName' | 'lastName' | 'name'
> & {
  address?: Trustee['public']['address'];
  phone?: Trustee['public']['phone'];
  email?: Trustee['public']['email'];
};

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
 * Three-valued (Kleene K3) logic: true = agrees, false = conflicts, null = neutral (the question
 * was considered and there was nothing to compare, e.g. one side has no data).
 */
export type KleeneBoolean = boolean | null;

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
 * One scorer's contribution to a candidate's evaluation history. `pass` is the whole record for a
 * scorer whose comparison is a plain yes/no; one with more to say extends it (e.g. doesNameMatch's
 * quality, doesAddressMatch's points).
 */
export type ScoreRecord = { pass: boolean } & Record<string, unknown>;

/**
 * A candidate's full evaluation history, keyed by scorer name (see addScore). A scorer whose
 * comparison is neutral writes no record, so a missing key means neutral and `pass` never has to
 * mean "unknown".
 */
export type ScoreByScorer = Record<string, ScoreRecord>;

/**
 * The normalized shape of either side of a match, under ProjectedTrustee's field names. Partial
 * since a normalizer populates only the fields it derives; omits trusteeId since a source record
 * has no CAMS identity.
 *
 * - lastNameAlternates: other plausible surname reductions beyond `lastName` ("DE BRUCE WOLFF" ->
 *   "de bruce", alternate "wolff").
 * - firstNameAlternates: a parenthetical recorded alongside the first name. An office code there is
 *   harmless; it never matches anything on the other side.
 * - middleNameAlternates: the individual tokens of a multi-token middle name, which `middleName`
 *   stores glued together ("L. Pry" -> "lpry"). Empty unless there is more than one token.
 */
type NormalizedTrusteeFields = Partial<Omit<ProjectedTrustee, 'trusteeId' | 'address'>> & {
  address?: Partial<NonNullable<ProjectedTrustee['address']>>;
  firstNameAlternates?: string[];
  middleNameAlternates?: string[];
  lastNameAlternates?: string[];
};

/**
 * Processing state carried alongside a normalized record, not normalization output: raw
 * passthroughs a later stage reads (legacy, fullName) and cached computations
 * (acmsHasNoContactData).
 */
type TrusteeNormalizationCache = {
  legacy?: NonNullable<CanonicalTrusteeSource['legacy']>;
  fullName?: string;
  acmsHasNoContactData?: boolean;
};

/** Either side of a match after normalization, plus its processing cache. */
export type NormalizedTrustee = NormalizedTrusteeFields & TrusteeNormalizationCache;

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

/** A candidate's score history. */
export function mergedScore<TCandidate>(candidate: PipelineCandidate<TCandidate>): ScoreByScorer {
  return candidate.scores;
}

/** The candidate pool as a list; state.candidates is a Map keyed by trusteeId for deduplication. */
export function candidatePool<TSource, TCandidate>(
  state: PipelineState<TSource, TCandidate>,
): PipelineCandidate<TCandidate>[] {
  return [...state.candidates.values()];
}

/** A confirmed match, with the matched candidate's scores and the name of the RESOLVE stage that
 * chose it. */
type PipelineMatch = {
  trusteeId: string;
  score: ScoreByScorer;
  resolvedBy: string;
};

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

/** One cached call; `key` fingerprints its input(s), e.g. `"John Doe|Jon Doe"`. */
export type MemoEntry = { key: string; value: unknown };

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

/** JSON-serializable PipelineCandidate: memo becomes a plain object. */
export type SerializedCandidate<TCandidate> = {
  camsRaw: TCandidate;
  camsNormalized: NormalizedTrustee;
  memo: Record<string, MemoEntry[]>;
  scores: ScoreByScorer;
  origin: string;
};

/** JSON-serializable PipelineState: memo becomes a plain object and candidates an array in
 * discovery order. */
export type SerializedState<TSource, TCandidate> = {
  sourceRaw: TSource;
  sourceNormalized: NormalizedTrustee;
  memo: Record<string, MemoEntry[]>;
  candidates: SerializedCandidate<TCandidate>[];
  match: PipelineMatch | null;
  skip: boolean;
  error: CamsError | null;
};

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
    error: state.error,
  };
}

/** Trustee-matching instantiations of the generic pipeline types. */
export type TrusteePipelineCandidate = PipelineCandidate<ProjectedTrustee>;
export type TrusteePipelineState = PipelineState<CanonicalTrusteeSource, ProjectedTrustee>;
export type TrusteeStage = Stage<CanonicalTrusteeSource, ProjectedTrustee>;
export type TrusteeSerializedState = SerializedState<CanonicalTrusteeSource, ProjectedTrustee>;

/** Creates the initial trustee pipeline state for one source record. */
export function createTrusteeInitialState(sourceRaw: CanonicalTrusteeSource): TrusteePipelineState {
  return createInitialState<CanonicalTrusteeSource, ProjectedTrustee>(sourceRaw);
}
