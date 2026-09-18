import * as natural from 'natural';
import { getNameVariations } from 'name-match/src/name-normalizer';
import { ApplicationContext } from '../../adapters/types/basic';
import { Trustee } from '@common/cams/trustees';
import { DxtrTrusteeParty } from '@common/cams/dataflow-events';
import { Address, PhoneNumber } from '@common/cams/contact';
import factory from '../../factory';
import {
  calculateNumericTokenScore,
  CONTACT_CORROBORATION_ADDRESS_THRESHOLD,
  CONTACT_CORROBORATION_NAME_THRESHOLD,
  firstLastNameToken,
  isBlankAcmsValue,
  isFirstMiddleSwap,
  isOneSidedMiddleNameMatch,
  jaccardSimilarity,
  lastNameSurnameCandidates,
  lastNameTokensMatch,
  matchTrusteeByName,
  normalizeAddressLine,
  normalizeNamePart,
  padSingleDigitNumericToken,
  parseCityStateZip,
  scoreFirstNamePart,
  STATE_OVERRIDE_MIN_NAME_SCORE,
  tokenizeNameForIntersection,
} from './trustee-match.helpers';
import { generateBigrams } from '../../adapters/utils/phonetic-helper';
import {
  recoverCorruptedFirstName,
  recoverSoloPracticeName,
  shouldSkipAsNotAPerson,
  splitCompoundFirstName,
  stripAdministrativeMarkers,
} from './sync-acms-professional-ids';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import {
  addCandidate,
  addDisqualifier,
  addScore,
  mergedScore,
  normalize,
  NormalizedMemo,
  NormalizedTrustee,
  ProjectedTrustee,
  projectTrustee,
  runPipeline,
  ScoreByScorer,
  ScoreRecord,
  TrusteePipelineCandidate as PipelineCandidate,
  TrusteePipelineState as PipelineState,
  TrusteeStage as Stage,
} from './trustee-match-pipeline';

const MODULE_NAME = 'TRUSTEE-MATCH-PIPELINE-STAGES';

/**
 * Whether two name parts (a first name, or a full - non-initial - middle name) are plausibly the
 * same underlying name, tolerating either a nickname/truncation (JaroWinkler) or a spelling
 * variant (SoundEx/Metaphone phonetic match) - neither alone is reliable (see the real-world
 * false positives/negatives documented on scoreFuzzyFirstNameMatch and pipelineMiddleNameScore),
 * so this ORs both families together. Never trusted as a sole decisive signal by any caller -
 * every caller still requires independent geography or contact corroboration (see
 * isCorroboratedByGeoOrContact) before resolving, specifically because of the Joseph/Joshua false
 * positive documented on scoreFuzzyFirstNameMatch.
 */
const FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD = 0.8;

function isFuzzyNamePartMatch(acmsNamePart: string, camsNamePart: string): boolean {
  const a = acmsNamePart.toLowerCase();
  const b = camsNamePart.toLowerCase();
  if (natural.JaroWinklerDistance(a, b) >= FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD) return true;

  const soundex = new natural.SoundEx();
  const metaphone = new natural.Metaphone();
  return soundex.compare(a, b) || metaphone.compare(a, b);
}

/**
 * Memoizes isFuzzyNamePartMatch per candidate (see normalize/NormalizedMemo) - a candidate can be
 * scored more than once across nested pipeline tiers (see
 * docs/architecture/decision-records/TrusteeMatchingPipeline.md on nesting) against the SAME
 * ACMS record, and JaroWinklerDistance plus two phonetic algorithms is real work worth not
 * repeating for an identical (acms, cams) name-part pair.
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

function isBareInitial(namePart: string): boolean {
  return namePart.length === 1;
}

/**
 * ACMS-pipeline-only middle-name scorer, replacing calculateNameScore's scoreMiddleNamePart for
 * the sole-candidate consensus path. scoreMiddleNamePart treats two POPULATED, DIFFERING middle
 * names as a flat 15-point conflict regardless of why they differ - a real spelling typo
 * (Jeffery/Jeffrey) scores exactly the same as a genuinely conflicting middle initial (T vs B).
 * Confirmed via a CAMS-876 backtest: 28 sole-candidate records ALL score nameScore=15 this way
 * (Math.min(firstScore, middleScore) with middleScore pinned at 15), including cases the AI
 * screener confirmed as real matches.
 *
 * Two relaxations, both still scored (never an automatic pass) so resolveByLastNameOnlyConsensus's
 * vote can weigh them alongside independent contact corroboration - exactly the same "never
 * trust one signal alone" posture as scoreFuzzyFirstNameMatch, and for the same reason (a bare
 * initial or a fuzzy match is real but not certain evidence):
 *   - Either side a BARE INITIAL that doesn't match the other side's leading character: NEUTRAL
 *     (100), not a conflict - a bare initial carries too little information to call it a
 *     disagreement (e.g. dxtr "T" vs cams "B" could just as easily be two different real middle
 *     names for the same person as it could be two different people).
 *   - Both sides a FULL (non-initial) middle name that differs: scored via isFuzzyNamePartMatch
 *     (85 if plausibly the same name, 15 if not) instead of an automatic 15 - the same
 *     nickname/typo tolerance scoreFuzzyFirstNameMatch already gives first names.
 * Exact match and either-side-missing still behave exactly like scoreMiddleNamePart (100 in both
 * cases - absence isn't evidence, agreement is full credit).
 */
function pipelineMiddleNameScore(
  memo: NormalizedMemo,
  dxtrMiddle: string,
  camsMiddle: string,
): number {
  if (!dxtrMiddle || !camsMiddle) return 100;
  if (dxtrMiddle === camsMiddle) return 100;
  if (isBareInitial(dxtrMiddle) || isBareInitial(camsMiddle)) return 100;
  return memoizedIsFuzzyNamePartMatch(memo, dxtrMiddle, camsMiddle) ? 85 : 15;
}

/**
 * ACMS-pipeline-only orchestration of calculateNameScore's exact scoring logic, built from the
 * same atomic, exported pieces calculateNameScore itself uses (lastNameTokensMatch,
 * scoreFirstNamePart, isFirstMiddleSwap, isOneSidedMiddleNameMatch) rather than calling
 * calculateNameScore directly - calculateNameScore is shared with the DXTR trustee-appointment
 * dataflow (sync-trustee-case-appointments.ts), so this pipeline never calls it, to guarantee an
 * ACMS-only tuning change can never ripple into that unrelated call path. Diverges from
 * calculateNameScore in exactly one place: middle-name scoring uses pipelineMiddleNameScore (see
 * its doc comment) instead of the shared scoreMiddleNamePart, since ACMS-specific middle-name
 * tolerance has no business affecting DXTR's call path either.
 *
 * Takes sourceNormalized/camsNormalized directly (NormalizedTrustee, not DxtrTrusteeParty/
 * Trustee) - firstLastNameToken/normalizeNamePart already ran once, in normalizeAcmsSourceName/
 * normalizeCandidateNameFields respectively (see CANDIDATE_SCORERS' ordering), so this function reads
 * already-comparable values rather than re-deriving them. lastNameTokensMatch's raw-field
 * fallback (see its own doc comment) still needs the UNREDUCED lastName strings to try the
 * prepended-surname/hyphenated-compound recovery, which sourceRaw/camsRaw (not sourceNormalized/
 * camsNormalized) hold - the one place this function still reads the raw side, since that raw
 * text is genuinely a different, wider input than the token this function otherwise compares.
 */
function pipelineNameScore(
  memo: NormalizedMemo,
  sourceNormalized: NormalizedTrustee,
  camsNormalized: NormalizedTrustee,
  sourceRawLastName?: string,
  camsRawLastName?: string,
): number {
  const dxtrLast = sourceNormalized.lastName ?? '';
  const camsLast = camsNormalized.lastName ?? '';

  if (!lastNameTokensMatch(dxtrLast, camsLast, sourceRawLastName, camsRawLastName)) {
    return 0;
  }

  const dxtrFirst = sourceNormalized.firstName ?? '';
  const camsFirst = camsNormalized.firstName ?? '';
  const dxtrMiddle = sourceNormalized.middleName ?? '';
  const camsMiddle = camsNormalized.middleName ?? '';

  const firstScore = scoreFirstNamePart(dxtrFirst, camsFirst);
  if (firstScore === 0) {
    if (isFirstMiddleSwap(dxtrFirst, dxtrMiddle, camsFirst, camsMiddle)) return 85;
    if (isOneSidedMiddleNameMatch(dxtrFirst, dxtrMiddle, camsFirst, camsMiddle)) return 85;
    return 0;
  }

  const middleScore = pipelineMiddleNameScore(memo, dxtrMiddle, camsMiddle);
  return Math.min(firstScore, middleScore);
}

/**
 * ACMS-pipeline-only reimplementation of calculatePhoneScore - fully self-contained (no shared
 * helper dependencies at all), so this is a plain copy rather than an orchestration of atomic
 * pieces. Never calls calculatePhoneScore directly, for the same DXTR-isolation reason
 * pipelineNameScore exists (see its doc comment).
 */
function pipelinePhoneScore(
  dxtrPhone: string | undefined,
  camsPhone: PhoneNumber | undefined,
): number | null {
  const dxtrDigits = (dxtrPhone ?? '').replace(/\D/g, '');
  const camsDigits = (camsPhone?.number ?? '').replace(/\D/g, '');

  if (dxtrDigits.length < 10 || camsDigits.length < 10) return null;

  return dxtrDigits.slice(-10) === camsDigits.slice(-10) ? 100 : 0;
}

/**
 * ACMS-pipeline-only orchestration of calculateAddressScore's exact scoring logic, built from the
 * same atomic, exported pieces (parseCityStateZip, normalizeAddressLine, padSingleDigitNumericToken,
 * calculateNumericTokenScore, jaccardSimilarity, generateBigrams) rather than calling
 * calculateAddressScore directly - same DXTR-isolation reason as pipelineNameScore.
 */
function pipelineAddressScore(
  dxtrAddress: DxtrTrusteeParty['legacy'],
  camsAddress: Address,
): number {
  const parsed = parseCityStateZip(dxtrAddress?.cityStateZipCountry);
  if (!parsed) return 0;

  const zip5 = (zip: string) => zip.trim().split('-')[0].toLowerCase();

  const joinAddressLines = (address?: {
    address1?: string;
    address2?: string;
    address3?: string;
  }) =>
    [address?.address1, address?.address2, address?.address3]
      .filter((line): line is string => !!line && line.trim().length > 0)
      .join(' ');

  const dxtrAddressLines = normalizeAddressLine(joinAddressLines(dxtrAddress));
  const camsAddressLines = normalizeAddressLine(joinAddressLines(camsAddress));

  const padForBigrams = (line: string) => line.split(' ').map(padSingleDigitNumericToken).join(' ');
  const bigramScore = jaccardSimilarity(
    generateBigrams(padForBigrams(dxtrAddressLines)),
    generateBigrams(padForBigrams(camsAddressLines)),
  );

  const numericTokenScore = calculateNumericTokenScore(dxtrAddressLines, camsAddressLines);
  const addressLinesScore =
    numericTokenScore === null ? bigramScore : bigramScore * 0.5 + numericTokenScore * 0.5;

  const dxtrCityState = normalizeAddressLine(`${parsed.city} ${parsed.state ?? ''}`);
  const camsCityState = normalizeAddressLine(`${camsAddress.city} ${camsAddress.state}`);
  const cityStateScore = jaccardSimilarity(
    generateBigrams(dxtrCityState),
    generateBigrams(camsCityState),
  );

  const dxtrZip = zip5(parsed.zipCode);
  const camsZip = zip5(camsAddress.zipCode);
  const zipScore = dxtrZip && camsZip && dxtrZip === camsZip ? 100 : 0;

  return Math.round(addressLinesScore * 0.5 + zipScore * 0.3 + cityStateScore * 0.2);
}

/**
 * ACMS-pipeline-only reimplementation of calculateEmailScore - a plain trim+lowercase+equality
 * comparison, same DXTR-isolation reason as pipelineNameScore/pipelinePhoneScore/pipelineAddressScore.
 * Returns null (not comparable) when either side has no email at all, same convention as
 * pipelinePhoneScore - a missing email is not evidence of a mismatch.
 */
