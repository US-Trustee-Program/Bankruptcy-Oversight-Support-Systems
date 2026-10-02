import { randomUUID } from 'node:crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import {
  AcmsActiveAppointment,
  AcmsProfessionalIdSyncState,
  AcmsTrusteeProfessionalDetailRecord,
} from '../gateways.types';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE, TrusteeVariation } from '@common/cams/trustee-variation';
import { ACMS_SYSTEM_USER_REFERENCE, createAuditRecord } from '@common/cams/auditable';
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
  deriveNameMatchCount,
  deriveSuspectDuplicateCamsTrustee,
  TrusteeProfessionalId,
} from './trustee-professional-ids.types';

const ACMS_PROFESSIONAL_ID_SYNC_STATE = 'ACMS_PROFESSIONAL_ID_SYNC_STATE' as const;

/**
 * Disabled: when true, processResolvedNameMatch writes a TrusteeVariation, which (1) makes a later
 * ACMS id in the same run with the same variant short-circuit through processFingerprintMatch and
 * lose its pipeline evidence, and (2) survives purgeAll, so a purge + re-sync short-circuits on
 * variations written by earlier matching logic. Enable only after both are addressed.
 */
const WRITE_ACMS_TRUSTEE_VARIATIONS = false;

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
 * Lists the distinct group designators from the CAMS offices data, one CMMPR paged query per group.
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
 * Best-effort bookmark persistence for a single group: errors are logged, not thrown, so the next
 * run resumes from the prior bookmark. Sets only this group's key via RuntimeStateRepository.setField.
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
 * Returns the camsTrusteeId of an existing linked record for this ACMS id that belongs to a
 * different trustee, if any.
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
 * Looks up the TrusteeVariation fingerprint bucket for an entry with this exact variant.
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
 * Projects CMMPR address/phone/fax into AcmsTrusteeProfessional.legacy; undefined when all are empty.
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
 * Projects raw CMMPR name fields unchanged; name recovery happens only in the pipeline's
 * normalizeAcmsSourceName stage (written to sourceNormalized).
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
 * Rethrows a transient pipeline error so handlePage's retry re-runs the page from its original
 * bookmark; other outcomes return the serialized state.
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
 * Whether the professional holds at least one active (undisposed) CMMAP appointment.
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
 * Upserts one TrusteeProfessionalId keyed by the matched trusteeId, else the variant fingerprint.
 * A non-empty conflictingTrusteeId forces disposition 'conflict'. suspectDuplicateCamsTrustee is
 * computed only for 'ambiguous'.
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
      linkMethod: disposition === 'linked' ? 'auto' : undefined,
      suspectDuplicateCamsTrustee:
        disposition === 'ambiguous' ? deriveSuspectDuplicateCamsTrustee(state) : undefined,
      nameMatchCount: deriveNameMatchCount(state),
      evidence: { ...state, variant, conflictingTrusteeId },
    },
    ACMS_SYSTEM_USER_REFERENCE,
  );
}

/**
 * Deletes all professional-id records and the sync bookmark document. Does not touch
 * TrusteeVariation.
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
 * Per-record order: fingerprint match, then the matching pipeline, then a conflict check on any
 * resolved match. A conflict bypasses the active-appointment gate; every other unlinked outcome goes
 * through applyActiveAppointmentGate.
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

  // See WRITE_ACMS_TRUSTEE_VARIATIONS.
  if (WRITE_ACMS_TRUSTEE_VARIATIONS) {
    await deps.variationRepo.createVariation(
      createAuditRecord(
        {
          documentType: TRUSTEE_VARIATION_DOCUMENT_TYPE,
          fingerprint,
          variant,
          trusteeId,
        },
        ACMS_SYSTEM_USER_REFERENCE,
      ),
    );
  }

  await writeProfessionalId(deps, record, fingerprint, variant, state);
  return { kind: 'auto-linked', via: 'name' };
}

/**
 * Writes the record only when the professional has an active CMMAP appointment; applies to
 * no-match, ambiguous, skipped and error outcomes.
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

/** Use-case operations for the ACMS professional-id sync dataflow. */
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
