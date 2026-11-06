import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import DateHelper from '@common/date-helper';
import {
  TrusteeAppointmentSyncError,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import { TrusteeAppointmentRegionSyncState } from '../gateways.types';
import {
  AcmsTrusteeAppointmentSource,
  TrusteeAppointmentSource,
} from './trustee-appointment-source';
import SyncTrusteeCaseAppointments from './sync-trustee-case-appointments';
import { shouldEscape, DEFAULT_INVOCATION_BUDGET_MS } from './invocation-budget';

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

/** Falls back to an empty region map when no document has ever been written (first-ever run). */
async function readRegionState(deps: RegionDriverDeps): Promise<TrusteeAppointmentRegionSyncState> {
  try {
    return await deps.regionStateRepo.read(REGION_STATE_DOCUMENT_TYPE);
  } catch (_error) {
    return { documentType: REGION_STATE_DOCUMENT_TYPE, region: {} };
  }
}

/**
 * CAMS-957 (a SuperUser's one-way per-region switch to DXTR) is a separate, not-yet-built ticket
 * -- every region syncs from ACMS unconditionally for this bead, regardless of state.region.
 */
function getSourceForRegion(): TrusteeAppointmentSource {
  return new AcmsTrusteeAppointmentSource();
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

type RegionDriverContinuation = {
  regions: string[];
  runDate: string;
  resumeFrom: RegionDriverResumePoint;
};

type RegionDriverResult = {
  /** Regions that reached the end of their available dates this invocation (not just started). */
  processedRegions: string[];
  dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[];
  retryableEvents: TrusteeAppointmentSyncEvent[];
  notYetSyncedEvents: TrusteeAppointmentSyncEvent[];
  /** Present when the invocation budget ran out mid-run; re-invoke with these exact options. */
  continuation?: RegionDriverContinuation;
};

/**
 * Walks one region's unprocessed dates and advances its bookmark, respecting the maintainer's
 * bookmark rule: "a date is complete only when a later date exists" -- the single newest date
 * known to have data (getLatestCmmapChangeDateForRegion) is always processed but never
 * bookmarked, since the replica could still be mid-write for it. A later run that discovers a
 * genuinely later date proves the previously-withheld date complete and bookmarks it then.
 *
 * Per-date, per-page escape via invocation-budget.ts: on escape, returns immediately with a
 * continuation identifying exactly where to resume (this region, this date, this page cursor) --
 * the bookmark never advances past an in-progress date, so a continuation never risks skipping
 * data even if its resume point is slightly stale by the time it's re-invoked.
 */
async function runRegionDriver(
  context: ApplicationContext,
  options: RegionDriverOptions,
): Promise<RegionDriverResult> {
  const deps = createDeps(context);
  const eventDeps = SyncTrusteeCaseAppointments.createDeps(context);
  const startedAt = options.startedAt ?? Date.now();
  const safeThresholdMs = options.safeThresholdMs ?? DEFAULT_INVOCATION_BUDGET_MS;
  const state = await readRegionState(deps);
  const dayBeforeRunDate = DateHelper.subtractDays(options.runDate, 1);

  const processedRegions: string[] = [];
  const dlqMessages: (TrusteeAppointmentSyncError | TrusteeAppointmentSyncEvent)[] = [];
  const retryableEvents: TrusteeAppointmentSyncEvent[] = [];
  const notYetSyncedEvents: TrusteeAppointmentSyncEvent[] = [];

  for (let i = 0; i < options.regions.length; i++) {
    const regionId = options.regions[i];
    const source = getSourceForRegion();
    const resumeHere = options.resumeFrom?.regionId === regionId ? options.resumeFrom : undefined;

    const latestChangeDate = await source.getLatestChangeDate(context, regionId);
    if (!latestChangeDate) {
      // No data at all for this region yet -- nothing to process, nothing to bookmark.
      processedRegions.push(regionId);
      continue;
    }

    // The run date itself is never read, regardless of what the replica's own latest date is.
    const effectiveEnd = latestChangeDate < dayBeforeRunDate ? latestChangeDate : dayBeforeRunDate;

    const bookmark = state.region[regionId]?.lastSyncDate;
    let currentDate = resumeHere
      ? resumeHere.date
      : bookmark
        ? DateHelper.addDays(bookmark, 1)
        : CUTOVER_DATE;
    let lastId = resumeHere?.lastId;

    while (currentDate <= effectiveEnd) {
      let hadEvents = false;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (shouldEscape(startedAt, safeThresholdMs, 0)) {
          return {
            processedRegions,
            dlqMessages,
            retryableEvents,
            notYetSyncedEvents,
            continuation: {
              regions: options.regions.slice(i),
              runDate: options.runDate,
              resumeFrom: { regionId, date: currentDate, lastId },
            },
          };
        }

        const page = await source.getEventsForDate(context, regionId, currentDate, lastId);
        if (page.events.length > 0) {
          hadEvents = true;
          const result = await SyncTrusteeCaseAppointments.processAppointments(
            eventDeps,
            page.events,
          );
          dlqMessages.push(...result.dlqMessages);
          retryableEvents.push(...result.retryableEvents);
          notYetSyncedEvents.push(...result.notYetSyncedEvents);
        }

        if (!page.lastId) break;
        lastId = page.lastId;
      }

      if (hadEvents && currentDate < effectiveEnd) {
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

  return { processedRegions, dlqMessages, retryableEvents, notYetSyncedEvents };
}

const RegionDriver = {
  MODULE_NAME,
  createDeps,
  runRegionDriver,
};

export default RegionDriver;