function pipelineEmailScore(
  dxtrEmail: string | undefined,
  camsEmail: string | undefined,
): number | null {
  const dxtrNormalized = (dxtrEmail ?? '').trim().toLowerCase();
  const camsNormalized = (camsEmail ?? '').trim().toLowerCase();
  if (!dxtrNormalized || !camsNormalized) return null;
  return dxtrNormalized === camsNormalized ? 100 : 0;
}

/**
 * NORMALIZE stage recovering an ACMS source record's real firstName/middleName/lastName from
 * CMMPR's known data-quality issues (see stripAdministrativeMarkers/recoverCorruptedFirstName/
 * recoverSoloPracticeName/splitCompoundFirstName in sync-acms-professional-ids.ts for each
 * recovery's own reasoning and evidence), THEN applies the same comparison-ready reduction the
 * ADR's NORMALIZE role calls for ("reducing a surname to its identifying token" -
 * firstLastNameToken via lastNameSurnameCandidates - and general string-manipulation cleaning -
 * normalizeNamePart) so every SCORE/RESOLVE function downstream can read state.sourceNormalized
 * directly, with no awareness of which normalizer ran or needing to recompute anything itself.
 * Writes to state.sourceNormalized rather than mutating state.sourceRaw, so sourceRaw stays a
 * faithful, unmodified copy of the CMMPR record - visible in the persisted state graph next to
 * what was derived from it, rather than a recovery silently baked into the only copy of the name
 * this pipeline ever sees (see this stage's introduction: recovery logic used to live in the
 * mapper, toAcmsTrusteeProfessional, making the recovered name the ONLY name any later stage or
 * persisted evidence could observe).
 *
 * lastName gets lastNameSurnameCandidates' FIRST (primary) result - the same firstLastNameToken
 * reduction every other NormalizedTrustee.lastName consumer already expects. Its remaining
 * candidates (a prepended-surname's trailing token, a hyphenated compound's last segment - see
 * lastNameSurnameCandidates' own doc comment) are stored on lastNameAlternates instead of
 * discarded: findSurnameExactCandidates' RECALL-time discovery needs to try every plausible
 * surname token, not just the primary one, to find a real candidate for a name like "DE BRUCE
 * WOLFF" (primary reduction "de bruce" never finds "Wolff" alone) - see NormalizedTrustee's own
 * doc comment on the lastNameAlternates convention.
 *
 * Idempotent and cheap to re-run (pure string transforms, no I/O) - unlike
 * memoizedParseAcmsAddress, this always recomputes rather than checking for an existing
 * sourceNormalized value first, since every caller in practice runs this exactly once per pipeline
 * invocation (see runTrusteeMatchPipeline) and a second call would just recompute the identical
 * result.
 */
export function normalizeAcmsSourceName(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const strippedFirstName = stripAdministrativeMarkers(state.sourceRaw.firstName ?? '');
    const strippedLastName = stripAdministrativeMarkers(state.sourceRaw.lastName ?? '');
    const corruptionRecovered = recoverCorruptedFirstName(strippedFirstName, strippedLastName);
    const soloPracticeRecovered = recoverSoloPracticeName(
      corruptionRecovered.firstName,
      corruptionRecovered.lastName,
    );
    const { firstName, middleName } = splitCompoundFirstName(
      soloPracticeRecovered.firstName,
      state.sourceRaw.middleName,
    );
    const [lastName, ...lastNameAlternates] = lastNameSurnameCandidates(
      soloPracticeRecovered.lastName,
    );

    return {
      ...state,
      sourceNormalized: {
        ...state.sourceNormalized,
        firstName: normalizeNamePart(firstName),
        middleName: normalizeNamePart(middleName),
        lastName,
        lastNameAlternates,
      },
    };
  };
}

/**
 * RECALL-only: the record findSurnameExactCandidates/matchTrusteeByName/tokenizeNameForIntersection
 * (and the other discovery-tier helpers) should search against, in place of state.sourceRaw
 * directly - both are genuinely shared with the DXTR trustee-appointment dataflow
 * (sync-trustee-case-appointments.ts) and take a DxtrTrusteeParty-shaped argument, so they can
 * never be repointed to read NormalizedTrustee directly without either breaking that unrelated
 * call path or duplicating them ACMS-side. This is the ONLY place a translation back to the raw
 * shape is allowed to happen - every SCORE/RESOLVE function reads state.sourceNormalized/
 * candidate.camsNormalized directly instead (see pipelineNameScore/normalizeCandidateNameFields), never
 * this function, so a scorer never needs to know this translation exists.
 *
 * state.sourceRaw's own firstName/middleName/lastName/fullName are the unmodified CMMPR values
 * (see normalizeAcmsSourceName's doc comment on why) - exactly what makes them wrong for
 * discovery: a corrupted or business-suffixed name recovers to something real in
 * state.sourceNormalized, and every discovery call needs THAT name to find candidates correctly.
 * fullName is recomposed from the recovered parts (rather than left as sourceRaw.fullName)
 * because matchTrusteeByName searches CAMS directly by this composed string
 * (findTrusteesByName/searchTrusteesByNameScored) - leaving it raw would mean that search runs
 * against un-recovered, possibly corrupted or marker-laden text even after normalizeAcmsSourceName
 * ran. Everything else on the record (legacy address/phone/email, generation) is untouched by
 * normalizeAcmsSourceName and passes through from sourceRaw as-is - this is a name-only
 * substitution, not a general raw/normalized swap.
 *
 * sourceNormalized is seeded as a clone of sourceRaw's own firstName/middleName/lastName at
 * createInitialState (see cloneNormalizableFields), so it is never undefined here even before
 * normalizeAcmsSourceName runs - reading it directly (no `?? sourceRaw.field` fallback needed) is
 * always safe. fullName is only recomposed from the recovered parts when normalizeAcmsSourceName
 * actually changed one of them (compared against sourceRaw, not merely "is populated" - the clone
 * means populated is no longer evidence of a real change); otherwise sourceRaw.fullName is reused
 * as-is, so a record nothing recovered (the common case, including every unit test exercising a
 * single RECALL/SCORE stage without running normalizeAcmsSourceName first) is never rebuilt from
 * parts in a way that could drop punctuation/casing/tokens sourceRaw.fullName legitimately had.
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
 * Cheapest possible gate in the whole pipeline: reuses sync-acms-professional-ids.ts's own
 * already-tested shouldSkipAsNotAPerson (see its doc comment there) to detect an ACMS record that
 * is an administrative placeholder - "NOT ASSIGNED", "DUPLICATE TRUSTEE", an office name rather
 * than a person - rather than a real trustee identity. Decisive: there is no candidate worth
 * discovering for a record that names no one. Sets state.skip rather than state.match (see
 * PipelineState's doc comment: skip means "no real identity to match at all", a valid
 * non-exceptional outcome, as distinct from a resolved match or a processing error), which
 * withGuard then turns into a no-op for every later stage.
 *
 * Reads state.sourceNormalized, not state.sourceRaw - normalizeAcmsSourceName must run first (see
 * runTrusteeMatchPipeline's stage ordering). Administrative marker text ("(DO NOT USE THIS CODE)")
 * has to be stripped before this check can tell a real name from leftover role/case text, which is
 * exactly what normalizeAcmsSourceName's stripAdministrativeMarkers step already did.
 *
 * Deliberately reuses shouldSkipAsNotAPerson rather than reimplementing its marker-detection logic
 * - ADMINISTRATIVE_MARKER_PHRASES and its private helpers stay in sync-acms-professional-ids.ts,
 * with this stage as a second caller of the same exported decision rather than a second
 * implementation that could drift from it.
 */
export function skipAdministrativePlaceholder(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const isNotAPerson = shouldSkipAsNotAPerson(
      state.sourceNormalized.firstName ?? '',
      state.sourceNormalized.lastName ?? '',
    );
    if (!isNotAPerson) return state;
    return { ...state, skip: true };
  };
}

/**
 * ACMS-pipeline-only reimplementation of findSurnameExactCandidates' discovery logic, sourced
 * directly from state.sourceNormalized.lastName + lastNameAlternates (see NormalizedTrustee's own
 * doc comment on that convention) instead of a single raw-ish string findSurnameExactCandidates
 * would have to re-reduce itself via its own internal lastNameSurnameCandidates call.
 * findSurnameExactCandidates stays untouched and DXTR-shape-safe (its own signature and internal
 * reduction are exactly right for its one remaining real caller, DXTR's
 * sync-trustee-case-appointments.ts) - this is a second, ACMS-only implementation of the same
 * discovery idea, not a repointing of the shared one, for the same DXTR-isolation reason
 * recallByAnchoredLevenshtein/recallByTokenIntersection already reimplement their own discovery
 * logic directly against the repository rather than calling a DXTR-shared helper.
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
      addAndScoreCandidate(state, projectTrustee(trustee));
    }
    return state;
  };
}

/**
 * Discovery stage wrapping matchTrusteeByName's three internal passes (exact match,
 * searchTrusteesByNameScored phonetic fallback, lastName-token search - see its own doc comment)
 * as a normal candidate source, rather than treating it as its own independent resolver with a
 * special-cased orchestrator branch. Its 'resolved' outcome (a single unambiguous exact-name
 * match) is trusted immediately, exactly as before - that path is already narrow and proven, so
 * this stage still resolves state.match directly rather than routing it through FILTER/SCORE
 * (there is nothing to score against; matchTrusteeByName already confirmed uniqueness). Its
 * 'ambiguous' outcome, previously handled by resolveMatchTrusteeByNameAmbiguous's own separate
 * re-fetch-then-run-the-whole-pipeline-again call, now just adds every candidate to state.candidates
 * like any other discovery stage - the SAME shared FILTER/SCORE/RESOLVE stage list the caller runs
 * once over the whole combined pool then scores them, so a matchTrusteeByName candidate and (say) a
 * recallBySurnameExact candidate for the same record compete on equal footing instead of one
 * silently blocking the other from ever being tried (see runTrusteeMatchPipeline's doc comment on
 * why this stopped being safe to keep separate). 'no-match' adds nothing.
 */
