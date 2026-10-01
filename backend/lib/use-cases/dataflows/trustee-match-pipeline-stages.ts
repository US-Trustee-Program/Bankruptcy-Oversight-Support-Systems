import * as natural from 'natural';
import { getNameVariations } from 'name-match/src/name-normalizer';
import { ApplicationContext } from '../../adapters/types/basic';
import { Trustee } from '@common/cams/trustees';
import { usStates } from '@common/cams/us-states';
import factory from '../../factory';
import {
  firstLastNameToken,
  isBlankAcmsValue,
  isFirstMiddleSwap,
  isKnownNicknamePair,
  isOneSidedMiddleNameMatch,
  isPlausibleNicknameByDistance,
  lastNameSurnameCandidates,
  lastNameTokensMatch,
  matchTrusteeByName,
  normalizeAddressLine,
  parseCityStateZip,
  stripParentheticalAnnotations,
  tokenizeNameForIntersection,
} from './trustee-match.helpers';
import {
  isRecordDisavowed,
  recoverCorruptedFirstName,
  recoverLastFirstRoleSwap,
  recoverSoloPracticeName,
  shouldSkipAsNotAPerson,
  shouldSkipAsUstStaff,
  stripAdministrativeMarkers,
} from './acms-name-normalization.helpers';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import {
  addCandidate,
  addScore,
  foldKleene,
  KleeneBoolean,
  candidatePool,
  mergedScore,
  normalize,
  NormalizedMemo,
  NormalizedTrustee,
  ProjectedTrustee,
  projectTrustee,
  ScoreByScorer,
  ScoreRecord,
  TrusteePipelineCandidate as PipelineCandidate,
  TrusteePipelineState as PipelineState,
  TrusteeStage as Stage,
} from './trustee-match-pipeline';

const MODULE_NAME = 'TRUSTEE-MATCH-PIPELINE-STAGES';

/**
 * Whether two name parts (a first name, or a full - non-initial - middle name) are plausibly the
 * same underlying name: a nickname/truncation (JaroWinkler) OR a spelling variant
 * (SoundEx/Metaphone) - neither alone is reliable, so this ORs both families together. Never
 * trusted as a sole decisive signal - every caller still requires independent geography or contact
 * corroboration, since a plausible pair can still be two different real people sharing a first
 * name.
 *
 * Threshold raised from 0.8: JaroWinklerDistance's prefix bonus lets a shared leading particle
 * dominate the score on a compound surname even when the substantive surname is completely
 * different - e.g. "Van Doe"/"Van Roe" scored 0.81, "Smit"/"Smyt" scored 0.86, both above the old
 * bar and both resolved by resolveExactFirstFuzzyLastName* as the same person. 0.88 excludes both
 * while still passing every genuine spelling-variant pair found ("Meier"/"Meyer" at 0.87 is the
 * nearest miss - accepted, since no-match for manual review beats a false-positive auto-link).
 */
const FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD = 0.88;

function isFuzzyNamePartMatch(acmsNamePart: string, camsNamePart: string): boolean {
  const a = acmsNamePart.toLowerCase();
  const b = camsNamePart.toLowerCase();
  if (natural.JaroWinklerDistance(a, b) >= FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD) return true;

  const soundex = new natural.SoundEx();
  const metaphone = new natural.Metaphone();
  return soundex.compare(a, b) || metaphone.compare(a, b);
}

/**
 * Memoizes isFuzzyNamePartMatch per candidate (see normalize/NormalizedMemo) - also the persisted
 * evidence trail: a reviewer inspecting a real synced record's memo can see exactly which last-name
 * pairs were compared this way and what each JaroWinkler+SoundEx+Metaphone check concluded.
 */
function memoizedIsFuzzyNamePartMatch(
  memo: NormalizedMemo,
  acmsNamePart: string,
  camsNamePart: string,
): boolean {
  return normalize(memo, 'isFuzzyNamePartMatch', `${acmsNamePart}|${camsNamePart}`, () =>
    isFuzzyNamePartMatch(acmsNamePart, camsNamePart),
  );
}

/** Memoizes isPlausibleNicknameByDistance per candidate - same evidence-retention purpose as
 * memoizedIsFuzzyNamePartMatch, for matchNamePart's first/middle name comparisons. */
function memoizedIsPlausibleNicknameByDistance(
  memo: NormalizedMemo,
  source: string,
  cams: string,
): boolean {
  return normalize(memo, 'isPlausibleNicknameByDistance', `${source}|${cams}`, () =>
    isPlausibleNicknameByDistance(source, cams),
  );
}

function isBareInitial(namePart: string): boolean {
  return namePart.length === 1;
}

/**
 * A single name PART's (first or middle) match quality - the one scale matchName's field-by-field
 * reasoning is built from:
 *   - 'exact': identical strings.
 *   - 'strong': a certain-but-not-literal relationship (one side a bare initial consistent with the
 *     other's leading character) or a plausible-same-name relationship (a known nickname/formal-name
 *     pair, or a JaroWinkler-distance spelling variant - see isPlausibleNicknameByDistance's own doc
 *     comment for why this stays distance-only, no phonetic check, for a first/middle name part).
 *   - 'none': no relationship, OR one/both sides empty (absence is never evidence for a REQUIRED
 *     field like first name - see matchName's own middle-name handling, where absence is
 *     deliberately treated as neutral rather than a conflict).
 *
 * Bare-initial pairs are resolved BEFORE the nickname/distance fallback, not folded into it: a
 * short string is highly JaroWinkler-similar to its own leading letter by construction (e.g. "al"
 * vs "a" scores 0.85) - so without this explicit branch, a genuinely conflicting bare initial (e.g.
 * "P" vs "E") could still slip through as a coincidental distance match whenever the OTHER side
 * happened to be short. Once isInitialOf has been checked and failed for a bare-initial side, the
 * full name provably does not start with that letter - a real, if weak, conflict, not neutral.
 */
type NamePartQuality = 'exact' | 'strong' | 'none';

function matchNamePart(memo: NormalizedMemo, source: string, cams: string): NamePartQuality {
  if (!source || !cams) return 'none';
  if (source === cams) return 'exact';
  if (isInitialOf(source, cams) || isInitialOf(cams, source)) return 'strong';
  if (isBareInitial(source) || isBareInitial(cams)) return 'none';
  if (isKnownNicknamePair(source, cams)) return 'strong';
  return memoizedIsPlausibleNicknameByDistance(memo, source, cams) ? 'strong' : 'none';
}

/**
 * The overall name-match verdict matchName produces - a pure fact about two name records, with no
 * awareness of geography or contact corroboration (that composition belongs entirely to the
 * RESOLVE stages that consume this verdict, not here).
 *   - pass: last name matched AND first+middle together clear the corroboration-eligible bar - the
 *     one field every RESOLVE stage gates on before considering independent corroboration.
 *   - quality, ranked, and present only when pass is true: 'exact' when every compared field
 *     matched literally; 'strong' when the surname matched but a given name was relaxed (initial,
 *     nickname, swap); 'weak' when the SURNAME itself only matched fuzzily. A weak match must
 *     never resolve on name alone - two surnames a typo apart belong to different people often
 *     enough that it needs independent corroboration to stand.
 */
type NameMatchQuality = 'exact' | 'strong' | 'weak';

type NameMatchVerdict = { pass: true; quality: NameMatchQuality } | { pass: false };

const NO_MATCH: NameMatchVerdict = { pass: false };

/**
 * Orchestrates every atomic name-comparison primitive (lastNameTokensMatch, matchNamePart,
 * isFirstMiddleSwap, isOneSidedMiddleNameMatch) into the one verdict every RESOLVE stage reads,
 * replacing three previously-separate code paths (an exact-tier pass and two narrower "dead zone
 * recovery" passes) that each independently decided which fields to compare and how - middle name
 * in particular is now always evaluated, closing a real gap where a swap/one-sided-match verdict
 * could previously credit a candidate without ever checking whether middle name conflicted.
 *
 * Two different fuzzy thresholds, each kept to its own validated job: first/middle name uses
 * isPlausibleNicknameByDistance (0.8 JaroWinkler, e.g. "Cathy"/"Catherine"); last name uses
 * isFuzzyNamePartMatch (0.88 + SoundEx/Metaphone, e.g. "Stromp"/"Strump") gated on an exact first
 * name, since fuzzing both parts at once on an otherwise-unrelated pair is too permissive.
 *
 * Takes sourceNormalized/camsNormalized directly - both sides' NORMALIZE stage already ran (see
 * CANDIDATE_SCORERS' ordering), including populating lastNameAlternates (see
 * NormalizedTrustee's own doc comment), so lastNameTokensMatch's fallback reads each side's
 * already-derived candidate list straight off the normalized record instead of re-deriving it from
 * a raw string itself.
 *
 * Takes memo to pass through to matchNamePart/the fuzzy last-name check - both memoize on it, so
 * each atomic comparison's fingerprint/result is preserved in the candidate's serialized evidence
 * (see SerializedCandidate.memo), not just cached for this run.
 */
/** The best quality any given-name variant reaches - firstName, or a parenthetical alias recorded
 * alongside it (see NormalizedTrustee.firstNameAlternates). Only the primary can be 'exact'; an
 * alias is corroborating evidence, not the name of record. */
