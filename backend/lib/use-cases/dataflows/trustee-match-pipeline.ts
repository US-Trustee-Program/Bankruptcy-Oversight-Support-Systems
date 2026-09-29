import { CandidateScore, CanonicalTrusteeSource } from '@common/cams/dataflow-events';
import { Trustee } from '@common/cams/trustees';
import { NameMatchQuality } from './trustee-match.helpers';
import { CamsError } from '../../common-errors/cams-error';

/** The only Trustee-shaped type pipeline internals read or write; projectTrustee is the sole
 * conversion point from a full Trustee. Pick rather than Omit so a new Trustee field doesn't
 * silently widen this back to the full shape. */
export type ProjectedTrustee = Pick<
  Trustee,
  'trusteeId' | 'firstName' | 'middleName' | 'lastName' | 'name'
> & {
  address?: Trustee['public']['address'];
  phone?: Trustee['public']['phone'];
  email?: Trustee['public']['email'];
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
    email: trustee.public?.email,
  };
}

/**
 * Three-valued (Kleene K3) logic: true = agrees, false = genuinely conflicts, null = neutral/no
 * evidence either way (not merely "unknown" in the sense of "not yet computed" - a function
 * returning this type has definitely considered the question and concluded there is nothing to
 * compare, e.g. one side has no data at all). Named so a signature or a ScoreRecord field says what
 * `null` means on its own, without a reader having to open the function's doc comment - a bare
 * `boolean | null` return type carries the same three values but no name for them, which is exactly
 * what let calculateNameScore-family functions collapse a genuine three-way fact (match/conflict/
 * no-evidence) into a same-scale sentinel NUMBER instead (see MIDDLE_NAME_ONLY_CONFLICT_SCORE in
 * trustee-match-pipeline-stages.ts for the real bug that caused).
 */
export type KleeneBoolean = boolean | null;

/**
 * The gotcha KleeneBoolean exists to prevent: `false` (genuinely conflicts) is falsy in JS/TS,
 * exactly like `null` (neutral) is - `if (!someKleeneBoolean)` silently treats a real, recorded
 * conflict the same as "nothing to compare," which is never correct. foldKleene is the preferred
 * guard: the value itself selects which lambda runs, so there is no separate boolean condition to
 * write backwards the way a bare `if (!someKleeneBoolean)`/`=== null` check still could be.
 * Collapses a KleeneBoolean into a single value by running exactly one of three lambdas - most
 * scorers following the "no record when data unavailable" convention (see doesStateMatch/
 * doesCityMatch/doesMiddleNameMatch's own doc comments) reduce to exactly this shape - onNeutral
 * returns the candidate unchanged, onAgreement/onConflict each call addScore with the appropriate
 * ScoreRecord - so a scorer's body becomes one expression instead of an early-return `if`.
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
 * One scorer's contribution to a candidate's evaluation history. `value` is always
 * "higher is better" on a 0-100 scale - a scorer whose natural signal runs the other way (e.g.
 * phoneDigitDistance) converts to this convention. `threshold` is the cutoff active when this
 * record was produced, persisted alongside it so a later threshold retune doesn't silently
 * reinterpret an old record. `pass` is `value >= threshold`, computed once at scoring time.
 */
export type ScoreRecord = {
  value: number;
  threshold: number;
  pass: boolean;
} & Record<string, unknown>;

/**
 * A candidate's full evaluation history, keyed by scorer name (see addScore). A scorer with more
 * than one independent signal (e.g. address and phone) uses multiple keys rather than bundling
 * unrelated value/threshold/pass triples into one entry.
 *
 * THE CANONICAL STATEMENT of a convention several individual scorers each explain only in their
 * own doc comment (doesStateMatch/doesCityMatch/doesZipCodeMatch/doesMiddleNameMatch, cross-
 * referencing each other rather than one shared source): a scorer whose comparison is a
 * KleeneBoolean represents NEUTRAL by never calling addScore for that key at all, not by writing a
 * ScoreRecord with some neutral-flavored value. The key's ABSENCE from this map, not any field
 * inside a present ScoreRecord, is what carries the neutral state - `scores.doesFooMatch` is
 * `undefined` for neutral, a real ScoreRecord (pass: true or pass: false) only for a genuine,
 * actually-performed comparison. `ScoreRecord.pass` itself stays a plain, non-nullable `boolean`
 * specifically BECAUSE this convention exists: a scorer with nothing to compare never constructs a
 * ScoreRecord in the first place, so `pass` is never asked to represent "unknown" - if it needs to
 * express that, don't write the record; check for its absence.
 */
export type ScoreByScorer = Record<string, ScoreRecord>;

