import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { getCamsError } from '../../common-errors/error-utilities';
import { isNotFoundError, NotFoundError } from '../../common-errors/not-found-error';
import { toRegionId, TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { RegionCaseAppointmentSource } from '@common/cams/trustee-appointments';
import { Auditable, createAuditRecord } from '@common/cams/auditable';
import { getCamsUserReference } from '@common/cams/session';

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

/** CAMS office data's regions, deduped by zero-padded region id, keeping the first region name. */
async function getRegionNamesById(context: ApplicationContext): Promise<Map<string, string>> {
  const officesGateway = factory.getOfficesGateway(context);
  const offices = await officesGateway.getOffices(context);

  const regionNamesById = new Map<string, string>();
  for (const office of offices) {
    const regionId = toRegionId(office.regionId);
    if (!regionNamesById.has(regionId)) {
      regionNamesById.set(regionId, office.regionName);
    }
  }
  return regionNamesById;
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
    const regionNamesById = await getRegionNamesById(context);
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

/**
 * A CAMS SuperUser's one-way switch of a region's trustee-appointment source to DXTR (CAMS-957
 * Slice 1). A region already on DXTR is a no-op -- its stored source record, the audit trail of
 * the original switch, is never overwritten. This only stores the switch; the region driver
 * (trustee-appointment-region-driver.ts) reads region.<id>.source to pick the source.
 */
export async function switchCaseAppointmentSourceToDxtr(
  context: ApplicationContext,
  regionId: string,
): Promise<RegionCaseAppointmentSource> {
  try {
    const regionNamesById = await getRegionNamesById(context);
    const regionName = regionNamesById.get(regionId);
    if (!regionName) {
      throw new NotFoundError(MODULE_NAME, { message: `Region ${regionId} not found.` });
    }

    const state = await readRegionState(context);
    if (!state.region[regionId]?.source) {
      const audited = createAuditRecord<Auditable & { system: 'DXTR' }>(
        { system: 'DXTR' },
        getCamsUserReference(context.session.user),
      );
      const repo = factory.getRuntimeStateRepository<TrusteeAppointmentRegionSyncState>(context);
      await repo.setField(REGION_STATE_DOCUMENT_TYPE, `region.${regionId}.source`, {
        system: audited.system,
        updatedOn: audited.updatedOn,
        updatedBy: audited.updatedBy,
      });
      context.logger.info(
        MODULE_NAME,
        `Switched region ${regionId} to DXTR for user ${context.session.user.id}.`,
      );
    }

    return { regionId, regionName, source: 'DXTR' };
  } catch (originalError) {
    throw getCamsError(originalError, MODULE_NAME);
  }
}
