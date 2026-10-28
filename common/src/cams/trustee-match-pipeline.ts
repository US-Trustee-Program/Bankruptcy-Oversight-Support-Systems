import { CanonicalTrusteeSource } from './dataflow-events';
import { SerializedCamsError } from './serialized-cams-error';
import { Trustee } from './trustees';

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

/**
 * Three-valued (Kleene K3) logic: true = agrees, false = conflicts, null = neutral (the question
 * was considered and there was nothing to compare, e.g. one side has no data).
 */
export type KleeneBoolean = boolean | null;

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

/** One cached call; `key` fingerprints its input(s), e.g. `"John Doe|Jon Doe"`. */
export type MemoEntry = { key: string; value: unknown };

/** A confirmed match, with the matched candidate's scores and the name of the RESOLVE stage that
 * chose it. */
export type PipelineMatch = {
  trusteeId: string;
  score: ScoreByScorer;
  resolvedBy: string;
};

/** JSON-serializable PipelineCandidate: memo becomes a plain object. */
export type SerializedCandidate<TCandidate> = {
  camsRaw: TCandidate;
  camsNormalized: NormalizedTrustee;
  memo: Record<string, MemoEntry[]>;
  scores: ScoreByScorer;
  origin: string;
};

/** JSON-serializable PipelineState: memo becomes a plain object, candidates an array in discovery
 * order, and error a SerializedCamsError, since common cannot import CamsError. */
export type SerializedState<TSource, TCandidate> = {
  sourceRaw: TSource;
  sourceNormalized: NormalizedTrustee;
  memo: Record<string, MemoEntry[]>;
  candidates: SerializedCandidate<TCandidate>[];
  match: PipelineMatch | null;
  skip: boolean;
  error: SerializedCamsError | null;
};

export type TrusteeSerializedState = SerializedState<CanonicalTrusteeSource, ProjectedTrustee>;

const NAME_QUALITY_RANK: Record<string, number> = { exact: 0, strong: 1, weak: 2 };

function nameQualityRank(scores: ScoreByScorer): number {
  const score = scores.doesNameMatch;
  if (!score?.pass) return Number.MAX_SAFE_INTEGER;
  return NAME_QUALITY_RANK[score.quality as string] ?? Number.MAX_SAFE_INTEGER;
}

function addressPoints(scores: ScoreByScorer): number {
  return (scores.doesAddressMatch?.points as number | undefined) ?? 0;
}

/** Sort comparator: the better doesNameMatch grade first (exact, strong, weak, then a failure). */
export function compareByNameQuality(a: ScoreByScorer, b: ScoreByScorer): number {
  return nameQualityRank(a) - nameQualityRank(b);
}

/** Sort comparator: the pipeline's ranking - more doesAddressMatch points first, ties broken by
 * compareByNameQuality. Shared so the pipeline and the identity task UI agree on rank order. */
export function compareByAddressPointsThenNameQuality(a: ScoreByScorer, b: ScoreByScorer): number {
  return addressPoints(b) - addressPoints(a) || compareByNameQuality(a, b);
}

/** A copy of the candidates in pipeline rank order (compareByAddressPointsThenNameQuality); a
 * tie keeps discovery order. */
export function rankCandidates<TCandidate>(
  candidates: SerializedCandidate<TCandidate>[],
): SerializedCandidate<TCandidate>[] {
  return [...candidates].sort((a, b) => compareByAddressPointsThenNameQuality(a.scores, b.scores));
}