function matchFirstName(
  memo: NormalizedMemo,
  sourceNormalized: NormalizedTrustee,
  camsNormalized: NormalizedTrustee,
): NamePartQuality {
  const primary = matchNamePart(
    memo,
    sourceNormalized.firstName ?? '',
    camsNormalized.firstName ?? '',
  );
  if (primary !== 'none') return primary;

  const sourceNames = [
    sourceNormalized.firstName ?? '',
    ...(sourceNormalized.firstNameAlternates ?? []),
  ];
  const camsNames = [camsNormalized.firstName ?? '', ...(camsNormalized.firstNameAlternates ?? [])];
  const aliasMatches = sourceNames.some((source) =>
    camsNames.some((cams) => matchNamePart(memo, source, cams) !== 'none'),
  );
  return aliasMatches ? 'strong' : 'none';
}

/**
 * A multi-token middle name glues into one token (see splitGivenName's own doc comment), so a
 * source middle initial drawn from any token but the first would otherwise read as a conflict.
 * middleNameAlternates carries those tokens individually; any one of them may answer for the field.
 */
function matchMiddleName(
  memo: NormalizedMemo,
  sourceMiddle: string,
  camsNormalized: NormalizedTrustee,
): NamePartQuality {
  const camsMiddle = camsNormalized.middleName ?? '';
  const direct = matchNamePart(memo, sourceMiddle, camsMiddle);
  if (direct !== 'none' || !sourceMiddle) return direct;

  const qualities = (camsNormalized.middleNameAlternates ?? []).map((token) =>
    matchNamePart(memo, sourceMiddle, token),
  );
  return qualities.find((quality) => quality !== 'none') ?? 'none';
}

function matchName(
  memo: NormalizedMemo,
  sourceNormalized: NormalizedTrustee,
  camsNormalized: NormalizedTrustee,
): NameMatchVerdict {
  const sourceLast = sourceNormalized.lastName ?? '';
  const camsLast = camsNormalized.lastName ?? '';
  const sourceFirst = sourceNormalized.firstName ?? '';
  const camsFirst = camsNormalized.firstName ?? '';

  const sourceLastCandidates = sourceLast
    ? [sourceLast, ...(sourceNormalized.lastNameAlternates ?? [])]
    : undefined;
  const camsLastCandidates = camsLast
    ? [camsLast, ...(camsNormalized.lastNameAlternates ?? [])]
    : undefined;

  if (!lastNameTokensMatch(sourceLast, camsLast, sourceLastCandidates, camsLastCandidates)) {
    // A spelling-variant surname only counts alongside an EXACT first name - fuzzing both parts at
    // once on an otherwise-unrelated pair would be too permissive to trust.
    if (
      sourceFirst &&
      sourceFirst === camsFirst &&
      memoizedIsFuzzyNamePartMatch(memo, sourceLast, camsLast)
    ) {
      return { pass: true, quality: 'weak' };
    }
    return NO_MATCH;
  }

  const sourceMiddle = sourceNormalized.middleName ?? '';
  const camsMiddle = camsNormalized.middleName ?? '';

  const firstQuality = matchFirstName(memo, sourceNormalized, camsNormalized);
  if (firstQuality === 'none') {
    if (
      isFirstMiddleSwap(sourceFirst, sourceMiddle, camsFirst, camsMiddle) ||
      isOneSidedMiddleNameMatch(sourceFirst, sourceMiddle, camsFirst, camsMiddle)
    ) {
      return { pass: true, quality: 'strong' };
    }
    return NO_MATCH;
  }

  const middleQuality = matchMiddleName(memo, sourceMiddle, camsNormalized);
  const middleConflicts = middleQuality === 'none' && !!sourceMiddle && !!camsMiddle;
  if (middleConflicts && firstQuality !== 'exact') {
    // BOTH sides had a middle name to compare (not merely one, which matchNamePart already treats
    // as neutral absence) and it genuinely conflicted. With the first name ALSO relaxed - an
    // initial, a nickname, a spelling variant - the surname is the only part that matched
    // literally, which is not enough to call this the same person.
    return NO_MATCH;
  }

  // An exact first name and a matching surname outweigh a conflicting middle name, which is the
  // least reliable name part in this data: a middle initial is frequently absent, abbreviated,
  // transcribed from a different source, or holds a maiden surname on one side only. The verdict
  // drops to 'strong' so a resolver requiring an exact match still declines, while one weighing
  // independent corroboration can still resolve.
  const exact = firstQuality === 'exact' && middleQuality !== 'strong' && !middleConflicts;
  return { pass: true, quality: exact ? 'exact' : 'strong' };
}

/**
 * ACMS-pipeline-only address parser: parseCityStateZip (shared with the DXTR paths) plus a
 * recovery for a "CITY ST" address carrying no zip at all, which the shared parser rejects
 * outright. ACMS commonly stores an address that way; DXTR does not, and widening the shared
 * parser would change calculateAddressScore's behavior for sync-trustee-case-appointments.
 *
 * The recovered shape reports zipCode: '' - honest about a zip that was never present, rather
 * than a placeholder a downstream zip comparison could read as real evidence.
 */
const VALID_STATE_CODES = new Set(usStates.map((s) => s.code));

function parseAcmsCityStateZip(cityStateZipCountry?: string): ReturnType<typeof parseCityStateZip> {
  const parsed = parseCityStateZip(cityStateZipCountry);
  if (parsed) return parsed;
  if (!cityStateZipCountry) return null;

  const tokens = cityStateZipCountry.replaceAll(',', ' ').trim().split(/\s+/);
  const trailingToken = tokens[tokens.length - 1];
  const trailingIsState =
    trailingToken !== undefined &&
    /^[A-Za-z]{2}$/.test(trailingToken) &&
    VALID_STATE_CODES.has(trailingToken.toUpperCase());
  if (!trailingIsState) return null;

  const city = tokens.slice(0, tokens.length - 1).join(' ');
  if (!city) return null;
  return { city, state: trailingToken, zipCode: '' };
}

/**
 * Whether both emails are equal after trim+lowercase - null when either side has no email, since a
 * missing email is not evidence of a mismatch. Forked from the DXTR path's calculateEmailScore for
 * the same reason as phoneMatch.
 */
function emailMatch(sourceEmail: string | undefined, camsEmail: string | undefined): KleeneBoolean {
  const sourceNormalized = (sourceEmail ?? '').trim().toLowerCase();
  const camsNormalized = (camsEmail ?? '').trim().toLowerCase();
  if (!sourceNormalized || !camsNormalized) return null;
  return sourceNormalized === camsNormalized;
}

/**
 * NORMALIZE stage recovering an ACMS source record's real firstName/middleName/lastName from
 * CMMPR's known data-quality issues (see stripAdministrativeMarkers/recoverCorruptedFirstName/
 * recoverSoloPracticeName/splitCompoundFirstName in sync-acms-professional-ids.ts), THEN applies
 * the same comparison-ready reduction the ADR's NORMALIZE role calls for (firstLastNameToken via
 * lastNameSurnameCandidates, and general cleaning via normalizeNamePart).
 *
 * - Writes to state.sourceNormalized rather than mutating state.sourceRaw, so sourceRaw stays a
 *   faithful, unmodified copy of the CMMPR record, visible in the persisted state graph next to
 *   what was derived from it.
 * - lastName gets lastNameSurnameCandidates' FIRST (primary) result. Its remaining candidates (a
 *   prepended-surname's trailing token, a hyphenated compound's last segment) are stored on
 *   lastNameAlternates instead of discarded: RECALL-time discovery needs to try every plausible
 *   surname token, not just the primary one, to find a real candidate for a name like "DE ROE
 *   SANTOS" (primary reduction "de roe" never finds "Santos" alone).
 * - Idempotent and cheap to re-run (pure string transforms, no I/O) - always recomputes rather
 *   than checking for an existing sourceNormalized value first.
 */
export function normalizeAcmsSourceName(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    // recoverLastFirstRoleSwap runs FIRST, against the RAW fields - stripAdministrativeMarkers'
    // own comma-stripping ([-/*.,():_]+) would otherwise destroy the "LAST, FIRST" comma this
    // recovery depends on before it ever ran.
    const roleSwapRecovered = recoverLastFirstRoleSwap(
      state.sourceRaw.firstName ?? '',
      state.sourceRaw.lastName ?? '',
    );
    // recoverCorruptedFirstName ALSO runs against the RAW (pre-stripAdministrativeMarkers)
    // firstName - its whole-name recovery is gated on firstName containing a digit (see its own
    // doc comment, "TACOMACH13" shape), and stripAdministrativeMarkers' glued-chapter-marker
    // stripping (GLUED_CHAPTER_MARKER_PATTERN) would otherwise remove that digit first
    // ("TACOMACH13" -> "TACOMA", no digit left), silently disarming recoverCorruptedFirstName's
    // own gate before it ever got a chance to run - confirmed as a real regression via
    // pipeline-replay-backtest.ts against the 2026-09-25 export (a real "TACOMACH13 [name]" record
    // that previously recovered its whole real name from lastName stopped doing so once
    // stripAdministrativeMarkers ran first).
    const corruptionRecovered = recoverCorruptedFirstName(
      roleSwapRecovered.firstName,
      roleSwapRecovered.lastName,
    );
    // splitGivenName reads the PRE-strip firstName below to keep the parenthetical as an
    // alternate; stripping here only governs which tokens become the primary first/middle.
    const strippedFirstName = stripAdministrativeMarkers(
      stripParentheticalAnnotations(corruptionRecovered.firstName),
    );
    const strippedLastName = stripAdministrativeMarkers(corruptionRecovered.lastName);
    const soloPracticeRecovered = recoverSoloPracticeName(strippedFirstName, strippedLastName);
    const { firstName, middleName } = splitGivenName(
      soloPracticeRecovered.firstName,
      state.sourceRaw.middleName,
    );
    const { firstNameAlternates } = splitGivenName(corruptionRecovered.firstName, undefined);
    const [lastName, ...lastNameAlternates] = lastNameSurnameCandidates(
      soloPracticeRecovered.lastName,
    );

    return {
      ...state,
      sourceNormalized: {
        ...state.sourceNormalized,
        firstName,
        middleName,
        firstNameAlternates,
        lastName,
        lastNameAlternates,
        lastNameUnreduced: soloPracticeRecovered.lastName,
      },
    };
  };
}

