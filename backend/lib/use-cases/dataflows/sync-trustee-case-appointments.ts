import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  TrusteeAppointmentDownstreamEvent,
  CandidateScore,
  isMultipleTrusteesMatchError,
  MultipleTrusteesMatchErrorData,
} from '@common/cams/dataflow-events';
import { findGroupDesignatorForDivision } from '@common/cams/offices';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
} from '@common/cams/trustee-match-verification';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import {
  CasesRepository,
  TrusteeAppointmentsRepository,
  TrusteeCaseAppointmentsRepository,
  TrusteeAppointmentsSyncState,
  TrusteePetitionSyncState,
  TrusteeMatchVerificationRepository,
  RuntimeState,
  RuntimeStateDocumentType,
  RuntimeStateRepository,
  TrusteesRepository,
  TrusteeProfessionalIdsRepository,
} from '../gateways.types';
import {
  matchTrusteeByName,
  resolveTrusteeWithFuzzyMatching,
  isPerfectMatch,
  findInactivePerfectMatch,
  calculateCandidateScore,
  calculateAddressScore,
  parseCityStateZip,
} from './trustee-match.helpers';
import { AppointmentStatus } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SyncedCase } from '@common/cams/cases';
import { randomUUID } from 'node:crypto';
import { CasesInterface } from '../cases/cases.interface';

const MODULE_NAME = 'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE';

type ScenarioDistribution = {
  autoMatchCount: number;
  imperfectMatchCount: number;
  highConfidenceMatchCount: number;
  noMatchCount: number;
  multipleMatchCount: number;
  perfectMatchInactiveCount: number;
  reVerificationCount: number;
  reservedIdSkippedCount: number;
};

type MatchAuditEntry = {
  caseId: string;
  dxtrTrusteeName: string;
  matchOutcome:
    | 'auto-matched'
    | 'imperfect-match'
    | 'high-confidence'
    | 'no-match'
    | 'multiple-match'
    | 'inactive-perfect-match'
    | 'error';
  matchedTrusteeId: string | null;
  scoringBreakdown: { districtDivisionScore: number; chapterScore: number } | null;
  appointmentStatus: string | null;
};

type ProcessAppointmentsResult = {
  successCount: number;
  dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[];
  scenarioDistribution: ScenarioDistribution;
  /**
   * Events whose case has not yet been synced into CAMS by sync-cases (getCaseOrMovedCase
   * returned null). Not a failure — the function-app layer requeues these with a visibility
   * delay so sync-cases has time to catch up, instead of routing them to the DLQ immediately.
   */
  notYetSyncedEvents: TrusteeAppointmentSyncEvent[];
};

/**
 * Classify a caught error into a typed match outcome.
 * Known permanent errors become typed TrusteeAppointmentSyncError with a mismatchReason.
 * Unclassified/transient errors fall back to the raw event shape with error set.
 */
function classifyMatchOutcome(
  event: TrusteeAppointmentSyncEvent,
  error: CamsError,
): TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent {
  const DEFAULT_MESSAGE = { ...event, error };
  const { data } = error;
  if (!data) {
    return DEFAULT_MESSAGE;
  }

  const { mismatchReason, matchCandidates } = data as {
    mismatchReason?: TrusteeAppointmentSyncErrorCode;
    matchCandidates?: CandidateScore[];
  };

  if (mismatchReason === TrusteeAppointmentSyncErrorCode.NoTrusteeMatch) {
    return {
      ...event,
      mismatchReason: TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
      matchCandidates: [],
    };
  }

  if (
    mismatchReason === TrusteeAppointmentSyncErrorCode.MultipleTrusteesMatch ||
    mismatchReason === TrusteeAppointmentSyncErrorCode.ImperfectMatch
  ) {
    return {
      ...event,
      mismatchReason,
      matchCandidates: matchCandidates || [],
    };
  }

  return DEFAULT_MESSAGE;
}

/**
 * Resolves the ACMS professional ID for a trustee that matches the case's group designator.
 * A trustee may have multiple professional IDs across different ACMS groups; we must select
 * the one whose GROUP_DESIGNATOR prefix matches the group owning the case's court division.
 * Returns SENTINEL_PROFESSIONAL_ID ('XX-99999') and logs a warning when no match is found,
 * so the downstream event is always queued. Sentinel rows can be identified and remediated
 * when the trustee's professional ID is later corrected in the system.
 */
