import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import DateHelper from '@common/date-helper';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import {
  regionBookmarkPath,
  toRegionId,
  TrusteeAppointmentRegionSyncState,
} from '../gateways.types';
import { isAcmsTimeoutError } from './acms-timeout-error';
import {
  AcmsTrusteeAppointmentSource,
  DxtrTrusteeAppointmentSource,
  TrusteeAppointmentSourceRowFailure,
  TrusteeAppointmentSource,
} from './trustee-appointment-source';
import SyncTrusteeCaseAppointments from './sync-trustee-case-appointments';
import { shouldEscape, DEFAULT_INVOCATION_BUDGET_MS } from './invocation-budget';
import { buildQueueError, QueueError } from './queue-types';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { isTransientInfraError } from '../../common-errors/transient-infra-error';

const MODULE_NAME = 'TRUSTEE-APPOINTMENT-REGION-DRIVER';
const REGION_STATE_DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE';

/** The nationwide July 2026 case-appointment migration cutover -- a region's first run starts here. */
export const CUTOVER_DATE = '2026-07-01';

/**
 * Worst-case wall-clock cost of one page: a source read can take up to its request timeout, then
 * its events are written to Cosmos. Both sources' page reads are bounded at 5 minutes:
 * - ACMS: ACMS_REQUEST_TIMEOUT_MS in acms.gateway.ts (DEFAULT_ACMS_REQUEST_TIMEOUT_MS, 5 minutes,
 *   overridable by env).
 * - DXTR: REGION_TRUSTEE_APPOINTMENTS_REQUEST_TIMEOUT_MS in cases.dxtr.gateway.ts (fixed 5
 *   minutes).
 * A page is not started unless this much budget remains, so a slow page cannot carry the
 * invocation past the host's functionTimeout and get killed and redelivered. Raising either
 * timeout above 5 minutes requires raising this cost too.
 */
export const PAGE_STEP_COST_MS = 6 * 60 * 1000;

function createDeps(context: ApplicationContext) {
  return {
    context,
    regionStateRepo: factory.getRuntimeStateRepository<TrusteeAppointmentRegionSyncState>(context),
  };
}

type RegionDriverDeps = ReturnType<typeof createDeps>;

/** Errors a later invocation can retry: ACMS/MSSQL timeouts, Cosmos throttling, gateway timeouts. */
export function isTransientError(error: unknown): boolean {
  return isAcmsTimeoutError(error) || isTransientInfraError(error);
}

/**
 * Falls back to an empty region map only when no document has ever been written (first-ever run).
 * Any other read failure propagates: treating a transient error as a first run would walk every
 * region from CUTOVER_DATE and reprocess its full history.
 */
async function readRegionState(deps: RegionDriverDeps): Promise<TrusteeAppointmentRegionSyncState> {
  try {
    return await deps.regionStateRepo.read(REGION_STATE_DOCUMENT_TYPE);
  } catch (error) {
    if (isNotFoundError(error)) {
      return { documentType: REGION_STATE_DOCUMENT_TYPE, region: {} };
    }
    throw error;
  }
}

/**
 * A region a SuperUser switched to DXTR (region.<id>.source, written by the Trustee Task Regions
 * admin page) reads from DXTR; every other region reads from ACMS. The switch is one-way.
 */
function getSourceForRegion(
  regionState: TrusteeAppointmentRegionSyncState['region'][string] | undefined,
): TrusteeAppointmentSource {
  return regionState?.source?.system === 'DXTR'
    ? new DxtrTrusteeAppointmentSource()
    : new AcmsTrusteeAppointmentSource();
}

/**
 * Every distinct region in CAMS office data, used by the start handler's fan-out (no region list
 * named) to schedule every region into lanes. Zero-pads each regionId to 2 digits: the DXTR
 * offices gateway strips zero-padding (e.g. "02" -> "2"), which would otherwise silently fork a
 * region's bookmark/lane bucket from the zero-padded key (region.02.lastSyncDate) the rest of
 * this driver already reads and writes.
 */
async function getAllRegionIds(context: ApplicationContext): Promise<string[]> {
  const officesGateway = factory.getOfficesGateway(context);
  const offices = await officesGateway.getOffices(context);
  const regionIds = new Set(offices.map((office) => toRegionId(office.regionId)));
  return [...regionIds];
}

/**
 * Dead-letter entry for a source row that could not be converted. Only ACMS rows can fail
 * conversion: DxtrTrusteeAppointmentSource always returns failures: [].
 */
