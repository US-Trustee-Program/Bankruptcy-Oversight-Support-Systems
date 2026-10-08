import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { TrusteeVerificationRemapMessage } from '@common/cams/dataflow-events';
import { TrusteeCaseAppointmentsRepository } from '../gateways.types';

const MODULE_NAME = 'TRUSTEE-VERIFICATION-REMAP-USE-CASE';

type RemapPageResult = {
  documentsWritten: number;
  documentsFailed: number;
  totalCandidates: number;
  pageSize: number;
  remainingCount: number;
};

class TrusteeVerificationRemapUseCase {
  private readonly context: ApplicationContext;
  private readonly appointmentsRepo: TrusteeCaseAppointmentsRepository;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
  }

  /**
   * Remaps a single surrogate CaseAppointment to the resolved real trustee: soft-close a
   * different-trustee real appointment if one exists (a genuine real->real trustee change,
   * a historical fact), upsert the canonical appointment under resolvedTrusteeId, then delete
   * the surrogate. Order is soft-close -> upsert -> delete: upserting before soft-closing would
   * transiently leave two active real rows (getActiveByCaseId's findOne would then return an
   * arbitrary one), whereas a failed upsert after a soft-close only leaves the case showing no
   * trustee — recoverable, and self-healing on retry since the surrogate is untouched until the
   * upsert succeeds. assignedOn is carried from the surrogate row (not stamped fresh) so the
   * upsert's natural key (caseId, trusteeId, assignedOn) makes retries genuinely idempotent.
   */
  private async remapSurrogateAppointment(
    surrogate: CaseAppointment,
    message: TrusteeVerificationRemapMessage,
  ): Promise<void> {
    const existingReal = await this.appointmentsRepo.getActiveByCaseId(surrogate.caseId);

    if (existingReal && existingReal.trusteeId !== message.resolvedTrusteeId) {
      await this.appointmentsRepo.updateCaseAppointment({
        ...existingReal,
        unassignedOn: new Date().toISOString(),
      });
    }

    if (!existingReal || existingReal.trusteeId !== message.resolvedTrusteeId) {
      await this.appointmentsRepo.upsert({
        caseId: surrogate.caseId,
        trusteeId: message.resolvedTrusteeId,
        assignedOn: surrogate.assignedOn,
        appointedDate: surrogate.appointedDate,
        dateFiled: surrogate.dateFiled,
        chapter: surrogate.chapter,
        courtDivisionCode: surrogate.courtDivisionCode,
      });
    }

    await this.appointmentsRepo.delete(surrogate.id);
  }

  /**
   * Remaps up to pageSize cases sharing message.fingerprint's pending mismatch from their
   * surrogate placeholder to the resolved real trustee. Natural idempotency: a remapped case's
   * surrogate row is deleted outright, so re-querying getSurrogatesByFingerprint(fingerprint)
   * after a partial batch failure returns only the cases that haven't been remapped yet — no
   * retryCount-based skip logic is needed. The one case a retry may re-encounter is one whose
   * canonical upsert succeeded but whose surrogate delete failed; the idempotent upsert makes
   * reprocessing it a no-op and the retry completes the delete.
   *
   * A rate-limit or gateway-timeout error mid-page rethrows immediately rather than being
   * counted as a per-case failure — both are batch-level Cosmos infra-pressure conditions the
   * caller must back off and retry (same convention as isTransientInfraError in
   * sync-trustee-case-appointments.ts and resolveNameCollisionByScoring in
   * trustee-match.helpers.ts), not a permanent failure for the one case that happened to hit it
   * while the rest of the page is untouched.
   */
  async remapPage(
    message: TrusteeVerificationRemapMessage,
    pageSize: number,
  ): Promise<RemapPageResult> {
    const surrogates = await this.appointmentsRepo.getSurrogatesByFingerprint(message.fingerprint);
    const page = surrogates.slice(0, pageSize);
    const remainingCount = surrogates.length - page.length;

    let documentsWritten = 0;
    let documentsFailed = 0;

    for (const surrogate of page) {
      try {
        await this.remapSurrogateAppointment(surrogate, message);
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
