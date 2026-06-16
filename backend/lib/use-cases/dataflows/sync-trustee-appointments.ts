import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  TrusteeAppointmentDownstreamEvent,
  TrusteeAppointmentDownstreamSyncError,
  CandidateScore,
  isMultipleTrusteesMatchError,
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
  TrusteeAppointmentsSyncState,
  TrusteeMatchVerificationRepository,
  RuntimeStateRepository,
  TrusteesRepository,
} from '../gateways.types';
import {
  matchTrusteeByName,
  resolveTrusteeWithFuzzyMatching,
  isPerfectMatch,
  findInactivePerfectMatch,
  calculateCandidateScore,
  calculateAddressScore,
} from './trustee-match.helpers';
import { AppointmentStatus } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SyncedCase } from '@common/cams/cases';
import { randomUUID } from 'node:crypto';
import { CasesInterface } from '../cases/cases.interface';

const MODULE_NAME = 'SYNC-TRUSTEE-APPOINTMENTS-USE-CASE';

type ScenarioDistribution = {
  autoMatchCount: number;
  imperfectMatchCount: number;
  highConfidenceMatchCount: number;
  noMatchCount: number;
  multipleMatchCount: number;
  perfectMatchInactiveCount: number;
  reVerificationCount: number;
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
 * Returns null and writes a TRUSTEE_APPOINTMENT_DOWNSTREAM_SYNC_ERROR doc when no match found.
 */
export async function resolveGroupMatchedProfessionalId(
  context: ApplicationContext,
  appointmentsRepo: TrusteeAppointmentsRepository,
  trusteeId: string,
  courtDivisionCode: string,
  errorFields: Omit<TrusteeAppointmentDownstreamSyncError, 'documentType' | 'groupDesignator'>,
): Promise<string | null> {
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
      `No ACMS professional ID found for trustee ${trusteeId} in group ${groupDesignator ?? '(unknown)'} (division ${courtDivisionCode}) — writing sync error doc`,
    );
    await appointmentsRepo.upsertDownstreamSyncError({
      documentType: 'TRUSTEE_APPOINTMENT_DOWNSTREAM_SYNC_ERROR',
      groupDesignator,
      ...errorFields,
    });
    return null;
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
  casesRepo: CasesRepository,
  appointmentsRepo: TrusteeAppointmentsRepository,
): Promise<void> {
  const now = new Date().toISOString();

  if (syncedCase && syncedCase.trusteeId !== trusteeId) {
    syncedCase.trusteeId = trusteeId;
    await casesRepo.syncDxtrCase(syncedCase);
    context.logger.info(MODULE_NAME, `Linked case ${event.caseId} to trustee ${trusteeId}`);
  }

  const existingAppointment = await appointmentsRepo.getActiveCaseAppointment(event.caseId);

  if (existingAppointment && existingAppointment.trusteeId === trusteeId) {
    return; // Same trustee already active — nothing to do
  }

  if (existingAppointment && existingAppointment.trusteeId !== trusteeId) {
    await appointmentsRepo.updateCaseAppointment({
      ...existingAppointment,
      unassignedOn: now,
    });
    context.logger.info(
      MODULE_NAME,
      `Soft-closed case appointment for case ${event.caseId}, old trustee ${existingAppointment.trusteeId}`,
    );
    if (context.featureFlags['downstream-trustee-appointments-enabled']) {
      const oldAcmsProfessionalId = await resolveGroupMatchedProfessionalId(
        context,
        appointmentsRepo,
        existingAppointment.trusteeId,
        syncedCase.courtDivisionCode,
        {
          caseId: event.caseId,
          trusteeId: existingAppointment.trusteeId,
          assignedOn: existingAppointment.assignedOn,
          appointedDate: existingAppointment.appointedDate,
          unassignedOn: now,
          chapter: syncedCase.chapter,
          courtDivisionCode: syncedCase.courtDivisionCode,
          replacedByTrusteeId: trusteeId,
        },
      );
      if (oldAcmsProfessionalId) {
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
          await appointmentsRepo.upsertDownstreamSyncError({
            documentType: 'TRUSTEE_APPOINTMENT_DOWNSTREAM_SYNC_ERROR',
            caseId: event.caseId,
            trusteeId: existingAppointment.trusteeId,
            assignedOn: existingAppointment.assignedOn,
            appointedDate: existingAppointment.appointedDate,
            unassignedOn: now,
            chapter: syncedCase.chapter,
            courtDivisionCode: syncedCase.courtDivisionCode,
            groupDesignator: oldAcmsProfessionalId.split('-')[0],
            replacedByTrusteeId: trusteeId,
          });
        }
      }
    }
  }

  await appointmentsRepo.createCaseAppointment({
    caseId: event.caseId,
    trusteeId,
    assignedOn: now,
    appointedDate: event.appointedDate,
    source: 'dxtr',
  });
  context.logger.info(
    MODULE_NAME,
    `Created case appointment for case ${event.caseId}, trustee ${trusteeId}`,
  );

  if (context.featureFlags['downstream-trustee-appointments-enabled']) {
    const acmsProfessionalId = await resolveGroupMatchedProfessionalId(
      context,
      appointmentsRepo,
      trusteeId,
      syncedCase.courtDivisionCode,
      {
        caseId: event.caseId,
        trusteeId,
        assignedOn: now,
        appointedDate: event.appointedDate,
        chapter: syncedCase.chapter,
        courtDivisionCode: syncedCase.courtDivisionCode,
      },
    );

    if (acmsProfessionalId) {
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
        await appointmentsRepo.upsertDownstreamSyncError({
          documentType: 'TRUSTEE_APPOINTMENT_DOWNSTREAM_SYNC_ERROR',
          caseId: event.caseId,
          trusteeId,
          assignedOn: now,
          appointedDate: event.appointedDate,
          chapter: syncedCase.chapter,
          courtDivisionCode: syncedCase.courtDivisionCode,
          groupDesignator: acmsProfessionalId.split('-')[0],
        });
      }
    }
  }
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

