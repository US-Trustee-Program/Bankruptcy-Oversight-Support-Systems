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
import {
  matchTrusteeByName,
  resolveByContactCorroboration,
  resolveDuplicateNameCandidates,
  findTokenIntersectionCandidates,
  findAnchoredLevenshteinCandidates,
  findSurnameExactCandidates,
  filterNoisyStateMismatches,
  toUnscoredCandidates,
  STATE_FILTER_POOL_SIZE_THRESHOLD,
} from './trustee-match.helpers';
import { buildAcmsVariant, formatAcmsZip } from './acms-trustee-variant.helpers';
import { formatCityStateZipCountry } from '../../adapters/utils/string-helper';
import { computeFingerprint } from './trustee-variant.helpers';
import { AcmsTrusteeProfessional, CandidateScore } from '@common/cams/dataflow-events';
import { TrusteeProfessionalIdError } from '@common/cams/trustee-professional-ids';

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

type NameMatchResult =
  { kind: 'no-match' } | { kind: 'ambiguous'; matchCandidates: CandidateScore[] } | LinkOutcome;

function findByVariant<T extends { variant: string }>(bucket: T[], variant: string): T | undefined {
  return bucket.find((v) => v.variant === variant);
}

/**
 * Links the ACMS professional ID to the given trustee via TrusteeProfessionalIdsMongoRepository.
 * acmsProfessionalId -> camsTrusteeId is no longer enforced as globally unique (that would reject
 * a second CAMS trustee resolving to the same ACMS id, which is a conflict to report, not an
 * error to throw) — the caller checks for an existing, differently-owned link itself via
 * findExistingConflict before calling this.
 */
async function linkTrustee(
  deps: SyncAcmsProfessionalIdsDeps,
  trusteeId: string,
  acmsProfessionalId: string,
): Promise<LinkOutcome> {
  await deps.professionalIdsRepo.createProfessionalId(
    trusteeId,
    acmsProfessionalId,
    ACMS_SYSTEM_USER_REFERENCE,
  );
  return { kind: 'auto-linked', trusteeId };
}

/**
 * A genuine conflict is a different CAMS trustee already holding this ACMS professional ID —
 * looked up directly rather than inferred from a unique-index violation, since
 * acmsProfessionalId -> camsTrusteeId is no longer enforced as globally unique at the database
 * layer (see linkTrustee). Ignores any existing errored (unmatched) records for this ACMS id —
 * only a real, previously-resolved link counts as a conflict.
 */
