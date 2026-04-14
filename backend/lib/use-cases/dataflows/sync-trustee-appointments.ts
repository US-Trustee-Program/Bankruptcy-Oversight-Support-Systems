import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  CandidateScore,
  isMultipleTrusteesMatchError,
} from '@common/cams/dataflow-events';
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
import { randomUUID } from 'node:crypto';

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
    mismatchReason === TrusteeAppointmentSyncErrorCode.ImperfectMatch ||
    mismatchReason === TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus
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
 * Applies the resolved trustee to the case and manages appointment history.
 * Shared logic for both normal matching and fuzzy matching success paths.
 */
async function applyResolvedTrustee(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  casesRepo: CasesRepository,
  appointmentsRepo: TrusteeAppointmentsRepository,
  viaFuzzyMatching: boolean = false,
): Promise<void> {
  const now = new Date().toISOString();

  const syncedCase = await casesRepo.getSyncedCase(event.caseId);
  if (syncedCase && syncedCase.trusteeId !== trusteeId) {
    syncedCase.trusteeId = trusteeId;
    await casesRepo.syncDxtrCase(syncedCase);
    const method = viaFuzzyMatching ? ' via fuzzy matching' : '';
    context.logger.info(
      MODULE_NAME,
      `Linked case ${event.caseId} to trustee ${trusteeId}${method}`,
    );
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
  }

  await appointmentsRepo.createCaseAppointment({
    caseId: event.caseId,
    trusteeId,
    assignedOn: now,
    appointedDate: event.appointedDate,
  });
  const method = viaFuzzyMatching ? ' (fuzzy match)' : '';
  context.logger.info(
    MODULE_NAME,
    `Created case appointment for case ${event.caseId}, trustee ${trusteeId}${method}`,
  );
}

/**
 * Get trustee appointment events from DXTR.
 * Queries for trustee appointment transactions and returns events with party data.
 * Throws error on failure to allow caller to handle appropriately.
 */
async function getAppointmentEvents(context: ApplicationContext, lastSyncDate?: string) {
  try {
    let syncState: TrusteeAppointmentsSyncState;
    if (lastSyncDate) {
      syncState = {
        id: randomUUID(),
        documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
        lastSyncDate,
      };
    } else {
      const runtimeStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);
      try {
        syncState = await runtimeStateRepo.read('TRUSTEE_APPOINTMENTS_SYNC_STATE');
      } catch (_error) {
        syncState = {
          id: randomUUID(),
          documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
          lastSyncDate: '2018-01-01',
        };
      }
    }

    const casesGateway = factory.getCasesGateway(context);
    const { events, latestSyncDate } = await casesGateway.getTrusteeAppointments(
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
        orderType: 'trustee-match',
        status: 'pending',
      },
      SYSTEM_USER_REFERENCE,
    );
    await verificationRepo.upsertVerification(doc);
  }
  return false;
}

async function handleInactivePerfectMatch(
  context: ApplicationContext,
  verificationRepo: TrusteeMatchVerificationRepository,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  trusteeAppointments: TrusteeAppointment[],
  inactiveMatch: TrusteeAppointment,
  scenarioDistribution: ScenarioDistribution,
  audit: MatchAuditEntry,
): Promise<void> {
  const trusteesRepo = factory.getTrusteesRepository(context);
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

/**
 * Process trustee appointment events by:
 * 1. Matching each DXTR trustee to a CAMS trustee by name
 * 2. Checking for a perfect match (exact name + active appointment in same court/division/chapter)
 * 3. Auto-linking only perfect matches; persisting all others to trustee-match-verification collection
 */
async function processAppointments(
  context: ApplicationContext,
  events: TrusteeAppointmentSyncEvent[],
): Promise<ProcessAppointmentsResult> {
  const casesRepo = factory.getCasesRepository(context);
  const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
  const trusteesRepo = factory.getTrusteesRepository(context);
  const verificationRepo = factory.getTrusteeMatchVerificationRepository(context);
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

      const syncedCase = await casesRepo.getSyncedCase(event.caseId);
      const trusteeAppointments = await appointmentsRepo.getTrusteeAppointments(trusteeId);

      if (
        isPerfectMatch(
          trusteeAppointments,
          syncedCase.courtId,
          syncedCase.courtDivisionCode,
          syncedCase.chapter,
        )
      ) {
        await applyResolvedTrustee(context, event, trusteeId, casesRepo, appointmentsRepo, false);
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
            verificationRepo,
            event,
            trusteeId,
            trusteeAppointments,
            inactiveMatch,
            scenarioDistribution,
            audit,
          );
          continue;
        }

        const trustee = await trusteesRepo.read(trusteeId);
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
            verificationRepo,
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
            verificationRepo,
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
                verificationRepo,
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
                verificationRepo,
                event,
                TrusteeAppointmentSyncErrorCode.ImperfectMatch,
                classified.matchCandidates ?? [],
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

/**
 * Store the runtime state after successful sync.
 */
async function storeRuntimeState(context: ApplicationContext, lastSyncDate: string) {
  const runtimeStateRepo = factory.getTrusteeAppointmentsSyncStateRepo(context);
  try {
    const newSyncState: TrusteeAppointmentsSyncState = {
      documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
      lastSyncDate,
    };
    await runtimeStateRepo.upsert(newSyncState);
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

const SyncTrusteeAppointments = {
  getAppointmentEvents,
  processAppointments,
  storeRuntimeState,
};

export default SyncTrusteeAppointments;