/**
 * RECALL-only: the record the discovery-tier helpers that call into this projection
 * (matchTrusteeByName, tokenizeNameForIntersection) should search against, in place of
 * state.sourceRaw directly. This is the ONLY place a translation back to the raw shape happens -
 * every SCORE/RESOLVE function reads state.sourceNormalized/candidate.camsNormalized directly
 * instead, so a scorer never needs to know this translation exists.
 *
 * - Those two helpers are shared with the DXTR trustee-appointment dataflow and take a
 *   DxtrTrusteeParty-shaped argument, so they can't be repointed to read NormalizedTrustee
 *   directly without breaking that unrelated call path or duplicating them ACMS-side.
 * - state.sourceRaw's firstName/middleName/lastName/fullName are unmodified CMMPR values - wrong
 *   for discovery, since a corrupted or business-suffixed name only recovers to something real in
 *   state.sourceNormalized.
 * - fullName is recomposed from the recovered parts, not left as sourceRaw.fullName, because
 *   matchTrusteeByName searches CAMS directly by this composed string - leaving it raw would run
 *   that search against un-recovered, possibly corrupted text.
 * - Everything else on the record (legacy address/phone/email, generation) passes through from
 *   sourceRaw as-is - this is a name-only substitution, not a general raw/normalized swap.
 * - fullName is only recomposed when normalizeAcmsSourceName actually changed a name part
 *   (compared against sourceRaw); otherwise sourceRaw.fullName is reused as-is, so a record
 *   nothing recovered is never rebuilt in a way that could drop punctuation/casing it legitimately
 *   had.
 */
function projectNormalizedSourceForRecall(state: PipelineState): PipelineState['sourceRaw'] {
  const firstName = state.sourceNormalized.firstName;
  const middleName = state.sourceNormalized.middleName;
  const lastName = state.sourceNormalized.lastName;
  const nameWasRecovered =
    firstName !== state.sourceRaw.firstName ||
    middleName !== state.sourceRaw.middleName ||
    lastName !== state.sourceRaw.lastName;
  const fullName = nameWasRecovered
    ? [firstName, middleName, lastName].filter(Boolean).join(' ')
    : state.sourceRaw.fullName;
  return {
    ...state.sourceRaw,
    firstName,
    middleName,
    lastName,
    fullName,
  };
}

/**
 * Cheapest possible gate in the whole pipeline, deliberately FIRST to run - before
 * normalizeAcmsSourceName, not after.
 *
 * - shouldSkipAsNotAPerson: does this record name no real person at all - "NOT ASSIGNED", an office
 *   name, a well-known synthetic test record.
 * - isRecordDisavowed: did ACMS explicitly say not to use this specific record - "DO NOT USE",
 *   "DUPLICATE", "CANCELLED", "DELETE" - checked against fullName AND the concatenated legacy
 *   address fields (a real record carried "DO NOT USE" in address1 instead of the name field - see
 *   isRecordDisavowed's own doc comment for that regression), independent of whether a real name is
 *   also present. A real person's name on a disavowed record still skips: the record itself is
 *   stale/superseded, so matching against it is the wrong move even though the name is real.
 * - shouldSkipAsUstStaff: does this record carry a "(UST)"/"U S TRUSTEE" annotation - a UST is a
 *   real person, but structurally never a CAMS trustee record, so there is nothing to match even
 *   when a real-looking name accompanies the annotation (unlike a chapter/role suffix, which
 *   ADMINISTRATIVE_MARKER_PHRASES strips to recover a real, matchable name underneath).
 * - Any one check alone is sufficient to skip; all three reused as-is from
 *   sync-acms-professional-ids.ts rather than reimplemented, so this stage can never drift from
 *   their detection logic.
 * - Reads sourceRaw.fullName (and, for isRecordDisavowed, sourceRaw.legacy), not sourceNormalized -
 *   normalization redistributes name parts and makes a signal split across fields, or embedded
 *   mid-field, unpredictable to find afterward.
 * - Sets state.skip, not state.match - "no real identity to match at all" is a valid outcome, not
 *   an error.
 */
export function skipAdministrativePlaceholder(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const fullName = state.sourceRaw.fullName;
    const shouldSkip =
      shouldSkipAsNotAPerson(fullName) ||
      isRecordDisavowed(state.sourceRaw) ||
      shouldSkipAsUstStaff(fullName);
    if (!shouldSkip) return state;
    return { ...state, skip: true };
  };
}

/**
 * ACMS-pipeline-only surname-exact discovery, sourced directly from
 * state.sourceNormalized.lastName + lastNameAlternates (see NormalizedTrustee's own doc comment on
 * that convention) rather than a single raw-ish string a DXTR-shared equivalent would have to
 * re-reduce itself via its own internal lastNameSurnameCandidates call - the ACMS pipeline already
 * has the reduced, recovered form on hand, so re-deriving it from scratch would be redundant work
 * repeating what normalizeAcmsSourceName already did.
 */
async function findSurnameExactCandidatesForAcms(
  context: ApplicationContext,
  sourceNormalized: NormalizedTrustee,
): Promise<Trustee[]> {
  const searchTokens = [
    sourceNormalized.lastName,
    ...(sourceNormalized.lastNameAlternates ?? []),
  ].filter((token): token is string => !!token);
  if (searchTokens.length === 0) return [];

  const trusteesRepo = factory.getTrusteesRepository(context);
  const resultsByToken = await Promise.all(
    searchTokens.map((token) => trusteesRepo.searchTrusteesByName(token)),
  );

  const dedupedById = new Map<string, Trustee>();
  for (const trustee of resultsByToken.flat()) {
    if (dedupedById.has(trustee.trusteeId)) continue;
    const candidateToken = firstLastNameToken(trustee.lastName);
    const isSurnameMatch = searchTokens.some((token) => lastNameTokensMatch(token, candidateToken));
    if (isSurnameMatch) {
      dedupedById.set(trustee.trusteeId, trustee);
    }
  }
  return Array.from(dedupedById.values());
}

/**
 * Discovery stage proposing every surname-exact candidate to the pipeline (see
 * addAndScoreCandidate: idempotent on the candidate entry itself, never resets a candidate
 * another stage already discovered - see its own doc comment on why the score pass still safely
 * re-runs). Every candidate is fully scored the instant it is discovered (see scoreCandidate); no
 * separate later scoring phase is needed.
 */
export function recallBySurnameExact(context: ApplicationContext): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    let found;
    try {
      found = await findSurnameExactCandidatesForAcms(context, state.sourceNormalized);
    } catch (originalError) {
      return {
        ...state,
        error: getCamsErrorWithStack(originalError, MODULE_NAME, {
          camsStackInfo: { module: MODULE_NAME, message: 'recallBySurnameExact failed' },
        }),
      };
    }
    for (const trustee of found) {
      addAndScoreCandidate(state, projectTrustee(trustee), 'recallBySurnameExact');
    }
    return state;
  };
}

/**
 * Discovery stage wrapping matchTrusteeByName's three internal passes (exact match,
 * searchTrusteesByNameScored phonetic fallback, lastName-token search - see its own doc comment).
 * Every outcome is recall only: a 'resolved' trustee and every 'ambiguous' candidate are added and
 * scored like any other discovery stage's candidates, and the caller's resolve stages decide. A
 * unique exact name is not corroboration on its own - it says nothing about whether the two
 * records' addresses agree.
 */
export function recallByName(context: ApplicationContext): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    let result;
    try {
      result = await matchTrusteeByName(context, projectNormalizedSourceForRecall(state));
    } catch (originalError) {
      return {
        ...state,
        error: getCamsErrorWithStack(originalError, MODULE_NAME, {
          camsStackInfo: { module: MODULE_NAME, message: 'recallByName failed' },
        }),
      };
    }

    const trusteeIds =
      result.kind === 'resolved'
        ? [result.trusteeId]
        : result.kind === 'ambiguous'
          ? result.matchCandidates.map((c) => c.trusteeId)
          : [];
    if (trusteeIds.length === 0) return state;

    let rawTrustees;
    try {
      rawTrustees = await factory.getTrusteesRepository(context).findTrusteesByIds(trusteeIds);
    } catch (originalError) {
      return {
        ...state,
        error: getCamsErrorWithStack(originalError, MODULE_NAME, {
          camsStackInfo: {
            module: MODULE_NAME,
            message: 'recallByName failed refetching candidates',
          },
        }),
      };
    }
    for (const trustee of rawTrustees) {
      addAndScoreCandidate(state, projectTrustee(trustee), 'recallByName');
    }
    return state;
  };
}