async function findExistingConflict(
  deps: SyncAcmsProfessionalIdsDeps,
  acmsProfessionalId: string,
  candidateTrusteeId: string,
): Promise<string | undefined> {
  const existing = await deps.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
  const conflicting = existing.find(
    (link) => !link.error && link.camsTrusteeId !== candidateTrusteeId,
  );
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
function splitCompoundFirstName(
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
 * contains one. Confirmed via a CAMS-879 backtest to cover two distinct real shapes, handled
 * differently:
 *
 * 1. Whole-name-in-lastName (e.g. PROF_FIRST_NAME="TACOMACH13", a mangled city+chapter code,
 *    PROF_LAST_NAME="K. MICHAEL FITZGERALD" - the trustee's entire real name): when lastName has
 *    2+ space-separated tokens, it's treated as the real "firstName [middleName] lastName" and
 *    re-derived from it wholesale - the corrupted firstName is discarded entirely, since it never
 *    held any real name data to begin with.
 * 2. Trailing-junk-only (e.g. PROF_FIRST_NAME="WALTER 12,13" with a clean PROF_LAST_NAME=
 *    "O'CHESKEY" - a real trustee's chapter-number annotation glued onto an otherwise-correct
 *    firstName): when lastName is already a single clean token, re-deriving from it would destroy
 *    a value that was never corrupted, so only firstName's first token is kept.
 *
 * Left untouched (both fields as-is) when firstName has no digit, or when there's no usable
 * recovery target (firstName has a digit but reduces to nothing usable and lastName is also a
 * single token) - a record with no real name signal on either side (e.g. an ACMS batch-upload
 * placeholder) should be left for matching to correctly find no-match, not forced into a guess.
 */
function recoverCorruptedFirstName(
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
 * Known administrative/placeholder phrases ACMS records carry instead of, or alongside, a real
 * trustee name - a "this professional-id code is deprecated/superseded" marker, not part of
 * anyone's real name. Confirmed via a CAMS-879 backtest survey of every marker-bearing record in
 * a real staging export. Deliberately excludes standalone role words like "trustee"/"office"/
 * "code"/"case" from this list - those only signal "not a person" when they're ALL that's left
 * after stripping (see isLikelyNotAPerson), but stripping them unconditionally here would also
 * mangle a real surname that happens to contain one as a substring.
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
];

const ADMINISTRATIVE_MARKER_PATTERN = new RegExp(
  `\\(?\\s*(${ADMINISTRATIVE_MARKER_PHRASES.join('|')})\\s*\\)?`,
  'gi',
);

/** Bare words that, once every ADMINISTRATIVE_MARKER_PHRASES marker is stripped, indicate
 * whatever is left is STILL administrative text describing a role/case rather than a person's
 * name (e.g. "UNITED STATES TRUSTEE" -> stripped to itself, unchanged, since none of its words
 * are markers - but "trustee" alone is not a surname). Used only by isLikelyNotAPerson's
 * word-by-word check, never to strip text from a name that will proceed to matching. */
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
]);

/**
 * Strips known administrative marker phrases (see ADMINISTRATIVE_MARKER_PHRASES) from a name
 * part, collapsing whitespace and trimming leftover punctuation. Applied to both firstName and
 * lastName before either is used for matching or the isLikelyNotAPerson check.
 */
function stripAdministrativeMarkers(value: string): string {
  return value
    .replace(ADMINISTRATIVE_MARKER_PATTERN, ' ')
    .replace(/[-/*.,]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * After stripping known markers from both name parts, determines whether what's left is still
 * just administrative/role text (an office, a case-processing label) rather than any real
 * person's name - e.g. "UNITED STATES TRUSTEE'S OFFICE" or "APPT AS TRUSTEE" / "UNITED STATES
 * TRUSTEE" have no marker-phrase to strip (nothing in ADMINISTRATIVE_MARKER_PHRASES matches), yet
 * are clearly not a person. True when EVERY word in the stripped firstName+lastName is either a
 * known non-person word (see NON_PERSON_ONLY_WORDS) or empty - a single real name-shaped word on
 * either side is enough evidence of a real person to proceed with matching.
 */
function isLikelyNotAPerson(strippedFirstName: string, strippedLastName: string): boolean {
  const words = `${strippedFirstName} ${strippedLastName}`
    .toLowerCase()
    .replaceAll("'", '')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;
  return words.every((word) => NON_PERSON_ONLY_WORDS.has(word));
}

/**
 * Public composition of stripAdministrativeMarkers + isLikelyNotAPerson - the exact check
 * processOneRecord runs before attempting any match at all (see that function). Exported so
 * callers that need to replicate this decision outside processOneRecord (e.g. a backtest
 * replaying the real matching pipeline) can call the real function rather than hand-duplicating
 * ADMINISTRATIVE_MARKER_PHRASES/NON_PERSON_ONLY_WORDS and risking drift.
 */
export function shouldSkipAsNotAPerson(firstName: string, lastName: string): boolean {
  return isLikelyNotAPerson(
    stripAdministrativeMarkers(firstName),
    stripAdministrativeMarkers(lastName),
  );
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

export function toAcmsTrusteeProfessional(
  record: AcmsTrusteeProfessionalDetailRecord,
): AcmsTrusteeProfessional {
  const strippedFirstName = stripAdministrativeMarkers(record.firstName);
  const strippedLastName = stripAdministrativeMarkers(record.lastName);
  const recovered = recoverCorruptedFirstName(strippedFirstName, strippedLastName);
  const { firstName, middleName } = splitCompoundFirstName(
    recovered.firstName,
    record.middleInitial,
  );
  const fullName = [record.firstName, record.middleInitial, record.lastName]
    .filter(Boolean)
    .join(' ');
  return {
    firstName,
    middleName,
    lastName: recovered.lastName,
    fullName,
    legacy: toAcmsLegacy(record),
  };
}

/**
 * Attempts to resolve a raw candidate trusteeId list via the two shared, non-appointment-gated
 * corroboration primitives, in order: resolveByContactCorroboration first (exactly one candidate
 * clears the name bar, corroborated by address/phone/email or the no-contradiction fallback), then
 * resolveDuplicateNameCandidates only if that leaves MULTIPLE candidates (checks whether they're
 * likely the same real person recorded twice in the trustees collection). Extracted so both
 * matchTrusteeByName's 'ambiguous' result and findTokenIntersectionCandidates' raw candidate list
 * can share the exact same resolution sequence rather than duplicating it.
 */
async function resolveCandidatesByCorroboration(
  context: SyncAcmsProfessionalIdsDeps['context'],
  acmsTrusteeProfessional: AcmsTrusteeProfessional,
  candidateTrusteeIds: string[],
): Promise<string | null> {
  if (candidateTrusteeIds.length === 0) return null;

  const corroboration = await resolveByContactCorroboration(
    context,
    acmsTrusteeProfessional,
    candidateTrusteeIds,
  );
  if (corroboration.kind === 'resolved') {
    return corroboration.trusteeId;
  }

  const duplicateResolution = await resolveDuplicateNameCandidates(
    context,
    acmsTrusteeProfessional,
    candidateTrusteeIds,
  );
  if (duplicateResolution.kind === 'resolved-duplicate') {
    return duplicateResolution.trusteeId;
  }

  return null;
}

/**
 * Falls through from a fingerprint miss to CAMS's existing name-matching logic
 * (matchTrusteeByName), reused as-is with the same thresholds as the DXTR sync.
 *
 * Unlike sync-trustee-case-appointments.ts, an ambiguous match here is NOT further resolved via
 * resolveNameCollisionByScoring: that function hard-requires a case-appointment event
 * (caseId/courtId/courtDivisionCode/chapter) to score candidates against active appointments,
 * none of which exist for a standalone ACMS professional record. Instead, both the 'ambiguous' and
 * 'no-match' outcomes are given more chances via shared, non-appointment-gated primitives before
 * falling back to their default disposition for human/automated review:
 *   - 'ambiguous': routed through resolveCandidatesByCorroboration directly against
 *     matchTrusteeByName's own raw candidates.
 *   - 'no-match': two LAST-RESORT candidate-discovery steps are tried in sequence, each only after
 *     the previous one found nothing, before also routing through resolveCandidatesByCorroboration:
 *     1. findTokenIntersectionCandidates - name-part REORDERING (e.g. going by a middle name, a
 *        lastName with an internal space).
 *     2. findAnchoredLevenshteinCandidates - genuine SPELLING errors (a typo or transposition in
 *        either name part) - a different failure shape token-intersection's exact-substring
 *        requirement cannot catch.
 *     Both are deliberately gated behind matchTrusteeByName (and each other) already returning
 *     nothing — each issues its own extra query per attempt and must never run speculatively
 *     alongside the cheaper tiers.
 *
 * findSurnameExactCandidates', findTokenIntersectionCandidates', and
 * findAnchoredLevenshteinCandidates' raw candidate pools are each passed through
 * filterNoisyStateMismatches before corroboration - a candidate-elimination filter, not a scoring
 * change, that only activates once a pool is already large enough for state to be a useful
 * discriminator (see filterNoisyStateMismatches for the pool-size threshold and the override
 * conditions that keep a state-mismatched candidate in the pool anyway).
 */
async function processNameMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<NameMatchResult> {
  const acmsTrusteeProfessional = toAcmsTrusteeProfessional(record);

  // Cheapest, most authoritative gate first: narrow to trustees sharing an EXACT lastName token
  // (see findSurnameExactCandidates) before any of the fuzzier tiers below ever see the candidate
  // pool. When this finds nothing, fall through unchanged to matchTrusteeByName and the rest of
  // this function - a genuine name-part reordering or spelling error still needs those tiers, and
  // an empty result here says nothing about whether one applies. When it finds 1+ candidates,
  // those become the ONLY pool passed to corroboration - matchTrusteeByName's own (broader,
  // phonetic/fuzzy) candidate list is not also unioned in, since every candidate it could add here
  // is, by construction, someone calculateNameScore's own lastName gate was always going to reject
  // anyway (see CAMS-879 backtest finding: ACMS "Phillip A Moon" resolving against a 13-candidate
  // phonetic pool that included Mann/Mooney/Wyman/Khorrami alongside the two actual "Moon"s).
  const surnameExactCandidates = filterNoisyStateMismatches(
    acmsTrusteeProfessional,
    await findSurnameExactCandidates(deps.context, acmsTrusteeProfessional),
  );
  if (surnameExactCandidates.length > 0) {
    const resolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      surnameExactCandidates.map((t) => t.trusteeId),
    );
    if (resolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: resolvedTrusteeId };
    }
    return {
      kind: 'ambiguous',
      matchCandidates: toUnscoredCandidates(surnameExactCandidates),
    };
  }

  const result = await matchTrusteeByName(deps.context, acmsTrusteeProfessional);

  if (result.kind === 'ambiguous') {
    // matchTrusteeByName's ambiguous result only carries CandidateScore[] (no structured
    // firstName/middleName/lastName - just a composed trusteeName string), so
    // filterNoisyStateMismatches can't run directly against it the way it does for the other
    // three tiers' raw Trustee[] pools. Re-fetching by id is real extra DB load, so it's only
    // worth paying once the pool is already large enough for the filter to activate at all (see
    // STATE_FILTER_POOL_SIZE_THRESHOLD) - a typical small ambiguous group skips this entirely.
    let candidateTrusteeIds = result.matchCandidates.map((c) => c.trusteeId);
    if (candidateTrusteeIds.length > STATE_FILTER_POOL_SIZE_THRESHOLD) {
      const rawCandidates = await deps.trusteesRepo.findTrusteesByIds(candidateTrusteeIds);
      candidateTrusteeIds = filterNoisyStateMismatches(acmsTrusteeProfessional, rawCandidates).map(
        (t) => t.trusteeId,
      );
    }
    const resolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    if (resolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: resolvedTrusteeId };
    }

    // matchTrusteeByName's candidates all failed corroboration/duplicate resolution - one more
    // chance via a genuine spelling variant (see findAnchoredLevenshteinCandidates), reusing the
    // same tier the no-match branch already relies on rather than duplicating its edit-distance
    // logic. A real-world example: matchTrusteeByName's lastName-token search finds "Radokovich"
    // as the sole candidate for ACMS "RADAKOVICH" - calculateNameScore's exact-first-token
    // lastName comparison scores that pair 0 regardless of how well address/phone corroborate, so
    // resolveByContactCorroboration never even gets a qualifying candidate.
    const anchoredLevenshteinCandidates = filterNoisyStateMismatches(
      acmsTrusteeProfessional,
      await findAnchoredLevenshteinCandidates(deps.context, acmsTrusteeProfessional),
    );
    const anchoredLevenshteinResolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      anchoredLevenshteinCandidates.map((t) => t.trusteeId),
    );
    if (anchoredLevenshteinResolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: anchoredLevenshteinResolvedTrusteeId };
    }

    return { kind: 'ambiguous', matchCandidates: result.matchCandidates };
  }

  if (result.kind === 'no-match') {
    const tokenIntersectionCandidates = filterNoisyStateMismatches(
      acmsTrusteeProfessional,
      await findTokenIntersectionCandidates(deps.context, acmsTrusteeProfessional),
    );
    const tokenIntersectionResolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      tokenIntersectionCandidates.map((t) => t.trusteeId),
    );
    if (tokenIntersectionResolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: tokenIntersectionResolvedTrusteeId };
    }

    const anchoredLevenshteinCandidates = filterNoisyStateMismatches(
      acmsTrusteeProfessional,
      await findAnchoredLevenshteinCandidates(deps.context, acmsTrusteeProfessional),
    );
    const anchoredLevenshteinResolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      anchoredLevenshteinCandidates.map((t) => t.trusteeId),
    );
    if (anchoredLevenshteinResolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: anchoredLevenshteinResolvedTrusteeId };
    }

    return { kind: 'no-match' };
  }

  return { kind: 'auto-linked', trusteeId: result.trusteeId };
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
 * Writes the unmatched/ambiguous/conflicting outcome as a TrusteeProfessionalId record keyed by
 * the ACMS variant's fingerprint in place of a real trusteeId, decorated with the raw variant and
 * an `error` disposition so it can be found and healed later — see
 * TrusteeProfessionalIdsRepository.createErroredProfessionalId.
 */
