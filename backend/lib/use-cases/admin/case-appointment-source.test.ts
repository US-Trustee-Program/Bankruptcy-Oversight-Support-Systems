import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { UstpOfficeDetails } from '@common/cams/offices';
import { TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';
import { getCaseAppointmentSources } from './case-appointment-source';

function makeOffice(regionId: string, regionName = `Region ${regionId}`): UstpOfficeDetails {
  return {
    officeCode: `OFFICE-${regionId}`,
    officeName: `Office ${regionId}`,
    idpGroupName: `Office ${regionId}`,
    regionId,
    regionName,
    groups: [],
  };
}

function stateWith(
  region: TrusteeAppointmentRegionSyncState['region'],
): TrusteeAppointmentRegionSyncState {
  return { documentType: 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE', region };
}

describe('getCaseAppointmentSources', () => {
  let context: ApplicationContext;
  let mockRegionStateRepo: { read: ReturnType<typeof vi.fn> };

  function mockOffices(offices: UstpOfficeDetails[]) {
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue(offices),
    } as unknown as ReturnType<typeof factory.getOfficesGateway>);
  }

  function mockRegionState(state: TrusteeAppointmentRegionSyncState) {
    mockRegionStateRepo.read.mockResolvedValue(state);
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockRegionStateRepo = { read: vi.fn().mockResolvedValue(stateWith({})) };
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
      mockRegionStateRepo as unknown as ReturnType<typeof factory.getRuntimeStateRepository>,
    );
  });

  test('defaults a region with no source set in runtime-state to ACMS', async () => {
    mockOffices([makeOffice('02')]);
    mockRegionState(stateWith({}));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '02', regionName: 'Region 02', source: 'ACMS' }]);
  });

  test('reports DXTR for a region with a source set in runtime-state', async () => {
    mockOffices([makeOffice('03')]);
    mockRegionState(
      stateWith({
        '03': {
          source: {
            system: 'DXTR',
            updatedOn: '2026-07-01T00:00:00Z',
            updatedBy: { id: 'u', name: 'U' },
          },
        },
      }),
    );

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '03', regionName: 'Region 03', source: 'DXTR' }]);
  });

  test('dedupes offices into distinct regions, sorted by region id', async () => {
    mockOffices([makeOffice('03'), makeOffice('02'), makeOffice('02')]);
    mockRegionState(stateWith({}));

    const sources = await getCaseAppointmentSources(context);

    expect(sources.map((s) => s.regionId)).toEqual(['02', '03']);
  });

  // UstpOfficeDetails.regionId comes back un-padded from the DXTR offices gateway, but the
  // runtime-state document keys regions zero-padded (region.02.source) -- getCaseAppointmentSources
  // must re-pad it to look up the right key.
  test('zero-pads an un-padded region id from the offices gateway to match runtime-state keys', async () => {
    mockOffices([makeOffice('2', 'Region 2')]);
    mockRegionState(
      stateWith({
        '02': {
          source: {
            system: 'DXTR',
            updatedOn: '2026-07-01T00:00:00Z',
            updatedBy: { id: 'u', name: 'U' },
          },
        },
      }),
    );

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '02', regionName: 'Region 2', source: 'DXTR' }]);
  });

  test('returns an empty list when CAMS office data has no offices', async () => {
    mockOffices([]);
    mockRegionState(stateWith({}));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([]);
  });

  test('treats a never-written runtime-state document as every region defaulting to ACMS', async () => {
    mockOffices([makeOffice('02')]);
    mockRegionStateRepo.read.mockRejectedValue(new NotFoundError('TEST'));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '02', regionName: 'Region 02', source: 'ACMS' }]);
  });

  test('propagates a getOffices failure rather than swallowing it', async () => {
    const gatewayError = new Error('DXTR connection failed');
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockRejectedValue(gatewayError),
    } as unknown as ReturnType<typeof factory.getOfficesGateway>);

    await expect(getCaseAppointmentSources(context)).rejects.toThrow();
  });

  test('propagates a non-NotFound runtime-state read failure', async () => {
    mockOffices([makeOffice('02')]);
    mockRegionStateRepo.read.mockRejectedValue(new Error('Cosmos throttled'));

    await expect(getCaseAppointmentSources(context)).rejects.toThrow();
  });
});
