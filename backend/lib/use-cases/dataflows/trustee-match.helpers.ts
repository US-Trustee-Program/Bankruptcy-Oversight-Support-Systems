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
import { generateBigrams } from '../../adapters/utils/phonetic-helper';

const MODULE_NAME = 'TRUSTEE-MATCH';

/**
 * Minimum totalScore for a multi-candidate fuzzy-match winner to be considered. Set to 74 so a
 * genuine last-name mismatch (nameScore=0, everything else perfect) - the "wrong person, right
 * everything-else" scenario - lands exactly at the threshold and is correctly excluded, while a
 * genuine name+appointment match with contact evidence actively wrong still clears it.
 */
const FUZZY_MATCH_SCORE_THRESHOLD = 74;

/**
 * Minimum point gap a multi-candidate winner must have over the runner-up. Set to the smallest
 * full single-dimension swing under the current WEIGHTS (address/phone/email each at 8%), so a
 * genuine disagreement on any one of those dimensions alone is always enough to break a tie.
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
 * Computes Jaccard similarity (intersection over union) between two bigram sets, scaled to
 * 0-100. Duplicate bigrams within either input are deduplicated before comparison (Jaccard
 * operates on sets, not multisets) - repeating a bigram doesn't make it more "present." Returns 0
 * when either set is empty, including when both are empty - two blank inputs have no positive
 * evidence of similarity to report, so this is distinct from Jaccard's mathematically-undefined
 * 0/0 case, which this function never actually reaches.
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
 * encountered in trustee office addresses (DXTR and CAMS). Scoped to what's plausible for a law
 * office/professional address, not the full USPS Publication 28 standard - expanding an
 * abbreviation to its full word form before bigramming means "St" and "Street" (or "Ste" and
 * "Suite") share bigrams instead of scoring as unrelated tokens, which is the whole point of
 * normalizing before Jaccard comparison. Keys are matched as whole tokens only (see
 * normalizeAddressLine), so this never mis-expands an abbreviation embedded inside a longer word.
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
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
};

/** Unit designators (post-expansion) that already convey the same thing a bare "#" marker does. */
const UNIT_DESIGNATOR_WORDS = new Set(['suite', 'apartment', 'floor', 'unit', 'room']);

/**
 * Pads a single-digit all-digit token with a leading "0" so it reaches generateBigrams's
 * minimum token length of 2 (that function drops any token shorter than 2 characters - tuned for
 * name-initial noise, not address tokens). Without this, a single-digit house number or unit
 * number (the single most common way two different offices in the same building differ) is
 * silently invisible to bigram comparison: "Suite 4" and "Suite 5" both reduce to zero-length
 * numeric tokens and produce byte-identical bigram sets, so jaccardSimilarity would return 100
 * for two different suites. The filler must be a digit or letter, not punctuation -
 * generateBigrams's own normalizeText strips any character outside [a-z0-9\s] before bigramming,
 * so a punctuation filler would be silently deleted and defeat the padding entirely. "0" doubles
 * as a genuine leading-zero pad ("4" and "04" are the same number - see
 * calculateNumericTokenScore's matching use of stripLeadingZeros, the same equivalence
 * normalizeChapter already applies to chapter numbers elsewhere in this file), so a DXTR/CAMS
 * pair that both happen to write out the same number with/without a leading zero are correctly
 * still an exact match, not a coincidental near-miss. Any numeric token already 2+ characters
 * (e.g. "10", "100") already clears generateBigrams's length floor on its own and is left
 * untouched - padding it too would just waste a bigram on the filler character without adding
 * any distinguishing information.
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
 * Extracts all-digit tokens (house number, suite/unit number, or any other bare number) from an
 * already-normalized address line, leading-zero-stripped (see stripLeadingZeros) and returned as
 * an unordered set - a house number and a suite number can appear in either order across
 * DXTR/CAMS data entry, so position isn't meaningful, only which numbers are present.
 */
function extractNumericTokens(normalizedLine: string): string[] {
  return normalizedLine
    .split(' ')
    .filter((token) => /^\d+$/.test(token))
    .map(stripLeadingZeros);
}

