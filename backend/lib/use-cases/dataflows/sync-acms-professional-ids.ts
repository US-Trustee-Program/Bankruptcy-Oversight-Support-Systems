import { randomUUID } from 'node:crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import {
  AcmsActiveAppointment,
  AcmsProfessionalIdSyncState,
  AcmsTrusteeProfessionalDetailRecord,
} from '../gateways.types';
import { TrusteeVariation } from '@common/cams/trustee-variation';
import { ACMS_SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { buildAcmsVariant, formatAcmsZip } from './acms-trustee-variant.helpers';
import { formatCityStateZipCountry } from '../../adapters/utils/string-helper';
import { computeFingerprint } from './trustee-variant.helpers';
import { AcmsTrusteeProfessional } from '@common/cams/dataflow-events';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';
import { runTrusteeMatchPipeline } from './trustee-match-pipeline-orchestrator';
import { serializeState, TrusteeSerializedState } from './trustee-match-pipeline';
import {
  createLinkedStateWithoutEvidence,
  deriveDisposition,
  deriveSuspectDuplicateCamsTrustee,
  TrusteeProfessionalId,
} from './trustee-professional-ids.types';

const ACMS_PROFESSIONAL_ID_SYNC_STATE = 'ACMS_PROFESSIONAL_ID_SYNC_STATE' as const;

function createDeps(context: ApplicationContext) {
  return {
    context,
    acmsGateway: factory.getAcmsGateway(context),
    officesGateway: factory.getOfficesGateway(context),
    trusteesRepo: factory.getTrusteesRepository(context),
    variationRepo: factory.getTrusteeVariationRepository(context),
    professionalIdsRepo: factory.getTrusteeProfessionalIdsRepository(context),
    runtimeStateRepo: factory.getRuntimeStateRepository<AcmsProfessionalIdSyncState>(context),
  };
}

type SyncAcmsProfessionalIdsDeps = ReturnType<typeof createDeps>;

/**
 * Enumerates every GROUP_DESIGNATOR the CMMPR paged query needs to be called for, by reusing
 * CAMS's existing offices data (UstpGroup.groupDesignator, sourced from DXTR's
 * AO_GRP_DES/AO_CS_DIV.GRP_DES — itself a live mirror of ACMS's CMMGD group list) rather than
 * adding a new ACMS query solely to enumerate groups.
 */
async function getGroupDesignators(deps: SyncAcmsProfessionalIdsDeps): Promise<string[]> {
  const offices = await deps.officesGateway.getOffices(deps.context);
  const groupDesignators = new Set<string>();
  for (const office of offices) {
    for (const group of office.groups) {
      groupDesignators.add(group.groupDesignator);
    }
  }
  return Array.from(groupDesignators);
}

/**
 * Resolves a single group's UST_PROF_CODE bookmark out of the shared per-group map document.
 * `purge` forces a fresh zero bookmark for this group regardless of persisted state
 * (first-run-style full backfill for this group only — other groups' bookmarks are untouched);
 * otherwise falls back to a fresh zero bookmark only when no state has been persisted yet, the
 * read fails, or this group has no entry yet in the map.
 */
async function resolveSyncState(
  deps: SyncAcmsProfessionalIdsDeps,
  groupDesignator: string,
  purge?: boolean,
): Promise<AcmsProfessionalIdSyncState> {
  const freshState: AcmsProfessionalIdSyncState = {
    id: randomUUID(),
    documentType: ACMS_PROFESSIONAL_ID_SYNC_STATE,
    lastUstProfCodeByGroup: { [groupDesignator]: 0 },
  };
  if (purge) {
    return freshState;
  }
  try {
    const persisted = await deps.runtimeStateRepo.read(ACMS_PROFESSIONAL_ID_SYNC_STATE);
    return {
      ...persisted,
      lastUstProfCodeByGroup: {
        [groupDesignator]: persisted.lastUstProfCodeByGroup[groupDesignator] ?? 0,
      },
    };
  } catch (_error) {
    return freshState;
  }
}

/**
 * Best-effort bookmark persistence for a single group — errors are logged, not thrown,
 * mirroring sync-trustee-case-appointments.ts's storeRuntimeState (a failed bookmark advance
 * should not fail an otherwise-successful sync run; the next run simply resumes from the prior
 * bookmark). Uses an atomic dotted-path $set (RuntimeStateRepository.setField) rather than a
 * read-modify-write of the whole shared document, so two groups finishing concurrently can
 * never clobber each other's bookmark.
 */
async function storeRuntimeState(
  deps: SyncAcmsProfessionalIdsDeps,
  state: AcmsProfessionalIdSyncState,
): Promise<void> {
  const [groupDesignator, lastUstProfCode] = Object.entries(state.lastUstProfCodeByGroup)[0];
  try {
    await deps.runtimeStateRepo.setField(
      ACMS_PROFESSIONAL_ID_SYNC_STATE,
      `lastUstProfCodeByGroup.${groupDesignator}`,
      lastUstProfCode,
    );
  } catch (originalError) {
    deps.context.logger.error(
      'SYNC-ACMS-PROFESSIONAL-IDS',
      `Failed to persist ACMS professional ID sync state for group ${groupDesignator}: ${originalError}`,
    );
  }
}

type LinkOutcome = { kind: 'auto-linked'; trusteeId: string };

type FingerprintMatchResult = { kind: 'no-match' } | LinkOutcome;

function findByVariant<T extends { variant: string }>(bucket: T[], variant: string): T | undefined {
  return bucket.find((v) => v.variant === variant);
}

/**
 * A genuine conflict is a different CAMS trustee already holding this ACMS professional ID -
 * looked up directly against prior writes rather than inferred from a unique-index violation,
 * since acmsProfessionalId -> camsTrusteeId is not enforced as globally unique at the database
 * layer. Only a prior auto-linked (non-conflicting) record counts.
 */
async function findExistingConflict(
  deps: SyncAcmsProfessionalIdsDeps,
  acmsProfessionalId: string,
  candidateTrusteeId: string,
): Promise<string | undefined> {
  const existing = await deps.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
  const conflicting = existing.find((link) => link.camsTrusteeId !== candidateTrusteeId);
  return conflicting?.camsTrusteeId;
}

/**
 * Checks the TRUSTEE_VARIATION fingerprint bucket for a match (the same bucket
 * sync-trustee-case-appointments.ts populates from DXTR trustee events — fingerprints computed
 * from equivalent demographic data collide regardless of source).
 */
async function processFingerprintMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  fingerprint: string,
  variant: string,
): Promise<FingerprintMatchResult> {
  const bucket: TrusteeVariation[] = await deps.variationRepo.findByFingerprint(fingerprint);
  const match = findByVariant(bucket, variant);
  if (!match) {
    return { kind: 'no-match' };
  }
  return { kind: 'auto-linked', trusteeId: match.trusteeId };
}

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
 * "TRUSTEE UNASSIGNED", "TRANSFER CASE", "MISSING TRUSTEE", and "TRUSTEE ASSIGNMENT IN PROGRESS". */
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
 * left unmatched before this was added).
 */