const SENTINEL_PROFESSIONAL_ID = 'XX-99999';

/**
 * ACMS-emitted acmsProfessionalId values that are placeholder/reserved and never correspond
 * to a real trustee. Events carrying one of these values must never be routed to trustee
 * matching or verification — there is no possible corrective action a reviewer could take.
 */
const RESERVED_PROFESSIONAL_IDS = ['XX-00000', 'XX-98000', 'XX-99999'];

export async function resolveGroupMatchedProfessionalId(
  context: ApplicationContext,
  trusteeId: string,
  courtDivisionCode: string,
): Promise<string> {
  const officesGateway = factory.getOfficesGateway(context);
  const offices = await officesGateway.getOffices(context);
  const groupDesignator = findGroupDesignatorForDivision(offices, courtDivisionCode);

  const professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
  const professionalIds = await professionalIdsRepo.findByCamsTrusteeId(trusteeId);
  const matched = professionalIds.find(
    (p) => p.acmsProfessionalId.split('-')[0] === groupDesignator,
  );

  if (!matched) {
    context.logger.warn(
      MODULE_NAME,
      `No ACMS professional ID found for trustee ${trusteeId} in group ${groupDesignator ?? '(unknown)'} (division ${courtDivisionCode}) — using sentinel ${SENTINEL_PROFESSIONAL_ID}`,
    );
    return SENTINEL_PROFESSIONAL_ID;
  }

  return matched.acmsProfessionalId;
}

/**
 * Applies the resolved trustee to the case and manages appointment history.
 * Shared logic for both normal matching and fuzzy matching success paths.
 */
async function applyResolvedTrustee(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  syncedCase: SyncedCase,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
): Promise<TrusteeAppointmentSyncError | null> {
  const now = new Date().toISOString();

  const existingAppointment = await appointmentsRepo.getActiveByCaseId(event.caseId);

  if (existingAppointment && existingAppointment.trusteeId === trusteeId) {
    return null; // Same trustee already active — nothing to do
  }

  if (existingAppointment && existingAppointment.trusteeId !== trusteeId) {
    const SOFT_CLOSE_WRITE_ATTEMPTS = 2;
    let softCloseError: CamsError | null = null;
    for (let attempt = 1; attempt <= SOFT_CLOSE_WRITE_ATTEMPTS; attempt++) {
      try {
        await appointmentsRepo.updateCaseAppointment({ ...existingAppointment, unassignedOn: now });
        softCloseError = null;
        break;
      } catch (error) {
        softCloseError = getCamsError(error, MODULE_NAME);
      }
    }
    if (softCloseError) {
      context.logger.error(
        MODULE_NAME,
        `Soft-close retries exhausted after ${SOFT_CLOSE_WRITE_ATTEMPTS} attempts for case ${event.caseId} — old trustee ${existingAppointment.trusteeId} appointment not closed. New appointment will still be created. Manual replay required.`,
        {
          caseId: event.caseId,
          oldTrusteeId: existingAppointment.trusteeId,
          newTrusteeId: trusteeId,
          assignedOn: existingAppointment.assignedOn,
          attempts: SOFT_CLOSE_WRITE_ATTEMPTS,
          error: softCloseError.message,
        },
      );
    }
    if (!softCloseError) {
      context.logger.info(
        MODULE_NAME,
        `Soft-closed case appointment for case ${event.caseId}, old trustee ${existingAppointment.trusteeId}`,
      );
    }
    if (context.featureFlags['downstream-trustee-appointments-enabled']) {
      const oldAcmsProfessionalId = await resolveGroupMatchedProfessionalId(
        context,
        existingAppointment.trusteeId,
        syncedCase.courtDivisionCode,
      );
      const closeEvent: TrusteeAppointmentDownstreamEvent = {
        caseId: event.caseId,
        trusteeId: existingAppointment.trusteeId,
        acmsProfessionalId: oldAcmsProfessionalId,
        assignedOn: existingAppointment.assignedOn,
        appointedDate: existingAppointment.appointedDate,
        chapter: syncedCase.chapter,
        unassignedOn: now,
      };
      const apiToDataflows = factory.getApiToDataflowsGateway(context);
      try {
        await apiToDataflows.queueTrusteeAppointmentEvent(closeEvent);
      } catch (queueError) {
        context.logger.error(
          MODULE_NAME,
          `Failed to queue close event for case ${event.caseId}, trustee ${existingAppointment.trusteeId} — appointment updated in Cosmos but downstream not notified`,
          queueError,
        );
      }
    }
    if (softCloseError) {
      const dlqFailure: TrusteeAppointmentSyncError = {
        ...event,
        mismatchReason: TrusteeAppointmentSyncErrorCode.SoftCloseWriteFailed,
        matchCandidates: [],
      };
      await appointmentsRepo.upsert({
        caseId: event.caseId,
        trusteeId,
        assignedOn: now,
        appointedDate: event.appointedDate,
      });
      context.logger.info(
        MODULE_NAME,
        `Created case appointment for case ${event.caseId}, trustee ${trusteeId}`,
      );
      return dlqFailure;
    }
  }

  await appointmentsRepo.upsert({
    caseId: event.caseId,
    trusteeId,
    assignedOn: now,
    appointedDate: event.appointedDate,
  });
  context.logger.info(
    MODULE_NAME,
    `Created case appointment for case ${event.caseId}, trustee ${trusteeId}`,
  );

  if (context.featureFlags['downstream-trustee-appointments-enabled']) {
    const acmsProfessionalId = await resolveGroupMatchedProfessionalId(
      context,
      trusteeId,
      syncedCase.courtDivisionCode,
    );

    const openEvent: TrusteeAppointmentDownstreamEvent = {
      caseId: event.caseId,
      trusteeId,
      acmsProfessionalId,
      assignedOn: now,
      appointedDate: event.appointedDate,
      chapter: syncedCase.chapter,
    };
    const apiToDataflows = factory.getApiToDataflowsGateway(context);
    try {
      await apiToDataflows.queueTrusteeAppointmentEvent(openEvent);
    } catch (queueError) {
      context.logger.error(
        MODULE_NAME,
        `Failed to queue open event for case ${event.caseId}, trustee ${trusteeId} — appointment created in Cosmos but downstream not notified`,
        queueError,
      );
    }
  }

  return null;
}

