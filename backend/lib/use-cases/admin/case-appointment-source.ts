import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError } from '../../common-errors/not-found-error';
import { toRegionId, TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';

const MODULE_NAME = 'CASE-APPOINTMENT-SOURCE-USE-CASE';
const REGION_STATE_DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE';

/**
 * Falls back to an empty region map only when no document has ever been written; every region
 * then defaults to ACMS, matching trustee-appointment-region-driver.ts's readRegionState.
 */
async function readRegionState(
  context: ApplicationContext,
): Promise<TrusteeAppointmentRegionSyncState> {
  const repo = factory.getRuntimeStateRepository<TrusteeAppointmentRegionSyncState>(context);
  try {
    return await repo.read(REGION_STATE_DOCUMENT_TYPE);
  } catch (error) {
    if (isNotFoundError(error)) {
      return { documentType: REGION_STATE_DOCUMENT_TYPE, region: {} };
    }
    throw error;
  }
}

/**
 * Every region from CAMS office data, paired with its appointment source from runtime-state
 * (region.<id>.source) -- absent means the region is still on ACMS, the default until CAMS-957's
 * SuperUser switch sets it to DXTR. For the Case Appointments admin page (CAMS-955 Slice 4).
 */
export async function getCaseAppointmentSources(
  context: ApplicationContext,
): Promise<RegionCaseAppointmentSource[]> {
  try {
    const officesGateway = factory.getOfficesGateway(context);
    const offices = await officesGateway.getOffices(context);

    const regionNamesById = new Map<string, string>();
    for (const office of offices) {
      const regionId = toRegionId(office.regionId);
      if (!regionNamesById.has(regionId)) {
        regionNamesById.set(regionId, office.regionName);
      }
    }

    const state = await readRegionState(context);

    return [...regionNamesById.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([regionId, regionName]) => ({
        regionId,
        regionName,
        source: state.region[regionId]?.source ? ('DXTR' as const) : ('ACMS' as const),
      }));
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}