/**
 * Tokens shorter than this are excluded from the FUZZY side of recallByAnchoredLevenshtein -
 * mirrors findAnchoredLevenshteinCandidates' own ANCHORED_LEVENSHTEIN_MIN_FUZZ_TOKEN_LENGTH
 * (trustee-match.helpers.ts, private there) - a 1-2 character token has too many trustees within
 * ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE to be a useful signal.
 */
const ANCHORED_LEVENSHTEIN_MIN_FUZZ_TOKEN_LENGTH = 3;

/** Maximum edit distance for the fuzzy side of recallByAnchoredLevenshtein - mirrors
 * findAnchoredLevenshteinCandidates' own ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE. */
const ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE = 2;

/**
 * Standard Levenshtein (single-character insert/delete/substitute) edit distance between two
 * strings - mirrors findAnchoredLevenshteinCandidates' own private levenshteinDistance
 * (trustee-match.helpers.ts). Duplicated rather than exported from that DXTR-shared file: this is
 * a generic string-distance primitive, not ACMS/DXTR-specific reasoning, so a small local copy
 * keeps that file's private surface untouched while this pipeline-native stage stays self-contained.
 */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const previousRow = new Array(n + 1);
  const currentRow = new Array(n + 1);
  for (let j = 0; j <= n; j++) previousRow[j] = j;

  for (let i = 1; i <= m; i++) {
    currentRow[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        previousRow[j] + 1, // deletion
        currentRow[j - 1] + 1, // insertion
        previousRow[j - 1] + cost, // substitution
      );
    }
    for (let j = 0; j <= n; j++) previousRow[j] = currentRow[j];
  }

  return previousRow[n];
}

/**
 * Reimplements findTokenIntersectionCandidates' own discovery logic (searchTrusteesByName once
 * per ACMS name token, intersecting the results - see tokenizeNameForIntersection/that function's
 * doc comment in trustee-match.helpers.ts for the full tokenization/intersection rationale)
 * directly against the repository, rather than calling that shared, DXTR-adjacent helper and
 * discarding its result down to bare Trustee[] - a candidate surviving intersection is real
 * evidence (it matched EVERY one of the ACMS tokens searched, not just one), which this stage
 * records as a SCORE at the moment of discovery rather than losing it: all evidence that
 * contributed to the reasoning must appear on the state graph. Recording actual provenance only -
 * no counterfactual "would token X also have matched" - only the ACTUAL query sequence this
 * record's discovery took.
 */
export function recallByTokenIntersection(context: ApplicationContext): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const tokens = tokenizeNameForIntersection(projectNormalizedSourceForRecall(state).fullName);
    if (tokens.length < 2) return state;

    const trusteesRepo = factory.getTrusteesRepository(context);
    let candidatesById: Map<string, Trustee> | null = null;
    for (const token of tokens) {
      let matches;
      try {
        matches = await trusteesRepo.searchTrusteesByName(token);
      } catch (originalError) {
        return {
          ...state,
          error: getCamsErrorWithStack(originalError, MODULE_NAME, {
            camsStackInfo: { module: MODULE_NAME, message: 'recallByTokenIntersection failed' },
          }),
        };
      }
      if (candidatesById === null) {
        candidatesById = new Map(matches.map((t) => [t.trusteeId, t]));
      } else {
        const matchedIds = new Set(matches.map((t) => t.trusteeId));
        for (const trusteeId of candidatesById.keys()) {
          if (!matchedIds.has(trusteeId)) candidatesById.delete(trusteeId);
        }
      }
      if (candidatesById.size === 0) break;
    }

    for (const trustee of candidatesById?.values() ?? []) {
      const candidate = addAndScoreCandidate(
        state,
        projectTrustee(trustee),
        'recallByTokenIntersection',
      );
      addScore(candidate, 'recallByTokenIntersection', {
        value: tokens.length,
        threshold: 2,
        pass: true,
      });
    }
    return state;
  };
}

/**
 * Reimplements findAnchoredLevenshteinCandidates' own discovery logic (anchor one name part with
 * an exact match, allow the other to be a close Levenshtein match - see that function's doc
 * comment in trustee-match.helpers.ts for the full anchoring rationale) directly against the
 * repository, rather than calling that shared, DXTR-adjacent helper and discarding the edit
 * distance it computes per candidate down to bare Trustee[] - the edit distance IS the evidence
 * (a distance of 1 is a stronger signal than 2), recorded as a SCORE at the moment of discovery.
 * The same candidate can never survive BOTH anchor directions (surviving
 * direction A requires the OTHER field to be a non-exact fuzzy match, which direction B's anchor
 * requires be exact - contradictory), so candidatesById never needs to reconcile two distances
 * for one trustee; each surviving candidate's distance is unambiguous.
 */
export function recallByAnchoredLevenshtein(context: ApplicationContext): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const acmsFirst = state.sourceNormalized.firstName ?? '';
    const acmsLast = state.sourceNormalized.lastName ?? '';
    if (!acmsFirst || !acmsLast) return state;

    const trusteesRepo = factory.getTrusteesRepository(context);
    const candidatesById = new Map<string, { trustee: Trustee; editDistance: number }>();

    // Returns the CamsError it hit, rather than throwing, so the caller below can write it onto
    // state.error and stop trying the second direction - a thrown error here would unwind past
    // the caller's own state entirely, bypassing runPipeline's own state.error check (see
    // trustee-match-pipeline.ts) that this pipeline relies on as its stop-the-pipeline signal.
    const tryDirection = async (
      anchorToken: string,
      fuzzToken: string,
      anchorField: 'firstName' | 'lastName',
      fuzzField: 'firstName' | 'lastName',
    ): Promise<CamsError | undefined> => {
      if (fuzzToken.length < ANCHORED_LEVENSHTEIN_MIN_FUZZ_TOKEN_LENGTH) return undefined;

      let searchResults;
      try {
        searchResults = await trusteesRepo.searchTrusteesByName(anchorToken);
      } catch (originalError) {
        return getCamsErrorWithStack(originalError, MODULE_NAME, {
          camsStackInfo: { module: MODULE_NAME, message: 'recallByAnchoredLevenshtein failed' },
        });
      }
      for (const trustee of searchResults) {
        const anchorValue = firstLastNameToken(
          anchorField === 'firstName' ? trustee.firstName : trustee.lastName,
        );
        if (anchorValue !== anchorToken) continue;

        const fuzzValue = firstLastNameToken(
          fuzzField === 'firstName' ? trustee.firstName : trustee.lastName,
        );
        if (!fuzzValue || fuzzValue === fuzzToken) continue; // exact match already covered elsewhere

        const editDistance = levenshteinDistance(fuzzToken, fuzzValue);
        if (editDistance > ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE) continue;

        candidatesById.set(trustee.trusteeId, { trustee, editDistance });
      }
      return undefined;
    };

    const firstDirectionError = await tryDirection(acmsLast, acmsFirst, 'lastName', 'firstName');
    if (firstDirectionError) return { ...state, error: firstDirectionError };

    const secondDirectionError = await tryDirection(acmsFirst, acmsLast, 'firstName', 'lastName');
    if (secondDirectionError) return { ...state, error: secondDirectionError };

    for (const { trustee, editDistance } of candidatesById.values()) {
      const candidate = addAndScoreCandidate(
        state,
        projectTrustee(trustee),
        'recallByAnchoredLevenshtein',
      );
      addScore(candidate, 'recallByAnchoredLevenshtein', {
        value: editDistance,
        threshold: ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE,
        pass: true,
      });
    }
    return state;
  };
}

/**
 * Generational suffixes and ACMS placeholder junk are not given-name tokens. They only become
 * visible once the firstName and middleName fields are joined - a per-field split leaves them
 * attached to whichever field happened to carry them.
 */
const NON_GIVEN_NAME_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'x']);

/**
 * Re-derives firstName/middleName from the two fields JOINED, so how a source system divided them
 * can never be what makes two records differ. Whitespace stays a token boundary - "G. Matt" is an
 * initial plus a name, not "gmatt". A parenthetical becomes firstNameAlternates rather than part
 * of the split: it names the same person as `firstName`, so folding it in would put it in the
 * middle slot.
 */
function givenNameTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter((token) => !NON_GIVEN_NAME_TOKENS.has(token));
}

function splitGivenName(
  firstName: string | undefined,
  middleName: string | undefined,
): {
  firstName: string;
  middleName: string;
  firstNameAlternates: string[];
  middleNameAlternates: string[];
} {
  const raw = firstName ?? '';
  const parenthetical = /\(([^)]+)\)/.exec(raw);
  const tokens = givenNameTokens([raw.replace(/ ?\([^)]*\)/g, ' '), middleName ?? ''].join(' '));
  const middleTokens = tokens.slice(1);

  return {
    firstName: tokens[0] ?? '',
    middleName: middleTokens.join(''),
    firstNameAlternates: parenthetical ? givenNameTokens(parenthetical[1]) : [],
    middleNameAlternates: middleTokens.length > 1 ? middleTokens : [],
  };
}

