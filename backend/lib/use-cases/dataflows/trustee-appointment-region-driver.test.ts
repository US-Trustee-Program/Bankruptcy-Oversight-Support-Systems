import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { UstpOfficeDetails } from '@common/cams/offices';
import RegionDriver, { CUTOVER_DATE, PAGE_STEP_COST_MS } from './trustee-appointment-region-driver';
import SyncTrusteeCaseAppointments from './sync-trustee-case-appointments';
import { AcmsCaseAppointmentRawRecord, TrusteeAppointmentRegionSyncState } from '../gateways.types';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';

type ScenarioDistribution = Awaited<
  ReturnType<typeof SyncTrusteeCaseAppointments.processAppointments>
>['scenarioDistribution'];

/** A fully typed scenario distribution with every counter zero except parkedCount. */
function scenarioWith(parkedCount = 0): ScenarioDistribution {
  return {
    autoMatchCount: 0,
    autoMatchUncoveredCount: 0,
    noMatchCount: 0,
    multipleMatchCount: 0,
    reVerificationCount: 0,
    verificationBucketHitCount: 0,
    fingerprintHitCount: 0,
    fingerprintMissCount: 0,
    retryableCount: 0,
    pipelineSkippedCount: 0,
    unappointableChapterSkippedCount: 0,
    emptyDemographicsSkippedCount: 0,
    sentinelBogusNameSkippedCount: 0,
    unattributableBogusNameSkippedCount: 0,
    parkedCount,
  };
}

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
    CASE_FILED_DATE: 20260601,
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
        scenarioDistribution: scenarioWith(),
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

  test('the run date is never read, and the bookmark advances through every date before the newest one', async () => {
    mockRegionStateRepo.read.mockResolvedValue(stateWith({ '02': { lastSyncDate: '2026-07-01' } }));
    // The replica's newest date is the run date (07-05), which is never read; 07-02 has data and 07-03/07-04 are empty.
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
    // 07-02 (data) and 07-03 (empty) are complete; 07-04 is the newest walked date and stays unbookmarked.
    expect(mockRegionStateRepo.setField).toHaveBeenCalledTimes(2);
    expect(mockRegionStateRepo.setField).toHaveBeenLastCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-03',
    );
  });

  test('a dormant span of empty dates is bookmarked through, stopping before the newest date', async () => {
    mockRegionStateRepo.read.mockResolvedValue(stateWith({ '02': { lastSyncDate: '2026-07-01' } }));
    // Nothing between 07-02 and 07-07; 07-08 is the newest known date and must stay unbookmarked.
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-08');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({ '2026-07-08': makeRawRow(2, '2026-07-08') }),
    );

    await RegionDriver.runRegionDriver(context, { regions: ['02'], runDate: '2026-07-10' });

    // One bookmark write per empty day, 07-02 through 07-07.
    expect(mockRegionStateRepo.setField).toHaveBeenCalledTimes(6);
    expect(mockRegionStateRepo.setField).toHaveBeenLastCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-07',
    );
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-08',
    );
  });

  test('a second invocation after a dormant span reads only the newest date, not the empty days', async () => {
    mockRegionStateRepo.read.mockResolvedValue(stateWith({ '02': { lastSyncDate: '2026-07-01' } }));
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-08');
    const options = { regions: ['02'], runDate: '2026-07-10' };

    await RegionDriver.runRegionDriver(context, options);
    const bookmarkAfterFirstRun = mockRegionStateRepo.setField.mock.lastCall?.[2];
    expect(bookmarkAfterFirstRun).toBe('2026-07-07');
    mockRegionStateRepo.read.mockResolvedValue(
      stateWith({ '02': { lastSyncDate: bookmarkAfterFirstRun } }),
    );
    getCmmapAppointmentsRaw.mockClear();

    await RegionDriver.runRegionDriver(context, options);

    const datesRead = new Set(getCmmapAppointmentsRaw.mock.calls.map((call) => call[5]));
    expect(datesRead).toEqual(new Set(['2026-07-08']));
  });

  test('only the named regions are processed; others are left untouched', async () => {
    // Region '03' has data and its own bookmark in state, but is never named in the request --
    // if the driver leaked state across regions, these would show it was touched anyway.
    mockRegionStateRepo.read.mockResolvedValue(stateWith({ '03': { lastSyncDate: '2026-07-01' } }));
    getLatestCmmapChangeDateForRegion.mockImplementation(async (_context, regionId: string) =>
      regionId === '02' ? '2026-07-03' : '2026-07-10',
    );
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({ '2026-07-09': makeRawRow(1, '2026-07-09', '03') }),
    );

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(result.processedRegions).toEqual(['02']);
    expect(getLatestCmmapChangeDateForRegion).toHaveBeenCalledTimes(1);
    expect(getLatestCmmapChangeDateForRegion).toHaveBeenCalledWith(context, '02');
    expect(getCmmapAppointmentsRaw).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      '03',
      expect.anything(),
    );
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.03.lastSyncDate',
      expect.anything(),
    );
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

  test('falls back to the cutover date when the region state document does not exist yet', async () => {
    mockRegionStateRepo.read.mockRejectedValue(new NotFoundError('TEST'));
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

  test('a read failure other than not-found propagates, and never walks from the cutover date', async () => {
    const readError = new Error('connection reset');
    mockRegionStateRepo.read.mockRejectedValue(readError);
    getLatestCmmapChangeDateForRegion.mockResolvedValue(CUTOVER_DATE);

    await expect(
      RegionDriver.runRegionDriver(context, { regions: ['02'], runDate: '2026-07-05' }),
    ).rejects.toBe(readError);
    expect(getCmmapAppointmentsRaw).not.toHaveBeenCalled();
  });

  test('escapes before reading a date when the invocation budget is exhausted, returning a continuation', async () => {
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
      cause: 'invocation-budget',
    });
    expect(result.processedRegions).toEqual([]);
    expect(getCmmapAppointmentsRaw).not.toHaveBeenCalled();
  });

  test('does not start a page that could run past the invocation budget, even with time left', async () => {
    const fiveMinutesMs = 5 * 60 * 1000;
    const budgetMs = 56 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(budgetMs - fiveMinutesMs);
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
      startedAt: 0,
      safeThresholdMs: budgetMs,
    });

    expect(result.continuation?.cause).toEqual('invocation-budget');
    expect(getCmmapAppointmentsRaw).not.toHaveBeenCalled();
  });

  test('a later region that exhausts the budget continues with only the regions not yet finished', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-02');
    const region02 = respectingCursor({ '2026-07-01': makeRawRow(1, '2026-07-01') });
    getCmmapAppointmentsRaw.mockImplementation(async (...args) => {
      const rows = await region02(...(args as Parameters<typeof region02>));
      // Region '02''s last read (its newest date, 07-02, comes back empty) finishes it within
      // budget; the budget is spent by the time region '03' starts.
      if (args[5] === '2026-07-02') now = 5_000;
      return rows;
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
      safeThresholdMs: PAGE_STEP_COST_MS + 1_000,
    });

    expect(result.processedRegions).toEqual(['02']);
    expect(result.continuation).toEqual({
      regions: ['03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '03', date: CUTOVER_DATE, lastId: undefined },
      cause: 'invocation-budget',
    });
    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-01',
    );
  });

  test('exhausting the budget after a page continues from that page cursor, not the start of the date', async () => {
    let now = 0;
    vi.spyOn(Date, 'now').mockImplementation(() => now);
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    // Only the first page has a row (later calls get the beforeEach default, []), so a broken
    // budget check fails an assertion instead of paging forever.
    getCmmapAppointmentsRaw.mockImplementationOnce(async () => {
      now = 5_000;
      return [makeRawRow(1001, '2026-07-01')];
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
      safeThresholdMs: PAGE_STEP_COST_MS + 1_000,
    });

    expect(processAppointmentsSpy).toHaveBeenCalledTimes(1);
    expect(result.processedRegions).toEqual([]);
    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: CUTOVER_DATE, lastId: '1001' },
      cause: 'invocation-budget',
    });
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
  });

  // cams-fd8qd.33: a bookmarked date is never re-read, so its results must reach their queues
  // before the bookmark moves past it -- not only at the end of the invocation.
  test("hands each finished date's results to onDateComplete before advancing its bookmark", async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({
        '2026-07-01': makeRawRow(1, '2026-07-01'),
        '2026-07-02': makeRawRow(2, '2026-07-02'),
      }),
    );
    const dlqForDay1 = makeEvent('081-26-00001');
    const retryForDay2 = makeEvent('081-26-00002');
    processAppointmentsSpy
      .mockResolvedValueOnce({
        successCount: 0,
        dlqMessages: [dlqForDay1],
        scenarioDistribution: scenarioWith(),
        retryableEvents: [],
      })
      .mockResolvedValueOnce({
        successCount: 0,
        dlqMessages: [],
        scenarioDistribution: scenarioWith(),
        retryableEvents: [retryForDay2],
      });
    const order: unknown[] = [];
    const onDateComplete = vi.fn(async (results) => {
      order.push({ results });
    });
    mockRegionStateRepo.setField.mockImplementation(async (_type, _path, date) => {
      order.push({ bookmark: date });
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
      onDateComplete,
    });

    expect(order).toEqual([
      { results: { dlqMessages: [dlqForDay1], retryableEvents: [] } },
      { bookmark: '2026-07-01' },
      { results: { dlqMessages: [], retryableEvents: [retryForDay2] } },
      { bookmark: '2026-07-02' },
      { results: { dlqMessages: [], retryableEvents: [] } },
    ]);
    // Already handed off, so not returned a second time.
    expect(result.dlqMessages).toEqual([]);
    expect(result.retryableEvents).toEqual([]);
  });

  test('a transient failure handing off results leaves the bookmark and resumes the whole date', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({ '2026-07-01': makeRawRow(1001, '2026-07-01') }),
    );
    processAppointmentsSpy.mockResolvedValueOnce({
      successCount: 0,
      dlqMessages: [makeEvent('081-26-00001')],
      scenarioDistribution: scenarioWith(),
      retryableEvents: [makeEvent('081-26-00002')],
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
      onDateComplete: vi.fn().mockRejectedValue(new TooManyRequestsError('TEST')),
    });

    expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: CUTOVER_DATE, lastId: undefined },
      cause: 'transient-error',
    });
    // The date is re-read from its start, which regenerates its results -- returning these too
    // would send them twice.
    expect(result.dlqMessages).toEqual([]);
    expect(result.retryableEvents).toEqual([]);
  });

  // A part-read date is resumed from its page cursor, so its pages already read are never read
  // again: their results come back on the result, not through onDateComplete.
  test("a stop part-way through a date returns that date's results, while finished dates were handed off", async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockImplementation(
      async (_context, lastId: number, _size, _cutoff, _region, changeDate: string) => {
        if (changeDate === '2026-07-01' && lastId === 0) return [makeRawRow(1, '2026-07-01')];
        if (changeDate === '2026-07-02' && lastId === 0) return [makeRawRow(2, '2026-07-02')];
        if (changeDate === '2026-07-02') throw new Error('Timeout: query exceeded limit');
        return [];
      },
    );
    const finishedDlq = makeEvent('081-26-00001');
    const partialDlq = makeEvent('081-26-00002');
    processAppointmentsSpy
      .mockResolvedValueOnce({
        successCount: 0,
        dlqMessages: [finishedDlq],
        scenarioDistribution: scenarioWith(),
        retryableEvents: [],
      })
      .mockResolvedValueOnce({
        successCount: 0,
        dlqMessages: [partialDlq],
        scenarioDistribution: scenarioWith(),
        retryableEvents: [],
      });
    const onDateComplete = vi.fn().mockResolvedValue(undefined);

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
      onDateComplete,
    });

    expect(onDateComplete.mock.calls).toEqual([
      [{ dlqMessages: [finishedDlq], retryableEvents: [] }],
    ]);
    expect(result.dlqMessages).toEqual([partialDlq]);
    expect(result.continuation).toEqual({
      regions: ['02'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: '2026-07-02', lastId: '2' },
      cause: 'transient-error',
    });
  });

  test('a timeout on a later page stops with a timeout continuation at that cursor and keeps earlier results', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    const earlierDlq = makeEvent('081-26-00009');
    processAppointmentsSpy.mockResolvedValueOnce({
      successCount: 0,
      dlqMessages: [earlierDlq],
      scenarioDistribution: scenarioWith(),
      retryableEvents: [],
    });
    getCmmapAppointmentsRaw.mockImplementation(async (_context, lastId: number) => {
      if (lastId === 0) return [makeRawRow(1001, '2026-07-01')];
      throw new Error('Timeout: query exceeded limit');
    });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
    });

    expect(result.dlqMessages).toEqual([earlierDlq]);
    expect(result.processedRegions).toEqual([]);
    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: CUTOVER_DATE, lastId: '1001' },
      cause: 'transient-error',
    });
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
  });

  test('a 429 on the bookmark write stops at the next date, keeping the results of the date just completed', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({ '2026-07-01': makeRawRow(1001, '2026-07-01') }),
    );
    const completedDlq = makeEvent('081-26-00008');
    processAppointmentsSpy.mockResolvedValueOnce({
      successCount: 0,
      dlqMessages: [completedDlq],
      scenarioDistribution: scenarioWith(1),
      retryableEvents: [],
    });
    mockRegionStateRepo.setField.mockRejectedValueOnce(new TooManyRequestsError('TEST'));

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
    });

    expect(result.dlqMessages).toEqual([completedDlq]);
    expect(result.parkedCount).toBe(1);
    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom: { regionId: '02', date: '2026-07-02', lastId: undefined },
      cause: 'transient-error',
    });
  });

  test('a 429 on the region-state read stops before any region with the original resume point', async () => {
    mockRegionStateRepo.read.mockRejectedValue(new TooManyRequestsError('TEST'));
    const resumeFrom = { regionId: '03', date: '2026-07-02', lastId: '1001' };

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom,
    });

    expect(getLatestCmmapChangeDateForRegion).not.toHaveBeenCalled();
    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      resumeFrom,
      cause: 'transient-error',
    });
  });

  test('a timeout on the latest-date read stops at that region with no resume point, leaving its bookmark untouched', async () => {
    getLatestCmmapChangeDateForRegion.mockRejectedValue(new Error('Timeout: query exceeded limit'));

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02', '03'],
      runDate: '2026-07-05',
    });

    expect(result.continuation).toEqual({
      regions: ['02', '03'],
      runDate: '2026-07-05',
      cause: 'transient-error',
    });
    expect(getCmmapAppointmentsRaw).not.toHaveBeenCalled();
    expect(mockRegionStateRepo.setField).not.toHaveBeenCalled();
  });

  test('a non-timeout ACMS error propagates without a continuation', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-01');
    getCmmapAppointmentsRaw.mockRejectedValue(new Error('Connection refused by host'));

    await expect(
      RegionDriver.runRegionDriver(context, { regions: ['02'], runDate: '2026-07-05' }),
    ).rejects.toThrow('Connection refused by host');
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

  test('accumulates dlqMessages, retryableEvents and parkedCount across dates', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-02');
    const firstEvent = makeEvent('081-26-00001');
    const secondEvent = makeEvent('081-26-00002');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({
        '2026-07-01': makeRawRow(1, '2026-07-01'),
        '2026-07-02': makeRawRow(2, '2026-07-02'),
      }),
    );
    processAppointmentsSpy
      .mockResolvedValueOnce({
        successCount: 0,
        dlqMessages: [firstEvent],
        scenarioDistribution: scenarioWith(2),
        retryableEvents: [firstEvent],
      })
      .mockResolvedValueOnce({
        successCount: 0,
        dlqMessages: [secondEvent],
        scenarioDistribution: scenarioWith(3),
        retryableEvents: [secondEvent],
      });

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(processAppointmentsSpy).toHaveBeenCalledTimes(2);
    expect(result.dlqMessages).toEqual([firstEvent, secondEvent]);
    expect(result.retryableEvents).toEqual([firstEvent, secondEvent]);
    expect(result.parkedCount).toBe(5);
  });

  test('routes a row that cannot be converted to a DLQ entry naming the row, while its sibling still processes', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-01');
    const badRow = { ...makeRawRow(1, '2026-07-01'), CASE_DIV: 999 };
    const goodRow = makeRawRow(2, '2026-07-01');
    getCmmapAppointmentsRaw.mockImplementation(async (_context, lastId: number) =>
      lastId === 0 ? [badRow, goodRow] : [],
    );

    const result = await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(processAppointmentsSpy).toHaveBeenCalledWith(expect.anything(), [
      expect.objectContaining({ caseId: '081-26-00002' }),
    ]);
    expect(result.dlqMessages).toEqual([
      expect.objectContaining({
        type: 'QUEUE_ERROR',
        module: RegionDriver.MODULE_NAME,
        error: expect.objectContaining({
          message: expect.stringContaining(
            '(case 999-26-00001, region 02, change date 2026-07-01)',
          ),
        }),
      }),
    ]);
  });

  test('a date whose only row failed still advances the bookmark past it', async () => {
    getLatestCmmapChangeDateForRegion.mockResolvedValue('2026-07-03');
    getCmmapAppointmentsRaw.mockImplementation(
      respectingCursor({
        '2026-07-01': { ...makeRawRow(1, '2026-07-01'), CASE_DIV: 999 },
        '2026-07-02': makeRawRow(2, '2026-07-02'),
      }),
    );

    await RegionDriver.runRegionDriver(context, {
      regions: ['02'],
      runDate: '2026-07-05',
    });

    expect(mockRegionStateRepo.setField).toHaveBeenCalledWith(
      'TRUSTEE_APPOINTMENT_REGION_SYNC_STATE',
      'region.02.lastSyncDate',
      '2026-07-01',
    );
  });
});