function toRowFailureDlqEntry(
  sourceName: TrusteeAppointmentSource['name'],
  regionId: string,
  changeDate: string,
  failure: TrusteeAppointmentSourceRowFailure,
): QueueError {
  const message = `${sourceName} row ${failure.rowId} (case ${failure.caseId}, region ${regionId}, change date ${changeDate}) could not be converted: ${failure.reason}`;
  return buildQueueError(
    getCamsError(new Error(message), MODULE_NAME, message),
    MODULE_NAME,
    'getEventsForDate',
  );
}

export type RegionDriverResumePoint = {
  regionId: string;
  date: string;
  lastId?: string;
  /** The source lastId belongs to. A cursor from another source (or none recorded) is not reused. */
  source?: TrusteeAppointmentSource['name'];
};

type RegionDriverRecordResults = {
  dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | QueueError)[];
  retryableEvents: TrusteeAppointmentSyncEvent[];
};

type RegionDriverOptions = {
  regions: string[];
  runDate: string;
  /** Where the previous invocation left off, if it escaped mid-run (see continuation below). */
  resumeFrom?: RegionDriverResumePoint;
  /** Invocation start time, so setup such as the optional delete counts against the budget; defaults to Date.now() when omitted. */
  startedAt?: number;
  /** Injectable for deterministic unit tests; defaults to DEFAULT_INVOCATION_BUDGET_MS in production. */
  safeThresholdMs?: number;
  /**
   * Receives each finished date's results before the date's bookmark is written, so results for
   * a bookmarked date (never re-read) are delivered before the bookmark makes them unrecoverable.
   * Results it receives are not returned again. If it throws a transient error
   * the bookmark is not written and the continuation re-reads the whole date. Without it, results
   * accumulate and are returned.
   */
  onDateComplete?: (results: RegionDriverRecordResults) => Promise<void>;
};

/** Why the driver stopped early: the invocation budget ran out, or a transient error was thrown. */
type RegionDriverStopCause = 'invocation-budget' | 'transient-error';

type RegionDriverContinuation = {
  regions: string[];
  runDate: string;
  /** Absent when the stop happened before any date of the region was reached. */
  resumeFrom?: RegionDriverResumePoint;
  cause: RegionDriverStopCause;
};

type RegionDriverResult = {
  /** Regions that reached the end of their available dates this invocation (not just started). */
  processedRegions: string[];
  /** Per-record failures: sync errors and events from processAppointments, plus source rows that could not be converted. */
  dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | QueueError)[];
  retryableEvents: TrusteeAppointmentSyncEvent[];
  /** Rows parked as CASE_APPOINTMENT_UNATTACHED (case not yet in CAMS), summed across pages. */
  parkedCount: number;
  /** Present when the run stopped early; re-invoke with these exact options. */
  continuation?: RegionDriverContinuation;
};

/**
 * Walks one region's unprocessed dates and advances its bookmark, respecting the maintainer's
 * bookmark rule: "a date is complete only when a later date exists" -- the single newest date
 * known to have data (source.getLatestChangeDate) is always processed but never
 * bookmarked, since the replica could still be mid-write for it. A later run that discovers a
 * genuinely later date proves the withheld date complete and bookmarks it then.
 *
 * Stops early, returning a continuation, when the invocation budget runs out or a transient error
 * is thrown. Each step records the resume point it would need before doing its work, so the
 * continuation names exactly the work that is not yet complete. Results gathered before the stop
 * are returned, not dropped. Other errors propagate unchanged.
 */