export function recallByNameThenResolveExact(context: ApplicationContext): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    let result;
    try {
      result = await matchTrusteeByName(context, projectNormalizedSourceForRecall(state));
    } catch (originalError) {
      return {
        ...state,
        error: getCamsErrorWithStack(originalError, MODULE_NAME, {
          camsStackInfo: { module: MODULE_NAME, message: 'recallByNameThenResolveExact failed' },
        }),
      };
    }

    if (result.kind === 'resolved') {
      return {
        ...state,
        match: {
          trusteeId: result.trusteeId,
          score: { nameScore: result.nameScore, nameMatchQuality: result.nameMatchQuality },
        },
      };
    }

    if (result.kind === 'ambiguous') {
      const trusteesRepo = factory.getTrusteesRepository(context);
      let rawTrustees;
      try {
        rawTrustees = await trusteesRepo.findTrusteesByIds(
          result.matchCandidates.map((c) => c.trusteeId),
        );
      } catch (originalError) {
        return {
          ...state,
          error: getCamsErrorWithStack(originalError, MODULE_NAME, {
            camsStackInfo: {
              module: MODULE_NAME,
              message: 'recallByNameThenResolveExact failed refetching ambiguous candidates',
            },
          }),
        };
      }
      for (const trustee of rawTrustees) {
        addAndScoreCandidate(state, projectTrustee(trustee));
      }
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
 * records as a SCORE at the moment of discovery rather than losing it (see cams-6djma: "all
 * evidence that contributed to the reasoning must appear on the state graph"). Recording actual
 * provenance only, per that bead's resolution: no counterfactual "would token X also have
 * matched" - only the ACTUAL query sequence this record's discovery took.
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
      const candidate = addAndScoreCandidate(state, projectTrustee(trustee));
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
 * (a distance of 1 is a stronger signal than 2), recorded as a SCORE at the moment of discovery
 * (see cams-6djma). The same candidate can never survive BOTH anchor directions (surviving
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
    // the caller's own state entirely, which is exactly what withGuard's state.error check (see
    // trustee-match-pipeline.ts) is meant to replace as this pipeline's stop-the-pipeline signal.
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
      const candidate = addAndScoreCandidate(state, projectTrustee(trustee));
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
 * NORMALIZE-CAMS candidate stage: applies the same comparison-ready reduction
 * normalizeAcmsSourceName applies to the source side (firstLastNameToken for the surname,
 * normalizeNamePart for first/middle) to this ONE candidate's camsNormalized, overwriting the
 * plain clone addCandidate seeded it with (see cloneNormalizableFields - a raw passthrough, not
 * yet reduced for comparison). Runs first in CANDIDATE_SCORERS, before any SCORE function reads
 * camsNormalized, so every scorer after it can read camsNormalized directly and never needs to
 * know this step ran, call firstLastNameToken/normalizeNamePart itself, or care whether some
 * other normalizer already did - the SOURCE -> NORMALIZE ACMS -> RECALL -> NORMALIZE CAMS ->
 * SCORE -> RESOLVE progression the pipeline's ADR describes.
 */
function normalizeCandidateNameFields(
  _sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  candidate.camsNormalized.firstName = normalizeNamePart(candidate.camsRaw.firstName);
  candidate.camsNormalized.middleName = normalizeNamePart(candidate.camsRaw.middleName);
  candidate.camsNormalized.lastName = firstLastNameToken(candidate.camsRaw.lastName);
  return candidate;
}

/**
 * Scoring stage wrapping the existing calculateNameScore unchanged. Reads sourceNormalized/
 * camsNormalized exclusively (see normalizeAcmsSourceName/normalizeCandidateNameFields, both of which
 * must run first - see CANDIDATE_SCORERS' ordering) rather than sourceRaw/camsRaw directly, so
 * this function never needs its own awareness of which normalizer produced the comparable name.
 * sourceNormalized.legacyLastName is the one exception - lastNameTokensMatch's own raw-string
 * fallback needs the UN-reduced lastName, not sourceNormalized.lastName's already-reduced form
 * (see NormalizedTrustee's own doc comment on legacyLastName).
 */
function scoreNameMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const nameScore = pipelineNameScore(
    candidate.memo,
    sourceNormalized,
    candidate.camsNormalized,
    sourceNormalized.legacyLastName,
    candidate.camsRaw.lastName,
  );
  addScore(candidate, 'doesNameMatch', {
    value: nameScore,
    threshold: CONTACT_CORROBORATION_NAME_THRESHOLD,
    pass: nameScore >= CONTACT_CORROBORATION_NAME_THRESHOLD,
  });
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
 * Records two name-similarity DIAGNOSTIC signals onto every candidate currently in the pipeline -
 * fullNameSimilarity (character-level) and tokenNameMatchRate (token-level, nickname/reorder
 * aware) - into candidate.memo (see NormalizedMemo): these are COMPUTED COMPARISONS between the
 * ACMS and CAMS normalized names, not a normalized mirror of either side's own raw field, so they
 * belong in memo rather than camsNormalized (see NormalizedTrustee). Never a ScoreEntry: neither
 * signal gates match/skip or feeds resolvePipelineByContactCorroboration's resolution logic, they
 * exist purely so a persisted, unresolved record's serialized state already carries the same
 * nickname/reorder-detection hints a reviewer would otherwise have to re-derive by hand (or via
 * separate backtest tooling) when investigating why an ACMS record didn't auto-link.
 *
 * The ACMS-side normalized name is computed once on sourceNormalized.name and reused across every
 * candidate (see memoizedNormalizeName) rather than recomputed per candidate - it depends only on
 * the ACMS record, which is invariant for the whole pipeline run. Reads sourceNormalized.fullName
 * (see NormalizedTrustee - a passthrough clone of sourceRaw.fullName, same treatment as legacy/
 * legacyLastName), not sourceRaw.fullName directly, since a SCORE function reads sourceNormalized
 * exclusively (see projectNormalizedSourceForRecall's own doc comment on this convention).
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
 * Reimplements filterNoisyStateMismatches' logic (see that function's doc comment in
 * trustee-match.helpers.ts for the full rationale) as an ANNOTATION rather than an array filter -
 * the pipeline's candidate list is append-only, so state agreement is recorded as a score entry
 * (stateMatch: boolean) for a later resolution stage to read, never used to remove a candidate
 * outright. Reimplemented rather than called through a type cast because
 * filterNoisyStateMismatches reads candidate.public.address/phone (Trustee's real nested shape),
 * which ProjectedTrustee deliberately flattens - a cast would compile but read undefined at
 * runtime. calculateNameScore/calculatePhoneScore/parseCityStateZip/the override threshold are
 * reused unchanged; only the nested-vs-flat field access differs.
 *
 * Runs on every candidate regardless of pool size, same as filterNoisyStateMismatches itself
 * (see CAMS-876 for why its prior pool-size gate was removed - a state mismatch is real noise
 * whether the pool is large or small). As an ANNOTATION every candidate keeps regardless (see
 * resolvePipelineByContactCorroboration's stateMatch !== false read), never eliminated outright.
 *
 * A candidate this stage never evaluates (which cannot happen today, since every candidate in
 * state.candidates is visited) is left with no stateMatch key at all, rather than a fabricated
 * true - mergedScore(candidate).stateMatch reads as undefined, not a false claim that the check
 * ran and passed.
 */
/** isStateNotConflicting's stateMatch is a pure pass/fail with no natural numeric magnitude - value
 * mirrors pass (100/0) purely so it conforms to ScoreRecord's shared vocabulary. */
function stateMatchRecord(stateMatch: boolean): ScoreRecord {
  return { value: stateMatch ? 100 : 0, threshold: 100, pass: stateMatch };
}

/**
 * Whether a candidate/ACMS side has ANY usable contact data at all - address1, city, state, zip,
 * or phone. Deliberately does NOT treat a missing address1/phone alone as insufficient (a real
 * city+state correlation, even with no street address or phone on file, is still a strong,
 * legitimate signal - see doesCityMatch/isStateNotConflicting) - only fires when literally every one
 * of these fields is blank, since that is the one shape that carries zero real evidence either
 * way. Confirmed via a CAMS-876 backtest investigation (cams-ea1w5): a "thin candidate" population
 * defined any looser than this (e.g. no address1/zip/phone but a real city+state) sweeps in
 * candidates with genuine, checkable evidence, which would be unsafe to treat as non-competing.
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

/**
 * Annotates every candidate with whether it carries ANY usable contact data at all (see
 * hasNoContactData) - a candidate with NONE (no address1, city, state, zip, or phone) provides
 * zero real corroborating evidence either way, so every later qualifying-candidate filter (see
 * resolveByComparativeCorroboration, resolveByConsensus, resolveByLastNameOnlyConsensus) excludes
 * it from being counted as a genuine competing candidate - it can neither resolve a match on its
 * own nor create false ambiguity by "qualifying" alongside a real, data-backed candidate.
 * Confirmed via a CAMS-876 backtest investigation (cams-ea1w5) that this shape is real, though
 * rarer than initially assumed (the strictest all-blank bar matches 0 candidates in that
 * population's snapshot - this stage exists as defensive correctness for whatever data the
 * pipeline encounters next, not because it was observed firing there).
 */
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
  addScore(candidate, 'doesCamsTrusteeHaveAddressAndPhone', {
    value: noContactData ? 0 : 100,
    threshold: 100,
    pass: !noContactData,
  });
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
 * Confirmed via a CAMS-876 AI-screener sample (6 records, e.g. an ACMS "FIRSTNAME LASTNAME" record
 * matching a CAMS "Firstname M. Lastname" candidate) that this shape is real: calculateNameScore=100, but ACMS legacy
 * has no address1/cityStateZipCountry at all and phone is the "0" sentinel (see isBlankAcmsValue).
 * Before this stage existed, these records happened to stay unresolved only because
 * resolveByExactNameAndState requires a real ACMS state to compare, which accidentally can't pass
 * when there is no ACMS address at all - an incidental side effect, not an explicit guarantee. This
 * stage makes "no real ACMS evidence" an explicit, checkable fact any RESOLVE stage can rely on,
 * closing that gap regardless of which later stage would otherwise have looked at state/city/zip.
 */
function scoreAcmsHasAddressAndPhone(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const acmsHasNoContactData = memoizedAcmsHasNoContactData(sourceNormalized);
  addScore(candidate, 'doesAcmsTrusteeHaveAddressAndPhone', {
    value: acmsHasNoContactData ? 0 : 100,
    threshold: 100,
    pass: !acmsHasNoContactData,
  });
  return candidate;
}

/**
 * Computes and caches parseCityStateZip's result for the ACMS record directly onto
 * sourceNormalized.address (see NormalizedTrustee - reuses ProjectedTrustee['address']'s own field
 * name/shape) rather than through the memo mechanism - sourceNormalized is invariant for the whole
 * record, so there is no distinct input to fingerprint, but isStateNotConflicting, doesStateMatch,
 * doesCityMatch, and doesZipCodeMatch each independently re-parsed the same cityStateZipCountry
 * string every time they ran before this cache existed. A `null`/undefined parse result
 * (unparseable address) is intentionally NOT cached as a sentinel - re-parsing an unparseable
 * string is cheap, and caching "there is no result" would need its own distinct-from-undefined
 * representation. Reads sourceNormalized.legacy.cityStateZipCountry directly rather than taking it
 * as a separate parameter, now that legacy travels on sourceNormalized itself.
 */
function memoizedParseAcmsAddress(
  sourceNormalized: NormalizedTrustee,
): ReturnType<typeof parseCityStateZip> {
  if (sourceNormalized.address === undefined) {
    const parsed = parseCityStateZip(sourceNormalized.legacy?.cityStateZipCountry);
    if (!parsed) return parsed;
    sourceNormalized.address = parsed;
  }
  return sourceNormalized.address as ReturnType<typeof parseCityStateZip>;
}

function scoreStateNotConflicting(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const parsedAcmsAddress = memoizedParseAcmsAddress(sourceNormalized);
  if (!parsedAcmsAddress?.state) {
    addScore(candidate, 'isStateNotConflicting', stateMatchRecord(true));
    return candidate;
  }

  const acmsState = parsedAcmsAddress.state.toLowerCase();
  const camsState = candidate.camsRaw.address?.state?.toLowerCase();
  if (!camsState || camsState === acmsState) {
    addScore(candidate, 'isStateNotConflicting', stateMatchRecord(true));
    return candidate;
  }

  const phoneScore = pipelinePhoneScore(sourceNormalized.legacy?.phone, candidate.camsRaw.phone);
  if (phoneScore === 100) {
    addScore(candidate, 'isStateNotConflicting', stateMatchRecord(true));
    return candidate;
  }

  const nameScore = pipelineNameScore(
    candidate.memo,
    sourceNormalized,
    candidate.camsNormalized,
    sourceNormalized.legacyLastName,
    candidate.camsRaw.lastName,
  );
  const stateMatch = nameScore >= STATE_OVERRIDE_MIN_NAME_SCORE;
  addScore(candidate, 'isStateNotConflicting', stateMatchRecord(stateMatch));
  return candidate;
}

/**
 * Independent state-agreement scorer, for the sole-candidate consensus vote (see
 * resolveByConsensus) - distinct from isStateNotConflicting's own stateMatch annotation,
 * which is deliberately an ELIMINATION-style filter, not a corroborating vote: isStateNotConflicting
 * defaults to pass:true whenever a real comparison isn't possible (unparseable ACMS address, or a
 * candidate with no state on file) or an override applies (exact phone match, high nameScore) -
 * those defaults are correct for "don't wrongly exclude this candidate" but WRONG as "real
 * evidence this candidate's state agrees", since a candidate that was never actually checked
 * shouldn't out-vote a candidate that was. Confirmed via a CAMS-876 backtest: SC-00222 (4
 * same-surname candidates, ACMS record with only a phone:'0' sentinel - no address at all)
 * resolved via resolveByConsensus's consensus tally counting isStateNotConflicting's
 * unconditional true (ACMS address unparseable) as its ONLY vote, a false 100% consensus built on
 * zero real corroboration. Same "no record when data is unavailable" convention as
 * doesCityMatch/doesZipCodeMatch - no override paths, no defaults, only a genuine state comparison
 * counts as a vote at all.
 */
function scoreStateMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const parsedAcmsAddress = memoizedParseAcmsAddress(sourceNormalized);
  const acmsState = parsedAcmsAddress?.state?.toLowerCase();
  if (!acmsState) return candidate;

  const camsState = candidate.camsRaw.address?.state?.toLowerCase();
  if (!camsState) return candidate;

  const pass = camsState === acmsState;
  addScore(candidate, 'doesStateMatch', { value: pass ? 100 : 0, threshold: 100, pass });
  return candidate;
}

/**
 * Independent city-agreement scorer, for the sole-candidate consensus vote (see
 * resolveByConsensus) - a new, cheap corroborating signal distinct from
 * calculateAddressScore's bigram-similarity comparison of the FULL address line.
 * Case-insensitive exact match on the parsed city name alone (not a fuzzy/bigram compare,
 * unlike calculateAddressScore - city names are short enough that a typo either round-trips
 * through parseCityStateZip's tokenization exactly or doesn't, and a partial-credit scheme adds
 * complexity with no evidence yet that it's needed). No record is added when either side's city
 * is unavailable (unparseable ACMS address, or a candidate with no address on file) - absence is
 * not evidence either way, so it should not count as a vote (see resolveByConsensus's
 * "scorers that actually ran" framing).
 */
function scoreCityMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const parsedAcmsAddress = memoizedParseAcmsAddress(sourceNormalized);
  const acmsCity = parsedAcmsAddress?.city.toLowerCase();
  if (!acmsCity) return candidate;

  const camsCity = candidate.camsRaw.address?.city?.toLowerCase();
  if (!camsCity) return candidate;

  const pass = camsCity === acmsCity;
  addScore(candidate, 'doesCityMatch', { value: pass ? 100 : 0, threshold: 100, pass });
  return candidate;
}

/**
 * Independent zip-agreement scorer, for the sole-candidate consensus vote (see
 * resolveByConsensus) - compares only the 5-digit zip prefix (never the +4 extension,
 * which is far more granular than a professional's on-file mailing address is likely to stay
 * current with) between the ACMS record's parsed zip and a candidate's zipCode. No record is
 * added when either side has fewer than 5 digits to compare (unparseable ACMS address, or a
 * candidate with no/blank zipCode) - same "absence is not evidence" rule as doesCityMatch.
 */
function scoreZipCodeMatch(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const parsedAcmsAddress = memoizedParseAcmsAddress(sourceNormalized);
  const acmsZip5 = parsedAcmsAddress?.zipCode.slice(0, 5);
  if (!acmsZip5 || acmsZip5.length < 5) return candidate;

  const camsZip5 = candidate.camsRaw.address?.zipCode?.slice(0, 5);
  if (!camsZip5 || camsZip5.length < 5) return candidate;

  const pass = camsZip5 === acmsZip5;
  addScore(candidate, 'doesZipCodeMatch', { value: pass ? 100 : 0, threshold: 100, pass });
  return candidate;
}

/**
 * A Disqualifier is a STRONG signal, not a mirror of any single ScoreRecord's pass:false - see
 * Disqualifier's own doc comment. A single mismatched field (city, OR state, OR zip alone) is
 * common and often tolerated elsewhere in this pipeline (e.g. resolveBySoleExactNameMatch trusts
 * a sole exact-name match even when city/zip disagree - a real person can have a P.O. Box, a
 * recent office move, or a second office). Only when city AND state AND zip ALL actively disagree
 * (doesCityMatch/doesStateMatch/doesZipCodeMatch all scored pass:false - never their mere absence,
 * see each scorer's own "no record when data is unavailable" doc comment) does this rise to a
 * single, whole-address disqualification: every piece of comparable address data disagreed, not
 * just one field a real person could plausibly have changed independently. Comparable-but-partial
 * data (only 1 or 2 of the three actually compared) never disqualifies - Brian's explicit call:
 * this is deliberately the STRICTEST bar this stage could set, not a convenient default. Recorded
 * as ONE Disqualifier (not up to three) since it represents a single fact - "the whole address
 * disagreed" - not three independent pieces of evidence to weigh separately.
 *
 * A resolver reading this disqualifier is still free to ignore it when it has other reason to
 * (e.g. a very strong name match plausibly explained by a multi-office trustee or a relocation) -
 * this stage records strong evidence, it does not itself veto a match.
 *
 * Kept as its own small stage, run after doesCityMatch/doesStateMatch/doesZipCodeMatch, rather
 * than folded into any of them - those three stay pure corroboration VOTES (read by
 * resolveByConsensus's tally); this stage's output is a DIFFERENT kind of signal, and keeping the
 * two concerns in separate stages means a reader auditing "what does this candidate's
 * disqualifiers list mean" never has to also re-read the vote-counting logic to find out.
 */
export function scoreAddressDisqualifiers(
  _sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const scores = mergedScore(candidate);
  const allThreeActivelyDisagree =
    scores.doesCityMatch?.pass === false &&
    scores.doesStateMatch?.pass === false &&
    scores.doesZipCodeMatch?.pass === false;
  if (!allThreeActivelyDisagree) return candidate;

  addDisqualifier(candidate, 'addressDisqualifiers', 'city, state, and zip all actively disagree', {
    camsCity: candidate.camsRaw.address?.city,
    camsState: candidate.camsRaw.address?.state,
    camsZipCode: candidate.camsRaw.address?.zipCode,
  });
  return candidate;
}

/**
 * Below this JaroWinklerDistance score, two name PARTS (first name, or last name) share so little
 * in common that no plausible nickname/typo/reordering relationship exists between them - well
 * below FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD (0.8, the bar for "plausibly the SAME"), since
 * "not plausibly the same" and "grossly different" are not the same claim and deserve their own,
 * stricter bar (see NAME_DISQUALIFYING_JARO_WINKLER_THRESHOLD's own doc comment for why BOTH
 * first and last must clear this independently before disqualifying). Calibrated against a real
 * CAMS-876 backtest sample (16 low-hit-count no-match records from a discovery-gap
 * investigation): every genuinely unrelated-name pair in that sample scored below 0.46 on BOTH
 * name parts (e.g. "Irving"/"T" x "Artz"/"Chang", "Austin"/"Elizabeth" x "Parham"/"Austin",
 * "Sheena"/"Carolyn" x "Aebig"/"Chaney"), with a clean gap to the next-lowest pair at 0.483 - not
 * an arbitrary round number, a real boundary found in real data.
 */
const NAME_DISQUALIFYING_JARO_WINKLER_THRESHOLD = 0.46;

/**
 * A Disqualifier is a STRONG signal (see Disqualifier's own doc comment and
 * scoreAddressDisqualifiers' doc comment on the same principle for addresses) - a
 * dissimilar LAST name alone is not strong enough on its own: a real person can share a first
 * name with an unrelated other person by coincidence, but a genuinely different real person could
 * also, less commonly, share a distinctive first name with a different surname for an unrelated
 * reason (a relative, a data-entry surname swap) - see a real calibration counterexample this
 * stage deliberately does NOT disqualify: an ACMS/CAMS pair with an EXACT first-name match ("Chad"
 * both sides) but a dissimilar last name (JaroWinkler ~0.44) - trusting last-name dissimilarity
 * alone here would have wrongly disqualified what might be a real data-entry surname error. Only
 * when BOTH first name AND last name independently score below
 * NAME_DISQUALIFYING_JARO_WINKLER_THRESHOLD - two independent, simultaneous data points in
 * disagreement, not one - does this rise to a strong disqualification (Brian's explicit
 * "multiple datapoints" call, mirroring scoreAddressDisqualifiers' own all-three-fields
 * bar for address).
 *
 * Only fires when doesNameMatch already scored 0 (a real, established mismatch - this stage never
 * runs against a candidate calculateNameScore itself already trusts) and both sides have a real
 * first name AND last name to compare - never on absence, same "no record when data is
 * unavailable" convention as every other disqualifying/corroborating scorer in this pipeline.
 * Reuses firstLastNameToken/normalizeNamePart, the SAME name-part extraction calculateNameScore
 * itself uses, so this stage's notion of "the last name" and "the first name" never drifts from
 * the rest of the pipeline's.
 *
 * A resolver reading this disqualifier is still free to ignore it when it has other reason to -
 * this stage records strong evidence, it does not itself veto a match.
 */
export function scoreNameDisqualifiers(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  if (mergedScore(candidate).doesNameMatch?.value !== 0) return candidate;

  const acmsFirst = sourceNormalized.firstName ?? '';
  const camsFirst = candidate.camsNormalized.firstName ?? '';
  if (!acmsFirst || !camsFirst) return candidate;

  const acmsLast = sourceNormalized.lastName ?? '';
  const camsLast = candidate.camsNormalized.lastName ?? '';
  if (!acmsLast || !camsLast) return candidate;

  const firstNameSimilarity = natural.JaroWinklerDistance(acmsFirst, camsFirst);
  const lastNameSimilarity = natural.JaroWinklerDistance(acmsLast, camsLast);
  const bothGrosslyDifferent =
    firstNameSimilarity < NAME_DISQUALIFYING_JARO_WINKLER_THRESHOLD &&
    lastNameSimilarity < NAME_DISQUALIFYING_JARO_WINKLER_THRESHOLD;
  if (!bothGrosslyDifferent) return candidate;

  addDisqualifier(candidate, 'nameDisqualifiers', 'first and last name both grossly disagree', {
    acmsFirst,
    camsFirst,
    acmsLast,
    camsLast,
    firstNameSimilarity,
    lastNameSimilarity,
  });
  return candidate;
}

/**
 * Below this contactCorroborationAddress value, a PARSEABLE ACMS address means both sides had a
 * real address to compare and it disagreed - a genuine contradiction, never relaxed by
 * isNoContradictionMatch's fallback below. Mirrors trustee-match.helpers.ts's own
 * NO_CONTRADICTION_ADDRESS_FLOOR (kept local per the same DXTR-isolation convention as
 * pipelineAddressScore/pipelinePhoneScore/pipelineEmailScore - this fallback is a pure reader of
 * pipeline-computed scores now, not the shared helper's CandidateScore shape).
 */
const NO_CONTRADICTION_ADDRESS_FLOOR = 30;

/**
 * Narrow fallback for a sole name-qualifying candidate that clears neither
 * CONTACT_CORROBORATION_ADDRESS_THRESHOLD nor an exact phone/email match, but where the
 * corroboration bar was never really failable: the ACMS record has no comparable phone or email
 * at all, and either has no PARSEABLE address to compare (see state.sourceNormalized.address,
 * populated by memoizedParseAcmsAddress - the same signal doesCityMatch/doesStateMatch/
 * doesZipCodeMatch already gate on), or its address score - while below
 * CONTACT_CORROBORATION_ADDRESS_THRESHOLD - doesn't represent a genuine disagreement (see
 * NO_CONTRADICTION_ADDRESS_FLOOR). Requires doesNameMatch.value === 100, a materially higher bar
 * than the main corroboration path, since this fallback has no other corroborating signal to lean
 * on. A "0" phone/fax/email sentinel is already excluded from ever registering as a comparable
 * score (see pipelinePhoneScore/pipelineEmailScore's null-on-uncomparable convention), so this
 * reads contactCorroborationPhone/Email's mere ABSENCE the same way the pipeline's own scores
 * already represent "nothing to compare" - no separate blank-value check needed here.
 *
 * Confirmed via a CAMS-876 backtest regression (15 real records, e.g. an ACMS "NAME (TR)" record
 * with an ACMS cityStateZipCountry missing its state token entirely, unable to parse at all):
 * pipelineAddressScore also returns 0 immediately when the ACMS address doesn't parse (see
 * its own doc comment), which is NOT a genuine disagreement - reading contactCorroborationAddress's
 * raw value alone, without checking whether the address even parsed, misclassified 15 real
 * same-person matches as "contradicted."
 *
 * Backtested (via the shared helper this replaced) against a real trustee-professional-ids
 * export: 91% of candidates that clear the name threshold but not the main corroboration bar have
 * an actively contradicting phone number and are correctly excluded here; the rest hand-verified
 * as genuine matches (e.g. an ACMS name carrying a stray "INACTIVE" marker that still resolves to
 * the correct, active CAMS trustee).
 */
function isNoContradictionMatch(state: PipelineState, candidate: PipelineCandidate): boolean {
  const scores = mergedScore(candidate);
  if (scores.doesNameMatch?.value !== 100) return false;

  const hasNoComparablePhoneOrEmail =
    scores.contactCorroborationPhone === undefined &&
    scores.contactCorroborationEmail === undefined;
  if (!hasNoComparablePhoneOrEmail) return false;

  if (scores.doesAcmsTrusteeHaveAddressAndPhone?.pass === false) return false;

  const hasParseableAcmsAddress = state.sourceNormalized.address !== undefined;
  const addressScore = scores.contactCorroborationAddress;
  const hasContradictingAddress =
    hasParseableAcmsAddress &&
    addressScore !== undefined &&
    addressScore.value < NO_CONTRADICTION_ADDRESS_FLOOR;
  return !hasContradictingAddress;
}

/**
 * Resolves the sole name-qualifying candidate when its address, phone, or email corroborates (see
 * scoreContactCorroboration - already computed for every candidate at discovery time), or when
 * there's no real contact data to contradict it at all (see isNoContradictionMatch). Pure reader -
 * no repository re-fetch: the corroboration check this stage used to make via a live fetch
 * (trustee-match.helpers.ts's resolveByContactCorroboration) never actually used appointment data
 * (confirmed by tracing its call chain - fetchExtra was hardcoded to return undefined), only
 * email, which ProjectedTrustee now carries directly.
 *
 * Deliberately does NOT fall back to resolveDuplicateNameCandidates when this doesn't resolve.
 * That function's premise - two candidates whose names are similar enough to plausibly be the
 * same real person are LIKELY one trustee recorded twice in the trustees collection, so pick
 * whichever has the better addressScore AGAINST THE OTHER CANDIDATE - was checked directly against
 * a real trustees export and found FALSE for its own two canary examples: "Alex G. Smith" (Denver,
 * CO) and "Alexander G. Smith" (Jacksonville, FL) are two different real trustees, not a
 * duplicate, and "David L./M./P. Miller" are three different real trustees (one active, one
 * retired, one with no appointments), not a duplicate. Auto-linking to whichever candidate merely
 * has a better relative addressScore is a guess with no connection to whether that candidate
 * actually corroborates sourceTrustee at all - exactly the wrong tradeoff (a confident wrong
 * answer is worse than an honest unresolved one). A same-name multi-candidate pool that doesn't
 * clear the sole-candidate corroboration check above is left unresolved here, falling through to
 * whatever later RESOLVE stage (or, absent one, an 'ambiguous' disposition) the pipeline reaches
 * next - never auto-linked on name-similarity alone.
 *
 * Only considers candidates whose merged score does NOT have isStateNotConflicting: false - a
 * candidate a state-filter annotated as noise is excluded from consideration, without ever being
 * removed from state.candidates itself.
 */
export function resolveBySoleContactMatch(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const candidates = [...state.candidates.entries()].filter(
      ([, candidate]) => mergedScore(candidate).isStateNotConflicting?.pass !== false,
    );
    if (candidates.length === 0) return state;

    const qualifying = candidates.filter(
      ([, candidate]) => mergedScore(candidate).doesNameMatch?.pass === true,
    );
    if (qualifying.length === 1) {
      const [trusteeId, candidate] = qualifying[0];
      const scores = mergedScore(candidate);
      const corroborated =
        scores.contactCorroborationAddress?.pass === true ||
        scores.contactCorroborationPhone?.pass === true ||
        scores.contactCorroborationEmail?.pass === true;

      if (corroborated || isNoContradictionMatch(state, candidate)) {
        return { ...state, match: { trusteeId, score: candidate.scores } };
      }
    }

    return state;
  };
}

/**
 * Computes address/phone/email corroboration between the ACMS record and one candidate,
 * unconditionally for every candidate (no pool-size gate - see scoreCandidate) rather than only
 * when resolveByComparativeCorroboration/the sole-contact-match resolve stage happen to need it.
 * These three scores are real, independent evidence any RESOLVE stage can read regardless of pool
 * shape - contactCorroborationAddress/contactCorroborationPhone are the same keys
 * resolveByComparativeCorroboration always wrote (now written for every candidate, not just when
 * 2+ name-qualifying candidates existed); contactCorroborationEmail is new, replacing what used to
 * require a repository re-fetch (see resolveBySoleContactMatch's doc comment - the ACMS pipeline
 * never actually fetched appointment data there, only email, which ProjectedTrustee now carries).
 */
function scoreContactCorroboration(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  const addressScore = pipelineAddressScore(sourceNormalized.legacy, candidate.camsRaw.address);
  addScore(candidate, 'contactCorroborationAddress', {
    value: addressScore,
    threshold: CONTACT_CORROBORATION_ADDRESS_THRESHOLD,
    pass: addressScore >= CONTACT_CORROBORATION_ADDRESS_THRESHOLD,
  });

  const phoneScore = pipelinePhoneScore(sourceNormalized.legacy?.phone, candidate.camsRaw.phone);
  if (phoneScore !== null) {
    addScore(candidate, 'contactCorroborationPhone', {
      value: phoneScore,
      threshold: 100,
      pass: phoneScore === 100,
    });
  }

  const emailScore = pipelineEmailScore(sourceNormalized.legacy?.email, candidate.camsRaw.email);
  if (emailScore !== null) {
    addScore(candidate, 'contactCorroborationEmail', {
      value: emailScore,
      threshold: 100,
      pass: emailScore === 100,
    });
  }
  return candidate;
}

/**
 * Rescues the specific case resolveByContactCorroboration deliberately refuses to arbitrate:
 * MULTIPLE candidates independently clear calculateNameScore's auto-link threshold (see
 * CONTACT_CORROBORATION_NAME_THRESHOLD), so that function bails out with 'unresolved' rather than
 * guess between them - even when one candidate has decisive contact evidence (an exact phone
 * match, or a strong address match) and the others have none at all. Confirmed via a CAMS-876
 * backtest finding (an ACMS record with two same-surname candidates in different states, both
 * scoring nameScore=85, only one with an exact phone match) that this is a real, recoverable gap,
 * not a genuine ambiguity - resolveByContactCorroboration's single-candidate-only rule exists to
 * avoid guessing when there's NO differentiating evidence, not to discard differentiating evidence
 * that does exist.
 *
 * Pure reader of contactCorroborationAddress/contactCorroborationPhone (see
 * scoreContactCorroboration - computed for every candidate at discovery time, not by this
 * stage). Resolves only when EXACTLY ONE name-qualifying candidate clears
 * CONTACT_CORROBORATION_ADDRESS_THRESHOLD or has an exact phone match and no OTHER qualifying
 * candidate does - the same "strong evidence" bar resolveByContactCorroboration itself uses for
 * the single-candidate case, just applied comparatively across the qualifying set instead of
 * requiring the set to already be size 1.
 *
 * Falls back to full city+state+zip agreement as a second, weaker "strong evidence" signal ONLY
 * when no candidate clears the address/phone bar above and exactly one qualifying candidate has
 * that full geographic agreement (see calculateAddressScore's doc comment for why its blended
 * addressScore can't reach CONTACT_CORROBORATION_ADDRESS_THRESHOLD on full geo agreement alone).
 */
export function resolveByComparativeCorroboration(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.pass === true &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false,
    );
    if (qualifying.length < 2) return state;

    const strong: { candidate: PipelineCandidate; score: ScoreByScorer }[] = [];
    const fullGeoAgreement: PipelineCandidate[] = [];
    for (const candidate of qualifying) {
      const scores = mergedScore(candidate);
      if (
        scores.contactCorroborationAddress?.pass === true ||
        scores.contactCorroborationPhone?.pass === true
      ) {
        strong.push({ candidate, score: candidate.scores });
      } else if (
        scores.doesCityMatch?.pass === true &&
        scores.doesStateMatch?.pass === true &&
        scores.doesZipCodeMatch?.pass === true
      ) {
        fullGeoAgreement.push(candidate);
      }
    }

    // A candidate with no strong address/phone corroboration can still be decisively favored over
    // its rivals when it is the ONLY one with full city+state+zip agreement (see this stage's own
    // doc comment on calculateAddressScore's 50% address-lines weighting structurally capping a
    // full-geo-agreement candidate's blended addressScore around 50 - confirmed via a CAMS-876
    // backtest population of 2 records, e.g. Aldric P. Voss vs. Aldric Voss, Marcus Emerson
    // Vossey II vs. Marcus E. Vossey in a shared metro area, where the runner-up shares nothing
    // but the name). Two-or-more candidates both agreeing on geography is real, unresolvable ambiguity,
    // not a signal to break the tie by.
    if (strong.length === 0 && fullGeoAgreement.length === 1) {
      strong.push({ candidate: fullGeoAgreement[0], score: fullGeoAgreement[0].scores });
    }

    if (strong.length !== 1) return state;

    const winner = strong[0];
    return {
      ...state,
      match: { trusteeId: winner.candidate.camsRaw.trusteeId, score: winner.score },
    };
  };
}