/**
 * NORMALIZE-CAMS candidate stage: applies the same comparison-ready reduction
 * normalizeAcmsSourceName applies to the source side (lastNameSurnameCandidates for the surname -
 * primary token plus any alternates, see NormalizedTrustee.lastNameAlternates - normalizeNamePart
 * for first/middle) to this ONE candidate's camsNormalized, overwriting the plain clone
 * addCandidate seeded it with (see cloneNormalizableFields - a raw passthrough, not yet reduced
 * for comparison). Runs first in CANDIDATE_SCORERS, before any SCORE function reads
 * camsNormalized, so every scorer after it can read camsNormalized directly and never needs to
 * know this step ran, call lastNameSurnameCandidates/normalizeNamePart itself, or care whether
 * some other normalizer already did - the SOURCE -> NORMALIZE ACMS -> RECALL -> NORMALIZE CAMS ->
 * SCORE -> RESOLVE progression the pipeline's ADR describes.
 */
function normalizeCandidateNameFields(
  _sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const { firstName, middleName, firstNameAlternates, middleNameAlternates } = splitGivenName(
    candidate.camsRaw.firstName,
    candidate.camsRaw.middleName,
  );
  const [lastName, ...lastNameAlternates] = lastNameSurnameCandidates(candidate.camsRaw.lastName);
  candidate.camsNormalized.firstName = firstName;
  candidate.camsNormalized.middleName = middleName;
  candidate.camsNormalized.firstNameAlternates = firstNameAlternates;
  candidate.camsNormalized.middleNameAlternates = middleNameAlternates;
  candidate.camsNormalized.lastName = lastName;
  candidate.camsNormalized.lastNameAlternates = lastNameAlternates;
  return candidate;
}

/** matchName's verdict as it is stored on a candidate - quality is present only on a pass, so a
 * reader cannot mistake a failed match's quality for a real one. */
type NameMatchScore = (ScoreRecord & { pass: true; quality: NameMatchQuality }) | { pass: false };

/**
 * A candidate's name verdict. Never absent where this is called: scoreNameMatch runs for every
 * candidate the instant it is created (see addAndScoreCandidate), ahead of every scorer below it
 * in CANDIDATE_SCORERS and long before any RESOLVE stage. A candidate whose scoring threw is
 * returned unscored but sets state.error, which halts runPipeline before RESOLVE - so only
 * shouldEvictFromDiscovery, which runs on that same failure path, has to tolerate its absence.
 */
function nameMatch(candidate: PipelineCandidate): NameMatchScore {
  return mergedScore(candidate).doesNameMatch as NameMatchScore;
}

/** Both name parts matched literally - no initial, nickname, phonetic, or swap relaxation
 * anywhere. The bar every stage that trusts a name on its own requires. */
function isExactNameMatch(candidate: PipelineCandidate): boolean {
  const score = nameMatch(candidate);
  return score.pass && score.quality === 'exact';
}

type PhoneMatchScore =
  | { pass: true; quality: 'exact' }
  | { pass: true; quality: 'strong'; phoneDigitDistance: number }
  | { pass: false; phoneDigitDistance: number };

function isExactPhoneMatch(candidate: PipelineCandidate): boolean {
  const score = mergedScore(candidate).doesPhoneMatch as PhoneMatchScore | undefined;
  return score?.pass === true && score.quality === 'exact';
}

/** The surname matched outright, whatever was relaxed in the given name - so this is the same
 * family, not a surname a typo away from one. */
function hasExactSurnameMatch(candidate: PipelineCandidate): boolean {
  const score = nameMatch(candidate);
  return score.pass && score.quality !== 'weak';
}

/**
 * Scoring stage wrapping matchName. Reads sourceNormalized/camsNormalized exclusively (see
 * normalizeAcmsSourceName/normalizeCandidateNameFields, both of which must run first - see
 * CANDIDATE_SCORERS' ordering) rather than sourceRaw/camsRaw directly, so this function never
 * needs its own awareness of which normalizer produced the comparable name.
 */
function scoreNameMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const verdict = matchName(candidate.memo, sourceNormalized, candidate.camsNormalized);
  addScore(candidate, 'doesNameMatch', verdict);
  return candidate;
}

function normalizeForSimilarity(name: string): string {
  return name.toLowerCase().replaceAll("'", '').replace(/[.,-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Memoizes normalizeForSimilarity's result once per memo (the ACMS side is invariant across every
 * candidate in a record; a candidate's own name is invariant across fullNameSimilarity and
 * tokenNameMatchRate both needing it) rather than recomputing the same string transform
 * repeatedly. Fingerprints on the raw name itself (see normalize) - a memo storing only
 * function-name-keyed calls with no fingerprint would conflate two different inputs to the same
 * function into one cached result. The raw name is used as-is, no quoting/escaping - a
 * fingerprint only needs to be unique per input, not a faithfully round-trippable serialization.
 */
/**
 * Computes and caches a record's normalized composed name directly onto normalized.name (see
 * NormalizedTrustee - the ONE canonical shape both an ACMS source record and a CAMS candidate's
 * normalized data use, so this same function serves either side) rather than through the memo
 * mechanism - this value is single-valued for the whole pipeline run (neither side's own name
 * changes mid-run), so a memo Map would be the wrong shape. Idempotent by construction: a second
 * call with an already-populated normalized.name returns the cached value without recomputing.
 */
function memoizedNormalizeName(normalized: NormalizedTrustee, name: string): string {
  normalized.name ??= normalizeForSimilarity(name);
  return normalized.name;
}

/** Jaro-Winkler character-level similarity between the ACMS full name and a candidate's composed
 * name, rounded to 3 decimals - a diagnostic signal for reviewers, never used for control flow
 * (calculateNameScore's discrete field-by-field comparison remains the only scoring input). */
function fullNameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round(natural.JaroWinklerDistance(a, b) * 1000) / 1000;
}

function isInitialOf(a: string, b: string): boolean {
  return a.length === 1 && b.length > 0 && b.startsWith(a);
}

/** Whether a and b are a known nickname/formal-name pair, via name-match's getNameVariations
 * (e.g. "Bill"/"William"). Each direction is tried independently and defensively, since
 * getNameVariations throws for a name it has no variation data for at all. */
function isNicknamePair(a: string, b: string): boolean {
  try {
    if ((getNameVariations(a) as string[]).includes(b)) return true;
  } catch {
    // No variations available for a.
  }
  try {
    if ((getNameVariations(b) as string[]).includes(a)) return true;
  } catch {
    // No variations available for b.
  }
  return false;
}

/** Fraction of ACMS name tokens that find a corresponding CAMS token via exact match, initial
 * match in either direction, or a known nickname pair - a diagnostic signal for catching
 * name-part reordering or nicknames that calculateNameScore's discrete comparison misses, never
 * used for control flow. */
function tokenNameMatchRate(normalizedAcms: string, normalizedCams: string): number {
  const acmsTokens = normalizedAcms.split(' ').filter(Boolean);
  const camsTokens = normalizedCams.split(' ').filter(Boolean);
  if (acmsTokens.length === 0) return 0;
  let matched = 0;
  for (const at of acmsTokens) {
    const hit = camsTokens.some(
      (ct) => at === ct || isInitialOf(at, ct) || isInitialOf(ct, at) || isNicknamePair(at, ct),
    );
    if (hit) matched++;
  }
  return Math.round((matched / acmsTokens.length) * 1000) / 1000;
}

/**
 * Records two name-similarity DIAGNOSTIC signals onto every candidate - fullNameSimilarity
 * (character-level) and tokenNameMatchRate (token-level, nickname/reorder aware) - into
 * candidate.memo, since these are COMPUTED COMPARISONS between the ACMS and CAMS normalized names,
 * not a normalized mirror of either side's own raw field.
 *
 * - Never a ScoreEntry: neither signal gates match/skip or feeds resolution logic. They exist
 *   purely so a persisted, unresolved record's serialized state already carries the same
 *   nickname/reorder-detection hints a reviewer would otherwise have to re-derive by hand when
 *   investigating why an ACMS record didn't auto-link.
 * - The ACMS-side normalized name is computed once and reused across every candidate, since it
 *   depends only on the ACMS record, which is invariant for the whole pipeline run.
 * - Reads sourceNormalized.fullName, not sourceRaw.fullName directly, since a SCORE function reads
 *   sourceNormalized exclusively.
 */
function recordSimilarityDiagnostics(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const normalizedAcms = memoizedNormalizeName(sourceNormalized, sourceNormalized.fullName ?? '');
  const normalizedCams = memoizedNormalizeName(candidate.camsNormalized, candidate.camsRaw.name);
  const fingerprint = `${normalizedAcms}|${normalizedCams}`;
  normalize(candidate.memo, 'fullNameSimilarity', fingerprint, () =>
    fullNameSimilarity(normalizedAcms, normalizedCams),
  );
  normalize(candidate.memo, 'tokenNameMatchRate', fingerprint, () =>
    tokenNameMatchRate(normalizedAcms, normalizedCams),
  );
  return candidate;
}

/**
 * Converts a KleeneBoolean field-comparison result into the ScoreRecord shape addScore expects.
 * The caller computes null when either side has nothing comparable, true/false only when a real
 * comparison happened, and this function is never even called for the null case - ScoreRecord has
 * no way to represent "no evidence" (value/threshold/pass are all required), so null must be
 * filtered out by the caller before reaching here, not encoded into the record (see
 * ScoreByScorer).
 */
function boolMatchRecord(match: boolean): ScoreRecord {
  return { pass: match };
}

/**
 * Whether a candidate/ACMS side has ANY usable contact data at all - address1, city, state, zip,
 * or phone. Deliberately does NOT treat a missing address1/phone alone as insufficient (a real
 * city+state correlation, even with no street address or phone on file, is still a strong,
 * legitimate signal - see doesCityMatch/doesStateMatch) - only fires when literally every one
 * of these fields is blank, since that is the one shape that carries zero real evidence either
 * way. A "thin candidate" population defined any looser than this (e.g. no address1/zip/phone but
 * a real city+state) sweeps in candidates with genuine, checkable evidence, which would be unsafe
 * to treat as non-competing.
 */
function hasNoContactData(fields: {
  address1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
}): boolean {
  return !fields.address1 && !fields.city && !fields.state && !fields.zipCode && !fields.phone;
}

/** Whether the CAMS candidate carries any usable contact data at all (see hasNoContactData). */
function scoreHasAddressAndPhone(
  _sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const noContactData = hasNoContactData({
    address1: candidate.camsRaw.address?.address1,
    city: candidate.camsRaw.address?.city,
    state: candidate.camsRaw.address?.state,
    zipCode: candidate.camsRaw.address?.zipCode,
    phone: candidate.camsRaw.phone?.number,
  });
  addScore(candidate, 'doesCamsTrusteeHaveAddressAndPhone', { pass: !noContactData });
  return candidate;
}

/**
 * Memoizes whether the ACMS side has any usable contact data at all (see NormalizedMemo/normalize)
 * - caches directly onto sourceNormalized.acmsHasNoContactData (see NormalizedTrustee), the same
 * "compute once" pattern memoizedParseAcmsAddress already uses for `address` - sourceNormalized is
 * invariant across every candidate in a record, so there is exactly one ACMS record's worth of
 * this fact to compute per pipeline run.
 */
function memoizedAcmsHasNoContactData(sourceNormalized: NormalizedTrustee): boolean {
  if (sourceNormalized.acmsHasNoContactData === undefined) {
    const legacy = sourceNormalized.legacy;
    sourceNormalized.acmsHasNoContactData =
      isBlankAcmsValue(legacy?.address1) &&
      isBlankAcmsValue(legacy?.cityStateZipCountry) &&
      isBlankAcmsValue(legacy?.phone) &&
      isBlankAcmsValue(legacy?.email);
  }
  return sourceNormalized.acmsHasNoContactData;
}

/**
 * Mirrors scoreHasAddressAndPhone, but for the ACMS SOURCE record rather than each CAMS
 * candidate - the two are independent facts (a candidate can carry real contact data while the
 * ACMS record it is being matched against has none at all, or vice versa) and both need their own
 * annotation, per the original all-blank defensive rule (both CAMS and ACMS sides).
 *
 * This shape is real: an ACMS "FIRSTNAME LASTNAME" record can match a CAMS "Firstname M. Lastname"
 * candidate at calculateNameScore=100, while ACMS legacy has no address1/cityStateZipCountry at all
 * and phone is the "0" sentinel (see isBlankAcmsValue). This stage makes "no real ACMS evidence" an
 * explicit, checkable fact any RESOLVE stage can rely on, regardless of which later stage would
 * otherwise have looked at state/city/zip.
 */
function scoreAcmsHasAddressAndPhone(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const acmsHasNoContactData = memoizedAcmsHasNoContactData(sourceNormalized);
  addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', { pass: !acmsHasNoContactData });
  return candidate;
}

/**
 * Computes and caches parseCityStateZip's result for the ACMS record directly onto
 * sourceNormalized.address (see NormalizedTrustee - reuses ProjectedTrustee['address']'s own field
 * name/shape) rather than through the memo mechanism - sourceNormalized is invariant for the whole
 * record, so there is no distinct input to fingerprint, but doesStateMatch, doesCityMatch, and
 * doesZipCodeMatch would otherwise each independently re-parse the same cityStateZipCountry
 * string every time they run. A `null`/undefined parse result
 * (unparseable address) is intentionally NOT cached as a sentinel - re-parsing an unparseable
 * string is cheap, and caching "there is no result" would need its own distinct-from-undefined
 * representation. Reads sourceNormalized.legacy.cityStateZipCountry directly rather than taking it
 * as a separate parameter, now that legacy travels on sourceNormalized itself.
 */
function memoizedParseAcmsAddress(
  sourceNormalized: NormalizedTrustee,
): ReturnType<typeof parseCityStateZip> {
  if (sourceNormalized.address === undefined) {
    const parsed = parseAcmsCityStateZip(sourceNormalized.legacy?.cityStateZipCountry);
    if (!parsed) return parsed;
    sourceNormalized.address = parsed;
  }
  return sourceNormalized.address as ReturnType<typeof parseCityStateZip>;
}

/**
 * The state-agreement scorer every RESOLVE stage reads. Follows the same "no record when data is
 * unavailable" convention as doesCityMatch/doesZipCodeMatch - no override paths, no defaults: the
 * key is absent unless both sides had a state to compare, so a candidate that was never actually
 * checked can never be mistaken for one whose state genuinely agrees.
 */
/** The KleeneBoolean fact scoreStateMatch records - null when either side has no comparable
 * state, true/false only for a genuine comparison. Factored out so the "compute the fact" and
 * "decide whether to record it" steps are as explicit as pipelineMiddleNameMatch's own shape. */
function stateMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): KleeneBoolean {
  const parsedAcmsAddress = memoizedParseAcmsAddress(sourceNormalized);
  const acmsState = parsedAcmsAddress?.state?.toLowerCase();
  if (!acmsState) return null;

  const camsState = candidate.camsRaw.address?.state?.toLowerCase();
  if (!camsState) return null;

  return camsState === acmsState;
}

function scoreStateMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const match = stateMatch(sourceNormalized, candidate);
  return foldKleene(
    match,
    () => candidate,
    () => {
      addScore(candidate, 'doesStateMatch', boolMatchRecord(true));
      return candidate;
    },
    () => {
      addScore(candidate, 'doesStateMatch', boolMatchRecord(false));
      return candidate;
    },
  );
}

const CITY_ABBREVIATIONS: Record<string, string> = { ft: 'fort', mt: 'mount', st: 'saint' };

function cityTokens(city: string): string[] {
  return city
    .toLowerCase()
    .replace(/[.,'-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => CITY_ABBREVIATIONS[token] ?? token);
}

/**
 * Exact or fuzzy: equal once spaces are removed ("LasVegas"), or every word of the shorter name
 * closely matches a word of the longer ("Old San Juan").
 */
function cityMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): KleeneBoolean {
  const acms = cityTokens(memoizedParseAcmsAddress(sourceNormalized)?.city ?? '');
  const cams = cityTokens(candidate.camsRaw.address?.city ?? '');
  if (acms.length === 0 || cams.length === 0) return null;

  if (acms.join('') === cams.join('')) return true;
  const [shorter, longer] = acms.length <= cams.length ? [acms, cams] : [cams, acms];
  return shorter.every((word) =>
    longer.some((other) => natural.JaroWinklerDistance(word, other) >= FUZZY_WORD_THRESHOLD),
  );
}

function scoreCityMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const match = cityMatch(sourceNormalized, candidate);
  return foldKleene(
    match,
    () => candidate,
    () => {
      addScore(candidate, 'doesCityMatch', boolMatchRecord(true));
      return candidate;
    },
    () => {
      addScore(candidate, 'doesCityMatch', boolMatchRecord(false));
      return candidate;
    },
  );
}

/**
 * Independent zip-agreement scorer, for the sole-candidate consensus vote (see
 * resolveName*) - compares only the 5-digit zip prefix (never the +4 extension,
 * which is far more granular than a professional's on-file mailing address is likely to stay
 * current with) between the ACMS record's parsed zip and a candidate's zipCode. No record is
 * added when either side has fewer than 5 digits to compare (unparseable ACMS address, or a
 * candidate with no/blank zipCode) - same "absence is not evidence" rule as doesCityMatch.
 */
/** The KleeneBoolean fact scoreZipCodeMatch records - see stateMatch's own doc comment for why
 * this is factored out as its own named step. */
function zipCodeMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): KleeneBoolean {
  const parsedAcmsAddress = memoizedParseAcmsAddress(sourceNormalized);
  const acmsZip5 = parsedAcmsAddress?.zipCode.slice(0, 5);
  if (!acmsZip5 || acmsZip5.length < 5) return null;

  const camsZip5 = candidate.camsRaw.address?.zipCode?.slice(0, 5);
  if (!camsZip5 || camsZip5.length < 5) return null;

  return camsZip5 === acmsZip5;
}

function scoreZipCodeMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const match = zipCodeMatch(sourceNormalized, candidate);
  return foldKleene(
    match,
    () => candidate,
    () => {
      addScore(candidate, 'doesZipCodeMatch', boolMatchRecord(true));
      return candidate;
    },
    () => {
      addScore(candidate, 'doesZipCodeMatch', boolMatchRecord(false));
      return candidate;
    },
  );
}

function scoreEmailMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  return foldKleene(
    emailMatch(sourceNormalized.legacy?.email, candidate.camsRaw.email),
    () => candidate,
    () => {
      addScore(candidate, 'doesEmailMatch', boolMatchRecord(true));
      return candidate;
    },
    () => {
      addScore(candidate, 'doesEmailMatch', boolMatchRecord(false));
      return candidate;
    },
  );
}

/** Phones this many digits apart or fewer are a likely typo, graded a 'strong' match. */
const PHONE_TYPO_MAX_DIGIT_DISTANCE = 2;

