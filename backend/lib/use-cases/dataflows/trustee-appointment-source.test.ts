import { vi, describe, test, expect, beforeEach } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import {
  AcmsTrusteeAppointmentSource,
  DxtrTrusteeAppointmentSource,
} from './trustee-appointment-source';
import { AcmsCaseAppointmentRawRecord } from '../gateways.types';
import { UstpOfficeDetails } from '@common/cams/offices';
import { TrusteeAppointmentSyncEvent } from '@common/cams/dataflow-events';
import { DEFAULT_FETCH_SIZE } from './sync-trustee-case-appointments-constants';

function makeRawRecord(
  override: Partial<AcmsCaseAppointmentRawRecord> = {},
): AcmsCaseAppointmentRawRecord {
  return {
    id: 1001,
    CASE_DIV: 81,
    CASE_YEAR: 24,
    CASE_NUMBER: 12345,
    GROUP_DESIGNATOR: 'NY',
    PROF_CODE: 63,
    APPT_DATE: 20200101,
    DISP_DATE: null,
    CASE_FILED_DATE: 20190110,
    CURR_CASE_CHAPT: '7',
    CLOSED_BY_COURT_DATE: null,
    CLOSED_BY_UST_DATE: null,
    REOPENED_DATE: null,
    REGION_CODE: '02',
    CDB_UPDATE_DATE: 20200101,
    PROF_FIRST_NAME: 'Jane',
    PROF_LAST_NAME: 'Doe',
    PROF_MI: '',
    PROF_ADDRESS1: '123 Main St',
    PROF_ADDRESS2: '',
    PROF_CITY: 'Anytown',
    PROF_STATE: 'NY',
    PROF_ZIP: 100010000,
    PROF_COMMERCIAL_PHONE_NBR: 2125551234,
    ...override,
  };
}

function makeOffices(): UstpOfficeDetails[] {
  return [
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
  ];
}

