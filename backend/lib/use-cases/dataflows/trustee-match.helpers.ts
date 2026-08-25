import { ApplicationContext } from '../../adapters/types/basic';
import {
  DxtrTrusteeParty,
  CandidateScore,
  TrusteeAppointmentSyncEvent,
  UNSCORED,
} from '@common/cams/dataflow-events';
import factory from '../../factory';
import { LegacyAddress } from '@common/cams/parties';
import { Address, PhoneNumber } from '@common/cams/contact';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { Trustee } from '@common/cams/trustees';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';

const MODULE_NAME = 'TRUSTEE-MATCH';

/**
 * Minimum totalScore for a multi-candidate fuzzy-match winner to be considered.
 */
const FUZZY_MATCH_SCORE_THRESHOLD = 75;

/**
 * Minimum point gap a multi-candidate winner must have over the runner-up.
 */
const FUZZY_MATCH_MIN_GAP = 5;

/**
 * Normalizes a name by trimming whitespace and collapsing multiple spaces.
 * This is the canonical normalization function for trustee name matching.
 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ');
}

/**
 * Escapes special regex characters in a string for safe use in RegExp.
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Removes any parenthetical annotation from a name, wherever it appears - court-office codes
 * ("(SV)", "(ND)"), role markers ("(TR)", "(MON)"), or a mid-name nickname ("(Bill)").
 * Example: "John J. (Johnny) Doe Jr." -> "John J. Doe Jr."
 */
