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
 * High enough that JaroWinkler's prefix bonus can't pass surnames sharing only a leading particle
 * or a near-miss ("Van Doe"/"Van Roe" 0.81, "Smit"/"Smyt" 0.86). "Meier"/"Meyer" (0.87) is an
 * accepted miss.
 */
const FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD = 0.88;

/** Whether two surnames are plausibly spelling variants: JaroWinkler OR SoundEx/Metaphone. */
function isFuzzyNamePartMatch(acmsNamePart: string, camsNamePart: string): boolean {
  const a = acmsNamePart.toLowerCase();
  const b = camsNamePart.toLowerCase();
  if (natural.JaroWinklerDistance(a, b) >= FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD) return true;

  const soundex = new natural.SoundEx();
  const metaphone = new natural.Metaphone();
  return soundex.compare(a, b) || metaphone.compare(a, b);
}

/** Memoized on the candidate, so the comparison is also kept in its persisted evidence. */
function memoizedIsFuzzyNamePartMatch(
  memo: NormalizedMemo,
  acmsNamePart: string,
  camsNamePart: string,
): boolean {
  return normalize(memo, 'isFuzzyNamePartMatch', `${acmsNamePart}|${camsNamePart}`, () =>
    isFuzzyNamePartMatch(acmsNamePart, camsNamePart),
  );
}

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
 * A first or middle name part's match quality: 'exact' for identical strings; 'strong' for a
 * consistent initial, a known nickname pair, or a close spelling; 'none' for no relationship or an
 * empty side. A bare initial that fails the initial check is 'none' before the distance check runs,
 * since a short name scores high against any single letter.
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
 * matchName's graded verdict, present only on a pass: 'exact' when every compared field matched
 * literally; 'strong' when the surname matched but a given name was relaxed (initial, nickname,
 * swap); 'weak' when the surname itself only matched fuzzily.
 */
type NameMatchQuality = 'exact' | 'strong' | 'weak';

type NameMatchVerdict = { pass: true; quality: NameMatchQuality } | { pass: false };

const NO_MATCH: NameMatchVerdict = { pass: false };

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
 * A multi-token middle name is glued into one token, so any of its individual tokens
 * (middleNameAlternates) may answer for the field.
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

/**
 * The name verdict every RESOLVE stage reads. A fuzzy surname counts only alongside an exact first
 * name; both sides must already be normalized.
 */
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
    // A conflicting middle name plus a relaxed first name leaves only the surname matching.
    return NO_MATCH;
  }

  // An exact first name outweighs a conflicting middle name, the least reliable name part; the
  // verdict drops to 'strong' so resolvers requiring an exact name still decline.
  const exact = firstQuality === 'exact' && middleQuality !== 'strong' && !middleConflicts;
  return { pass: true, quality: exact ? 'exact' : 'strong' };
}

const VALID_STATE_CODES = new Set(usStates.map((s) => s.code));

/**
 * parseCityStateZip, plus a fallback for a zipless "CITY ST" address common in ACMS. The shared
 * parser stays strict because DXTR paths use it. A recovered address has zipCode ''.
 */
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

/** Case-insensitive email equality; null when either side has no email. */
function emailMatch(sourceEmail: string | undefined, camsEmail: string | undefined): KleeneBoolean {
  const sourceNormalized = (sourceEmail ?? '').trim().toLowerCase();
  const camsNormalized = (camsEmail ?? '').trim().toLowerCase();
  if (!sourceNormalized || !camsNormalized) return null;
  return sourceNormalized === camsNormalized;
}

/**
 * NORMALIZE stage: recovers the ACMS source's real name parts from known data-quality issues, then
 * reduces them for comparison, writing to sourceNormalized and leaving sourceRaw untouched. The
 * primary surname reduction goes to lastName and the rest to lastNameAlternates, so recall can try
 * each. Pure and idempotent.
 */