/**
 * Scores how well two address lines' numeric tokens (house/suite/unit numbers) agree, as the
 * fraction of the larger side's numeric tokens that the smaller side also contains exactly.
 * Returns null when NEITHER side has any numeric token at all - there's nothing to compare, and a
 * null here signals the caller to fall back to bigram similarity alone rather than being treated
 * as a perfect (or zero) match. A numeric token present on only one side scores a real partial
 * penalty rather than being ignored, since a missing unit number is exactly the kind of gap that
 * should lower confidence, not be invisible to it.
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
 * comparison: lowercases, strips punctuation (periods, commas), expands common USPS
 * street-suffix/unit/directional abbreviations (see ADDRESS_ABBREVIATIONS) token-by-token,
 * resolves a bare "#" unit marker (see below), and collapses whitespace. Returns an empty string
 * for undefined/blank input - there is nothing to bigram, and jaccardSimilarity already treats an
 * empty bigram set as 0 similarity rather than this function needing to special-case it.
 *
 * "#" is handled separately from the simple abbreviation map: expanding it to "suite"
 * unconditionally would double up when the line already spells out a unit designator ("Suite #4"
 * would otherwise become "suite suite 4"). Instead, a "#" is dropped when the immediately
 * preceding token already expanded to a unit designator (see UNIT_DESIGNATOR_WORDS), and
 * expanded to "suite" only when it stands alone as the unit marker ("123 Main St #4").
 *
 * Example: "123 Main St., Suite #4" -> "123 main street suite 4".
 * Example: "123 Main St. #4" -> "123 main street suite 4".
 */
export function normalizeAddressLine(line?: string): string {
  if (!line) return '';

  const withoutPunctuation = line
    .toLowerCase()
    .replace(/#/g, ' # ')
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
      const previous = resolved[resolved.length - 1];
      if (!UNIT_DESIGNATOR_WORDS.has(previous)) resolved.push('suite');
      continue;
    }
    resolved.push(token);
  }

  return resolved.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Calculates address match score between DXTR and CAMS addresses as a weighted blend of three
 * independently-scored components, rather than a single discrete tier keyed off which fields
 * happen to match exactly:
 * - Address lines (50%): a blend of bigram similarity AND exact numeric-token agreement over
 *   address1+address2+address3 (all non-empty lines concatenated per side, normalized via
 *   normalizeAddressLine) - the most distinguishing signal, since two genuinely different offices
 *   rarely share a street address even when they share a city or ZIP. Bigram similarity alone is
 *   NOT sufficient here: generateBigrams drops any token shorter than 2 characters (tuned for
 *   name-initial noise), which makes a single-digit house/suite number invisible to comparison -
 *   "Suite 4" and "Suite 5" would otherwise reduce to identical bigram sets and score a perfect
 *   match despite being two different offices in the same building, exactly the scenario this
 *   component exists to catch. See calculateNumericTokenScore's doc comment for how numeric
 *   tokens are scored and blended in alongside the bigram score.
 * - ZIP (30%): exact match on the base 5-digit ZIP only - a ZIP+4 extension present on one side
 *   (or a differing extension on both) does not contradict an otherwise-matching base ZIP, since
 *   DXTR's cityStateZipCountry is inconsistent about carrying the +4 suffix at all. Deliberately
 *   NOT fuzzy-matched (unlike the other two components): a ZIP is a short, structured code where a
 *   single-digit difference means a genuinely different location, not a data-entry variant to
 *   tolerate.
 * - City+State (20%): Jaccard/bigram similarity of city+state concatenated per side - the weakest
 *   signal of the three, since many genuinely different offices share a city and state.
 * Returns 0 immediately if DXTR's cityStateZipCountry can't be parsed at all (parseCityStateZip
 * returns null) - with no city/state/zip to anchor against, an address1-only comparison isn't
 * trustworthy enough to score on its own.
 * All comparisons case-insensitive; a missing address1 on either side scores that component 0
 * (no bigram overlap possible) without failing the other two components.
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
  // a signal these are different offices as a spelling/abbreviation mismatch is, so neither
  // factor should be allowed to fully outvote the other. When neither side has a numeric token
  // at all, numericTokenScore is null and the bigram score alone carries the component.
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
  // (nameScore, districtDivisionScore, chapterScore are always whole numbers) - the Jaccard blend
  // above is the only source of fractional values in this scoring pipeline, and an odd-precision
  // addressScore (e.g. 33.076923...) next to whole-number siblings would look like a display bug
  // in the Data Verifier UI rather than a deliberate score.
  return Math.round(addressLinesScore * 0.5 + zipScore * 0.3 + cityStateScore * 0.2);
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
 * Weighting: 8% address, 26% name, 8% phone, 8% email, 25% district/division, 25% chapter.
 * District/division and chapter are drawn from active CMMAP appointments, so together they carry
 * the majority (50%) as the strongest identity evidence; the remainder favors name (26%, the
 * primary human-readable identifier) with address/phone/email as smaller but non-trivial
 * corroborating signals - phone and email are high-entropy exact-match booleans, while address is
 * fuzzy-scored and more prone to staleness (trustees relocate), so all three are weighted equally
 * rather than favoring address's finer-grained scoring. Phone and email are nullable ("not
 * comparable" - data missing on either side): when null, that dimension's weight is excluded from
 * the calculation entirely and redistributed proportionally among the remaining applicable
 * dimensions, rather than penalizing the candidate with a 0.
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
    addressScore: 0.08,
    nameScore: 0.26,
    phoneScore: 0.08,
    emailScore: 0.08,
    districtDivisionScore: 0.25,
    chapterScore: 0.25,
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
 * Minimum nameScore (see calculateNameScore) for a candidate to be considered by
 * resolveByContactCorroboration. Below this, a name difference is too weak a starting point for
 * contact-field corroboration to rescue, regardless of how well address/phone/email line up.
 * Tuned via test/integration/sync-acms-professional-ids-audit/scripts/auto-link-threshold-backtest.ts.
 */
