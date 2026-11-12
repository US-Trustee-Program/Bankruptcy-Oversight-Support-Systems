import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { assertValidChapter, deriveUnassignedOn } from './sync-trustee-case-appointments';
import {
  CaseAppointment,
  TrusteeAppointment,
  isAppointmentMatch,
} from '@common/cams/trustee-appointments';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { SurrogateAppointment, TrusteeCaseAppointmentsRepository } from '../gateways.types';

const MODULE_NAME = 'TRUSTEE-VERIFICATION-REMAP-USE-CASE';

/**
 * A division/chapter mismatch found by remapSurrogateAppointment's defense-in-depth
 * re-validation is a PERMANENT condition -- the resolved trustee's appointments won't change
 * between remap attempts, so retrying this exact surrogate again will fail identically forever.
 * Distinguished from a generic per-case failure (CamsError/plain Error from a Cosmos write,
 * which genuinely might succeed on retry) so remapPage/handleRemap can stop re-queuing a page
 * that can never make progress, rather than looping on it indefinitely (reviewer-flagged on PR
 * #3090: a bundle larger than REMAP_PAGE_SIZE whose trustee doesn't cover any of it would
 * otherwise re-select and re-fail the identical first page forever, since a permanent failure
 * never deletes its surrogate and there's no cursor to skip past it).
 */
class RemapDivisionMismatchError extends Error {}

type RemapPageResult = {
  documentsWritten: number;
  documentsFailed: number;
  /**
   * Count of surrogates in this page whose resolved trustee does not cover their
   * court+chapter+division, per the defense-in-depth re-validation below. Excluded from
   * documentsFailed (which represents failures that might succeed on retry) specifically so
   * handleRemap can tell "nothing in this page can ever succeed" from "something here might
   * work next time" when deciding whether to requeue a continuation.
   */
  permanentFailureCount: number;
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
   * Re-validates isAppointmentMatch against the court fields stored on the surrogate row at write
   * time (epic decision 14; no DXTR lookup, which fails for a case not yet in CAMS) — defense in
   * depth against the race window in TrusteeMatchVerificationUseCase.approveVerification
   * between its own division-check snapshot and the TRUSTEE_VARIATION write that stops new
   * surrogates from joining this fingerprint's bucket. A surrogate admitted into the bucket
   * during that window would otherwise never have passed any division check at all. A mismatch
   * here throws RemapDivisionMismatchError, which remapPage's caller treats as a permanent
   * per-case failure (not an ordinary retryable one): the surrogate is left in place rather than
   * silently remapped to a division the trustee isn't assigned to, but it's also excluded from
   * the count that drives further continuation, since retrying it can never succeed. A row
   * missing any court field is uncovered for the same reason.
   *
   * A parked placeholder (CASE_APPOINTMENT_UNATTACHED: the case is not in CAMS yet) passes the same
   * coverage check, then stays parked with only its trustee changed: there is no CAMS case to
   * settle against, so no getActiveByCaseId/settleOpenCopy. The daily heal attaches it under the
   * active-trustee rule once the case loads. Same upsert -> delete order, so a retry re-upserts the
   * same natural key.
   */
  private async remapSurrogateAppointment(
    surrogate: SurrogateAppointment,
    message: TrusteeVerificationRemapMessage,
    trusteeAppointments: TrusteeAppointment[],
  ): Promise<void> {
    const { courtId, courtDivisionCode, chapter } = surrogate;
    if (
      !courtId ||
      !courtDivisionCode ||
      !chapter ||
      !isAppointmentMatch(trusteeAppointments, courtId, courtDivisionCode, chapter)
    ) {
      throw new RemapDivisionMismatchError(
        `Resolved trustee ${message.resolvedTrusteeId} is not assigned to the division for case ${surrogate.caseId} -- skipping remap.`,
      );
    }

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
      chapter: assertValidChapter(surrogate.caseId, chapter),
      courtId,
      courtDivisionCode,
    };
    if (isParked) {
      await this.appointmentsRepo.upsert(copy, 'CASE_APPOINTMENT_UNATTACHED');
    } else {
      await this.appointmentsRepo.upsert(copy);
    }

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
   * while the rest of the page is untouched. A genuine division mismatch, by contrast, is
   * counted in permanentFailureCount rather than documentsFailed or rethrown: it's a real
   * per-case outcome (the surrogate is correctly left unremapped), but retrying it can never
   * succeed, so it must not look like "might work next time" to handleRemap's continuation
   * decision.
   */
  async remapPage(
    message: TrusteeVerificationRemapMessage,
    pageSize: number,
  ): Promise<RemapPageResult> {
    const surrogates = await this.appointmentsRepo.getSurrogatesByFingerprint(message.fingerprint);
    const page = surrogates.slice(0, pageSize);
    const remainingCount = surrogates.length - page.length;

    // Fetched once per page, not per surrogate -- resolvedTrusteeId is fixed for the whole
    // message, so every surrogate in this page re-validates against the same appointment set.
    const trusteeAppointments = await factory
      .getTrusteeAppointmentsRepository(this.context)
      .getTrusteeAppointments(message.resolvedTrusteeId);

    let documentsWritten = 0;
    let documentsFailed = 0;
    let permanentFailureCount = 0;

    for (const surrogate of page) {
      try {
        await this.remapSurrogateAppointment(surrogate, message, trusteeAppointments);
        documentsWritten++;
      } catch (perCaseError) {
        if (isTooManyRequestsError(perCaseError) || isGatewayTimeoutError(perCaseError)) {
          throw perCaseError;
        }
        if (perCaseError instanceof RemapDivisionMismatchError) {
          permanentFailureCount++;
          this.context.logger.error(
            MODULE_NAME,
            `Case ${surrogate.caseId} for fingerprint ${message.fingerprint} is permanently uncovered by the resolved trustee — its surrogate row is left in place, but will not be retried by this continuation.`,
            perCaseError,
          );
          continue;
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
      permanentFailureCount,
      totalCandidates: surrogates.length,
      pageSize: page.length,
      remainingCount,
    };
  }
}

export default TrusteeVerificationRemapUseCase;