export function stripAdministrativeMarkers(value: string): string {
  return value
    .replace(ADMINISTRATIVE_MARKER_PATTERN, ' ')
    .replace(/[-/*.,()_]+/g, ' ')
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

/**
 * Composes the legacy (ACMS-side address/phone/fax) block the same way
 * cases.dxtr.gateway.ts's dxtrTrustee construction composes DXTR's equivalent - reusing the same
 * formatCityStateZipCountry/formatAcmsZip helpers buildAcmsVariant already uses for the persisted
 * variant string, so this stays in sync with that composition rather than drifting from it.
 * Returns undefined (not an all-undefined object) when the record has no address/phone/fax data
 * at all, mirroring AcmsTrusteeProfessional.legacy's own optionality.
 */
function toAcmsLegacy(
  record: AcmsTrusteeProfessionalDetailRecord,
): AcmsTrusteeProfessional['legacy'] {
  const cityStateZipCountry = formatCityStateZipCountry(
    record.city,
    record.state,
    formatAcmsZip(record.zip),
    undefined,
  );
  if (
    !record.address1 &&
    !record.address2 &&
    !cityStateZipCountry &&
    !record.phone &&
    !record.fax
  ) {
    return undefined;
  }
  return {
    address1: record.address1,
    address2: record.address2,
    cityStateZipCountry,
    phone: record.phone,
    fax: record.fax,
  };
}

/**
 * Faithful, near-1:1 projection of a CMMPR record - deliberately does NOT recover/strip/split
 * anything (see normalizeAcmsSourceName in trustee-match-pipeline-stages.ts for that logic).
 * firstName/middleName/lastName here are CMMPR's raw PROF_FIRST_NAME/PROF_MI/PROF_LAST_NAME
 * values, exactly as ACMS recorded them, including any administrative markers or data-quality
 * corruption - the pipeline's NORMALIZE stage is the only place that recovers a usable name from
 * them, writing its result to state.sourceNormalized so both the raw and normalized forms stay
 * independently visible in the persisted state graph, rather than the recovered name silently
 * becoming the only name any later stage or reviewer can see.
 */
function toAcmsTrusteeProfessional(
  record: AcmsTrusteeProfessionalDetailRecord,
): AcmsTrusteeProfessional {
  const fullName = [record.firstName, record.middleInitial, record.lastName]
    .filter(Boolean)
    .join(' ');
  return {
    firstName: record.firstName,
    middleName: record.middleInitial,
    lastName: record.lastName,
    fullName,
    legacy: toAcmsLegacy(record),
  };
}

/**
 * Runs the ACMS-sourced record through runTrusteeMatchPipeline, the same pipeline instantiation
 * DXTR trustee-appointment matching uses (see trustee-match-pipeline-orchestrator.ts). A transient
 * pipeline error (state.error set to a TooManyRequestsError/GatewayTimeoutError) is rethrown here
 * rather than absorbed - the caller (processOneRecord, then handlePage) needs the throw to reach
 * its existing page-level retry-from-original-bookmark handling, since nothing about this record
 * caused the failure and a retry with a fresh pipeline run may well succeed. Any other outcome
 * (a resolved match, a skip, a terminal error, or an unresolved candidate pool) returns normally -
 * the caller reads state.match/state.skip/state.error/state.candidates directly rather than a
 * separate summary type.
 */
async function processNameMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<TrusteeSerializedState> {
  const acmsTrusteeProfessional = toAcmsTrusteeProfessional(record);
  const state = await runTrusteeMatchPipeline(deps.context, acmsTrusteeProfessional);

  if (state.error && isTransientInfraError(state.error)) {
    throw state.error;
  }

  return serializeState(state);
}

/**
 * The active-appointment gate for the no-match/ambiguous outcomes (conflict always writes, see
 * writeErroredProfessionalId's caller). Zero active CMMAP appointments for this professional
 * means there's no urgency to resolve their identity right now, so nothing is written; one or
 * more means an errored professional-id record is always written.
 */
async function hasActiveAppointments(
  deps: SyncAcmsProfessionalIdsDeps,
  groupDesignator: string,
  ustProfCode: number,
): Promise<boolean> {
  const activeAppointments: AcmsActiveAppointment[] =
    await deps.acmsGateway.getActiveAppointmentsForProfessional(
      deps.context,
      groupDesignator,
      ustProfCode,
    );
  return activeAppointments.length > 0;
}

/**
 * Writes one TrusteeProfessionalId, composed directly from a TrusteeSerializedState, keyed by
 * camsTrusteeId - the resolved trusteeId on an auto-linked disposition, or the ACMS variant's
 * fingerprint otherwise. conflictingTrusteeId/disposition override, when set, replace the
 * state-derived disposition (see findExistingConflict's caller): a match that collides with an
 * existing, differently-owned link is a data-integrity problem, not a clean auto-link.
 * suspectDuplicateCamsTrustee is independent of disposition - see its own doc comment on
 * TrusteeProfessionalId.
 */
async function writeProfessionalId(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  state: TrusteeSerializedState,
  conflictingTrusteeId?: string,
): Promise<TrusteeProfessionalId> {
  const disposition = conflictingTrusteeId ? 'conflict' : deriveDisposition(state);
  const camsTrusteeId = state.match?.trusteeId ?? fingerprint;

  return deps.professionalIdsRepo.upsertProfessionalId(
    {
      documentType: 'TRUSTEE_PROFESSIONAL_ID',
      camsTrusteeId,
      acmsProfessionalId: record.acmsProfessionalId,
      disposition,
      suspectDuplicateCamsTrustee:
        disposition === 'ambiguous' ? deriveSuspectDuplicateCamsTrustee(state) : undefined,
      evidence: { ...state, variant, conflictingTrusteeId },
    },
    ACMS_SYSTEM_USER_REFERENCE,
  );
}

/**
 * Wipes all existing professional ID mappings AND deletes the sync bookmark document — used by
 * the purge StartMessage flag for a genuine full reset. Deleting the bookmark, rather than merely
 * bypassing it (see resolveSyncState's own purge parameter, which still needs its own separate
 * per-group propagation — see PageMessage.purge in the function app), means there is nothing
 * stale left in the runtime-state collection for a later, non-purge run to accidentally read.
 */
async function purgeAll(deps: SyncAcmsProfessionalIdsDeps): Promise<void> {
  await deps.professionalIdsRepo.deleteAll();
  await deps.runtimeStateRepo.delete(ACMS_PROFESSIONAL_ID_SYNC_STATE);
}

type GateOutcome = 'skipped' | 'written';

type ProcessOneRecordOutcome =
  | { kind: 'auto-linked'; via: 'fingerprint' | 'name' }
  | { kind: 'conflict'; via: 'fingerprint' | 'name' }
  | {
      kind: 'no-match' | 'ambiguous' | 'error' | 'skipped-not-a-person';
      gated: GateOutcome;
    };

/**
 * The full per-record decision tree: fingerprint match first (cheapest real lookup, most
 * confident), then on a miss, the real matching pipeline - which itself detects an
 * administrative placeholder (see skipAdministrativePlaceholder in
 * trustee-match-pipeline-stages.ts) as its own first stage, rather than this function checking
 * for one beforehand. A resolved match that collides with a different trustee already holding
 * this ACMS id is reported as a conflict, always written (bypassing the active-appointment gate -
 * a data-integrity problem is always worth recording). Every other outcome (no-match, ambiguous,
 * skipped, terminal error) routes through the active-appointment gate identically, so each
 * carries the same evidence-persistence guarantee. Returns a summary outcome so the caller
 * (handlePage) can aggregate per-page telemetry.
 */
async function processOneRecord(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<ProcessOneRecordOutcome> {
  const variant = buildAcmsVariant(record);
  const fingerprint = computeFingerprint(variant);

  const fingerprintResult = await processFingerprintMatch(deps, fingerprint, variant);
  if (fingerprintResult.kind === 'auto-linked') {
    return processResolvedFingerprintMatch(deps, record, fingerprint, variant, fingerprintResult);
  }

  const state = await processNameMatch(deps, record);

  if (state.match) {
    return processResolvedNameMatch(deps, record, fingerprint, variant, state);
  }

  const gated = await applyActiveAppointmentGate(deps, record, fingerprint, variant, state);

  if (state.skip) {
    return { kind: 'skipped-not-a-person', gated };
  }
  if (state.error) {
    return { kind: 'error', gated };
  }
  const disposition = deriveDisposition(state);
  if (disposition === 'ambiguous') {
    return { kind: 'ambiguous', gated };
  }
  return { kind: 'no-match', gated };
}

async function processResolvedFingerprintMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  fingerprintResult: LinkOutcome,
): Promise<ProcessOneRecordOutcome> {
  const existingTrusteeId = await findExistingConflict(
    deps,
    record.acmsProfessionalId,
    fingerprintResult.trusteeId,
  );
  const emptyState = createLinkedStateWithoutEvidence(
    toAcmsTrusteeProfessional(record),
    fingerprintResult.trusteeId,
  );
  if (existingTrusteeId) {
    await writeProfessionalId(deps, record, fingerprint, variant, emptyState, existingTrusteeId);
    return { kind: 'conflict', via: 'fingerprint' };
  }

  await writeProfessionalId(deps, record, fingerprint, variant, emptyState);
  return { kind: 'auto-linked', via: 'fingerprint' };
}

async function processResolvedNameMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  state: TrusteeSerializedState,
): Promise<ProcessOneRecordOutcome> {
  const trusteeId = state.match!.trusteeId;
  const existingTrusteeId = await findExistingConflict(deps, record.acmsProfessionalId, trusteeId);
  if (existingTrusteeId) {
    await writeProfessionalId(deps, record, fingerprint, variant, state, existingTrusteeId);
    return { kind: 'conflict', via: 'name' };
  }

  await writeProfessionalId(deps, record, fingerprint, variant, state);
  return { kind: 'auto-linked', via: 'name' };
}

/**
 * Zero active CMMAP appointments for this professional means there's no urgency to resolve their
 * identity right now, so nothing is written; one or more means the pipeline's evidence is always
 * written, regardless of outcome (no-match, ambiguous, or a terminal pipeline error).
 */
async function applyActiveAppointmentGate(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  state: TrusteeSerializedState,
): Promise<GateOutcome> {
  const groupDesignator = record.acmsProfessionalId.split('-')[0];
  const active = await hasActiveAppointments(deps, groupDesignator, record.ustProfCode);
  if (!active) {
    return 'skipped';
  }
  await writeProfessionalId(deps, record, fingerprint, variant, state);
  return 'written';
}

const SyncAcmsProfessionalIds = {
  createDeps,
  getGroupDesignators,
  resolveSyncState,
  storeRuntimeState,
  processFingerprintMatch,
  processNameMatch,
  purgeAll,
  processOneRecord,
};

export default SyncAcmsProfessionalIds;
