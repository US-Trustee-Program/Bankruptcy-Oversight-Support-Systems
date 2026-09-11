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
  nextLastId: string | null;
};

// _id (cursor bookkeeping) and reason/acmsProfessionalId (sentinel-only markers written by
// migrate-case-appointments) are never valid on a real, resolved appointment and must not survive
// into the healed upsert payload.
type SentinelAppointment = CaseAppointment & {
  _id: string;
  reason?: string;
  acmsProfessionalId?: string;
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
   * The upsert payload spreads the full sentinel rather than naming an allow-list of fields.
   * migrate-case-appointments populates unassignedOn/closedDate/reopenedDate straight off ACMS's
   * own historical record, uncorrelated with why a row became a sentinel in the first place (that
   * only depends on whether the professional ID resolved) — so a sentinel can genuinely represent
   * an already-closed or -reopened case. upsert() is a full replaceOne with no merge against the
   * existing document, so naming only some fields would silently discard whichever of those the
   * sentinel actually carried, and — since caseStatus is derived from closedDate inside upsert()
   * — would misreport a closed case as 'OPEN' after healing. Only the sentinel-only markers
   * (_id, reason, acmsProfessionalId) and the field actually being resolved (trusteeId) are
   * excluded/overridden; everything else survives unchanged.
   *
   * Returns false when no CAMS trustee mapping exists yet for this sentinel's acmsProfessionalId
   * — the sentinel is left in place for a future run once trustee-professional-ids improves.
   */
  private async healSentinelAppointment(
    sentinel: SentinelAppointment,
  ): Promise<{ healed: boolean }> {
    if (!sentinel.acmsProfessionalId) {
      return { healed: false };
    }

    const matches = await this.professionalIdsRepo.findByAcmsProfessionalId(
      sentinel.acmsProfessionalId,
    );
    if (matches.length !== 1) {
      return { healed: false };
    }

    const {
      _id: _mongoId,
      id: _id,
      reason: _reason,
      acmsProfessionalId: _acmsId,
      ...rest
    } = sentinel;
    await this.appointmentsRepo.upsert({ ...rest, trusteeId: matches[0].camsTrusteeId });

    await this.appointmentsRepo.delete(sentinel.id);

    return { healed: true };
  }

  /**
   * Heals up to pageSize sentinel appointments starting after lastId. Cursor-paged (unlike
   * TrusteeVerificationRemapUseCase.remapPage's no-cursor re-query): a sentinel that can't be
   * resolved this run (no mapping, ambiguous mapping, missing acmsProfessionalId, or a permanent
   * per-record failure) is left in place rather than deleted, so a no-cursor query would keep
   * re-fetching the same unresolvable leading page forever and never reach resolvable sentinels
   * further back in the collection. The cursor guarantees forward progress through the whole
   * population every run regardless of how many rows any single page manages to heal.
   * nextLastId is the greatest _id seen this page, or null if the page was empty (the caller's
   * termination signal) — advances past both healed and left-in-place rows alike.
   */
  async healPage(lastId: string | null, pageSize: number): Promise<HealPageResult> {
    const page = await this.appointmentsRepo.findSentinelAppointments(lastId, pageSize);

    let documentsWritten = 0;
    let documentsFailed = 0;

    for (const sentinel of page) {
      try {
        const { healed } = await this.healSentinelAppointment(sentinel as SentinelAppointment);
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

    const nextLastId = page.length > 0 ? page[page.length - 1]._id : null;

    return {
      documentsWritten,
      documentsFailed,
      pageSize: page.length,
      nextLastId,
    };
  }
}

export default HealSentinelCaseAppointmentsUseCase;