async function runRegionDriver(
  context: ApplicationContext,
  options: RegionDriverOptions,
): Promise<RegionDriverResult> {
  const deps = createDeps(context);
  const eventDeps = SyncTrusteeCaseAppointments.createDeps(context);
  const startedAt = options.startedAt ?? Date.now();
  const safeThresholdMs = options.safeThresholdMs ?? DEFAULT_INVOCATION_BUDGET_MS;
  const dayBeforeRunDate = DateHelper.subtractDays(options.runDate, 1);

  const processedRegions: string[] = [];
  const dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent | QueueError)[] =
    [];
  const retryableEvents: TrusteeAppointmentSyncEvent[] = [];
  let parkedCount = 0;
  // The current date's results, until the date finishes and they are handed off.
  let dateResults: RegionDriverRecordResults = { dlqMessages: [], retryableEvents: [] };
  const handOffDateResults =
    options.onDateComplete ??
    (async (results: RegionDriverRecordResults) => {
      dlqMessages.push(...results.dlqMessages);
      retryableEvents.push(...results.retryableEvents);
    });

  let regionIndex = 0;
  let resumeAt: RegionDriverResumePoint | undefined = options.resumeFrom;
  const stopAt = (
    index: number,
    resumeFrom: RegionDriverResumePoint | undefined,
    cause: RegionDriverStopCause,
  ): RegionDriverResult => ({
    processedRegions,
    dlqMessages: [...dlqMessages, ...dateResults.dlqMessages],
    retryableEvents: [...retryableEvents, ...dateResults.retryableEvents],
    parkedCount,
    continuation: {
      regions: options.regions.slice(index),
      runDate: options.runDate,
      resumeFrom,
      cause,
    },
  });

  try {
    const state = await readRegionState(deps);

    for (let i = 0; i < options.regions.length; i++) {
      regionIndex = i;
      const regionId = options.regions[i];
      const source = getSourceForRegion(state.region[regionId]);
      const resumeHere = options.resumeFrom?.regionId === regionId ? options.resumeFrom : undefined;
      resumeAt = resumeHere;

      context.logger.info(MODULE_NAME, 'Reading region from source', {
        regionId,
        source: source.name,
      });
      if (resumeHere && resumeHere.source !== source.name) {
        context.logger.warn(
          MODULE_NAME,
          'Continuation cursor came from a different source; restarting the date',
          { regionId, source: source.name, resumeSource: resumeHere.source },
        );
      }

      // The latest-date read can take as long as a page, so it needs the same budget check.
      if (shouldEscape(startedAt, safeThresholdMs, PAGE_STEP_COST_MS)) {
        return stopAt(i, resumeHere, 'invocation-budget');
      }

      const latestChangeDate = await source.getLatestChangeDate(context, regionId);
      if (!latestChangeDate) {
        // No data at all for this region yet -- nothing to process, nothing to bookmark.
        processedRegions.push(regionId);
        continue;
      }

      // The run date itself is never read, regardless of what the replica's own latest date is.
      const effectiveEnd =
        latestChangeDate < dayBeforeRunDate ? latestChangeDate : dayBeforeRunDate;

      const bookmark = state.region[regionId]?.lastSyncDate;
      let currentDate = resumeHere
        ? resumeHere.date
        : bookmark
          ? DateHelper.addDays(bookmark, 1)
          : CUTOVER_DATE;
      // A switch to DXTR can land while a continuation is queued; another source's cursor would
      // skip rows, so restart the date instead (re-reading is safe: writes are idempotent).
      let lastId = resumeHere?.source === source.name ? resumeHere.lastId : undefined;

      while (currentDate <= effectiveEnd) {
        while (true) {
          resumeAt = { regionId, date: currentDate, lastId, source: source.name };
          if (shouldEscape(startedAt, safeThresholdMs, PAGE_STEP_COST_MS)) {
            return stopAt(i, resumeAt, 'invocation-budget');
          }

          const page = await source.getEventsForDate(context, regionId, currentDate, lastId);
          for (const failure of page.failures) {
            dateResults.dlqMessages.push(
              toRowFailureDlqEntry(source.name, regionId, currentDate, failure),
            );
          }
          if (page.events.length > 0) {
            const result = await SyncTrusteeCaseAppointments.processAppointments(
              eventDeps,
              page.events,
            );
            dateResults.dlqMessages.push(...result.dlqMessages);
            dateResults.retryableEvents.push(...result.retryableEvents);
            parkedCount += result.scenarioDistribution.parkedCount;
          }

          if (!page.lastId) break;
          lastId = page.lastId;
        }

        // If the hand-off fails, re-read the whole date: its results are dropped here, and
        // re-reading regenerates them (writes are idempotent). A hand-off that failed part-way
        // already sent some messages, so the re-read sends those again: a duplicate DLQ entry or
        // retry page, which is harmless because processing an event twice writes the same rows.
        resumeAt = { regionId, date: currentDate, lastId: undefined, source: source.name };
        const finishedDateResults = dateResults;
        dateResults = { dlqMessages: [], retryableEvents: [] };
        await handOffDateResults(finishedDateResults);

        if (currentDate < effectiveEnd) {
          resumeAt = {
            regionId,
            date: DateHelper.addDays(currentDate, 1),
            lastId: undefined,
            source: source.name,
          };
          await deps.regionStateRepo.setField(
            REGION_STATE_DOCUMENT_TYPE,
            regionBookmarkPath(regionId),
            currentDate,
          );
        }

        currentDate = DateHelper.addDays(currentDate, 1);
        lastId = undefined;
      }

      processedRegions.push(regionId);
    }
  } catch (error) {
    if (!isTransientError(error)) throw error;
    return stopAt(regionIndex, resumeAt, 'transient-error');
  }

  return { processedRegions, dlqMessages, retryableEvents, parkedCount };
}

const RegionDriver = {
  MODULE_NAME,
  createDeps,
  runRegionDriver,
  getAllRegionIds,
};

export default RegionDriver;
