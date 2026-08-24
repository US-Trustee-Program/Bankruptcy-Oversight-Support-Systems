import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncErrorCode,
  TrusteeAppointmentSyncEvent,
  TrusteeAppointmentDownstreamEvent,
  CandidateScore,
  SoftCloseWriteFailed,
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
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import {
  TrusteeCaseAppointmentsRepository,
  TrusteeAppointmentsSyncState,
  TrusteePetitionSyncState,
  TrusteeMatchVerificationRepository,
  RuntimeState,
  RuntimeStateDocumentType,
  RuntimeStateRepository,
} from '../gateways.types';
import {
  matchTrusteeByName,
  resolveNameCollisionByScoring,
  isAppointmentMatch,
  findInactivePerfectMatch,
  calculateCandidateScore,
  calculateAddressScore,
  calculatePhoneScore,
  calculateEmailScore,
  calculateTotalScore,
  parseCityStateZip,
  normalizeName,
} from './trustee-match.helpers';
import { buildVariant, computeFingerprint } from './trustee-variant.helpers';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE } from '@common/cams/trustee-variation';
import { AppointmentStatus } from '@common/cams/trustees';
import { CaseAppointment, TrusteeAppointment } from '@common/cams/trustee-appointments';
import { CaseChapter, SyncedCase, VALID_CASE_CHAPTERS } from '@common/cams/cases';
import { BadRequestError } from '../../common-errors/bad-request';
import { randomUUID } from 'node:crypto';

const MODULE_NAME = 'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE';

type ScenarioDistribution = {
  autoMatchCount: number;
  imperfectMatchCount: number;
  noMatchCount: number;
  multipleMatchCount: number;
  perfectMatchInactiveCount: number;
  reVerificationCount: number;
  verificationBucketHitCount: number;
  fingerprintHitCount: number;
  fingerprintMissCount: number;
  retryableCount: number;
  /**
   * matchTrusteeByName found more than one raw name candidate, but scoring could not load ANY
   * of their trustee/appointment records (e.g. every candidate rejected with a non-transient
   * error) — distinct from multipleMatchCount, which means scoring DID run and simply found no
   * clear winner. See TrusteeAppointmentSyncErrorCode.CandidateLoadFailed's doc comment.
   */
  candidateLoadFailedCount: number;
  /**
   * dxtrTrustee had NO usable demographics at all (blank name AND no other legacy/contact
   * fields) — an event this sparse cannot be safely attributed to any trustee, since absent
   * demographics could describe any of them. Never routed to matching or verification; logged
   * loudly instead, so this genuine data-quality condition is visible without polluting a real
   * trustee's review queue.
   */
  emptyDemographicsSkippedCount: number;
  /**
   * event.profCode was a known sentinel value AND the record's name was itself a
   * bogus/administrative placeholder (isBogusTrusteeName) with no usable contact info either.
   * Distinct from emptyDemographicsSkippedCount: this path can fire even though dxtrTrustee HAS a
   * populated name — the name is present but not a real identity.
   */
  sentinelBogusNameSkippedCount: number;
};

type MatchAuditEntry = {
  caseId: string;
  dxtrTrusteeName: string;
  matchOutcome:
    | 'auto-matched'
    | 'imperfect-match'
    | 'ambiguous-match-resolved'
    | 'no-match'
    | 'ambiguous-match-unresolved'
    | 'candidate-load-failed'
    | 'inactive-perfect-match'
    | 'verification-bucket-hit'
    | 'retryable-error'
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
  /**
   * Events that failed on a transient infrastructure error (Cosmos RU throttling, a read/write
   * timeout) rather than a genuine match outcome. Not a failure of the matching logic itself —
   * the function-app layer requeues these with an exponential backoff delay (same policy as
   * handleRateLimitRetry) instead of routing them to the DLQ on the first occurrence. Routing
   * transient errors straight to the DLQ would permanently drop a case
   * appointment that a retry could have synced successfully, and re-running the whole sync from
   * the last cursor position does not recover it, since the date cursor has already advanced.
   */
  retryableEvents: TrusteeAppointmentSyncEvent[];
};

/**
 * True when error is a transient infrastructure failure (Cosmos RU throttling or a read/write
 * timeout) rather than a genuine match outcome. This is the check that decides whether
 * processOneEvent's one catch block reports 'retryable' instead of routing to the DLQ —
 * matchTrusteeByName and resolveNameCollisionByScoring return (rather than throw) for business
 * outcomes, so that catch is the only place in the per-event pipeline a transient error from
 * either call can surface (see cams-o5gh for the bug this fixed when a second, independent
 * recheck was still required). throwIfTransientSoftCloseFailure below calls this function
 * directly; resolveNameCollisionByScoring in trustee-match.helpers.ts reimplements the same
 * isTooManyRequestsError/isGatewayTimeoutError check independently rather than importing it,
 * since that module is imported BY this one and importing back here would be circular.
 *
 * Exported for testing only — no production importer outside this module; every other
 * production caller reaches this indirectly through processOneEvent's catch block.
 */
export function isTransientInfraError(error: unknown): boolean {
  return isTooManyRequestsError(error) || isGatewayTimeoutError(error);
}

const SENTINEL_PROFESSIONAL_ID = 'XX-99999';

/**
 * Resolves the ACMS professional ID for a trustee that matches the case's group designator.
 * A trustee may have multiple professional IDs across different ACMS groups; we must select
 * the one whose GROUP_DESIGNATOR prefix matches the group owning the case's court division.
 * Returns SENTINEL_PROFESSIONAL_ID ('XX-99999') and logs a warning when no match is found,
 * so the downstream event is always queued. Sentinel rows can be identified and remediated
 * when the trustee's professional ID is later corrected in the system.
 */
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
 * Throws softCloseError when it is transient (Cosmos RU throttling or a read/write timeout),
 * logging a warning first. Aborts BEFORE the new appointment is created so the caller's event
 * propagates to the per-event catch in processAppointments, which already routes
 * isTooManyRequestsError/isGatewayTimeoutError to retryableEvents. Nothing has been written for
 * this event, so nothing is corrupt; a later retry re-reads state and does close-then-create
 * cleanly. Returns (does not throw) when softCloseError is a permanent failure — the caller is
 * responsible for logging and proceeding with the create in that case.
 *
 * Exported for testing only — no production importer outside this module.
 */
export function throwIfTransientSoftCloseFailure(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  existingAppointment: { trusteeId: string; assignedOn: string },
  trusteeId: string,
  softCloseError: CamsError,
): void {
  if (!isTransientInfraError(softCloseError)) {
    return;
  }
  context.logger.warn(
    MODULE_NAME,
    `Transient soft-close failure for case ${event.caseId} — old trustee ${existingAppointment.trusteeId} appointment not closed. Aborting before create; event will be retried.`,
    {
      caseId: event.caseId,
      oldTrusteeId: existingAppointment.trusteeId,
      newTrusteeId: trusteeId,
      assignedOn: existingAppointment.assignedOn,
      error: softCloseError.message,
    },
  );
  throw softCloseError;
}

/**
 * Upserts a new active case appointment and logs the outcome. Shared by both call sites in
 * applyResolvedTrustee (the soft-close-failed path and the normal create path), which write an
 * identical payload and log line — extracted so a future field addition to the payload cannot
 * drift between the two copies.
 *
 * Exported for testing only — no production importer outside this module.
 */
export async function createNewAppointment(
  context: ApplicationContext,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  assignedOn: string,
): Promise<void> {
  await appointmentsRepo.upsert({
    caseId: event.caseId,
    trusteeId,
    assignedOn,
    appointedDate: event.appointedDate,
  });
  context.logger.info(
    MODULE_NAME,
    `Created case appointment for case ${event.caseId}, trustee ${trusteeId}`,
  );
}

/**
 * Soft-closes the case's existing active appointment (a different trustee than the one being
 * newly assigned) and creates the new appointment, handling the soft-close outcome:
 *  - Transient soft-close failure (Cosmos RU throttling, a read/write timeout) throws, aborting
 *    BEFORE the new appointment is created, so the caller's event is retried from a clean state.
 *  - Permanent soft-close failure still creates the new appointment (manual replay required for
 *    the stale old appointment) and reports it via the returned dlqFailure.
 *  - On success, notifies downstream of the closed appointment (when the feature flag is
 *    enabled) and reports closed:true.
 * Downstream notification is gated on soft-close success — firing a close event for a soft-close
 * that never actually happened in Cosmos would misinform downstream, and skips
 * resolveGroupMatchedProfessionalId's gateway reads on a path that's already failing.
 *
 * Exported for testing only — no production importer outside this module.
 */
