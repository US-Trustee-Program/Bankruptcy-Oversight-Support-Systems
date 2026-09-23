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
import { usStates } from '@common/cams/us-states';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';
import { generateBigrams } from '../../adapters/utils/phonetic-helper';
import { getNameVariations } from 'name-match/src/name-normalizer';
import * as natural from 'natural';

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
 * captured or compared - parsing stops once the zip is found from the right.
 * Scans right-to-left from the last zip-like token rather than left-to-right for a "ST
 * zipCode" pair: some ACMS records omit the state entirely (e.g. "WOODLAND HILLS
 * 91367-0000"), and a left-to-right scan for the pair treats those as wholly unparseable even
 * though the city and zip are unambiguous. Locating the zip first and checking only the token
 * immediately before it recovers those addresses with state: null, instead of losing the
 * record's city/zip evidence entirely.
 * Symmetrically, some ACMS records omit the city entirely (e.g. "TX 79417-0000") - city: '' is
 * returned rather than discarding the whole parse, so a real state+zip match still corroborates.
 * Returns null only when no zip-like token exists at all, or when neither a city nor a state
 * precedes it - a bare zip alone, with nothing else to anchor it, is too weak to trust.
 */
const STATE_TOKEN = /^[A-Za-z]{2}$/;
const ZIP_TOKEN = /^\d{5}(?:-\d{4})?$/;
const VALID_STATE_CODES = new Set(usStates.map((s) => s.code));