/**
 * Records a TrusteeMatchVerification document with status 'approved' for an auto-matched case,
 * making it visible in the Data Verification UI under "Verified" trustee matches.
 * Skips the write if the document already exists with status 'approved'.
 */
async function recordAutoMatch(
  verificationRepo: TrusteeMatchVerificationRepository,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
): Promise<void> {
  const existing = await verificationRepo.getVerification(event.caseId);
  if (existing?.status === 'approved') return;

  const doc = existing
    ? {
        ...existing,
        status: 'approved' as const,
        resolvedTrusteeId: trusteeId,
        resolvedTrusteeName: event.dxtrTrustee.fullName,
        updatedOn: new Date().toISOString(),
        updatedBy: SYSTEM_USER_REFERENCE,
      }
    : createAuditRecord<TrusteeMatchVerification>(
        {
          documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
          caseId: event.caseId,
          courtId: event.courtId,
          dxtrTrustee: event.dxtrTrustee,
          matchCandidates: [],
          taskType: 'trustee-match',
          status: 'approved',
          resolvedTrusteeId: trusteeId,
          resolvedTrusteeName: event.dxtrTrustee.fullName,
          taskDate: new Date().toISOString(),
        },
        SYSTEM_USER_REFERENCE,
      );

  await verificationRepo.upsertVerification(doc);
}

/**
 * Upserts a TrusteeMatchVerification document for a non-auto-match outcome.
 * Skips the write if the existing document has already been resolved or dismissed.
 */
async function upsertMatchVerification(
  verificationRepo: TrusteeMatchVerificationRepository,
  event: TrusteeAppointmentSyncEvent,
  mismatchReason: TrusteeAppointmentSyncErrorCode,
  matchCandidates: CandidateScore[],
  inactiveAppointmentStatus?: AppointmentStatus,
): Promise<boolean> {
  const existing = await verificationRepo.getVerification(event.caseId);
  if (existing && existing.status !== 'pending') {
    return true; // Already resolved — signals a re-verification for match accuracy tracking
  }
  if (existing) {
    await verificationRepo.upsertVerification({
      ...existing,
      mismatchReason,
      matchCandidates,
      inactiveAppointmentStatus,
      acmsProfessionalId: event.acmsProfessionalId,
      appointedDate: event.appointedDate,
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
    });
  } else {
    const doc = createAuditRecord<TrusteeMatchVerification>(
      {
        documentType: TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
        caseId: event.caseId,
        courtId: event.courtId,
        dxtrTrustee: event.dxtrTrustee,
        mismatchReason,
        matchCandidates,
        inactiveAppointmentStatus,
        acmsProfessionalId: event.acmsProfessionalId,
        appointedDate: event.appointedDate,
        taskType: 'trustee-match',
        status: 'pending',
        taskDate: new Date().toISOString(),
      },
      SYSTEM_USER_REFERENCE,
    );
    await verificationRepo.upsertVerification(doc);
  }
  return false;
}