/** Maximum digit-hamming-distance (see phoneDigitDistance) between an ACMS and CAMS phone number
 * for resolveByPhoneTypoTolerance to treat the mismatch as a likely data-entry typo rather than a
 * genuinely different number. Backtested against a real 245-record population sharing this
 * stage's exact trigger shape (sole candidate, nameScore=100, a comparable-but-mismatched phone):
 * every number differing by 1-2 digits was confirmed the same real person by hand; every number
 * differing by 8+ digits was a genuinely different number. */
const PHONE_TYPO_MAX_DIGIT_DISTANCE = 2;

/** Count of differing digit positions between the last 10 digits of two phone numbers - null if
 * either side isn't a full, comparable 10-digit number (mirrors calculatePhoneScore's own
 * comparability rule). Both numbers are always exactly 10 digits once comparable, so a simple
 * position-by-position count is sufficient - no insertions/deletions are possible once both sides
 * are fixed at the same length, unlike a general edit-distance problem. */
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

/**
 * Scores phone-typo tolerance for a candidate whose name is a PERFECT structured match (nameScore
 * 100, a materially higher bar than the 85 auto-link threshold since there's no other
 * corroborating evidence to lean on) but whose phone is a real, comparable, MISMATCHED number -
 * not missing, which is exactly the case isNoContradictionMatch's existing fallback declines to
 * help (it only relaxes when phoneScore is null/uncomparable). calculatePhoneScore's binary
 * 100-or-0 makes no distinction between a one-digit transposition and a totally different area
 * code; phoneDigitDistance is a new, pipeline-only signal recovering the former specifically.
 * Confirmed via a CAMS-876 backtest finding (a sole exact-name CAMS candidate whose recorded phone
 * differs from the ACMS record's phone by exactly one digit) that this is a real, recoverable gap.
 *
 * Computed unconditionally for every nameScore=100 candidate (not gated to the pool having exactly
 * one qualifying candidate) - the score itself is real, independent evidence any RESOLVE stage can
 * read regardless of pool shape (see resolveByPhoneTypoTolerance, which still gates its own
 * RESOLUTION decision to a sole qualifying candidate; only the computation broadened).
 *
 * Deliberately does NOT modify calculatePhoneScore or isNoContradictionMatch themselves - both are
 * shared with the DXTR trustee-appointment dataflow (sync-trustee-case-appointments.ts) via
 * trustee-match.helpers.ts, and a change tuned for ACMS's specific typo patterns has no business
 * affecting that unrelated call path. phoneDigitDistance is defined and used only here.
 *
 * phoneDigitDistance's raw units (lower is better - 0 is an exact match) are the opposite polarity
 * of every other ScoreRecord.value (higher is better) - converted to a same-polarity similarity
 * (10 - distance, so an exact match scores 10) purely so `pass` stays computable the same way
 * everywhere (value >= threshold). The raw digit distance is kept alongside as phoneDigitDistance
 * for a reviewer who wants the human-readable count, not just the derived similarity.
 */
