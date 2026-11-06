/**
 * The ONLY place this harness binds to production code that does not exist yet.
 *
 * Everything else in the harness calls code that exists today. The two seams below are the parts of
 * CAMS-955 still to be built; until then they throw NotImplementedError and the scenarios that need
 * them report "NOT IMPLEMENTED" - the expected failing state while the feature is built. When the
 * production code lands, wire it here (one function each) and the scenarios start running for real.
 */
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
 * Seam 2: the per-region driver (cams-fd8qd.1.10): given regions and a run date, reads each region's
 * bookmark, walks change dates (catch-up from 2026-07-01, a date is complete only when a later date
 * exists, the run date itself is never read), processes events, and advances the bookmark.
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
