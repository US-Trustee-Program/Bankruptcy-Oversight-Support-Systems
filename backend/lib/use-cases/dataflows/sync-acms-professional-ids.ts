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
 * "MORROW INC" for a trustee who really is "ROBERT K MORROW", firstName blank). Deliberately
 * narrow - confirmed via a CAMS-876 backtest survey of every business-suffixed lastName in a real
 * staging export, only 2 of 6 candidate records were a genuine solo practitioner's own name
 * recoverable this way; the other 4 (e.g. "COHEN PROPERTIES TRUST, INC.", "ROTH TRUSTEE CORP.")
 * were real businesses with no individual trustee behind them. GROUP/ASSOCIATES/TRUST/"&
 * ASSOCIATES" are deliberately excluded from this list for the same reason - that evidence showed
 * those suffixes overwhelmingly mark a genuine multi-person business, not a solo practice.
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
 * anyone's real name. Confirmed via a CAMS-879 backtest survey of every marker-bearing record in
 * a real staging export. Deliberately excludes standalone role words like "trustee"/"office"/
 * "code"/"case" from this list - those only signal "not a person" when they're ALL that's left
 * after stripping (see isLikelyNotAPerson), but stripping them unconditionally here would also
 * mangle a real surname that happens to contain one as a substring.
 *
 * "np" (confirmed via a CAMS-876 backtest, e.g. lastName "DIAMOND (NP)"/"KURTZ (NP)") is always
 * seen as a bracketed suffix on an otherwise-real name, the same shape as "(TR)"/"(DO NOT USE)" -
 * unlike those two-plus-word phrases, a bare 2-letter token needs ADMINISTRATIVE_MARKER_PATTERN's
 * word-boundary anchoring to avoid matching as a substring inside a real name (e.g. "STANP").
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
export function stripAdministrativeMarkers(value: string): string {
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
export function toAcmsTrusteeProfessional(
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
      evidence: { ...state, variant, conflictingTrusteeId },
    },
    ACMS_SYSTEM_USER_REFERENCE,
  );
}

/** Wipes all existing professional ID mappings — used by the purge StartMessage flag. */
async function purgeAll(deps: SyncAcmsProfessionalIdsDeps): Promise<void> {
  await deps.professionalIdsRepo.deleteAll();
}

type GateOutcome = 'skipped' | 'written';

type ProcessOneRecordOutcome =
  | { kind: 'auto-linked'; via: 'fingerprint' | 'name' }
  | { kind: 'conflict'; via: 'fingerprint' | 'name' }
  | { kind: 'no-match' | 'ambiguous' | 'error' | 'skipped-not-a-person'; gated: GateOutcome };

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
  if (state.candidates.length > 0) {
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