const CONTACT_CORROBORATION_NAME_THRESHOLD = 85;

/**
 * Minimum addressScore for address alone to count as strong corroboration under
 * resolveByContactCorroboration. Phone/email use their own scale's maximum (100, an exact
 * normalized-digit or case-insensitive match) instead, since both are short, structured values
 * where a partial match isn't meaningfully distinguishable from coincidence the way a fuzzy
 * address bigram score is.
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
 * Does not fetch appointments and always passes districtDivisionScore/chapterScore as 0 into
 * calculateCandidateScore to satisfy its parameter shape for logging - callers must not read
 * totalScore off the returned CandidateScore as a real six-dimension score; read
 * nameScore/addressScore/phoneScore/emailScore directly off the winning CandidateScore instead.
 */
export async function resolveByContactCorroboration(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
  candidateTrusteeIds: string[],
): Promise<ScoringOutcome> {
  const trusteesRepo = factory.getTrusteesRepository(context);

  const candidateDataPromises = candidateTrusteeIds.map(async (trusteeId) => {
    try {
      const trustee = await trusteesRepo.read(trusteeId);
      return { trusteeId, trustee, error: null };
    } catch (error) {
      // A transient infrastructure error is not evidence this candidate is unscorable — abort
      // the whole resolution attempt rather than silently proceeding with a smaller candidate set.
      if (isTooManyRequestsError(error) || isGatewayTimeoutError(error)) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { trusteeId, trustee: null, error: errorMessage };
    }
  });

  const candidateData = await Promise.all(candidateDataPromises);

  const candidateScores: CandidateScore[] = [];
  for (const { trusteeId, trustee, error } of candidateData) {
    if (error) {
      context.logger.warn(MODULE_NAME, `Skipping candidate ${trusteeId}: ${error}`);
      continue;
    }

    const score = calculateCandidateScore(context, sourceTrustee, '', '', '', trustee, []);
    candidateScores.push(score);
  }

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
 * corroboration bar was never really failable: sourceTrustee (the ACMS/DXTR record) recorded no
 * comparable phone or email at all, and either recorded no comparable address either, or its
 * address score, while below CONTACT_CORROBORATION_ADDRESS_THRESHOLD, does not represent a
 * genuine disagreement — a PARSEABLE ACMS address (see parseCityStateZip) scoring below
 * NO_CONTRADICTION_ADDRESS_FLOOR means both sides had a real address to compare and it disagreed,
 * which is not relaxed here. Requires nameScore === 100 specifically, a materially higher bar than
 * resolveByContactCorroboration's main path, since this fallback has no corroborating signal at
 * all to lean on besides the name itself.
 *
 * Backtested against a real trustee-professional-ids export: 91% of candidates that clear the
 * name threshold but not the main corroboration bar have an actively contradicting phone number
 * and are correctly excluded here; the rest that clear both exclusions hand-verified as genuine
 * matches (e.g. an ACMS name carrying a stray "INACTIVE" marker that still resolves to the
 * correct, currently-active CAMS trustee).
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
  if (hasContradictingAddress) return false;
  return true;
}

