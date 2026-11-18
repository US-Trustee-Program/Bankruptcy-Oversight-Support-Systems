/**
 * The ONLY place this harness binds to production modules by name or assumes a persisted shape.
 *
 * Everything else in the harness imports production code directly. The seams below look their
 * target up by name, so a missing export or an unwired seam throws NotImplementedError and the
 * scenarios that need it report "NOT IMPLEMENTED" instead of failing the whole run.
 */
import { Db } from 'mongodb';
import { randomUUID } from 'crypto';
import { ApplicationContext } from '../../../../backend/lib/adapters/types/basic';
import {
  TrusteeAppointmentSource,
  DxtrTrusteeAppointmentSource,
} from '../../../../backend/lib/use-cases/dataflows/trustee-appointment-source';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

/**
 * Seam 1: the ACMS TrusteeAppointmentSource (reads CMMAP/CMMDB/CMMPR for one region and change date,
 * paged by id). Exported from trustee-appointment-source.ts as `AcmsTrusteeAppointmentSource`
 * with a no-argument constructor, like DxtrTrusteeAppointmentSource.
 */
export async function getAcmsSource(): Promise<TrusteeAppointmentSource> {
  const mod =
    (await import('../../../../backend/lib/use-cases/dataflows/trustee-appointment-source')) as Record<
      string,
      unknown
    >;
  const Ctor = mod['AcmsTrusteeAppointmentSource'];
  if (typeof Ctor !== 'function') {
    throw new NotImplementedError(
      'AcmsTrusteeAppointmentSource is not exported from backend/lib/use-cases/dataflows/trustee-appointment-source.ts',
    );
  }
  return new (Ctor as new () => TrusteeAppointmentSource)();
}

/** The DXTR source: one region's trustee appointment transactions per TX_DATE day, paged by TX_ID. */
export function getDxtrSource(): TrusteeAppointmentSource {
  return new DxtrTrusteeAppointmentSource();
}

/**
 * Seam 2: the per-region driver. For each region named, reads its bookmark
 * and source (DXTR when region.<id>.source.system is 'DXTR', else ACMS), walks
 * change dates (catch-up from 2026-07-01, a date is complete only when a later date exists, the
 * run date itself is never read), processes events, and advances the bookmark.
 */
export async function runRegionDriver(
  context: ApplicationContext,
  options: { regions: string[]; runDate: string },
): Promise<{ processedRegions: string[] }> {
  const { default: RegionDriver } =
    await import('../../../../backend/lib/use-cases/dataflows/trustee-appointment-region-driver');
  const result = await RegionDriver.runRegionDriver(context, options);
  return { processedRegions: result.processedRegions };
}

/**
 * Seam 3: the per-region runtime-state document, one document with a `region` map:
 * {documentType, region: {<regionId>: {lastSyncDate?, source?: {system, updatedOn, updatedBy}}}}
 * (TrusteeAppointmentRegionSyncState, gateways.types.ts). The bookmark is written with setField at
 * "region.<regionId>.lastSyncDate" and the source at "region.<regionId>.source". `source` unset
 * means ACMS.
 */
const REGION_STATE_DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE';

export async function seedRegionState(
  db: Db,
  state: { bookmarks?: Record<string, string>; switchedToDxtr?: string[] },
): Promise<void> {
  const region: Record<string, { lastSyncDate?: string; source?: unknown }> = {};
  for (const [id, lastSyncDate] of Object.entries(state.bookmarks ?? {})) {
    region[id] = { ...region[id], lastSyncDate };
  }
  const now = new Date().toISOString();
  for (const id of state.switchedToDxtr ?? []) {
    region[id] = {
      ...region[id],
      source: { system: 'DXTR', updatedOn: now, updatedBy: { id: 'SYSTEM', name: 'SYSTEM' } },
    };
  }
  if (Object.keys(region).length === 0) return;
  await db
    .collection('runtime-state')
    .insertOne({ id: randomUUID(), documentType: REGION_STATE_DOCUMENT_TYPE, region });
}

/** The latest fully processed date for a region, or undefined. Same assumed shape as seedRegionState. */
export async function readRegionBookmark(db: Db, region: string): Promise<string | undefined> {
  const doc = await db
    .collection('runtime-state')
    .findOne({ documentType: REGION_STATE_DOCUMENT_TYPE });
  const value = doc?.region?.[region]?.lastSyncDate as string | undefined;
  return value ? value.slice(0, 10) : undefined;
}

/** The region's stored source system ('DXTR' once switched), or undefined. Same assumed shape as seedRegionState. */
export async function readRegionSource(db: Db, region: string): Promise<string | undefined> {
  const doc = await db
    .collection('runtime-state')
    .findOne({ documentType: REGION_STATE_DOCUMENT_TYPE });
  return doc?.region?.[region]?.source?.system as string | undefined;
}

/**
 * The operator delete: deletes the appointments in the named regions assigned
 * within the date range and rewinds those regions' bookmarks, as handleStart does for a start
 * message carrying `delete`.
 */
export async function deleteAppointments(
  context: ApplicationContext,
  options: { regions: string[]; from?: string; to?: string },
): Promise<{ deleted: number }> {
  const { default: SyncTrusteeCaseAppointments } =
    await import('../../../../backend/lib/use-cases/dataflows/sync-trustee-case-appointments');
  const result = await SyncTrusteeCaseAppointments.deleteAppointments(
    SyncTrusteeCaseAppointments.createDeps(context),
    options,
  );
  if (result.error) throw result.error;
  return result.data;
}
