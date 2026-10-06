import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { HealSentinelProfessionalId } from '@common/cams/dataflow-events';
import {
  TrusteeCaseAppointmentsRepository,
  TrusteeProfessionalIdsRepository,
} from '../gateways.types';

const MODULE_NAME = 'HEAL-SENTINEL-CASE-APPOINTMENTS-USE-CASE';

type HealCursor = {
  lastProfessionalIdDocId: string | null;
  current: HealSentinelProfessionalId | null;
};

type HealStepResult = {
  documentsWritten: number;
  documentsFailed: number;
  pageSize: number;
  next: HealCursor | null;
};

// _id (cursor bookkeeping) and reason/acmsProfessionalId (sentinel-only markers written by
// migrate-case-appointments) are never valid on a real, resolved appointment and must not survive
// into the healed upsert payload.
type SentinelAppointment = CaseAppointment & {
  _id: string;
  reason?: string;
  acmsProfessionalId?: string;
};

/**
 * Heals sentinel appointments (trusteeId === SENTINEL_TRUSTEE_ID) one linked trustee-professional-ids
 * record at a time, rather than paging the whole sentinel population: only sentinels whose ACMS ID
 * is linked can heal, and a record is flagged sentinelsHealedOn once none remain for it, so each
 * linked ID is worked once and later runs only visit newly linked IDs.
 */
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
   * Upserts the sentinel under camsTrusteeId, then deletes the sentinel. Order is upsert ->
   * delete: a failed upsert leaves the sentinel in place to retry, whereas deleting first could
   * lose the case's only appointment record. trusteeId is the trustee partition's shard key, so
   * this is a new document rather than an in-place update; upsert()'s natural key (caseId,
   * trusteeId, assignedOn) makes re-healing an already-healed case a no-op replace.
   *
   * The payload spreads the full sentinel rather than an allow-list. A sentinel can carry a
   * closed or reopened case's unassignedOn/closedDate/reopenedDate, and upsert() is a full
   * replaceOne that derives caseStatus from closedDate, so an allow-list that missed any of them
   * would discard ACMS history and misreport a closed case as OPEN.
   */
  private async healSentinelAppointment(
    sentinel: SentinelAppointment,
    camsTrusteeId: string,
  ): Promise<void> {
    const {
      _id: _mongoId,
      id: _id,
      reason: _reason,
      acmsProfessionalId: _acmsId,
      ...rest
    } = sentinel;
    await this.appointmentsRepo.upsert({ ...rest, trusteeId: camsTrusteeId });
    await this.appointmentsRepo.deleteSentinel(sentinel.caseId, sentinel.id);
  }

  /**
   * An ACMS ID linked to more than one trustee leaves it unknown which trustee its sentinels
   * belong to, so its sentinels are left in place and the record unflagged for manual resolution.
   */
  private async hasSingleLink(acmsProfessionalId: string): Promise<boolean> {
    const links = await this.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId);
    if (links.length === 1) return true;
    this.context.logger.warn(
      MODULE_NAME,
      `ACMS professional ID ${acmsProfessionalId} is linked to ${links.length} trustees; its sentinel appointments are left in place.`,
    );
    return false;
  }

  /**
   * Flags the record healed if no sentinels remain for it. A sentinel that failed to heal stays
   * behind, so the record stays unflagged and is retried on the next run.
   */
  private async finishProfessionalId(current: HealSentinelProfessionalId): Promise<void> {
    const remaining = await this.appointmentsRepo.findSentinelAppointmentsByAcmsProfessionalId(
      current.acmsProfessionalId,
      null,
      1,
    );
    if (remaining.length === 0) {
      await this.professionalIdsRepo.markSentinelsHealed(
        current.camsTrusteeId,
        current.acmsProfessionalId,
      );
      return;
    }
    this.context.logger.warn(
      MODULE_NAME,
      `Sentinel appointments remain for ACMS professional ID ${current.acmsProfessionalId} after a failed heal; it is left unflagged for the next run.`,
    );
  }

  /**
   * Heals up to pageSize sentinels for one linked record and returns the cursor for the next
   * invocation, or next: null when no linked record is pending. A record stays current while
   * full pages come back; a short page means its sentinels are exhausted, so it is finished and
   * the cursor moves past it whether or not it was flagged.
   */
  async healNext(cursor: HealCursor, pageSize: number): Promise<HealStepResult> {
    let current = cursor.current;
    if (!current) {
      const [link] = await this.professionalIdsRepo.findLinkedPendingSentinelHeal(
        cursor.lastProfessionalIdDocId,
        1,
      );
      if (!link) {
        return { documentsWritten: 0, documentsFailed: 0, pageSize: 0, next: null };
      }
      if (!(await this.hasSingleLink(link.acmsProfessionalId))) {
        return {
          documentsWritten: 0,
          documentsFailed: 0,
          pageSize: 0,
          next: { lastProfessionalIdDocId: link._id, current: null },
        };
      }
      current = {
        professionalIdDocId: link._id,
        camsTrusteeId: link.camsTrusteeId,
        acmsProfessionalId: link.acmsProfessionalId,
        lastAppointmentId: null,
      };
    }

    const page = await this.appointmentsRepo.findSentinelAppointmentsByAcmsProfessionalId(
      current.acmsProfessionalId,
      current.lastAppointmentId,
      pageSize,
    );

    let documentsWritten = 0;
    let documentsFailed = 0;
    for (const sentinel of page) {
      try {
        await this.healSentinelAppointment(sentinel as SentinelAppointment, current.camsTrusteeId);
        documentsWritten++;
      } catch (perRecordError) {
        if (isTooManyRequestsError(perRecordError) || isGatewayTimeoutError(perRecordError)) {
          throw perRecordError;
        }
        documentsFailed++;
        this.context.logger.error(
          MODULE_NAME,
          `Failed to heal sentinel appointment for case ${sentinel.caseId} — its sentinel row is left in place.`,
          perRecordError,
        );
      }
    }

    const counts = { documentsWritten, documentsFailed, pageSize: page.length };
    if (page.length === pageSize) {
      return {
        ...counts,
        next: {
          lastProfessionalIdDocId: cursor.lastProfessionalIdDocId,
          current: { ...current, lastAppointmentId: page[page.length - 1]._id },
        },
      };
    }

    await this.finishProfessionalId(current);
    return {
      ...counts,
      next: { lastProfessionalIdDocId: current.professionalIdDocId, current: null },
    };
  }
}

export default HealSentinelCaseAppointmentsUseCase;