async function handleInactivePerfectMatch(
  context: ApplicationContext,
  trusteesRepo: TrusteesRepository,
  verificationRepo: TrusteeMatchVerificationRepository,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  trusteeAppointments: TrusteeAppointment[],
  inactiveMatch: TrusteeAppointment,
  scenarioDistribution: ScenarioDistribution,
  audit: MatchAuditEntry,
): Promise<void> {
  const trustee = await trusteesRepo.read(trusteeId);
  const addressScore = calculateAddressScore(event.dxtrTrustee.legacy, trustee.public.address);
  const candidateScore: CandidateScore = {
    trusteeId,
    trusteeName: trustee.name,
    totalScore: addressScore * 0.2 + 100 * 0.4 + 100 * 0.4,
    addressScore,
    districtDivisionScore: 100,
    chapterScore: 100,
    address: trustee.public.address,
    phone: trustee.public.phone,
    email: trustee.public.email,
    appointments: trusteeAppointments,
  };

  const isReVerification = await upsertMatchVerification(
    verificationRepo,
    event,
    TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus,
    [candidateScore],
    inactiveMatch.status,
  );
  if (isReVerification) scenarioDistribution.reVerificationCount++;
  scenarioDistribution.perfectMatchInactiveCount++;

  context.logger.info(
    MODULE_NAME,
    `Perfect match with inactive status (${inactiveMatch.status}): case ${event.caseId} trustee ${trusteeId} saved for verification`,
  );

  audit.matchOutcome = 'inactive-perfect-match';
  audit.matchedTrusteeId = trusteeId;
  audit.appointmentStatus = inactiveMatch.status;
  audit.scoringBreakdown = {
    districtDivisionScore: 100,
    chapterScore: 100,
  };
}