async function writeErroredProfessionalId(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  error: TrusteeProfessionalIdError,
): Promise<void> {
  await deps.professionalIdsRepo.createErroredProfessionalId(
    fingerprint,
    record.acmsProfessionalId,
    variant,
    error,
    ACMS_SYSTEM_USER_REFERENCE,
  );
}

/** Wipes all existing professional ID mappings — used by the purge StartMessage flag. */
async function purgeAll(deps: SyncAcmsProfessionalIdsDeps): Promise<void> {
  await deps.professionalIdsRepo.deleteAll();
}

type GateOutcome = 'skipped' | 'error-written';

type ProcessOneRecordOutcome =
  | { kind: 'auto-linked'; via: 'fingerprint' | 'name' }
  | { kind: 'conflict'; via: 'fingerprint' | 'name' }
  | { kind: 'no-match' | 'ambiguous'; gated: GateOutcome }
  | { kind: 'skipped-not-a-person' };

/**
 * The full per-record decision tree: a not-a-person check first (see isLikelyNotAPerson - cheap,
 * no I/O, and there is no real identity here to look up either way), then fingerprint match
 * (cheapest real lookup, most confident), then on a miss, name matching. A resolved match (either
 * path) that collides with a different trustee already holding this ACMS id is reported as a
 * conflict, always written (bypassing the active-appointment gate — a data-integrity problem is
 * always worth recording). Any other non-auto-link outcome (no-match, ambiguous) routes through
 * the active-appointment gate. Returns a summary outcome so the caller (handlePage) can aggregate
 * per-page telemetry.
 */
