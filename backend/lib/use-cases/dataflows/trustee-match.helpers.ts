import { ApplicationContext } from '../../adapters/types/basic';
import {
  DxtrTrusteeParty,
  CandidateScore,
  TrusteeAppointmentSyncEvent,
  UNSCORED,
  calculateTotalScore,
} from '@common/cams/dataflow-events';
import factory from '../../factory';
import { LegacyAddress } from '@common/cams/parties';
import { Address, PhoneNumber } from '@common/cams/contact';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { Trustee } from '@common/cams/trustees';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { generateBigrams } from '../../adapters/utils/phonetic-helper';

const MODULE_NAME = 'TRUSTEE-MATCH';

/**
 * Minimum totalScore for a multi-candidate fuzzy-match winner. Set to 74 so a genuine last-name
 * mismatch (nameScore=0, everything else perfect) lands exactly at the threshold and is excluded.
 */
const FUZZY_MATCH_SCORE_THRESHOLD = 74;

/**
 * Minimum point gap a multi-candidate winner must have over the runner-up. Set to the smallest
 * single-dimension swing under WEIGHTS (address/phone/email each at 8%), so a disagreement on any
 * one of those dimensions alone is enough to break a tie.
 */
const FUZZY_MATCH_MIN_GAP = 8;

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
  return str.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
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
 * Deliberately does NOT strip a bare trailing " tr"/"Tr" - indistinguishable from a real name
 * ending in a token that looks like "Tr", and over-strips in practice ("John Doe Tr" -> "John
 * Doe"). A name relying on that convention falls through to human verification instead.
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
 * gap is instead handled by the first-token-lastName search tier in matchTrusteeByName (see
 * firstLastNameToken).
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
  return name.toLowerCase().replaceAll("'", '').replace(/[.-]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Orchestrates the normalization pipeline used to compare a DXTR trustee name against a CAMS
 * trustee's stored name when matchTrusteeByName's exact-match path finds nothing. Order matters -
 * outermost/most specific annotations are stripped first, generic punctuation last. Distinct from
 * normalizeName, which is used unchanged for query construction and write paths.
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
 * Format: "City, ST zipCode" with segments separated by a comma, whitespace, or both, and an
 * optional trailing country segment in any form (or none). DXTR country data is unreliable
 * (state abbreviations, zip codes, "United States", phone numbers, etc.), so it is never
 * captured or compared - parsing stops once city, state, and zip are found.
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

  // Unify comma/whitespace separators, then scan for the first "ST zipCode" token pair -
  // whatever precedes it is the city; anything after (e.g. a country segment) is ignored.
  // Examples: "New York, NY 10001", "Corinth, MS, 38834, USA", "Corinth MS 38834 USA"
  const tokens = cityStateZipCountry.replaceAll(',', ' ').trim().split(/\s+/);

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
 * Computes Jaccard similarity (intersection over union) between two bigram sets, scaled to
 * 0-100. Duplicate bigrams within either input are deduplicated first (Jaccard operates on sets,
 * not multisets). Returns 0 when either set is empty, including when both are - two blank inputs
 * have no positive evidence of similarity to report.
 */
export function jaccardSimilarity(bigramsA: string[], bigramsB: string[]): number {
  const setA = new Set(bigramsA);
  const setB = new Set(bigramsB);

  if (setA.size === 0 || setB.size === 0) return 0;

  let intersectionSize = 0;
  for (const bigram of setA) {
    if (setB.has(bigram)) intersectionSize++;
  }

  const unionSize = setA.size + setB.size - intersectionSize;
  return (intersectionSize / unionSize) * 100;
}

/**
 * Common USPS street-suffix, secondary-unit-designator, and directional abbreviations
 * encountered in trustee office addresses. Scoped to what's plausible for a law office address,
 * not the full USPS Publication 28 standard. Expanding to full word form before bigramming means
 * "St"/"Street" and "Ste"/"Suite" share bigrams instead of scoring as unrelated tokens. Keys are
 * matched as whole tokens only (see normalizeAddressLine), so this never mis-expands an
 * abbreviation embedded inside a longer word.
 */
const ADDRESS_ABBREVIATIONS: Record<string, string> = {
  st: 'street',
  ave: 'avenue',
  blvd: 'boulevard',
  dr: 'drive',
  rd: 'road',
  ln: 'lane',
  ct: 'court',
  pl: 'place',
  ste: 'suite',
  apt: 'apartment',
  fl: 'floor',
  bldg: 'building',
  pkwy: 'parkway',
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
};

/** Unit designators (post-expansion) that already convey the same thing a bare "#" marker does. */
const UNIT_DESIGNATOR_WORDS = new Set(['suite', 'apartment', 'floor', 'unit', 'room']);

/**
 * Pads a single-digit all-digit token with a leading "0" so it reaches generateBigrams's minimum
 * token length of 2 (that function drops tokens shorter than 2 characters). Without this, a
 * single-digit house/unit number - the most common way two offices in the same building differ -
 * is invisible to bigram comparison: "Suite 4" and "Suite 5" would both reduce to zero-length
 * tokens and score a false 100% match. "0" also doubles as a genuine leading-zero pad ("4" and
 * "04" are the same number, per stripLeadingZeros below), so that case still compares equal.
 * Tokens already 2+ characters (e.g. "10") clear the length floor on their own and are untouched.
 */
function padSingleDigitNumericToken(token: string): string {
  if (!/^\d+$/.test(token)) return token;
  return token.length === 1 ? `0${token}` : token;
}

/** Strips leading zeros the same way normalizeChapter does, so "4" and "04" compare equal. */
function stripLeadingZeros(numericToken: string): string {
  return numericToken.replace(/^0+(?=\d)/, '');
}

/**
 * Extracts all-digit tokens (house number, suite/unit number, etc.) from an already-normalized
 * address line, leading-zero-stripped (see stripLeadingZeros). Order isn't meaningful - a house
 * number and suite number can appear in either order across DXTR/CAMS data entry.
 */
function extractNumericTokens(normalizedLine: string): string[] {
  return normalizedLine
    .split(' ')
    .filter((token) => /^\d+$/.test(token))
    .map(stripLeadingZeros);
}

/**
 * Scores how well two address lines' numeric tokens (house/suite/unit numbers) agree, as the
 * fraction of the larger side's numeric tokens the smaller side also contains exactly. Returns
 * null when neither side has any numeric token - the caller then falls back to bigram similarity
 * alone. A numeric token present on only one side scores a real partial penalty rather than being
 * ignored, since a missing unit number should lower confidence, not be invisible to it.
 */
function calculateNumericTokenScore(
  normalizedLineA: string,
  normalizedLineB: string,
): number | null {
  const numbersA = new Set(extractNumericTokens(normalizedLineA));
  const numbersB = new Set(extractNumericTokens(normalizedLineB));

  const largerSideSize = Math.max(numbersA.size, numbersB.size);
  if (largerSideSize === 0) return null;

  let matchCount = 0;
  for (const number of numbersA) {
    if (numbersB.has(number)) matchCount++;
  }

  return (matchCount / largerSideSize) * 100;
}

/**
 * Normalizes a single address line (or lines already joined into one string) for Jaccard/bigram
 * comparison: lowercases, strips punctuation, expands common USPS street-suffix/unit/directional
 * abbreviations (see ADDRESS_ABBREVIATIONS) token-by-token, resolves a bare "#" unit marker (see
 * below), and collapses whitespace. Returns an empty string for undefined/blank input.
 *
 * "#" is handled separately from the abbreviation map: expanding it to "suite" unconditionally
 * would double up when the line already spells out a unit designator ("Suite #4" would otherwise
 * become "suite suite 4"). A "#" is dropped when the preceding token already expanded to a unit
 * designator (see UNIT_DESIGNATOR_WORDS), and expanded to "suite" only when it stands alone.
 *
 * Example: "123 Main St., Suite #4" -> "123 main street suite 4".
 * Example: "123 Main St. #4" -> "123 main street suite 4".
 * Example: "P.O. Box 51067" -> "po box 51067" (same as "PO Box 51067").
 */
export function normalizeAddressLine(line?: string): string {
  if (!line) return '';

  const withoutPunctuation = line
    .toLowerCase()
    // "P.O." has to collapse to "po" before the generic punctuation strip below runs, or its
    // periods leave "p" and "o" as separate 1-character tokens instead of one token equal to
    // "PO" Box's own "po" - the same PO box would otherwise never bigram-match itself.
    .replace(/\bp\.?\s*o\.?\b/g, 'po ')
    .replaceAll('#', ' # ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!withoutPunctuation) return '';

  const tokens = withoutPunctuation
    .split(' ')
    .map((token) => ADDRESS_ABBREVIATIONS[token] ?? token);

  const resolved: string[] = [];
  for (const token of tokens) {
    if (token === '#') {
      const previous = resolved.at(-1);
      if (!UNIT_DESIGNATOR_WORDS.has(previous)) resolved.push('suite');
      continue;
    }
    resolved.push(token);
  }

  return resolved.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calculates address match score between DXTR and CAMS addresses as a weighted blend of three
 * independently-scored components:
 * - Address lines (50%): a blend of bigram similarity and exact numeric-token agreement over
 *   address1+address2+address3 (concatenated per side, normalized via normalizeAddressLine) -
 *   the most distinguishing signal, since two different offices rarely share a street address.
 *   Bigram similarity alone isn't enough, since generateBigrams drops tokens shorter than 2
 *   characters, making a single-digit house/suite number invisible ("Suite 4" vs "Suite 5" would
 *   score a false perfect match) - see calculateNumericTokenScore for how that's corrected.
 * - ZIP (30%): exact match on the base 5-digit ZIP only, not fuzzy-matched. A ZIP+4 extension
 *   present or differing on either side doesn't contradict an otherwise-matching base ZIP, since
 *   DXTR's cityStateZipCountry is inconsistent about carrying the +4 suffix.
 * - City+State (20%): Jaccard/bigram similarity of city+state concatenated per side - the weakest
 *   signal, since many different offices share a city and state.
 * Returns 0 immediately if DXTR's cityStateZipCountry can't be parsed (parseCityStateZip returns
 * null) - with no city/state/zip to anchor against, address1 alone isn't trustworthy to score.
 * All comparisons case-insensitive; a missing address1 on either side scores that component 0
 * without failing the other two.
 */
export function calculateAddressScore(
  dxtrAddress: LegacyAddress | undefined,
  camsAddress: Address,
): number {
  const parsed = parseCityStateZip(dxtrAddress?.cityStateZipCountry);

  if (!parsed) return 0;

  const zip5 = (zip: string) => zip.trim().split('-')[0].toLowerCase();

  const joinAddressLines = (address?: LegacyAddress | Address) =>
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

  // Blended 50/50 with bigram similarity: a wrong house/suite/unit number is at least as strong
  // a signal as a spelling/abbreviation mismatch, so neither should fully outvote the other.
  // When neither side has a numeric token, numericTokenScore is null and bigram carries alone.
  const numericTokenScore = calculateNumericTokenScore(dxtrAddressLines, camsAddressLines);
  const addressLinesScore =
    numericTokenScore === null ? bigramScore : bigramScore * 0.5 + numericTokenScore * 0.5;

  const dxtrCityState = normalizeAddressLine(`${parsed.city} ${parsed.state}`);
  const camsCityState = normalizeAddressLine(`${camsAddress.city} ${camsAddress.state}`);
  const cityStateScore = jaccardSimilarity(
    generateBigrams(dxtrCityState),
    generateBigrams(camsCityState),
  );

  const dxtrZip = zip5(parsed.zipCode);
  const camsZip = zip5(camsAddress.zipCode);
  const zipScore = dxtrZip && camsZip && dxtrZip === camsZip ? 100 : 0;

  // Rounded to the nearest integer so this behaves like every other CandidateScore sub-score
  // (nameScore, districtDivisionScore, chapterScore are always whole numbers).
  return Math.round(addressLinesScore * 0.5 + zipScore * 0.3 + cityStateScore * 0.2);
}

/**
 * Normalizes a chapter string for comparison.
 * Removes leading zeros and extracts base chapter from subchapter variants.
 * Examples: "07" → "7", "11-subchapter-v" → "11"
 */
export function normalizeChapter(chapter: string): string {
  // Extract base chapter number (before any dash or subchapter suffix)
  const match = new RegExp(/^0*(\d+)/).exec(chapter);
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
 * chapter all on that same record — used both for perfect-match auto-linking and as a gate (see
 * resolveNameCollisionByScoring) ensuring a fuzzy-match winner's district/division and chapter
 * evidence didn't come from two different appointments. Stricter than the individual scoring
 * functions, which check these criteria independently across all appointments.
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
 * Normalizes chapters before comparison (e.g., "7" === "07"). Only active appointments that also
 * cover the case's court + division are eligible — a trustee active in an unrelated division
 * must never score 100 on chapter just because some other appointment's chapter happens to
 * match. chapterScore can therefore never be 100 when calculateDistrictDivisionScore is 50 or 0.
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
 * Normalizes a name part for strict matching: lowercase and strip all non-alphanumeric
 * characters (e.g. "L." -> "l", "O'Brien" -> "obrien"). Distinct from `normalizeName`, which
 * only collapses whitespace for full-name lookup matching.
 */
function normalizeNamePart(namePart?: string): string {
  return (namePart ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Reduces a raw lastName field to just its first word: drops apostrophes (so "O'Brien" stays one
 * word), replaces remaining punctuation with spaces, collapses whitespace, and returns the first
 * token (lowercased). Used both for candidate discovery (the first-token-lastName search tier in
 * matchTrusteeByName) and for calculateNameScore's own lastName comparison - taking only the
 * first token sidesteps needing to enumerate every shape of trailing noise (a role marker, a
 * comma, a generational suffix), since by definition anything after the first token isn't the
 * real surname. Trade-off: a hyphenated compound surname ("Garcia-Miranda") also reduces to just
 * "garcia" - the downstream scoring/appointment-match gate is responsible for confirming that was
 * enough to identify the right person.
 * Example: "Marshack (TR)" -> "marshack", "Wallo, Trustee" -> "wallo", "Malloy, III" -> "malloy",
 * "O'Brien" -> "obrien".
 */
export function firstLastNameToken(namePart?: string): string {
  const withoutApostrophes = (namePart ?? '').toLowerCase().replaceAll("'", '');
  const spaced = withoutApostrophes.replace(/[^a-z0-9]+/g, ' ');
  return spaced.trim().split(' ')[0] ?? '';
}

const isInitialOf = (initial: string, full: string): boolean =>
  initial.length === 1 && full.length > 0 && full.startsWith(initial);

/**
 * Scores how well two already-normalized firstName values compare. Unlike scoreMiddleNamePart, a
 * firstName is expected to always be present and a genuine mismatch is strong evidence of
 * different people, so missing or mismatched both score 0. The one relaxation: an initial-vs-full
 * relationship (e.g. DXTR "G." vs CAMS "George") scores 85, the same credit scoreMiddleNamePart
 * gives that relationship.
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

// Moved to common/src/cams/dataflow-events.ts so dev-tools' seed-data validator can import the
// exact same function instead of duplicating its weights (see CAMS-871 Slice 2 Task 3).
// Re-exported here so existing consumers of this module don't need to change their import path.
export { calculateTotalScore };

/**
 * The case-identifying fields calculateCandidateScore needs to score district/division and
 * chapter alignment. Grouped into one object since all three are always sourced and passed
 * together (a case's court, division, and chapter are inseparable facts about the same case).
 */
export type CaseMatchContext = {
  courtId: string;
  courtDivisionCode: string;
  chapter: string;
};

/**
 * Scores the four dimensions available with no case-appointment-shaped evidence at all: name,
 * address, phone, email. Used by resolveByContactCorroboration and resolveDuplicateNameCandidates,
 * neither of which has a case (courtId/courtDivisionCode/chapter) or appointments to score against
 * - see calculateCandidateScore for the full six-dimension score once a case is in play.
 *
 * totalScore is a genuine weighted total over these four dimensions alone (see calculateTotalScore
 * for the weights, redistributed since districtDivisionScore/chapterScore are never supplied) -
 * not a placeholder. districtDivisionScore/chapterScore are 0 and appointments is empty only
 * because CandidateScore's shape requires all six fields; callers of this function must not read
 * those two fields as real signal.
 */
function scoreOnContactFieldsOnly(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
  camsTrustee: Trustee,
  nameScore: number,
): CandidateScore {
  const addressScore = calculateAddressScore(sourceTrustee.legacy, camsTrustee.public.address);
  const phoneScore = calculatePhoneScore(sourceTrustee.legacy?.phone, camsTrustee.public.phone);
  const emailScore = calculateEmailScore(sourceTrustee.legacy?.email, camsTrustee.public.email);

  const totalScore = calculateTotalScore({
    addressScore,
    nameScore,
    phoneScore,
    emailScore,
    districtDivisionScore: 0,
    chapterScore: 0,
  });

  const candidateScore: CandidateScore = {
    trusteeId: camsTrustee.trusteeId,
    trusteeName: camsTrustee.name,
    totalScore,
    addressScore,
    nameScore,
    phoneScore,
    emailScore,
    districtDivisionScore: 0,
    chapterScore: 0,
    address: camsTrustee.public.address,
    phone: camsTrustee.public.phone,
    email: camsTrustee.public.email,
    appointments: [],
  };

  context.logger.info(
    MODULE_NAME,
    `Scoring candidate ${camsTrustee.trusteeId} on contact fields only: ` +
      `address=${addressScore}, name=${nameScore}, phone=${phoneScore}, email=${emailScore}, ` +
      `total=${totalScore}`,
  );

  return candidateScore;
}

/**
 * Calculates a comprehensive candidate score for a trustee, orchestrating address, phone, email,
 * district/division, and chapter scoring into a weighted total against an already-known
 * nameScore (see calculateTotalScore for the weights). Logs the scoring breakdown at info level.
 *
 * Takes nameScore as an input rather than computing it internally via calculateNameScore, since
 * every caller already knows it by the time it has a single camsTrustee to score: either it
 * scored discrete firstName/lastName fields itself (resolveNameCollisionByScoring,
 * resolveByContactCorroboration, resolveDuplicateNameCandidates - see calculateNameScore), or it
 * already knows how this trusteeId was resolved (applyMatchOutcome's ImperfectMatch/
 * PerfectMatchInactiveStatus paths, via a fingerprint hit or matchTrusteeByName's exact/fuzzy
 * tiers) and re-deriving it here via calculateNameScore's discrete-field comparison would risk a
 * WRONG answer when a CAMS trustee's own name fields carry data-quality issues (e.g. a
 * generational suffix baked into lastName, "Eggmann, III", that DXTR's clean "Eggmann" never
 * equals under discrete-field comparison even though the composed name matched perfectly).
 */
export function calculateCandidateScore(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
  caseMatch: CaseMatchContext,
  camsTrustee: Trustee,
  appointments: TrusteeAppointment[],
  nameScore: number,
): CandidateScore {
  const { courtId, courtDivisionCode, chapter } = caseMatch;
  const addressScore = calculateAddressScore(dxtrTrustee.legacy, camsTrustee.public.address);
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
 * Fetches each candidate trustee (and whatever extra per-candidate data `fetchExtra` loads
 * alongside it, e.g. appointments) in parallel, shared by resolveNameCollisionByScoring,
 * resolveByContactCorroboration, and resolveDuplicateNameCandidates - all three need the same
 * "load a candidate, and if it fails for a non-transient reason carry the failure forward instead
 * of throwing" shape. A transient infrastructure error (Cosmos RU throttling, a read/write
 * timeout) is not evidence a candidate is unscorable — it means the caller doesn't yet know, so it
 * rethrows to abort the whole resolution attempt rather than silently continuing with a smaller
 * candidate set that could misclassify a transient failure as a permanent outcome. Reimplements
 * sync-trustee-case-appointments.ts's isTransientInfraError check rather than importing it, since
 * that module imports this one — importing back would be circular.
 */
async function fetchCandidateTrustees<TExtra>(
  context: ApplicationContext,
  candidateTrusteeIds: string[],
  fetchExtra: (trusteeId: string) => Promise<TExtra>,
): Promise<{ trusteeId: string; trustee: Trustee; extra: TExtra; error: null }[]> {
  const trusteesRepo = factory.getTrusteesRepository(context);

  const candidateData = await Promise.all(
    candidateTrusteeIds.map(async (trusteeId) => {
      try {
        const [trustee, extra] = await Promise.all([
          trusteesRepo.read(trusteeId),
          fetchExtra(trusteeId),
        ]);
        return { trusteeId, trustee, extra, error: null };
      } catch (error) {
        if (isTooManyRequestsError(error) || isGatewayTimeoutError(error)) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        return { trusteeId, trustee: null, extra: null, error: errorMessage };
      }
    }),
  );

  const loaded: { trusteeId: string; trustee: Trustee; extra: TExtra; error: null }[] = [];
  for (const candidate of candidateData) {
    if (candidate.error) {
      context.logger.warn(
        MODULE_NAME,
        `Skipping candidate ${candidate.trusteeId}: ${candidate.error}`,
      );
      continue;
    }
    loaded.push(candidate as { trusteeId: string; trustee: Trustee; extra: TExtra; error: null });
  }

  return loaded;
}

/**
 * Resolves a name collision (matchTrusteeByName found more than one raw candidate) by scoring
 * each candidate on address, district/division, and chapter alignment.
 * Winner criteria: score >75% AND 5+ points ahead of next candidate.
 * Returns a ScoringOutcome discriminated union for all three business outcomes. A transient
 * infrastructure error (Cosmos RU throttling, a read/write timeout) fetching a candidate's data
 * still propagates as a thrown error — see the try/catch below — since that's not a business
 * decision this function can make.
 */
export async function resolveNameCollisionByScoring(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  candidateTrusteeIds: string[],
): Promise<ScoringOutcome> {
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const candidates = await fetchCandidateTrustees(context, candidateTrusteeIds, (trusteeId) =>
    appointmentsRepo.getTrusteeAppointments(trusteeId),
  );

  const candidateScores: CandidateScore[] = candidates.map(({ trustee, extra: appointments }) =>
    calculateCandidateScore(
      context,
      event.dxtrTrustee,
      {
        courtId: event.courtId,
        courtDivisionCode: event.courtDivisionCode,
        chapter: event.chapter,
      },
      trustee,
      appointments,
      calculateNameScore(event.dxtrTrustee, trustee),
    ),
  );

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
  // isAppointmentMatch requires court + division + chapter to match on a SINGLE record —
  // stronger than "the winner's totalScore cleared the threshold" alone.
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
 * Minimum nameScore (see calculateNameScore) for a candidate to be considered by
 * resolveByContactCorroboration. Below this, a name difference is too weak a starting point for
 * contact-field corroboration to rescue, regardless of how well address/phone/email line up.
 * Tuned via test/integration/sync-acms-professional-ids-audit/scripts/auto-link-threshold-backtest.ts.
 */
const CONTACT_CORROBORATION_NAME_THRESHOLD = 85;

/**
 * Minimum addressScore for address alone to count as strong corroboration under
 * resolveByContactCorroboration. Phone/email instead use their scale's max (100, an exact match)
 * since both are short, structured values where a partial match isn't meaningfully distinguishable
 * from coincidence the way a fuzzy address bigram score is.
 */
const CONTACT_CORROBORATION_ADDRESS_THRESHOLD = 80;

/**
 * Minimum addressScore for a parseable ACMS address to be treated as a weak positive signal
 * (allowed through isNoContradictionMatch's fallback) rather than a genuine disagreement
 * (blocked). Tuned via the same backtest as CONTACT_CORROBORATION_NAME_THRESHOLD.
 */
const NO_CONTRADICTION_ADDRESS_FLOOR = 30;

/**
 * Resolves a name-match candidate list on name + address/phone/email corroboration alone, with no
 * case-appointment-shaped evidence (no district/division, no chapter, no isAppointmentMatch gate)
 * - unlike resolveNameCollisionByScoring, this never touches
 * TrusteeAppointmentSyncEvent/getTrusteeAppointments, so it works for a source record with no
 * case/court context (an ACMS professional record - see sync-acms-professional-ids.ts's
 * processNameMatch). Shared rather than ACMS-only, as a corroboration path for when
 * resolveNameCollisionByScoring's stronger appointment-gated evidence is unavailable or already
 * unresolved - not a replacement for it.
 *
 * Winner criteria (see CONTACT_CORROBORATION_NAME_THRESHOLD/CONTACT_CORROBORATION_ADDRESS_THRESHOLD):
 *  - Exactly one candidate clears nameScore >= 85. Two or more candidates clearing the name bar is
 *    always 'unresolved' here; picking among multiple plausible same-name candidates is
 *    resolveDuplicateNameCandidates' job.
 *  - That candidate's addressScore >= 80, OR phoneScore === 100, OR emailScore === 100 - any one
 *    strong signal is enough, since a stale/moved office address is common in this population but
 *    doesn't contradict an otherwise-exact name+phone match. A candidate whose only qualifying
 *    field is null/incomparable does not corroborate.
 *
 * Scores candidates via scoreOnContactFieldsOnly (name/address/phone/email only, no appointments
 * to fetch) rather than calculateCandidateScore, since there's no case here to score
 * district/division/chapter against.
 */
export async function resolveByContactCorroboration(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
  candidateTrusteeIds: string[],
): Promise<ScoringOutcome> {
  const candidates = await fetchCandidateTrustees(
    context,
    candidateTrusteeIds,
    async () => undefined,
  );

  const candidateScores: CandidateScore[] = candidates.map(({ trustee }) =>
    scoreOnContactFieldsOnly(
      context,
      sourceTrustee,
      trustee,
      calculateNameScore(sourceTrustee, trustee),
    ),
  );

  if (candidateScores.length === 0) {
    context.logger.warn(
      MODULE_NAME,
      'Contact corroboration failed: no valid candidates could be scored',
    );
    return { kind: 'no-match' };
  }

  const qualifying = candidateScores.filter(
    (score) => score.nameScore >= CONTACT_CORROBORATION_NAME_THRESHOLD,
  );

  if (qualifying.length !== 1) {
    if (qualifying.length > 1) {
      const candidateList = qualifying
        .map((score) => `${score.trusteeId} (name=${score.nameScore})`)
        .join(', ');
      context.logger.warn(
        MODULE_NAME,
        `Contact corroboration failed: ${qualifying.length} candidates clear the name threshold ` +
          `[${candidateList}] - refusing to guess`,
      );
    }
    return { kind: 'unresolved', candidateScores };
  }

  const winner = qualifying[0];
  const corroborated =
    winner.addressScore >= CONTACT_CORROBORATION_ADDRESS_THRESHOLD ||
    winner.phoneScore === 100 ||
    winner.emailScore === 100;

  if (corroborated) {
    context.logger.info(
      MODULE_NAME,
      `Contact corroboration resolved to ${winner.trusteeId} ` +
        `[name=${winner.nameScore} address=${winner.addressScore} phone=${winner.phoneScore} email=${winner.emailScore}]`,
    );
    return { kind: 'resolved', trusteeId: winner.trusteeId, candidateScores };
  }

  if (isNoContradictionMatch(sourceTrustee, winner)) {
    context.logger.info(
      MODULE_NAME,
      `Contact corroboration resolved to ${winner.trusteeId} via no-contradiction fallback ` +
        `[name=${winner.nameScore} address=${winner.addressScore} phone=${winner.phoneScore} email=${winner.emailScore}]`,
    );
    return { kind: 'resolved', trusteeId: winner.trusteeId, candidateScores };
  }

  context.logger.warn(
    MODULE_NAME,
    `Contact corroboration failed: sole name-qualifying candidate ${winner.trusteeId} lacks ` +
      `strong address/phone/email corroboration [address=${winner.addressScore} ` +
      `phone=${winner.phoneScore} email=${winner.emailScore}]`,
  );
  return { kind: 'unresolved', candidateScores };
}

/**
 * Narrow fallback for a single name-qualifying candidate that clears neither
 * CONTACT_CORROBORATION_ADDRESS_THRESHOLD nor an exact phone/email match, but where the
 * corroboration bar was never really failable: sourceTrustee recorded no comparable phone or
 * email at all, and either recorded no comparable address, or its address score - while below
 * CONTACT_CORROBORATION_ADDRESS_THRESHOLD - doesn't represent a genuine disagreement. A
 * PARSEABLE ACMS address (see parseCityStateZip) scoring below NO_CONTRADICTION_ADDRESS_FLOOR
 * means both sides had a real address to compare and it disagreed, which is not relaxed here.
 * Requires nameScore === 100, a materially higher bar than the main corroboration path, since
 * this fallback has no other corroborating signal to lean on.
 *
 * Backtested against a real trustee-professional-ids export: 91% of candidates that clear the
 * name threshold but not the main corroboration bar have an actively contradicting phone number
 * and are correctly excluded here; the rest hand-verified as genuine matches (e.g. an ACMS name
 * carrying a stray "INACTIVE" marker that still resolves to the correct, active CAMS trustee).
 */
function isNoContradictionMatch(sourceTrustee: DxtrTrusteeParty, winner: CandidateScore): boolean {
  const isExactNameMatch = winner.nameScore === 100;
  const hasNoComparablePhoneOrEmail = winner.phoneScore === null && winner.emailScore === null;

  const acmsAddress1 = sourceTrustee.legacy?.address1?.trim();
  const acmsCityStateZip = sourceTrustee.legacy?.cityStateZipCountry?.trim();
  const hasBlankAcmsDemographic =
    !acmsAddress1 &&
    !acmsCityStateZip &&
    !sourceTrustee.legacy?.phone &&
    !sourceTrustee.legacy?.email;

  const hasParseableAcmsAddress = parseCityStateZip(acmsCityStateZip) !== null;
  const hasContradictingAddress =
    hasParseableAcmsAddress && winner.addressScore < NO_CONTRADICTION_ADDRESS_FLOOR;

  if (!isExactNameMatch) return false;
  if (!hasNoComparablePhoneOrEmail) return false;
  if (hasBlankAcmsDemographic) return false;
  return !hasContradictingAddress;
}

/**
 * Minimum addressScore gap (best candidate in a same-name group minus the second-best) for
 * resolveDuplicateNameCandidates to trust a same-trusteeName tiebreak. Set well above
 * FUZZY_MATCH_MIN_GAP (8, tuned for distinguishing two different people) since this tiebreak
 * instead decides which of two likely-duplicate records to trust. Tuned via a backtest against a
 * real trustee-professional-ids export.
 */
const DUPLICATE_NAME_ADDRESS_GAP_THRESHOLD = 60;

/**
 * Outcome of resolveDuplicateNameCandidates - distinct from ScoringOutcome since DXTR's
 * sync-trustee-case-appointments.ts has an exhaustive switch over ScoringOutcome.kind:
 *  - 'resolved-duplicate': two or more candidates share the same normalized trusteeName (likely
 *    the same real person recorded twice in the trustees collection, a CAMS data-quality problem
 *    rather than a name-matching ambiguity) and the addressScore gap between the best and
 *    second-best of that group clears DUPLICATE_NAME_ADDRESS_GAP_THRESHOLD. Callers should
 *    log/report this as a likely trustees-collection duplicate in addition to using trusteeId.
 *  - 'unresolved': candidates were scored but nothing qualifies as a safe duplicate tiebreak -
 *    covers both "no two candidates share a name" and "gap too small to trust".
 *  - 'no-match': every candidate failed to load, so nothing could be scored.
 */
export type DuplicateResolutionOutcome =
  | { kind: 'resolved-duplicate'; trusteeId: string; candidateScores: CandidateScore[] }
  | { kind: 'unresolved'; candidateScores: CandidateScore[] }
  | { kind: 'no-match' };

/**
 * Resolves a multi-candidate name match (matchTrusteeByName's 'ambiguous' result, or
 * resolveByContactCorroboration's 'unresolved' with 2+ name-qualifying candidates) by checking
 * specifically for the same-real-person-recorded-twice shape: two or more candidates whose
 * trusteeName is identical once normalized (case/whitespace-insensitive), where one scores much
 * better against sourceTrustee's address than the other. Genuinely different candidates (e.g.
 * "David L. Miller" vs "David P. Miller") are never resolved here, only reported as unresolved -
 * gap-based tiebreaking between distinct real people is out of scope for this function.
 *
 * Like resolveByContactCorroboration, this has no case-appointment-shaped evidence and is shared
 * (not ACMS-only) - resolveNameCollisionByScoring hits the identical raw candidate pool from
 * matchTrusteeByName's ambiguous path and can just as easily be looking at a CAMS-side duplicate
 * as an ACMS-sourced ambiguity.
 */
export async function resolveDuplicateNameCandidates(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
  candidateTrusteeIds: string[],
): Promise<DuplicateResolutionOutcome> {
  const candidates = await fetchCandidateTrustees(
    context,
    candidateTrusteeIds,
    async () => undefined,
  );

  // addressScore against sourceTrustee only; totalScore/nameScore are not meaningful for the
  // same-person grouping below (see asComparableParty for the candidate-vs-candidate comparison).
  const scoredCandidates: { trustee: Trustee; score: CandidateScore }[] = candidates.map(
    ({ trustee }) => ({
      trustee,
      score: scoreOnContactFieldsOnly(
        context,
        sourceTrustee,
        trustee,
        calculateNameScore(sourceTrustee, trustee),
      ),
    }),
  );

  if (scoredCandidates.length === 0) {
    context.logger.warn(
      MODULE_NAME,
      'Duplicate-name resolution failed: no valid candidates could be scored',
    );
    return { kind: 'no-match' };
  }

  const candidateScores = scoredCandidates.map((c) => c.score);

  // Groups candidates that plausibly refer to the same real person by reusing calculateNameScore
  // pairwise (candidate vs. candidate, not candidate vs. sourceTrustee) - not
  // normalizeNameForMatching's raw string-equality check, which would never recognize "Roy J.
  // Cohen" and "R. Cohen" as the same person.
  const asComparableParty = (trustee: Trustee): DxtrTrusteeParty => ({
    fullName: trustee.name,
    firstName: trustee.firstName,
    middleName: trustee.middleName,
    lastName: trustee.lastName,
  });

  const groups: { trustee: Trustee; score: CandidateScore }[][] = [];
  for (const candidate of scoredCandidates) {
    const existingGroup = groups.find((group) =>
      group.some(
        (member) =>
          calculateNameScore(asComparableParty(candidate.trustee), member.trustee) >=
          CONTACT_CORROBORATION_NAME_THRESHOLD,
      ),
    );
    if (existingGroup) {
      existingGroup.push(candidate);
    } else {
      groups.push([candidate]);
    }
  }

  for (const group of groups) {
    if (group.length < 2) continue;

    const sorted = [...group].sort((a, b) => b.score.addressScore - a.score.addressScore);
    const winner = sorted[0].score;
    const runnerUp = sorted[1].score;
    const gap = winner.addressScore - runnerUp.addressScore;

    if (gap >= DUPLICATE_NAME_ADDRESS_GAP_THRESHOLD) {
      context.logger.warn(
        MODULE_NAME,
        `Duplicate-name resolution: ${group.length} candidates plausibly refer to the same person ` +
          `("${winner.trusteeName}") - resolving to ${winner.trusteeId} (addressScore=${winner.addressScore}) ` +
          `over ${group
            .map((c) => c.score)
            .filter((c) => c.trusteeId !== winner.trusteeId)
            .map((c) => `${c.trusteeId} (addressScore=${c.addressScore})`)
            .join(', ')} - this is LIKELY a trustees-collection duplicate, not a genuine name ` +
          `collision. Worth a data-quality follow-up, not just a match decision.`,
      );
      return { kind: 'resolved-duplicate', trusteeId: winner.trusteeId, candidateScores };
    }
  }

  context.logger.warn(
    MODULE_NAME,
    `Duplicate-name resolution failed: no same-name candidate group clears the ` +
      `${DUPLICATE_NAME_ADDRESS_GAP_THRESHOLD}-point addressScore gap - refusing to guess`,
  );
  return { kind: 'unresolved', candidateScores };
}

/**
 * How a 'resolved' NameMatchResult reached its answer - the qualitative counterpart to
 * nameScore's quantified confidence:
 *  - 'exact': findTrusteesByName's anchored, whitespace-only-normalized regex matched exactly
 *    one CAMS trustee. No fuzzy normalization was needed.
 *  - 'fuzzy': the exact-match path found nothing, but one of matchTrusteeByName's fuzzy fallback
 *    tiers (normalizeNameForMatching, or its generational-suffix-discarding second pass) matched
 *    exactly one scored candidate. Both tiers share this label - neither is a more distinct
 *    category than the pipeline's other normalization steps, none of which get their own label.
 */
type NameMatchQuality = 'exact' | 'fuzzy';

/**
 * Outcome of a name-lookup attempt (see matchTrusteeByName):
 *  - 'resolved': exactly one CAMS trustee matched the name. Carries nameScore (always 100 here,
 *    since every tier that can produce 'resolved' is fully confident) and nameMatchQuality (see
 *    NameMatchQuality) so a caller scoring this candidate later uses THIS determination instead
 *    of re-deriving name confidence via calculateNameScore, which can diverge when a CAMS
 *    trustee's own name fields carry data-quality issues (e.g. a generational suffix baked into
 *    lastName, "Eggmann, III", that DXTR's clean "Eggmann" never equals under discrete-field
 *    comparison even though the composed name matched here just fine).
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
 * Reduces a raw lastName field to the lastName-token search candidates for discovery: the first
 * token (see firstLastNameToken) plus, when the lastName contains a hyphen, the first token of
 * its last hyphen segment. A hyphenated compound surname carries a maiden/married or two-family
 * name across DXTR and CAMS inconsistently ("Casciato-Northrup" in DXTR vs just "Northrup" in
 * CAMS) - unlike calculateNameScore's use of firstLastNameToken (which compares two names already
 * identified as candidates), this function's job is candidate DISCOVERY, so trying only the first
 * segment can miss the person entirely when CAMS only carries the second half. Returns 1 token
 * for a non-hyphenated lastName (no redundant second search), deduped so a lastName that is
 * itself unhyphenated but whose hyphen segment coincides doesn't double up.
 */
function lastNameTokenSearchCandidates(lastName?: string): string[] {
  const firstToken = firstLastNameToken(lastName);
  if (!firstToken) return [];

  const hyphenSegments = (lastName ?? '').split('-');
  if (hyphenSegments.length < 2) return [firstToken];

  const lastSegmentToken = firstLastNameToken(hyphenSegments.at(-1));
  const tokens = [firstToken];
  if (lastSegmentToken && lastSegmentToken !== firstToken) tokens.push(lastSegmentToken);
  return tokens;
}

/**
 * Searches CAMS trustees by lastName-token candidates (see lastNameTokenSearchCandidates) derived
 * from the DXTR trustee's lastName. Does not narrow results by court appointment -
 * district/division evidence is left to the caller's resolveNameCollisionByScoring, which scores
 * it (0/50/100, see calculateDistrictDivisionScore) rather than gating candidate discovery on it.
 * Returns raw, unscored, deduped-by-trusteeId candidates; the caller's
 * resolveNameCollisionByScoring performs the address/phone/email/district/chapter/name scoring
 * and appointment-match discrimination. Requires a lastName on the DXTR side - there's nothing to
 * search by without one.
 */
async function findLastNameTokenMatches(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
): Promise<Trustee[]> {
  const tokens = lastNameTokenSearchCandidates(dxtrTrustee.lastName);
  if (tokens.length === 0) return [];

  const trusteesRepo = factory.getTrusteesRepository(context);
  const matchesByToken = await Promise.all(
    tokens.map((token) => trusteesRepo.searchTrusteesByNameScored(token)),
  );

  const dedupedById = new Map<string, Trustee>();
  for (const trustee of matchesByToken.flat()) {
    dedupedById.set(trustee.trusteeId, trustee);
  }
  return Array.from(dedupedById.values());
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

  // Third-pass fallback: search by just the first token of DXTR's lastName (see
  // findLastNameTokenMatches). Always surfaced as 'ambiguous', even for a single candidate, so it
  // routes through resolveNameCollisionByScoring's scoring and appointment-match gate rather than
  // being trusted outright.
  const lastNameTokenMatches = await findLastNameTokenMatches(context, dxtrTrustee);

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

/**
 * Tokens shorter than this are dropped before intersecting. Set to 2 (not 1) purely to exclude
 * empty/whitespace-only fragments - unlike a phonetic/bigram search, exact-word containment
 * (searchTrusteesByName's substring match against trustee.name) has no "single initial matches
 * almost everything" problem, so a short token like "mc" still only matches a literal substring.
 */
const TOKEN_INTERSECTION_MIN_TOKEN_LENGTH = 2;

/**
 * Common suffixes/role markers that shouldn't count as a discriminating name token for
 * findTokenIntersectionCandidates. Tuned via
 * test/integration/sync-acms-professional-ids-audit/scripts/token-intersection-exact-word-backtest.ts.
 */
const TOKEN_INTERSECTION_STOPWORDS = new Set([
  'jr',
  'sr',
  'ii',
  'iii',
  'iv',
  'tr',
  'trustee',
  'inc',
  'esq',
  'not',
  'use',
  'do',
]);

/**
 * Splits a fullName into lowercase, deduplicated, punctuation-stripped tokens with role-suffix
 * stopwords and short (<2 char) tokens removed. Exported for reuse by the token-intersection
 * backtest script and its unit tests; not intended as a general-purpose name utility.
 */
export function tokenizeNameForIntersection(fullName: string): string[] {
  const raw = fullName
    .toLowerCase()
    .replace(/[.,()/*]/g, ' ')
    .replace(/[-']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return [...new Set(raw)].filter(
    (t) => t.length >= TOKEN_INTERSECTION_MIN_TOKEN_LENGTH && !TOKEN_INTERSECTION_STOPWORDS.has(t),
  );
}

/**
 * Last-resort candidate-discovery tier for a name whose parts have been reordered (not just
 * abbreviated) relative to how CAMS stores firstName/middleName/lastName - e.g. a lastName with
 * an internal space that changes its token count ("MC LANE" vs "McLane"), a person who goes by
 * their middle name recorded in a different field position ("GEORGE L REDER" vs CAMS
 * firstName=L./middleName=George), or a first name dropped in favor of a middle name with no
 * initial preserved ("C. EUGENE CHAMBERLAIN" vs CAMS firstName=Eugene). calculateNameScore
 * compares first/middle/last positionally, so all three shapes score 0 there regardless of other
 * evidence, and matchTrusteeByName's own tiers never surface a candidate for them either.
 *
 * Approach: tokenize fullName into individually-meaningful tokens (see
 * tokenizeNameForIntersection), search trustees by each token independently via
 * searchTrusteesByName (substring containment, not searchTrusteesByNameScored's phonetic/bigram
 * index - that collides too broadly to narrow anything useful here), and intersect the resulting
 * trusteeId sets. A trustee in the intersection of every token is a stronger, order-independent
 * candidate than a single-token or full-string search can produce.
 *
 * Returns raw, unscored candidates - same contract as findLastNameTokenMatches. The caller is
 * responsible for routing a single candidate through resolveByContactCorroboration and 2+
 * candidates through resolveDuplicateNameCandidates before ever auto-linking.
 *
 * Cost warning: issues one searchTrusteesByName query per token, meaningfully more expensive than
 * any single-query tier in matchTrusteeByName. Callers must treat this as an explicit last
 * resort, invoked only after matchTrusteeByName has returned 'no-match'.
 */
/** Narrows an in-progress token-intersection candidate map down to only the trustees also present in `matches`. */
function intersectCandidatesWithMatches(
  candidateSet: Map<string, Trustee>,
  matches: Trustee[],
): void {
  const matchedTrusteeIds = new Set(matches.map((t) => t.trusteeId));
  for (const trusteeId of candidateSet.keys()) {
    if (!matchedTrusteeIds.has(trusteeId)) candidateSet.delete(trusteeId);
  }
}

/**
 * Queries searchTrusteesByName once per token and intersects the results, short-circuiting once
 * the candidate set is empty (no point querying further tokens - see
 * findTokenIntersectionCandidates for why intersection is the chosen strategy).
 */
async function intersectTrusteesByToken(
  context: ApplicationContext,
  tokens: string[],
): Promise<Trustee[]> {
  const trusteesRepo = factory.getTrusteesRepository(context);

  let candidateSet: Map<string, Trustee> | null = null;
  for (const token of tokens) {
    const matches = await trusteesRepo.searchTrusteesByName(token);

    if (candidateSet === null) {
      candidateSet = new Map(matches.map((t) => [t.trusteeId, t]));
    } else {
      intersectCandidatesWithMatches(candidateSet, matches);
    }

    if (candidateSet.size === 0) break;
  }

  return candidateSet ? [...candidateSet.values()] : [];
}

function logTokenIntersectionCandidates(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
  tokens: string[],
  candidates: Trustee[],
): void {
  if (candidates.length === 0) return;

  const candidateList = candidates.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
  context.logger.info(
    MODULE_NAME,
    `Token-intersection search found ${candidates.length} candidate(s) for ` +
      `"${sourceTrustee.fullName}" (tokens=[${tokens.join(', ')}]): ${candidateList}.`,
  );
}

export async function findTokenIntersectionCandidates(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
): Promise<Trustee[]> {
  const tokens = tokenizeNameForIntersection(sourceTrustee.fullName);
  // Need at least 2 independent tokens for an intersection to narrow anything - a single-token
  // name (e.g. a company name with no discernible person-name shape) can't be searched this way.
  if (tokens.length < 2) return [];

  const candidates = await intersectTrusteesByToken(context, tokens);
  logTokenIntersectionCandidates(context, sourceTrustee, tokens, candidates);

  return candidates;
}

/**
 * Tokens shorter than this are excluded from the FUZZY side of findAnchoredLevenshteinCandidates
 * - a 1-2 character token has too many trustees within ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE to
 * be a useful signal (nearly any short token is within edit distance 2 of nearly any other short
 * token). The ANCHOR side has no length floor, since it must match exactly.
 */
const ANCHORED_LEVENSHTEIN_MIN_FUZZ_TOKEN_LENGTH = 3;

/** Maximum edit distance for the fuzzy side of findAnchoredLevenshteinCandidates. */
const ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE = 2;

/**
 * Standard Levenshtein (single-character insert/delete/substitute) edit distance between two
 * strings. Used only by findAnchoredLevenshteinCandidates - not exposed as a general string
 * utility since no other caller needs it.
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
 * Last-resort candidate-discovery tier for a genuine spelling error (typo, transposition, OCR-
 * style character error) in the first or last name - a different failure shape than
 * findTokenIntersectionCandidates' target (name-part reordering). calculateNameScore's
 * firstLastNameToken-exact-match-required lastName gate, and matchTrusteeByName's own tiers, all
 * fail outright on e.g. "STEPHAN DARR" vs CAMS "Stephen Darr", or "KATHYLN SELLECK" vs CAMS
 * "Kathlyn Selleck" - a single transposed/substituted character anywhere in either name part.
 *
 * Approach: anchor one name part with an exact match, then allow the other part to be a close
 * (edit distance <= 2) match rather than requiring exact equality. Tried in both directions,
 * unioned: (a) lastName exact -> firstName fuzzy, (b) firstName exact -> lastName fuzzy. Anchoring
 * one side exactly first narrows the candidate pool before computing an edit distance - fuzzing
 * lastName alone against the entire trustee population produced far too many noisy candidates in
 * backtesting.
 *
 * Candidate sourcing: queries searchTrusteesByName once per direction using the anchor token
 * (narrows to trustees whose composed name contains that substring - cheap, single query), then
 * filters in-memory over that already-small result set for an exact match on the anchor field and
 * a Levenshtein-close match on the other. This avoids fuzzing against the full trustees collection.
 *
 * Returns raw, unscored candidates - same contract as findTokenIntersectionCandidates. The caller
 * is responsible for routing a single candidate through resolveByContactCorroboration and 2+
 * candidates through resolveDuplicateNameCandidates before ever auto-linking - an anchored-fuzzy
 * hit on a common name is not reliable evidence alone; corroboration is load-bearing here (see
 * tuning backtest at test/integration/sync-acms-professional-ids-audit/scripts/anchored-levenshtein-backtest.ts).
 *
 * Cost warning: issues up to 2 searchTrusteesByName queries (one per anchor direction), on top of
 * whatever matchTrusteeByName/findTokenIntersectionCandidates already tried. Callers must treat
 * this as an explicit last resort, invoked only after both of those have already found nothing -
 * never call this speculatively or in parallel with cheaper tiers.
 */
export async function findAnchoredLevenshteinCandidates(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
): Promise<Trustee[]> {
  const acmsFirst = firstLastNameToken(sourceTrustee.firstName);
  const acmsLast = firstLastNameToken(sourceTrustee.lastName);
  if (!acmsFirst || !acmsLast) return [];

  const trusteesRepo = factory.getTrusteesRepository(context);
  const candidatesById = new Map<string, Trustee>();

  const tryDirection = async (
    anchorToken: string,
    fuzzToken: string,
    anchorField: 'firstName' | 'lastName',
    fuzzField: 'firstName' | 'lastName',
  ): Promise<void> => {
    if (fuzzToken.length < ANCHORED_LEVENSHTEIN_MIN_FUZZ_TOKEN_LENGTH) return;

    const searchResults = await trusteesRepo.searchTrusteesByName(anchorToken);
    for (const trustee of searchResults) {
      const anchorValue = firstLastNameToken(
        anchorField === 'firstName' ? trustee.firstName : trustee.lastName,
      );
      if (anchorValue !== anchorToken) continue;

      const fuzzValue = firstLastNameToken(
        fuzzField === 'firstName' ? trustee.firstName : trustee.lastName,
      );
      if (!fuzzValue || fuzzValue === fuzzToken) continue; // exact match already covered elsewhere

      if (levenshteinDistance(fuzzToken, fuzzValue) <= ANCHORED_LEVENSHTEIN_MAX_EDIT_DISTANCE) {
        candidatesById.set(trustee.trusteeId, trustee);
      }
    }
  };

  await tryDirection(acmsLast, acmsFirst, 'lastName', 'firstName');
  await tryDirection(acmsFirst, acmsLast, 'firstName', 'lastName');

  const candidates = [...candidatesById.values()];

  if (candidates.length > 0) {
    const candidateList = candidates.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    context.logger.info(
      MODULE_NAME,
      `Anchored-Levenshtein search found ${candidates.length} candidate(s) for ` +
        `"${sourceTrustee.fullName}": ${candidateList}.`,
    );
  }

  return candidates;
}