/** Count of differing digit positions between the last 10 digits of two phone numbers (mirrors
 * calculatePhoneScore's own comparability rule). Both numbers are always exactly 10 digits once
 * comparable, so a simple position-by-position count is sufficient - no insertions/deletions are
 * possible once both sides are fixed at the same length, unlike a general edit-distance problem.
 * @returns null if either side isn't a full, comparable 10-digit number - not comparable. */
function phoneDigitDistance(
  dxtrPhone: string | undefined,
  camsPhone: string | undefined,
): number | null {
  const dxtrDigits = (dxtrPhone ?? '').replace(/\D/g, '').slice(-10);
  const camsDigits = (camsPhone ?? '').replace(/\D/g, '').slice(-10);
  if (dxtrDigits.length < 10 || camsDigits.length < 10) return null;

  let distance = 0;
  for (let i = 0; i < 10; i++) {
    if (dxtrDigits[i] !== camsDigits[i]) distance++;
  }
  return distance;
}

const FUZZY_WORD_THRESHOLD = 0.9;

/** Below this street closeness, the street line adds no points. */
const STREET_CLOSENESS_FLOOR = 0.5;

const STREET_POINTS = 3;
const GEO_POINTS = 3;

function streetTokens(lines: (string | undefined)[]): string[] {
  return normalizeAddressLine(lines.filter(Boolean).join(' '))
    .replace(/\bpo box\b/g, 'pobox')
    .split(' ')
    .filter(Boolean)
    .map((token) => (/^\d+$/.test(token) ? token.replace(/^0+(?=\d)/, '') : token));
}

function tokenCloseness(a: string, b: string): number {
  const aIsNumber = /^\d+$/.test(a);
  const bIsNumber = /^\d+$/.test(b);
  if (aIsNumber || bIsNumber) return a === b ? 1 : 0;
  const similarity = natural.JaroWinklerDistance(a, b);
  return similarity >= FUZZY_WORD_THRESHOLD ? similarity : 0;
}

function averageBestMatch(from: string[], to: string[]): number {
  const total = from.reduce(
    (sum, token) => sum + Math.max(...to.map((other) => tokenCloseness(token, other))),
    0,
  );
  return total / from.length;
}

/** 0..1, averaged in both directions so extra tokens on either side lower it. */
function streetCloseness(acms: string[], cams: string[]): number | null {
  if (acms.length === 0 || cams.length === 0) return null;
  return (averageBestMatch(acms, cams) + averageBestMatch(cams, acms)) / 2;
}

function geoPoints(scores: ScoreByScorer): number | null {
  const city = scores.doesCityMatch?.pass;
  const state = scores.doesStateMatch?.pass;
  const zip = scores.doesZipCodeMatch?.pass;
  if (city === undefined && state === undefined && zip === undefined) return null;

  const dominant = (city === true && state === true) || zip === true;
  const signed = (match: boolean | undefined) => (match === undefined ? 0 : match ? 1 : -1);
  const components = signed(city) + signed(state) + (zip === true ? 1 : 0);
  return Math.max(0, Math.min(GEO_POINTS, dominant ? GEO_POINTS : components));
}

type AddressMatchQuality = 'exact' | 'strong' | 'moderate' | 'weak';

type AddressMatchScore =
  | { pass: true; quality: AddressMatchQuality; points: number; streetCloseness?: number }
  | { pass: false; points: number; streetCloseness?: number };

function gradeAddress(points: number): AddressMatchQuality | undefined {
  if (points >= GEO_POINTS + STREET_POINTS) return 'exact';
  if (points > GEO_POINTS) return 'strong';
  if (points === GEO_POINTS) return 'moderate';
  if (points > 0) return 'weak';
  return undefined;
}

/**
 * Grades the address like doesNameMatch grades the name. Geography scores up to 3: city and state
 * agreeing, or the zip agreeing, is worth 3 on its own; otherwise city and state each add 1 or
 * subtract 1 and a zip match adds 1. The street line adds its closeness times 3. Nothing is
 * recorded when no part of the address was comparable.
 */
function scoreAddressMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const geo = geoPoints(mergedScore(candidate));
  const closeness = streetCloseness(
    streetTokens([sourceNormalized.legacy?.address1, sourceNormalized.legacy?.address2]),
    streetTokens([candidate.camsRaw.address?.address1, candidate.camsRaw.address?.address2]),
  );
  if (geo === null && closeness === null) return candidate;

  const street =
    closeness !== null && closeness >= STREET_CLOSENESS_FLOOR ? closeness * STREET_POINTS : 0;
  const points = Math.round(((geo ?? 0) + street) * 100) / 100;
  const quality = gradeAddress(points);
  const detail = closeness === null ? {} : { streetCloseness: Math.round(closeness * 1000) / 1000 };
  const verdict: AddressMatchScore = quality
    ? { pass: true, quality, points, ...detail }
    : { pass: false, points, ...detail };
  addScore(candidate, 'doesAddressMatch', verdict);
  return candidate;
}

function addressMatch(candidate: PipelineCandidate): AddressMatchScore | undefined {
  return mergedScore(candidate).doesAddressMatch as AddressMatchScore | undefined;
}

/**
 * Grades the phone like doesNameMatch grades the name: identical numbers are an 'exact' match, a
 * likely data-entry typo (see PHONE_TYPO_MAX_DIGIT_DISTANCE) is a 'strong' match, anything further
 * apart is an explicit no-match. Nothing is recorded when either phone is not comparable - that is
 * neutral, not a no-match.
 */
function scorePhoneMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const distance = phoneDigitDistance(
    sourceNormalized.legacy?.phone,
    candidate.camsRaw.phone?.number,
  );
  if (distance === null) return candidate;

  const verdict: PhoneMatchScore =
    distance === 0
      ? { pass: true, quality: 'exact' }
      : distance <= PHONE_TYPO_MAX_DIGIT_DISTANCE
        ? { pass: true, quality: 'strong', phoneDigitDistance: distance }
        : { pass: false, phoneDigitDistance: distance };
  addScore(candidate, 'doesPhoneMatch', verdict);
  return candidate;
}

/**
 * A single per-candidate scorer - the uniform per-candidate counterpart to Stage
 * (trustee-match-pipeline.ts), narrower by deliberate design: a pool-level Stage takes/returns the
 * whole PipelineState, while a CandidateScorer takes/returns only sourceNormalized (read-only, the
 * ACMS side's normalized record - never sourceRaw, which stays protected from candidate-scoring
 * code entirely) and the one candidate it scores. Every scorer in CANDIDATE_SCORERS shares this
 * shape so scoreCandidate can compose them as a plain reduce, exactly like runPipeline composes
 * Stage[] - a scorer is added to the sequence, never called ad hoc from somewhere else.
 */
type CandidateScorer = (
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
) => PipelineCandidate;

/**
 * The ordered sequence every candidate runs through the instant it's discovered (see
 * addAndScoreCandidate) - not a Stage[] (Stage is pool-shaped, iterating state.candidates; this is
 * deliberately per-candidate). Every candidate is fully scored the instant it exists; RESOLVE
 * stages are pure readers of mergedScore(candidate) and never compute a new score themselves.
 *
 * Order matters past scoreNameMatch: every scorer after it reads doesNameMatch (directly, or via a
 * gate like "nameScore===100"), so it must run first. The address/phone presence annotations run
 * first only to mirror this list's own reading order - none of THEM has a real dependency on
 * being first.
 */
const CANDIDATE_SCORERS: CandidateScorer[] = [
  // NORMALIZE CAMS - must run before any scorer below reads candidate.camsNormalized.
  normalizeCandidateNameFields,
  scoreHasAddressAndPhone,
  scoreAcmsHasAddressAndPhone,
  scoreNameMatch,
  recordSimilarityDiagnostics,
  scoreCityMatch,
  scoreStateMatch,
  scoreZipCodeMatch,
  scoreAddressMatch, // reads doesCityMatch/doesStateMatch/doesZipCodeMatch - must run after them
  scorePhoneMatch,
  scoreEmailMatch,
];

/**
 * Runs CANDIDATE_SCORERS against ONE candidate, immediately - the per-candidate counterpart to
 * runPipeline (trustee-match-pipeline.ts): the same reduce-over-an-ordered-list shape, narrowed to
 * CandidateScorer's signature. Unlike runPipeline, no terminal-outcome guard is needed here - a
 * candidate's scores are data recorded ON it, not a control-flow signal the way
 * state.match/skip/error is at the pool level, so every scorer in CANDIDATE_SCORERS always runs,
 * in order, with no early exit.
 *
 * A candidate discovered by a second RECALL tier for the same trusteeId gets re-scored here
 * (addCandidate's own idempotency only prevents a SECOND PipelineCandidate object from being
 * created, not a second scoreCandidate call) - safe and cheap: every addScore call below
 * overwrites its own key with an identical value, and the underlying comparisons are memoized per
 * candidate (see NormalizedMemo), so nothing expensive actually recomputes.
 */
export function scoreCandidate(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  let result = candidate;
  for (const scorer of CANDIDATE_SCORERS) {
    result = scorer(sourceNormalized, result);
  }
  return result;
}