function scorePhoneTypoTolerance(
  sourceNormalized: NormalizedTrustee,
  candidate: PipelineCandidate,
): PipelineCandidate {
  if (mergedScore(candidate).doesNameMatch?.value !== 100) return candidate;

  const distance = phoneDigitDistance(
    sourceNormalized.legacy?.phone,
    candidate.camsRaw.phone?.number,
  );
  if (distance === null) return candidate;

  const similarityThreshold = 10 - PHONE_TYPO_MAX_DIGIT_DISTANCE;
  addScore(candidate, 'phoneTypoToleranceScore', {
    value: 10 - distance,
    threshold: similarityThreshold,
    pass: 10 - distance >= similarityThreshold,
    phoneDigitDistance: distance,
  });
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
 * Order matters past scoreNameMatch: every scorer after it reads doesNameMatch (directly,
 * or via a gate like "nameScore===100"), so it must run first. The FILTER-labeled annotations
 * (state/address/phone presence) run first only to mirror this list's own historical reading
 * order - none of THEM has a real dependency on being first.
 */
const CANDIDATE_SCORERS: CandidateScorer[] = [
  // NORMALIZE CAMS - must run before any scorer below reads candidate.camsNormalized.
  normalizeCandidateNameFields,
  scoreHasAddressAndPhone,
  scoreAcmsHasAddressAndPhone,
  scoreStateNotConflicting,
  scoreNameMatch,
  scoreNameDisqualifiers, // reads scoreNameMatch's doesNameMatch - must run after it
  recordSimilarityDiagnostics,
  scoreCityMatch,
  scoreStateMatch,
  scoreZipCodeMatch,
  // reads doesCityMatch/doesStateMatch/doesZipCodeMatch - must run after all three
  scoreAddressDisqualifiers,
  scoreContactCorroboration,
  scorePhoneTypoTolerance,
];

/**
 * Runs CANDIDATE_SCORERS against ONE candidate, immediately - the per-candidate counterpart to
 * runPipeline (trustee-match-pipeline.ts): the same reduce-over-an-ordered-list shape, narrowed to
 * CandidateScorer's signature. Unlike runPipeline, no terminal-outcome guard is needed here - a
 * candidate's disqualification is data recorded ON it (see Disqualifier), not a control-flow
 * signal the way state.match/skip/error is at the pool level, so every scorer in CANDIDATE_SCORERS
 * always runs, in order, with no early exit.
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
 * addCandidate, plus an immediate full scoreCandidate pass - the ONLY way a new candidate should
 * enter the pipeline going forward (see the 4 RECALL stages, all switched from addCandidate to
 * this). Kept in this file rather than trustee-match-pipeline.ts, since scoreCandidate is scoring
 * logic (this file's concern), not a state-graph primitive (that file's concern).
 *
 * Every CandidateScorer is expected to be pure (see CandidateScorer's own doc comment) and should
 * never throw in practice - this try/catch is a safety net for a genuine, unanticipated runtime
 * error (e.g. malformed upstream data reaching a scorer in a shape it didn't expect), not a
 * primary code path. Catches here rather than letting it propagate, because addAndScoreCandidate
 * is called fire-and-forget from inside each RECALL stage's own discovery loop (see
 * recallBySurnameExact et al.) - those stages have no other way to observe a candidate-scoring
 * failure. Mirrors the SAME getCamsErrorWithStack construction every RECALL stage's own repository
 * failure already uses, so state.error is always the same shape regardless of which layer failed.
 * Assigns state.error in place rather than returning a new state, consistent with addCandidate's
 * own in-place mutation of state.candidates (see this pipeline's "pragmatic purity" convention) -
 * runPipeline (trustee-match-pipeline.ts) checks state.error before invoking the next stage, so a
 * failure here still halts the pipeline exactly like a RECALL stage's own caught failure would.
 */
export function addAndScoreCandidate(
  state: PipelineState,
  camsRaw: ProjectedTrustee,
): PipelineCandidate {
  const candidate = addCandidate(state, camsRaw);
  try {
    return scoreCandidate(state.sourceNormalized, candidate);
  } catch (originalError) {
    state.error = getCamsErrorWithStack(originalError, MODULE_NAME, {
      camsStackInfo: { module: MODULE_NAME, message: 'addAndScoreCandidate failed' },
    });
    return candidate;
  }
}

/**
 * Rescues the complementary case to resolveByComparativeCorroboration: exactly ONE candidate
 * clears calculateNameScore's threshold with a PERFECT structured match, and a real, comparable
 * phone-typo-tolerance score (see scorePhoneTypoTolerance, computed at discovery time)
 * clears the typo-distance bar. Pure reader now - the resolution decision stays gated to a sole
 * qualifying candidate even though the underlying score is computed for every candidate.
 */
export function resolveByPhoneTypoTolerance(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.pass === true &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false,
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    if (mergedScore(candidate).doesNameMatch?.value !== 100) return state;

    const score = mergedScore(candidate).phoneTypoToleranceScore;
    if (!score?.pass) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  };
}

