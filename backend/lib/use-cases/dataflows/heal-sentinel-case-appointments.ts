import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { isTooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { isGatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { HealSentinelCaseAppointmentsPageMessage } from '@common/cams/dataflow-events';
import {
  TrusteeCaseAppointmentsRepository,
  TrusteeProfessionalIdsRepository,
} from '../gateways.types';

const MODULE_NAME = 'HEAL-SENTINEL-CASE-APPOINTMENTS-USE-CASE';

const START_BATCH_SIZE = 1000;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 60_000;

/** Time source and sleep, injectable so tests control time. */
export type HealClock = {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
};

const SYSTEM_CLOCK: HealClock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * outcome: 'requeued' when a non-empty page was processed (the next page continues from the
 * cursor); 'escaped' when throttling or the deadline stopped the page early (delaySeconds is the
 * backoff the next attempt should wait); 'done' when no sentinels were left to read;
 * 'link-changed' when the record is no longer this ACMS ID's single link.
 */
type HealPageResult = {
  documentsWritten: number;
  documentsFailed: number;
  pageSize: number;
  outcome: 'requeued' | 'escaped' | 'done' | 'link-changed';
  delaySeconds: number;
  next: HealSentinelCaseAppointmentsPageMessage | null;
};

type Attempt<T> = { kind: 'ok'; value: T } | { kind: 'escape'; backoffMs: number };

// _id (the trustee partition's: the cursor and the sentinel delete key) and reason/acmsProfessionalId
// (sentinel-only markers written by migrate-case-appointments) are never valid on a real, resolved
// appointment and must not survive into the healed upsert payload.
type SentinelAppointment = CaseAppointment & {
  _id: string;
  reason?: string;
  acmsProfessionalId?: string;
};

function isThrottled(error: unknown): boolean {
  return isTooManyRequestsError(error) || isGatewayTimeoutError(error);
}

function resumeFrom(
  page: HealSentinelCaseAppointmentsPageMessage,
  lastAppointmentId?: string,
): HealSentinelCaseAppointmentsPageMessage {
  const { trusteeProfessionalId, camsTrusteeId, acmsProfessionalId } = page;
  return { trusteeProfessionalId, camsTrusteeId, acmsProfessionalId, lastAppointmentId };
}

function pageResult(
  outcome: HealPageResult['outcome'],
  next: HealSentinelCaseAppointmentsPageMessage | null,
  counts: Partial<HealPageResult> = {},
): HealPageResult {
  return {
    documentsWritten: 0,
    documentsFailed: 0,
    pageSize: 0,
    delaySeconds: 0,
    ...counts,
    outcome,
    next,
  };
}

function escapedResult(
  page: HealSentinelCaseAppointmentsPageMessage,
  backoffMs: number,
  cursor: string | undefined,
  counts: Partial<HealPageResult> = {},
): HealPageResult {
  return pageResult('escaped', resumeFrom(page, cursor), {
    ...counts,
    delaySeconds: Math.ceil(backoffMs / 1000),
  });
}

/**
 * Heals sentinel appointments (trusteeId === SENTINEL_TRUSTEE_ID) per linked
 * trustee-professional-ids record: startPages lists one page per linked record, and healPage heals
 * one batch of that record's sentinels per invocation, continuing from an _id cursor. A record is
 * flagged sentinelsHealedOn once none of its sentinels remain.
 */
class HealSentinelCaseAppointmentsUseCase {
  private readonly context: ApplicationContext;
  private readonly clock: HealClock;
  private readonly appointmentsRepo: TrusteeCaseAppointmentsRepository;
  private readonly professionalIdsRepo: TrusteeProfessionalIdsRepository;

  constructor(context: ApplicationContext, clock: HealClock = SYSTEM_CLOCK) {
    this.context = context;
    this.clock = clock;
    this.appointmentsRepo = factory.getTrusteeCaseAppointmentsRepository(context);
    this.professionalIdsRepo = factory.getTrusteeProfessionalIdsRepository(context);
  }

  /** One page message per linked record; already-healed records only when includeHealed. */
  async startPages(includeHealed: boolean): Promise<HealSentinelCaseAppointmentsPageMessage[]> {
    const pages: HealSentinelCaseAppointmentsPageMessage[] = [];
    let lastId: string | null = null;
    let batch: Awaited<ReturnType<TrusteeProfessionalIdsRepository['findLinkedForSentinelHeal']>>;
    do {
      batch = await this.professionalIdsRepo.findLinkedForSentinelHeal(
        lastId,
        START_BATCH_SIZE,
        includeHealed,
      );
      for (const link of batch) {
        pages.push({
          trusteeProfessionalId: link.id,
          camsTrusteeId: link.camsTrusteeId,
          acmsProfessionalId: link.acmsProfessionalId,
        });
      }
      lastId = batch.at(-1)?._id ?? lastId;
    } while (batch.length === START_BATCH_SIZE);
    return pages;
  }

  /**
   * Runs fn, sleeping and retrying with exponential backoff while Cosmos throttles (429 or gateway
   * timeout). Returns 'escape' instead of sleeping past deadline; any other error is rethrown.
   */
  private async withRateLimitRetry<T>(fn: () => Promise<T>, deadline: number): Promise<Attempt<T>> {
    for (let attempt = 0; ; attempt++) {
      try {
        return { kind: 'ok', value: await fn() };
      } catch (error) {
        if (!isThrottled(error)) throw error;
        const backoffMs = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
        if (this.clock.now() + backoffMs >= deadline) return { kind: 'escape', backoffMs };
        await this.clock.sleep(backoffMs);
      }
    }
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
  private async healSentinel(
    sentinel: SentinelAppointment,
    camsTrusteeId: string,
    deadline: number,
  ): Promise<Attempt<void>> {
    const {
      _id: _mongoId,
      id: _id,
      reason: _reason,
      acmsProfessionalId: _acmsId,
      ...rest
    } = sentinel;
    const upserted = await this.withRateLimitRetry(
      () => this.appointmentsRepo.upsert({ ...rest, trusteeId: camsTrusteeId }),
      deadline,
    );
    if (upserted.kind === 'escape') return upserted;
    const deleted = await this.withRateLimitRetry(
      () => this.appointmentsRepo.deleteSentinel(sentinel.caseId, sentinel.id, sentinel._id),
      deadline,
    );
    return deleted.kind === 'escape' ? deleted : { kind: 'ok', value: undefined };
  }

  /**
   * Heals up to pageSize sentinels for the page's record, continuing after its cursor. Stops early
   * ('escaped') when the deadline passes or a throttled call's next backoff would pass it; the
   * returned page resumes after the last sentinel completed. An empty read ends the record
   * ('done'), flagging it healed if no sentinel remains behind the cursor (a failed one stays).
   */
  async healPage(
    page: HealSentinelCaseAppointmentsPageMessage,
    deadline: number,
    pageSize: number,
  ): Promise<HealPageResult> {
    const { trusteeProfessionalId, camsTrusteeId, acmsProfessionalId } = page;

    const links = await this.withRateLimitRetry(
      () => this.professionalIdsRepo.findByAcmsProfessionalId(acmsProfessionalId),
      deadline,
    );
    if (links.kind === 'escape') {
      return escapedResult(page, links.backoffMs, page.lastAppointmentId);
    }
    const [link, ...others] = links.value;
    if (!link || others.length > 0 || link.id !== trusteeProfessionalId) {
      this.context.logger.warn(
        MODULE_NAME,
        `trustee-professional-ids record ${trusteeProfessionalId} is no longer the single link for ACMS professional ID ${acmsProfessionalId}; its sentinel appointments are left in place.`,
      );
      return pageResult('link-changed', null);
    }

    const read = await this.withRateLimitRetry(
      () =>
        this.appointmentsRepo.findSentinelAppointmentsByAcmsProfessionalId(
          acmsProfessionalId,
          page.lastAppointmentId ?? null,
          pageSize,
        ),
      deadline,
    );
    if (read.kind === 'escape') {
      return escapedResult(page, read.backoffMs, page.lastAppointmentId);
    }
    const sentinels = read.value as SentinelAppointment[];

    if (sentinels.length === 0) {
      return this.finishRecord(page, deadline);
    }

    let documentsWritten = 0;
    let documentsFailed = 0;
    let cursor = page.lastAppointmentId;
    for (const sentinel of sentinels) {
      const counts = { documentsWritten, documentsFailed, pageSize: sentinels.length };
      if (this.clock.now() >= deadline) return escapedResult(page, 0, cursor, counts);
      try {
        const healed = await this.healSentinel(sentinel, camsTrusteeId, deadline);
        if (healed.kind === 'escape') return escapedResult(page, healed.backoffMs, cursor, counts);
        documentsWritten++;
      } catch (perRecordError) {
        documentsFailed++;
        this.context.logger.error(
          MODULE_NAME,
          `Failed to heal sentinel appointment for case ${sentinel.caseId}; its sentinel row is left in place.`,
          perRecordError,
        );
      }
      cursor = sentinel._id;
    }

    return pageResult('requeued', resumeFrom(page, cursor), {
      documentsWritten,
      documentsFailed,
      pageSize: sentinels.length,
    });
  }

  private async finishRecord(
    page: HealSentinelCaseAppointmentsPageMessage,
    deadline: number,
  ): Promise<HealPageResult> {
    const { camsTrusteeId, acmsProfessionalId } = page;
    const remaining = await this.withRateLimitRetry(
      () =>
        this.appointmentsRepo.findSentinelAppointmentsByAcmsProfessionalId(
          acmsProfessionalId,
          null,
          1,
        ),
      deadline,
    );
    if (remaining.kind === 'escape') {
      return escapedResult(page, remaining.backoffMs, page.lastAppointmentId);
    }

    if (remaining.value.length > 0) {
      this.context.logger.warn(
        MODULE_NAME,
        `Sentinel appointments remain for ACMS professional ID ${acmsProfessionalId} after a failed heal; it is left unflagged for the next run.`,
      );
      return pageResult('done', null);
    }

    const marked = await this.withRateLimitRetry(
      () => this.professionalIdsRepo.markSentinelsHealed(camsTrusteeId, acmsProfessionalId),
      deadline,
    );
    if (marked.kind === 'escape') {
      return escapedResult(page, marked.backoffMs, page.lastAppointmentId);
    }
    return pageResult('done', null);
  }
}

export default HealSentinelCaseAppointmentsUseCase;
