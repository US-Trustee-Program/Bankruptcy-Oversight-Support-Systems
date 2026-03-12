import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  CandidateScore,
  UNSCORED,
  isMultipleTrusteesMatchError,
} from '@common/cams/dataflow-events';
import { TrusteeMatchVerification } from '@common/cams/trustee-match-verification';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import { isNotFoundError } from '../../common-errors/not-found-error';
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
  calculateCandidateScore,
} from './trustee-match.helpers';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-TRUSTEE-APPOINTMENTS-USE-CASE';

type ScenarioDistribution = {
  autoMatchCount: number;
  imperfectMatchCount: number;
  highConfidenceMatchCount: number;
  noMatchCount: number;
  multipleMatchCount: number;
  caseNotFoundCount: number;
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
    | 'case-not-found'
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
 * Classify a caught error into a DLQ message.
 * Known permanent errors become typed TrusteeAppointmentSyncError with a mismatchReason.
 * Unclassified/transient errors fall back to the raw event shape with error set.
 */
function buildDlqMessage(
  event: TrusteeAppointmentSyncEvent,
  error: CamsError,
): TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent {
  const DEFAULT_MESSAGE = { ...event, error };
  const { data } = error;
  if (!data) {
    if (isNotFoundError(error)) {
      return { ...event, mismatchReason: 'CASE_NOT_FOUND' };
    }

    return DEFAULT_MESSAGE;
  }

  const { mismatchReason, matchCandidates } = data as {
    mismatchReason?: TrusteeAppointmentSyncErrorCode;
    matchCandidates?: CandidateScore[];
  };

  if (mismatchReason === 'NO_TRUSTEE_MATCH') {
    return { ...event, mismatchReason: 'NO_TRUSTEE_MATCH', matchCandidates: [] };
  }

  if (mismatchReason === 'MULTIPLE_TRUSTEES_MATCH' || mismatchReason === 'IMPERFECT_MATCH') {
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
 * Throws error on failure to allow caller to route to DLQ.
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
      syncState = await runtimeStateRepo.read('TRUSTEE_APPOINTMENTS_SYNC_STATE');
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
): Promise<void> {
  const existing = await verificationRepo.getVerification(event.caseId);
  if (existing && existing.status !== 'pending') {
    return; // Operator has already resolved or dismissed — do not overwrite
  }
  if (existing) {
    await verificationRepo.upsertVerification({
      ...existing,
      mismatchReason,
      matchCandidates,
      updatedOn: new Date().toISOString(),
      updatedBy: SYSTEM_USER_REFERENCE,
    });
  } else {
    const doc = createAuditRecord<TrusteeMatchVerification>(
      {
        documentType: 'TRUSTEE_MATCH_VERIFICATION',
        caseId: event.caseId,
        courtId: event.courtId,
        dxtrTrustee: event.dxtrTrustee,
        mismatchReason,
        matchCandidates,
        status: 'pending',
      },
      SYSTEM_USER_REFERENCE,
    );
    await verificationRepo.upsertVerification(doc);
  }
}

/**
 * Process trustee appointment events by:
 * 1. Matching each DXTR trustee to a CAMS trustee by name
 * 2. Checking for a perfect match (exact name + active appointment in same court/division/chapter)
 * 3. Auto-linking only perfect matches; routing all others to DLQ for verification
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
    caseNotFoundCount: 0,
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
        syncedCase &&
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
        const trustee = await trusteesRepo.read(trusteeId);
        const candidateScore = syncedCase
          ? calculateCandidateScore(
              context,
              event.dxtrTrustee,
              syncedCase,
              trustee,
              trusteeAppointments,
            )
          : {
              trusteeId,
              trusteeName: trustee.name,
              totalScore: UNSCORED,
              addressScore: UNSCORED,
              districtDivisionScore: UNSCORED,
              chapterScore: UNSCORED,
            };

        audit.matchOutcome = 'imperfect-match';
        audit.matchedTrusteeId = trusteeId;
        audit.scoringBreakdown = {
          districtDivisionScore: candidateScore.districtDivisionScore,
          chapterScore: candidateScore.chapterScore,
        };

        throw new CamsError(MODULE_NAME, {
          message: `Single name match for case ${event.caseId} did not meet perfect match criteria.`,
          data: {
            mismatchReason: 'IMPERFECT_MATCH',
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
            `Fuzzy match winner ${winnerId} for case ${event.caseId} routed to DLQ for verification`,
          );
          dlqMessages.push({
            ...event,
            mismatchReason: 'HIGH_CONFIDENCE_MATCH',
            matchCandidates: candidateScores,
          });
          scenarioDistribution.highConfidenceMatchCount++;
          await upsertMatchVerification(
            verificationRepo,
            event,
            'HIGH_CONFIDENCE_MATCH',
            candidateScores,
          );
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
          dlqMessages.push(buildDlqMessage(event, enhancedError));
          scenarioDistribution.multipleMatchCount++;
          await upsertMatchVerification(verificationRepo, event, 'MULTIPLE_TRUSTEES_MATCH', []);
          audit.matchOutcome = 'multiple-match';
          continue;
        }
      }

      context.logger.warn(MODULE_NAME, `${camsError}`);
      const dlqMsg = buildDlqMessage(event, camsError);
      dlqMessages.push(dlqMsg);
      if ('mismatchReason' in dlqMsg) {
        switch (dlqMsg.mismatchReason) {
          case 'NO_TRUSTEE_MATCH':
            scenarioDistribution.noMatchCount++;
            audit.matchOutcome = 'no-match';
            await upsertMatchVerification(verificationRepo, event, 'NO_TRUSTEE_MATCH', []);
            break;
          case 'IMPERFECT_MATCH':
            scenarioDistribution.imperfectMatchCount++;
            await upsertMatchVerification(
              verificationRepo,
              event,
              'IMPERFECT_MATCH',
              dlqMsg.matchCandidates ?? [],
            );
            break;
          case 'CASE_NOT_FOUND':
            scenarioDistribution.caseNotFoundCount++;
            audit.matchOutcome = 'case-not-found';
            break;
        }
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
