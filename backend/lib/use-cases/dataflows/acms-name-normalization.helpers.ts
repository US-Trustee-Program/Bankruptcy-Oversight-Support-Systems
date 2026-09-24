// Pure text/regex utilities for recognizing and normalizing ACMS professional-name data quality
// issues (compound/corrupted/business-suffixed name fields, administrative placeholder text). No
// dependency on any dataflow, gateway, or repository - moved here from sync-acms-professional-ids.ts
// (CAMS-876, cams-cq6ey) because trustee-match-pipeline-stages.ts, the source-agnostic matching
// library, needs these helpers too. Importing them from sync-acms-professional-ids.ts directly
// created an import cycle (stages -> sync-acms-professional-ids -> trustee-match-pipeline-
// orchestrator -> stages) that pointed the general pipeline-stages module at one specific caller's
// dataflow; this module is the neutral home both sides can depend on instead.

/**
 * Splits a compound PROF_FIRST_NAME (e.g. "CAROLINE RENEE") into its first token and the
 * remainder, but ONLY when PROF_MI is empty — CMMPR sometimes carries a middle name inside
 * PROF_FIRST_NAME instead of using PROF_MI, and calculateNameScore's exact-match-or-initial
 * firstName comparison has no tolerance for an unsplit compound value, so this normalizes it to
 * the same firstName/middleName split DXTR already produces before it ever reaches the shared
 * matcher. Left untouched whenever PROF_MI is already populated, since a compound firstName
 * alongside a real middle initial is a different (and much rarer) shape not addressed here.
 */
export function splitCompoundFirstName(
  firstName: string | undefined,
  middleInitial: string | undefined,
): { firstName: string | undefined; middleName: string | undefined } {
  if (middleInitial || !firstName) return { firstName, middleName: middleInitial };

  const tokens = firstName.trim().split(/\s+/);
  if (tokens.length < 2) return { firstName, middleName: middleInitial };

  return { firstName: tokens[0], middleName: tokens.slice(1).join(' ') };
}

/**
 * A digit anywhere in PROF_FIRST_NAME is a reliable ACMS corruption signal - no real first name
 * contains one. This covers two distinct real shapes, handled differently:
 *
 * 1. Whole-name-in-lastName (e.g. PROF_FIRST_NAME="TACOMACH13", a mangled city+chapter code,
 *    PROF_LAST_NAME="K. MICHAEL DOE" - the trustee's entire real name): when lastName has
 *    2+ space-separated tokens, it's treated as the real "firstName [middleName] lastName" and
 *    re-derived from it wholesale - the corrupted firstName is discarded entirely, since it never
 *    held any real name data to begin with.
 * 2. Trailing-junk-only (e.g. PROF_FIRST_NAME="WALTER 12,13" with a clean PROF_LAST_NAME=
 *    "ROE" - a real trustee's chapter-number annotation glued onto an otherwise-correct
 *    firstName): when lastName is already a single clean token, re-deriving from it would destroy
 *    a value that was never corrupted, so only firstName's first token is kept.
 *
 * Left untouched (both fields as-is) when firstName has no digit, or when there's no usable
 * recovery target (firstName has a digit but reduces to nothing usable and lastName is also a
 * single token) - a record with no real name signal on either side (e.g. an ACMS batch-upload
 * placeholder) should be left for matching to correctly find no-match, not forced into a guess.
 */
export function recoverCorruptedFirstName(
  firstName: string,
  lastName: string,
): { firstName: string; lastName: string } {
  if (!/\d/.test(firstName)) return { firstName, lastName };

  const lastNameTokens = lastName.trim().split(/\s+/).filter(Boolean);
  if (lastNameTokens.length >= 2) {
    return {
      // Everything but the real surname (the final token) becomes the new firstName - still
      // possibly compound (e.g. "K. MICHAEL"), left for splitCompoundFirstName below to divide
      // into firstName/middleName exactly as it already does for a normal compound PROF_FIRST_NAME.
      firstName: lastNameTokens.slice(0, -1).join(' '),
      lastName: lastNameTokens[lastNameTokens.length - 1],
    };
  }

  const firstNameFirstToken = firstName.trim().split(/\s+/)[0] ?? '';
  return { firstName: firstNameFirstToken, lastName };
}

