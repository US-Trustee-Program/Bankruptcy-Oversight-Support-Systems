import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncEvent,
  SoftCloseWriteFailed,
} from '@common/cams/dataflow-events';
import {
  TRUSTEE_MATCH_VERIFICATION_DOCUMENT_TYPE,
  TrusteeMatchVerification,
  IdentityMismatchReason,
} from '@common/cams/trustee-match-verification';
import { createAuditRecord, SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { CamsError } from '../../common-errors/cams-error';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';
import {
  TrusteeCaseAppointmentsRepository,
  TrusteeAppointmentsSyncState,
  TrusteePetitionSyncState,
  TrusteeMatchVerificationRepository,
  RuntimeState,
  RuntimeStateDocumentType,
  RuntimeStateRepository,
} from '../gateways.types';
import { parseCityStateZip, normalizeName } from './trustee-match.helpers';
import { runTrusteeMatchPipeline } from './trustee-match-pipeline-orchestrator';
import { serializeState, candidatePool, TrusteeSerializedState } from './trustee-match-pipeline';
import { buildVariant, computeFingerprint } from './trustee-variant.helpers';
import { TRUSTEE_VARIATION_DOCUMENT_TYPE } from '@common/cams/trustee-variation';
import {
  CaseAppointment,
  CaseAppointmentChecks,
  isAppointmentMatch,
} from '@common/cams/trustee-appointments';
import { CaseChapter, SyncedCase, VALID_CASE_CHAPTERS } from '@common/cams/cases';
import { BadRequestError } from '../../common-errors/bad-request';
import { randomUUID } from 'node:crypto';
import DateHelper from '@common/date-helper';

const MODULE_NAME = 'SYNC-TRUSTEE-CASE-APPOINTMENTS-USE-CASE';

type ScenarioDistribution = {
  autoMatchCount: number;
  /**
   * Subset of autoMatchCount where checks.matchedTrusteeAppointment was false — decision 1a
   * (2026-10-27) still writes the case appointment, but the matched trustee has no active
   * appointment covering this case's court/division/chapter. Tracked separately so an
   * unexpectedly high rate is visible rather than buried inside autoMatchCount.
   */
  autoMatchUncoveredCount: number;
  /** The trustee-match pipeline settled on 'no match' — zero or one unresolved candidate. */
  noMatchCount: number;
  /** The trustee-match pipeline settled on 'ambiguous' — two or more unresolved candidates. */
  multipleMatchCount: number;
  reVerificationCount: number;
  verificationBucketHitCount: number;
  fingerprintHitCount: number;
  fingerprintMissCount: number;
  retryableCount: number;
  /**
   * The trustee-match pipeline's own skipAdministrativePlaceholder stage fired during identity
   * resolution — a record that already passed this file's own DXTR skip checks (unappointable
   * chapter, empty demographics, sentinel/bogus name) but still reads as an administrative
   * placeholder (a disavowal phrase, "U.S. Trustee"/"(UST)", or no-person wording) to the
   * pipeline's ACMS-shaped gate. Treated as a no-op, the same as the other skip counters below;
   * counted separately so an unexpectedly high rate (e.g. a real "United States Trustee"
   * DXTR appointee) is visible rather than silently dropped.
   */
  pipelineSkippedCount: number;
  /**
   * The case's chapter (9 or 15) can never have a CAMS trustee appointment, so no candidate
   * could ever pass isAppointmentMatch for it — routing it to trustee-match-verification would
   * create a permanently-pending, permanently-unapprovable task. Never routed to matching or
   * verification; logged loudly instead (see isUnappointableChapter).
   */
  unappointableChapterSkippedCount: number;
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
  /**
   * The record's name is a bogus/administrative placeholder (isBogusTrusteeName) with no separate
   * firstName field, regardless of profCode or contact info (see isUnattributableBogusName).
   * Distinct from sentinelBogusNameSkippedCount: this path catches administrative/court-office
   * records (e.g. "US Trustee 11", "CHAPTER 11 - LV") that carry the court's own real
   * address/phone/email and a non-sentinel profCode.
   */
  unattributableBogusNameSkippedCount: number;
};

type MatchAuditEntry = {
  caseId: string;
  dxtrTrusteeName: string;
  matchOutcome:
    | 'auto-matched'
    | 'no-match'
    | 'ambiguous'
    | 'skipped-administrative-placeholder'
    | 'verification-bucket-hit'
    | 'retryable-error'
    | 'error';
  matchedTrusteeId: string | null;
  /** 'uncovered' means a case appointment was still written (decision 1a) but
   * checks.matchedTrusteeAppointment was false — the matched trustee has no active appointment
   * covering this case's court/division/chapter. */
  appointmentStatus: 'active' | 'uncovered' | null;
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

// isTransientInfraError (shared, see ../../common-errors/transient-infra-error.ts) is the check
// that decides whether processOneEvent's one catch block reports 'retryable' instead of routing
// to the DLQ - the trustee-match pipeline returns (rather than throws) for business outcomes, so
// that catch is the only place in the per-event pipeline a transient error can surface (see
// cams-o5gh for the bug this fixed when a second, independent recheck was still required).
// throwIfTransientSoftCloseFailure below calls it directly.

/**
 * Throws softCloseError when it is transient (Cosmos RU throttling or a read/write timeout),
 * logging a warning first. Aborts BEFORE any replacement appointment is created so the caller's
 * event propagates to the per-event catch in processAppointments, which already routes
 * isTooManyRequestsError/isGatewayTimeoutError to retryableEvents. Nothing has been written for
 * this event, so nothing is corrupt; a later retry re-reads state and closes (and, for the
 * replace flow, creates) cleanly. Returns (does not throw) when softCloseError is a permanent
 * failure — the caller is responsible for logging and for any follow-up (creating a replacement,
 * for the replace flow; nothing further, for the close-only flow).
 *
 * trusteeId is null when called from the close-only path (bogus/placeholder trustee — there is no
 * replacement trustee to log); the replace flow always passes the real incoming trusteeId.
 *
 * Exported for testing only — no production importer outside this module.
 */
export function throwIfTransientSoftCloseFailure(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  existingAppointment: { trusteeId: string; assignedOn: string },
  trusteeId: string | null,
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
  checks: CaseAppointmentChecks,
): Promise<void> {
  await appointmentsRepo.upsert({
    caseId: event.caseId,
    trusteeId,
    assignedOn,
    appointedDate: event.appointedDate,
    checks,
  });
  context.logger.info(
    MODULE_NAME,
    `Created case appointment for case ${event.caseId}, trustee ${trusteeId}`,
  );
}

/**
 * One day before referenceDate (itself a stable, DXTR-sourced date — see applyResolvedTrustee's
 * assignedOn docblock), so a soft-closed appointment's unassignedOn never overlaps the event that
 * caused the close. referenceDate is always a plain YYYY-MM-DD string (DXTR's appointedDate is
 * parsed from a fixed-width YYMMDD source field with no time component — see parseDxtrDate in
 * cases.dxtr.gateway.ts), so calendar-day subtraction is correct and unambiguous; unlike the old
 * `new Date().toISOString()` wall-clock stamp, this is deterministic across retries.
 *
 * Clamped to existingAssignedOn: out-of-order event delivery (DLQ redelivery, backfill, retry) can
 * hand us a referenceDate at or before the existing appointment's own assignedOn, which would
 * otherwise back-date unassignedOn to before (or at) the appointment's open date — a row marked
 * closed before it was ever opened. Clamping never overlaps the event that caused the close in the
 * normal, in-order case, and degrades to a zero-duration appointment (rather than a negative one)
 * in the out-of-order case.
 */
function deriveUnassignedOn(referenceDate: string, existingAssignedOn: string): string {
  const candidate = DateHelper.subtractDays(referenceDate, 1);
  // existingAssignedOn may carry a full ISO timestamp (see CaseAppointment.assignedOn); truncate
  // to a plain date the same way DateHelper.subtractDays does internally, so the comparison below
  // isn't a false positive from comparing a 10-char date string against a longer timestamp string.
  const existingAssignedOnDate = existingAssignedOn.slice(0, 10);
  return candidate < existingAssignedOnDate ? existingAssignedOnDate : candidate;
}

/**
 * Closes existingAppointment in Cosmos (unassignedOn = one day before referenceDate, clamped to
 * never precede existingAppointment.assignedOn — see deriveUnassignedOn).
 *
 * Pure close primitive shared by softCloseExistingAppointment (replace flow, which additionally
 * creates a new appointment) and the bogus-trustee close-only path in processOneEvent (which must
 * NOT create a replacement) — kept free of any create-on-failure or new-appointment logic so both
 * callers can rely on it doing exactly one thing.
 *
 * Exported for testing only — no production importer outside this module.
 */
export async function closeExistingAppointment(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  existingAppointment: CaseAppointment,
  referenceDate: string,
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
): Promise<{ closed: boolean; softCloseError: CamsError | null; unassignedOn: string }> {
  const unassignedOn = deriveUnassignedOn(referenceDate, existingAppointment.assignedOn);
  let softCloseError: CamsError | null = null;
  try {
    await appointmentsRepo.updateCaseAppointment({ ...existingAppointment, unassignedOn });
  } catch (error) {
    softCloseError = getCamsError(error, MODULE_NAME);
  }

  if (!softCloseError) {
    context.logger.info(
      MODULE_NAME,
      `Soft-closed case appointment for case ${event.caseId}, old trustee ${existingAppointment.trusteeId}`,
    );
  }

  return { closed: !softCloseError, softCloseError, unassignedOn };
}

/**
 * Soft-closes the case's existing active appointment (a different trustee than the one being
 * newly assigned) and creates the new appointment, handling the soft-close outcome:
 *  - Transient soft-close failure (Cosmos RU throttling, a read/write timeout) throws, aborting
 *    BEFORE the new appointment is created, so the caller's event is retried from a clean state.
 *  - Permanent soft-close failure still creates the new appointment (manual replay required for
 *    the stale old appointment) and reports it via the returned dlqFailure.
 *  - On success, reports closed:true.
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
  checks: CaseAppointmentChecks,
): Promise<{ closed: boolean; dlqFailure: TrusteeAppointmentSyncError | null }> {
  const { closed, softCloseError } = await closeExistingAppointment(
    context,
    event,
    existingAppointment,
    assignedOn,
    appointmentsRepo,
  );

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

    const dlqFailure: TrusteeAppointmentSyncError = {
      ...event,
      mismatchReason: SoftCloseWriteFailed,
    };
    await createNewAppointment(context, appointmentsRepo, event, trusteeId, assignedOn, checks);
    return { closed: false, dlqFailure };
  }

  return { closed, dlqFailure: null };
}

/**
 * Throws a CamsError when event.appointedDate is missing/unparseable, logging a TRUSTEE
 * APPOINTMENT DATA INTEGRITY ERROR first. Shared by the three call sites that each derive a
 * date field (assignedOn, a surrogate's assignedOn, unassignedOn) from event.appointedDate and
 * must refuse to fall back to wall-clock time — a wall-clock fallback would differ on every
 * retry/replay of the same event and break upsert()'s natural-key idempotency (or, for the
 * close-only path, corrupt appointment history). subjectDescription names what couldn't be
 * derived (e.g. "trustee tr-1 — event.appointedDate", "fingerprint fp-1 — event.appointedDate")
 * for both the log line and the thrown error's message.
 */
function assertAppointedDate(
  context: ApplicationContext,
  event: TrusteeAppointmentSyncEvent,
  subjectDescription: string,
  reasonDescription: string,
): asserts event is TrusteeAppointmentSyncEvent & { appointedDate: string } {
  if (event.appointedDate) {
    return;
  }
  context.logger.error(
    MODULE_NAME,
    `TRUSTEE APPOINTMENT DATA INTEGRITY ERROR: case ${event.caseId}, ${subjectDescription} is ` +
      `missing/unparseable. Refusing to fall back to wall-clock time for ${reasonDescription}. ` +
      `This event cannot be safely processed until its source DXTR appointment date is corrected.`,
  );
  throw new CamsError(MODULE_NAME, {
    message: `Case ${event.caseId}, ${subjectDescription}: missing/unparseable, cannot safely derive ${reasonDescription}.`,
  });
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
  appointmentsRepo: TrusteeCaseAppointmentsRepository,
  checks: CaseAppointmentChecks,
): Promise<TrusteeAppointmentSyncError | null> {
  assertAppointedDate(context, event, `trustee ${trusteeId} — event.appointedDate`, 'assignedOn');
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
      checks,
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

  await createNewAppointment(context, appointmentsRepo, event, trusteeId, assignedOn, checks);

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
 * call site: trusteeId, variationTrusteeId, logMessage, checks.
 */
async function autoLinkTrustee(
  ctx: MatchContext,
  trusteeId: string,
  variationTrusteeId: string | null,
  logMessage: string,
  checks: CaseAppointmentChecks,
): Promise<TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | null> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;
  const { context } = deps;

  const softCloseFailure = await applyResolvedTrustee(
    context,
    event,
    trusteeId,
    deps.caseAppointmentsRepo,
    checks,
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
  if (!checks.matchedTrusteeAppointment) {
    scenarioDistribution.autoMatchUncoveredCount++;
  }
  audit.matchOutcome = 'auto-matched';
  audit.matchedTrusteeId = trusteeId;
  audit.appointmentStatus = checks.matchedTrusteeAppointment ? 'active' : 'uncovered';
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
 * invariant relied on by processAppointments' surrogate writes for an unresolved identity
 * match, so a future code path that breaks the ordering fails loudly here instead of as an opaque TypeError
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
 * Upserts a TrusteeMatchVerification identity task for an unresolved (ambiguous or no-match)
 * pipeline outcome. Skips the write if the existing document has already been resolved or
 * dismissed (S2.3's repository-level merge-upsert enforces the same rule again at the DB layer;
 * this pre-check avoids even attempting the write and lets reVerificationCount be reported here).
 */
async function upsertIdentityTask(
  verificationRepo: TrusteeMatchVerificationRepository,
  event: TrusteeAppointmentSyncEvent,
  mismatchReason: IdentityMismatchReason,
  findings: TrusteeSerializedState,
  fingerprint: string,
  variant: string,
): Promise<boolean> {
  const existing = await findVerificationBucketEntry(verificationRepo, fingerprint, variant);
  if (existing && existing.status !== 'pending') {
    return true; // Already resolved — signals a re-verification for match accuracy tracking
  }
  const acmsProfessionalId = resolveAcmsProfessionalIdForVerification(event);
  if (existing) {
    await verificationRepo.upsertVerification({
      ...existing,
      mismatchReason,
      source: 'DXTR',
      findings,
      appointedDate: event.appointedDate,
      acmsProfessionalId,
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
        source: 'DXTR',
        findings,
        appointedDate: event.appointedDate,
        acmsProfessionalId,
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

// Guards against malformed CS_CHAPTER values reaching a CASE_APPOINTMENT write (this is the
// same class of dirty upstream data this slice hardens against elsewhere -- see the
// address-parsing rewrite). Shared by processAppointments' per-event hot path (invoked for
// every mismatched/imperfect/no-match event, routing a thrown BadRequestError to the DLQ) and
// TrusteeVerificationRemapUseCase's per-surrogate remap (whose own per-surrogate try/catch
// leaves a failing surrogate in place for the next attempt instead); either way, an invalid
// chapter never reaches a CASE_APPOINTMENT write as an unvalidated string.
export function assertValidChapter(caseId: string, chapter: string): CaseChapter {
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
  assertAppointedDate(
    deps.context,
    event,
    `fingerprint ${fingerprint} — event.appointedDate`,
    "the surrogate's assignedOn",
  );

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
 * Outcome of resolveTrusteeViaPipeline: either a trusteeId to proceed with (plus matchedBy, the
 * name of whatever resolved it — a pipeline RESOLVE stage, or 'variation' for a fingerprint-bucket
 * hit — carried through for checks.matchedBy), or a signal that the step already fully handled the
 * event (wrote its audit/identity-task/surrogate, or determined the record names no one) and the
 * caller should treat this event as done for this pass.
 */
type IdentityResolution =
  { outcome: 'resolved'; trusteeId: string; matchedBy: string } | { outcome: 'handled' };

/**
 * Resolves a trusteeId via the trustee-match pipeline when no fingerprint pre-match exists. Runs
 * the same pipeline orchestrator the ACMS professional-id sync uses (runTrusteeMatchPipeline) —
 * DxtrTrusteeParty and AcmsTrusteeProfessional are both CanonicalTrusteeSource, so no DXTR-specific
 * orchestrator is needed.
 *
 * NEVER catches anything except to immediately rethrow state.error (see below), and never calls
 * isTransientInfraError/isTooManyRequestsError/isGatewayTimeoutError. Transient-error
 * classification happens exactly once, at processAppointments' own outer catch.
 */
async function resolveTrusteeViaPipeline(
  ctx: MatchContext,
  syncedCase: SyncedCase,
): Promise<IdentityResolution> {
  const { deps, event, fingerprint, variant, audit, scenarioDistribution } = ctx;
  const state = await runTrusteeMatchPipeline(deps.context, event.dxtrTrustee);

  // Rethrown unconditionally (not gated on isTransientInfraError) so it reaches
  // processOneEvent's one existing catch, which already classifies retryable vs DLQ — "error:
  // transient retries, otherwise DLQ, as today."
  if (state.error) {
    throw state.error;
  }

  // The pipeline's own skipAdministrativePlaceholder stage (disavowal phrases, "U.S.
  // Trustee"/"(UST)", no-person wording) can fire on a record that already passed this file's
  // own DXTR skip checks (resolvePreMatchShortCircuit/handleBogusTrusteeCloseOnly) — a new edge
  // case that didn't exist under the old numeric-scoring resolver. Treated as a plain no-op, the
  // same as those DXTR-specific skip reasons; counted and logged separately so an unexpectedly
  // high rate (e.g. a real "United States Trustee" DXTR appointee) is visible rather than silent.
  if (state.skip) {
    scenarioDistribution.pipelineSkippedCount++;
    audit.matchOutcome = 'skipped-administrative-placeholder';
    deps.context.logger.warn(
      MODULE_NAME,
      `Trustee match pipeline skipped case ${event.caseId} as an administrative placeholder.`,
    );
    return { outcome: 'handled' };
  }

  if (state.match) {
    return {
      outcome: 'resolved',
      trusteeId: state.match.trusteeId,
      matchedBy: state.match.resolvedBy,
    };
  }

  // Unresolved: 2+ candidates is ambiguous, 0 or 1 is no match (candidate-pool size, per the
  // bead's explicit rule — not ACMS's deriveDisposition, which counts by a different threshold).
  const findings = serializeState(state);
  const reason: IdentityMismatchReason =
    candidatePool(state).length >= 2 ? 'ambiguous' : 'no match';
  if (reason === 'ambiguous') {
    scenarioDistribution.multipleMatchCount++;
    audit.matchOutcome = 'ambiguous';
  } else {
    scenarioDistribution.noMatchCount++;
    audit.matchOutcome = 'no-match';
  }
  const isReVerification = await upsertIdentityTask(
    deps.verificationRepo,
    event,
    reason,
    findings,
    fingerprint,
    variant,
  );
  if (isReVerification) scenarioDistribution.reVerificationCount++;
  await writeSurrogateAppointment(deps, event, fingerprint, variant, syncedCase);
  return { outcome: 'handled' };
}

/**
 * Applies any resolved trusteeId — from a pipeline match or a fingerprint/variation-bucket hit —
 * by always writing the real case appointment, recording what was checked (checks.matchedBy,
 * checks.matchedTrusteeAppointment) rather than gating the write on coverage. Decision 1a
 * (2026-10-27): no more IMPERFECT_MATCH/PERFECT_MATCH_INACTIVE_STATUS identity tasks — an
 * uncovered or inactive-appointment match still auto-links, with checks.matchedTrusteeAppointment
 * recording the fact for #3190's appointment-task follow-up to consume.
 *
 * Same never-catch rule as resolveTrusteeViaPipeline above.
 */
async function applyResolvedMatch(
  ctx: MatchContext,
  trusteeId: string,
  matchedBy: string,
  variationTrusteeId: string | null,
): Promise<MatchOutcomeResolution> {
  const { deps, event } = ctx;
  const trusteeAppointments = await deps.appointmentsRepo.getTrusteeAppointments(trusteeId);
  const checks: CaseAppointmentChecks = {
    matchedCase: true,
    matchedTrustee: true,
    matchedTrusteeAppointment: isAppointmentMatch(
      trusteeAppointments,
      event.courtId,
      event.courtDivisionCode,
      event.chapter,
    ),
    matchedBy,
  };
  const dlqFailure = await autoLinkTrustee(
    ctx,
    trusteeId,
    variationTrusteeId,
    `Match: case ${event.caseId} auto-linked to trustee ${trusteeId} (matchedBy: ${matchedBy}, matchedTrusteeAppointment: ${checks.matchedTrusteeAppointment})`,
    checks,
  );
  return { outcome: 'auto-linked', dlqFailure };
}

/**
 * Outcome of applyResolvedMatch. Kept as its own type rather than folded into IdentityResolution —
 * this stage never reports a trusteeId back upward, so its vocabulary shouldn't carry a case that
 * can't occur here.
 * 'auto-linked' carries an optional dlqFailure: a permanent soft-close failure means
 * createNewAppointment never ran (see autoLinkTrustee/applyResolvedTrustee), so the event wasn't
 * actually linked even though this stage still reports 'auto-linked' for successCount purposes —
 * the caller (processOneEvent/processAppointments) is responsible for also routing dlqFailure to
 * the DLQ, keeping that routing visible in the one aggregation loop rather than a side mutation.
 */
type MatchOutcomeResolution = {
  outcome: 'auto-linked';
  dlqFailure: TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | null;
};

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

/**
 * Constructs the acmsProfessionalId to persist on a TrusteeMatchVerification doc, formatted
 * "{GROUP_DESIGNATOR}-{PROF_CODE}" (e.g. "NY-00123") per the CAMS<->ACMS professional-ID mapping
 * convention (see /cams-gateways: GROUP_DESIGNATOR + PROF_CODE form ACMS's compound professional
 * key, never PROF_CODE alone). This is a CAMS-specific construct, not a native DXTR/ACMS field —
 * event.groupDesignator and event.profCode are raw legacy facts crossed from the gateway; the
 * formatting decision (and the sentinel-suppression rule below) belongs here in the use-case
 * layer, not the gateway.
 * Returns undefined when either half is missing/blank (a partial ID would be actively misleading,
 * not just incomplete), or when profCode is a known sentinel value — a formatted sentinel ID
 * (e.g. "NY-00000") would read to a reviewer as a real professional ID rather than the "no
 * trustee appointed"/"ID unavailable" placeholder it actually is — better to omit it than
 * mislead.
 */
function resolveAcmsProfessionalIdForVerification(
  event: TrusteeAppointmentSyncEvent,
): string | undefined {
  const isSentinel =
    event.profCode === DXTR_PROF_CODE_NO_TRUSTEE_APPOINTED ||
    event.profCode === DXTR_PROF_CODE_ID_UNAVAILABLE;
  if (isSentinel) return undefined;

  const groupDesignator = event.groupDesignator?.trim();
  const profCode = event.profCode?.trim();
  if (!groupDesignator || !profCode) return undefined;

  return `${groupDesignator}-${profCode}`;
}

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
 * True when a record's name is itself a bogus/administrative placeholder rather than a genuine
 * trustee name (e.g. "No Trustee", "CHAPTER 11 - XX") — checked against lastName, falling back to
 * fullName (both via normalizeName, so a whitespace-only lastName correctly falls back to fullName
 * rather than being treated as present). A genuine trustee's name or firm name can plausibly
 * contain one of these substrings, so this check alone is never disqualifying on its own; callers
 * (isSentinelWithNoIdentity, isUnattributableBogusName) combine it with other evidence.
 */
/**
 * True when the case's chapter can never have a CAMS trustee appointment at all, regardless of
 * identity: AppointmentChapterType (common/src/cams/trustees.ts) has no '9' or '15' member, so
 * isAppointmentMatch can never return true for a chapter 9 or chapter 15 case -- no trustee,
 * present or future, could ever satisfy it. Routing these to trustee-match-verification anyway
 * would create a permanently-pending, permanently-unapprovable reviewer task (and, if bundled
 * with other cases under the same fingerprint, permanently block the whole bundle from ever
 * fully approving too, since approval is all-or-nothing). This is a simple stopgap -- CAMS-947
 * owns the fuller, more durable version of this exclusion.
 */
function isUnappointableChapter(event: TrusteeAppointmentSyncEvent): boolean {
  return event.chapter === '9' || event.chapter === '15';
}

function isBogusTrusteeName(event: TrusteeAppointmentSyncEvent): boolean {
  const { dxtrTrustee } = event;
  const name = (
    normalizeName(dxtrTrustee.lastName ?? '') || normalizeName(dxtrTrustee.fullName ?? '')
  ).toLowerCase();
  return BOGUS_TRUSTEE_NAME_KEYWORDS.some((keyword) => name.includes(keyword));
}

/**
 * True when the record's name is a bogus/administrative placeholder (isBogusTrusteeName) with no
 * separate firstName field and a non-sentinel profCode, or the case is chapter 11 (regardless of
 * firstName/profCode/contact info — see isSentinelWithNoIdentity for the sentinel-profCode case).
 */
function isUnattributableBogusName(event: TrusteeAppointmentSyncEvent): boolean {
  const hasBogusName = isBogusTrusteeName(event);
  const hasFirstName = Boolean(normalizeName(event.dxtrTrustee.firstName ?? ''));
  const isChapter11 = event.chapter === '11';
  const isSentinelProfCode =
    event.profCode === DXTR_PROF_CODE_NO_TRUSTEE_APPOINTED ||
    event.profCode === DXTR_PROF_CODE_ID_UNAVAILABLE;

  if (!hasBogusName) return false;
  if (isChapter11) return true;
  if (isSentinelProfCode) return false;
  return !hasFirstName;
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
 * 'unappointable-chapter' is a chapter (9 or 15) no CAMS trustee appointment can ever cover,
 * regardless of identity; 'empty-demographics' is a totally blank record; 'sentinel-bogus-name'
 * is a sentinel-coded record whose populated name is itself a bogus/administrative placeholder;
 * 'unattributable-bogus-name' is a non-sentinel record whose name is an administrative
 * placeholder with no firstName (see isUnattributableBogusName).
 */
type SkipReason =
  | 'unappointable-chapter'
  | 'empty-demographics'
  | 'sentinel-bogus-name'
  | 'unattributable-bogus-name'
  | null;

/**
 * Determines whether the case's chapter can never have a trustee appointment (see
 * isUnappointableChapter), dxtrTrustee carries no usable demographics at all, is a sentinel-coded
 * record whose name is itself a bogus placeholder, or is a bogus administrative-office name with
 * no firstName (see isUnattributableBogusName). Checked before matchTrusteeByName in
 * processOneEvent: any condition means the event cannot be safely attributed to a trustee and
 * must never reach matching or verification.
 */
function resolveSkipReason(event: TrusteeAppointmentSyncEvent): SkipReason {
  if (isUnappointableChapter(event)) {
    return 'unappointable-chapter';
  }

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

  if (isUnattributableBogusName(event)) {
    return 'unattributable-bogus-name';
  }

  return null;
}

/**
 * True when event.profCode equals the given sentinel value AND the record's name/contact don't
 * establish a real identity: no usable fullName and no usable contact info, or a bogus/
 * administrative-placeholder name (isBogusTrusteeName) with no usable contact info. A bogus-looking
 * name alone does not disqualify a record that also carries a real address/phone/email.
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
 * Short-circuits processOneEvent before any repo call is made when the case's chapter can never
 * have a trustee appointment ('unappointable-chapter'), dxtrTrustee has no usable demographics at
 * all ('empty-demographics'), or is a non-sentinel record whose name is an administrative
 * placeholder with no firstName ('unattributable-bogus-name'). Returns null when none applies, so
 * the caller proceeds normally.
 *
 * A sentinel-coded record with a bogus placeholder name ('sentinel-bogus-name') is deliberately
 * NOT handled here, even though resolveSkipReason can return it — that case still needs to close
 * any real active appointment on the case (see the close-only handling in processOneEvent), which
 * requires a SyncedCase and I/O this pre-match, no-repo-call short-circuit doesn't have access to.
 * 'unappointable-chapter' is handled here rather than given the same close-only treatment: no
 * trustee appointment can legitimately exist for a chapter 9/15 case in the first place (the
 * closed AppointmentChapterType union structurally prevents creating one), so there is nothing
 * for a stray real appointment on such a case to represent other than a pre-existing data error —
 * out of scope for this simple stopgap (see isUnappointableChapter; CAMS-947 owns the fuller
 * version of this exclusion).
 */
function resolvePreMatchShortCircuit(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  scenarioDistribution: ScenarioDistribution,
): EventOutcome | null {
  const skipReason = resolveSkipReason(event);
  if (skipReason === 'unappointable-chapter') {
    deps.context.logger.warn(
      MODULE_NAME,
      `Trustee appointment event for case ${event.caseId} is chapter ${event.chapter}, which ` +
        `can never have a CAMS trustee appointment — no candidate could ever satisfy a ` +
        `verification for this case. Skipping rather than creating an unresolvable mismatch.`,
    );
    scenarioDistribution.unappointableChapterSkippedCount++;
    return { kind: 'none' };
  }
  if (skipReason === 'empty-demographics') {
    deps.context.logger.warn(
      MODULE_NAME,
      `Trustee appointment event for case ${event.caseId} has no usable demographics ` +
        `(blank name, no address/phone/email) — cannot be safely attributed to any trustee. Skipping.`,
    );
    scenarioDistribution.emptyDemographicsSkippedCount++;
    return { kind: 'none' };
  }
  if (skipReason === 'unattributable-bogus-name') {
    deps.context.logger.warn(
      MODULE_NAME,
      `Trustee appointment event for case ${event.caseId} has a bogus/administrative ` +
        `placeholder name with no firstName — cannot be safely attributed to any trustee. Skipping.`,
    );
    scenarioDistribution.unattributableBogusNameSkippedCount++;
    return { kind: 'none' };
  }

  return null;
}

/**
 * Handles the 'sentinel-bogus-name' skip reason: the event cannot be safely attributed to any
 * trustee, but unlike 'empty-demographics' it still requires closing any real active appointment
 * on the case, so the "Past Trustees" history doesn't leave a stale trustee open indefinitely.
 * Uses the same close primitive (closeExistingAppointment) as the replace flow, but deliberately
 * never creates a new appointment — there is no real trustee to assign.
 *
 * Returns null when resolveSkipReason(event) is not 'sentinel-bogus-name', so the caller proceeds
 * normally. Must run after syncedCase is resolved (closeExistingAppointment needs it) and inside
 * processOneEvent's try block (a transient close failure must route to 'retryable', not escape and
 * abort the whole batch).
 */
async function handleBogusTrusteeCloseOnly(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  scenarioDistribution: ScenarioDistribution,
): Promise<EventOutcome | null> {
  if (resolveSkipReason(event) !== 'sentinel-bogus-name') {
    return null;
  }

  const { context } = deps;
  context.logger.warn(
    MODULE_NAME,
    `Trustee appointment event for case ${event.caseId} has a sentinel professional code and ` +
      `a bogus/administrative placeholder name — cannot be safely attributed to any trustee. ` +
      `Closing any existing active appointment; not creating a replacement.`,
  );

  const existingAppointment = await deps.caseAppointmentsRepo.getActiveByCaseId(event.caseId);
  if (!existingAppointment) {
    scenarioDistribution.sentinelBogusNameSkippedCount++;
    return { kind: 'none' };
  }

  // Not counted in sentinelBogusNameSkippedCount on failure — this event is going to the DLQ
  // (via processOneEvent's catch), not being cleanly skipped, so it shouldn't inflate that
  // counter.
  assertAppointedDate(context, event, 'event.appointedDate', 'unassignedOn');

  const { closed, softCloseError } = await closeExistingAppointment(
    context,
    event,
    existingAppointment,
    event.appointedDate,
    deps.caseAppointmentsRepo,
  );

  if (!closed && softCloseError) {
    // Mirrors softCloseExistingAppointment's transient-vs-permanent split: a transient failure
    // must abort and retry rather than silently leaving the bogus event "handled" while the old
    // appointment is still open. Not counted in sentinelBogusNameSkippedCount — this event is
    // being retried (throwIfTransientSoftCloseFailure throws), not cleanly skipped.
    throwIfTransientSoftCloseFailure(context, event, existingAppointment, null, softCloseError);

    // A permanent failure has no createNewAppointment fallback to run here (there is nothing to
    // create), so it's logged loudly for manual replay. The event is still reported as handled —
    // the alternative (DLQ) would misrepresent this as a genuine match failure when it is a
    // placeholder-trustee skip that partially succeeded — so it IS counted below.
    context.logger.error(
      MODULE_NAME,
      `Close-only soft-close failed for case ${event.caseId} — old trustee ${existingAppointment.trusteeId} appointment not closed. Manual replay required.`,
      {
        caseId: event.caseId,
        oldTrusteeId: existingAppointment.trusteeId,
        error: softCloseError.message,
      },
    );
  }

  scenarioDistribution.sentinelBogusNameSkippedCount++;
  return { kind: 'none' };
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
 * Parses event.dxtrTrustee.legacy.cityStateZipCountry (when both the legacy record and the field
 * itself are present) and attaches the result as parsedCityStateZip, mutating event in place.
 * Pulled out of processOneEvent as a single-purpose step alongside that function's other
 * whole-procedure extractions, removing this branch's nesting/branching cost from the measured
 * function.
 */
function parseAndAttachCityStateZip(event: TrusteeAppointmentSyncEvent): void {
  const cityStateZipCountry = event.dxtrTrustee.legacy?.cityStateZipCountry;
  if (!event.dxtrTrustee.legacy || !cityStateZipCountry) {
    return;
  }
  event.dxtrTrustee.legacy.parsedCityStateZip = parseCityStateZip(cityStateZipCountry);
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
 * recheck used to be required and no longer is (cams-o5gh). The pre-match steps before the try
 * are outside it; processOneEventOrDlq routes anything they throw to the DLQ.
 */
async function processOneEvent(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  scenarioDistribution: ScenarioDistribution,
): Promise<EventOutcome> {
  const { context } = deps;

  const preMatchOutcome = resolvePreMatchShortCircuit(deps, event, scenarioDistribution);
  if (preMatchOutcome) return preMatchOutcome;

  parseAndAttachCityStateZip(event);

  const variant = buildVariant(event.dxtrTrustee);
  const fingerprint = computeFingerprint(variant);

  const audit: MatchAuditEntry = {
    caseId: event.caseId,
    dxtrTrusteeName: event.dxtrTrustee.fullName,
    matchOutcome: 'error',
    matchedTrusteeId: null,
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

    const bogusTrusteeOutcome = await handleBogusTrusteeCloseOnly(
      deps,
      event,
      scenarioDistribution,
    );
    if (bogusTrusteeOutcome) return bogusTrusteeOutcome;

    const ctx: MatchContext = { deps, event, fingerprint, variant, audit, scenarioDistribution };
    if (await handleVerificationBucketHit(ctx, syncedCase, variationTrusteeId)) {
      return { kind: 'none' };
    }

    let trusteeId: string;
    let matchedBy: string;
    if (variationTrusteeId) {
      // A fingerprint-bucket hit involved no pipeline run at all — checks.matchedBy names the
      // bucket, not a RESOLVE stage.
      trusteeId = variationTrusteeId;
      matchedBy = 'variation';
    } else {
      const resolution = await resolveTrusteeViaPipeline(ctx, syncedCase);
      if (resolution.outcome === 'handled') return { kind: 'none' };
      trusteeId = resolution.trusteeId;
      matchedBy = resolution.matchedBy;
    }

    const matchOutcome = await applyResolvedMatch(ctx, trusteeId, matchedBy, variationTrusteeId);
    return { kind: 'success', dlqFailure: matchOutcome.dlqFailure };
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
    // this pipeline — the fingerprint lookup, case sync, and the trustee-match pipeline itself
    // (whose own non-transient errors are rethrown by resolveTrusteeViaPipeline, landing here too)
    // — runs inside the try block above at the same nesting depth, so any transient error from any
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

    // Unexpected/unclassified error — route to DLQ. Known business outcomes (no-match, ambiguous,
    // an administrative-placeholder skip) are dispatched directly from
    // resolveTrusteeViaPipeline's returned IdentityResolution rather than reaching this catch via
    // a thrown+caught error — so anything still reaching here is, by construction, a genuinely
    // unclassified error (or a non-transient pipeline processing failure).
    context.logger.warn(MODULE_NAME, `${camsError}`);
    return { kind: 'dlq', message: { ...event, error: camsError } };
  } finally {
    context.logger.info(MODULE_NAME, 'TRUSTEE_MATCH_AUDIT', audit);
  }
}

/**
 * Runs processOneEvent with a last-resort per-event boundary. processOneEvent's own catch covers
 * matching and writes but not its pre-match steps (skip-reason checks, variant/fingerprint), and
 * an error escaping here would fail the whole page: handlePage rethrows anything that is not a
 * rate-limit or timeout, so every event in it is retried and then sent to the native poison
 * queue. Routing the one event to the DLQ keeps the rest of the page.
 */
async function processOneEventOrDlq(
  deps: SyncTrusteeCaseAppointmentsDeps,
  event: TrusteeAppointmentSyncEvent,
  scenarioDistribution: ScenarioDistribution,
): Promise<EventOutcome> {
  try {
    return await processOneEvent(deps, event, scenarioDistribution);
  } catch (originalError) {
    const camsError = getCamsError(
      originalError,
      MODULE_NAME,
      `Failed to process trustee appointment for case ${event.caseId}.`,
    );
    deps.context.logger.warn(MODULE_NAME, `${camsError}`);
    return { kind: 'dlq', message: { ...event, error: camsError } };
  }
}

/**
 * Process trustee appointment events by:
 * 1. Resolving each DXTR trustee to a CAMS trustee via the trustee-match pipeline (or a
 *    fingerprint/TRUSTEE_VARIATION bucket hit, bypassing the pipeline entirely)
 * 2. Always writing the case appointment once a trusteeId is resolved, recording what was
 *    checked (checks.matchedTrusteeAppointment, checks.matchedBy) rather than gating the write
 *    on appointment coverage
 * 3. Creating a pending identity task (source 'DXTR', with the pipeline's serialized findings)
 *    only when the pipeline could not resolve a trusteeId at all
 *
 * A thin loop over processOneEvent above, which owns the entire per-event pipeline (previously
 * inline here) — fingerprint/case-sync/verification-bucket checks, identity resolution,
 * match-outcome application, and the one transient-error catch boundary. This function
 * only aggregates each event's EventOutcome into the four result buckets below; scenarioDistribution
 * is updated by reference inside processOneEvent and its callees, so nothing here re-derives it.
 *
 * Ground truth for the outcome taxonomy this pipeline produces (see
 * test/integration/trustee-match-scenarios for the integration harness that exercises each of
 * these against a real DXTR/Cosmos round trip — that harness's header comment cross-references
 * this list rather than restating the rules):
 *
 * Identity resolution (resolveTrusteeViaPipeline), once there is no fingerprint/variation hit:
 * - The trustee-match pipeline resolves a single trusteeId (state.match set, by any RESOLVE
 *   stage): resolved, matchedBy = the stage's name.
 * - The pipeline's own skipAdministrativePlaceholder stage fires (state.skip): no-op,
 *   pipelineSkippedCount — see that function's doc comment for why this is a new edge case.
 * - The pipeline does not resolve a trusteeId (state.match null): the candidate pool's size
 *   decides the identity task's mismatchReason — 2 or more candidates is 'ambiguous', 0 or 1 is
 *   'no match'. findings is the pipeline's serialized state, unchanged.
 * - A non-transient pipeline processing failure (state.error): rethrown, landing in
 *   processOneEvent's one catch exactly like any other unclassified error (retry if transient,
 *   otherwise DLQ).
 *
 * Match-outcome application (applyResolvedMatch), once a trusteeId is known (from either the
 * pipeline or a fingerprint/variation-bucket hit): always auto-links — decision 1a (2026-10-27)
 * removed the old appointment-coverage gate that used to send an uncovered or inactive-only
 * match to a human-review identity task (IMPERFECT_MATCH/PERFECT_MATCH_INACTIVE_STATUS no longer
 * exist). checks.matchedTrusteeAppointment records isAppointmentMatch's result (a SINGLE active
 * appointment covering court+division+chapter together) as data for #3190's appointment-task
 * follow-up, not as a gate on whether to write.
 *
 * Pre-matching short-circuits (processOneEvent / resolveSyncedCase):
 * - No SYNCED_CASE document exists yet for this caseId: not-yet-synced, event queued for retry
 *   on a later pass (does not count as a failure).
 * - The case was moved to a different caseId (movedToCaseId set): skipped entirely, no match
 *   attempted.
 * - The case's chapter is 9 or 15, which can never have a CAMS trustee appointment (see
 *   isUnappointableChapter): unappointable-chapter, skipped before matching
 *   (unappointableChapterSkippedCount) rather than creating a permanently-unapprovable
 *   verification task.
 * - dxtrTrustee has no usable demographics at all (blank name and no other legacy/contact
 *   fields), OR profCode is a sentinel value AND the record's name/contact don't establish a
 *   real identity (see resolveSkipReason/isSentinelWithNoIdentity): empty-demographics or
 *   sentinel-bogus-name, skipped before matching (emptyDemographicsSkippedCount /
 *   sentinelBogusNameSkippedCount).
 * - A fingerprint/TRUSTEE_VARIATION hit already resolved this exact DXTR record to a trusteeId on
 *   a prior pass: short-circuits straight to that trusteeId, bypassing the trustee-match pipeline.
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
    autoMatchUncoveredCount: 0,
    noMatchCount: 0,
    multipleMatchCount: 0,
    reVerificationCount: 0,
    verificationBucketHitCount: 0,
    fingerprintHitCount: 0,
    fingerprintMissCount: 0,
    retryableCount: 0,
    pipelineSkippedCount: 0,
    unappointableChapterSkippedCount: 0,
    emptyDemographicsSkippedCount: 0,
    sentinelBogusNameSkippedCount: 0,
    unattributableBogusNameSkippedCount: 0,
  };

  for (const event of events) {
    const outcome = await processOneEventOrDlq(deps, event, scenarioDistribution);
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