export function normalizeAcmsSourceName(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    // Both recoveries read pre-strip text: stripAdministrativeMarkers removes the "LAST, FIRST"
    // comma and the digit ("TACOMACH13") their detection depends on.
    const roleSwapRecovered = recoverLastFirstRoleSwap(
      state.sourceRaw.firstName ?? '',
      state.sourceRaw.lastName ?? '',
    );
    const corruptionRecovered = recoverCorruptedFirstName(
      roleSwapRecovered.firstName,
      roleSwapRecovered.lastName,
    );
    // The parenthetical is stripped from the primary name but kept as an alternate below.
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
 * The source record in raw shape with the recovered name parts substituted in, for the
 * DXTR-shared recall helpers (matchTrusteeByName, tokenizeNameForIntersection). fullName is
 * recomposed only when a name part changed.
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
 * Sets state.skip when the source names no real person, is disavowed by ACMS ("DO NOT USE",
 * "DUPLICATE", ...), or is U.S. Trustee staff. Reads sourceRaw, since normalization can move or
 * strip the markers these checks look for.
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

/** Trustees whose surname matches the normalized source lastName or any of its alternates. */
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

/** RECALL stage adding every surname-exact candidate. */
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
 * RECALL stage adding every trustee matchTrusteeByName returns, whether 'resolved' or
 * 'ambiguous'; the resolve stages decide.
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

/** A shorter fuzzy token has too many trustees within the edit distance to be useful. */
const ANCHORED_LEVENSHTEIN_MIN_FUZZ_TOKEN_LENGTH = 3;

const ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE = 2;

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
 * RECALL stage adding trustees found by every one of the source name's tokens, recording the token
 * count as a score.
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
 * RECALL stage anchoring one name part on an exact match and allowing the other within a small
 * edit distance, recorded as a score. No trustee can survive both anchor directions, so each has
 * one distance.
 */
export function recallByAnchoredLevenshtein(context: ApplicationContext): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const acmsFirst = state.sourceNormalized.firstName ?? '';
    const acmsLast = state.sourceNormalized.lastName ?? '';
    if (!acmsFirst || !acmsLast) return state;

    const trusteesRepo = factory.getTrusteesRepository(context);
    const candidatesById = new Map<string, { trustee: Trustee; editDistance: number }>();

    // Returns rather than throws a failure, so it lands on state.error.
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

/** Generational suffixes and ACMS placeholder junk, which are not given-name tokens. */
const NON_GIVEN_NAME_TOKENS = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'x']);

function givenNameTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .filter((token) => !NON_GIVEN_NAME_TOKENS.has(token));
}

/**
 * Re-derives firstName/middleName from the two fields joined, so how a source divided them never
 * makes two records differ. A parenthetical becomes firstNameAlternates instead of a middle token.
 */
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

/** Applies the source side's name reduction to a candidate's camsNormalized. */
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
 * A candidate's name verdict, always present by RESOLVE: a candidate whose scoring threw sets
 * state.error, which halts the pipeline first.
 */
function nameMatch(candidate: PipelineCandidate): NameMatchScore {
  return mergedScore(candidate).doesNameMatch as NameMatchScore;
}

/** Every compared name part matched literally. */
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

/** The surname matched outright, whatever was relaxed in the given name. */
function hasExactSurnameMatch(candidate: PipelineCandidate): boolean {
  const score = nameMatch(candidate);
  return score.pass && score.quality !== 'weak';
}

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

/** Computes a record's similarity-normalized name once, caching it on normalized.name. */
function memoizedNormalizeName(normalized: NormalizedTrustee, name: string): string {
  normalized.name ??= normalizeForSimilarity(name);
  return normalized.name;
}

/** JaroWinkler similarity of two full names, rounded to 3 decimals. Diagnostic only. */
function fullNameSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  return Math.round(natural.JaroWinklerDistance(a, b) * 1000) / 1000;
}