/**
 * Whether a sole name-qualifying candidate has enough independent corroborating evidence to
 * resolve, checked as explicit named signals rather than a percentage/count of "whatever scorers
 * happened to run" - a prior percentage-based design (computeConsensus, removed - see CAMS-876)
 * silently changed behavior whenever a scorer's availability changed (broadening
 * contactCorroborationAddress/Phone to compute for every candidate, rather than only when 2+
 * candidates existed, newly added them as votes here too, dragging real resolutions down into
 * ambiguous). Two independent paths to corroboration, either is sufficient:
 *   - Geography: state agrees AND (city or zip also agrees), OR city and zip both agree
 *     regardless of state (a state field can be wrong/stale while the more granular city+zip data
 *     is still trustworthy).
 *   - Contact: address, phone, or email corroborates (see scoreContactCorroboration).
 * Deliberately does NOT fall back to state agreement ALONE (no city/zip/contact evidence at all) -
 * backtested against the real population this replaced: 3 of 45 resolveByConsensus resolutions and
 * 2 of 73 resolveByLastNameOnlyConsensus/resolveByFuzzyLastNameMatch resolutions relied on a SINGLE
 * vote (state alone, or the fuzzy-name vote alone) passing being treated as "100% consensus" -
 * genuinely weak evidence in isolation that the old design only accepted because there was nothing
 * else to weigh it against. Accepted as a small, known gap (Brian: "let's go with it... circle back
 * to this when we are done with all refactoring and optimization... I want to involve other
 * reviewers") rather than preserved via a special-cased single-vote fallback.
 */
function isCorroboratedByGeoOrContact(candidate: PipelineCandidate): boolean {
  const scores = mergedScore(candidate);
  const stateOk = scores.doesStateMatch?.pass === true;
  const cityOk = scores.doesCityMatch?.pass === true;
  const zipOk = scores.doesZipCodeMatch?.pass === true;
  const geoAgrees = (stateOk && (cityOk || zipOk)) || (cityOk && zipOk);

  const contactAgrees =
    scores.contactCorroborationAddress?.pass === true ||
    scores.contactCorroborationPhone?.pass === true ||
    scores.contactCorroborationEmail?.pass === true;

  return geoAgrees || contactAgrees;
}

/**
 * Whether ANY of isCorroboratedByGeoOrContact's underlying signals were even checkable for this
 * candidate (state/city/zip/address/phone/email comparable on both sides) - distinct from whether
 * they agreed. A candidate with zero comparable evidence of any kind must never resolve, regardless
 * of what isCorroboratedByGeoOrContact would otherwise return (false either way, for a different
 * reason) - this lets a caller skip recording a resolveByConsensus-style score entirely for a
 * genuinely thin-data candidate, rather than recording a misleading "checked and failed" result
 * when nothing was actually checked.
 */
function hasAnyCorroboratingEvidence(candidate: PipelineCandidate): boolean {
  const scores = mergedScore(candidate);
  return (
    scores.doesStateMatch !== undefined ||
    scores.doesCityMatch !== undefined ||
    scores.doesZipCodeMatch !== undefined ||
    scores.contactCorroborationAddress !== undefined ||
    scores.contactCorroborationPhone !== undefined ||
    scores.contactCorroborationEmail !== undefined
  );
}

/** The pool of candidates an exact-name-match RESOLVE stage considers: calculateNameScore === 100
 * (not merely >= 85 - see each calling stage's own doc comment for why exact match gets its own,
 * more permissive rules than the general fuzzy-match tiers), with comparable contact data on both
 * sides (a candidate a FILTER stage already flagged as having none is never a legitimate winner). */
function exactNameMatchCandidates(state: PipelineState): PipelineCandidate[] {
  return [...state.candidates.values()].filter(
    (candidate) =>
      mergedScore(candidate).doesNameMatch?.value === 100 &&
      mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
      mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false,
  );
}

function resolveOnCandidate(state: PipelineState, candidate: PipelineCandidate): PipelineState {
  return { ...state, match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores } };
}

/**
 * Resolves a SOLE exact name match (calculateNameScore === 100) with no state/city/zip check at
 * all - there is nothing else in the pool it could be confused with, so an exact name match is
 * already sufficient evidence on its own (Brian's direction: "EXACT name match on 1 candidate =>
 * match"). Deliberately its own small stage rather than folded into isCorroboratedByGeoOrContact,
 * since a 100 nameScore is categorically stronger evidence than an 85 fuzzy match (last AND first
 * name both matched exactly, see calculateNameScore) and deserves its own simple, readable rule.
 * Runs BEFORE resolveByConsensus (withGuard makes it a no-op once this resolves) so an exact-name
 * candidate never has to clear the general geography-or-contact bar the fuzzier match tiers
 * require.
 *
 * Recovers the "office relocated within the state" shape a prior version of this stage required
 * state (and a second city/zip signal) to accept - a real backtested example had a candidate's
 * ACMS and CAMS addresses roughly 150 miles apart, same state, same real person.
 *
 * Runs before resolveBySoleExactNameMatchByStateThenGeo, which only ever sees what this stage
 * left behind (2+ exact-name candidates) - the two stages' gates are mutually exclusive by pool
 * size, so no candidate is ever considered by both.
 */
export function resolveBySoleExactNameMatch(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const exactMatches = exactNameMatchCandidates(state);
    if (exactMatches.length !== 1) return state;

    return resolveOnCandidate(state, exactMatches[0]);
  };
}

/**
 * Resolves an exact-name-match pool of TWO OR MORE candidates (resolveBySoleExactNameMatch's gate
 * already claims the sole-candidate case) by using state, then city-or-zip, as discriminators -
 * not requirements. The name alone cannot tell these candidates apart (the real "John Smith"
 * problem: two different real people can share both a name and, coincidentally, enough of a
 * candidate pool to co-occur here), so state agreement narrows the pool first: if exactly one
 * candidate's state agrees with the ACMS record, resolve on it. If two or more still agree on
 * state, narrow again by city-or-zip agreement; if exactly one survivor remains after THAT
 * narrowing, resolve on it. Otherwise (still ambiguous after narrowing, or narrowing eliminated
 * every candidate) this stage does not resolve, leaving the pool for
 * resolveByComparativeCorroboration/resolveDuplicateNameCandidates to arbitrate.
 *
 * Runs after resolveByComparativeCorroboration (see scoringStages' ordering comment) - that stage's
 * contact-corroboration-or-full-geo-agreement signal is richer than the state/city/zip narrowing
 * here, so it gets first attempt at any pool this stage would also consider.
 */
export function resolveBySoleExactNameMatchByStateThenGeo(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const exactMatches = exactNameMatchCandidates(state);
    if (exactMatches.length < 2) return state;

    const stateNarrowed = exactMatches.filter(
      (candidate) => mergedScore(candidate).doesStateMatch?.pass === true,
    );
    if (stateNarrowed.length === 1) return resolveOnCandidate(state, stateNarrowed[0]);
    if (stateNarrowed.length < 2) return state;

    const addressNarrowed = stateNarrowed.filter(
      (candidate) =>
        mergedScore(candidate).doesCityMatch?.pass === true ||
        mergedScore(candidate).doesZipCodeMatch?.pass === true,
    );
    if (addressNarrowed.length === 1) return resolveOnCandidate(state, addressNarrowed[0]);

    return state;
  };
}