export async function softCloseExistingAppointment(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  existingAppointment: CaseAppointment,
  trusteeId: string,
  assignedOn: string,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
  syncedCase: SyncedCase,
): Promise<{ closed: boolean; dlqFailure: TrusteeAppointmentSyncError | null }> {
  const now = new Date().toISOString();
  let softCloseError: CamsError | null = null;
  try {
    await appointmentsRepo.updateCaseAppointment({ ...existingAppointment, unassignedOn: now });
  } catch (error) {
    softCloseError = getCamsError(error, MODULE_NAME);
  }

  if (softCloseError) {
    // Aborts BEFORE creating the new appointment when the failure is transient (Cosmos RU
    // throttling, a read/write timeout), letting it propagate to the per-event catch in
    // processAppointments, which already routes isTooManyRequestsError/isGatewayTimeoutError
    // to retryableEvents (see that catch block for the exact mechanism this mirrors). Nothing
    // has been written for this event, so nothing is corrupt; a later retry re-reads state and
    // does close-then-create cleanly. Creating the new appointment here regardless of close
    // outcome (the old behavior) left two simultaneously active appointments when the close
    // failed — a real data-integrity defect, not just a missed optimization.
    throwIfTransientSoftCloseFailure(
      context,
      event,
      existingAppointment,
      trusteeId,
      softCloseError,
    );
    context.logger.error(
      MODULE_NAME,
      `Soft-close failed for case ${event.caseId} — old trustee ${existingAppointment.trusteeId} appointment not closed. New appointment will still be created. Manual replay required.`,
      {
        caseId: event.caseId,
        oldTrusteeId: existingAppointment.trusteeId,
        newTrusteeId: trusteeId,
        assignedOn: existingAppointment.assignedOn,
        error: softCloseError.message,
      },
    );
  } else {
    context.logger.info(
      MODULE_NAME,
      `Soft-closed case appointment for case ${event.caseId}, old trustee ${existingAppointment.trusteeId}`,
    );
  }

  if (!softCloseError && context.featureFlags['downstream-trustee-appointments-enabled']) {
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
      mismatchReason: SoftCloseWriteFailed,
      matchCandidates: [],
    };
    await createNewAppointment(context, appointmentsRepo, event, trusteeId, assignedOn);
    return { closed: false, dlqFailure };
  }

  return { closed: true, dlqFailure: null };
}

/**
 * Applies the resolved trustee to the case and manages appointment history.
 * Shared logic for both normal matching and fuzzy matching success paths.
 *
 * assignedOn is part of upsert()'s natural key (documentType + caseId + trusteeId + assignedOn —
 * see trustee-case-appointments.mongo.repository.ts). It must be stable across repeated
 * processing of the same logical event, or a retry/replay produces a different assignedOn and
 * the natural-key upsert inserts a second, duplicate-active row instead of replacing the first.
 * event.appointedDate is derived from a fixed field in the source DXTR transaction record (see
 * cases.dxtr.gateway.ts), so it is stable across retries, unlike wall-clock time — there is no
 * safe fallback to wall-clock, since that would differ on every retry/replay of the same event
 * and defeat the natural key. parseDxtrDate (cases.dxtr.gateway.ts) returns undefined for a
 * blank/'000000'/malformed source date, which is a genuine, if rare, DXTR data-quality condition,
 * not something to silently paper over — this throws instead, loudly and unambiguously, so it
 * surfaces rather than risk a duplicate active appointment.
 */
