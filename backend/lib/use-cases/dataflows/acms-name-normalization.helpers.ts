// Pure helpers for recognizing ACMS name data-quality issues; shared by the pipeline stages.

import { CanonicalTrusteeSource } from '@common/cams/dataflow-events';

/**
 * A digit anywhere in PROF_FIRST_NAME is treated as an ACMS corruption signal. Two shapes:
 *
 * 1. Whole-name-in-lastName (e.g. PROF_FIRST_NAME="TACOMACH13", PROF_LAST_NAME="K. MICHAEL DOE"):
 *    when lastName has 2+ tokens, firstName/lastName are re-derived from lastName and the
 *    corrupted firstName is discarded.
 * 2. Trailing-junk-only (e.g. PROF_FIRST_NAME="WALTER 12,13", PROF_LAST_NAME="ROE"): when lastName
 *    is a single token, only firstName's first token is kept.
 *
 * Returned unchanged when firstName has no digit.
 */
export function recoverCorruptedFirstName(
  firstName: string,
  lastName: string,
): { firstName: string; lastName: string } {
  if (!/\d/.test(firstName)) return { firstName, lastName };

  const lastNameTokens = lastName.trim().split(/\s+/).filter(Boolean);
  if (lastNameTokens.length >= 2) {
    return {
      // Everything but the real surname becomes the new firstName, possibly compound ("K. MICHAEL").
      firstName: lastNameTokens.slice(0, -1).join(' '),
      lastName: lastNameTokens[lastNameTokens.length - 1],
    };
  }

  const firstNameFirstToken = firstName.trim().split(/\s+/)[0] ?? '';
  return { firstName: firstNameFirstToken, lastName };
}

/**
 * Entity suffixes CMMPR appends to a sole practitioner's own name when the professional is
 * recorded under their practice's business name (e.g. lastName "DOE INC" for "ROBERT K. DOE").
 * Narrow on purpose: GROUP/ASSOCIATES/TRUST mostly mark multi-person businesses.
 */
const SOLO_PRACTICE_ENTITY_SUFFIX_PATTERN = /,?\s+(INC|LLC|LLP|PC|PLLC|CORP)\.?$/i;

/**
 * Recovers a solo practitioner's own name from a business-suffixed lastName when firstName is
 * blank (e.g. lastName "ROBERT K MORROW INC", firstName "" -> firstName "ROBERT K", lastName
 * "MORROW"). Returned unchanged when firstName is populated, no suffix is present, or fewer than
 * two tokens remain after removing the suffix.
 */
export function recoverSoloPracticeName(
  firstName: string,
  lastName: string,
): { firstName: string; lastName: string } {
  if (firstName) return { firstName, lastName };

  const withoutSuffix = lastName.replace(SOLO_PRACTICE_ENTITY_SUFFIX_PATTERN, '').trim();
  if (withoutSuffix === lastName.trim()) return { firstName, lastName };

  const tokens = withoutSuffix.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return { firstName, lastName };

  return {
    firstName: tokens.slice(0, -1).join(' '),
    lastName: tokens[tokens.length - 1],
  };
}

/**
 * Recovers a name from a "LAST, FIRST" shape landing entirely in lastName when firstName is only
 * role-phrase noise (e.g. firstName "LIQUIDATING TRUSTEE", lastName "[Surname], [GivenName]" ->
 * firstName "[GivenName]", lastName "[Surname]"). Requires both isLikelyNotAPerson(firstName) and a
 * comma in lastName; a comma alone (e.g. "[Surname], Jr.") is not enough. Returned unchanged
 * otherwise.
 */
export function recoverLastFirstRoleSwap(
  firstName: string,
  lastName: string,
): { firstName: string; lastName: string } {
  if (!firstName || !isLikelyNotAPerson(firstName)) return { firstName, lastName };
  if (!lastName.includes(',')) return { firstName, lastName };

  const [last, first] = lastName.split(',').map((part) => part.trim());
  if (!last || !first) return { firstName, lastName };

  return { firstName: first, lastName: last };
}

