import { randomUUID } from 'node:crypto';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import {
  AcmsActiveAppointment,
  AcmsProfessionalIdSyncState,
  AcmsTrusteeProfessionalDetailRecord,
} from '../gateways.types';
import { ACMS_SYSTEM_USER_REFERENCE, createAuditRecord } from '@common/cams/auditable';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE } from '@common/cams/trustee-variation';
import { buildAcmsVariant, formatAcmsZip } from './acms-trustee-variant.helpers';
import { formatCityStateZipCountry } from '../../adapters/utils/string-helper';
import { computeFingerprint } from './trustee-variant.helpers';
import { AcmsTrusteeProfessional } from '@common/cams/dataflow-events';
import { IdentityMismatchReason } from '@common/cams/trustee-match-verification';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { identifyTrustee, IdentifyTrusteeOutcome } from './identify-trustee';
import { upsertIdentityTask } from './identity-task';
import {
  deriveDisposition,
  deriveNameMatchCount,
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
    verificationRepo: factory.getTrusteeMatchVerificationRepository(context),
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
 * otherwise falls back to a fresh zero bookmark only when no state has been persisted yet
 * (NotFoundError) or this group has no entry yet in the map. Any other read failure rethrows —
 * a transient error must fail the run rather than silently restart the group from the beginning.
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
  } catch (originalError) {
    if (isNotFoundError(originalError)) {
      return freshState;
    }
    throw originalError;
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
 * A 'conflict' identification forces disposition 'conflict'. suspectDuplicateCamsTrustee is
 * computed only for 'ambiguous'.
 */
async function writeProfessionalId(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
  fingerprint: string,
  variant: string,
  identification: IdentifyTrusteeOutcome,
): Promise<TrusteeProfessionalId> {
  const { state } = identification;
  const conflictingTrusteeId =
    identification.kind === 'conflict' ? identification.existingTrusteeId : undefined;
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
 * TrusteeVariation, so variations the sync saved survive a purge and a rebuild relinks those
 * records by fingerprint instead of re-running the pipeline.
 */
async function purgeAll(deps: SyncAcmsProfessionalIdsDeps): Promise<void> {
  await deps.professionalIdsRepo.deleteAll();
  await deps.runtimeStateRepo.delete(ACMS_PROFESSIONAL_ID_SYNC_STATE);
}

type GateOutcome = 'skipped' | 'written';

/**
 * Outcome kinds are counted by name in the dataflow's completion trace; keep them stable.
 * - 'manual-preserved': an existing manual link was found, so nothing was identified or written.
 * - 'ambiguous-task-pending': the ambiguous professional's identity task is pending after this
 *   run, whether newly created or already present (an existing task is never modified).
 * - 'ambiguous-already-resolved': the identity task for this fingerprint and variant was already
 *   resolved or dismissed and was left unchanged.
 * - 'ambiguous' with gated 'skipped': ambiguous, but no active appointment, so no record or task.
 * - 'no-match-task-pending' / 'no-match-already-resolved': as the ambiguous pair, for a no-match
 *   professional with an active appointment and at least one candidate passing doesNameMatch.
 * - 'no-match': no task, because no candidate passed doesNameMatch or there was no active
 *   appointment.
 */
type ProcessOneRecordOutcome =
  | { kind: 'auto-linked'; via: 'fingerprint' | 'name' }
  | { kind: 'conflict'; via: 'fingerprint' | 'name' }
  | { kind: 'manual-preserved' }
  | { kind: 'ambiguous-task-pending' }
  | { kind: 'ambiguous-already-resolved' }
  | { kind: 'no-match-task-pending' }
  | { kind: 'no-match-already-resolved' }
  | { kind: 'ambiguous'; gated: 'skipped' }
  | {
      kind: 'no-match' | 'error' | 'skipped-not-a-person';
      gated: GateOutcome;
    };

/**
 * Per-record order: manual-link guard, identifyTrustee's fingerprint lookup, then the matching
 * pipeline, then a conflict check on any resolved match. A conflict bypasses the
 * active-appointment gate; every other unresolved outcome goes through
 * applyActiveAppointmentGate. An ambiguous record the gate wrote also gets an identity task, as
 * does a no-match record with a name-passing candidate.
 */
async function processOneRecord(
  deps: SyncAcmsProfessionalIdsDeps,
  record: AcmsTrusteeProfessionalDetailRecord,
): Promise<ProcessOneRecordOutcome> {
  const existingLinks = await deps.professionalIdsRepo.findByAcmsProfessionalId(
    record.acmsProfessionalId,
  );
  if (existingLinks.some((link) => link.linkMethod === 'manual')) {
    return { kind: 'manual-preserved' };
  }

  const variant = buildAcmsVariant(record);
  const fingerprint = computeFingerprint(variant);

  const sourceTrustee = toAcmsTrusteeProfessional(record);
  const identification = await identifyTrustee(
    deps,
    sourceTrustee,
    record.acmsProfessionalId,
    fingerprint,
    variant,
  );

  if (identification.kind !== 'unresolved') {
    await writeProfessionalId(deps, record, fingerprint, variant, identification);
    if (identification.kind === 'linked' && identification.via === 'name') {
      // A fingerprint hit means the variation already exists; only a pipeline match needs saving.
      await deps.variationRepo.createVariation(
        createAuditRecord(
          {
            documentType: TRUSTEE_VARIATION_DOCUMENT_TYPE,
            fingerprint,
            variant,
            trusteeId: identification.trusteeId,
          },
          ACMS_SYSTEM_USER_REFERENCE,
        ),
      );
    }
    return {
      kind: identification.kind === 'linked' ? 'auto-linked' : 'conflict',
      via: identification.via,
    };
  }

  const state = identification.state;
  const gated = await applyActiveAppointmentGate(
    deps,
    record,
    fingerprint,
    variant,
    identification,
  );

  if (state.skip) {
    return { kind: 'skipped-not-a-person', gated };
  }
  if (state.error) {
    return { kind: 'error', gated };
  }
  const writeTask = (mismatchReason: IdentityMismatchReason) =>
    upsertIdentityTask(deps.verificationRepo, {
      source: 'ACMS',
      sourceTrustee,
      mismatchReason,
      findings: state,
      fingerprint,
      variant,
      acmsProfessionalId: record.acmsProfessionalId,
    });
  const disposition = deriveDisposition(state);
  if (disposition === 'ambiguous') {
    if (gated === 'skipped') {
      return { kind: 'ambiguous', gated };
    }
    const isAlreadyResolved = await writeTask('ambiguous');
    return { kind: isAlreadyResolved ? 'ambiguous-already-resolved' : 'ambiguous-task-pending' };
  }
  if (gated === 'written' && deriveNameMatchCount(state) > 0) {
    const isAlreadyResolved = await writeTask('no match');
    return { kind: isAlreadyResolved ? 'no-match-already-resolved' : 'no-match-task-pending' };
  }
  return { kind: 'no-match', gated };
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
  identification: IdentifyTrusteeOutcome,
): Promise<GateOutcome> {
  const groupDesignator = record.acmsProfessionalId.split('-')[0];
  const active = await hasActiveAppointments(deps, groupDesignator, record.ustProfCode);
  if (!active) {
    return 'skipped';
  }
  await writeProfessionalId(deps, record, fingerprint, variant, identification);
  return 'written';
}

/** Use-case operations for the ACMS professional-id sync dataflow. */
const SyncAcmsProfessionalIds = {
  createDeps,
  getGroupDesignators,
  resolveSyncState,
  storeRuntimeState,
  purgeAll,
  processOneRecord,
};

export default SyncAcmsProfessionalIds;