class SyncTrusteeAppointmentsUseCase {
  private readonly context: ApplicationContext;
  private readonly casesGateway: CasesInterface;
  private readonly casesRepo: CasesRepository;
  private readonly appointmentsRepo: TrusteeAppointmentsRepository;
  private readonly trusteesRepo: TrusteesRepository;
  private readonly verificationRepo: TrusteeMatchVerificationRepository;
  private readonly runtimeStateRepo: RuntimeStateRepository<TrusteeAppointmentsSyncState>;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.casesGateway = factory.getCasesGateway(context);
    this.casesRepo = factory.getCasesRepository(context);
    this.appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
    this.trusteesRepo = factory.getTrusteesRepository(context);
    this.verificationRepo = factory.getTrusteeMatchVerificationRepository(context);
    this.runtimeStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);
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
      } else if (lastSyncDate) {
        syncState = {
          id: randomUUID(),
          documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          lastSyncDate,
        };
      } else if (reset) {
        context.logger.info(MODULE_NAME, 'reset flag detected — starting from default sync date.');
        syncState = {
          id: randomUUID(),
          documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          lastSyncDate: '2018-01-01',
        };
      } else {
        try {
          syncState = await this.runtimeStateRepo.read('TRUSTEE_APPOINTMENTS_SYNC_STATE');
        } catch (_error) {
          syncState = {
            id: randomUUID(),
            documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
            lastSyncDate: '2018-01-01',
          };
        }
      }

      const { events, latestSyncDate } = await this.casesGateway.getTrusteeAppointments(
        context,
        syncState.lastSyncDate,
      );

      return {
        events,
        latestSyncDate,
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
    let successCount = 0;
    const scenarioDistribution: ScenarioDistribution = {
      autoMatchCount: 0,
      imperfectMatchCount: 0,
      highConfidenceMatchCount: 0,
      noMatchCount: 0,
      multipleMatchCount: 0,
      perfectMatchInactiveCount: 0,
      reVerificationCount: 0,
    };

    for (const event of events) {
      const audit: MatchAuditEntry = {
        caseId: event.caseId,
        dxtrTrusteeName: event.dxtrTrustee.fullName,
        matchOutcome: 'error',
        matchedTrusteeId: null,
        scoringBreakdown: null,
        appointmentStatus: null,
      };

      try {
        const trusteeId = await matchTrusteeByName(context, event.dxtrTrustee.fullName);

        const syncedCase = await this.casesRepo.getSyncedCase(event.caseId);
        const trusteeAppointments = await this.appointmentsRepo.getTrusteeAppointments(trusteeId);

        if (
          isPerfectMatch(
            trusteeAppointments,
            syncedCase.courtId,
            syncedCase.courtDivisionCode,
            syncedCase.chapter,
          )
        ) {
          await applyResolvedTrustee(
            context,
            event,
            trusteeId,
            syncedCase,
            this.casesRepo,
            this.appointmentsRepo,
          );
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
            syncedCase.courtId,
            syncedCase.courtDivisionCode,
            syncedCase.chapter,
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
            syncedCase,
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

        if (isMultipleTrusteesMatchError(camsError.data)) {
          try {
            const candidateTrusteeIds = camsError.data.matchCandidates.map((c) => c.trusteeId);
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

    return { successCount, dlqMessages, scenarioDistribution };
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

export default SyncTrusteeAppointmentsUseCase;