/**
 * Status, chapter and deprecation markers ACMS records carry alongside or instead of a name; they
 * are stripped so matching runs against what's left (e.g. "DECEASED - ROE, JR." -> "ROE JR",
 * "JORDAN W ROE (CHAPTER 12)" -> "JORDAN W ROE"). Standalone role words ("trustee", "office",
 * "case") are not listed here because stripping them could mangle a surname; they are handled by
 * NON_PERSON_ONLY_WORDS. U.S. Trustee annotations are not listed either; see UST_STAFF_PATTERN.
 */
const ADMINISTRATIVE_MARKER_PHRASES = [
  'do not use this code',
  'do not use',
  'inactive',
  'duplicate',
  'cancelled',
  'canceled',
  'cancel',
  'delete me',
  'delete',
  'not assigned',
  'reopening pending',
  'pending',
  'np',
  'deceased',
  'acting\\s*ch\\.?\\s*\\d+\\s*trustee',
  'chapter\\s*\\d+',
  'ch\\.?\\s*\\d+',
  'liq\\s*tr',
];

/** \b-anchored so short markers like "np" never match inside a name (e.g. "STANPACK"). */
const ADMINISTRATIVE_MARKER_PATTERN = new RegExp(
  `\\(?\\s*\\b(${ADMINISTRATIVE_MARKER_PHRASES.join('|')})\\b\\s*\\)?`,
  'gi',
);

/**
 * A chapter marker glued directly onto a name with no separator (e.g. "DOYLECH13"), which
 * ADMINISTRATIVE_MARKER_PATTERN's \b anchor cannot find. The trailing \b leaves tokens like
 * "chapter13upload" alone. Applied before ADMINISTRATIVE_MARKER_PATTERN.
 */
const GLUED_CHAPTER_MARKER_PATTERN = /(chapter|ch)\d+\b/gi;

/**
 * "I. M. FAKE" is a known ACMS test identity; matched as a whole phrase against the
 * marker-stripped fullName because "Fake" alone is a real surname.
 */
const FAKE_IDENTITY_PATTERN = /^i\.?\s*m\.?\s*fake$/i;

/** "RE-OPENED (JACKSON)": the parenthetical names a court/division, not a trustee - matched as one
 * whole shape (rather than stripping "re-opened" and leaving the arbitrary division name to be
 * separately recognized) since the division name itself has no fixed vocabulary. */
const REOPENED_WITH_PAREN_PATTERN = /^re-?opened\s*\([^)]*\)$/i;

/**
 * Phrases ACMS uses to disavow a specific professional-code record, whether or not a real name is
 * also present. Checked on its own by isRecordDisavowed and never stripped-then-matched: stripping
 * would discard the disavowal itself.
 *
 * Excludes "inactive" and "deceased": those trustees can still have cases that need their identity
 * resolved, so those records must still reach matching.
 */
const DISAVOWED_RECORD_PHRASES = [
  'do not use this code',
  'do not use',
  'duplicate',
  'cancelled',
  'canceled',
  'cancel',
  'delete me',
  'delete',
];

const DISAVOWED_RECORD_PATTERN = new RegExp(`\\b(${DISAVOWED_RECORD_PHRASES.join('|')})\\b`, 'i');

/**
 * Whether ACMS has disavowed this record (see DISAVOWED_RECORD_PHRASES), checked against the raw
 * fullName without stripping. Also checks address fields: ACMS sometimes puts "DO NOT USE" in
 * address1.
 */
export function isRecordDisavowed(professional: CanonicalTrusteeSource): boolean {
  if (DISAVOWED_RECORD_PATTERN.test(professional.fullName)) return true;
  const addressFields = [
    professional.legacy?.address1,
    professional.legacy?.address2,
    professional.legacy?.cityStateZipCountry,
  ]
    .filter(Boolean)
    .join(' ');
  return DISAVOWED_RECORD_PATTERN.test(addressFields);
}