async function applyResolvedTrustee(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  trusteeId: string,
  syncedCase: SyncedCase,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
): Promise<TrusteeAppointmentSyncError | null> {
  if (!event.appointedDate) {
    context.logger.error(
      MODULE_NAME,
      `TRUSTEE APPOINTMENT DATA INTEGRITY ERROR: case ${event.caseId}, trustee ${trusteeId} — ` +
        `event.appointedDate is missing/unparseable. Refusing to fall back to wall-clock time ` +
        `for assignedOn, since that would break upsert()'s natural-key idempotency across ` +
        `retries and could create a duplicate active appointment. This event cannot be safely ` +
        `processed until its source DXTR appointment date is corrected.`,
    );
    throw new CamsError(MODULE_NAME, {
      message: `Case ${event.caseId}, trustee ${trusteeId}: missing/unparseable appointedDate, cannot safely derive assignedOn.`,
    });
  }
  const assignedOn = event.appointedDate;

  const existingAppointment = await appointmentsRepo.getActiveByCaseId(event.caseId);

  if (existingAppointment && existingAppointment.trusteeId === trusteeId) {
    // getActiveByCaseId only reads casePartition. upsert()/updateCaseAppointment() write
    // casePartition then trusteePartition sequentially and non-transactionally — a transient
    // failure on the trusteePartition write after casePartition already succeeded gets this
    // event requeued as retryable, and without this check the retry would land here and
    // silently treat the case as already handled, permanently diverging trusteePartition (which
    // backs a trustee's case list) with no telemetry or DLQ trace. Repair it directly via the
    // same idempotent primitive migrate-case-appointments.ts's heal job already uses, rather
    // than re-running the full soft-close/create sequence, which casePartition already proves
    // is unnecessary here.
    const inSync = await appointmentsRepo.existsInTrusteePartition(
      event.caseId,
      trusteeId,
      existingAppointment.assignedOn,
    );
    if (!inSync) {
      context.logger.error(
        MODULE_NAME,
        `TRUSTEE PARTITION DIVERGENCE: case ${event.caseId}, trustee ${trusteeId} is active in ` +
          `casePartition but missing from trusteePartition — a prior dual-write must have failed ` +
          `partway through. Repairing trusteePartition now.`,
      );
      await appointmentsRepo.replaceOneInTrusteePartition(
        { caseId: event.caseId, trusteeId, assignedOn: existingAppointment.assignedOn },
        { ...existingAppointment, documentType: 'CASE_APPOINTMENT' },
      );
    }
    return null; // Same trustee already active — nothing further to do
  }

  if (existingAppointment && existingAppointment.trusteeId !== trusteeId) {
    const { closed, dlqFailure } = await softCloseExistingAppointment(
      context,
      event,
      existingAppointment,
      trusteeId,
      assignedOn,
      appointmentsRepo,
      syncedCase,
    );
    if (!closed) {
      return dlqFailure;
    }
  }

  // Mirror-direction check to the same-trustee branch's existsInTrusteePartition repair above.
  // A prior reassignment attempt for this case may have soft-closed the OLD trustee's
  // casePartition row (so getActiveByCaseId above now sees nothing active, existingAppointment is
  // null) but then failed transiently on that same old trustee's trusteePartition write — leaving
  // a stranded active trusteePartition row behind. Checked unconditionally here (not just inside
  // the reassignment branch above) since that is exactly the retry state this repairs: this
  // event's own reassignment attempt already ran once and casePartition no longer shows it.
  const strandedRow = await appointmentsRepo.findStrandedActiveInTrusteePartition(
    event.caseId,
    trusteeId,
  );
  if (strandedRow) {
    context.logger.error(
      MODULE_NAME,
      `TRUSTEE PARTITION DIVERGENCE: case ${event.caseId}, old trustee ${strandedRow.trusteeId} ` +
        `is stranded active in trusteePartition after being reassigned to ${trusteeId} — a prior ` +
        `dual-write must have failed partway through soft-closing the old trustee's row. ` +
        `Repairing trusteePartition now.`,
    );
    // casePartition already has this row's authoritative unassignedOn from the original
    // (partially-failed) soft-close attempt — copy it as-is, the same convention the
    // same-trustee branch above uses, rather than fabricating a new close timestamp here.
    const caseHistory = await appointmentsRepo.getByCaseId(event.caseId);
    const closedCaseRow = caseHistory.find(
      (a) => a.trusteeId === strandedRow.trusteeId && a.assignedOn === strandedRow.assignedOn,
    );
    await appointmentsRepo.replaceOneInTrusteePartition(
      {
        caseId: event.caseId,
        trusteeId: strandedRow.trusteeId,
        assignedOn: strandedRow.assignedOn,
      },
      { ...(closedCaseRow ?? strandedRow), documentType: 'CASE_APPOINTMENT' },
    );
  }

  await createNewAppointment(context, appointmentsRepo, event, trusteeId, assignedOn);

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
      assignedOn,
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
 * Shared auto-link sequence for the perfect-match auto-match path: apply the resolved trustee,
 * persist a new variation (when this trusteeId wasn't already resolved via the variation bucket),
 * log the outcome, and update the audit entry. Does NOT write a TrusteeMatchVerification document
 * — an auto-matched case was never reviewed by a human, so there is nothing to record in the
 * human-review queue; doing so previously mislabeled these as "Verified" in the Data Verification
 * UI even though no one had looked at them. Callers remain responsible for successCount and any
 * control-flow (e.g. continue) since those are not part of this shared side-effect sequence.
 *
 * Returns the soft-close DLQ failure, if any, rather than mutating a shared dlqMessages array —
 * a permanent soft-close failure means createNewAppointment never ran (see applyResolvedTrustee),
 * so this event was NOT actually auto-linked, yet the caller still needs to know about the DLQ
 * failure. Returning it lets processAppointments' aggregation loop be the one place that decides
 * what to do with it, instead of a side channel a reader could miss when scanning that loop.
 *
 * Takes MatchContext (absorbing context/event/fingerprint/variant/audit/scenarioDistribution, plus
 * caseAppointmentsRepo/variationRepo via ctx.deps) and only the values genuinely specific to this
 * call site: trusteeId, syncedCase, variationTrusteeId, logMessage.
 */
async function autoLinkTrustee(
  ctx: MatchContext,
  syncedCase: SyncedCase,
  trusteeId: string,
  variationTrusteeId: string | null,
  logMessage: string,
): Promise<TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | null> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;
  const { context } = deps;

  const softCloseFailure = await applyResolvedTrustee(
    context,
    event,
    trusteeId,
    syncedCase,
    deps.caseAppointmentsRepo,
  );
  if (!variationTrusteeId) {
    await deps.variationRepo.createVariation(
      createAuditRecord(
        {
          documentType: TRUSTEE_VARIATION_DOCUMENT_TYPE,
          fingerprint,
          variant,
          trusteeId,
        },
        SYSTEM_USER_REFERENCE,
      ),
    );
  }
  context.logger.info(MODULE_NAME, logMessage);
  scenarioDistribution.autoMatchCount++;
  audit.matchOutcome = 'auto-matched';
  audit.matchedTrusteeId = trusteeId;
  audit.appointmentStatus = 'active';
  return softCloseFailure;
}

/**
 * Finds the exact-variant match within an already-fetched fingerprint bucket. A fingerprint
 * (sha256 digest) is never trusted as a unique key on its own — a bucket can hold more than one
 * document, so every lookup must verify by comparing the full variant string for exact equality
 * ("bucket+verify"). Shared by both the TRUSTEE_VARIATION and TrusteeMatchVerification bucket
 * lookups below, which differ only in what they do with the matched entry.
 */
function findByVariant<T extends { variant: string }>(bucket: T[], variant: string): T | undefined {
  return bucket.find((v) => v.variant === variant);
}

/**
 * Guards the "syncedCase is always assigned before a classified mismatch outcome is reached"
 * invariant relied on by processAppointments' surrogate writes (the direct ImperfectMatch call in
 * the try block, and the catch block's NoTrusteeMatch/AmbiguousMatchUnresolved handling), so a
 * future code path that breaks the ordering fails loudly here instead of as an opaque TypeError
 * inside writeSurrogateAppointment.
 *
 * Exported for testing only — no production importer outside this module; called internally
 * from handleClassifiedMismatch below.
 */
export function assertSyncedCase(syncedCase: SyncedCase | undefined): SyncedCase {
  if (!syncedCase) {
    throw new BadRequestError(MODULE_NAME, {
      message: 'Expected syncedCase to be assigned before a classified match error is thrown.',
    });
  }
  return syncedCase;
}

/**
 * Looks up a fingerprint's TrusteeMatchVerification bucket and verifies by variant (see
 * findByVariant). Mirrors matchTrusteeByVariation's shape for the parallel TRUSTEE_VARIATION
 * bucket check.
 */
async function findVerificationBucketEntry(
  verificationRepo: TrusteeMatchVerificationRepository,
  fingerprint: string,
  variant: string,
): Promise<TrusteeMatchVerification | null> {
  const bucket = await verificationRepo.findByFingerprint(fingerprint);
  return findByVariant(bucket, variant) ?? null;
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
  fingerprint: string,
  variant: string,
  inactiveAppointmentStatus?: AppointmentStatus,
): Promise<boolean> {
  const existing = await findVerificationBucketEntry(verificationRepo, fingerprint, variant);
  if (existing && existing.status !== 'pending') {
    return true; // Already resolved — signals a re-verification for match accuracy tracking
  }
  if (existing) {
    await verificationRepo.upsertVerification({
      ...existing,
      mismatchReason,
      matchCandidates,
      inactiveAppointmentStatus,
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
        appointedDate: event.appointedDate,
        taskType: 'trustee-match',
        status: 'pending',
        taskDate: new Date().toISOString(),
        fingerprint,
        variant,
      },
      SYSTEM_USER_REFERENCE,
    );
    await verificationRepo.upsertVerification(doc);
  }
  return false;
}

/**
 * Handles the NoTrusteeMatch and ImperfectMatch classified-mismatch outcomes, which processed
 * identically apart from which TrusteeAppointmentSyncErrorCode is used, which scenario counter
 * increments, and (for NoTrusteeMatch only) setting audit.matchOutcome — ImperfectMatch leaves
 * it at its default, matching the pre-consolidation switch case exactly. Increments
 * reVerificationCount when upsertMatchVerification reports an existing resolved/dismissed
 * document, then writes the case's surrogate appointment.
 *
 * Takes MatchContext plus only the two genuinely per-call values (mismatchReason,
 * matchCandidates) and syncedCase — no writeSurrogateAppointment callback field: since that
 * function is a plain deps-first free function (not a bound class method), this calls it
 * directly via ctx.deps rather than threading a closure through the options object.
 *
 * Exported for testing only — no production importer outside this module; called internally
 * from resolveByScoring and applyMatchOutcome above.
 */
export async function handleClassifiedMismatch(
  ctx: MatchContext,
  syncedCase: SyncedCase | undefined,
  mismatchReason:
    | typeof TrusteeAppointmentSyncErrorCode.NoTrusteeMatch
    | typeof TrusteeAppointmentSyncErrorCode.ImperfectMatch,
  matchCandidates: CandidateScore[],
): Promise<void> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;

  if (mismatchReason === TrusteeAppointmentSyncErrorCode.NoTrusteeMatch) {
    scenarioDistribution.noMatchCount++;
    audit.matchOutcome = 'no-match';
  } else {
    scenarioDistribution.imperfectMatchCount++;
  }

  const isReVerification = await upsertMatchVerification(
    deps.verificationRepo,
    event,
    mismatchReason,
    matchCandidates,
    fingerprint,
    variant,
  );
  if (isReVerification) {
    scenarioDistribution.reVerificationCount++;
  }

  await writeSurrogateAppointment(deps, event, fingerprint, variant, assertSyncedCase(syncedCase));
}

