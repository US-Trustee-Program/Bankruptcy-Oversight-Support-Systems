import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import RegionDriver, { CUTOVER_DATE } from './trustee-appointment-region-driver';
import SyncTrusteeCaseAppointments from './sync-trustee-case-appointments';
import { AcmsCaseAppointmentRawRecord, TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';

function makeEvent(caseId: string): TrusteeAppointmentSyncEvent {
  return {
    caseId,
    courtId: '0208',
    source: 'ACMS',
    sourceTrustee: { fullName: 'Jane Doe' },
    appointedDate: '2026-07-01',
  };
}

/** One raw CMMAP row for a given id/changeDate, with harmless defaults for every other field. */
function makeRawRow(id: number, changeDate: string, regionId = '02'): AcmsCaseAppointmentRawRecord {
  return {
    id,
    CASE_DIV: 81,
    CASE_YEAR: 26,
    CASE_NUMBER: id,
    GROUP_DESIGNATOR: 'NY',
    PROF_CODE: 63,
    APPT_DATE: 20260701,
    DISP_DATE: null,
    CASE_FILED_DATE: null,
    CURR_CASE_CHAPT: '7',
    CLOSED_BY_COURT_DATE: null,
    CLOSED_BY_UST_DATE: null,
    REOPENED_DATE: null,
    REGION_CODE: regionId,
    CDB_UPDATE_DATE: Number(changeDate.replace(/-/g, '')),
    PROF_FIRST_NAME: 'Jane',
    PROF_LAST_NAME: 'Doe',
    PROF_MI: '',
    PROF_ADDRESS1: '',
    PROF_ADDRESS2: '',
    PROF_CITY: '',
    PROF_STATE: '',
    PROF_ZIP: 0,
    PROF_COMMERCIAL_PHONE_NBR: 0,
  };
}

describe('RegionDriver.runRegionDriver', () => {
  let context: ApplicationContext;
  let mockRegionStateRepo: {
    read: ReturnType<typeof vi.fn>;
    setField: ReturnType<typeof vi.fn>;
  };
  let getLatestCmmapChangeDateForRegion: ReturnType<typeof vi.fn>;
  let getCmmapAppointmentsRaw: ReturnType<typeof vi.fn>;
  let processAppointmentsSpy: ReturnType<typeof vi.spyOn>;

  function stateWith(
    region: TrusteeAppointmentRegionSyncState['region'],
  ): TrusteeAppointmentRegionSyncState {
    return { documentType: 'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE', region };
  }

  /**
   * Cursor-respecting fixture: `rowsByDate` maps changeDate -> the single row on that date (if
   * any). Returns that row only on the FIRST call for that date (lastId 0/undefined); any later
   * call with lastId >= the row's own id returns empty, exactly like the real `m.id > @lastId`
   * cursor -- a mock that ignored lastId would loop forever, since AcmsTrusteeAppointmentSource
   * only stops paging a date once a call comes back empty.
   */
  function respectingCursor(rowsByDate: Record<string, AcmsCaseAppointmentRawRecord>) {
    return async (
      _context: unknown,
      lastId: number,
      _pageSize: number,
      _cutoffDate: unknown,
      _regionId: string,
      changeDate: string,
    ) => {
      const row = rowsByDate[changeDate];
      if (row && lastId < row.id) {
        return [row];
      }
      return [];
    };
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockRegionStateRepo = {
      read: vi.fn().mockResolvedValue(stateWith({})),
      setField: vi.fn().mockResolvedValue(undefined),
    };
    vi.spyOn(factory, 'getRuntimeStateRepository').mockReturnValue(
      mockRegionStateRepo as unknown as ReturnType<typeof factory.getRuntimeStateRepository>,
    );

    getLatestCmmapChangeDateForRegion = vi.fn().mockResolvedValue(undefined);
    getCmmapAppointmentsRaw = vi.fn().mockResolvedValue([]);
    vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
      getLatestCmmapChangeDateForRegion,
      getCmmapAppointmentsRaw,
    } as unknown as ReturnType<typeof factory.getAcmsGateway>);
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue([
        {
          officeCode: 'USTP_CAMS_Region_02',
          officeName: 'Region 2',
          idpGroupName: 'USTP CAMS Region 2',
          regionId: '02',
          regionName: 'Region 2',
          groups: [
            {
              groupDesignator: 'NY',
              divisions: [
                {
                  divisionCode: '081',
                  court: { courtId: '0208', courtName: 'SDNY' },
                  courtOffice: { courtOfficeCode: 'MAH', courtOfficeName: 'Manhattan' },
                },
              ],
            },
          ],
        },
      ]),
    } as unknown as ReturnType<typeof factory.getOfficesGateway>);

    processAppointmentsSpy = vi
      .spyOn(SyncTrusteeCaseAppointments, 'processAppointments')
      .mockResolvedValue({
        successCount: 0,
        dlqMessages: [],
        scenarioDistribution: {} as never,
        notYetSyncedEvents: [],
        retryableEvents: [],
      });
  });

  test('a region with no data at all is skipped with no bookmark write', async () => {
    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(result.processedRegions).toEqual(['02']);
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
    expect(processAppointmentsSpy).not.toHaveBeenCalled();
  });

  test("a region's first run catches up from the cutover date, withholding the newest date", async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({
        '2026-07-01': makeRawRow(1, '2026-07-01'),
        '2026-07-02': makeRawRow(2, '2026-07-02'),
        '2026-07-03': makeRawRow(3, '2026-07-03'),
      }),
    );

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(result.processedRegions).toEqual(['02']);
    expect(processAppointmentsSpy).toHaveBeenCalledTimes(3);
    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-01',
    );
    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-02',
    );
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-03',
    );
  });

  test('the run date is never read, and the bookmark advances only through non-empty, non-final dates', async () => {
    mockRegionStateRepo.read.mockResolvedValue(stateWith({ '02': { lastSyncDate: '2026-07-01' } }));
    // Data exists on 07-02 and on the run date itself (07-05); 07-03/07-04 are empty.
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-05');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({ '2026-07-02': makeRawRow(1, '2026-07-02') }),
    );

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(result.processedRegions).toEqual(['02']);
    // Only ever asked for dates strictly before the run date.
    for (const call of getCmmapAppointmentsRaw.mock.calls) {
      expect(call[5]).not.toBe('2026-07-05');
    }
    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-02',
    );
    expect(mockRegionStateRepo.setField).toHaveBeenCalledTimes(1);
  });

  test('only the named regions are processed; others are left untouched', async () => {
    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(result.processedRegions).toEqual(['02']);
    expect(getLatestCmmapChangeDateForRegion).toHaveBeenCalledTimes(1);
    expect(getLatestCmmapChangeDateForRegion).toHaveBeenCalledWith(context, '02');
  });

  test("each region's bookmark advances independently, without cross-contamination", async () => {
    getLatestCmmapChangeDateForRegion.mockImplementation(async (_context, regionId: string) =>
      regionId === '02' ? '2026-07-03' : '2026-07-04',
    );
    const region02 = respectingCursor({ '2026-07-01': makeRawRow(1, '2026-07-01', '02') });
    const region03 = respectingCursor({ '2026-07-02': makeRawRow(1, '2026-07-02', '03') });
    getCmmapAppointmentsRaw.mockImplementation(async (...args) => {
      const regionId = args[4] as string;
      return regionId === '02'
        ? region02(...(args as Parameters<typeof region02>))
        : region03(...(args as Parameters<typeof region03>));
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
    });

    expect(result.processedRegions).toEqual(['02', '03']);
    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-01',
    );
    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.03.lastSyncDate',
      '2026-07-02',
    );
  });

  test('defaults to the cutover date when no bookmark has ever been written', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue(CUTOVER_DATE);
    getCmmapAppointmentsRaw.mockResolvedValue([]);

    await RegionDriver.runRegionDriver(context, { regions: ['02'], runDate: '2026-07-05' });

    expect(getCmmapAppointmentsRaw).toHaveBeenCalledWith(
      context,
      0,
      expect.any(Number),
      null,
      '02',
      CUTOVER_DATE,
    );
  });

  test('falls back to the cutover date when reading region state fails (no prior document)', async () => {
    mockRegionStateRepo.read.mockRejectedValue(new Error('not found'));
    getLatestCmmapChangeDateForRegion.mockResolvedValue(CUTOVER_DATE);

    await RegionDriver.runRegionDriver(context, { regions: ['02'], runDate: '2026-07-05' });

    expect(getCmmapAppointmentsRaw).toHaveBeenCalledWith(
      context,
      0,
      expect.any(Number),
      null,
      '02',
      CUTOVER_DATE,
    );
  });

  test('escapes mid-date when the invocation budget is exhausted, returning a continuation', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockResolvedValue([]);

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
      startedAt: Date.now() - 1_000_000,
      safeThresholdMs: 1,
    });

    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: CUTOVER_DATE, lastId: undefined },
    });
    expect(result.processedRegions).toEqual([]);
    expect(getCmmapAppointmentsRaw).not.toHaveBeenCalled();
  });

  test('resumes exactly at the given date and cursor instead of recomputing from the bookmark', async () => {
    mockRegionStateRepo.read.mockResolvedValue(stateWith({ '02': { lastSyncDate: '2026-07-01' } }));
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-02');
    getCmmapAppointmentsRaw.mockResolvedValue([]);

    await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: '2026-07-02', lastId: '1001' },
    });

    // Resumes at the given date/lastId -- NOT bookmark+1 (which would also be 07-02 here
    // coincidentally, so the cursor is the real proof: lastId 1001 is passed through).
    expect(getCmmapAppointmentsRaw).toHaveBeenCalledWith(
      context,
      1001,
      expect.any(Number),
      null,
      '02',
      '2026-07-02',
    );
  });

  test('propagates dlqMessages, retryableEvents and notYetSyncedEvents from processAppointments', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-01');
    const event = makeEvent('081-26-00001');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({ '2026-07-01': makeRawRow(1, '2026-07-01') }),
    );
    processAppointmentsSpy.mockResolvedValue({
      successCount: 0,
      dlqMessages: [event],
      scenarioDistribution: {} as never,
      notYetSyncedEvents: [event],
      retryableEvents: [event],
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(result.dlqMessages).toEqual([event]);
    expect(result.retryableEvents).toEqual([event]);
    expect(result.notYetSyncedEvents).toEqual([event]);
  });
});