/**
 * U.S. Trustee office annotations ("U.S. TRUSTEE", "(UST)"). U.S. Trustee staff are never CAMS
 * trustee records, so a UST annotation skips the record rather than stripping and matching.
 */
const UST_STAFF_PATTERN = /\(?\s*\bu\.?\s*s\.?\s*trustee\b\s*\)?|\(\s*ust\s*\)/i;

/**
 * Whether the raw fullName carries a UST annotation (see UST_STAFF_PATTERN); checked before any
 * marker stripping.
 */
export function shouldSkipAsUstStaff(fullName: string): boolean {
  return UST_STAFF_PATTERN.test(fullName);
}

/** Words that describe a role, office or case status rather than a person (e.g. "UNITED STATES
 * TRUSTEE", "NONE ASSIGNED (DEBTOR IN POSS)"). isLikelyNotAPerson requires EVERY word of the
 * stripped name to be in this set, so one name-shaped word is enough to proceed to matching.
 *
 * Contains no single-character entries ("U.S. TRUSTEE" is caught by UST_STAFF_PATTERN instead), and
 * excludes "fake", a real surname (see FAKE_IDENTITY_PATTERN). */
const NON_PERSON_ONLY_WORDS = new Set([
  'trustee',
  'trustees',
  'office',
  "office's",
  'code',
  'case',
  'appt',
  'as',
  'united',
  'states',
  'this',
  'the',
  'of',
  'no',
  'tr',
  'old',
  'none',
  'reopened',
  'assigned',
  'involuntary',
  'invol',
  'petition',
  'debtor',
  'in',
  'poss',
  'unassigned',
  'transfer',
  'expunged',
  'progress',
  'assignment',
  'missing',
  'apt',
  'trrustee',
  'trinvol',
  'pre2004pendingcases',
  'chapter13upload',
  'stricken',
  'pro',
  'se',
  'liquidating',
  'appointed',
  'petn',
  'possession',
  'admin',
  'purpose',
]);

/**
 * Strips known administrative marker phrases (see ADMINISTRATIVE_MARKER_PHRASES) and glued chapter
 * markers from a name part, then replaces punctuation (including parens and colons) with spaces and
 * collapses whitespace, so words like "(debtor" or "stricken:" compare against
 * NON_PERSON_ONLY_WORDS. Applied to firstName and lastName in normalizeAcmsSourceName and to
 * fullName in shouldSkipAsNotAPerson; recoverLastFirstRoleSwap calls isLikelyNotAPerson on the
 * unstripped firstName.
 */
export function stripAdministrativeMarkers(value: string): string {
  return value
    .replace(GLUED_CHAPTER_MARKER_PATTERN, '')
    .replace(ADMINISTRATIVE_MARKER_PATTERN, ' ')
    .replace(/[-/*.,():_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * True when the name is empty or EVERY word is in NON_PERSON_ONLY_WORDS (e.g. "UNITED STATES
 * TRUSTEE'S OFFICE", "APPT AS TRUSTEE").
 */
function isLikelyNotAPerson(strippedFullName: string): boolean {
  const words = strippedFullName.toLowerCase().replaceAll("'", '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((word) => NON_PERSON_ONLY_WORDS.has(word));
}

/**
 * Whether the raw fullName names no person: a "RE-OPENED (...)" placeholder, the FAKE test
 * identity, or only NON_PERSON_ONLY_WORDS after stripAdministrativeMarkers.
 */
export function shouldSkipAsNotAPerson(fullName: string): boolean {
  if (REOPENED_WITH_PAREN_PATTERN.test(fullName.trim())) return true;
  const stripped = stripAdministrativeMarkers(fullName);
  if (FAKE_IDENTITY_PATTERN.test(stripped)) return true;
  return isLikelyNotAPerson(stripped);
}
