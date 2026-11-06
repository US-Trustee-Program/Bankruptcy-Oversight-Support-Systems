/**
 * The ONLY place this harness binds to production code or persisted shapes that do not exist yet.
 *
 * Everything else in the harness calls code that exists today. The seams below are the parts of
 * CAMS-955/957 still to be built; until then they throw NotImplementedError (or assume a shape, said
 * so in the comment) and the scenarios that need them report "NOT IMPLEMENTED". When the production
 * code lands, wire it here and the scenarios start running for real.
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
 * paged by id). Expected to be exported from trustee-appointment-source.ts as
 * `AcmsTrusteeAppointmentSource` with a no-argument constructor, like DxtrTrusteeAppointmentSource.
 * Adjust the lookup below if it lands under another name or location.
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

/**
 * The DXTR source as it exists today (a non-functional stub per its own docblock, until GitHub #3191):
 * it ignores regionId and reads by transaction date. The harness drives it as-is so DXTR keeps flowing
 * through the same seam.
 */
export function getDxtrSource(): TrusteeAppointmentSource {
  return new DxtrTrusteeAppointmentSource();
}

/**
 * Seam 2: the per-region driver (cams-fd8qd.1.10, plus the CAMS-957 source switch): for each region
 * named, read its bookmark and source (ACMS unless switched to DXTR), walk change dates (catch-up from
 * 2026-07-01, a date is complete only when a later date exists, the run date itself is never read),
 * process events, and advance the bookmark.
 *
 * The harness assumes this contract; adapt this function to the as-built API rather than the harness.
 */
export type RegionDriverResult = { processedRegions: string[] };
export async function runRegionDriver(
  _context: ApplicationContext,
  _options: { regions: string[]; runDate: string },
): Promise<RegionDriverResult> {
  throw new NotImplementedError(
    'The per-region sync driver is not built (cams-fd8qd.1.10: per-region start/continuation flow)',
  );
}

/**
 * Seam 3 (ASSUMED SHAPE): the per-region runtime-state document. Shape from cams-fd8qd.1.3 and cams-rxb7a:
 * one document {documentType, regions: {<regionId>: {lastSyncDate?, source?: {system, updatedOn, updatedBy}}}}.
 * The document type name is an example in the bead ("e.g."); correct it here when the real one exists.
 * `source` unset means ACMS.
 */
const REGION_STATE_DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE';

export async function seedRegionState(
  db: Db,
  state: { bookmarks?: Record<string, string>; switchedToDxtr?: string[] },
): Promise<void> {
  const regions: Record<string, { lastSyncDate?: string; source?: unknown }> = {};
  for (const [region, lastSyncDate] of Object.entries(state.bookmarks ?? {})) {
    regions[region] = { ...regions[region], lastSyncDate };
  }
  const now = new Date().toISOString();
  for (const region of state.switchedToDxtr ?? []) {
    regions[region] = {
      ...regions[region],
      source: { system: 'DXTR', updatedOn: now, updatedBy: { id: 'SYSTEM', name: 'SYSTEM' } },
    };
  }
  if (Object.keys(regions).length === 0) return;
  await db
    .collection('runtime-state')
    .insertOne({ id: randomUUID(), documentType: REGION_STATE_DOCUMENT_TYPE, regions });
}

/** The latest fully processed date for a region, or undefined. Same assumed shape as seedRegionState. */
export async function readRegionBookmark(db: Db, region: string): Promise<string | undefined> {
  const docs = await db
    .collection('runtime-state')
    .find({ documentType: /REGION/ })
    .toArray();
  for (const d of docs) {
    const v = (d.regions?.[region] ?? d.region?.[region])?.lastSyncDate as string | undefined;
    if (v) return v.slice(0, 10);
  }
  return undefined;
}