/**
 * A scorer's affirmative reason NOT to trust a candidate - distinct from a plain ScoreRecord's
 * `pass: false`, which conflates "actively checked and found a conflict" with "never checked at
 * all." Pushed only on POSITIVE evidence against a candidate (e.g. city/state actively disagree,
 * not merely unparseable), so a resolver can require `disqualifiers.length === 0` as an explicit
 * precondition rather than inferring it from the absence of a passing score. `evidence` carries
 * the actual compared values so a reviewer sees the conflict without re-deriving it.
 */
type Disqualifier = { scorer: string; reason: string; evidence: Record<string, unknown> };

/**
 * The canonical NORMALIZE-role shape (see docs/architecture/decision-records/
 * TrusteeMatchingPipeline.md) for either side of a match, under the same field names as
 * ProjectedTrustee. Partial since a normalizer only populates the fields it derives; omits
 * trusteeId since a source record has no CAMS identity. Distinct from `memo` (see
 * NormalizedMemo), which caches a computed comparison between two normalized records, not the
 * normalized record itself.
 *
 * lastNameAlternates holds any OTHER plausible surname derivative a normalizer produced beyond
 * the prime one already stored in `lastName` - e.g. a prepended-maiden-surname or hyphenated
 * compound can reduce to more than one reasonable token ("DE BRUCE WOLFF" -> prime "de bruce",
 * alternate "wolff" - see lastNameSurnameCandidates in trustee-match.helpers.ts). A downstream
 * RECALL/SCORE function that only ever needs the single best-guess reduction reads `lastName`
 * exactly as before and never has to know alternates exist; one that specifically wants to try
 * every plausible variant (e.g. findSurnameExactCandidates's discovery-time fallback) reads
 * `lastNameAlternates.length > 0` as its gate. Not specific to lastName in principle - any other
 * NormalizedTrustee field a future normalizer produces multiple plausible variants for could add
 * its own equivalent `<field>Alternates` array following this same shape.
 *
 * lastNameUnreduced holds the ACMS lastName AFTER name-recovery (recoverCorruptedFirstName/
 * recoverSoloPracticeName) but BEFORE lastNameSurnameCandidates' token reduction - distinct from
 * both `lastName` (which is the REDUCED result) and `legacyLastName` (which is a passthrough of
 * the raw, pre-recovery value and never updated by normalizeAcmsSourceName). A caller that needs
 * an exact, unreduced surname comparison but still wants recovery's benefit (e.g.
 * isExactLastNameMatch's marker-stripping-only comparison) reads this field rather than
 * sourceRaw.lastName directly, so a corrupted/business-suffixed ACMS name that recovery already
 * fixed isn't silently re-broken by comparing the ORIGINAL, unrecovered text.
 */
type NormalizedTrusteeFields = Partial<Omit<ProjectedTrustee, 'trusteeId' | 'address'>> & {
  address?: Partial<NonNullable<ProjectedTrustee['address']>>;
  lastNameAlternates?: string[];
  lastNameUnreduced?: string;
};

/**
 * Pipeline processing state carried alongside a normalized record - NOT itself normalized output,
 * so kept as its own composed piece rather than folded into NormalizedTrusteeFields, whose fields
 * are all "what did normalization produce." Every field here is either a raw passthrough kept
 * around for a later stage, or a memoized computation result, not a normalization.
 *
 * legacy holds a passthrough clone of sourceRaw.legacy (address1/cityStateZipCountry/phone/fax/
 * email) - plain scalars, not reshaped, unlike address/name, so cloning them here has none of the
 * "compute once" cache-breaking risk those two fields carry (see cloneNormalizableFields).
 * legacyLastName is a similar passthrough of the raw, un-reduced lastName exactly as it appeared
 * on sourceRaw, distinct from `lastName` (which holds normalizeAcmsSourceName's REDUCED output) -
 * needed because lastNameTokensMatch (trustee-match.helpers.ts) re-derives the full
 * prepended-surname/hyphenated-compound candidate set from the raw string itself, and that
 * function's public contract is out of scope to change here. fullName is the same passthrough
 * treatment for sourceRaw.fullName (CanonicalTrusteeSource-only, no ProjectedTrustee equivalent -
 * a candidate's own composed name lives in `name` instead), kept distinct from `name` (which
 * memoizedNormalizeName caches a SIMILARITY-normalized reduction into, not a raw passthrough).
 * acmsHasNoContactData caches memoizedAcmsHasNoContactData's result directly on this record, the
 * same "compute once" pattern memoizedParseAcmsAddress already uses for `address`.
 */
type TrusteeNormalizationCache = {
  legacy?: NonNullable<CanonicalTrusteeSource['legacy']>;
  legacyLastName?: string;
  fullName?: string;
  acmsHasNoContactData?: boolean;
};

export type NormalizedTrustee = NormalizedTrusteeFields & TrusteeNormalizationCache;

