import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { assertValidChapter, deriveUnassignedOn } from './sync-trustee-case-appointments';
import {
  CaseAppointment,
  CaseAppointmentChecks,
  IDENTITY_TASK_MATCHED_BY,
  TrusteeAppointment,
  isAppointmentMatch,
} from '@common/cams/trustee-appointments';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { SurrogateAppointment, TrusteeCaseAppointmentsRepository } from '../gateways.types';
import { openOrJoinAppointmentTask } from '../trustee-appointment-verification/trustee-appointment-verification.use-case';

const MODULE_NAME = 'TRUSTEE-VERIFICATION-REMAP-USE-CASE';

type RemapPageResult = {
  documentsWritten: number;
  documentsFailed: number;
  totalCandidates: number;
  pageSize: number;
  remainingCount: number;
};

/**
 * Latest-wins between an open copy and the case's open real appointment. The court record is
 * ground truth, so the appointment with the later assignedOn is active and the older one is closed
 * the day before the later one starts. Returns the copy's own unassignedOn when the existing
 * appointment is the later one (the copy is written closed), otherwise closes the existing
 * appointment and returns undefined (the copy stays open). An existing row for the same trustee and
 * the same assignedOn is this same court appointment from an earlier remap, so nothing changes.
 */
async function settleOpenCopy(
  repo: TrusteeCaseAppointmentsRepository,
  copy: CaseAppointment,
  existing: CaseAppointment | null,
  resolvedTrusteeId: string,
): Promise<string | undefined> {
  if (!existing) return undefined;
  const copyDate = copy.assignedOn.slice(0, 10);
  const existingDate = existing.assignedOn.slice(0, 10);
  if (existing.trusteeId === resolvedTrusteeId && existingDate === copyDate) return undefined;
  if (existingDate > copyDate) {
    return deriveUnassignedOn(existingDate, copy.assignedOn);
  }
  await repo.updateCaseAppointment({
    ...existing,
    unassignedOn: deriveUnassignedOn(copyDate, existing.assignedOn),
  });
  return undefined;
}