/**
 * Whether a freshly-scored candidate should be evicted from state.candidates before any RESOLVE
 * stage, or any later discovery tier, ever sees it - a real, comparable state disagreement
 * (doesStateMatch?.pass === false, set only when BOTH sides have comparable state data - see
 * scoreStateMatch's own "no record when data unavailable" convention) with no real name evidence to
 * counterbalance it (doesNameMatch?.pass !== true).
 *
 * Reads doesNameMatch directly rather than reimplementing first/last-name plausibility here - an
 * earlier version of this function called isExactLastNameMatch + a fresh isFuzzyNamePartMatch call,
 * which is a NARROWER, less capable duplicate of what pipelineNameScore already does (it doesn't
 * know about isFirstMiddleSwap/isOneSidedMiddleNameMatch's swap handling) - confirmed as a real
 * regression via pipeline-replay-backtest.ts against the 2026-09-25 export: a candidate with
 * doesNameMatch=85/pass:true (a genuine first-name-as-middle-name swap) AND an exact phone-number
 * match was wrongly evicted, because its ACMS first name ("Ryan") only fuzzy-matched against the
 * CAMS side's leading initial ("F."), not its real given name recorded as the middle position. The
 * real, already-computed doesNameMatch score already knows about this shape; re-deriving a narrower
 * version of the same judgment here can only ever be equally correct or worse.
 *
 * An even narrower exact-last-name-only exception (tested and rejected before this version) was
 * TOO permissive in the opposite direction: last name alone matches dozens of unrelated candidates
 * for a common surname (e.g. "Smith") - confirmed via the same backtest (2158 records regained a
 * candidate pool they had zero or one candidate in before, purely from unrelated same-surname
 * trustees). doesNameMatch.pass required BOTH a real last-name match and a real first-name
 * relationship (exact, nickname, initial, or swap) to ever reach true, so it closes both failure
 * modes at once without any additional logic here.
 *
 * This is the fix for the "hundreds of low-quality candidates for a common surname" volume problem
 * at its real source: recallBySurnameExact/recallByTokenIntersection/recallByAnchoredLevenshtein's
 * own discovery, not a later reduce over an already-bloated state.candidates. A candidate this
 * function evicts never occupies a Map entry, is never iterated by resolveStages(), and is never a
 * promotion candidate for runNestedTier to consider - the outer pipeline's state graph never sees
 * it at all. A real state conflict with a genuine name match still has every later RESOLVE-stage
 * corroboration safeguard protecting it from a false auto-link - eviction here is a coarse, cheap,
 * EARLY cut for candidates with no
 * plausible relationship at all, not a final verdict.
 *
 * Deliberately does NOT also exempt MIDDLE_NAME_ONLY_CONFLICT_SCORE (15) - tried and reverted:
 * unlike doesNameMatch.pass===true (which requires a real, specific first-name relationship -
 * exact, nickname, initial, or swap - to a SPECIFIC candidate), a bare nameScore===15 check has no
 * such specificity requirement and readmits every candidate sharing the ACMS record's last name AND
 * clearing scoreFirstNamePart's >=85 bar, which multiple genuinely different, unrelated real people
 * can do at once for a common first+last name pair - confirmed via pipeline-replay-backtest.ts
 * against the 2026-09-25 export: a real record synthesized here as ACMS "Robert [Surname]" had
 * THREE distinct CAMS candidates - "Robert [Surname]", "Robert E. [Surname]", and two
 * "Robert S. [Surname]" variants - all independently scoring nameScore=15 against different,
 * unrelated middle names/generational suffixes, none of them the same person. The 12-record
 * zero-candidate population this would have helped (see MIDDLE_NAME_ONLY_CONFLICT_SCORE's own doc
 * comment for the shape) needs a fix that also confirms uniqueness among same-nameScore candidates,
 * not just this function's own coarse pre-filter - left as a separate, not-yet-implemented
 * follow-up rather than risking readmitting real collisions here.
 */
function shouldEvictFromDiscovery(candidate: PipelineCandidate): boolean {
  if (candidate.scores.doesStateMatch?.pass !== false) return false;
  return candidate.scores.doesNameMatch?.pass !== true;
}

/**
 * addCandidate, plus an immediate full scoreCandidate pass - the ONLY way a new candidate should
 * enter the pipeline going forward. `origin` is the calling RECALL stage's own name (e.g.
 * "recallBySurnameExact"). A candidate shouldEvictFromDiscovery flags is removed from
 * state.candidates before this function returns - see that function's own doc comment for why
 * eviction belongs here, at the single real entry point, rather than duplicated per RECALL stage
 * or deferred to a later reduce over an already-bloated pool.
 *
 * - Every CandidateScorer is expected to be pure and should never throw in practice - this
 *   try/catch is a safety net for a genuine, unanticipated runtime error, not a primary code path.
 * - Catches here rather than letting it propagate, since this is called fire-and-forget from
 *   inside each RECALL stage's own discovery loop - those stages have no other way to observe a
 *   candidate-scoring failure. Mirrors the SAME getCamsErrorWithStack construction every RECALL
 *   stage's own repository failure already uses, so state.error is always the same shape
 *   regardless of which layer failed.
 * - Assigns state.error in place, consistent with addCandidate's own in-place mutation of
 *   state.candidates - runPipeline checks state.error before invoking the next stage, so a failure
 *   here still halts the pipeline exactly like a RECALL stage's own caught failure would.
 * - Returns the (possibly now-evicted) candidate either way - a caller like
 *   recallByTokenIntersection that immediately calls addScore on the return value is mutating an
 *   already-detached object in that case, which is harmless (nothing reads it again) but avoids
 *   every call site needing its own null-check.
 */
export function addAndScoreCandidate(
  state: PipelineState,
  camsRaw: ProjectedTrustee,
  origin: string,
): PipelineCandidate {
  const candidate = addCandidate(state, camsRaw, origin);
  try {
    const scored = scoreCandidate(state.sourceNormalized, candidate);
    if (shouldEvictFromDiscovery(scored)) {
      state.candidates.delete(camsRaw.trusteeId);
    }
    return scored;
  } catch (originalError) {
    state.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: { module: MODULE_NAME, message: 'addAndScoreCandidate failed' },
    });
    return candidate;
  }
}

const NAME_QUALITY_RANK: Record<NameMatchQuality, number> = { exact: 0, strong: 1, weak: 2 };

function nameQualityRank(candidate: PipelineCandidate): number {
  const score = nameMatch(candidate);
  return score.pass ? NAME_QUALITY_RANK[score.quality] : Number.MAX_SAFE_INTEGER;
}

type Ranking = (a: PipelineCandidate, b: PipelineCandidate) => number;

const byNameQuality: Ranking = (a, b) => nameQualityRank(a) - nameQualityRank(b);

const byAddressPointsThenNameQuality: Ranking = (a, b) =>
  (addressMatch(b)?.points ?? 0) - (addressMatch(a)?.points ?? 0) || byNameQuality(a, b);

/** The single best-ranked survivor, or undefined when there are none or the top rank is a tie. */
function uniqueBest(
  survivors: PipelineCandidate[],
  ranking: Ranking,
): PipelineCandidate | undefined {
  const [best, runnerUp] = [...survivors].sort(ranking);
  if (!best || (runnerUp && ranking(best, runnerUp) === 0)) return undefined;
  return best;
}

function resolveOnCandidate(
  state: PipelineState,
  candidate: PipelineCandidate | undefined,
  resolvedBy: string,
): PipelineState {
  if (!candidate) return state;
  return {
    ...state,
    match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores, resolvedBy },
  };
}

function nameQualifies(candidate: PipelineCandidate): boolean {
  return nameMatch(candidate).pass;
}

export function resolveByPhone(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter((c) => nameQualifies(c) && isExactPhoneMatch(c));
    return resolveOnCandidate(state, uniqueBest(survivors, byNameQuality), 'resolveByPhone');
  };
}

export function resolveByEmailAddress(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter(
      (c) => nameQualifies(c) && mergedScore(c).doesEmailMatch?.pass === true,
    );
    return resolveOnCandidate(state, uniqueBest(survivors, byNameQuality), 'resolveByEmailAddress');
  };
}

export function resolveByPhoneWithTypo(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter(
      (c) => isExactNameMatch(c) && mergedScore(c).doesPhoneMatch?.quality === 'strong',
    );
    return resolveOnCandidate(
      state,
      uniqueBest(survivors, byNameQuality),
      'resolveByPhoneWithTypo',
    );
  };
}

/** Moderate or better: the area agrees, by city and state or by zip, or the street line does. */
export function resolveByAddress(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter(
      (c) => nameQualifies(c) && (addressMatch(c)?.points ?? 0) >= GEO_POINTS,
    );
    return resolveOnCandidate(
      state,
      uniqueBest(survivors, byAddressPointsThenNameQuality),
      'resolveByAddress',
    );
  };
}

/** State agreement is the only signal, so a weak name never survives. */
export function resolveByStateOnly(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter(
      (c) => hasExactSurnameMatch(c) && mergedScore(c).doesStateMatch?.pass === true,
    );
    return resolveOnCandidate(state, uniqueBest(survivors, byNameQuality), 'resolveByStateOnly');
  };
}

/**
 * The only resolver that requires a single candidate: being the only name match is the signal.
 * Runs last.
 */
export function resolveByNameOnly(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const nameMatches = candidatePool(state).filter(nameQualifies);
    if (nameMatches.length !== 1) return state;

    const [candidate] = nameMatches;
    if (!isExactNameMatch(candidate)) return state;
    if (mergedScore(candidate).doesStateMatch?.pass === false) return state;
    if (mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass === false) return state;

    return resolveOnCandidate(state, candidate, 'resolveByNameOnly');
  };
}