describe('RegionDriver.getAllRegionIds', () => {
  let context: ApplicationContext;

  function makeOffice(regionId: string): UstpOfficeDetails {
    return {
      officeCode: `OFFICE-${regionId}`,
      officeName: `Office ${regionId}`,
      idpGroupName: `Office ${regionId}`,
      regionId,
      regionName: `Region ${regionId}`,
      groups: [],
    };
  }

  function mockOffices(offices: UstpOfficeDetails[]) {
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockResolvedValue(offices),
    } as unknown as ReturnType<typeof factory.getOfficesGateway>);
  }

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('dedupes offices into distinct region ids', async () => {
    mockOffices([makeOffice('02'), makeOffice('02'), makeOffice('03')]);

    const regionIds = await RegionDriver.getAllRegionIds(context);

    expect([...regionIds].sort()).toEqual(['02', '03']);
  });

  // UstpOfficeDetails.regionId comes back un-padded from the DXTR offices gateway
  // (parseInt(flatOffice.regionId).toString() turns "02" into "2") -- getAllRegionIds must
  // re-pad it so it matches the zero-padded bookmark keys (region.02.lastSyncDate) the rest
  // of this driver reads and writes.
  test('zero-pads an un-padded region id from the offices gateway', async () => {
    mockOffices([makeOffice('2')]);

    const regionIds = await RegionDriver.getAllRegionIds(context);

    expect(regionIds).toEqual(['02']);
  });

  test('returns an empty array when CAMS office data has no offices', async () => {
    mockOffices([]);

    const regionIds = await RegionDriver.getAllRegionIds(context);

    expect(regionIds).toEqual([]);
  });

  test('propagates a getOffices failure rather than swallowing it', async () => {
    const gatewayError = new Error('DXTR connection failed');
    vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
      getOffices: vi.fn().mockRejectedValue(gatewayError),
    } as unknown as ReturnType<typeof factory.getOfficesGateway>);

    await expect(RegionDriver.getAllRegionIds(context)).rejects.toThrow(gatewayError);
  });
});