/**
 * Entity suffixes CMMPR appends to a sole practitioner's own name when the professional is
 * recorded under their practice's business name rather than as a person (e.g. lastName
 * "DOE INC" for a trustee who really is "ROBERT K. DOE", firstName blank). Deliberately narrow -
 * a survey of every business-suffixed lastName in a real staging export found only a small
 * minority were a genuine solo practitioner's own name recoverable this way; the rest (e.g.
 * "COHEN PROPERTIES TRUST, INC.", "ROTH TRUSTEE CORP.") were real businesses with no individual
 * trustee behind them. GROUP/ASSOCIATES/TRUST/"& ASSOCIATES" are deliberately excluded from this
 * list for the same reason - that evidence showed those suffixes overwhelmingly mark a genuine
 * multi-person business, not a solo practice.
 */
const SOLO_PRACTICE_ENTITY_SUFFIX_PATTERN = /,?\s+(INC|LLC|LLP|PC|PLLC|CORP)\.?$/i;

/**
 * Recovers a solo practitioner's own name from a business-suffixed lastName when firstName is
 * blank (e.g. lastName "MORROW INC", firstName "" -> firstName "ROBERT K", lastName "MORROW", given
 * an original lastName of "ROBERT K MORROW INC"). Only attempted when firstName is already blank -
 * a populated firstName means CMMPR already recorded a person's name normally, so there is no
 * recovery to perform. Left untouched when stripping the suffix changes nothing (no matching
 * suffix present) or leaves fewer than two tokens (no first/last split is possible) - both mean
 * this isn't the "name folded into a business-suffixed lastName" shape this recovery targets, and
 * forcing a split would risk mangling a real single-token business name into a fake person.
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
 * Known administrative/placeholder phrases ACMS records carry instead of, or alongside, a real
 * trustee name - a "this professional-id code is deprecated/superseded" marker, not part of
 * anyone's real name. Deliberately excludes standalone role words like "trustee"/"office"/
 * "code"/"case" from this list - those only signal "not a person" when they're ALL that's left
 * after stripping (see isLikelyNotAPerson), but stripping them unconditionally here would also
 * mangle a real surname that happens to contain one as a substring.
 *
 * "np" (e.g. lastName "DOE (NP)"/"ROE (NP)") is always seen as a bracketed suffix on an
 * otherwise-real name, the same shape as "(TR)"/"(DO NOT USE)" - unlike those two-plus-word
 * phrases, a bare 2-letter token needs ADMINISTRATIVE_MARKER_PATTERN's word-boundary anchoring to
 * avoid matching as a substring inside a real name (e.g. a surname like "STANPACK").
 *
 * "u\.?\s*s\.?\s*trustee" and "deceased" are both real-name-plus-role/status-suffix shapes, not
 * pure placeholders - e.g. lastName "DOE - U S TRUSTEE" or "DECEASED - ROE, JR.". Stripping the
 * marker recovers the real surname underneath ("DOE", "ROE, JR.") so matching proceeds against it,
 * rather than either failing to match the un-stripped text or (worse) being misclassified as
 * not-a-person and skipped outright - a real trustee identity here, unlike a bare "US TRUSTEE"
 * placeholder with no name at all (that case is instead caught by NON_PERSON_ONLY_WORDS, once
 * every word of it is a known non-person word).
 *
 * "chapter\d+"/"ch\.?\d+"/"ust"/"acting ch\.?\d+ trustee" are the same real-name-plus-suffix shape -
 * e.g. "JORDAN W ROE (CHAPTER 12)", "TAYLOR DOE (UST)" - stripping recovers the real name.
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
  'u\\.?\\s*s\\.?\\s*trustee',
  'deceased',
  'acting\\s*ch\\.?\\s*\\d+\\s*trustee',
  'chapter\\s*\\d+',
  'ch\\.?\\s*\\d+',
  'ust',
];

/**
 * Word-boundary-anchored (\b) so a short marker like "np" only matches as its own token or
 * bracketed suffix, never as a substring inside a real name (e.g. "STANP" unmangled) - a risk the
 * original longer, multi-word phrases never had, but a bare 2-letter addition like "np" does.
 */
