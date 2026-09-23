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