class SyncTrusteeCaseAppointmentsUseCase {
  private readonly context: ApplicationContext;
  private readonly casesGateway: CasesInterface;
  private readonly casesRepo: CasesRepository;
  private readonly appointmentsRepo: TrusteeAppointmentsRepository;
  private readonly caseAppointmentsRepo: TrusteeCaseAppointmentsRepository;
  private readonly trusteesRepo: TrusteesRepository;
  private readonly verificationRepo: TrusteeMatchVerificationRepository;
  private readonly runtimeStateRepo: RuntimeStateRepository<TrusteeAppointmentsSyncState>;
  private readonly petitionSyncStateRepo: RuntimeStateRepository<TrusteePetitionSyncState>;
  private readonly professionalIdsRepo: TrusteeProfessionalIdsRepository;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.casesGateway = factory.getCasesGateway(context);
    this.casesRepo = factory.getCasesRepository(context);
    this.appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
    this.caseAppointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
    this.trusteesRepo = factory.getTrusteesRepository(context);
    this.verificationRepo = factory.getTrusteeMatchVerificationRepository(context);
    this.runtimeStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);
    this.petitionSyncStateRepo = factory.getTrusteePetitionSyncStateRepo(context);
    this.professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
  }

  /**
   * Resolves a trusteeId directly from event.acmsProfessionalId when it maps to exactly
   * one CAMS trustee, sidestepping fuzzy name matching entirely. Returns null on zero or
   * multiple matches (ambiguous), or when the event carries no acmsProfessionalId, so the
   * caller can fall back to matchTrusteeByName.
   */
  private async matchTrusteeByProfessionalId(
    acmsProfessionalId: string | undefined,
  ): Promise<string | null> {
    if (!acmsProfessionalId) return null;

    const matches = await this.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
    return matches.length === 1 ? matches[0].camsTrusteeId : null;
  }

  private async resolveSyncState<D extends RuntimeStateDocumentType>(
    documentType: D,
    repo: RuntimeStateRepository<RuntimeState & { documentType: D; lastSyncDate: string }>,
    lastSyncDate?: string,
    reset?: boolean,
  ): Promise<RuntimeState & { documentType: D; lastSyncDate: string }> {
    if (lastSyncDate) {
      return { id: randomUUID(), documentType, lastSyncDate };
    }
    if (reset) {
      return { id: randomUUID(), documentType, lastSyncDate: '2018-01-01' };
    }
    try {
      return await repo.read(documentType);
    } catch (_error) {
      return { id: randomUUID(), documentType, lastSyncDate: '2018-01-01' };
    }
  }

  async getAppointmentEvents(
    lastSyncDate?: string,
    reset?: boolean,
    overrideRuntimeState?: TrusteeAppointmentsSyncState,
  ) {
    const { context } = this;
    try {
      let syncState: TrusteeAppointmentsSyncState;
      if (overrideRuntimeState !== undefined) {
        context.logger.info(MODULE_NAME, 'Using overrideRuntimeState from start message.');
        syncState = overrideRuntimeState;
      } else {
        if (!lastSyncDate && reset) {
          context.logger.info(
            MODULE_NAME,
            'reset flag detected — starting from default sync date.',
          );
        }
        syncState = await this.resolveSyncState(
          'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          this.runtimeStateRepo,
          lastSyncDate,
          reset,
        );
      }

      const petitionSyncState = await this.resolveSyncState(
        'TRUSTEE_PETITION_SYNC_STATE',
        this.petitionSyncStateRepo,
        lastSyncDate,
        reset,
      );

      const [trusteeResult, petitionResult] = await Promise.allSettled([
        this.casesGateway.getTrusteeAppointments(context, syncState.lastSyncDate),
        this.casesGateway.getTrusteePetitionEvents(context, petitionSyncState.lastSyncDate),
      ]);

      // The petition-time query is newer and less proven than the long-running TR-appointment
      // sync, so its failure must not take down the previously-reliable TR sync or block its
      // watermark from advancing. Settled independently rather than via Promise.all.
      if (trusteeResult.status === 'rejected') {
        throw trusteeResult.reason;
      }
      const trusteeAppointments = trusteeResult.value;

      let petitionEvents: TrusteeAppointmentSyncEvent[] = [];
      let petitionLatestSyncDate: string | undefined;
      if (petitionResult.status === 'fulfilled') {
        petitionEvents = petitionResult.value.events;
        petitionLatestSyncDate = petitionResult.value.latestSyncDate;
      } else {
        const error = getCamsError(petitionResult.reason, MODULE_NAME);
        context.logger.camsError(error);
        context.logger.error(
          MODULE_NAME,
          'Petition-time trustee event sync failed; continuing with TR-appointment events only for this run.',
        );
      }

      return {
        events: [...trusteeAppointments.events, ...petitionEvents],
        latestSyncDate: trusteeAppointments.latestSyncDate,
        petitionLatestSyncDate,
      };
    } catch (originalError) {
      const error = getCamsError(originalError, MODULE_NAME);
      context.logger.camsError(error);
      throw error;
    }
  }

  /**
   * Process trustee appointment events by:
   * 1. Matching each DXTR trustee to a CAMS trustee by name
   * 2. Checking for a perfect match (exact name + active appointment in same court/division/chapter)
   * 3. Auto-linking only perfect matches; persisting all others to trustee-match-verification collection
   */
  async processAppointments(
    events: TrusteeAppointmentSyncEvent[],
  ): Promise<ProcessAppointmentsResult> {
    const { context } = this;
    const dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[] = [];
    const notYetSyncedEvents: TrusteeAppointmentSyncEvent[] = [];
    let successCount = 0;
    const scenarioDistribution: ScenarioDistribution = {
      autoMatchCount: 0,
      imperfectMatchCount: 0,
      highConfidenceMatchCount: 0,
      noMatchCount: 0,
      multipleMatchCount: 0,
      perfectMatchInactiveCount: 0,
      reVerificationCount: 0,
      reservedIdSkippedCount: 0,
    };

    for (const event of events) {
      if (
        event.acmsProfessionalId &&
        RESERVED_PROFESSIONAL_IDS.includes(event.acmsProfessionalId)
      ) {
        // Reserved values never correspond to a real trustee, so there is nothing to match
        // or verify. The event is still fully and correctly handled — it simply requires no
        // document write — so it counts toward successCount like any other handled event.
        successCount++;
        scenarioDistribution.reservedIdSkippedCount++;
        continue;
      }

      const cityStateZipCountry = event.dxtrTrustee.legacy?.cityStateZipCountry;
      if (event.dxtrTrustee.legacy && cityStateZipCountry) {
        event.dxtrTrustee.legacy.parsedCityStateZip = parseCityStateZip(cityStateZipCountry);
      }

      const audit: MatchAuditEntry = {
        caseId: event.caseId,
        dxtrTrusteeName: event.dxtrTrustee.fullName,
        matchOutcome: 'error',
        matchedTrusteeId: null,
        scoringBreakdown: null,
        appointmentStatus: null,
      };

      try {
        const trusteeId =
          (await this.matchTrusteeByProfessionalId(event.acmsProfessionalId)) ??
          (await matchTrusteeByName(context, event.dxtrTrustee.fullName));

        const caseOrMovedCase = await this.casesRepo.getCaseOrMovedCase(event.caseId);

        if (caseOrMovedCase === null) {
          context.logger.info(
            MODULE_NAME,
            `Case ${event.caseId} not yet synced into CAMS — queuing for retry.`,
          );
          notYetSyncedEvents.push(event);
          continue;
        }

        if (caseOrMovedCase.movedToCaseId) {
          context.logger.info(
            MODULE_NAME,
            `Case ${event.caseId} was transferred to ${caseOrMovedCase.movedToCaseId} — skipping match.`,
          );
          continue;
        }

        const syncedCase = caseOrMovedCase;
        const trusteeAppointments = await this.appointmentsRepo.getTrusteeAppointments(trusteeId);

        if (
          isPerfectMatch(trusteeAppointments, event.courtId, event.courtDivisionCode, event.chapter)
        ) {
          const softCloseFailure = await applyResolvedTrustee(
            context,
            event,
            trusteeId,
            syncedCase,
            this.caseAppointmentsRepo,
          );
          if (softCloseFailure) {
            dlqMessages.push(softCloseFailure);
          }
          await recordAutoMatch(this.verificationRepo, event, trusteeId);
          context.logger.info(
            MODULE_NAME,
            `Perfect match: case ${event.caseId} auto-linked to trustee ${trusteeId}`,
          );
          successCount++;
          scenarioDistribution.autoMatchCount++;
          audit.matchOutcome = 'auto-matched';
          audit.matchedTrusteeId = trusteeId;
          audit.appointmentStatus = 'active';
        } else {
          const inactiveMatch = findInactivePerfectMatch(
            trusteeAppointments,
            event.courtId,
            event.courtDivisionCode,
            event.chapter,
          );

          if (inactiveMatch) {
            await handleInactivePerfectMatch(
              context,
              this.trusteesRepo,
              this.verificationRepo,
              event,
              trusteeId,
              trusteeAppointments,
              inactiveMatch,
              scenarioDistribution,
              audit,
            );
            continue;
          }

          const trustee = await this.trusteesRepo.read(trusteeId);
          const candidateScore = calculateCandidateScore(
            context,
            event.dxtrTrustee,
            event.courtId,
            event.courtDivisionCode,
            event.chapter,
            trustee,
            trusteeAppointments,
          );

          audit.matchOutcome = 'imperfect-match';
          audit.matchedTrusteeId = trusteeId;
          audit.scoringBreakdown = {
            districtDivisionScore: candidateScore.districtDivisionScore,
            chapterScore: candidateScore.chapterScore,
          };

          throw new CamsError(MODULE_NAME, {
            message: `Single name match for case ${event.caseId} did not meet perfect match criteria.`,
            data: {
              mismatchReason: TrusteeAppointmentSyncErrorCode.ImperfectMatch,
              matchCandidates: [candidateScore],
            },
          });
        }
      } catch (originalError) {
        const camsError = getCamsError(
          originalError,
          MODULE_NAME,
          `Failed to process trustee appointment for case ${event.caseId}.`,
        );

        const matchErrorData = isMultipleTrusteesMatchError(camsError.data)
          ? (camsError.data as MultipleTrusteesMatchErrorData)
          : null;
        if (matchErrorData) {
          try {
            const candidateTrusteeIds = matchErrorData.matchCandidates.map((c) => c.trusteeId);
            const { winnerId, candidateScores } = await resolveTrusteeWithFuzzyMatching(
              context,
              event,
              candidateTrusteeIds,
            );
            context.logger.info(
              MODULE_NAME,
              `Fuzzy match winner ${winnerId} for case ${event.caseId} saved for verification`,
            );
            scenarioDistribution.highConfidenceMatchCount++;
            const isReVerification = await upsertMatchVerification(
              this.verificationRepo,
              event,
              TrusteeAppointmentSyncErrorCode.HighConfidenceMatch,
              candidateScores,
            );
            if (isReVerification) scenarioDistribution.reVerificationCount++;
            const winnerScore = candidateScores.find((c) => c.trusteeId === winnerId);
            audit.matchOutcome = 'high-confidence';
            audit.matchedTrusteeId = winnerId;
            if (winnerScore) {
              audit.scoringBreakdown = {
                districtDivisionScore: winnerScore.districtDivisionScore,
                chapterScore: winnerScore.chapterScore,
              };
            }
            continue;
          } catch (fuzzyError) {
            const enhancedError = getCamsError(
              fuzzyError,
              MODULE_NAME,
              `Fuzzy matching failed for case ${event.caseId}.`,
            );
            context.logger.warn(MODULE_NAME, `${enhancedError.message}`, enhancedError.data);
            scenarioDistribution.multipleMatchCount++;
            const isReVerification = await upsertMatchVerification(
              this.verificationRepo,
              event,
              TrusteeAppointmentSyncErrorCode.MultipleTrusteesMatch,
              (enhancedError.data as { matchCandidates?: CandidateScore[] })?.matchCandidates ?? [],
            );
            if (isReVerification) scenarioDistribution.reVerificationCount++;
            audit.matchOutcome = 'multiple-match';
            continue;
          }
        }

        context.logger.warn(MODULE_NAME, `${camsError}`);
        const classified = classifyMatchOutcome(event, camsError);
        if ('mismatchReason' in classified) {
          switch (classified.mismatchReason) {
            case TrusteeAppointmentSyncErrorCode.NoTrusteeMatch:
              scenarioDistribution.noMatchCount++;
              audit.matchOutcome = 'no-match';
              if (
                await upsertMatchVerification(
                  this.verificationRepo,
                  event,
                  TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
                  [],
                )
              )
                scenarioDistribution.reVerificationCount++;
              break;
            case TrusteeAppointmentSyncErrorCode.ImperfectMatch:
              scenarioDistribution.imperfectMatchCount++;
              if (
                await upsertMatchVerification(
                  this.verificationRepo,
                  event,
                  TrusteeAppointmentSyncErrorCode.ImperfectMatch,
                  classified.matchCandidates,
                )
              )
                scenarioDistribution.reVerificationCount++;
              break;
          }
        } else {
          // Unexpected/unclassified error — route to DLQ
          dlqMessages.push(classified);
        }
      } finally {
        context.logger.info(MODULE_NAME, 'TRUSTEE_MATCH_AUDIT', audit);
      }
    }

    return { successCount, dlqMessages, scenarioDistribution, notYetSyncedEvents };
  }

  async storeRuntimeState(lastSyncDate: string) {
    const { context } = this;
    try {
      const newSyncState: TrusteeAppointmentsSyncState = {
        documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
        lastSyncDate,
      };
      await this.runtimeStateRepo.upsert(newSyncState);
      context.logger.info(MODULE_NAME, `Wrote runtime state: `, newSyncState);
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        'Failed while storing the trustee appointments sync runtime state.',
      );
      context.logger.camsError(error);
    }
  }

  async storePetitionRuntimeState(lastSyncDate: string) {
    const { context } = this;
    try {
      const newSyncState: TrusteePetitionSyncState = {
        documentType: 'TRUSTEE_PETITION_SYNC_STATE',
        lastSyncDate,
      };
      await this.petitionSyncStateRepo.upsert(newSyncState);
      context.logger.info(MODULE_NAME, `Wrote petition runtime state: `, newSyncState);
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        'Failed while storing the trustee petition sync runtime state.',
      );
      context.logger.camsError(error);
    }
  }

  async deleteAll(): Promise<{ data: { deleted: number }; error?: Error }> {
    const { context } = this;
    try {
      const deleted = await this.appointmentsRepo.deleteAll();
      context.logger.info(MODULE_NAME, `deleteAll: removed ${deleted} case appointment records.`);
      return { data: { deleted } };
    } catch (originalError) {
      const error = getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to delete all case appointments.',
      );
      context.logger.camsError(error);
      return { data: { deleted: 0 }, error };
    }
  }
}

export default SyncTrusteeCaseAppointmentsUseCase;