export function parseCityStateZip(cityStateZipCountry?: string): {
  city: string;
  state: string | null;
  zipCode: string;
} | null {
  if (!cityStateZipCountry) return null;

  // Unify comma/whitespace separators. Examples: "New York, NY 10001",
  // "Corinth, MS, 38834, USA", "Corinth MS 38834 USA", "Woodland Hills 91367-0000"
  const tokens = cityStateZipCountry.replaceAll(',', ' ').trim().split(/\s+/);

  let zipIndex = -1;
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (ZIP_TOKEN.test(tokens[i])) {
      zipIndex = i;
      break;
    }
  }
  if (zipIndex === -1) return null;

  // A literal "-0000" +4 suffix is a placeholder, not a real ZIP+4 extension - the vast majority
  // of ACMS addresses carry it, far too common to be genuine +4 data for that many distinct
  // addresses. Stripped here so the persisted evidence graph reports what ACMS actually knows (a
  // plain 5-digit zip), rather than a reviewer reading "-0000" as real +4 precision it never had.
  // Zip-matching itself already truncates to 5 digits (see scoreZipCodeMatch/pipelineAddressScore's
  // own zip5 helpers), so this is a persisted-evidence clarity fix, not a scoring behavior change.
  const zipCode = tokens[zipIndex].replace(/-0000$/, '');
  const precedingToken = tokens[zipIndex - 1];
  // A two-letter token in the state position is excluded from `city` either way (it was never
  // part of the city name in this format), but only trusted as a real state - rather than
  // reported as state: null, the same as if it were absent - when it's an actual USPS state or
  // territory code. A typo'd/invalid code (e.g. "CN" instead of "CT") must not silently become
  // real, wrong evidence that a downstream state comparison then scores as an active disagreement;
  // treating it as absent is honest about what is actually known.
  const isStatePositionToken = precedingToken !== undefined && STATE_TOKEN.test(precedingToken);
  const state =
    isStatePositionToken && VALID_STATE_CODES.has(precedingToken.toUpperCase())
      ? precedingToken
      : null;
  const city = tokens.slice(0, isStatePositionToken ? zipIndex - 1 : zipIndex).join(' ');

  if (!city && !state) return null;
  return { city, state, zipCode };
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
export function padSingleDigitNumericToken(token: string): string {
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
export function calculateNumericTokenScore(
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

  const dxtrCityState = normalizeAddressLine(`${parsed.city} ${parsed.state ?? ''}`);
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
export function normalizeNamePart(namePart?: string): string {
  return (namePart ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Space-separated surname prefix particles that are never a complete surname on their own -
 * CAMS stores these two-word ("Van Meter", "Del Piero", "Mc Lane") rather than joined
 * ("VanMeter"), unlike a hyphenated compound ("Garcia-Miranda") where truncating to the first
 * segment is an accepted trade-off (see firstLastNameToken). Truncating one of these to just the
 * particle collapses genuinely different surnames together - this pattern shows up as, e.g.,
 * "Van Doe" and "Van Roe" both reduced to "van" and treated as the same person, a real false
 * positive this reduction must avoid. Lowercase, no trailing space.
 */
const LAST_NAME_PREFIX_PARTICLES = new Set([
  'van',
  'de',
  'mc',
  'la',
  'le',
  'von',
  'st',
  'del',
  'di',
]);

/**
 * Reduces a raw lastName field to its surname-identifying token(s): drops apostrophes (so
 * "O'Brien" stays one word), replaces remaining punctuation with spaces, collapses whitespace,
 * then returns the first token - or, when that first token is a known surname prefix particle
 * (see LAST_NAME_PREFIX_PARTICLES) and a second token follows, both tokens joined by a single
 * space. Used both for candidate discovery (the first-token-lastName search tier in
 * matchTrusteeByName) and for calculateNameScore's own lastName comparison - taking only the
 * first token (or particle pair) sidesteps needing to enumerate every shape of trailing noise (a
 * role marker, a comma, a generational suffix), since by definition anything after it isn't the
 * real surname. Trade-off: a hyphenated compound surname ("Garcia-Miranda") still reduces to just
 * "garcia" - the downstream scoring/appointment-match gate is responsible for confirming that was
 * enough to identify the right person.
 * Example: "Marshack (TR)" -> "marshack", "Wallo, Trustee" -> "wallo", "Malloy, III" -> "malloy",
 * "O'Brien" -> "obrien", "Van Meter" -> "van meter", "Mc Kay, Sr." -> "mc kay".
 */
export function firstLastNameToken(namePart?: string): string {
  const withoutApostrophes = (namePart ?? '').toLowerCase().replaceAll("'", '');
  const spaced = withoutApostrophes.replace(/[^a-z0-9]+/g, ' ');
  const tokens = spaced.trim().split(' ').filter(Boolean);
  if (tokens.length === 0) return '';
  if (tokens.length > 1 && LAST_NAME_PREFIX_PARTICLES.has(tokens[0])) {
    return `${tokens[0]} ${tokens[1]}`;
  }
  return tokens[0];
}

/**
 * When a firstLastNameToken result is a single word that STARTS WITH a known prefix particle
 * (see LAST_NAME_PREFIX_PARTICLES) with more letters after it, returns the particle-split variant
 * joined by a space (e.g. "mccue" -> "mc cue"). Returns null for anything else - an already
 * multi-word result (firstLastNameToken already split it), a word that doesn't start with a known
 * particle, or a bare particle with nothing following it to split off.
 */
function particleSplitVariant(token: string): string | null {
  if (token.includes(' ')) return null;
  for (const particle of LAST_NAME_PREFIX_PARTICLES) {
    if (token.length > particle.length && token.startsWith(particle)) {
      return `${particle} ${token.slice(particle.length)}`;
    }
  }
  return null;
}

/**
 * Bare administrative/role/business words that are never themselves a real surname candidate -
 * the same class of noise sync-acms-professional-ids.ts's NON_PERSON_ONLY_WORDS names (that
 * file's own list is ACMS-specific and not imported here to keep this DXTR-shared file free of an
 * ACMS dependency; this is a small, deliberately narrower duplicate scoped to exactly the words
 * confirmed to survive lastNameSurnameCandidates' fallback tokens even after the
 * stripParentheticalAnnotations/stripChapterAnnotation/stripTrusteeRoleSuffix/
 * stripSourceSystemArtifacts/normalizeGenerationalSuffix chain runs). Without this exclusion, e.g.
 * "INVOLUNTARY TRUSTEE" contributes "trustee" as a fallback candidate, which then genuinely
 * phonetically matches an unrelated real CAMS trustee whose surname happens to be "Trustee" (an
 * uncommon but real surname); "AMJ ADVISORS LLC" contributes "llc"; "DOE, JR." contributes "jr"
 * even after normalizeGenerationalSuffix (which normalizes formatting, not removes the suffix - see
 * its own doc comment) joins it onto the name.
 */
const SURNAME_CANDIDATE_EXCLUDED_WORDS = new Set([
  'trustee',
  'trustees',
  'trrustee', // confirmed real ACMS misspelling ("NO TRRUSTEE")
  // Business/entity suffixes and titles - same class SOLO_PRACTICE_ENTITY_SUFFIX_PATTERN
  // (sync-acms-professional-ids.ts) already excludes for the mapper's own name-recovery, leaking
  // in here too since that pattern isn't applied to this function's fallback tokens.
  'inc',
  'llc',
  'llp',
  'pc',
  'pllc',
  'corp',
  'company',
  'firm',
  'group',
  'associates',
  'management',
  'adjustment',
  'aggregates',
  'esq',
  'cpa',
  // Generational suffixes - normalizeGenerationalSuffix only normalizes formatting (a comma, a
  // trailing period), it never removes the suffix, so it still needs excluding here.
  'jr',
  'sr',
  'ii',
  'iii',
  'iv',
  // Case/chapter/appointment-status words, and their common ACMS abbreviations.
  'case',
  'apt',
  'assigned',
  'unassigned',
  'active',
  'inactive',
  'interim',
  'petition',
  'poss', // "DEBTOR IN POSS"
  'progress',
  'only',
  'old',
  'trust',
  'ust', // "UST" - United States Trustee's office, not a surname
  'na', // "(NA)" - not applicable
  'se', // "PRO SE"
  'sa', // a stray ACMS suffix token, confirmed alongside "(TR)SA"
  'tr', // "(TR)" - a real ACMS role marker; also survives as a parenthetical candidate
  'sub', // "(SUB TR)" - a sub-trustee role marker, not a surname
  'liq', // "(LIQ TR)" - a liquidating-trustee role marker
  'ch', // "(CH 11)"/"(CH 13)" - chapter marker, confirmed surviving stripChapterAnnotation when
  // the chapter number sits inside its own parenthetical rather than as a trailing " - Ch 11"
  'chapter', // "(CHAPTER 12)" - the unabbreviated form of the same marker
  'sbra', // "(SBRA V)" - subchapter V marker, confirmed surviving as a bare whitespace token
  'sbrav', // "(SBRAV)" - the same marker with no internal space
  'acting', // "(ACTING CH. 13 TRUSTEE)" - a role qualifier, not a surname
  'debtor', // "(DEBTOR IN POSS)" - the case-role word, not a surname
  'opened', // "RE-OPENED (...)" - a case-status word, confirmed surviving as a hyphen segment
  'cla', // a truncated "CLAIM"/"CLASS" fragment confirmed in a garbled ACMS record
  'goesa', // "GOE (TR)SA" - stripParentheticalAnnotations concatenates "GOE"+"SA" with no space
  // between them when there's no space before the malformed source text's closing paren; this
  // one confirmed-garbled record isn't worth a general regex fix for the concatenation itself.
]);

/**
 * Below this length, a fallback token is too short to plausibly be a real surname on its own -
 * stray single-letter tokens like "d" ("DOE (D)"), "r" ("ROE*R"), and chapter-number tokens like
 * "7"/"11"/"12"/"13" all survive the strip chain below (a bracketed
 * suffix a strip function doesn't specifically recognize, or a bare digit that was never inside
 * parentheses at all) and would otherwise become bogus fallback candidates. Same numeric bar as
 * TOKEN_INTERSECTION_MIN_TOKEN_LENGTH, kept as its own named constant since it governs a
 * different function's fallback tokens and the two are free to diverge if evidence ever calls
 * for it.
 */
const SURNAME_CANDIDATE_MIN_TOKEN_LENGTH = 2;

/**
 * Every plausible surname token for a RAW (not yet firstLastNameToken-reduced) lastName field,
 * for lastNameTokensMatch's cross-product comparison - not just firstLastNameToken's single
 * first-token/particle-pair choice. firstLastNameToken's "the surname is always the FIRST token"
 * assumption fails for two real, distinct shapes:
 *   1. A prepended maiden/second surname puts the real family surname LAST, not first - e.g. ACMS
 *      "DE LA CRUZ SANTOS" (real surname "Santos") vs CAMS "Santos": firstLastNameToken treats "de"
 *      as a prefix particle and returns "de la", never considering "santos" (the actual last
 *      token) as a candidate at all.
 *   2. A hyphenated compound surname carries a maiden/married or two-family name inconsistently
 *      across systems ("Doe-Roe" in ACMS vs just "Roe" in CAMS) - the same shape
 *      lastNameTokenSearchCandidates already discovers by candidates for, but that function's
 *      candidates were never exposed to the COMPARISON side (lastNameTokensMatch) at all, only to
 *      searchTrusteesByNameScored's discovery query.
 *
 * A parenthetical is deliberately NOT assumed to always be a role/chapter/status code ("(TR)",
 * "(SBRA V)", "(11)") - a real ACMS record with a parenthetical like "(JONES)" can genuinely
 * resolve to a CAMS trustee under that name, so the parenthetical could just as easily carry an
 * alias/maiden surname instead. Its content is offered as its OWN candidate (case 0, filtered the
 * same as every other fallback below) rather than assumed either way - a real code is excluded by
 * the same SURNAME_CANDIDATE_EXCLUDED_WORDS/MIN_TOKEN_LENGTH filter every other candidate goes
 * through, while a real name-shaped parenthetical survives.
 *
 * Also runs the same stripParentheticalAnnotations/stripTrusteeRoleSuffix/stripChapterAnnotation/
 * stripSourceSystemArtifacts/normalizeGenerationalSuffix chain normalizeNameForMatching already
 * uses BEFORE tokenizing the remaining cases - without it, a bracketed role/chapter marker
 * survives this function's own bare punctuation-stripping as a bogus bare-word fallback candidate
 * (e.g. a name like "DOE (TR)" produces "tr" as an alternate, which then genuinely phonetically
 * matches unrelated real CAMS trustees). Returns firstLastNameToken's own result on the ORIGINAL
 * (unstripped) input FIRST (so the common case - and its particle-pair handling - is unaffected by
 * this stripping, and is never itself excluded even if it happens to be a
 * SURNAME_CANDIDATE_EXCLUDED_WORDS word or too short - that exclusion/length guard only applies to
 * the fallbacks), then the parenthetical content (case 0), the LAST whitespace-separated token of
 * the STRIPPED input (case 1), and the last hyphen segment's firstLastNameToken (case 2, matching
 * lastNameTokenSearchCandidates' existing logic) - all deduped and filtered against
 * SURNAME_CANDIDATE_EXCLUDED_WORDS/SURNAME_CANDIDATE_MIN_TOKEN_LENGTH.
 */
export function lastNameSurnameCandidates(namePart?: string): string[] {
  const primary = firstLastNameToken(namePart);
  if (!primary) return [];

  const candidates = [primary];

  // A real surname never contains a digit - bare chapter-number tokens ("11", "12", "13") clear
  // SURNAME_CANDIDATE_MIN_TOKEN_LENGTH on their own (2-3 characters) and would otherwise survive
  // as bogus fallback candidates.
  const isPlausibleFallback = (token: string | undefined): token is string =>
    !!token &&
    token.length >= SURNAME_CANDIDATE_MIN_TOKEN_LENGTH &&
    !/\d/.test(token) &&
    !candidates.includes(token) &&
    !SURNAME_CANDIDATE_EXCLUDED_WORDS.has(token);

  // A parenthetical isn't always a role/status code ("(TR)", "(SBRA V)", "(11)") - a real ACMS
  // record's lastName parenthetical can just as easily carry an alias/maiden surname (or, in one
  // real case, a city name that happened to land in the same position and looks name-shaped) -
  // treat parenthetical content as a CANDIDATE surname alternate in its own right (filtered the
  // same as any other fallback), not just discarded text. Extracted before
  // stripParentheticalAnnotations deletes it below, so both the "it's a name" and "it's a code"
  // possibilities get a fair hearing - a real code (single short word, or one already in
  // SURNAME_CANDIDATE_EXCLUDED_WORDS) is filtered out by the same isPlausibleFallback check every
  // other candidate goes through, while a real name-shaped parenthetical survives as an alternate.
  const parentheticalMatch = /\(([^)]+)\)/.exec(namePart ?? '');
  if (parentheticalMatch) {
    const parentheticalToken = firstLastNameToken(parentheticalMatch[1]);
    if (isPlausibleFallback(parentheticalToken)) {
      candidates.push(parentheticalToken);
    }
  }

  const stripped = normalizeGenerationalSuffix(
    stripSourceSystemArtifacts(
      stripChapterAnnotation(stripTrusteeRoleSuffix(stripParentheticalAnnotations(namePart ?? ''))),
    ),
  );
  const withoutApostrophes = stripped.toLowerCase().replaceAll("'", '');
  const whitespaceTokens = withoutApostrophes
    .replace(/[^a-z0-9-]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
  const lastToken = whitespaceTokens.at(-1);
  if (isPlausibleFallback(lastToken)) {
    candidates.push(lastToken);
  }

  const hyphenSegments = stripped.split('-');
  if (hyphenSegments.length > 1) {
    const lastSegmentToken = firstLastNameToken(hyphenSegments.at(-1));
    if (isPlausibleFallback(lastSegmentToken)) {
      candidates.push(lastSegmentToken);
    }
  }

  return candidates;
}

/**
 * Compares two firstLastNameToken results for a genuine surname match, tolerating a source
 * system's choice to CONCATENATE a prefix particle onto the rest of the surname instead of
 * space-separating it (see particleSplitVariant) - e.g. ACMS "JORDAN MC CUE" (space-separated,
 * firstLastNameToken already returns "mc cue") vs CAMS "Jordan McCue" (concatenated,
 * firstLastNameToken returns "mccue"): a plain string-equality lastName gate scores this a
 * mismatch even though it's the same surname written two different ways.
 *
 * Deliberately does NOT force firstLastNameToken itself to always split on a particle-looking
 * prefix - "Mack", "Devine", "Vance", "Stone" are ordinary single-word surnames that happen to
 * start with the same letters as a known particle, and there is no way to tell from a
 * concatenated word alone whether it's "particle + surname" or just a word - splitting them would
 * manufacture false matches (e.g. "Mack" turning into "mc ack" and colliding with an unrelated
 * "Mc Ack"). Comparing both the as-is token AND its particle-split variant (when one exists)
 * sidesteps that ambiguity: a genuine McCue/Mc Cue pair matches on the split form without "Mack"
 * ever needing to be force-split into a false particle pair in the first place.
 *
 * dxtrLast/camsLast are expected to already be firstLastNameToken results (this function's two
 * historical callers both pass that), so the particle-split check above still runs first and
 * unchanged. lastNameSurnameCandidates' RAW-field fallback tokens are checked only afterward, and
 * only when the caller supplies the corresponding raw field (sourceRawLastName/
 * candidateRawLastName) - both optional so every existing call site keeps working unchanged.
 *
 * The fallback additionally requires ONE side to be a bare, single-token surname (exactly one
 * candidate token - no prepended/hyphenated compound of its own) before trusting a shared token
 * against the OTHER side's compound - without this requirement, two DIFFERENT people whose
 * compound surnames merely happen to share one token (e.g. "Smith Jones" vs "Jones Wilson") would
 * incorrectly match, since "Jones" appears as a fallback candidate on both sides despite neither
 * actually being surnamed bare "Jones". Every real recovered case (a prepended maiden name, a
 * hyphenated compound) has the true single-family surname on at least one side as a bare token -
 * CAMS "Santos" (not "Cruz Santos"), CAMS "Roe" (not "Doe-Roe") - so this restriction costs
 * nothing on the real population while closing the two-different-families false-positive gap.
 */
export function lastNameTokensMatch(
  dxtrLast: string,
  camsLast: string,
  sourceRawLastName?: string,
  candidateRawLastName?: string,
): boolean {
  if (!dxtrLast || !camsLast) return false;
  if (dxtrLast === camsLast) return true;

  const dxtrSplit = particleSplitVariant(dxtrLast);
  if (dxtrSplit === camsLast) return true;

  const camsSplit = particleSplitVariant(camsLast);
  if (camsSplit === dxtrLast) return true;

  if (sourceRawLastName === undefined && candidateRawLastName === undefined) return false;

  const sourceCandidates = lastNameSurnameCandidates(sourceRawLastName);
  const candidateCandidates = lastNameSurnameCandidates(candidateRawLastName);
  const eitherSideIsBareSingleToken =
    sourceCandidates.length === 1 || candidateCandidates.length === 1;
  if (!eitherSideIsBareSingleToken) return false;

  return sourceCandidates.some((token) => candidateCandidates.includes(token));
}

const isInitialOf = (initial: string, full: string): boolean =>
  initial.length === 1 && full.length > 0 && full.startsWith(initial);

/**
 * Whether a and b are a known nickname/formal-name pair (e.g. "jim"/"james", "liz"/"elizabeth"),
 * via getNameVariations (name-match library - already a production dependency, used by
 * phonetic-helper.ts's candidate-discovery search) rather than a new, separately-maintained
 * nickname list. getNameVariations is directional in its underlying dictionary but is queried
 * from both sides here, since a caller may pass either the nickname or the formal name first.
 * Swallows lookup errors the same way phonetic-helper.ts does - an unrecognized name is simply
 * not a nickname match, not a hard failure.
 */
export function isKnownNicknamePair(a: string, b: string): boolean {
  if (!a || !b) return false;
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

/**
 * Below this JaroWinklerDistance, two first names are not considered plausibly the same name for
 * scoreFirstNamePart's purposes. Every genuine nickname/spelling-variant pair found in a real
 * ambiguous-record population (e.g. a short form that is a true prefix of its formal name, or a
 * one-letter spelling variant) scored >= 0.86, while every surname-coincidence false positive in
 * the same population (unrelated first names that happened to share a candidate pool) scored
 * <= 0.55 - a wide, clean margin at this threshold. Distance
 * only, no phonetic (SoundEx/Metaphone) check - unlike isFuzzyNamePartMatch in
 * trustee-match-pipeline-stages.ts, scoreFirstNamePart's result feeds calculateNameScore with no
 * corroboration gate of its own, so it deliberately excludes phonetic matching's known false-
 * positive risk (see isFuzzyNamePartMatch's own doc comment).
 */
const FIRST_NAME_NICKNAME_JARO_WINKLER_THRESHOLD = 0.8;

function isPlausibleNicknameByDistance(a: string, b: string): boolean {
  return natural.JaroWinklerDistance(a, b) >= FIRST_NAME_NICKNAME_JARO_WINKLER_THRESHOLD;
}

/**
 * Scores how well two already-normalized firstName values compare. Unlike scoreMiddleNamePart, a
 * firstName is expected to always be present and a genuine mismatch is strong evidence of
 * different people, so missing or mismatched both score 0. Three relaxations, all scoring the same
 * 85 credit scoreMiddleNamePart gives an initial-vs-full relationship, since none is a certain
 * match the way exact equality is: an initial-vs-full relationship (e.g. DXTR "G." vs CAMS
 * "George"), a known nickname/formal-name pair (see isKnownNicknamePair), or a name pair close
 * enough by JaroWinkler distance (see isPlausibleNicknameByDistance) to catch nickname/spelling
 * variants the nickname library doesn't recognize.
 */
export function scoreFirstNamePart(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (isInitialOf(a, b) || isInitialOf(b, a)) return 85;
  if (isKnownNicknamePair(a, b)) return 85;
  if (isPlausibleNicknameByDistance(a, b)) return 85;
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
 *     character: 100 (an initial-vs-full relationship IS a genuine match, not merely plausible -
 *     promoted from 85 against a real DXTR trustee-variation population: records already correctly
 *     clearing this exact gate at 85 have zero genuine mismatches among them, confirming the
 *     gate's discrimination - requiring the initial to actually match the other side's leading
 *     character - already does the real work; scoring it as a genuine match rather than a
 *     merely-plausible one costs nothing. Deliberately did NOT relax this further to "any
 *     bare-initial mismatch is neutral" (a broader rule considered and rejected against that same
 *     population): this pattern shows up as, e.g., an ACMS "Jordan Marlowe Doe" vs. CAMS
 *     "Jordan T. Doe", where DXTR's full middle name "Marlowe" genuinely conflicts with CAMS's bare
 *     initial "T" - that broader rule would have laundered a real 15-point mismatch into a neutral
 *     100.
 *   - Both present and genuinely differ: 15 (moderate conflict penalty)
 */
export function scoreMiddleNamePart(a: string, b: string): number {
  if (!a || !b) return 100;
  if (a === b) return 100;
  if (isInitialOf(a, b) || isInitialOf(b, a)) return 100;
  return 15;
}

/**
 * Minimum score scoreFirstNamePart must reach for the swapped pairing (dxtr first vs cams
 * middle, dxtr middle vs cams first) to be trusted as a genuine first/middle swap rather than
 * coincidental overlap. Both crossed comparisons must clear this - a person who goes by their
 * middle name has it recorded first on one side and second on the other, so a real swap agrees
 * in BOTH directions (not just one), unlike a same-first-name coincidence between two different
 * people who happen to share a common first name.
 */
const NAME_SWAP_MIN_PART_SCORE = 85;

/**
 * Detects a first/middle name swap: a trustee who goes by their middle name may have it recorded
 * first on one side (e.g. CAMS "M. Douglas Flahaut") while the other side keeps the legal
 * first/middle order (ACMS PROF_FIRST_NAME "Douglas", PROF_MI "M"). Positional-only comparison
 * (scoreFirstNamePart alone) sees this as two unrelated first names. Requires BOTH crossed pairs
 * (dxtr first vs cams middle, dxtr middle vs cams first) to independently clear
 * NAME_SWAP_MIN_PART_SCORE, so a real swap - not a coincidental partial overlap - is what's being
 * credited. Capped at 85 (never 100) since a swap is still a real discrepancy in field placement,
 * the same treatment an initial-vs-full relationship gets in scoreFirstNamePart/scoreMiddleNamePart.
 */
export function isFirstMiddleSwap(
  dxtrFirst: string,
  dxtrMiddle: string,
  camsFirst: string,
  camsMiddle: string,
): boolean {
  if (!dxtrMiddle || !camsMiddle) return false;
  const crossedFirst = scoreFirstNamePart(dxtrFirst, camsMiddle);
  const crossedMiddle = scoreFirstNamePart(dxtrMiddle, camsFirst);
  return crossedFirst >= NAME_SWAP_MIN_PART_SCORE && crossedMiddle >= NAME_SWAP_MIN_PART_SCORE;
}

/**
 * Requires an EXACT match OR a genuine nickname/formal-name pair (isKnownNicknamePair) OR a
 * close-by-distance spelling variant (isPlausibleNicknameByDistance) on the crossed pair used by
 * isOneSidedMiddleNameMatch - deliberately NOT isInitialOf, unlike scoreFirstNamePart's other two
 * callers. A bare-initial relationship is exactly the collision this check must still refuse (see
 * isOneSidedMiddleNameMatch's own doc comment on the real "JORDAN VOSSEY" vs "Aldric J. Vossey"
 * regression that motivated excluding it) - JaroWinklerDistance against a 1-character string and
 * a real nickname-dictionary lookup both already require far more character overlap than a bare
 * initial has, so neither relaxation reopens that risk; they only add tolerance for a genuine
 * nickname pair (e.g. "Steve"/"Stephen") that an exact-string check alone would miss.
 */
function isOneSidedCrossedNamePartMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  return isKnownNicknamePair(a, b) || isPlausibleNicknameByDistance(a, b);
}

/**
 * Detects a ONE-SIDED first/middle match: unlike isFirstMiddleSwap (both sides have SOME middle
 * name, just in the "wrong" field), this covers a trustee who goes by their middle name where one
 * source never recorded a middle name at all - ACMS "Marlowe Vossey" (PROF_MI genuinely empty, not
 * just omitted from this comparison) vs CAMS "T. Marlowe Vossey" (firstName="T.", middleName=
 * "Marlowe"). The crossed pair is compared via isOneSidedCrossedNamePartMatch (exact, nickname, or
 * close-distance - never a bare initial - see that function's own doc comment for why): unlike
 * isFirstMiddleSwap, there is no second, independent direction to cross-check an initial against
 * here (the "empty" side's middle slot has nothing in it to compare against), so a bare initial
 * relationship alone is still too weak and too collision-prone to credit. Confirmed via a real
 * backtest regression: allowing initial-vs-full here credited ACMS "JORDAN VOSSEY" (no middle
 * name) against the UNRELATED "Aldric J. Vossey" (only "J." vs "Jordan"), producing a second
 * qualifying candidate alongside the correct "Jordan T. Vossey" and turning a clean
 * single-candidate resolution into a false ambiguity. A genuine nickname pair (e.g. ACMS
 * " STEVE MILLER" vs CAMS "P. Stephen Miller", where "Steve"/"Stephen" being crossed into the
 * wrong field entirely blocked a real match) is a different, much narrower relationship than a
 * bare initial, so it is credited here. Only fires when EXACTLY ONE side has a middle name - if
 * both do, isFirstMiddleSwap's stricter bidirectional check is the correct gate (see
 * calculateNameScore), since two populated middle slots that disagree IS real evidence.
 */
export function isOneSidedMiddleNameMatch(
  dxtrFirst: string,
  dxtrMiddle: string,
  camsFirst: string,
  camsMiddle: string,
): boolean {
  if (dxtrMiddle && camsMiddle) return false; // both populated - isFirstMiddleSwap's job
  if (!dxtrMiddle && camsMiddle) return isOneSidedCrossedNamePartMatch(dxtrFirst, camsMiddle);
  if (dxtrMiddle && !camsMiddle) return isOneSidedCrossedNamePartMatch(dxtrMiddle, camsFirst);
  return false;
}

/**
 * Calculates a name match score between DXTR and CAMS trustee parties.
 * Scoring:
 * - Last name must match on its first token (see firstLastNameToken), tolerating a concatenated
 *   vs space-separated prefix particle on either side (see lastNameTokensMatch - e.g. "McCue" vs
 *   "Mc Cue"), or the score is 0 - no further relaxation on lastName, since it is the one part of
 *   the name most likely to distinguish two genuinely different people.
 * - First name must also match, or relax to an initial-vs-full relationship (see
 *   scoreFirstNamePart) - a genuine first-name mismatch is still disqualifying (score 0), UNLESS
 *   it's a first/middle swap (see isFirstMiddleSwap, both sides have a middle name) or a
 *   one-sided middle-name match (see isOneSidedMiddleNameMatch, only one side does), either of
 *   which scores 85.
 * - When last and first both clear their bar, a middle-name sub-score (see scoreMiddleNamePart)
 *   determines the final result - the lower of the first/middle sub-scores wins, so a genuine
 *   first-name initial-vs-full relationship (85) still caps the overall result even when middle
 *   names fully agree; an initial-vs-full relationship on the MIDDLE name alone does not cap
 *   anything (scoreMiddleNamePart scores that case 100, a genuine match - see its own doc comment).
 */
export function calculateNameScore(dxtrTrustee: DxtrTrusteeParty, camsTrustee: Trustee): number {
  const dxtrLast = firstLastNameToken(dxtrTrustee.lastName);
  const camsLast = firstLastNameToken(camsTrustee.lastName);

  if (!lastNameTokensMatch(dxtrLast, camsLast)) {
    return 0;
  }

  const dxtrFirst = normalizeNamePart(dxtrTrustee.firstName);
  const camsFirst = normalizeNamePart(camsTrustee.firstName);
  const dxtrMiddle = normalizeNamePart(dxtrTrustee.middleName);
  const camsMiddle = normalizeNamePart(camsTrustee.middleName);

  const firstScore = scoreFirstNamePart(dxtrFirst, camsFirst);
  if (firstScore === 0) {
    if (isFirstMiddleSwap(dxtrFirst, dxtrMiddle, camsFirst, camsMiddle)) return 85;
    if (isOneSidedMiddleNameMatch(dxtrFirst, dxtrMiddle, camsFirst, camsMiddle)) return 85;
    return 0;
  }

  const middleScore = scoreMiddleNamePart(dxtrMiddle, camsMiddle);

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

// Defined in common/src/cams/dataflow-events.ts so dev-tools' seed-data validator can import the
// exact same function instead of duplicating its weights. Re-exported here so existing consumers
// of this module don't need to change their import path.
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
 * Calculates a comprehensive candidate score for a trustee, orchestrating address, phone, email,
 * district/division, and chapter scoring into a weighted total against an already-known
 * nameScore (see calculateTotalScore for the weights). Logs the scoring breakdown at info level.
 *
 * Takes nameScore as an input rather than computing it internally via calculateNameScore, since
 * every caller already knows it by the time it has a single camsTrustee to score: either it
 * scored discrete firstName/lastName fields itself (resolveNameCollisionByScoring - see
 * calculateNameScore), or it already knows how this trusteeId was resolved (applyMatchOutcome's
 * ImperfectMatch/PerfectMatchInactiveStatus paths, via a fingerprint hit or matchTrusteeByName's
 * exact/fuzzy tiers) and re-deriving it here via calculateNameScore's discrete-field comparison
 * would risk a WRONG answer when a CAMS trustee's own name fields carry data-quality issues (e.g.
 * a generational suffix baked into lastName, "Eggmann, III", that DXTR's clean "Eggmann" never
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
 * alongside it, e.g. appointments) in parallel - "load a candidate, and if it fails for a
 * non-transient reason carry the failure forward instead of throwing." A transient infrastructure
 * error (Cosmos RU throttling, a read/write timeout) is not evidence a candidate is unscorable —
 * it means the caller doesn't yet know, so it rethrows to abort the whole resolution attempt
 * rather than silently continuing with a smaller candidate set that could misclassify a transient
 * failure as a permanent outcome. Uses the shared isTransientInfraError
 * (../../common-errors/transient-infra-error.ts) rather than
 * sync-trustee-case-appointments.ts's own check, since that module imports this one and importing
 * back would be circular.
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
        if (isTransientInfraError(error)) {
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
 * Minimum nameScore (see calculateNameScore) for a candidate to qualify as name-corroborated in
 * the ACMS pipeline's contact-corroboration stage (trustee-match-pipeline-stages.ts). Below this,
 * a name difference is too weak a starting point for contact-field corroboration to rescue,
 * regardless of how well address/phone/email line up. Tuned via
 * test/integration/sync-acms-professional-ids-audit/scripts/auto-link-threshold-backtest.ts.
 */
export const CONTACT_CORROBORATION_NAME_THRESHOLD = 85;

/**
 * Minimum addressScore for address alone to count as strong corroboration in the ACMS pipeline's
 * contact-corroboration stage. Phone/email instead use their scale's max (100, an exact match)
 * since both are short, structured values where a partial match isn't meaningfully distinguishable
 * from coincidence the way a fuzzy address bigram score is.
 */
export const CONTACT_CORROBORATION_ADDRESS_THRESHOLD = 80;

/**
 * ACMS's sentinel for "no real value recorded" on the legacy phone/fax/email fields is the STRING
 * "0", not an empty string - a raw truthiness check (!value) never catches it, since a non-empty
 * string is always truthy in JS. This exact gap let an earlier no-contradiction fallback silently
 * pass for a record with phone:'0', treating "no phone" as "has a phone" and letting a name-only,
 * zero-corroboration auto-link through (a real example: 4 same-surname candidates, resolved to
 * one purely by exact first+last name equality).
 */
export function isBlankAcmsValue(value: string | undefined): boolean {
  return !value || value === '0';
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
export type NameMatchQuality = 'exact' | 'fuzzy';

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
 * Below this JaroWinklerDistance, two lastName tokens are not considered a plausible match for
 * findLastNameTokenMatches' discovery filter - see that function's own doc comment for why a
 * distance floor is needed here at all (searchTrusteesByNameScored's bare matchScore > 0 floor is
 * too permissive for a single-word query). Same numeric bar as
 * FIRST_NAME_NICKNAME_JARO_WINKLER_THRESHOLD, kept as its own named constant since it governs a
 * different field (lastName, not firstName) and the two are free to diverge if evidence ever
 * calls for it.
 */
const LAST_NAME_TOKEN_DISCOVERY_JARO_WINKLER_THRESHOLD = 0.8;

/**
 * Searches CAMS trustees by lastName-token candidates (see lastNameTokenSearchCandidates) derived
 * from the DXTR trustee's lastName. Does not narrow results by court appointment -
 * district/division evidence is left to the caller's resolveNameCollisionByScoring, which scores
 * it (0/50/100, see calculateDistrictDivisionScore) rather than gating candidate discovery on it.
 * Does narrow by lastName similarity: searchTrusteesByNameScored's only floor is a phonetic
 * matchScore > 0 against the WHOLE trustees collection, which a bare single-word query can clear
 * on weak metaphone/bigram overlap with a completely unrelated surname (this shape shows up as,
 * e.g., "Zeplin" surfacing "Zubkin" as its sole candidate, with zero corroborating
 * address/phone/city/zip evidence). Requiring the candidate's own lastName token to be
 * JaroWinkler-close
 * to the searched token (see LAST_NAME_TOKEN_DISCOVERY_JARO_WINKLER_THRESHOLD) keeps a genuine
 * near-miss (a transposition, a dropped letter) while dropping candidates that only share a
 * phonetic code coincidentally. Returns deduped-by-trusteeId candidates; the caller's
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
    tokens.map(async (token) => {
      const matches = await trusteesRepo.searchTrusteesByNameScored(token);
      return matches.filter((trustee) => {
        const candidateToken = firstLastNameToken(trustee.lastName);
        return (
          !!candidateToken &&
          natural.JaroWinklerDistance(token, candidateToken) >=
            LAST_NAME_TOKEN_DISCOVERY_JARO_WINKLER_THRESHOLD
        );
      });
    }),
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

  // Third-pass fallback: search by DXTR's lastName-token candidates - the first token, plus the
  // first token of the last hyphen segment for a compound surname (see
  // lastNameTokenSearchCandidates/findLastNameTokenMatches). Always surfaced as 'ambiguous', even
  // for a single candidate, so it routes through resolveNameCollisionByScoring's scoring and
  // appointment-match gate rather than being trusted outright.
  const lastNameTokenMatches = await findLastNameTokenMatches(context, dxtrTrustee);

  if (lastNameTokenMatches.length > 0) {
    const candidates = lastNameTokenMatches
      .map((t: Trustee) => `${t.trusteeId} ("${t.name}")`)
      .join(', ');
    context.logger.info(
      MODULE_NAME,
      `CAMS trustee(s) found matching "${normalized}" by lastName-token search: ${candidates}.`,
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
 * tokenizeNameForIntersection. Tuned via
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
 * Minimum calculateNameScore a state-mismatched candidate needs to survive this filter anyway -
 * the same "initial/nickname/swap" ceiling calculateNameScore itself uses throughout (see
 * NAME_SWAP_MIN_PART_SCORE), reused here rather than inventing a new threshold.
 *
 * Equal to CONTACT_CORROBORATION_NAME_THRESHOLD by construction: scoreStateNotConflicting and
 * scoreNameMatch both call pipelineNameScore with identical arguments, so
 * isStateNotConflicting?.pass === false strictly implies doesNameMatch?.pass === false - this is
 * why the resolvers that gate on doesNameMatch don't ALSO need an explicit state check; the check
 * would be redundant there. Changing either constant independently breaks that implication and
 * opens a gap in any stage that gates on doesNameMatch.value === 0 without its own state check.
 */
export const STATE_OVERRIDE_MIN_NAME_SCORE = 85;