/**
 * !!! HIGH-RISK STAGE - reads on the THINNEST possible evidence bar this pipeline will ever trust
 * !!! - resolves a SOLE exact name match (calculateNameScore === 100) EVEN WHEN the ACMS source
 * record has ZERO comparable contact data at all (doesAcmsTrusteeHaveAddressAndPhone === false -
 * no address, no city/state/zip, no real phone/email; see memoizedAcmsHasNoContactData). Every
 * other RESOLVE stage in this pipeline, including resolveBySoleExactNameMatch immediately above,
 * treats that condition as an automatic exclusion - this stage is the ONE deliberate exception,
 * and exists ONLY because there is no possible second signal to require here: state, city, zip,
 * phone, and email are not merely mismatched, they are structurally uncomparable. "Require one
 * more corroborating signal" (the standard answer to thin evidence elsewhere in this pipeline -
 * see resolveByExactNameAndState's git history, commit bc1eb61bc "Require 2nd signal to auto-link
 * on name") is not an option for this population; there is nothing left to ask for.
 *
 * What this stage is TRUSTING, and why that is still a real risk even with an exact name match:
 * calculateNameScore === 100 guarantees first AND last name matched character-for-character (see
 * calculateNameScore - no nickname/fuzzy credit reaches 100), which is categorically stronger than
 * the FUZZY, 85-scoring matches the "require a 2nd signal" precedent (commit bc1eb61bc, see below)
 * was written to stop - those relied on a single FUZZY vote, not an exact match. But an exact name
 * match STILL is not proof of identity on its own: a common name (real backtest examples include
 * pools of 20-30 OTHER candidates correctly rejected on name alongside the one exact survivor)
 * could coincidentally belong to a different real person entirely, and with zero ACMS data,
 * nothing here could ever catch that. Confirmed via a CAMS-876 backtest (2026-09-17, cams-x2pkd):
 * 46 records share this exact shape, every one with ACMS legacy.phone === '0' (the sentinel - see
 * isBlankAcmsValue) and no address at all - the original motivating case for the ACMS-no-
 * contact-data guard itself (per commit bc1eb61bc) is exactly this shape; that commit intentionally
 * left it unresolved pending further review, and this stage is that review's conclusion. See
 * cams-x2pkd for the full backtest population (not committed here - contains real trustee names).
 *
 * Deliberately requires only "exactly one candidate scores doesNameMatch === 100" - NOT "pool
 * size === 1". A larger pool (up to 30 candidates in the real backtest population) where every
 * OTHER candidate was already correctly rejected on name is not weaker evidence for the one exact
 * survivor; those candidates' mere presence isn't evidence against it. Brian's explicit call after
 * reviewing this trade-off directly.
 *
 * Runs DEAD LAST in scoringStages() - after every other RESOLVE stage, including the fuzzy-name
 * consensus tiers (resolveByConsensus, resolveBySoleFuzzyNameMatchAndState,
 * resolveByLastNameOnlyConsensus, resolveByFuzzyLastNameMatch), not merely after the other
 * exact-name stages immediately above it. Richest evidence first: every one of those stages'
 * qualifying-candidate filters already excludes a candidate when
 * doesAcmsTrusteeHaveAddressAndPhone is false (the same shared "is there real evidence to work
 * with" convention resolveBySoleExactNameMatch uses), so none of them could ever have resolved a
 * candidate this stage would also consider - placing this stage last costs nothing in missed
 * opportunity, and keeps the pipeline's least-trustworthy resolution decision genuinely last.
 */
export function resolveBySoleExactNameMatchNoAcmsData(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const exactMatches = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.value === 100 &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass === false,
    );
    if (exactMatches.length !== 1) return state;

    return resolveOnCandidate(state, exactMatches[0]);
  };
}

/**
 * !!! HIGH-RISK STAGE - the fuzzy-name counterpart to resolveBySoleExactNameMatchNoAcmsData;
 * read that stage's doc comment first for the shared rationale (no second signal is possible for
 * this population, not merely absent). This stage resolves a SOLE candidate whose lastName is an
 * exact token match (see isExactLastNameMatch) and whose firstName is a plausible fuzzy match
 * (see isFuzzyNamePartMatch - the SAME JaroWinkler/phonetic check scoreFuzzyFirstNameMatch already
 * uses; no new nickname mechanism was added), EVEN WHEN the ACMS source record has zero comparable
 * contact data (doesAcmsTrusteeHaveAddressAndPhone === false).
 *
 * Root cause this stage closes: scoreFuzzyFirstNameMatch/resolveByLastNameOnlyConsensus already
 * implement fuzzy-first-name matching correctly, but findSoleZeroNameScoreCandidateWithMatchingLastName's
 * qualifying filter excludes a candidate whose ACMS side has no contact data at all - the exact
 * same ACMS-blank exclusion resolveBySoleExactNameMatch(NoAcmsData) reasons about for EXACT
 * matches, one tier down for FUZZY matches. A candidate this stage would resolve never even gets a
 * doesFuzzyFirstNameMatch score computed today, let alone a resolution decision - the JaroWinkler
 * check is never reached, not merely failed.
 *
 * Confirmed via a CAMS-876 backtest (2026-09-17, cams-4dksa) that re-derived the population
 * directly from raw pipeline state rather than trusting an initial audit pass, which had
 * over-claimed several "confirmed nickname gap" pairs. Those turned out to be EITHER already
 * correctly handled by scoreFuzzyFirstNameMatch today (it runs and finds a plausible fuzzy match,
 * but correctly declines to resolve because the ACMS record's real geo data actively disagrees -
 * these are NOT this stage's population; do not relax anything for them) OR already excluded by
 * findSoleZeroNameScoreCandidateWithMatchingLastName's own "exactly one" gate because their
 * lastName is common enough to have MULTIPLE same-surname candidates in the pool (correctly
 * ambiguous on their own, no fix needed). The genuinely narrow, verified-safe remainder is a
 * handful of sole-candidate records, each with ACMS legacy.phone === '0' and no address at all -
 * see cams-4dksa for the full backtest population (not committed here - contains real trustee
 * names).
 *
 * Runs immediately after resolveBySoleExactNameMatchNoAcmsData (same risk class, fuzzy rather than
 * exact) - see scoringStages' ordering comment for why both sit at the very end of the pipeline.
 */
export function resolveBySoleFuzzyFirstNameMatchNoAcmsData(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.value === 0 &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass === false &&
        isExactLastNameMatch(state.sourceRaw.lastName ?? '', candidate.camsRaw.lastName ?? ''),
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    const acmsFirst = state.sourceNormalized.firstName;
    const camsFirst = candidate.camsNormalized.firstName;
    if (!acmsFirst || !camsFirst) return state;
    if (!isFuzzyNamePartMatch(acmsFirst.toLowerCase(), camsFirst.toLowerCase())) return state;

    return resolveOnCandidate(state, candidate);
  };
}

/**
 * Rescues the common-surname shape scoreFuzzyFirstNameMatch's OWN "exactly one" gate structurally
 * cannot reach: MULTIPLE candidates share the ACMS record's exact lastName (so
 * findSoleZeroNameScoreCandidateWithMatchingLastName never even fires - see its own doc comment),
 * but addressDisqualifiers has already recorded a STRONG whole-address disagreement (city AND
 * state AND zip all actively disagree, never a partial or merely-uncompared field - see
 * scoreAddressDisqualifiers) for all but one of them. Filtering those disqualified
 * candidates out of the pool first can narrow a same-surname crowd down to a single real candidate
 * to check a fuzzy first-name match against.
 *
 * Reads candidate.disqualifiers directly (via .filter()/.reduce(), not a black-box helper) so the
 * SPECIFIC disqualifying scorer this resolver treats as exclusionary is visible at the call site:
 * the single combined 'addressDisqualifiers' scorer ONLY - a candidate disqualified for some
 * other, future reason (e.g. a hypothetical scorer unrelated to address) does NOT get excluded
 * here, since that evidence has nothing to do with the address-narrowing this resolver performs.
 */
const ADDRESS_DISQUALIFYING_SCORER = 'addressDisqualifiers';

export function resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const sameLastName = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.value === 0 &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false &&
        isExactLastNameMatch(state.sourceRaw.lastName ?? '', candidate.camsRaw.lastName ?? ''),
    );
    if (sameLastName.length < 2) return state; // scoreFuzzyFirstNameMatch's job, not this stage's

    const addressNarrowed = sameLastName.filter(
      (candidate) =>
        candidate.disqualifiers.reduce(
          (disqualifiedByAddress, d) =>
            disqualifiedByAddress || d.scorer === ADDRESS_DISQUALIFYING_SCORER,
          false,
        ) === false,
    );
    if (addressNarrowed.length !== 1) return state;

    const candidate = addressNarrowed[0];
    const acmsFirst = state.sourceNormalized.firstName;
    const camsFirst = candidate.camsNormalized.firstName;
    if (!acmsFirst || !camsFirst) return state;
    if (!isFuzzyNamePartMatch(acmsFirst.toLowerCase(), camsFirst.toLowerCase())) return state;

    return resolveOnCandidate(state, candidate);
  };
}

/**
 * Every RESOLVE stage this pipeline considers too risky to run alongside the main sequence - each
 * trusts evidence some other stage deliberately treats as disqualifying (see each risky stage's
 * own "!!! HIGH-RISK" doc comment for its specific rationale). Composed as their own ordered
 * sub-pipeline (via runPipeline, the same primitive scoringStages/runNestedTier already use) and
 * appended as ONE stage at the very end of scoringStages() - not interleaved with the main
 * sequence - so:
 *   1. Every richer-evidence stage in the main sequence gets first attempt at any candidate a
 *      risky stage would also consider (richest evidence first, same principle as the rest of this
 *      pipeline, just drawn as a harder line: NOTHING risky runs until NOTHING safe could resolve
 *      it).
 *   2. A reviewer auditing "what does this pipeline trust on thin evidence" has exactly one place
 *      to look, rather than hunting through the main RESOLVE list for stages that happen to relax
 *      a shared guard.
 *   3. Adding, removing, or reordering a risky stage never requires touching scoringStages' own
 *      ordering comment/backtest history - only this list.
 * Ordered by DECREASING evidence strength internally, same convention as the main sequence: exact
 * name match (resolveBySoleExactNameMatchNoAcmsData) before fuzzy name match
 * (resolveBySoleFuzzyFirstNameMatchNoAcmsData), before geo-narrowed fuzzy name match
 * (resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing - weakest, since it trusts a pool NARROWED by
 * disqualifiers rather than a pool that was already sole to begin with).
 */
export function resolveRisky(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    return runPipeline(state, [
      resolveBySoleExactNameMatchNoAcmsData(),
      resolveBySoleFuzzyFirstNameMatchNoAcmsData(),
      resolveBySoleFuzzyFirstNameMatchAfterAddressNarrowing(),
    ]);
  };
}

/**
 * Resolves a SOLE name-qualifying candidate (resolveByComparativeCorroboration's multi-candidate case,
 * and resolveByPhoneTypoTolerance's narrower phone-typo case, both do not apply) whose geography or
 * contact info independently corroborates (see isCorroboratedByGeoOrContact).
 *
 * Complements resolveByComparativeCorroboration/resolveByPhoneTypoTolerance rather than replacing them:
 * this stage is the general fallback for the shape neither of those two covers - exactly one
 * name-qualifying candidate whose nameScore is below 100 (so resolveByPhoneTypoTolerance's stricter
 * gate does not apply) with no second candidate to compare against (so
 * resolveByComparativeCorroboration's gate does not apply either).
 */
export function resolveByConsensus(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.pass === true &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false,
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    if (!hasAnyCorroboratingEvidence(candidate)) return state;

    const corroborated = isCorroboratedByGeoOrContact(candidate);
    addScore(candidate, 'resolveByConsensus', {
      value: corroborated ? 100 : 0,
      threshold: 100,
      pass: corroborated,
    });
    if (!corroborated) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  };
}