class TrusteeVerificationRemapUseCase {
  private readonly context: ApplicationContext;
  private readonly appointmentsRepo: TrusteeCaseAppointmentsRepository;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
  }

  /**
   * Records a single surrogate CaseAppointment as a real appointment for the resolved trustee. The
   * court record is ground truth: a copy with a source disposition is written exactly as given and
   * nothing else is touched. An open copy is settled latest-wins against the case's open real
   * appointment (see settleOpenCopy). Order is soft-close -> upsert -> delete: upserting before
   * soft-closing would transiently leave two active real rows, whereas a failed upsert after a
   * soft-close only leaves the case showing no trustee, recoverable on retry since the surrogate is
   * untouched until the upsert succeeds. assignedOn is carried from the surrogate row (not stamped
   * fresh) so the upsert's natural key (caseId, trusteeId, assignedOn) makes retries idempotent.
   *
   * Coverage is checked with isAppointmentMatch against the court fields stored on the surrogate
   * row at write time (epic decision 14; no DXTR lookup, which fails for a case not yet in CAMS);
   * a row missing any court field is uncovered. The result is recorded on the copy as
   * checks.matchedTrusteeAppointment and never blocks the write (CAMS-956). After the upsert, an
   * uncovered attached copy opens or joins the trustee appointment task (openOrJoinAppointmentTask
   * skips covered copies, parked copies, and copies missing a court field). Order is
   * upsert -> task -> delete, so a failed task write leaves the surrogate for the next attempt,
   * which re-runs every step idempotently.
   *
   * A parked placeholder (CASE_APPOINTMENT_UNATTACHED: the case is not in CAMS yet) stays parked
   * with only its trustee and checks changed: there is no CAMS case to settle against, so no
   * getActiveByCaseId/settleOpenCopy. The daily heal attaches it under the active-trustee rule once
   * the case loads, recomputing coverage and opening the task then.
   */
  private async remapSurrogateAppointment(
    surrogate: SurrogateAppointment,
    message: TrusteeVerificationRemapMessage,
    trusteeAppointments: TrusteeAppointment[],
  ): Promise<void> {
    const { courtId, courtDivisionCode, chapter } = surrogate;
    const checks: CaseAppointmentChecks = {
      matchedCase: true,
      matchedTrustee: true,
      matchedTrusteeAppointment:
        !!courtId &&
        !!courtDivisionCode &&
        !!chapter &&
        isAppointmentMatch(trusteeAppointments, courtId, courtDivisionCode, chapter),
      matchedBy: surrogate.checks?.matchedBy ?? IDENTITY_TASK_MATCHED_BY,
    };

    const isParked = surrogate.documentType === 'CASE_APPOINTMENT_UNATTACHED';
    const copyUnassignedOn =
      surrogate.unassignedOn ??
      (isParked
        ? undefined
        : await settleOpenCopy(
            this.appointmentsRepo,
            surrogate,
            await this.appointmentsRepo.getActiveByCaseId(surrogate.caseId),
            message.resolvedTrusteeId,
          ));

    const copy = {
      caseId: surrogate.caseId,
      trusteeId: message.resolvedTrusteeId,
      assignedOn: surrogate.assignedOn,
      appointedDate: surrogate.appointedDate,
      ...(copyUnassignedOn ? { unassignedOn: copyUnassignedOn } : {}),
      dateFiled: surrogate.dateFiled,
      ...(chapter ? { chapter: assertValidChapter(surrogate.caseId, chapter) } : {}),
      ...(courtId ? { courtId } : {}),
      ...(courtDivisionCode ? { courtDivisionCode } : {}),
      checks,
    };
    const documentType = isParked ? 'CASE_APPOINTMENT_UNATTACHED' : 'CASE_APPOINTMENT';
    if (isParked) {
      await this.appointmentsRepo.upsert(copy, documentType);
    } else {
      await this.appointmentsRepo.upsert(copy);
    }

    await openOrJoinAppointmentTask(this.context, { ...copy, documentType }, trusteeAppointments);

    await this.appointmentsRepo.delete(surrogate.id);
  }

  /**
   * Remaps up to pageSize cases sharing message.fingerprint's pending mismatch from their
   * surrogate placeholder to the resolved real trustee. A remapped surrogate row is deleted, so
   * re-querying getSurrogatesByFingerprint(fingerprint) after a partial batch failure returns only
   * the placeholders not yet remapped, with no retryCount-based skip logic. A case a retry may
   * re-encounter (its upsert succeeded but its delete failed) re-upserts the same natural key and
   * completes the delete.
   *
   * A rate-limit or gateway-timeout error mid-page rethrows immediately rather than being
   * counted as a per-case failure — both are
   * conditions the caller must back off and retry (same convention as isTransientInfraError in
   * sync-trustee-case-appointments.ts), not a permanent failure for the one case that happened to hit it
   * while the rest of the page is untouched. Any other per-case error is counted in
   * documentsFailed and its surrogate left for the next attempt.
   */
  async remapPage(
    message: TrusteeVerificationRemapMessage,
    pageSize: number,
  ): Promise<RemapPageResult> {
    const surrogates = await this.appointmentsRepo.getSurrogatesByFingerprint(message.fingerprint);
    const page = surrogates.slice(0, pageSize);
    const remainingCount = surrogates.length - page.length;

    // Fetched once per page, not per surrogate -- resolvedTrusteeId is fixed for the whole
    // message, so every surrogate in this page is checked against the same appointment set.
    const trusteeAppointments = await factory
      .getTrusteeAppointmentsRepository(this.context)
      .getTrusteeAppointments(message.resolvedTrusteeId);

    let documentsWritten = 0;
    let documentsFailed = 0;

    for (const surrogate of page) {
      try {
        await this.remapSurrogateAppointment(surrogate, message, trusteeAppointments);
        documentsWritten++;
      } catch (perCaseError) {
        if (isTooManyRequestsError(perCaseError) || isGatewayTimeoutError(perCaseError)) {
          throw perCaseError;
        }
        documentsFailed++;
        this.context.logger.error(
          MODULE_NAME,
          `Failed to remap case ${surrogate.caseId} for fingerprint ${message.fingerprint} — its surrogate row is left in place for the next attempt to rediscover.`,
          perCaseError,
        );
      }
    }

    return {
      documentsWritten,
      documentsFailed,
      totalCandidates: surrogates.length,
      pageSize: page.length,
      remainingCount,
    };
  }
}

export default TrusteeVerificationRemapUseCase;