/**
 * One candidate under consideration, plus its evaluation history. camsRaw is set once and never
 * changes. Generic on TCandidate (the candidate-side raw record shape) - see
 * TrusteePipelineCandidate for the concrete trustee instantiation. camsNormalized stays
 * trustee-shaped (NormalizedTrustee) rather than also becoming generic, since no other
 * entity-matching use case exists yet to shape a generic version against.
 *
 * origin is the name of the RECALL stage that first discovered this candidate, set once at
 * creation and never overwritten (see addCandidate).
 */
export type PipelineCandidate<TCandidate> = {
  camsRaw: TCandidate;
  camsNormalized: NormalizedTrustee;
  memo: NormalizedMemo;
  scores: ScoreByScorer;
  disqualifiers: Disqualifier[];
  origin: string;
};

/** Named accessor for a candidate's score history, rather than inlining `candidate.scores`, so a
 * future change to how scores are read has one place to change. */
export function mergedScore<TCandidate>(candidate: PipelineCandidate<TCandidate>): ScoreByScorer {
  return candidate.scores;
}

/** matchTrusteeByName's exact-resolved outcome (name alone, no contact corroboration) - see
 * trustee-match.helpers.ts's NameMatchResult 'resolved' case. */
type NameOnlyMatchScore = {
  nameScore: number;
  nameMatchQuality: NameMatchQuality;
};

/** A confirmed match, carrying the score that justified it so a consumer never needs to re-scan
 * the candidate's score history to answer "why was this the match," and resolvedBy (the RESOLVE
 * stage's own function name) so a reviewer can tell, e.g., resolveBySoleExactNameMatch apart from
 * resolveBySoleContactMatch or resolveRisky's inner sub-stages without reverse-engineering it from
 * score shape alone. */
type PipelineMatch = {
  trusteeId: string;
  score: CandidateScore | NameOnlyMatchScore | ScoreByScorer | Record<string, never>;
  resolvedBy: string;
};

/**
 * The shared state every pipeline stage reads and returns (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md). Once `match`, `skip`, or `error`
 * is set, runPipeline stops invoking any later stage (see its own doc comment) - an individual
 * stage never needs to check this itself. `skip` is a valid, non-exceptional "no real identity to
 * match" outcome; `error` is always a real CamsError, never a bare `unknown`/string, with `null`
 * as the explicit "no error" value. sourceNormalized's composed name is stored under `name`, not
 * `fullName`, matching camsNormalized's own field name on the candidate side.
 *
 * Generic on TSource (see CanonicalTrusteeSource) and TCandidate (see PipelineCandidate) - see
 * TrusteePipelineState for the concrete trustee instantiation.
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
 * Seeds sourceNormalized/camsNormalized as a clone of the scalar name/contact fields already
 * present on the raw record, rather than starting empty - so a normalizer stage mutates its own
 * dedicated copy in place (`normalized.firstName = recovered`) instead of spreading a fresh object
 * back onto state each time, and sourceRaw/camsRaw can never be accidentally mutated by code that
 * meant to write to "the normalized one." Deliberately excludes `address` and `name`: both are
 * RESHAPED, not passthrough, fields (address goes from ACMS's raw cityStateZipCountry string to a
 * parsed {city,state,zipCode} struct; name is a composed similarity-normalized string, not a raw
 * source field at all - see memoizedParseAcmsAddress/memoizedNormalizeName), so seeding either
 * with a non-undefined placeholder would break those functions' own `=== undefined`/`??=`
 * "compute once, cache" checks, silently skipping the real computation.
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
    legacyLastName: raw.lastName,
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

/** Adds a candidate to the pipeline state, or returns the existing entry unchanged if this
 * trusteeId is already present - idempotent, so a discovery stage that finds the same trustee
 * another stage already proposed never resets its accumulated score history or origin. */
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
    disqualifiers: [],
    origin,
  };
  state.candidates.set(camsRaw.trusteeId, candidate);
  return candidate;
}

/** Merges a candidate from a nested pipeline run (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md on nesting) into the outer state,
 * preserving its inner score history. Idempotent like addCandidate. */
export function promoteCandidate<TSource, TCandidate extends { trusteeId: string }>(
  state: PipelineState<TSource, TCandidate>,
  candidate: PipelineCandidate<TCandidate>,
): PipelineCandidate<TCandidate> {
  const existing = state.candidates.get(candidate.camsRaw.trusteeId);
  if (existing) return existing;

  state.candidates.set(candidate.camsRaw.trusteeId, candidate);
  return candidate;
}

/** Records a scorer's contribution, keyed by scorer name - a stage that runs more than once
 * against the same candidate overwrites its own prior slot rather than accumulating duplicates. */
export function addScore<TCandidate>(
  candidate: PipelineCandidate<TCandidate>,
  scorer: string,
  score: ScoreRecord,
): void {
  candidate.scores[scorer] = score;
}