/**
 * Minimum addressScore gap (best candidate in a same-name group minus the second-best of that
 * same group) for resolveDuplicateNameCandidates to trust a same-trusteeName tiebreak. Backtested
 * against a real trustee-professional-ids export: among the 55 ACMS
 * records where matchTrusteeByName found more than one name-qualifying candidate, every candidate
 * PAIR sharing the same normalized trusteeName had an addressScore gap of 60+ against the ACMS
 * source record (e.g. ROY COHEN: addr=100 vs addr=0; RONALD E STADTMUELLER: addr=100 vs addr=3;
 * the five BRAD/BRAD W ODELL ACMS records all resolving to the same underlying duplicate pair at
 * addr=100 vs addr=0), while pairs with GENUINELY different trusteeNames clustered at gap 0-19 -
 * a same-name-group gap of 60+ is a much stronger signal of "two records for the same person, one
 * with better/current data" than of "two different people who happen to score similarly." Set
 * well above FUZZY_MATCH_MIN_GAP (8, tuned for a single-dimension swing between two DIFFERENT
 * people) since this tiebreak is deciding WHICH of two likely-duplicate records to trust, not
 * disambiguating between two different real people.
 */
const DUPLICATE_NAME_ADDRESS_GAP_THRESHOLD = 60;

/**
 * Outcome of resolveDuplicateNameCandidates - distinct from ScoringOutcome (not reused: DXTR's
 * sync-trustee-case-appointments.ts has an exhaustive switch over ScoringOutcome.kind that must
 * not need a new case just because this ACMS-shaped helper gained one):
 *  - 'resolved-duplicate': two or more candidates share the same normalized trusteeName (very
 *    likely the SAME real person recorded twice in the trustees collection - a CAMS data-quality
 *    problem, not a name-matching ambiguity) AND the addressScore gap between the best and
 *    second-best of that name-sharing group (both scored against sourceTrustee) clears
 *    DUPLICATE_NAME_ADDRESS_GAP_THRESHOLD. Callers should log/report this as a likely
 *    trustees-collection duplicate in addition to using trusteeId - this is a workaround for the
 *    duplicate, not a fix for it.
 *  - 'unresolved': candidates were scored but nothing qualifies as a safe duplicate tiebreak -
 *    covers BOTH "no two candidates share a name" (genuine ambiguity between different people,
 *    needs its own resolution, deliberately NOT attempted here) and "some share a name but the
 *    gap is too small to trust" cases.
 *  - 'no-match': every candidate failed to load, so nothing could be scored.
 */
export type DuplicateResolutionOutcome =
  | { kind: 'resolved-duplicate'; trusteeId: string; candidateScores: CandidateScore[] }
  | { kind: 'unresolved'; candidateScores: CandidateScore[] }
  | { kind: 'no-match' };

/**
 * Resolves a multi-candidate name match (matchTrusteeByName's 'ambiguous' result, or
 * resolveByContactCorroboration's 'unresolved' with 2+ name-qualifying candidates) by checking
 * SPECIFICALLY for the same-real-person-recorded-twice shape: two or more candidates whose
 * trusteeName is identical once normalized (case/whitespace-insensitive), where one scores much
 * better against sourceTrustee's address than the other. This is deliberately narrower than a
 * general fuzzy-match tiebreak - genuinely different candidates (different names, e.g. "David L.
 * Miller" vs "David P. Miller") are NEVER resolved here, only reported as still-unresolved,
 * because a backtest against real data found gap-based tiebreaking unsafe for that population:
 * the SAME ACMS name ("David Miller") appeared on two separate source records that resolved to
 * opposite winners against inconsistent-looking scores, suggesting these may genuinely be two
 * different people rather than one algorithm-detectable pattern. Resolving genuinely-different-name
 * candidates safely is explicitly OUT OF SCOPE here and needs its own follow-up validation before
 * any threshold is trusted for that case.
 *
 * Like resolveByContactCorroboration, this has no case-appointment-shaped evidence and is shared
 * (not ACMS-only) - DXTR's resolveNameCollisionByScoring hits the identical raw candidate pool
 * from matchTrusteeByName's ambiguous path and can just as easily be looking at a CAMS-side
 * duplicate as an ACMS-sourced ambiguity.
 */
