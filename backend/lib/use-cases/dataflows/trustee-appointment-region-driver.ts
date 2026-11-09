import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import DateHelper from '@common/date-helper';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import { TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { isAcmsTimeoutError } from './acms-timeout-error';
import {
  AcmsTrusteeAppointmentSource,
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
 * CAMS-957 (a SuperUser's one-way per-region switch to DXTR) is a separate, not-yet-built ticket
 * -- every region syncs from ACMS unconditionally for this bead, regardless of state.region.
 */
function getSourceForRegion(): TrusteeAppointmentSource {
  return new AcmsTrusteeAppointmentSource();
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
  const regionIds = new Set(offices.map((office) => office.regionId.padStart(2, '0')));
  return [...regionIds];
}

function toRowFailureDlqEntry(
  regionId: string,
  changeDate: string,
  failure: TrusteeAppointmentSourceRowFailure,
): QueueError {
  const message = `ACMS row ${failure.rowId} (case ${failure.caseId}, region ${regionId}, change date ${changeDate}) could not be converted: ${failure.reason}`;
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
};

type RegionDriverOptions = {
  regions: string[];
  runDate: string;
  /** Where the previous invocation left off, if it escaped mid-run (see continuation below). */
  resumeFrom?: RegionDriverResumePoint;
  /** Injectable for deterministic unit tests; defaults to Date.now() in production. */
  startedAt?: number;
  /** Injectable for deterministic unit tests; defaults to DEFAULT_INVOCATION_BUDGET_MS in production. */
  safeThresholdMs?: number;
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
 * known to have data (getLatestCmmapChangeDateForRegion) is always processed but never
 * bookmarked, since the replica could still be mid-write for it. A later run that discovers a
 * genuinely later date proves the previously-withheld date complete and bookmarks it then.
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

  let regionIndex = 0;
  let resumeAt: RegionDriverResumePoint | undefined = options.resumeFrom;
  const stopAt = (
    index: number,
    resumeFrom: RegionDriverResumePoint | undefined,
    cause: RegionDriverStopCause,
  ): RegionDriverResult => ({
    processedRegions,
    dlqMessages,
    retryableEvents,
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
      const source = getSourceForRegion();
      const resumeHere = options.resumeFrom?.regionId === regionId ? options.resumeFrom : undefined;
      resumeAt = resumeHere;

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
      let lastId = resumeHere?.lastId;

      while (currentDate <= effectiveEnd) {
        while (true) {
          resumeAt = { regionId, date: currentDate, lastId };
          if (shouldEscape(startedAt, safeThresholdMs, 0)) {
            return stopAt(i, resumeAt, 'invocation-budget');
          }

          const page = await source.getEventsForDate(context, regionId, currentDate, lastId);
          for (const failure of page.failures) {
            dlqMessages.push(toRowFailureDlqEntry(regionId, currentDate, failure));
          }
          if (page.events.length > 0) {
            const result = await SyncTrusteeCaseAppointments.processAppointments(
              eventDeps,
              page.events,
            );
            dlqMessages.push(...result.dlqMessages);
            retryableEvents.push(...result.retryableEvents);
            parkedCount += result.scenarioDistribution.parkedCount;
          }

          if (!page.lastId) break;
          lastId = page.lastId;
        }

        if (currentDate < effectiveEnd) {
          resumeAt = {
            regionId,
            date: DateHelper.addDays(currentDate, 1),
            lastId: undefined,
          };
          await deps.regionStateRepo.setField(
            REGION_STATE_DOCUMENT_TYPE,
            `region.${regionId}.lastSyncDate`,
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
