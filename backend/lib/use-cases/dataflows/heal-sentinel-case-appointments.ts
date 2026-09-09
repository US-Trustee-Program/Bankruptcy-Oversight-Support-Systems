import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import {
  TrusteeCaseAppointmentsRepository,
  TrusteeProfessionalIdsRepository,
} from '../gateways.types';

const MODULE_NAME = 'HEAL-SENTINEL-CASE-APPOINTMENTS-USE-CASE';

type HealPageResult = {
  documentsWritten: number;
  documentsFailed: number;
  pageSize: number;
  remainingCount: number;
};

class HealSentinelCaseAppointmentsUseCase {
  private readonly context: ApplicationContext;
  private readonly appointmentsRepo: TrusteeCaseAppointmentsRepository;
  private readonly professionalIdsRepo: TrusteeProfessionalIdsRepository;

  constructor(context: ApplicationContext) {
    this.context = context;
    this.appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
    this.professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
  }

  /**
   * Resolves a single sentinel appointment (trusteeId === SENTINEL_TRUSTEE_ID) to its real
   * trustee via trustee-professional-ids, upserts the resolved appointment, then deletes the
   * sentinel. Order is upsert -> delete: a failed upsert leaves the sentinel untouched and
   * self-healing on retry, whereas deleting first would risk losing the case's only appointment
   * record if the upsert then failed. upsert()'s natural key (caseId, trusteeId, assignedOn) is
   * always used rather than an in-place update — trusteeId is the trustee partition's shard key,
   * so healing a sentinel (whose trusteeId is the shared SENTINEL_TRUSTEE_ID) into its resolved
   * trusteeId is a genuinely new partition key and cannot be an in-place update. The same upsert
   * call handles both "no appointment exists yet for this case" and "already healed via another
   * path" (e.g. a live DXTR sync) identically — the natural-key replace is a no-op in the latter
   * case, so no separate skip-write branch is needed.
   *
   * Returns false when no CAMS trustee mapping exists yet for this sentinel's acmsProfessionalId
   * — the sentinel is left in place for a future run once trustee-professional-ids improves.
   */
  private async healSentinelAppointment(sentinel: CaseAppointment): Promise<{ healed: boolean }> {
    const acmsProfessionalId = (sentinel as CaseAppointment & { acmsProfessionalId?: string })
      .acmsProfessionalId;
    if (!acmsProfessionalId) {
      return { healed: false };
    }

    const matches = await this.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
    if (matches.length !== 1) {
      return { healed: false };
    }

    await this.appointmentsRepo.upsert({
      caseId: sentinel.caseId,
      trusteeId: matches[0].camsTrusteeId,
      assignedOn: sentinel.assignedOn,
      appointedDate: sentinel.appointedDate,
      dateFiled: sentinel.dateFiled,
      chapter: sentinel.chapter,
      courtDivisionCode: sentinel.courtDivisionCode,
    });

    await this.appointmentsRepo.delete(sentinel.id);

    return { healed: true };
  }

  /**
   * Heals up to pageSize sentinel appointments. No cursor: findSentinelAppointments always
   * re-queries the same filter (trusteeId === SENTINEL_TRUSTEE_ID), and a healed sentinel is
   * deleted outright, so the next invocation's page naturally contains only what's left — same
   * rationale as TrusteeVerificationRemapUseCase.remapPage. remainingCount is not an exact
   * count of what's left; it signals "this page was full, query again" (fetched === pageSize) vs.
   * "nothing left" (fetched === 0), avoiding a separate count query every invocation.
   */
  async healPage(pageSize: number): Promise<HealPageResult> {
    const page = await this.appointmentsRepo.findSentinelAppointments(pageSize);

    let documentsWritten = 0;
    let documentsFailed = 0;

    for (const sentinel of page) {
      try {
        const { healed } = await this.healSentinelAppointment(sentinel);
        if (healed) {
          documentsWritten++;
        }
      } catch (perRecordError) {
        if (isTooManyRequestsError(perRecordError) || isGatewayTimeoutError(perRecordError)) {
          throw perRecordError;
        }
        documentsFailed++;
        this.context.logger.error(
          MODULE_NAME,
          `Failed to heal sentinel appointment for case ${sentinel.caseId} — its sentinel row is left in place for the next attempt to rediscover.`,
          perRecordError,
        );
      }
    }

    return {
      documentsWritten,
      documentsFailed,
      pageSize: page.length,
      remainingCount: page.length,
    };
  }
}

export default HealSentinelCaseAppointmentsUseCase;