export async function resolveDuplicateNameCandidates(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
  candidateTrusteeIds: string[],
): Promise<DuplicateResolutionOutcome> {
  const trusteesRepo = factory.getTrusteesRepository(context);

  const candidateDataPromises = candidateTrusteeIds.map(async (trusteeId) => {
    try {
      const trustee = await trusteesRepo.read(trusteeId);
      return { trusteeId, trustee, error: null };
    } catch (error) {
      // Same rationale as resolveByContactCorroboration/resolveNameCollisionByScoring's identical
      // guard: a transient infrastructure error is not evidence this candidate is unscorable, so
      // it must abort this whole resolution attempt rather than silently proceeding with a
      // smaller candidate set.
      if (isTooManyRequestsError(error) || isGatewayTimeoutError(error)) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { trusteeId, trustee: null, error: errorMessage };
    }
  });

  const candidateData = await Promise.all(candidateDataPromises);

  const scoredCandidates: { trustee: Trustee; score: CandidateScore }[] = [];
  for (const { trusteeId, trustee, error } of candidateData) {
    if (error) {
      context.logger.warn(MODULE_NAME, `Skipping candidate ${trusteeId}: ${error}`);
      continue;
    }
    // Reuses calculateCandidateScore purely for its addressScore computation against the real
    // sourceTrustee - same '', '', '', [] no-case-appointment-context pattern as
    // resolveByContactCorroboration; totalScore/nameScore (scored against sourceTrustee, not
    // against the OTHER candidate) are not meaningful for the same-person grouping below and
    // unused there - see asComparableParty for the candidate-vs-candidate comparison instead.
    const score = calculateCandidateScore(context, sourceTrustee, '', '', '', trustee, []);
    scoredCandidates.push({ trustee, score });
  }

  if (scoredCandidates.length === 0) {
    context.logger.warn(
      MODULE_NAME,
      'Duplicate-name resolution failed: no valid candidates could be scored',
    );
    return { kind: 'no-match' };
  }

  const candidateScores = scoredCandidates.map((c) => c.score);

  // Groups candidates that plausibly refer to the SAME real person by reusing calculateNameScore
  // pairwise (candidate vs. candidate, not candidate vs. sourceTrustee) - NOT
  // normalizeNameForMatching's raw string-equality check, which only bridges punctuation/suffix
  // noise and would never recognize "Roy J. Cohen" and "R. Cohen" as the same person despite that
  // being the flagship duplicate example this function exists to catch. Reuses
  // calculateNameScore's existing firstLastNameToken-exact-match-required, initial-vs-full-
  // tolerant logic rather than inventing a second, separately-tuned name-similarity comparison.
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
 * firstLastNameToken). Does not narrow results by court appointment - district/division evidence
 * is left to the caller's resolveNameCollisionByScoring, which scores it (0/50/100, see
 * calculateDistrictDivisionScore) rather than gating candidate discovery on it.
 * Returns raw, unscored candidates; the caller's resolveNameCollisionByScoring performs the
 * address/phone/email/district/chapter/name scoring and appointment-match discrimination.
 * Requires a lastName on the DXTR side - there's nothing to search by without one.
 */