/**
 * Resolves a SOLE fuzzy name match (doesNameMatch.pass === true but value < 100 - an exact 100
 * match is resolveByExactNameAndState's job, run earlier) on state agreement alone, with no
 * city/zip/contact corroboration at all - the one case isCorroboratedByGeoOrContact/
 * resolveByConsensus deliberately refuses (see that function's doc comment on the known
 * single-vote gap, and cams-6gver). Narrower than reopening that question: this stage requires
 * there to be exactly ONE candidate in the whole pool (nothing else to be ambiguous against) AND
 * a fuzzy-but-real name match, not merely that state was the only comparable signal for an
 * otherwise-thin candidate.
 *
 * Runs AFTER resolveByConsensus (richest evidence first - this stage's state-only bar is strictly
 * weaker than isCorroboratedByGeoOrContact's, so it must only ever catch what that stage already
 * declined). Confirmed via a CAMS-876 backtest: 123 sole-candidate, real-name (nameScore 85-100)
 * records where the ACMS and CAMS addresses are a genuine metro-area/relocation mismatch (e.g.
 * Anchorage vs Eagle River AK, Gig Harbor vs Puyallup WA) - same person, same state, an office or
 * P.O. Box that legitimately differs by city.
 */
export function resolveBySoleFuzzyNameMatchAndState(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const qualifying = [...state.candidates.values()].filter(
      (candidate) =>
        mergedScore(candidate).doesNameMatch?.pass === true &&
        mergedScore(candidate).doesNameMatch?.value !== 100 &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false,
    );
    if (qualifying.length !== 1) return state;

    const candidate = qualifying[0];
    const stateOnly = mergedScore(candidate).doesStateMatch?.pass === true;
    addScore(candidate, 'resolveBySoleFuzzyNameMatchAndState', {
      value: stateOnly ? 100 : 0,
      threshold: 100,
      pass: stateOnly,
    });
    if (!stateOnly) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  };
}

/**
 * Records a fuzzy first-name comparison as its OWN vote (see isFuzzyNamePartMatch for why this
 * signal is never trusted alone) - only for a sole candidate whose lastName is an exact match but
 * whose overall nameScore is 0 (a fuzzy-but-not-exact first name is exactly what tanks
 * calculateNameScore to 0 despite a real lastName match - see calculateNameScore's doc comment).
 * A candidate whose lastName does NOT match is left alone entirely; that is a genuinely different
 * surname, not this pattern.
 *
 * Deliberately compares RAW (unreduced) lastName strings, not firstLastNameToken-reduced
 * NormalizedTrustee.lastName - confirmed via a CAMS-876 backtest regression: reducing both sides
 * first made "Schwartz" and "Schwartz-Albright" (a genuinely different, unrelated surname
 * truncated to its first hyphen segment) collide as the SAME qualifying candidate, which broke
 * findSoleZeroNameScoreCandidateWithMatchingLastName's "exactly one" gate for an ACMS record that
 * should have had exactly one real Schwartz to consider. A plain trim+lowercase comparison on the
 * unreduced strings is deliberately STRICTER here than firstLastNameToken's own reduction - this
 * function's whole job is narrowing a same-surname crowd down to a sole real candidate, so it must
 * never conflate two different real surnames the way discovery-time token reduction safely can.
 */
function isExactLastNameMatch(acmsLastName: string, camsLastName: string): boolean {
  const acmsLast = acmsLastName.trim().toLowerCase();
  const camsLast = camsLastName.trim().toLowerCase();
  return acmsLast.length > 0 && acmsLast === camsLast;
}

/** The sole candidate eligible for a fuzzy first-name vote - a real lastName match (see
 * isExactLastNameMatch) whose overall nameScore was tanked to 0, with both sides having a first
 * name to actually compare. Returns undefined when zero or multiple candidates qualify, or when
 * either side has no first name to compare - scoreFuzzyFirstNameMatch no-ops in every such case. */
function findSoleZeroNameScoreCandidateWithMatchingLastName(
  state: PipelineState,
): PipelineCandidate | undefined {
  const qualifying = [...state.candidates.values()].filter(
    (candidate) =>
      mergedScore(candidate).doesNameMatch?.value === 0 &&
      mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
      mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false &&
      isExactLastNameMatch(state.sourceRaw.lastName ?? '', candidate.camsRaw.lastName ?? ''),
  );
  if (qualifying.length !== 1) return undefined;

  const candidate = qualifying[0];
  return state.sourceNormalized.firstName && candidate.camsNormalized.firstName
    ? candidate
    : undefined;
}

/**
 * The complementary gate to resolveByConsensus: resolves a sole candidate whose lastName matches
 * exactly but whose OVERALL nameScore was 0. findSoleZeroNameScoreCandidateWithMatchingLastName's
 * "exactly one qualifies" narrowing is itself RESOLVE-role reasoning (per the ADR's own
 * definition - reasoning over a candidate's ALREADY-accumulated scores to reach a narrower
 * candidate set), not a SCORE-stage filter, so it belongs composed into this one resolver rather
 * than split across a separate "scores only" stage the way it used to be (see
 * resolveByFuzzyLastNameMatch's own doc comment for the same composed score-then-resolve shape,
 * applied here for the mirror-image name-part pattern). Records the fuzzy first-name comparison as
 * its own vote first (see isFuzzyNamePartMatch for why this signal is never trusted alone) - a
 * real lastName match is the corroborating evidence this vote adds to - then requires the SAME
 * geography-or-contact check every other consensus stage does (see isCorroboratedByGeoOrContact),
 * so a candidate reaching this point still needs INDEPENDENT evidence beyond the name match to
 * resolve. Never runs for a candidate resolveByConsensus already covers (that stage's gate is
 * doesNameMatch.pass===true; this stage's gate is doesNameMatch.value===0 - the two gates are
 * mutually exclusive for any nameScore between 0 and 85 exclusive, calculateNameScore never
 * actually returns a value in that open range - see calculateNameScore's discrete field-by-field
 * comparison, so no candidate is ever double-counted by both stages).
 */
export function resolveByLastNameOnlyConsensus(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const candidate = findSoleZeroNameScoreCandidateWithMatchingLastName(state);
    if (!candidate) return state;

    const acmsFirst = (state.sourceNormalized.firstName ?? '').toLowerCase();
    const camsFirst = (candidate.camsNormalized.firstName ?? '').toLowerCase();
    addScore(candidate, 'doesFuzzyFirstNameMatch', {
      value: Math.round(natural.JaroWinklerDistance(acmsFirst, camsFirst) * 100),
      threshold: Math.round(FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD * 100),
      pass: isFuzzyNamePartMatch(acmsFirst, camsFirst),
    });

    const corroborated = isCorroboratedByGeoOrContact(candidate);
    addScore(candidate, 'resolveByLastNameOnlyConsensus', {
      value: corroborated ? 100 : 0,
      threshold: 100,
      pass: corroborated,
    });
    if (!corroborated) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  };
}

/** The sole candidate eligible for a fuzzy last-name vote, paired with both sides' already-computed
 * last-name tokens (so a caller never has to call firstLastNameToken on the same inputs twice) - a
 * real firstName match (exact, same bar calculateNameScore's own scoreFirstNamePart uses at its top
 * tier) whose overall nameScore was tanked to 0 by a LAST name that doesn't token-match exactly (a
 * spelling variant, typo, or nickname - e.g. ACMS "GIPSON" vs CAMS "Gibson", "GOLBERG" vs
 * "Goldberg" - see lastNameTokensMatch's doc comment on why last name gets no relaxation there). The
 * mirror image of findSoleZeroNameScoreCandidateWithMatchingLastName: that helper requires an EXACT
 * lastName match with a fuzzy firstName; this one requires an EXACT firstName match with a fuzzy
 * lastName. A candidate whose firstName does NOT match exactly is left alone entirely - fuzzing both
 * name parts at once on a nameScore=0 candidate would be too permissive to trust even behind contact
 * corroboration. Compares via firstLastNameToken (not a raw trim/lowercase) for two reasons: it
 * reduces a legal-entity-style ACMS lastName field ("GAYL & GUTNICK, P.A.") down to its identifying
 * word before any fuzzy comparison runs, and isFuzzyNamePartMatch's SoundEx step throws on a raw
 * string containing punctuation the algorithm doesn't expect (confirmed via a CAMS-876 backtest
 * crash on exactly this shape). Returns undefined when zero or multiple candidates qualify, when
 * either side has no lastName to compare, or when the lastName pair isn't even a plausible fuzzy
 * match at all (see isFuzzyNamePartMatch). */
function findSoleZeroNameScoreCandidateWithFuzzyLastNameMatch(
  memo: NormalizedMemo,
  state: PipelineState,
): { candidate: PipelineCandidate; acmsLast: string; camsLast: string } | undefined {
  const acmsFirst = state.sourceNormalized.firstName ?? '';
  const acmsLast = state.sourceNormalized.lastName ?? '';
  if (!acmsFirst || !acmsLast) return undefined;

  const qualifying = [...state.candidates.values()]
    .map((candidate) => ({
      candidate,
      camsFirst: candidate.camsNormalized.firstName ?? '',
      camsLast: candidate.camsNormalized.lastName ?? '',
    }))
    .filter(
      ({ candidate, camsFirst, camsLast }) =>
        camsFirst &&
        camsLast &&
        mergedScore(candidate).doesNameMatch?.value === 0 &&
        mergedScore(candidate).doesCamsTrusteeHaveAddressAndPhone?.pass !== false &&
        mergedScore(candidate).doesAcmsTrusteeHaveAddressAndPhone?.pass !== false &&
        acmsFirst === camsFirst &&
        acmsLast !== camsLast &&
        memoizedIsFuzzyNamePartMatch(memo, acmsLast, camsLast),
    );
  if (qualifying.length !== 1) return undefined;

  const { candidate, camsLast } = qualifying[0];
  return { candidate, acmsLast, camsLast };
}

/**
 * Orchestrates the fuzzy-last-name RESOLVE sequence as one composed stage - scores the fuzzy
 * last-name comparison as its own vote (see isFuzzyNamePartMatch for why this signal is never
 * trusted alone), then immediately checks the same geography-or-contact corroboration every other
 * consensus stage requires (see isCorroboratedByGeoOrContact), so the two-step score-then-resolve
 * shape reads as one operation in scoringStages() rather than two separately sequenced stages a
 * reader has to mentally re-pair. The mirror image of scoreFuzzyFirstNameMatch +
 * resolveByLastNameOnlyConsensus, for the opposite name-part shape: an exact first name with a
 * spelling-variant/typo/nickname last name. Confirmed via a CAMS-876 AI-screener backtest: 22
 * sole-candidate records with this exact shape (nameScore=0, exact first name, fuzzy last name)
 * ALSO have an exact 10-digit phone match and state agreement (e.g. a one-letter surname typo like
 * "Gipson"/"Gibson" or "Golberg"/"Goldberg") - never resolved on the fuzzy last-name vote alone;
 * independent corroboration is still required. Never
 * runs for a candidate resolveByConsensus or resolveByLastNameOnlyConsensus already covers - this
 * stage's gate requires an EXACT firstName match (the opposite of resolveByLastNameOnlyConsensus's
 * EXACT lastName match gate), so no candidate is ever double-counted across stages.
 */
export function resolveByFuzzyLastNameMatch(): Stage {
  return async (state: PipelineState): Promise<PipelineState> => {
    const found = findSoleZeroNameScoreCandidateWithFuzzyLastNameMatch(state.memo, state);
    if (!found) return state;

    const { candidate, acmsLast, camsLast } = found;
    addScore(candidate, 'doesFuzzyLastNameMatch', {
      value: Math.round(natural.JaroWinklerDistance(acmsLast, camsLast) * 100),
      threshold: Math.round(FUZZY_NAME_PART_JARO_WINKLER_THRESHOLD * 100),
      pass: true, // findSoleZeroNameScoreCandidateWithFuzzyLastNameMatch already required a fuzzy match to select this candidate
    });

    const corroborated = isCorroboratedByGeoOrContact(candidate);
    addScore(candidate, 'resolveByFuzzyLastNameMatch', {
      value: corroborated ? 100 : 0,
      threshold: 100,
      pass: corroborated,
    });
    if (!corroborated) return state;

    return {
      ...state,
      match: { trusteeId: candidate.camsRaw.trusteeId, score: candidate.scores },
    };
  };
}