export function stripParentheticalAnnotations(name: string): string {
  return name
    .replace(/ ?\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Removes a trailing trustee-role marker: " Trustee" or "-Trustee" (case-insensitive).
 * Example: "John R. Doe-Trustee" -> "John R. Doe".
 * Deliberately does NOT strip a bare trailing " tr"/"Tr" - that pattern is indistinguishable from
 * a real name ending in a token that looks like "Tr" (e.g. a surname or transliterated initial),
 * and over-strips in practice ("John Doe Tr" -> "John Doe"). A DXTR name relying on that
 * bare-tr convention will fall through to no-match and route to human verification instead, same
 * as before this pipeline existed - safer than risking a false auto-link.
 */
export function stripTrusteeRoleSuffix(name: string): string {
  return name
    .trim()
    .replace(/(?:\s+trustee|-trustee)$/i, '')
    .trim();
}

/**
 * Removes a trailing chapter/subchapter annotation, e.g. " - Ch 11 SubV" or " -SBRA V".
 * Example: "John P. Doe -SBRA V" -> "John P. Doe".
 */
export function stripChapterAnnotation(name: string): string {
  return name
    .trim()
    .replace(/\s*-\s*ch(?:apter)?\.?\s*\d+\s*(?:sub\s*v)?$/i, '')
    .replace(/\s*-\s*sbra\s*v$/i, '')
    .trim();
}

/**
 * Removes trailing source-system artifacts: a "_\d+" suffix (e.g. "_13") or a bare trailing
 * apostrophe left behind by an upstream export (e.g. "Soule'").
 * Example: "John M. Doe_13" -> "John M. Doe".
 */
export function stripSourceSystemArtifacts(name: string): string {
  return name
    .replace(/_\d+\s*$/, '')
    .replace(/'\s*$/, '')
    .trim();
}

/**
 * Normalizes a trailing generational suffix (Jr, Sr, II, III, IV) so that formatting differences
 * (a preceding comma, a trailing period) don't prevent two names from comparing equal.
 * Example: "John Doe Jr." and "John Doe, Jr." both normalize to "John Doe Jr".
 * Does NOT bridge a suffix present on only one side (e.g. "John Doe" vs "John Doe, Jr.") - that
 * gap (and any other trailing noise after the real surname) is instead handled by the
 * first-token-lastName search tier in matchTrusteeByName (see firstLastNameToken), which sidesteps
 * needing a dedicated suffix-discarding pass at all.
 */
export function normalizeGenerationalSuffix(name: string): string {
  return name.trim().replace(/,?\s+(Jr|Sr|II|III|IV)\.?$/i, ' $1');
}

/**
 * Final normalization pass for name-matching comparison: lowercases, drops apostrophes, converts
 * periods and hyphens to spaces (so "M.A." and "M. A." converge, and "Jean-Pierre" splits into
 * separate words), and collapses whitespace.
 * Example: "John D ODoe" and "John D. O'Doe" both normalize to "john d odoe".
 */
export function stripNamePunctuation(name: string): string {
  return name.toLowerCase().replace(/'/g, '').replace(/[.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Orchestrates the normalization pipeline used to compare a DXTR trustee name against a CAMS
 * trustee's stored name when matchTrusteeByName's exact-match path finds nothing. Order matters -
 * outermost/most specific annotations are stripped first, generic punctuation last. Distinct from
 * normalizeName, which is used for query construction (findTrusteesByName /
 * findTrusteeByNameAndState) and write paths (migrate-trustees.ts, import-zoom-csv.ts) and is
 * intentionally left unchanged.
 */
export function normalizeNameForMatching(name: string): string {
  return stripNamePunctuation(
    normalizeGenerationalSuffix(
      stripSourceSystemArtifacts(
        stripChapterAnnotation(stripTrusteeRoleSuffix(stripParentheticalAnnotations(name))),
      ),
    ),
  );
}

/**
 * Parses a legacy cityStateZipCountry string into components.
 * Format: "City, ST zipCode" with segments separated by a comma, whitespace,
 * or both, and an optional trailing country segment in any form (or none).
 * DXTR country data is unreliable/garbage (state abbreviations, zip codes,
 * "United States", phone numbers, etc.), so it is never captured or compared -
 * the parser simply stops matching once it has city, state, and zip.
 * Returns null if parsing fails.
 */
const STATE_TOKEN = /^[A-Za-z]{2}$/;
const ZIP_TOKEN = /^\d{5}(?:-\d{4})?$/;

export function parseCityStateZip(cityStateZipCountry?: string): {
  city: string;
  state: string;
  zipCode: string;
} | null {
  if (!cityStateZipCountry) return null;

  // Segments may be separated by a comma, whitespace, or both, so unify on
  // whitespace and tokenize. Then scan for the first "ST zipCode" token pair -
  // whatever precedes it is the city, and anything after it (e.g. a country
  // segment) is intentionally ignored rather than captured or validated.
  // Examples: "New York, NY 10001", "Corinth, MS, 38834, USA",
  // "Corinth MS 38834 USA", "New York, NY 10001 US"
  const tokens = cityStateZipCountry.replace(/,/g, ' ').trim().split(/\s+/);

  for (let i = 0; i < tokens.length - 1; i++) {
    const state = tokens[i];
    const zipCode = tokens[i + 1];
    if (STATE_TOKEN.test(state) && ZIP_TOKEN.test(zipCode)) {
      const city = tokens.slice(0, i).join(' ');
      if (!city) return null;
      return { city, state, zipCode };
    }
  }

  return null;
}

/**
 * Calculates address match score between DXTR and CAMS addresses.
 * Scoring:
 * - City + State + Zip match: 100 points (perfect match)
 * - Zip match (state implied): 60 points (high confidence - zip is specific)
 * - City match (state implied): 40 points (medium confidence)
 * - State match only: 30 points (low confidence)
 * - No match: 0 points
 * Case-insensitive comparison, missing fields treated as no match. Zip comparison uses only the
 * base 5-digit ZIP - a ZIP+4 extension present on one side (or a differing extension on both)
 * does not contradict an otherwise-matching base ZIP, since DXTR's cityStateZipCountry is
 * inconsistent about carrying the +4 suffix at all.
 */
export function calculateAddressScore(
  dxtrAddress: LegacyAddress | undefined,
  camsAddress: Address,
): number {
  const parsed = parseCityStateZip(dxtrAddress?.cityStateZipCountry);

  if (!parsed) return 0;

  const normalizeField = (field?: string) => field?.trim().toLowerCase() || '';
  const zip5 = (zip: string) => zip.split('-')[0];

  const dxtrCity = normalizeField(parsed.city);
  const dxtrState = normalizeField(parsed.state);
  const dxtrZip = zip5(normalizeField(parsed.zipCode));

  const camsCity = normalizeField(camsAddress.city);
  const camsState = normalizeField(camsAddress.state);
  const camsZip = zip5(normalizeField(camsAddress.zipCode));

  const stateMatch = dxtrState && camsState && dxtrState === camsState;
  const cityMatch = dxtrCity && camsCity && dxtrCity === camsCity;
  const zipMatch = dxtrZip && camsZip && dxtrZip === camsZip;

  // Perfect match: city, state, and zip all match
  if (cityMatch && stateMatch && zipMatch) return 100;

  // High confidence: zip match (zip is more specific than city)
  if (zipMatch) return 60;

  // Medium confidence: city match (zip differs or missing)
  if (cityMatch) return 40;

  // State only (both city and zip missing): low confidence
  if (stateMatch) return 30;

  // No match
  return 0;
}

/**
 * Normalizes a chapter string for comparison.
 * Removes leading zeros and extracts base chapter from subchapter variants.
 * Examples: "07" → "7", "11-subchapter-v" → "11"
 */
export function normalizeChapter(chapter: string): string {
  // Extract base chapter number (before any dash or subchapter suffix)
  const match = chapter.match(/^0*(\d+)/);
  if (!match) return chapter.toLowerCase();
  return match[1];
}

/**
 * Determines whether an appointment covers a given division, checking both
 * the deprecated singular `divisionCode` and the current `divisionCodes`
 * array (modern appointments, including multi-division panel appointments,
 * only populate `divisionCodes`).
 */
function appointmentCoversDivision(appointment: TrusteeAppointment, divisionCode: string): boolean {
  return (
    appointment.divisionCode === divisionCode ||
    (appointment.divisionCodes?.includes(divisionCode) ?? false)
  );
}

/**
 * Determines whether a SINGLE one of a trustee's active appointments matches court + division +
 * chapter all on that same record — used both for perfect-match auto-linking and (see
 * resolveNameCollisionByScoring) as a gate ensuring a fuzzy-match winner's district/division and
 * chapter evidence didn't come from two different appointments. This is stricter than the
 * individual scoring functions, which check these criteria independently across all appointments.
 */
export function isAppointmentMatch(
  appointments: TrusteeAppointment[],
  courtId: string,
  divisionCode: string,
  chapter: string,
): boolean {
  const normalizedChapter = normalizeChapter(chapter);
  return appointments.some(
    (a) =>
      a.status === 'active' &&
      a.courtId === courtId &&
      appointmentCoversDivision(a, divisionCode) &&
      normalizeChapter(a.chapter) === normalizedChapter,
  );
}

/**
 * Finds a deterministic inactive appointment matching court + division + chapter.
 * Where the status is NOT 'active'. Used to detect the "perfect match
 * but inactive status" scenario. If multiple inactive appointments match,
 * the most recently created one is returned to ensure predictable, auditable behavior.
 * Returns the matching appointment (for status extraction), or undefined.
 */
export function findInactivePerfectMatch(
  appointments: TrusteeAppointment[],
  courtId: string,
  divisionCode: string,
  chapter: string,
): TrusteeAppointment | undefined {
  const normalizedChapter = normalizeChapter(chapter);
  const matches = appointments.filter(
    (a) =>
      a.status !== 'active' &&
      a.courtId === courtId &&
      appointmentCoversDivision(a, divisionCode) &&
      normalizeChapter(a.chapter) === normalizedChapter,
  );
  if (matches.length === 0) return undefined;
  const sorted = matches.slice().sort((a, b) => {
    return new Date(b.createdOn).getTime() - new Date(a.createdOn).getTime();
  });
  return sorted[0];
}

/**
 * Calculates district/division match score for a trustee.
 * Scoring:
 * - Exact court + division match with active appointment: 100 points
 * - Same court, different division with active appointment: 50 points
 * - No matching court: 0 points
 * Only active appointments count. calculateChapterScore reuses this function's division match
 * as the basis for its own scoping, so the two scores can never be satisfied by two different
 * appointment records.
 */
export function calculateDistrictDivisionScore(
  caseCourtId: string,
  caseDivisionCode: string,
  appointments: TrusteeAppointment[],
): number {
  const activeAppointments = appointments.filter((a) => a.status === 'active');

  if (activeAppointments.length === 0) return 0;

  // Check for exact court + division match
  const exactMatch = activeAppointments.some((a) => {
    return a.courtId === caseCourtId && appointmentCoversDivision(a, caseDivisionCode);
  });
  if (exactMatch) return 100;

  // Check for same court, different division
  const courtMatch = activeAppointments.some((a) => a.courtId === caseCourtId);
  if (courtMatch) return 50;

  return 0;
}

/**
 * Calculates chapter match score for a trustee.
 * Scoring:
 * - Exact chapter match, but ONLY counted against an active appointment that also covers the
 *   case's court + division: 100 points
 * - No match: 0 points
 * Normalizes chapters before comparison (e.g., "7" === "07").
 * Only active appointments count, and only appointments that also cover the case's court +
 * division are eligible — a trustee holding active appointments across multiple
 * divisions/chapters must never score 100 on chapter for a case whose chapter only matches an
 * appointment in an unrelated division, since that appointment provides no evidence the trustee
 * is appointed to this case's actual division+chapter combination. chapterScore can therefore
 * never be 100 when calculateDistrictDivisionScore is 50 or 0.
 */
export function calculateChapterScore(
  caseCourtId: string,
  caseDivisionCode: string,
  caseChapter: string,
  appointments: TrusteeAppointment[],
): number {
  const normalizedCaseChapter = normalizeChapter(caseChapter);

  const divisionMatchingAppointments = appointments.filter(
    (a) =>
      a.status === 'active' &&
      a.courtId === caseCourtId &&
      appointmentCoversDivision(a, caseDivisionCode),
  );

  const chapterMatch = divisionMatchingAppointments.some((a) => {
    return normalizeChapter(a.chapter) === normalizedCaseChapter;
  });

  return chapterMatch ? 100 : 0;
}

/**
 * Normalizes a name part for strict matching: lowercase and strip all
 * non-alphanumeric characters (e.g. "L." -> "l", "O'Brien" -> "obrien").
 * Distinct from `normalizeName`, which only collapses whitespace for
 * full-name lookup matching.
 */
function normalizeNamePart(namePart?: string): string {
  return (namePart ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Reduces a raw lastName field to just its first word: drops apostrophes (so "O'Brien" stays one
 * word, matching stripNamePunctuation's convention), replaces remaining punctuation with spaces,
 * collapses runs of whitespace, splits, and returns the first token (lowercased). Used both for
 * candidate discovery (see the first-token-lastName search tier in matchTrusteeByName) and for
 * calculateNameScore's own lastName comparison - one lastName-comparison strategy rather than two,
 * since trailing noise after the real surname's first word varies in shape (a role marker
 * "(TR)"/"Trustee"/"tr", a comma before it, a generational suffix like "Jr."/", III", etc.) and
 * taking only the first token sidesteps needing to enumerate and strip each specific pattern (as
 * normalizeNameForMatching's pipeline does for the composed fullName string) - by definition,
 * anything after the first token is not the real surname. Trade-off: a genuinely hyphenated
 * compound surname ("Garcia-Miranda") also reduces to just its first word ("garcia") - the
 * downstream scoring/appointment-match gate, not this function, is responsible for confirming
 * whether that first word alone was enough to identify the right person.
 * Example: "Marshack (TR)" -> "marshack", "Wallo, Trustee" -> "wallo", "Malloy, III" -> "malloy",
 * "O'Brien" -> "obrien".
 */
export function firstLastNameToken(namePart?: string): string {
  const withoutApostrophes = (namePart ?? '').toLowerCase().replace(/'/g, '');
  const spaced = withoutApostrophes.replace(/[^a-z0-9]+/g, ' ');
  return spaced.trim().split(' ')[0] ?? '';
}

const isInitialOf = (initial: string, full: string): boolean =>
  initial.length === 1 && full.length > 0 && full[0] === initial;

/**
 * Scores how well two already-normalized firstName values compare. Unlike scoreMiddleNamePart,
 * a firstName is expected to always be present on a real trustee record and is much stronger
 * disqualifying evidence when it genuinely differs (two different first names is a strong signal
 * these are different people) - so missing or a genuine mismatch both score 0, same as the
 * pre-existing exact-match-only behavior. The one relaxation added on top of that: an
 * initial-vs-full relationship (e.g. DXTR "G." vs CAMS "George") scores 85, the same
 * corroborating-but-not-certain credit scoreMiddleNamePart gives that relationship.
 */
function scoreFirstNamePart(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (isInitialOf(a, b) || isInitialOf(b, a)) return 85;
  return 0;
}

/**
 * Scores how well two already-normalized middleName values compare. A middle name is legitimately
 * optional, so its absence on either side is neutral rather than disqualifying, and a genuine
 * conflict is only a moderate penalty rather than a hard disqualifier - contrast
 * scoreFirstNamePart, where both of those cases are harsher.
 *   - Missing on either or both sides: 100 (neutral - absence isn't evidence)
 *   - Both present and identical: 100 (full match)
 *   - One side is a single-character initial matching the other side's first
 *     character: 85 (initial-vs-full relationship)
 *   - Both present and genuinely differ: 15 (moderate conflict penalty)
 */
function scoreMiddleNamePart(a: string, b: string): number {
  if (!a || !b) return 100;
  if (a === b) return 100;
  if (isInitialOf(a, b) || isInitialOf(b, a)) return 85;
  return 15;
}

/**
 * Calculates a name match score between DXTR and CAMS trustee parties.
 * Scoring:
 * - Last name must match on its first token (see firstLastNameToken), or the score is 0 - no
 *   further relaxation on lastName, since it is the one part of the name most likely to
 *   distinguish two genuinely different people.
 * - First name must also match, or relax to an initial-vs-full relationship (see
 *   scoreFirstNamePart) - a genuine first-name mismatch is still disqualifying (score 0).
 * - When last and first both clear their bar, a middle-name sub-score (see scoreMiddleNamePart)
 *   determines the final result - the lower of the first/middle sub-scores wins, so an
 *   initial-vs-full relationship on either part still caps the result at 85.
 */
export function calculateNameScore(dxtrTrustee: DxtrTrusteeParty, camsTrustee: Trustee): number {
  const dxtrLast = firstLastNameToken(dxtrTrustee.lastName);
  const camsLast = firstLastNameToken(camsTrustee.lastName);

  if (!dxtrLast || dxtrLast !== camsLast) {
    return 0;
  }

  const firstScore = scoreFirstNamePart(
    normalizeNamePart(dxtrTrustee.firstName),
    normalizeNamePart(camsTrustee.firstName),
  );
  if (firstScore === 0) return 0;

  const middleScore = scoreMiddleNamePart(
    normalizeNamePart(dxtrTrustee.middleName),
    normalizeNamePart(camsTrustee.middleName),
  );

  return Math.min(firstScore, middleScore);
}

/**
 * Calculates a phone match score between DXTR and CAMS phone numbers.
 * Both sides are normalized by stripping non-digit characters, then compared
 * on their last 10 digits (tolerating an inconsistently-present leading
 * country-code digit, e.g. a leading "1").
 * Returns `null` (not comparable) when either side has fewer than 10 digits
 * after normalization - this is treated as missing/garbled data, not a
 * confident mismatch, so it does not count against the candidate at all.
 */
export function calculatePhoneScore(
  dxtrPhone: string | undefined,
  camsPhone: PhoneNumber | undefined,
): number | null {
  const dxtrDigits = (dxtrPhone ?? '').replace(/\D/g, '');
  const camsDigits = (camsPhone?.number ?? '').replace(/\D/g, '');

  if (dxtrDigits.length < 10 || camsDigits.length < 10) return null;

  return dxtrDigits.slice(-10) === camsDigits.slice(-10) ? 100 : 0;
}

/**
 * Calculates an email match score between DXTR and CAMS email addresses.
 * Both sides are normalized via trim + lowercase. Returns `null` (not
 * comparable) when either side is empty/undefined after normalization -
 * missing email data does not count against the candidate at all.
 * No partial credit - email is a discrete identifier.
 */
export function calculateEmailScore(
  dxtrEmail: string | undefined,
  camsEmail: string | undefined,
): number | null {
  const dxtrNormalized = (dxtrEmail ?? '').trim().toLowerCase();
  const camsNormalized = (camsEmail ?? '').trim().toLowerCase();

  if (!dxtrNormalized || !camsNormalized) return null;

  return dxtrNormalized === camsNormalized ? 100 : 0;
}

/**
 * Calculates the weighted total score from the individual score components.
 * Weighting: 5% address, 25% name, 5% phone, 5% email, 30% district/division,
 * 30% chapter. Phone and email are nullable ("not comparable" - data missing
 * on either side): when null, that dimension's weight is excluded from the
 * calculation entirely and redistributed proportionally among the remaining
 * applicable dimensions, rather than penalizing the candidate with a 0.
 * Shared by calculateCandidateScore and handleInactivePerfectMatch so the
 * weight distribution only needs to change in one place.
 */
export function calculateTotalScore(scores: {
  addressScore: number;
  nameScore: number;
  phoneScore: number | null;
  emailScore: number | null;
  districtDivisionScore: number;
  chapterScore: number;
}): number {
  const WEIGHTS = {
    addressScore: 0.05,
    nameScore: 0.25,
    phoneScore: 0.05,
    emailScore: 0.05,
    districtDivisionScore: 0.3,
    chapterScore: 0.3,
  } as const;

  let weightedSum = 0;
  let applicableWeight = 0;

  for (const key of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
    const score = scores[key];
    if (score === null) continue;
    weightedSum += score * WEIGHTS[key];
    applicableWeight += WEIGHTS[key];
  }

  return applicableWeight === 0 ? 0 : weightedSum / applicableWeight;
}

/**
 * Calculates a comprehensive candidate score for a trustee.
 * Orchestrates address, name, phone, email, district/division, and chapter
 * scoring with weighted totals.
 * Weighting: 5% address, 25% name, 5% phone, 5% email, 30% district/division,
 * 30% chapter (with phone/email dynamically excluded and redistributed when
 * not comparable - see calculateTotalScore).
 * Logs detailed scoring breakdown at info level.
 */
export function calculateCandidateScore(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
  courtId: string,
  courtDivisionCode: string,
  chapter: string,
  camsTrustee: Trustee,
  appointments: TrusteeAppointment[],
  nameScoreOverride?: number,
): CandidateScore {
  const addressScore = calculateAddressScore(dxtrTrustee.legacy, camsTrustee.public.address);
  // nameScoreOverride is passed by callers (applyMatchOutcome's ImperfectMatch/
  // PerfectMatchInactiveStatus paths) that already know how this trusteeId was resolved - via a
  // fingerprint hit, professional-id match, or matchTrusteeByName's exact/fuzzy tiers - and so
  // already have a trustworthy nameScore. Falling back to calculateNameScore's discrete
  // firstName/lastName comparison in that case would re-derive name confidence from scratch and
  // can produce a WRONG answer when a CAMS trustee's own name fields carry data-quality issues
  // (e.g. a generational suffix baked into lastName, like "Eggmann, III", where DXTR's clean
  // "Eggmann" + separate generation field never equals it under discrete-field comparison even
  // though the composed name string the matcher actually used matched perfectly). Only
  // resolveNameCollisionByScoring's multi-candidate discrimination (no trusteeId decided yet,
  // genuinely comparing raw candidates against each other) omits this and gets a fresh score.
  const nameScore = nameScoreOverride ?? calculateNameScore(dxtrTrustee, camsTrustee);
  const phoneScore = calculatePhoneScore(dxtrTrustee.legacy?.phone, camsTrustee.public.phone);
  const emailScore = calculateEmailScore(dxtrTrustee.legacy?.email, camsTrustee.public.email);
  const districtDivisionScore = calculateDistrictDivisionScore(
    courtId,
    courtDivisionCode,
    appointments,
  );
  const chapterScore = calculateChapterScore(courtId, courtDivisionCode, chapter, appointments);

  const totalScore = calculateTotalScore({
    addressScore,
    nameScore,
    phoneScore,
    emailScore,
    districtDivisionScore,
    chapterScore,
  });

  const candidateScore: CandidateScore = {
    trusteeId: camsTrustee.trusteeId,
    trusteeName: camsTrustee.name,
    totalScore,
    addressScore,
    nameScore,
    phoneScore,
    emailScore,
    districtDivisionScore,
    chapterScore,
    address: camsTrustee.public.address,
    phone: camsTrustee.public.phone,
    email: camsTrustee.public.email,
    appointments,
  };

  context.logger.info(
    MODULE_NAME,
    `Scoring candidate ${camsTrustee.trusteeId}: ` +
      `address=${addressScore}, name=${nameScore}, phone=${phoneScore}, email=${emailScore}, ` +
      `district=${districtDivisionScore}, chapter=${chapterScore}, total=${totalScore}`,
  );

  return candidateScore;
}

/**
 * Outcome of a name-collision scoring attempt (see resolveNameCollisionByScoring):
 *  - 'resolved': a clear winner was found (score >75% AND 5+ points ahead of the runner-up).
 *  - 'no-match': every candidate failed to load, so nothing could be scored.
 *  - 'unresolved': candidates were scored but none stood out as a clear winner.
 */
export type ScoringOutcome =
  | { kind: 'resolved'; trusteeId: string; candidateScores: CandidateScore[] }
  | { kind: 'no-match' }
  | { kind: 'unresolved'; candidateScores: CandidateScore[] };

/**
 * Resolves a name collision (matchTrusteeByName found more than one raw candidate) by scoring
 * each candidate on address, district/division, and chapter alignment.
 * Winner criteria: score >75% AND 5+ points ahead of next candidate.
 * Returns a ScoringOutcome discriminated union for all three business outcomes. A transient
 * infrastructure error (Cosmos RU throttling, a read/write timeout) encountered while fetching a
 * candidate's data still propagates as a thrown error — see the try/catch below — since that is
 * not a business decision this function can make.
 */
export async function resolveNameCollisionByScoring(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  candidateTrusteeIds: string[],
): Promise<ScoringOutcome> {
  // Score all candidates - fetch data in parallel to avoid N+1 queries
  const trusteesRepo = factory.getTrusteesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  const candidateDataPromises = candidateTrusteeIds.map(async (trusteeId) => {
    try {
      const [trustee, appointments] = await Promise.all([
        trusteesRepo.read(trusteeId),
        appointmentsRepo.getTrusteeAppointments(trusteeId),
      ]);
      return { trusteeId, trustee, appointments, error: null };
    } catch (error) {
      // A transient infrastructure error (Cosmos RU throttling, a read/write timeout) is not
      // evidence that this candidate is unscorable — it means we don't yet know. Rethrowing
      // here rejects the enclosing Promise.all, aborting the whole fuzzy-match attempt for this
      // event rather than silently continuing with a smaller (possibly empty) candidate set that
      // could otherwise misclassify a transient failure as NO_TRUSTEE_MATCH or
      // AMBIGUOUS_MATCH_UNRESOLVED — both permanent classifications. The caller
      // (sync-trustee-case-appointments.ts) is responsible for routing this to retryableEvents.
      // This reimplements sync-trustee-case-appointments.ts's isTransientInfraError check rather
      // than importing it, since that module imports this one — importing back would be circular.
      if (isTooManyRequestsError(error) || isGatewayTimeoutError(error)) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { trusteeId, trustee: null, appointments: null, error: errorMessage };
    }
  });

  const candidateData = await Promise.all(candidateDataPromises);

  const candidateScores: CandidateScore[] = [];
  for (const { trusteeId, trustee, appointments, error } of candidateData) {
    if (error) {
      context.logger.warn(MODULE_NAME, `Skipping candidate ${trusteeId}: ${error}`);
      continue;
    }

    const score = calculateCandidateScore(
      context,
      event.dxtrTrustee,
      event.courtId,
      event.courtDivisionCode,
      event.chapter,
      trustee,
      appointments,
    );

    candidateScores.push(score);
  }

  // Guard against empty results (all candidates failed to load)
  if (candidateScores.length === 0) {
    context.logger.warn(
      MODULE_NAME,
      `Fuzzy matching failed: no valid candidates could be scored for case ${event.caseId}`,
    );
    return { kind: 'no-match' };
  }

  // Sort by totalScore descending
  candidateScores.sort((a, b) => b.totalScore - a.totalScore);

  const winner = candidateScores[0];
  const runnerUp = candidateScores[1];

  const meetsThreshold = winner.totalScore > FUZZY_MATCH_SCORE_THRESHOLD;
  const hasSignificantGap =
    !runnerUp || winner.totalScore - runnerUp.totalScore >= FUZZY_MATCH_MIN_GAP;
  // isAppointmentMatch requires court + division + chapter to match on a SINGLE record, a
  // strictly stronger guarantee than "the winner's totalScore cleared the threshold" alone —
  // auto-linking should never rely solely on the additive score.
  const sameAppointmentMatch = isAppointmentMatch(
    winner.appointments ?? [],
    event.courtId,
    event.courtDivisionCode ?? '',
    event.chapter ?? '',
  );

  if (meetsThreshold && hasSignificantGap && sameAppointmentMatch) {
    context.logger.info(
      MODULE_NAME,
      `Fuzzy matching resolved to ${winner.trusteeId} with score ${winner.totalScore}`,
    );
    return { kind: 'resolved', trusteeId: winner.trusteeId, candidateScores };
  }

  // No clear winner
  const candidateList = candidateScores
    .map((score) => `${score.trusteeId} (${score.totalScore} pts)`)
    .join(', ');
  context.logger.warn(
    MODULE_NAME,
    `Fuzzy matching failed: no clear winner among ${candidateScores.length} candidates [${candidateList}]`,
  );

  return { kind: 'unresolved', candidateScores };
}

/**
 * How a 'resolved' NameMatchResult reached its answer - the qualitative counterpart to
 * nameScore's quantified confidence:
 *  - 'exact': findTrusteesByName's anchored, whitespace-only-normalized regex matched exactly
 *    one CAMS trustee. No fuzzy normalization was needed at all.
 *  - 'fuzzy': the exact-match path found nothing, but one of matchTrusteeByName's fuzzy fallback
 *    tiers (normalizeNameForMatching, or its generational-suffix-discarding second pass) matched
 *    exactly one scored candidate. Both fallback tiers share this single label - discarding a
 *    generational suffix is just one more normalization step in the same fuzzy pipeline, no more
 *    a distinct category than any of the pipeline's other steps (stripping a parenthetical
 *    annotation, a source-system artifact, etc.), none of which get their own label either.
 */
type NameMatchQuality = 'exact' | 'fuzzy';

/**
 * Outcome of a name-lookup attempt (see matchTrusteeByName):
 *  - 'resolved': exactly one CAMS trustee matched the name. Carries nameScore (always 100 here -
 *    every tier that can produce 'resolved' represents a name the matcher is fully confident in,
 *    with no discrete-field partial-credit ambiguity to represent) and nameMatchQuality (see
 *    NameMatchQuality) so a caller scoring this candidate later (e.g. applyMatchOutcome's
 *    ImperfectMatch/PerfectMatchInactiveStatus paths) uses THIS determination instead of
 *    independently re-deriving name confidence from raw firstName/lastName fields via
 *    calculateNameScore - which can diverge from what actually matched when a CAMS trustee's own
 *    name fields carry data-quality issues (e.g. a generational suffix baked into lastName, like
 *    "Eggmann, III", that DXTR's clean "Eggmann" + separate generation field will never equal
 *    under discrete-field comparison even though the composed name string matched here just
 *    fine).
 *  - 'no-match': zero CAMS trustees matched the name.
 *  - 'ambiguous': more than one CAMS trustee matched the name (raw, unscored candidates), which
 *    the caller resolves via resolveNameCollisionByScoring.
 */
export type NameMatchResult =
  | { kind: 'resolved'; trusteeId: string; nameScore: number; nameMatchQuality: NameMatchQuality }
  | { kind: 'no-match' }
  | { kind: 'ambiguous'; matchCandidates: CandidateScore[] };

/**
 * Builds the UNSCORED CandidateScore[] shape used for an ambiguous NameMatchResult, whether the
 * candidates came from the exact-match path or the fuzzy fallback below - these candidates have
 * not been through resolveNameCollisionByScoring yet, so every score field is UNSCORED.
 */
function toUnscoredCandidates(trustees: Trustee[]): CandidateScore[] {
  return trustees.map((t) => ({
    trusteeId: t.trusteeId,
    trusteeName: t.name,
    totalScore: UNSCORED,
    addressScore: UNSCORED,
    nameScore: UNSCORED,
    phoneScore: UNSCORED,
    emailScore: UNSCORED,
    districtDivisionScore: UNSCORED,
    chapterScore: UNSCORED,
    address: t.public.address,
    phone: t.public.phone,
    email: t.public.email,
  }));
}

/**
 * Searches CAMS trustees by just the first token of the DXTR trustee's lastName (see
 * firstLastNameToken's doc comment for why a first-token-only query sidesteps needing to know the
 * shape of whatever trailing noise DXTR's lastName carries), then narrows the results to those
 * with at least one active appointment in the event's court - the same courtId filter
 * TrusteeSearchUseCase applies for the UI's manual trustee-search feature, so this tier surfaces
 * the same candidate set a human reviewer would see searching by hand.
 * Deliberately returns raw, unscored candidates rather than filtering by firstName/middleName here
 * - a first-token lastName search alone is broad (a common surname can return dozens of same-
 * surname trustees), so this tier leans entirely on the caller routing the result through
 * resolveNameCollisionByScoring's existing address/phone/email/district/chapter/name scoring and
 * appointment-match gate to do the actual discrimination, exactly as it already does for a raw
 * multi-candidate name collision - duplicating any of that judgment here would risk disagreeing
 * with the scorer that actually decides the outcome.
 * Requires a lastName on the DXTR side and a courtId - there's nothing to search or filter by
 * without them.
 */
async function findLastNameTokenMatches(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
  courtId: string | undefined,
): Promise<Trustee[]> {
  const token = firstLastNameToken(dxtrTrustee.lastName);
  if (!token || !courtId) return [];

  const trusteesRepo = factory.getTrusteesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

  const candidates = await trusteesRepo.searchTrusteesByNameScored(token);
  if (candidates.length === 0) return [];

  const trusteeIds = candidates.map((c) => c.trusteeId);
  const appointments = await appointmentsRepo.getAppointmentsByTrusteeIds(trusteeIds);

  const appointmentsByTrustee = new Map<string, TrusteeAppointment[]>();
  for (const appt of appointments) {
    const list = appointmentsByTrustee.get(appt.trusteeId) ?? [];
    list.push(appt);
    appointmentsByTrustee.set(appt.trusteeId, list);
  }

  return candidates.filter((candidate) =>
    (appointmentsByTrustee.get(candidate.trusteeId) ?? []).some((appt) => appt.courtId === courtId),
  );
}

/**
 * Looks up CAMS trustees by name and returns a NameMatchResult discriminated union for all three
 * business outcomes (resolved/no-match/ambiguous). Does NOT wrap the repository call in a
 * try/catch — a repository failure here is a genuine infrastructure error and propagates as a
 * thrown error, unchanged.
 *
 * When the exact-match path (findTrusteesByName) finds nothing, falls back to the broader
 * phonetic candidate search (searchTrusteesByNameScored) and compares candidates against the
 * DXTR name using normalizeNameForMatching - this bridges punctuation/suffix/spacing gaps that
 * findTrusteesByName's anchored regex (normalized only by normalizeName) cannot.
 */
export async function matchTrusteeByName(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
  courtId?: string,
): Promise<NameMatchResult> {
  const trusteeName = dxtrTrustee.fullName;
  const normalized = normalizeName(trusteeName);
  const trusteesRepo = factory.getTrusteesRepository(context);
  const matches = await trusteesRepo.findTrusteesByName(normalized);

  if (matches.length > 1) {
    const candidates = matches.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    context.logger.info(
      MODULE_NAME,
      `Multiple CAMS trustees found matching name "${normalized}": ${candidates}.`,
    );
    return { kind: 'ambiguous', matchCandidates: toUnscoredCandidates(matches) };
  }

  if (matches.length === 1) {
    return {
      kind: 'resolved',
      trusteeId: matches[0].trusteeId,
      nameScore: 100,
      nameMatchQuality: 'exact',
    };
  }

  const scoredCandidates = await trusteesRepo.searchTrusteesByNameScored(trusteeName);
  const normalizedTarget = normalizeNameForMatching(trusteeName);
  const fallbackMatches = scoredCandidates.filter(
    (candidate) => normalizeNameForMatching(candidate.name) === normalizedTarget,
  );

  if (fallbackMatches.length > 1) {
    const candidates = fallbackMatches.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    context.logger.info(
      MODULE_NAME,
      `Multiple CAMS trustees found matching normalized name "${normalizedTarget}": ${candidates}.`,
    );
    return { kind: 'ambiguous', matchCandidates: toUnscoredCandidates(fallbackMatches) };
  }

  if (fallbackMatches.length === 1) {
    return {
      kind: 'resolved',
      trusteeId: fallbackMatches[0].trusteeId,
      nameScore: 100,
      nameMatchQuality: 'fuzzy',
    };
  }

  // Third-pass fallback: neither the composed-name comparison nor its stricter variant found a
  // match - search by just the first token of DXTR's lastName instead (see
  // findLastNameTokenMatches's doc comment), narrowed to trustees with an active appointment in
  // this event's court. This tier is NOT resolved directly here even for a single candidate - a
  // first-token lastName search alone is much weaker evidence than a full string match, so it is
  // surfaced as 'ambiguous' to route through resolveNameCollisionByScoring's existing
  // address/phone/email/district/chapter/name scoring and appointment-match gate, rather than
  // trusting a single candidate's weaker signal outright.
  const lastNameTokenMatches = await findLastNameTokenMatches(context, dxtrTrustee, courtId);

  if (lastNameTokenMatches.length > 0) {
    const candidates = lastNameTokenMatches
      .map((t: Trustee) => `${t.trusteeId} ("${t.name}")`)
      .join(', ');
    context.logger.info(
      MODULE_NAME,
      `CAMS trustee(s) found matching "${normalized}" by first-token lastName search: ${candidates}.`,
    );
    return { kind: 'ambiguous', matchCandidates: toUnscoredCandidates(lastNameTokenMatches) };
  }

  context.logger.warn(MODULE_NAME, `No CAMS trustee found matching name "${normalized}".`);
  return { kind: 'no-match' };
}