function isInitialOf(a: string, b: string): boolean {
  return a.length === 1 && b.length > 0 && b.startsWith(a);
}

/** Whether a and b are a known nickname pair ("Bill"/"William"). getNameVariations throws for a
 * name it has no data for, so each direction is guarded. */
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

/** Fraction of ACMS name tokens matching some CAMS token exactly, as an initial, or as a known
 * nickname. Diagnostic only. */
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
 * Records fullNameSimilarity and tokenNameMatchRate in candidate.memo for reviewers. Neither is a
 * score; no resolver reads them.
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

function boolMatchRecord(match: boolean): ScoreRecord {
  return { pass: match };
}

/** True only when every contact field is blank; a city and state alone still count as data. */
function hasNoContactData(fields: {
  address1?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
}): boolean {
  return !fields.address1 && !fields.city && !fields.state && !fields.zipCode && !fields.phone;
}

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

function scoreAcmsHasAddressAndPhone(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const acmsHasNoContactData = memoizedAcmsHasNoContactData(sourceNormalized);
  addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', { pass: !acmsHasNoContactData });
  return candidate;
}

/** Parses the ACMS address once, caching it on sourceNormalized.address. An unparseable address
 * is not cached and is simply re-parsed. */
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

/** Compares only the 5-digit zip; null when either side lacks one. */
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

/** Count of differing digit positions in the last 10 digits of two phone numbers.
 * @returns null if either side has fewer than 10 digits. */
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

/** The per-candidate counterpart to Stage: reads only sourceNormalized and scores one candidate. */
type CandidateScorer = (
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
) => PipelineCandidate;

/**
 * Scorers every candidate runs through when discovered; RESOLVE stages only read the results.
 * Order matters where noted.
 */
const CANDIDATE_SCORERS: CandidateScorer[] = [
  // Must run before any scorer below reads candidate.camsNormalized.
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
 * Runs every CANDIDATE_SCORERS entry against one candidate, in order. Re-scoring a rediscovered
 * candidate is safe: each scorer overwrites its own key with the same result.
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
 * A candidate whose state conflicts and whose name does not pass is dropped at discovery, keeping
 * a common surname's pool small. A coarse early cut, not a verdict.
 */
function shouldEvictFromDiscovery(candidate: PipelineCandidate): boolean {
  if (candidate.scores.doesStateMatch?.pass !== false) return false;
  return candidate.scores.doesNameMatch?.pass !== true;
}

/**
 * The only way a candidate enters the pipeline: adds, scores, and evicts it if
 * shouldEvictFromDiscovery says so. A scoring failure lands on state.error, halting the pipeline.
 * Always returns the candidate, even if evicted, so callers need no null check.
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

/** An exact phone match with a passing name. */
export function resolveByPhone(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter((c) => nameQualifies(c) && isExactPhoneMatch(c));
    return resolveOnCandidate(state, uniqueBest(survivors, byNameQuality), 'resolveByPhone');
  };
}

/** An email match with a passing name. */
export function resolveByEmailAddress(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const survivors = candidatePool(state).filter(
      (c) => nameQualifies(c) && mergedScore(c).doesEmailMatch?.pass === true,
    );
    return resolveOnCandidate(state, uniqueBest(survivors, byNameQuality), 'resolveByEmailAddress');
  };
}

/** A likely-typo phone match, trusted only with an exact name. */
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
 * The only resolver that requires a single candidate: being the only exact name match is the
 * signal. Weaker name matches are not rivals. Runs last.
 */
export function resolveByNameOnly(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const exactNames = candidatePool(state).filter(isExactNameMatch);
    if (exactNames.length !== 1) return state;

    const [candidate] = exactNames;
    if (mergedScore(candidate).doesStateMatch?.pass === false) return state;
    if (mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass === false) return state;

    return resolveOnCandidate(state, candidate, 'resolveByNameOnly');
  };
}
