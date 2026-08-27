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
} from './trustee-match.helpers';
import { buildAcmsVariant } from './acms-trustee-variant.helpers';
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

function toAcmsTrusteeProfessional(
  record: AcmsTrusteeProfessionalDetailRecord,
): AcmsTrusteeProfessional {
  const { firstName, middleName } = splitCompoundFirstName(record.firstName, record.middleInitial);
  const fullName = [record.firstName, record.middleInitial, record.lastName]
    .filter(Boolean)
    .join(' ');
  return {
    firstName,
    middleName,
    lastName: record.lastName,
    fullName,
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
 * (matchTrusteeByName), reused as-is with the same thresholds as the DXTR sync. Called with no
 * courtId — an ACMS professional record has no associated case/court — which only narrows
 * matchTrusteeByName's last-name-token fallback path, it does not error.
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
 */
async function processNameMatch(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<NameMatchResult> {
  const acmsTrusteeProfessional = toAcmsTrusteeProfessional(record);
  const result = await matchTrusteeByName(deps.context, acmsTrusteeProfessional);

  if (result.kind === 'ambiguous') {
    const candidateTrusteeIds = result.matchCandidates.map((c) => c.trusteeId);
    const resolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      candidateTrusteeIds,
    );
    if (resolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: resolvedTrusteeId };
    }
    return { kind: 'ambiguous', matchCandidates: result.matchCandidates };
  }

  if (result.kind === 'no-match') {
    const tokenIntersectionCandidates = await findTokenIntersectionCandidates(
      deps.context,
      acmsTrusteeProfessional,
    );
    const tokenIntersectionResolvedTrusteeId = await resolveCandidatesByCorroboration(
      deps.context,
      acmsTrusteeProfessional,
      tokenIntersectionCandidates.map((t) => t.trusteeId),
    );
    if (tokenIntersectionResolvedTrusteeId) {
      return { kind: 'auto-linked', trusteeId: tokenIntersectionResolvedTrusteeId };
    }

    const anchoredLevenshteinCandidates = await findAnchoredLevenshteinCandidates(
      deps.context,
      acmsTrusteeProfessional,
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
  | { kind: 'no-match' | 'ambiguous'; gated: GateOutcome };

/**
 * The full per-record decision tree: fingerprint match first (cheapest, most confident); on a
 * miss, fall through to name matching. A resolved match (either path) that collides with a
 * different trustee already holding this ACMS id is reported as a conflict, always written
 * (bypassing the active-appointment gate — a data-integrity problem is always worth recording).
 * Any other non-auto-link outcome (no-match, ambiguous) routes through the active-appointment
 * gate. Returns a summary outcome so the caller (handlePage) can aggregate per-page telemetry.
 */
async function processOneRecord(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<ProcessOneRecordOutcome> {
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