const ADMINISTRATIVE_MARKER_PATTERN = new RegExp(
  `\\(?\\s*\\b(${ADMINISTRATIVE_MARKER_PHRASES.join('|')})\\b\\s*\\)?`,
  'gi',
);

/**
 * "I. M. FAKE" is a well-known synthetic/test ACMS record - appears across multiple ACMS regions,
 * sometimes as one field - lastName "I. M. FAKE" - and sometimes split across both - firstName
 * "I. M."/lastName "FAKE". Matched as ONE whole identity
 * against the RAW, concatenated fullName (firstName + middleInitial + lastName, exactly as ACMS
 * composed it - see toAcmsTrusteeProfessional), entirely independent of NON_PERSON_ONLY_WORDS'
 * word-by-word decomposition - "fake" is a real surname (people are named Fake), so it must never
 * trigger a skip on its own, only when the full "I [M] FAKE" shape is present together. Checking
 * the raw, pre-atomized fullName - rather than firstName/lastName separately, or a reduced form
 * from later in the pipeline - is what makes a single literal pattern sufficient regardless of
 * which ACMS field the marker landed in: firstLastNameToken/normalizeNamePart/
 * splitCompoundFirstName all reshape and redistribute name parts in ways that make a signal split
 * across fields, or embedded mid-field, unpredictable to find again downstream (confirmed by
 * tracing: "I. M."/"FAKE" splits into separate firstName "i"/middleName "m" via
 * splitCompoundFirstName, and "I. M. FAKE" alone reduces its lastName to primary token "i" with
 * "fake" demoted to lastNameAlternates via lastNameSurnameCandidates - neither reduced shape is
 * checkable as one string anymore). Checking the untouched raw fullName up front, before any of
 * that reduction runs, sidesteps the whole problem.
 */
const FAKE_IDENTITY_PATTERN = /^i\.?\s*m\.?\s*fake$/i;

/** "RE-OPENED (JACKSON)": the parenthetical names a court/division, not a trustee - matched as one
 * whole shape (rather than stripping "re-opened" and leaving the arbitrary division name to be
 * separately recognized) since the division name itself has no fixed vocabulary. */
const REOPENED_WITH_PAREN_PATTERN = /^re-?opened\s*\([^)]*\)$/i;