/** Records a scorer's affirmative reason not to trust a candidate - see Disqualifier. Appends
 * rather than overwriting: more than one scorer can independently disqualify the same candidate,
 * and each reason is worth keeping. Callers push only on genuinely new evidence, not on every
 * re-run over a growing candidate pool. */
export function addDisqualifier<TCandidate>(
  candidate: PipelineCandidate<TCandidate>,
  scorer: string,
  reason: string,
  evidence: Record<string, unknown>,
): void {
  candidate.disqualifiers.push({ scorer, reason, evidence });
}

/** One cached normalizer call: `key` fingerprints its actual input(s) (e.g. `"John Doe"`, or
 * `"John Doe|Jon Doe"` for a two-argument comparison) so two distinct-input calls to the same
 * normalizer are distinguishable, not just cached by function name alone. */
export type MemoEntry = { key: string; value: unknown };

/** A per-side memo (source record or a specific candidate) of every normalizer call made against
 * it, keyed by function name so a downstream consumer can look up "this candidate's
 * fullNameSimilarity entries" without knowing what inputs produced them. */
export type NormalizedMemo = Map<string, MemoEntry[]>;

/** Memoizes one normalizer call by function name and input fingerprint (see MemoEntry) - computed
 * once per distinct fingerprint regardless of which stage asks. */
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

/** Every pipeline function shares this one signature - no exceptions among the pool-level stages
 * (see docs/architecture/decision-records/TrusteeMatchingPipeline.md on the functional design).
 * A stage is a pure computation over its input state (deterministic, no I/O, no mutation of
 * sourceRaw/camsRaw) with exactly one sanctioned exception: a RECALL stage's own repository call,
 * whose failure lands on state.error rather than throwing (see recallBySurnameExact et al. in
 * trustee-match-pipeline-stages.ts) - RECALL is the sole boundary where non-determinism enters the
 * pipeline at all. */
export type Stage<TSource, TCandidate> = (
  state: PipelineState<TSource, TCandidate>,
) => Promise<PipelineState<TSource, TCandidate>>;

/** Runs an ordered list of stages left to right, threading the same state through each, and is
 * the SOLE place that checks for a terminal outcome (a match, a skip, or an error) - once reached,
 * iteration stops and the final state is returned immediately, without calling any later stage.
 * Individual stages never perform this check themselves (see Stage's own doc comment); centralizing
 * it here means a stage can be written, read, and tested as a pure state -> state function with no
 * control-flow responsibility of its own. Stage order affects only how quickly the pipeline reaches
 * a terminal outcome, never which outcome it can reach (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md). */
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

/** JSON-serializable projection of PipelineCandidate - Maps become plain objects/arrays (memo
 * becomes `{ functionName: MemoEntry[] }`); everything else passes through unchanged. */
export type SerializedCandidate<TCandidate> = {
  camsRaw: TCandidate;
  camsNormalized: NormalizedTrustee;
  memo: Record<string, MemoEntry[]>;
  scores: ScoreByScorer;
  disqualifiers: Disqualifier[];
  origin: string;
};

/** JSON-serializable projection of PipelineState, for writing to a JSONL file or Mongo document
 * (see docs/architecture/decision-records/TrusteeMatchingPipeline.md on evidence retention).
 * candidates becomes an array in discovery order. */
export type SerializedState<TSource, TCandidate> = {
  sourceRaw: TSource;
  sourceNormalized: NormalizedTrustee;
  memo: Record<string, MemoEntry[]>;
  candidates: SerializedCandidate<TCandidate>[];
  match: PipelineMatch | null;
  skip: boolean;
  error: CamsError | null;
};

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
      disqualifiers: candidate.disqualifiers,
      origin: candidate.origin,
    })),
    match: state.match,
    skip: state.skip,
    error: state.error,
  };
}

/** Concrete trustee-matching instantiations of the generic pipeline state graph, pinned to
 * CanonicalTrusteeSource (not DxtrTrusteeParty/AcmsTrusteeProfessional specifically) so a
 * DXTR-sourced and an ACMS-sourced record run through the identical pipeline instantiation. */
export type TrusteePipelineCandidate = PipelineCandidate<ProjectedTrustee>;
export type TrusteePipelineState = PipelineState<CanonicalTrusteeSource, ProjectedTrustee>;
export type TrusteeStage = Stage<CanonicalTrusteeSource, ProjectedTrustee>;
export type TrusteeSerializedState = SerializedState<CanonicalTrusteeSource, ProjectedTrustee>;

/** Pins TCandidate to ProjectedTrustee explicitly - a bare `createInitialState(sourceRaw)` call
 * can't infer TCandidate from its single argument alone. */
export function createTrusteeInitialState(sourceRaw: CanonicalTrusteeSource): TrusteePipelineState {
  return createInitialState<CanonicalTrusteeSource, ProjectedTrustee>(sourceRaw);
}