async function handleInactivePerfectMatch(
  ctx: MatchContext,
  trusteeId: string,
  trusteeAppointments: TrusteeAppointment[],
  inactiveMatch: TrusteeAppointment,
  nameScore: number,
): Promise<void> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;
  const trustee = await deps.trusteesRepo.read(trusteeId);
  const addressScore = calculateAddressScore(event.dxtrTrustee.legacy, trustee.public.address);
  // nameScore is already known (the trusteeId came from a fingerprint hit or
  // matchTrusteeByName's exact/fuzzy tiers) - see calculateCandidateScore's
  // nameScoreOverride doc comment for why re-deriving it here via calculateNameScore's discrete
  // firstName/lastName comparison would risk contradicting an already-correct match.
  const phoneScore = calculatePhoneScore(event.dxtrTrustee.legacy?.phone, trustee.public.phone);
  const emailScore = calculateEmailScore(event.dxtrTrustee.legacy?.email, trustee.public.email);
  const candidateScore: CandidateScore = {
    trusteeId,
    trusteeName: trustee.name,
    totalScore: calculateTotalScore({
      addressScore,
      nameScore,
      phoneScore,
      emailScore,
      districtDivisionScore: 100,
      chapterScore: 100,
    }),
    addressScore,
    nameScore,
    phoneScore,
    emailScore,
    districtDivisionScore: 100,
    chapterScore: 100,
    address: trustee.public.address,
    phone: trustee.public.phone,
    email: trustee.public.email,
    appointments: trusteeAppointments,
  };

  const isReVerification = await upsertMatchVerification(
    deps.verificationRepo,
    event,
    TrusteeAppointmentSyncErrorCode.PerfectMatchInactiveStatus,
    [candidateScore],
    fingerprint,
    variant,
    inactiveMatch.status,
  );
  if (isReVerification) scenarioDistribution.reVerificationCount++;
  scenarioDistribution.perfectMatchInactiveCount++;

  deps.context.logger.info(
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
 * Builds the shared repo/gateway bundle threaded through every function below as its first
 * argument, replacing what used to be private fields wired in a class constructor. Plain object,
 * no behavior — factory.get*(context) calls are unchanged from the prior constructor.
 */
function createDeps(context: ApplicationContext) {
  return {
    context,
    casesGateway: factory.getCasesGateway(context),
    casesRepo: factory.getCasesRepository(context),
    appointmentsRepo: factory.getTrusteeAppointmentsRepository(context),
    caseAppointmentsRepo: factory.getTrusteeCaseAppointmentsRepository(context),
    trusteesRepo: factory.getTrusteesRepository(context),
    verificationRepo: factory.getTrusteeMatchVerificationRepository(context),
    runtimeStateRepo: factory.getTrusteeAppointmentsSyncStateRepo(context),
    petitionSyncStateRepo: factory.getTrusteePetitionSyncStateRepo(context),
    variationRepo: factory.getTrusteeVariationRepository(context),
  };
}

type SyncTrusteeCaseAppointmentsDeps = ReturnType<typeof createDeps>;

/**
 * Looks up a fingerprint's TRUSTEE_VARIATION bucket and verifies by variant (see
 * findByVariant). Returns the resolved trusteeId on a hit, or null on a miss (never
 * encountered before, or only a hash-bucket collision with a genuinely different variant).
 */
async function matchTrusteeByVariation(
  deps: SyncTrusteeCaseAppointmentsDeps,
  fingerprint: string,
  variant: string,
): Promise<string | null> {
  const bucket = await deps.variationRepo.findByFingerprint(fingerprint);
  return findByVariant(bucket, variant)?.trusteeId ?? null;
}

/**
 * Looks up a fingerprint's TrusteeMatchVerification bucket and verifies by variant (see
 * findByVariant, same shape as matchTrusteeByVariation above). Returns true when a bucket
 * entry exists with a matching variant AND status 'pending' — i.e. this case is a new member
 * of an already-known, still-unresolved mismatch, so the caller can short-circuit full
 * re-matching.
 */
async function hasPendingVerificationForVariation(
  deps: SyncTrusteeCaseAppointmentsDeps,
  fingerprint: string,
  variant: string,
): Promise<boolean> {
  const bucket = await deps.verificationRepo.findByFingerprint(fingerprint);
  return findByVariant(bucket, variant)?.status === 'pending';
}

// Guards against malformed CS_CHAPTER values reaching a CASE_APPOINTMENT write on this hot
// path (invoked for every mismatched/imperfect/no-match event), the same class of dirty
// upstream data this slice hardens against elsewhere (see the address-parsing rewrite).
// Thrown BadRequestErrors are caught by processAppointments' per-event try/catch and routed
// to the DLQ rather than corrupting a CASE_APPOINTMENT document with an unvalidated string.
function assertValidChapter(caseId: string, chapter: string): CaseChapter {
  if (!VALID_CASE_CHAPTERS.includes(chapter as CaseChapter)) {
    throw new BadRequestError(MODULE_NAME, {
      message: `Invalid chapter value "${chapter}" for case ${caseId}.`,
      data: { caseId, chapter },
    });
  }
  return chapter as CaseChapter;
}

/**
 * Writes a surrogate CaseAppointment (trusteeId = fingerprint, isSurrogate: true) so that
 * "which cases are affected by this pending mismatch" is a native single-partition query.
 * A surrogate is a membership marker for a pending mismatch, NOT the case's appointment — a
 * case may have a real active appointment (a previously verified trustee) AND a surrogate
 * active at the same time, e.g. when a new, unmatched DXTR event arrives for a case that
 * already has a good trustee. getActiveByCaseId excludes surrogates (and sentinel rows) from
 * its query, so the real appointment is unaffected by this write. The write is therefore
 * unconditional with respect to any existing real appointment.
 *
 * Idempotency is scoped to this exact fingerprint: re-processing the same unresolved event
 * must not create a duplicate surrogate. upsert's natural key includes assignedOn (see
 * trustee-case-appointments.mongo.repository.ts), so assignedOn must be derived from the
 * event's stable appointedDate — never wall-clock time, which would differ on every retry of
 * the same event and mint a new, duplicate surrogate row under the same fingerprint each time
 * (falling back to `?? now` here would be exactly the bug applyResolvedTrustee's own docblock
 * above warns against). Refuses the same way applyResolvedTrustee does when
 * appointedDate is missing/unparseable, so the event surfaces via the DLQ instead of silently
 * proceeding. Two genuinely different pending mismatches on the same case each still get their
 * own surrogate row.
 */
async function writeSurrogateAppointment(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  fingerprint: string,
  variant: string,
  syncedCase: SyncedCase,
): Promise<void> {
  if (!event.appointedDate) {
    deps.context.logger.error(
      MODULE_NAME,
      `TRUSTEE APPOINTMENT DATA INTEGRITY ERROR: case ${event.caseId}, fingerprint ${fingerprint} — ` +
        `event.appointedDate is missing/unparseable. Refusing to fall back to wall-clock time ` +
        `for the surrogate's assignedOn, since that would break upsert()'s natural-key ` +
        `idempotency across retries and mint a duplicate surrogate row every time this event is ` +
        `reprocessed. This event cannot be safely processed until its source DXTR appointment ` +
        `date is corrected.`,
    );
    throw new CamsError(MODULE_NAME, {
      message: `Case ${event.caseId}, fingerprint ${fingerprint}: missing/unparseable appointedDate, cannot safely derive surrogate assignedOn.`,
    });
  }

  const existingAppointments = await deps.caseAppointmentsRepo.getByCaseId(event.caseId);
  const alreadySurrogateForThisFingerprint = existingAppointments.some(
    (appointment) =>
      appointment.isSurrogate && appointment.trusteeId === fingerprint && !appointment.unassignedOn,
  );
  if (alreadySurrogateForThisFingerprint) {
    return;
  }

  await deps.caseAppointmentsRepo.upsert({
    caseId: event.caseId,
    trusteeId: fingerprint,
    assignedOn: event.appointedDate,
    appointedDate: event.appointedDate,
    isSurrogate: true,
    variant,
    dateFiled: syncedCase.dateFiled,
    chapter: assertValidChapter(event.caseId, syncedCase.chapter),
    courtDivisionCode: syncedCase.courtDivisionCode,
  });
}

async function resolveSyncState<D extends RuntimeStateDocumentType>(
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

async function getAppointmentEvents(
  deps: SyncTrusteeCaseAppointmentsDeps,
  lastSyncDate?: string,
  reset?: boolean,
  overrideRuntimeState?: TrusteeAppointmentsSyncState,
) {
  const { context } = deps;
  try {
    let syncState: TrusteeAppointmentsSyncState;
    if (overrideRuntimeState !== undefined) {
      context.logger.info(MODULE_NAME, 'Using overrideRuntimeState from start message.');
      syncState = overrideRuntimeState;
    } else {
      if (!lastSyncDate && reset) {
        context.logger.info(MODULE_NAME, 'reset flag detected — starting from default sync date.');
      }
      syncState = await resolveSyncState(
        'TRUSTEE_APPOINTMENTS_SYNC_STATE',
        deps.runtimeStateRepo,
        lastSyncDate,
        reset,
      );
    }

    const petitionSyncState = await resolveSyncState(
      'TRUSTEE_PETITION_SYNC_STATE',
      deps.petitionSyncStateRepo,
      lastSyncDate,
      reset,
    );

    const [trusteeResult, petitionResult] = await Promise.allSettled([
      deps.casesGateway.getTrusteeAppointments(context, syncState.lastSyncDate),
      deps.casesGateway.getTrusteePetitionEvents(context, petitionSyncState.lastSyncDate),
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
 * Per-event state shared by the name/scoring resolution steps below. Built once per event, after
 * fingerprint/variant/audit/scenarioDistribution already exist — deliberately does NOT include
 * syncedCase, which is not yet known at context-build time (before the case-sync-check stage
 * runs). Baking a not-yet-known value into a shared context would reintroduce the exact "field
 * that may or may not be populated" footgun assertSyncedCase's runtime guard exists to catch;
 * syncedCase is threaded explicitly through function parameters and return values instead.
 */
type MatchContext = {
  deps: SyncTrusteeCaseAppointmentsDeps;
  event: TrusteeAppointmentSyncEvent;
  fingerprint: string;
  variant: string;
  audit: MatchAuditEntry;
  scenarioDistribution: ScenarioDistribution;
};

/**
 * Outcome of resolveTrusteeIdByName/resolveByScoring: either a trusteeId to proceed with (plus
 * the nameScore already established for it, carried through so applyMatchOutcome's downstream
 * scoring doesn't need to independently re-derive name confidence - see NameMatchResult's doc
 * comment in trustee-match.helpers.ts for why that re-derivation can diverge from what actually
 * matched), or a signal that the step already fully handled the event (wrote its
 * audit/verification/surrogate) and the caller should treat this event as done for this pass.
 */
type NameResolution =
  { outcome: 'resolved'; trusteeId: string; nameScore: number } | { outcome: 'handled' };

/**
 * Outcome of applyMatchOutcome (perfect/inactive/imperfect-match stage). 'auto-linked' counts
 * toward successCount; 'handled' means some other terminal path (inactive-match or a classified
 * mismatch) already ran. A separate type from NameResolution rather than a shared union — this
 * stage never reports a trusteeId back upward, so its vocabulary shouldn't carry a case that
 * can't occur here, the same reasoning as keeping SoftCloseWriteFailed/AmbiguousNameMatch out of
 * TrusteeAppointmentSyncErrorCode.
 * 'auto-linked' carries an optional dlqFailure: a permanent soft-close failure means
 * createNewAppointment never ran (see autoLinkTrustee/applyResolvedTrustee), so the event wasn't
 * actually linked even though this stage still reports 'auto-linked' for successCount purposes —
 * the caller (processOneEvent/processAppointments) is responsible for also routing dlqFailure to
 * the DLQ, keeping that routing visible in the one aggregation loop rather than a side mutation.
 */
type MatchOutcomeResolution =
  | {
      outcome: 'auto-linked';
      dlqFailure: TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | null;
    }
  | { outcome: 'handled' };

/**
 * Resolves a trusteeId by name when no fingerprint pre-match exists. Extracted
 * from processAppointments' main loop (cams-joiwy follow-on) — replaces what was previously two
 * nested switch statements inline in that function with a single call site there, since sonarjs's
 * cognitive-complexity rule counts the switch/case/nesting-depth cost at the point a branching
 * construct is written, not how large its body is; moving whole decision procedures out (not just
 * case bodies) is what actually reduces the caller's measured complexity.
 *
 * NEVER catches anything, for any reason, and never calls isTransientInfraError/
 * isTooManyRequestsError/isGatewayTimeoutError. Transient-error classification happens exactly
 * once, at processAppointments' own outer catch — a thrown infra error from any repo call inside
 * this function (or resolveByScoring below) propagates unhandled through the await chain exactly
 * like a synchronous throw through nested calls, all the way up to that one boundary.
 */
async function resolveTrusteeIdByName(
  ctx: MatchContext,
  syncedCase: SyncedCase,
): Promise<NameResolution> {
  const { deps, event } = ctx;
  const nameMatch = await matchTrusteeByName(deps.context, event.dxtrTrustee, event.courtId);

  switch (nameMatch.kind) {
    case 'resolved':
      return {
        outcome: 'resolved',
        trusteeId: nameMatch.trusteeId,
        nameScore: nameMatch.nameScore,
      };

    case 'no-match':
      await handleClassifiedMismatch(
        ctx,
        syncedCase,
        TrusteeAppointmentSyncErrorCode.NoTrusteeMatch,
        [],
      );
      return { outcome: 'handled' };

    case 'ambiguous':
      return resolveByScoring(
        ctx,
        syncedCase,
        nameMatch.matchCandidates.map((c) => c.trusteeId),
      );

    default: {
      const _exhaustive: never = nameMatch;
      throw new Error(`Unhandled NameMatchResult kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Resolves an ambiguous name collision by fuzzy-match scoring. Extracted alongside
 * resolveTrusteeIdByName above — see that function's doc comment for why (whole-procedure
 * extraction, not case-body extraction) and the same never-catch rule, which applies here too.
 */
async function resolveByScoring(
  ctx: MatchContext,
  syncedCase: SyncedCase,
  candidateTrusteeIds: string[],
): Promise<NameResolution> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;
  const scoringOutcome = await resolveNameCollisionByScoring(
    deps.context,
    event,
    candidateTrusteeIds,
  );

  switch (scoringOutcome.kind) {
    // A clear scoring winner (score > FUZZY_MATCH_SCORE_THRESHOLD, gap >= FUZZY_MATCH_MIN_GAP,
    // isAppointmentMatch already checked by resolveNameCollisionByScoring itself) is treated the
    // same as any other resolved trusteeId — the caller (processOneEvent) routes it through
    // applyMatchOutcome, which re-verifies isAppointmentMatch and auto-links on a pass or falls
    // through to ImperfectMatch human review on a miss. Minimizes human review wherever the
    // existing scoring already gives high confidence, whether that confidence comes from
    // disambiguating a raw name collision (this path) or from a fuzzy name-normalization match
    // with only one candidate (matchTrusteeByName's fallback in trustee-match.helpers.ts).
    case 'resolved': {
      // The winner's own nameScore, already computed with real data by calculateCandidateScore
      // inside resolveNameCollisionByScoring/calculateNameScore - a genuine per-candidate score,
      // not a re-derivation of an already-known match (contrast with matchTrusteeByName's fuzzy
      // fallback, which fixes its nameScore at 100 since it isn't scoring between candidates,
      // just confirming one already-identified match). Falls back to 100 only in the
      // (should-never-happen) case the winner is somehow absent from its own candidateScores.
      const winnerScore = scoringOutcome.candidateScores.find(
        (c) => c.trusteeId === scoringOutcome.trusteeId,
      );
      return {
        outcome: 'resolved',
        trusteeId: scoringOutcome.trusteeId,
        nameScore: winnerScore?.nameScore ?? 100,
      };
    }

    case 'no-match': {
      // NOT the same as NoTrusteeMatch: matchTrusteeByName found more than one raw name
      // candidate — scoring simply couldn't load any of their records. Routing this to
      // NoTrusteeMatch would misreport "no trustee matched this name" and (via a
      // AmbiguousMatchUnresolved-style reclassification instead) would make the Data
      // Verification UI's "Multiple Match" label appear next to zero displayed candidates. See
      // TrusteeAppointmentSyncErrorCode.CandidateLoadFailed's doc comment.
      deps.context.logger.warn(
        MODULE_NAME,
        `Fuzzy matching failed: no candidate data could be loaded for case ${event.caseId}.`,
      );
      scenarioDistribution.candidateLoadFailedCount++;
      const isReVerification = await upsertMatchVerification(
        deps.verificationRepo,
        event,
        TrusteeAppointmentSyncErrorCode.CandidateLoadFailed,
        [],
        fingerprint,
        variant,
      );
      if (isReVerification) scenarioDistribution.reVerificationCount++;
      audit.matchOutcome = 'candidate-load-failed';
      await writeSurrogateAppointment(deps, event, fingerprint, variant, syncedCase);
      return { outcome: 'handled' };
    }

    case 'unresolved': {
      deps.context.logger.warn(MODULE_NAME, `Fuzzy matching failed for case ${event.caseId}.`);
      scenarioDistribution.multipleMatchCount++;
      const isReVerification = await upsertMatchVerification(
        deps.verificationRepo,
        event,
        TrusteeAppointmentSyncErrorCode.AmbiguousMatchUnresolved,
        scoringOutcome.candidateScores,
        fingerprint,
        variant,
      );
      if (isReVerification) scenarioDistribution.reVerificationCount++;
      audit.matchOutcome = 'ambiguous-match-unresolved';
      await writeSurrogateAppointment(deps, event, fingerprint, variant, syncedCase);
      return { outcome: 'handled' };
    }

    default: {
      const _exhaustive: never = scoringOutcome;
      throw new Error(`Unhandled ScoringOutcome kind: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Resolves the perfect/inactive/high-scoring/imperfect-match outcome once a trusteeId is known.
 * Extracted from processAppointments' main loop for the same reason as resolveTrusteeIdByName/
 * resolveByScoring above — whole-procedure extraction removes the if/else chain and its nesting
 * penalty from the measured function, not merely its case bodies. Same never-catch rule applies:
 * this function never catches anything, and never calls isTransientInfraError/
 * isTooManyRequestsError/isGatewayTimeoutError. A thrown infra error from any repo call inside it
 * propagates unhandled up to processAppointments' one outer catch, exactly like a synchronous
 * throw through nested calls.
 */
async function applyMatchOutcome(
  ctx: MatchContext,
  syncedCase: SyncedCase,
  trusteeId: string,
  variationTrusteeId: string | null,
  nameScore: number,
): Promise<MatchOutcomeResolution> {
  const { deps, event, fingerprint, variant, audit } = ctx;
  const { context } = deps;
  const trusteeAppointments = await deps.appointmentsRepo.getTrusteeAppointments(trusteeId);

  if (
    isAppointmentMatch(trusteeAppointments, event.courtId, event.courtDivisionCode, event.chapter)
  ) {
    const dlqFailure = await autoLinkTrustee(
      ctx,
      syncedCase,
      trusteeId,
      variationTrusteeId,
      `Perfect match: case ${event.caseId} auto-linked to trustee ${trusteeId}`,
    );
    return { outcome: 'auto-linked', dlqFailure };
  }

  const inactiveMatch = findInactivePerfectMatch(
    trusteeAppointments,
    event.courtId,
    event.courtDivisionCode,
    event.chapter,
  );

  if (inactiveMatch) {
    await handleInactivePerfectMatch(ctx, trusteeId, trusteeAppointments, inactiveMatch, nameScore);
    await writeSurrogateAppointment(deps, event, fingerprint, variant, syncedCase);
    return { outcome: 'handled' };
  }

  const trustee = await deps.trusteesRepo.read(trusteeId);
  const candidateScore = calculateCandidateScore(
    context,
    event.dxtrTrustee,
    event.courtId,
    event.courtDivisionCode,
    event.chapter,
    trustee,
    trusteeAppointments,
    nameScore,
  );

  // No no-review auto-match on totalScore alone: isAppointmentMatch above already ruled out any
  // record that satisfies court+division+chapter together, so a same-record requirement can
  // never hold here — every single-candidate non-perfect-match falls through to ImperfectMatch
  // below for human review regardless of how high totalScore is. (CAMS-880: chapterScore is now
  // scoped to division-matching appointments — see calculateChapterScore's doc comment — so the
  // score itself no longer inflates via two different appointment records either, but the review
  // decision here still doesn't lean on totalScore alone.)
  audit.matchOutcome = 'imperfect-match';
  audit.matchedTrusteeId = trusteeId;
  audit.scoringBreakdown = {
    districtDivisionScore: candidateScore.districtDivisionScore,
    chapterScore: candidateScore.chapterScore,
  };

  await handleClassifiedMismatch(ctx, syncedCase, TrusteeAppointmentSyncErrorCode.ImperfectMatch, [
    candidateScore,
  ]);
  return { outcome: 'handled' };
}

/**
 * Outcome of processOneEvent, reported back to processAppointments' thin aggregation loop:
 *  - 'success': count toward successCount (an auto-linked match). May also
 *    carry a non-null dlqFailure — an auto-linked match whose soft-close permanently failed still
 *    reports 'success' (the name/scoring resolution itself succeeded), but processAppointments
 *    must also route dlqFailure to dlqMessages, in the same aggregation loop as every other DLQ
 *    write, rather than that write happening invisibly inside autoLinkTrustee.
 *  - 'not-yet-synced': push to notYetSyncedEvents (case not yet synced by sync-cases).
 *  - 'retryable': push to retryableEvents (transient infra error — not a genuine match failure).
 *  - 'dlq': push the given message to dlqMessages (a genuinely unclassified error).
 *  - 'none': the event was fully handled by some other terminal path (moved-case,
 *    verification-bucket-hit, a classified mismatch/inactive-match, or imperfect-match) that
 *    already performed its own side effects and needs no loop-level bookkeeping.
 * scenarioDistribution and audit logging are NOT part of this type: both are updated by
 * reference/side effect throughout processOneEvent and its callees (the same convention already
 * used by MatchContext), so the loop does not need this outcome to carry them.
 */
type EventOutcome =
  | {
      kind: 'success';
      dlqFailure: TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | null;
    }
  | { kind: 'not-yet-synced' }
  | { kind: 'retryable' }
  | { kind: 'dlq'; message: TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent }
  | { kind: 'none' };

const DXTR_PROF_CODE_NO_TRUSTEE_APPOINTED = '00000';
const DXTR_PROF_CODE_ID_UNAVAILABLE = '99999';

// Substrings observed in real DXTR data standing in for "no trustee"/"placeholder" on
// sentinel-coded records — e.g. "No Trustee", "TRUSTEE NOT APPOINTED", "Awaiting Trustee
// Assignment", "Not Assigned - XX", "For Internal Use Only", "CHAPTER 11 - XX". Scoped strictly
// to what's been evidenced; do not add speculative variants without direct evidence.
const BOGUS_TRUSTEE_NAME_KEYWORDS = [
  'trustee',
  'assign',
  'chapter',
  'internal use',
  'not appointed',
];

/**
 * True when a sentinel-coded record's name is itself a bogus/administrative placeholder rather
 * than a genuine trustee name (e.g. "No Trustee", "CHAPTER 11 - XX") — checked against lastName,
 * falling back to fullName (both via normalizeName, so a whitespace-only lastName correctly falls
 * back to fullName rather than being treated as present). Must ONLY be evaluated when the event's
 * profCode is already a known sentinel value (see isSentinelWithNoIdentity below): a genuine
 * trustee's name or firm name can plausibly contain one of these substrings (e.g. a name suffixed
 * "(TR)" wouldn't match, but nothing rules out a real name containing "Trustee"), so this check
 * alone must never be disqualifying — isSentinelWithNoIdentity also requires the absence of real
 * contact info before treating a bogus-looking name as disqualifying.
 */
function isBogusTrusteeName(event: TrusteeAppointmentSyncEvent): boolean {
  const { dxtrTrustee } = event;
  const name = (
    normalizeName(dxtrTrustee.lastName ?? '') || normalizeName(dxtrTrustee.fullName ?? '')
  ).toLowerCase();
  return BOGUS_TRUSTEE_NAME_KEYWORDS.some((keyword) => name.includes(keyword));
}

/**
 * True when dxtrTrustee.legacy carries any usable contact info — address, phone, or email.
 * Shared by resolveSkipReason and isSentinelWithNoIdentity so what counts as "usable contact"
 * can't diverge between the two.
 */
function hasUsableContact(legacy: TrusteeAppointmentSyncEvent['dxtrTrustee']['legacy']): boolean {
  return Boolean(
    legacy?.address1 ||
    legacy?.address2 ||
    legacy?.address3 ||
    legacy?.cityStateZipCountry ||
    legacy?.phone ||
    legacy?.email,
  );
}

/**
 * Which pre-match short-circuit rule, if any, disqualifies this event from matching.
 * 'empty-demographics' is a totally blank record; 'sentinel-bogus-name' is a sentinel-coded
 * record whose populated name is itself a bogus/administrative placeholder. Kept distinct so
 * callers can log/count each condition accurately instead of conflating "blank record" with
 * "populated-but-fake name" under one message/counter.
 */
type SkipReason = 'empty-demographics' | 'sentinel-bogus-name' | null;

/**
 * Determines whether dxtrTrustee carries no usable demographics at all — blank fullName (see
 * normalizeName) AND no legacy/contact fields (address, phone, email) either — or is a sentinel-
 * coded record whose name is itself a bogus placeholder. Checked before matchTrusteeByName in
 * processOneEvent: either condition means the event cannot be safely attributed to a trustee and
 * must never reach matching or verification. See ScenarioDistribution's doc comments for each
 * counter this feeds.
 */
function resolveSkipReason(event: TrusteeAppointmentSyncEvent): SkipReason {
  const { dxtrTrustee } = event;
  const hasName = Boolean(normalizeName(dxtrTrustee.fullName ?? ''));
  const hasContact = hasUsableContact(dxtrTrustee.legacy);
  if (!hasName && !hasContact) {
    return 'empty-demographics';
  }

  if (
    isSentinelWithNoIdentity(event, DXTR_PROF_CODE_NO_TRUSTEE_APPOINTED) ||
    isSentinelWithNoIdentity(event, DXTR_PROF_CODE_ID_UNAVAILABLE)
  ) {
    return hasName ? 'sentinel-bogus-name' : 'empty-demographics';
  }

  return null;
}

/**
 * True when event.profCode equals the given sentinel value (DXTR can supply an incorrect ACMS
 * professional code, so it must never be trusted as an auto-link identity signal — profCode is
 * used here only as this negative signal, never to pick which trustee an event belongs to) AND
 * the record's name/contact don't establish a real
 * identity: either nothing at all (no usable fullName per normalizeName — the same presence
 * check resolveSkipReason itself uses, not just a blank firstName, which DXTR can leave
 * unset even when fullName is populated — and no usable contact info per hasUsableContact), or a
 * name that is itself a bogus/administrative placeholder (isBogusTrusteeName) AND no usable
 * contact info either — a bogus-looking name alone must never disqualify a record that also
 * carries a real address/phone/email, since that would silently drop a genuine trustee whose name
 * happens to contain a keyword like "trustee" or "chapter" (e.g. "John Doe, Trustee").
 */
function isSentinelWithNoIdentity(
  event: TrusteeAppointmentSyncEvent,
  sentinelProfCode: string,
): boolean {
  if (event.profCode !== sentinelProfCode) {
    return false;
  }
  const { dxtrTrustee } = event;
  const hasNoContact = !hasUsableContact(dxtrTrustee.legacy);
  const hasNoName = !normalizeName(dxtrTrustee.fullName ?? '');
  return hasNoContact && (hasNoName || isBogusTrusteeName(event));
}

/**
 * Short-circuits processOneEvent before any repo call is made when dxtrTrustee has no usable
 * demographics, or is a sentinel-coded record with a bogus placeholder name. Returns null when
 * neither applies, so the caller proceeds normally.
 */
function resolvePreMatchShortCircuit(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  scenarioDistribution: ScenarioDistribution,
): EventOutcome | null {
  const skipReason = resolveSkipReason(event);
  if (skipReason === 'empty-demographics') {
    deps.context.logger.warn(
      MODULE_NAME,
      `Trustee appointment event for case ${event.caseId} has no usable demographics ` +
        `(blank name, no address/phone/email) — cannot be safely attributed to any trustee. Skipping.`,
    );
    scenarioDistribution.emptyDemographicsSkippedCount++;
    return { kind: 'none' };
  }
  if (skipReason === 'sentinel-bogus-name') {
    deps.context.logger.warn(
      MODULE_NAME,
      `Trustee appointment event for case ${event.caseId} has a sentinel professional code and ` +
        `a bogus/administrative placeholder name — cannot be safely attributed to any trustee. Skipping.`,
    );
    scenarioDistribution.sentinelBogusNameSkippedCount++;
    return { kind: 'none' };
  }

  return null;
}

/**
 * True when this fingerprint/variant is already a known, pending mismatch — meaning this case
 * simply becomes a member of it via its own surrogate row, with no need to re-run matching or
 * write a second verification document. Performs that surrogate write and bookkeeping itself when
 * true, since there is nothing further for the caller to do in that case beyond returning.
 */
async function handleVerificationBucketHit(
  ctx: MatchContext,
  syncedCase: SyncedCase,
  variationTrusteeId: string | null,
): Promise<boolean> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;
  if (
    variationTrusteeId ||
    !(await hasPendingVerificationForVariation(deps, fingerprint, variant))
  ) {
    return false;
  }

  await writeSurrogateAppointment(deps, event, fingerprint, variant, syncedCase);
  scenarioDistribution.verificationBucketHitCount++;
  audit.matchOutcome = 'verification-bucket-hit';
  deps.context.logger.info(
    MODULE_NAME,
    `Case ${event.caseId} joins an existing pending trustee match verification (fingerprint bucket hit)`,
  );
  return true;
}

/**
 * Resolves whether this event's case is synced into CAMS and not moved, returning the SyncedCase
 * to proceed with, or a terminal EventOutcome the caller should return immediately (case not yet
 * synced by sync-cases, or the case was moved to a different caseId). Extracted alongside the
 * other whole-procedure extractions in this file for the same reason — removes two shallow but
 * independently-meaningful checks, and the nesting level they sat at inside processOneEvent's try
 * block, from the measured function.
 */
async function resolveSyncedCase(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
): Promise<
  { outcome: 'resolved'; syncedCase: SyncedCase } | { outcome: 'terminal'; result: EventOutcome }
> {
  const { context } = deps;
  const caseOrMovedCase = await deps.casesRepo.getCaseOrMovedCase(event.caseId);

  if (caseOrMovedCase === null) {
    context.logger.info(
      MODULE_NAME,
      `Case ${event.caseId} not yet synced into CAMS — queuing for retry.`,
    );
    return { outcome: 'terminal', result: { kind: 'not-yet-synced' } };
  }

  if (caseOrMovedCase.movedToCaseId) {
    context.logger.info(
      MODULE_NAME,
      `Case ${event.caseId} was transferred to ${caseOrMovedCase.movedToCaseId} — skipping match.`,
    );
    return { outcome: 'terminal', result: { kind: 'none' } };
  }

  return { outcome: 'resolved', syncedCase: caseOrMovedCase };
}

/**
 * Processes a single trustee appointment event end to end: fingerprint lookup, case-sync/
 * moved-case resolution (resolveSyncedCase), verification-bucket-hit short-circuit
 * (handleVerificationBucketHit),
 * trustee resolution (resolveTrusteeIdByName/resolveByScoring), and match-outcome application
 * (applyMatchOutcome). Extracted from processAppointments' main loop for the same reason as every
 * helper above — whole-procedure extraction removes a decision's branching and nesting cost from
 * the measured function, not merely reorganizing its contents. Every helper this function calls
 * follows the same rule; see MatchContext's doc comment for the shared per-event state they take.
 *
 * This function OWNS the one transient-error catch boundary for this event — moved here from
 * processAppointments' loop body, not duplicated. None of the helpers above ever catch anything
 * themselves; every repo call's thrown error propagates up to the one catch below, exactly as
 * before this extraction. See isTransientInfraError's doc comment for why a second, independent
 * recheck used to be required and no longer is (cams-o5gh).
 */
async function processOneEvent(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  scenarioDistribution: ScenarioDistribution,
): Promise<EventOutcome> {
  const { context } = deps;

  const preMatchOutcome = resolvePreMatchShortCircuit(deps, event, scenarioDistribution);
  if (preMatchOutcome) return preMatchOutcome;

  const cityStateZipCountry = event.dxtrTrustee.legacy?.cityStateZipCountry;
  if (event.dxtrTrustee.legacy && cityStateZipCountry) {
    event.dxtrTrustee.legacy.parsedCityStateZip = parseCityStateZip(cityStateZipCountry);
  }

  const variant = buildVariant(event.dxtrTrustee);
  const fingerprint = computeFingerprint(variant);

  const audit: MatchAuditEntry = {
    caseId: event.caseId,
    dxtrTrusteeName: event.dxtrTrustee.fullName,
    matchOutcome: 'error',
    matchedTrusteeId: null,
    scoringBreakdown: null,
    appointmentStatus: null,
  };

  try {
    const variationTrusteeId = await matchTrusteeByVariation(deps, fingerprint, variant);
    if (variationTrusteeId) {
      scenarioDistribution.fingerprintHitCount++;
    } else {
      scenarioDistribution.fingerprintMissCount++;
    }

    const caseResolution = await resolveSyncedCase(deps, event);
    if (caseResolution.outcome === 'terminal') return caseResolution.result;
    const syncedCase = caseResolution.syncedCase;

    const ctx: MatchContext = { deps, event, fingerprint, variant, audit, scenarioDistribution };
    if (await handleVerificationBucketHit(ctx, syncedCase, variationTrusteeId)) {
      return { kind: 'none' };
    }

    let trusteeId: string;
    let nameScore: number;
    if (variationTrusteeId) {
      // A fingerprint hit involved no name comparison at all - there is no name-based
      // uncertainty to represent, so 100 is accurate here, not a fudge (same reasoning as
      // matchTrusteeByName's 'resolved' tiers - see NameMatchResult's doc comment in
      // trustee-match.helpers.ts).
      trusteeId = variationTrusteeId;
      nameScore = 100;
    } else {
      const resolution = await resolveTrusteeIdByName(ctx, syncedCase);
      if (resolution.outcome === 'handled') return { kind: 'none' };
      trusteeId = resolution.trusteeId;
      nameScore = resolution.nameScore;
    }

    const matchOutcome = await applyMatchOutcome(
      ctx,
      syncedCase,
      trusteeId,
      variationTrusteeId,
      nameScore,
    );
    return matchOutcome.outcome === 'auto-linked'
      ? { kind: 'success', dlqFailure: matchOutcome.dlqFailure }
      : { kind: 'none' };
  } catch (originalError) {
    const camsError = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed to process trustee appointment for case ${event.caseId}.`,
    );

    // Transient infrastructure error (Cosmos RU throttling, a read/write timeout) — not a
    // genuine match outcome. Report 'retryable' instead of 'dlq': this event was never actually
    // resolved (matched, mismatched, or ambiguous), so sending it to the DLQ on the first
    // occurrence would permanently drop a case appointment that a retry could sync successfully,
    // and the next scheduled run does not recover it since the date cursor has already advanced
    // past this event. This is the ONLY transient-error check for this event: every repo call in
    // this pipeline — the fingerprint lookup, case sync, and matchTrusteeByName/
    // resolveNameCollisionByScoring (which return rather than throw for every business outcome) —
    // runs inside the try block above at the same nesting depth, so any transient error from any
    // of them surfaces here, in this one enclosing catch, with no second, independent recheck
    // required (contrast with the pre-Move-B nested catch (fuzzyError), which needed its own
    // recheck because it lived one frame deeper — see cams-o5gh).
    if (isTransientInfraError(originalError)) {
      context.logger.warn(
        MODULE_NAME,
        `Transient error processing case ${event.caseId} — queuing for retry: ${camsError.message}`,
      );
      scenarioDistribution.retryableCount++;
      audit.matchOutcome = 'retryable-error';
      return { kind: 'retryable' };
    }

    // Unexpected/unclassified error — route to DLQ. Both known business outcomes previously
    // classified via a dedicated helper here (a no-match and an unscored name collision) are now
    // dispatched directly from matchTrusteeByName/resolveNameCollisionByScoring's returned
    // NameMatchResult/ScoringOutcome values rather than reaching this catch via a thrown+caught
    // error — so anything still reaching here is, by construction, a genuinely unclassified error.
    context.logger.warn(MODULE_NAME, `${camsError}`);
    return { kind: 'dlq', message: { ...event, error: camsError } };
  } finally {
    context.logger.info(MODULE_NAME, 'TRUSTEE_MATCH_AUDIT', audit);
  }
}

/**
 * Process trustee appointment events by:
 * 1. Matching each DXTR trustee to a CAMS trustee by name
 * 2. Checking for a perfect match (exact name + active appointment in same court/division/chapter)
 * 3. Auto-linking only perfect matches; persisting all others to trustee-match-verification collection
 *
 * A thin loop over processOneEvent above, which owns the entire per-event pipeline (previously
 * inline here) — fingerprint/case-sync/verification-bucket checks, name/scoring
 * resolution, match-outcome application, and the one transient-error catch boundary. This function
 * only aggregates each event's EventOutcome into the four result buckets below; scenarioDistribution
 * is updated by reference inside processOneEvent and its callees, so nothing here re-derives it.
 *
 * Ground truth for the outcome taxonomy this pipeline produces (see
 * test/integration/trustee-match-scenarios for the integration harness that exercises each of
 * these against a real DXTR/Cosmos round trip — that harness's header comment cross-references
 * this list rather than restating the rules):
 *
 * Name resolution (matchTrusteeByName / resolveTrusteeIdByName / resolveByScoring):
 * - Exactly one CAMS trustee matches the DXTR name (exact or fuzzy-normalized): resolved directly,
 *   nameScore 100.
 * - No CAMS trustee matches: NoTrusteeMatch — pending verification, no candidates.
 * - More than one CAMS trustee matches (ambiguous): resolveNameCollisionByScoring scores every
 *   candidate. A clear winner (totalScore > FUZZY_MATCH_SCORE_THRESHOLD, gap >=
 *   FUZZY_MATCH_MIN_GAP, AND isAppointmentMatch true for that winner) resolves exactly like an
 *   exact-name match. Otherwise: AmbiguousMatchUnresolved (no clear winner, e.g. a genuine tie) or
 *   CandidateLoadFailed (every candidate's data failed to load).
 *
 * Match-outcome application (applyMatchOutcome), once a trusteeId is known:
 * - isAppointmentMatch true (a SINGLE active appointment covers court+division+chapter together):
 *   auto-linked — no human review, no verification doc written.
 * - No active appointment matches, but an INACTIVE appointment matches court+division+chapter
 *   exactly: PerfectMatchInactiveStatus — pending verification, surrogate appointment written.
 * - Neither: ImperfectMatch — pending verification with a real CandidateScore breakdown, however
 *   high totalScore is. isAppointmentMatch's single-record requirement is the ONLY gate for
 *   auto-linking; a high totalScore is never sufficient on its own (see calculateChapterScore's
 *   doc comment for why totalScore's district/chapter components must not be trusted as
 *   independent evidence — CAMS-880).
 *
 * Pre-matching short-circuits (processOneEvent / resolveSyncedCase):
 * - No SYNCED_CASE document exists yet for this caseId: not-yet-synced, event queued for retry
 *   on a later pass (does not count as a failure).
 * - The case was moved to a different caseId (movedToCaseId set): skipped entirely, no match
 *   attempted.
 * - dxtrTrustee has no usable demographics at all (blank name and no other legacy/contact
 *   fields): emptyDemographicsSkippedCount, skipped before matching — see
 *   BOGUS_TRUSTEE_NAME_KEYWORDS/sentinel professional code handling above.
 * - A fingerprint/TRUSTEE_VARIATION hit already resolved this exact DXTR record to a trusteeId on
 *   a prior pass: short-circuits straight to that trusteeId, bypassing matchTrusteeByName.
 * - A prior pass already wrote a pending or approved verification doc for this event
 *   (handleVerificationBucketHit): re-verification — an approved verification is never
 *   overwritten by a later pass; a pending one is refreshed.
 */
async function processAppointments(
  deps: SyncTrusteeCaseAppointmentsDeps,
  events: TrusteeAppointmentSyncEvent[],
): Promise<ProcessAppointmentsResult> {
  const dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[] = [];
  const notYetSyncedEvents: TrusteeAppointmentSyncEvent[] = [];
  const retryableEvents: TrusteeAppointmentSyncEvent[] = [];
  let successCount = 0;
  const scenarioDistribution: ScenarioDistribution = {
    autoMatchCount: 0,
    imperfectMatchCount: 0,
    noMatchCount: 0,
    multipleMatchCount: 0,
    perfectMatchInactiveCount: 0,
    reVerificationCount: 0,
    verificationBucketHitCount: 0,
    fingerprintHitCount: 0,
    fingerprintMissCount: 0,
    retryableCount: 0,
    candidateLoadFailedCount: 0,
    emptyDemographicsSkippedCount: 0,
    sentinelBogusNameSkippedCount: 0,
  };

  for (const event of events) {
    const outcome = await processOneEvent(deps, event, scenarioDistribution);
    switch (outcome.kind) {
      case 'success':
        successCount++;
        if (outcome.dlqFailure) {
          dlqMessages.push(outcome.dlqFailure);
        }
        break;
      case 'not-yet-synced':
        notYetSyncedEvents.push(event);
        break;
      case 'retryable':
        retryableEvents.push(event);
        break;
      case 'dlq':
        dlqMessages.push(outcome.message);
        break;
      case 'none':
        break;
      default: {
        const _exhaustive: never = outcome;
        throw new Error(`Unhandled EventOutcome kind: ${JSON.stringify(_exhaustive)}`);
      }
    }
  }

  return {
    successCount,
    dlqMessages,
    scenarioDistribution,
    notYetSyncedEvents,
    retryableEvents,
  };
}

async function storeRuntimeState(deps: SyncTrusteeCaseAppointmentsDeps, lastSyncDate: string) {
  const { context } = deps;
  try {
    const newSyncState: TrusteeAppointmentsSyncState = {
      documentType: 'TRUSTEE_APPOINTMENTS_SYNC_STATE',
      lastSyncDate,
    };
    await deps.runtimeStateRepo.upsert(newSyncState);
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

async function storePetitionRuntimeState(
  deps: SyncTrusteeCaseAppointmentsDeps,
  lastSyncDate: string,
) {
  const { context } = deps;
  try {
    const newSyncState: TrusteePetitionSyncState = {
      documentType: 'TRUSTEE_PETITION_SYNC_STATE',
      lastSyncDate,
    };
    await deps.petitionSyncStateRepo.upsert(newSyncState);
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

async function deleteAll(
  deps: SyncTrusteeCaseAppointmentsDeps,
): Promise<{ data: { deleted: number }; error?: Error }> {
  const { context } = deps;
  try {
    const deleted = await deps.appointmentsRepo.deleteAll();
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

const SyncTrusteeCaseAppointments = {
  createDeps,
  getAppointmentEvents,
  processAppointments,
  storeRuntimeState,
  storePetitionRuntimeState,
  deleteAll,
};

export default SyncTrusteeCaseAppointments;