/**
 * Phrases ACMS uses to explicitly disavow a specific professional-code RECORD, regardless of
 * whether a real person's name is also present - "do not use", "duplicate", "cancelled", "delete"
 * all mean "this record itself should never be used," not "here is administrative noise attached
 * to an otherwise-good name." This is a DIFFERENT signal from ADMINISTRATIVE_MARKER_PHRASES'
 * strip-then-recover treatment, and deliberately checked as its own, separate, unconditional
 * decision (see isRecordDisavowed below) rather than folded into that list - stripping "do not
 * use" and then judging only what's left (as ADMINISTRATIVE_MARKER_PHRASES does) discards the
 * fact that ACMS ever said it at all, which is exactly the wrong call here: a real record with a
 * lastName like "DOE (EC) ROE (DO NOT USE)" can have a real name present, with its sole CAMS
 * candidate even barely clearing doesNameMatch's threshold, while ACMS is explicitly telling us
 * this specific record is a stale duplicate of some other, presumably better, record for the same
 * surname - matching against it at all is the wrong move, independent of name quality. This shows
 * up as a small family of near-duplicate records for the apparent same person, several bearing
 * this same marker.
 *
 * Deliberately excludes "inactive" and "deceased", even though both appear in
 * ADMINISTRATIVE_MARKER_PHRASES alongside genuine "do not use" co-occurrences (e.g. a lastName like
 * "DOE - INACTIVE DO NOT USE") - an inactive trustee can still have open cases that must stay
 * correctly attributed until reassignment, and a deceased trustee's past cases likewise need
 * their real identity resolved (reassignment is a separate, later concern) - both must still
 * reach matching, not skip outright, unlike a record ACMS calls a duplicate/cancelled/do-not-use.
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
 * Whether ACMS has explicitly disavowed this specific record (see DISAVOWED_RECORD_PHRASES) -
 * checked against the RAW fullName, unconditionally, independent of whether a real person's name
 * is also present. This is a second, structurally separate prefilter from shouldSkipAsNotAPerson
 * (see that function's own doc comment): both run before normalizeAcmsSourceName and both can set
 * state.skip, but they answer different questions - "does this name no one" versus "did ACMS say
 * not to use this record, name or no name" - and a record can trip either one independently of
 * the other's reasoning. Never strips anything first: stripping IS the wrong move here (see
 * DISAVOWED_RECORD_PHRASES's own doc comment), so this checks the untouched fullName directly.
 */
export function isRecordDisavowed(fullName: string): boolean {
  return DISAVOWED_RECORD_PATTERN.test(fullName);
}

/** Bare words that, once every ADMINISTRATIVE_MARKER_PHRASES marker is stripped, indicate
 * whatever is left is STILL administrative text describing a role/case rather than a person's
 * name (e.g. "UNITED STATES TRUSTEE" -> stripped to itself, unchanged, since none of its words
 * are markers - but "trustee" alone is not a surname). Used only by isLikelyNotAPerson's
 * word-by-word check, never to strip text from a name that will proceed to matching.
 *
 * Deliberately contains no single-character entries: "US TRUSTEE"/"U.S. TRUSTEE" is instead
 * caught by ADMINISTRATIVE_MARKER_PHRASES' own "u\.?\s*s\.?\s*trustee" entry, which only strips
 * when "trustee" follows, never as a bare initials pair that could also match a real company/
 * entity name's first word once split on periods (a real business name like "U.S. AGGREGATES" was
 * wrongly flagged as not-a-person by an earlier, single-character-inclusive version of this set).
 * Likewise excludes "fake" - a real surname - see FAKE_IDENTITY_PATTERN above for how "I. M. FAKE"
 * is caught instead, as one whole-identity phrase. The entries below were checked against the full
 * matched+ambiguous+no-match population, against the RAW fullName this function actually runs on,
 * with zero false positives - isLikelyNotAPerson requires EVERY word in fullName to be in this
 * set, so a real name with even one genuine name-shaped word (e.g. "R. Jordan Doe") never matches
 * regardless of how many short/common words sit alongside it. Catches "REOPENED CASE", "OLD
 * CASE/NO TR ASSIGNED",
 * "INVOLUNTARY [TRUSTEE|PETITION]", "NONE ASSIGNED (DEBTOR IN POSS)", and "OFFICE OF THE [U.S.
 * TRUSTEE]" (via office/of/the/united/states/trustee together, since u.s. trustee is itself
 * stripped by ADMINISTRATIVE_MARKER_PHRASES first). Also catches case-status placeholders like
 * "TRUSTEE UNASSIGNED", "TRANSFER CASE", "MISSING TRUSTEE", "TRUSTEE ASSIGNMENT IN PROGRESS", "CASE STRICKEN: NO TRUSTEE" (see
 * stripAdministrativeMarkers' own colon-stripping note), and "PRO SE" (a litigant representing
 * themselves, not a trustee). */
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
]);