describe('AcmsTrusteeAppointmentSource', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('has source name ACMS', () => {
    expect(new AcmsTrusteeAppointmentSource().name).toBe('ACMS');
  });

  describe('getLatestChangeDate', () => {
    test('delegates to the ACMS gateway for the given region', async () => {
      const getLatestCmmapChangeDateForRegion = vi.fn().mockResolvedValue('2026-07-01');
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getLatestCmmapChangeDateForRegion,
      } as unknown as ReturnType<typeof factory.getAcmsGateway>);

      const source = new AcmsTrusteeAppointmentSource();
      const result = await source.getLatestChangeDate(context, '02');

      expect(result).toBe('2026-07-01');
      expect(getLatestCmmapChangeDateForRegion).toHaveBeenCalledWith(context, '02');
    });

    test('returns undefined when the gateway has no rows for the region', async () => {
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getLatestCmmapChangeDateForRegion: vi.fn().mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof factory.getAcmsGateway>);

      const source = new AcmsTrusteeAppointmentSource();
      const result = await source.getLatestChangeDate(context, '02');

      expect(result).toBeUndefined();
    });
  });

  describe('getEventsForDate', () => {
    function setupGateways(records: AcmsCaseAppointmentRawRecord[], offices = makeOffices()) {
      const getCmmapAppointmentsRaw = vi.fn().mockResolvedValue(records);
      vi.spyOn(factory, 'getAcmsGateway').mockReturnValue({
        getCmmapAppointmentsRaw,
      } as unknown as ReturnType<typeof factory.getAcmsGateway>);
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue({
        getOffices: vi.fn().mockResolvedValue(offices),
      } as unknown as ReturnType<typeof factory.getOfficesGateway>);
      return { getCmmapAppointmentsRaw };
    }

    test('returns no events and does not call the offices gateway when the gateway has no rows', async () => {
      const officesGateway = { getOffices: vi.fn() };
      setupGateways([]);
      vi.spyOn(factory, 'getOfficesGateway').mockReturnValue(
        officesGateway as unknown as ReturnType<typeof factory.getOfficesGateway>,
      );

      const source = new AcmsTrusteeAppointmentSource();
      const page = await source.getEventsForDate(context, '02', '2026-07-01');

      expect(page).toEqual({ events: [], failures: [] });
      expect(officesGateway.getOffices).not.toHaveBeenCalled();
    });

    test('fetches the first page with lastId 0 and the shared default fetch size', async () => {
      const { getCmmapAppointmentsRaw } = setupGateways([]);

      const source = new AcmsTrusteeAppointmentSource();
      await source.getEventsForDate(context, '02', '2026-07-01');

      expect(getCmmapAppointmentsRaw).toHaveBeenCalledWith(
        context,
        0,
        DEFAULT_FETCH_SIZE,
        null,
        '02',
        '2026-07-01',
      );
    });

    test('forwards a string lastId to the gateway as a number', async () => {
      const { getCmmapAppointmentsRaw } = setupGateways([]);

      const source = new AcmsTrusteeAppointmentSource();
      await source.getEventsForDate(context, '02', '2026-07-01', '1001');

      expect(getCmmapAppointmentsRaw).toHaveBeenCalledWith(
        context,
        1001,
        DEFAULT_FETCH_SIZE,
        null,
        '02',
        '2026-07-01',
      );
    });

    test('maps raw rows into source-neutral events with courtId resolved from offices', async () => {
      setupGateways([makeRawRecord()]);

      const source = new AcmsTrusteeAppointmentSource();
      const page = await source.getEventsForDate(context, '02', '2026-07-01');

      expect(page.events).toHaveLength(1);
      expect(page.events[0]).toMatchObject({
        caseId: '081-24-12345',
        courtId: '0208',
        source: 'ACMS',
        acmsProfessionalId: 'NY-00063',
      });
    });

    test('returns the greatest row id as the page lastId', async () => {
      setupGateways([makeRawRecord({ id: 1001 }), makeRawRecord({ id: 1050, CASE_NUMBER: 1 })]);

      const source = new AcmsTrusteeAppointmentSource();
      const page = await source.getEventsForDate(context, '02', '2026-07-01');

      expect(page.lastId).toBe('1050');
    });

    test.each([
      ['an unknown division', { CASE_DIV: 999 }, '999-24-00002', 'ACMS division 999'],
      ['no CASE_FILED_DATE', { CASE_FILED_DATE: null }, '081-24-00002', 'no CASE_FILED_DATE'],
    ])(
      'isolates a row with %s: it becomes a failure and the other rows still convert',
      async (_label, override, failedCaseId, reasonFragment) => {
        setupGateways([
          makeRawRecord({ id: 1001, CASE_NUMBER: 2, ...override }),
          makeRawRecord({ id: 1050, CASE_NUMBER: 1 }),
        ]);

        const source = new AcmsTrusteeAppointmentSource();
        const page = await source.getEventsForDate(context, '02', '2026-07-01');

        expect(page.events).toEqual([
          expect.objectContaining({ caseId: '081-24-00001', dateFiled: '2019-01-10' }),
        ]);
        expect(page.failures).toEqual([
          { rowId: 1001, caseId: failedCaseId, reason: expect.stringContaining(reasonFragment) },
        ]);
        expect(page.lastId).toBe('1050');
      },
    );
  });
});

describe('DxtrTrusteeAppointmentSource', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
  });

  test('getLatestChangeDate is not supported', async () => {
    await expect(new DxtrTrusteeAppointmentSource().getLatestChangeDate()).rejects.toThrow(
      'not supported',
    );
  });

  test('getEventsForDate returns appointment and petition events together, with no failures', async () => {
    const appointment = { caseId: '081-24-00001' } as TrusteeAppointmentSyncEvent;
    const petition = { caseId: '081-24-00002' } as TrusteeAppointmentSyncEvent;
    const casesGateway = {
      getTrusteeAppointments: vi.fn().mockResolvedValue({ events: [appointment] }),
      getTrusteePetitionEvents: vi.fn().mockResolvedValue({ events: [petition] }),
    };
    vi.spyOn(factory, 'getCasesGateway').mockReturnValue(
      casesGateway as unknown as ReturnType<typeof factory.getCasesGateway>,
    );

    const page = await new DxtrTrusteeAppointmentSource().getEventsForDate(
      context,
      '02',
      '2026-07-01',
    );

    expect(page).toEqual({ events: [appointment, petition], failures: [] });
    expect(casesGateway.getTrusteeAppointments).toHaveBeenCalledWith(context, '2026-07-01');
    expect(casesGateway.getTrusteePetitionEvents).toHaveBeenCalledWith(context, '2026-07-01');
  });
});
