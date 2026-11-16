import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { UstpOfficeDetails } from '@common/cams/offices';
import { TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { NotFoundError } from '../../common-errors/not-found-error';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { getCaseAppointmentSources } from './case-appointment-source';

const REGION_STATE_DOCUMENT_TYPE = 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE';

const DXTR_SOURCE = {
  system: 'DXTR' as const,
  updatedOn: '2026-07-01T00:00:00Z',
  updatedBy: { id: 'u', name: 'U' },
};

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
  return { documentType: REGION_STATE_DOCUMENT_TYPE, region };
}

function mockOffices(offices: UstpOfficeDetails[]) {
  vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue(offices);
}

/** Answers only for the region sync-state document; any other document type is not found. */
function mockRegionState(state: TrusteeAppointmentRegionSyncState) {
  vi.spyOn(MockMongoRepository.prototype, 'read').mockImplementation(async (documentType) => {
    if (documentType === REGION_STATE_DOCUMENT_TYPE) {
      return state;
    }
    throw new NotFoundError('TEST');
  });
}

describe('getCaseAppointmentSources', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    mockRegionState(stateWith({}));
  });

  test.each([
    { description: 'has no runtime-state entry', region: {} },
    {
      description: 'has a sync bookmark but no source',
      region: { '02': { lastSyncDate: '2026-07-01' } },
    },
  ])('defaults a region that $description to ACMS', async ({ region }) => {
    mockOffices([makeOffice('02')]);
    mockRegionState(stateWith(region));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '02', regionName: 'Region 02', source: 'ACMS' }]);
  });

  test('reports DXTR for a region with a source set in runtime-state', async () => {
    mockOffices([makeOffice('03')]);
    mockRegionState(stateWith({ '03': { lastSyncDate: '2026-07-01', source: DXTR_SOURCE } }));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '03', regionName: 'Region 03', source: 'DXTR' }]);
  });

  test('dedupes offices into distinct regions, sorted by region id, keeping the first region name', async () => {
    mockOffices([
      makeOffice('03'),
      makeOffice('2', 'NEW YORK'),
      makeOffice('02', 'NEW YORK (second office)'),
    ]);

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([
      { regionId: '02', regionName: 'NEW YORK', source: 'ACMS' },
      { regionId: '03', regionName: 'Region 03', source: 'ACMS' },
    ]);
  });

  // UstpOfficeDetails.regionId comes back un-padded from the DXTR offices gateway, but the
  // runtime-state document keys regions zero-padded (region.02.source) -- getCaseAppointmentSources
  // must re-pad it to look up the right key.
  test('zero-pads an un-padded region id from the offices gateway to match runtime-state keys', async () => {
    mockOffices([makeOffice('2', 'Region 2')]);
    mockRegionState(stateWith({ '02': { source: DXTR_SOURCE } }));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '02', regionName: 'Region 2', source: 'DXTR' }]);
  });

  test('returns an empty list when CAMS office data has no offices', async () => {
    mockOffices([]);

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([]);
  });

  test('treats a never-written runtime-state document as every region defaulting to ACMS', async () => {
    mockOffices([makeOffice('02')]);
    vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(new NotFoundError('TEST'));

    const sources = await getCaseAppointmentSources(context);

    expect(sources).toEqual([{ regionId: '02', regionName: 'Region 02', source: 'ACMS' }]);
  });

  test.each([
    {
      description: 'a getOffices failure',
      arrange: () =>
        vi
          .spyOn(MockOfficesGateway.prototype, 'getOffices')
          .mockRejectedValue(new Error('DXTR connection failed')),
      message: 'DXTR connection failed',
    },
    {
      description: 'a non-NotFound runtime-state read failure',
      arrange: () => {
        mockOffices([makeOffice('02')]);
        vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
          new Error('Cosmos throttled'),
        );
      },
      message: 'Cosmos throttled',
    },
  ])('wraps $description in a CamsError for this module', async ({ arrange, message }) => {
    arrange();

    await expect(getCaseAppointmentSources(context)).rejects.toEqual(
      expect.objectContaining({
        isCamsError: true,
        module: 'CASE-APPOINTMENT-SOURCE-USE-CASE',
        originalError: expect.stringContaining(message),
      }),
    );
  });
});