async function processOneRecord(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<ProcessOneRecordOutcome> {
  if (shouldSkipAsNotAPerson(record.firstName, record.lastName)) {
    return { kind: 'skipped-not-a-person' };
  }

  const variant = buildAcmsVariant(record);
  const fingerprint = computeFingerprint(variant);

  const fingerprintResult = await processFingerprintMatch(deps, fingerprint, variant);
  if (fingerprintResult.kind === 'auto-linked') {
    return processResolvedMatch(
      deps,
      record,
      fingerprint,
      variant,
      fingerprintResult,
      'fingerprint',
    );
  }

  const nameResult = await processNameMatch(deps, record);
  if (nameResult.kind === 'auto-linked') {
    return processResolvedMatch(deps, record, fingerprint, variant, nameResult, 'name');
  }

  if (nameResult.kind === 'ambiguous') {
    const gated = await applyActiveAppointmentGate(deps, record, fingerprint, variant, {
      disposition: 'ambiguous',
      trustees: nameResult.matchCandidates.map((c) => c.trusteeId),
    });
    return { kind: 'ambiguous', gated };
  }

  const gated = await applyActiveAppointmentGate(deps, record, fingerprint, variant, {
    disposition: 'no-match',
  });
  return { kind: 'no-match', gated };
}

async function processResolvedMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  match: LinkOutcome,
  via: 'fingerprint' | 'name',
): Promise<ProcessOneRecordOutcome> {
  const existingTrusteeId = await findExistingConflict(
    deps,
    record.acmsProfessionalId,
    match.trusteeId,
  );
  if (existingTrusteeId) {
    await writeErroredProfessionalId(deps, record, fingerprint, variant, {
      disposition: 'conflict',
      trustees: [existingTrusteeId, match.trusteeId],
    });
    return { kind: 'conflict', via };
  }

  await linkTrustee(deps, match.trusteeId, record.acmsProfessionalId);
  return { kind: 'auto-linked', via };
}

async function applyActiveAppointmentGate(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  error: TrusteeProfessionalIdError,
): Promise<GateOutcome> {
  const groupDesignator = record.acmsProfessionalId.split('-')[0];
  const active = await hasActiveAppointments(deps, groupDesignator, record.ustProfCode);
  if (!active) {
    return 'skipped';
  }
  await writeErroredProfessionalId(deps, record, fingerprint, variant, error);
  return 'error-written';
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