async function findLastNameTokenMatches(
  context: ApplicationContext,
  dxtrTrustee: DxtrTrusteeParty,
): Promise<Trustee[]> {
  const token = firstLastNameToken(dxtrTrustee.lastName);
  if (!token) return [];

  const trusteesRepo = factory.getTrusteesRepository(context);
  return trusteesRepo.searchTrusteesByNameScored(token);
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
 * empty/whitespace-only fragments after tokenizing - unlike a phonetic/bigram search, exact-word
 * containment (searchTrusteesByName's case-insensitive substring regex against trustee.name) does
 * NOT have a "single initial matches almost everything" problem, so there is no need for a higher
 * floor the way an earlier phonetic-search attempt required (see findTokenIntersectionCandidates'
 * doc comment for why that attempt was abandoned) - a short token like "mc" or "jo" still only
 * matches trustees whose NAME TEXT literally contains that substring.
 */
const TOKEN_INTERSECTION_MIN_TOKEN_LENGTH = 2;

/**
 * Common suffixes/role markers that shouldn't count as a discriminating name token for
 * findTokenIntersectionCandidates - same list backtested in
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
 * stopwords and short (<2 char) tokens removed - see findTokenIntersectionCandidates's doc
 * comment for why. Exported for reuse by the token-intersection backtest script and its unit
 * tests; not intended as a general-purpose name utility outside that context.
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
 * Last-resort candidate-discovery tier for a name matchTrusteeByName's own tiers structurally
 * cannot find: a name where the parts have been REORDERED (not just abbreviated) relative to how
 * CAMS stores firstName/middleName/lastName - e.g. a lastName with an internal space that changes
 * its token count ("MC LANE" vs "McLane"), a person who goes by their middle name with the ACMS
 * source recording it in a different field position ("GEORGE L REDER" vs CAMS
 * firstName=L./middleName=George), or a first name dropped entirely in favor of a middle name
 * with no initial preserved ("C. EUGENE CHAMBERLAIN" vs CAMS firstName=Eugene). calculateNameScore
 * requires firstLastNameToken(dxtrLastName) === firstLastNameToken(camsLastName) as a hard gate
 * and compares first/middle POSITIONALLY - all three shapes above score 0 under that comparison
 * regardless of how strong any other evidence is, and matchTrusteeByName's own tiers (exact
 * string match, normalized string match, single first-lastName-token search) never surface a
 * candidate for them either, so there is nothing for resolveByContactCorroboration/
 * resolveDuplicateNameCandidates to even score.
 *
 * Approach: tokenize fullName into individually-meaningful tokens (see
 * tokenizeNameForIntersection), search trustees by EACH token independently via
 * searchTrusteesByName (case-insensitive substring containment against trustee.name - NOT
 * searchTrusteesByNameScored's phonetic/bigram index), and INTERSECT the resulting trusteeId
 * sets. A trustee appearing in the intersection of every token is a much stronger,
 * order-independent candidate than anything a single-token or full-string search can produce,
 * since it does not care which field position a given name part landed in on either side.
 *
 * WHY searchTrusteesByName AND NOT searchTrusteesByNameScored: an earlier attempt used
 * searchTrusteesByNameScored, reasoning that its phonetic index was the "real" search matchTrusteeByName's
 * own fuzzy tier already uses. Backtested against a real trustee-professional-ids
 * export using the ACTUAL phoneticTokens containment logic (precomputed
 * per trustee, faithfully reproduced offline) - this was FAR too broad to narrow anything: most
 * records intersected to hundreds or thousands of candidates (phonetic/bigram tokens like "S530"
 * or "th" collide across huge numbers of unrelated names), and the rare exactly-one-candidate
 * hits that did occur were false positives (e.g. "CAROL LYNN FOX" intersecting to "Brian Foltyn").
 * Switching to searchTrusteesByName's plain substring containment and lowering the token-length
 * floor to 2 reproduced the ORIGINAL substring-proxy experiment's results almost exactly: 140 of
 * 869 eligible no-name-candidate records collapsed to exactly one intersection candidate, all
 * hand-plausible on inspection (e.g. "W. WHEELER BRYAN" -> "William Wheeler Bryan", "GEORGE L
 * REDER" -> "L. George Reder"), with zero records producing an unmanageably large intersection.
 *
 * Returns RAW, UNSCORED candidates - same contract as findLastNameTokenMatches. The caller is
 * responsible for routing a single candidate through resolveByContactCorroboration and 2+
 * candidates through resolveDuplicateNameCandidates before ever auto-linking; a unique
 * intersection result is a candidate-FINDING signal, not a match confidence score on its own.
 *
 * COST WARNING - this issues one searchTrusteesByName query per token (2+ real queries),
 * meaningfully more expensive than any single-query tier in matchTrusteeByName. Callers MUST
 * treat this as an explicit last resort, invoked only after matchTrusteeByName itself has
 * returned 'no-match' (i.e. every cheaper tier already found nothing) - never call this
 * speculatively or in parallel with cheaper tiers.
 */
export async function findTokenIntersectionCandidates(
  context: ApplicationContext,
  sourceTrustee: DxtrTrusteeParty,
): Promise<Trustee[]> {
  const tokens = tokenizeNameForIntersection(sourceTrustee.fullName);
  if (tokens.length < 2) {
    // Need at least 2 independent tokens for an intersection to narrow anything - a single-token
    // name (e.g. a company name with no discernible person-name shape) can't be searched this way.
    return [];
  }

  const trusteesRepo = factory.getTrusteesRepository(context);

  let candidateSet: Map<string, Trustee> | null = null;
  for (const token of tokens) {
    const matches = await trusteesRepo.searchTrusteesByName(token);
    const matchesById = new Map(matches.map((t) => [t.trusteeId, t]));

    if (candidateSet === null) {
      candidateSet = matchesById;
    } else {
      for (const trusteeId of candidateSet.keys()) {
        if (!matchesById.has(trusteeId)) candidateSet.delete(trusteeId);
      }
    }

    if (candidateSet.size === 0) break; // no point querying further tokens once empty
  }

  const candidates = candidateSet ? [...candidateSet.values()] : [];

  if (candidates.length > 0) {
    const candidateList = candidates.map((t) => `${t.trusteeId} ("${t.name}")`).join(', ');
    context.logger.info(
      MODULE_NAME,
      `Token-intersection search found ${candidates.length} candidate(s) for ` +
        `"${sourceTrustee.fullName}" (tokens=[${tokens.join(', ')}]): ${candidateList}.`,
    );
  }

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
 * Last-resort candidate-discovery tier for a genuine SPELLING error (typo, transposition, OCR-
 * style character error) in the first or last name - a different failure shape than
 * findTokenIntersectionCandidates' target (name-part REORDERING). calculateNameScore's
 * firstLastNameToken-exact-match-required lastName gate, and matchTrusteeByName's own tiers, all
 * fail outright on e.g. "STEPHAN DARR" vs CAMS "Stephen Darr", or "KATHYLN SELLECK" vs CAMS
 * "Kathlyn Selleck" - a single transposed/substituted character anywhere in either name part.
 *
 * Approach: ANCHOR one name part with an EXACT match, then allow the OTHER part to be a close
 * (edit distance <= 2) match rather than requiring exact equality. Tried in both directions,
 * unioned: (a) lastName exact -> firstName fuzzy, (b) firstName exact -> lastName fuzzy. This is
 * NOT an unanchored Levenshtein approach (fuzzing lastName alone against the ENTIRE trustee
 * population was found to produce 1637 noisy candidates collapsing to only 4 legitimate matches
 * after requiring strong corroboration - too noisy to use): anchoring one
 * side exactly first narrows the candidate pool before ever computing an edit distance, the same
 * way findTokenIntersectionCandidates' precision comes from requiring both tokens to already
 * narrow the pool rather than fuzzing on a single, unanchored dimension.
 *
 * Candidate sourcing: queries searchTrusteesByName once per direction using the ANCHOR token
 * (narrows to trustees whose composed name contains that substring at all - cheap, single query),
 * then filters IN-MEMORY over that already-small result set for an exact match on the specific
 * anchor field (firstName or lastName) and a Levenshtein-close match on the other. This avoids
 * fuzzing against the full trustees collection.
 *
 * Backtested against a real trustee-professional-ids export: WITHOUT corroboration, roughly a
 * third of exactly-one-candidate hits are plausible false
 * positives on common first/last names (e.g. a common first name paired with a merely
 * shape-similar surname). Corroboration-gated (same OR-rule resolveByContactCorroboration already
 * applies: addressScore>=80 OR phoneScore==100 OR emailScore==100), 32 of 96 exactly-one-candidate
 * hits clear it, and ALL 32 hand-checked as genuine matches with zero false positives observed.
 * Marginal over findTokenIntersectionCandidates alone: 18 additional corroborated records this
 * tier catches that token-intersection's exact-substring requirement cannot (spelling-error shape,
 * not reordering shape) - a real but modest yield, hence the strict corroboration-gated caller
 * contract below.
 *
 * Returns RAW, UNSCORED candidates - same contract as findTokenIntersectionCandidates. The caller
 * is responsible for routing a single candidate through resolveByContactCorroboration and 2+
 * candidates through resolveDuplicateNameCandidates before ever auto-linking - this is a
 * candidate-FINDING mechanism, not a match confidence score on its own. An anchored-fuzzy hit on a
 * common name (e.g. "Robert", "William") is NOT reliable evidence alone; corroboration is what
 * separates the 32 genuine matches from the roughly one-third false-positive rate observed in the
 * uncorroborated set.
 *
 * COST WARNING - issues up to 2 searchTrusteesByName queries (one per anchor direction), on top of
 * whatever matchTrusteeByName/findTokenIntersectionCandidates already tried. Callers MUST treat
 * this as an explicit last resort, invoked only after BOTH of those have already found nothing -
 * never call this speculatively or in parallel with cheaper tiers. Same ordering requirement as
 * findTokenIntersectionCandidates.
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