/**
 * Strips known administrative marker phrases (see ADMINISTRATIVE_MARKER_PHRASES) from a name
 * part, collapsing whitespace and trimming leftover punctuation. Applied to both firstName and
 * lastName before either is used for matching or the isLikelyNotAPerson check.
 *
 * Parens are stripped unconditionally, not just when they wrap a matched marker phrase (unlike
 * ADMINISTRATIVE_MARKER_PATTERN's own `\(?...\)?`, which only removes parens immediately
 * surrounding a marker it actually matched) - parens already only ever appear in this codebase's
 * ACMS data as administrative-annotation delimiters ("(NP)", "(TR)", "(DO NOT USE)"), never as
 * legitimate name punctuation, so a bare parenthesized aside with no recognized marker phrase
 * inside (e.g. "(DEBTOR IN POSS)") should still lose its parens before the word-by-word
 * isLikelyNotAPerson check runs - otherwise "(debtor"/"poss)" never match the bare words
 * "debtor"/"poss" in NON_PERSON_ONLY_WORDS at all ("NONE ASSIGNED (DEBTOR IN POSS)" was wrongly
 * left unmatched before this was added). A colon is stripped for the same reason ("CASE STRICKEN:
 * NO TRUSTEE" would otherwise leave "stricken:" un-matchable against the bare word "stricken").
 */
export function stripAdministrativeMarkers(value: string): string {
  return value
    .replace(ADMINISTRATIVE_MARKER_PATTERN, ' ')
    .replace(/[-/*.,():_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * After stripping known markers from a full name, determines whether what's left is still just
 * administrative/role text (an office, a case-processing label) rather than any real person's
 * name - e.g. "UNITED STATES TRUSTEE'S OFFICE" or "APPT AS TRUSTEE" / "UNITED STATES TRUSTEE"
 * have no marker-phrase to strip (nothing in ADMINISTRATIVE_MARKER_PHRASES matches), yet are
 * clearly not a person. True when EVERY word in the stripped name is a known non-person word (see
 * NON_PERSON_ONLY_WORDS) or empty - a single real name-shaped word anywhere is enough evidence of
 * a real person to proceed with matching.
 */
function isLikelyNotAPerson(strippedFullName: string): boolean {
  const words = strippedFullName.toLowerCase().replaceAll("'", '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  return words.every((word) => NON_PERSON_ONLY_WORDS.has(word));
}

/**
 * Whether an ACMS record's RAW, un-atomized fullName (firstName + middleInitial + lastName,
 * exactly as ACMS composed it - see toAcmsTrusteeProfessional) names no real person at all - an
 * administrative placeholder, case-status label, or well-known synthetic test record, rather than
 * a real trustee identity. This is the pipeline's earliest possible check, run as a prefilter
 * BEFORE normalizeAcmsSourceName's own recovery/reduction runs (see skipAdministrativePlaceholder
 * in trustee-match-pipeline-stages.ts, its sole real caller) - checking the untouched original
 * text is what lets one literal pattern (FAKE_IDENTITY_PATTERN) or word-list (NON_PERSON_ONLY_
 * WORDS) catch a signal regardless of which ACMS field it landed in or how later stages would
 * have redistributed it (see FAKE_IDENTITY_PATTERN's own doc comment for a concrete case this
 * fixed). Exported so callers that need to replicate this decision outside the pipeline (e.g. a
 * backtest) can call the real function rather than hand-duplicating ADMINISTRATIVE_MARKER_PHRASES/
 * NON_PERSON_ONLY_WORDS/FAKE_IDENTITY_PATTERN and risking drift.
 */
export function shouldSkipAsNotAPerson(fullName: string): boolean {
  if (REOPENED_WITH_PAREN_PATTERN.test(fullName.trim())) return true;
  const stripped = stripAdministrativeMarkers(fullName);
  if (FAKE_IDENTITY_PATTERN.test(stripped)) return true;
  return isLikelyNotAPerson(stripped);
}
