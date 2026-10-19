import { describe, test, expect, vi, beforeEach } from 'vitest';
import { UstpOfficeDetails } from '@common/cams/offices';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { SYSTEM_USER_REFERENCE } from '@common/cams/auditable';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { MockOfficesGateway } from '../../testing/mock-gateways/mock.offices.gateway';
import { NotFoundError } from '../../common-errors/not-found-error';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { AppointmentUstDivisionCodeBackfillState } from '../gateways.types';
import QueryBuilder from '../../query/query-builder';
import BackfillAppointmentUstDivisionCodesUseCase, {
  CourtDivisionMaps,
} from './backfill-appointment-ust-division-codes';

const { and, using } = QueryBuilder;

function division(courtId: string, divisionCode: string, ustDivisionCode: string, name: string) {
  return {
    divisionCode,
    ustDivisionCode,
    court: { courtId, courtName: `Court ${courtId}` },
    courtOffice: { courtOfficeCode: ustDivisionCode, courtOfficeName: name },
  };
}

const offices: UstpOfficeDetails[] = [
  {
    officeCode: 'TN',
    officeName: 'Tennessee',
    idpGroupName: 'TN',
    regionId: '08',
    regionName: 'Memphis',
    groups: [
      {
        groupDesignator: 'CH',
        divisions: [
          division('0649', '491', '491', 'Chattanooga'),
          division('0649', '491', '494', 'Winchester'),
          division('0649', '492', '492', 'Greeneville'),
          division('0649', '492', '495', 'Johnson City'),
          division('0649', '493', '493', 'Knoxville'),
        ],
      },
    ],
  },
  {
    officeCode: 'XX',
    officeName: 'Elsewhere',
    idpGroupName: 'XX',
    regionId: '01',
    regionName: 'Boston',
    groups: [
      {
        groupDesignator: 'XX',
        divisions: [
          division('0090', '900', '901', 'Remapped'),
          division('0090', '902', '902', 'Same'),
          division('0101', '011', '011', 'Unchanged A'),
          division('0101', '012', '012', 'Unchanged B'),
        ],
      },
    ],
  },
];

const CUTOFF = '2026-10-14T00:00:00.000Z';

function appointment(overrides: Partial<TrusteeAppointment>): TrusteeAppointment & { _id: string } {
  return {
    _id: 'oid-1',
    id: 'appt-1',
    trusteeId: 'trustee-1',
    chapter: '7',
    appointmentType: 'panel',
    courtId: '0649',
    divisionCodes: ['491'],
    appointedDate: '2020-01-01',
    status: 'active',
    effectiveDate: '2020-01-01',
    updatedOn: '2025-01-01T00:00:00.000Z',
    updatedBy: SYSTEM_USER_REFERENCE,
    ...overrides,
  } as TrusteeAppointment & { _id: string };
}

describe('BackfillAppointmentUstDivisionCodesUseCase', () => {
  let context: ApplicationContext;
  let maps: CourtDivisionMaps;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();
    maps = BackfillAppointmentUstDivisionCodesUseCase.buildCourtDivisionMaps(offices);
  });

  describe('buildCourtDivisionMaps', () => {
    test('includes only Eastern District of TN, even when other courts diverge', () => {
      expect([...maps.keys()]).toEqual(['0649']);
    });

    test('CAMS-936 Phase 1: prefers tempCourtDivisionCode over ustDivisionCode when building maps (freshly synced offices)', () => {
      const freshOffices: UstpOfficeDetails[] = [
        {
          officeCode: 'TN',
          officeName: 'Tennessee',
          idpGroupName: 'TN',
          regionId: '08',
          regionName: 'Memphis',
          groups: [
            {
              groupDesignator: 'CH',
              divisions: [
                {
                  divisionCode: '491',
                  tempCourtDivisionCode: '491',
                  court: { courtId: '0649', courtName: 'Eastern TN' },
                  courtOffice: { courtOfficeCode: '1', courtOfficeName: 'Chattanooga' },
                },
                {
                  divisionCode: '491',
                  tempCourtDivisionCode: '494',
                  court: { courtId: '0649', courtName: 'Eastern TN' },
                  courtOffice: { courtOfficeCode: '4', courtOfficeName: 'Winchester' },
                },
                {
                  divisionCode: '492',
                  tempCourtDivisionCode: '492',
                  court: { courtId: '0649', courtName: 'Eastern TN' },
                  courtOffice: { courtOfficeCode: '2', courtOfficeName: 'Greeneville' },
                },
                {
                  divisionCode: '492',
                  tempCourtDivisionCode: '495',
                  court: { courtId: '0649', courtName: 'Eastern TN' },
                  courtOffice: { courtOfficeCode: '5', courtOfficeName: 'Johnson City' },
                },
                {
                  divisionCode: '493',
                  tempCourtDivisionCode: '493',
                  court: { courtId: '0649', courtName: 'Eastern TN' },
                  courtOffice: { courtOfficeCode: '3', courtOfficeName: 'Knoxville' },
                },
              ],
            },
          ],
        },
      ];

      const freshMaps =
        BackfillAppointmentUstDivisionCodesUseCase.buildCourtDivisionMaps(freshOffices);

      expect([...freshMaps.keys()]).toEqual(['0649']);
      const map = freshMaps.get('0649')!;
      expect(map.allUstCodes).toEqual(['491', '492', '493', '494', '495']);
    });
  });

  describe('remapDivisionCodes', () => {
    const remap = (courtId: string, codes: string[]) =>
      BackfillAppointmentUstDivisionCodesUseCase.remapDivisionCodes(maps.get(courtId)!, codes);

    test('replaces a whole-district ATS appointment with every bare code in the court', () => {
      expect(remap('0649', ['491', '491', '492', '492', '493'])).toEqual({
        category: 'wholeDistrict',
        divisionCodes: ['491', '492', '493', '494', '495'],
      });
    });

    test('expands an ACMS code shared by several divisions to all of them', () => {
      expect(remap('0649', ['491'])).toEqual({
        category: 'ambiguous',
        divisionCodes: ['491', '494'],
      });
    });

    test('leaves codes that are not ACMS codes in the court untouched', () => {
      expect(remap('0649', ['494'])).toEqual({ category: 'unchanged', divisionCodes: ['494'] });
    });

    test('reports unchanged when the codes already map to themselves', () => {
      expect(remap('0649', ['493'])).toEqual({ category: 'unchanged', divisionCodes: ['493'] });
    });
  });

  describe('getPageOfAppointments', () => {
    test('queries pre-cutoff appointments in divergent courts after the cursor', async () => {
      const findSpy = vi
        .spyOn(MockMongoRepository.prototype, 'findByCursor')
        .mockResolvedValue([appointment({})]);
      const doc = using<TrusteeAppointment & { _id: string; documentType?: string }>();

      const result = await BackfillAppointmentUstDivisionCodesUseCase.getPageOfAppointments(
        context,
        ['0649'],
        CUTOFF,
        'oid-0',
        100,
      );

      expect(findSpy).toHaveBeenCalledWith(
        and(
          doc('documentType').equals('TRUSTEE_APPOINTMENT'),
          doc('courtId').contains(['0649']),
          doc('updatedOn').lessThan(CUTOFF),
          doc('_id').greaterThan('oid-0'),
        ),
        { limit: 101, sortField: '_id', sortDirection: 'ASCENDING' },
      );
      expect(result.data).toEqual({
        appointments: [appointment({})],
        lastId: 'oid-1',
        hasMore: false,
      });
    });

    test('detects hasMore when results exceed the limit', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        appointment({ _id: 'a' } as never),
        appointment({ _id: 'b' } as never),
      ]);

      const result = await BackfillAppointmentUstDivisionCodesUseCase.getPageOfAppointments(
        context,
        ['0649'],
        CUTOFF,
        null,
        1,
      );

      expect(result.data?.appointments).toHaveLength(1);
      expect(result.data?.lastId).toBe('a');
      expect(result.data?.hasMore).toBe(true);
    });
  });

  describe('processBackfillPage', () => {
    const inProgress: AppointmentUstDivisionCodeBackfillState = {
      id: 'state-id',
      documentType: 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE',
      lastId: 'oid-0',
      cutoff: CUTOFF,
      dryRun: false,
      processedCount: 10,
      updatedCount: 4,
      ambiguousCount: 1,
      failedCount: 0,
      startedAt: '2026-10-14T01:00:00.000Z',
      lastUpdatedAt: '2026-10-14T01:00:00.000Z',
      status: 'IN_PROGRESS',
    };

    beforeEach(() => {
      vi.spyOn(MockOfficesGateway.prototype, 'getOffices').mockResolvedValue(offices);
    });

    test('writes remapped codes, skips unchanged ones, and accumulates counts', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(inProgress);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        appointment({
          _id: 'a',
          id: 'ats',
          divisionCodes: ['491', '491', '492', '492', '493'],
        } as never),
        appointment({ _id: 'b', id: 'ui', divisionCodes: ['491'] } as never),
        appointment({ _id: 'c', id: 'done', divisionCodes: ['494'] } as never),
        appointment({ _id: 'd', id: 'extra' } as never),
      ]);
      const updateSpy = vi
        .spyOn(MockMongoRepository.prototype, 'updateAppointment')
        .mockResolvedValue({} as TrusteeAppointment);
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

      const result = await BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(
        context,
        'oid-0',
        3,
      );

      expect(updateSpy).toHaveBeenCalledTimes(2);
      expect(updateSpy).toHaveBeenCalledWith(
        'trustee-1',
        'ats',
        expect.objectContaining({ divisionCodes: ['491', '492', '493', '494', '495'] }),
        SYSTEM_USER_REFERENCE,
      );
      expect(updateSpy).toHaveBeenCalledWith(
        'trustee-1',
        'ui',
        expect.objectContaining({ divisionCodes: ['491', '494'] }),
        SYSTEM_USER_REFERENCE,
      );
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          lastId: 'c',
          processedCount: 13,
          updatedCount: 6,
          ambiguousCount: 2,
          failedCount: 0,
          status: 'IN_PROGRESS',
        }),
      );
      expect(result).toEqual({ status: 'ok', nextCursor: { lastId: 'c' } });
    });

    test('logs but does not write in a dry run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
        ...inProgress,
        dryRun: true,
      });
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        appointment({ _id: 'b', divisionCodes: ['491'] } as never),
      ]);
      const updateSpy = vi.spyOn(MockMongoRepository.prototype, 'updateAppointment');
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

      const result = await BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(
        context,
        'oid-0',
        100,
      );

      expect(updateSpy).not.toHaveBeenCalled();
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ updatedCount: 5, ambiguousCount: 2, status: 'COMPLETED' }),
      );
      expect(result).toEqual({ status: 'ok', nextCursor: null });
    });

    test('counts a failed write and marks the last page COMPLETED_WITH_FAILURES', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(inProgress);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
        appointment({ _id: 'b', divisionCodes: ['491'] } as never),
      ]);
      vi.spyOn(MockMongoRepository.prototype, 'updateAppointment').mockRejectedValue(
        new Error('boom'),
      );
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

      await BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(context, 'oid-0', 100);

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          updatedCount: 4,
          failedCount: 1,
          status: 'COMPLETED_WITH_FAILURES',
        }),
      );
    });

    test('backs off and retries a throttled write', async () => {
      vi.useFakeTimers();
      try {
        vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(inProgress);
        vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([
          appointment({ _id: 'b', divisionCodes: ['491'] } as never),
        ]);
        const updateSpy = vi
          .spyOn(MockMongoRepository.prototype, 'updateAppointment')
          .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
          .mockResolvedValue({} as TrusteeAppointment);
        vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

        const promise = BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(
          context,
          'oid-0',
          100,
          { baseDelayMs: 1 },
        );
        await vi.runAllTimersAsync();
        await promise;

        expect(updateSpy).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });

    test('marks the run complete when the page is empty', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue(inProgress);
      vi.spyOn(MockMongoRepository.prototype, 'findByCursor').mockResolvedValue([]);
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

      const result = await BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(
        context,
        'oid-0',
        100,
      );

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ lastId: 'oid-0', status: 'COMPLETED' }),
      );
      expect(result).toEqual({ status: 'empty' });
    });

    test('returns an error when no run has been started', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );

      const result = await BackfillAppointmentUstDivisionCodesUseCase.processBackfillPage(
        context,
        null,
        100,
      );

      expect(result.status).toBe('error');
    });
  });

  describe('startBackfill', () => {
    test('creates IN_PROGRESS state with the cutoff and dryRun flag on a fresh run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

      const result = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {
        cutoff: CUTOFF,
        dryRun: true,
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE',
          lastId: null,
          cutoff: CUTOFF,
          dryRun: true,
          processedCount: 0,
          status: 'IN_PROGRESS',
        }),
      );
      expect(result).toEqual({ status: 'started', lastId: null });
    });

    test('rejects a fresh run without a valid cutoff', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockRejectedValue(
        new NotFoundError('TEST', { message: 'Not found' }),
      );
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');

      const result = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {
        cutoff: 'not-a-date',
      });

      expect(upsertSpy).not.toHaveBeenCalled();
      expect(result.status).toBe('invalid');
    });

    test('resumes an in-progress run from its cursor, keeping its cutoff', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
        documentType: 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'oid-9',
        cutoff: CUTOFF,
        dryRun: false,
        processedCount: 9,
        updatedCount: 0,
        ambiguousCount: 0,
        failedCount: 0,
        startedAt: CUTOFF,
        lastUpdatedAt: CUTOFF,
        status: 'IN_PROGRESS',
      });
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert');

      const result = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {});

      expect(upsertSpy).not.toHaveBeenCalled();
      expect(result).toEqual({ status: 'started', lastId: 'oid-9' });
    });

    test('starts a real run fresh after a completed dry run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
        id: 'state-id',
        documentType: 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'oid-9',
        cutoff: '2026-01-01T00:00:00.000Z',
        dryRun: true,
        processedCount: 9,
        updatedCount: 3,
        ambiguousCount: 1,
        failedCount: 0,
        startedAt: CUTOFF,
        lastUpdatedAt: CUTOFF,
        status: 'COMPLETED',
      });
      const upsertSpy = vi.spyOn(MockMongoRepository.prototype, 'upsert').mockResolvedValue({});

      const result = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {
        cutoff: CUTOFF,
        dryRun: false,
      });

      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'state-id',
          lastId: null,
          cutoff: CUTOFF,
          dryRun: false,
          processedCount: 0,
          updatedCount: 0,
          ambiguousCount: 0,
          status: 'IN_PROGRESS',
        }),
      );
      expect(result).toEqual({ status: 'started', lastId: null });
    });

    test('skips a completed real run', async () => {
      vi.spyOn(MockMongoRepository.prototype, 'read').mockResolvedValue({
        documentType: 'APPOINTMENT_UST_DIVISION_CODE_BACKFILL_STATE',
        lastId: 'oid-9',
        cutoff: CUTOFF,
        dryRun: false,
        processedCount: 9,
        updatedCount: 3,
        ambiguousCount: 1,
        failedCount: 0,
        startedAt: CUTOFF,
        lastUpdatedAt: CUTOFF,
        status: 'COMPLETED',
      });

      const result = await BackfillAppointmentUstDivisionCodesUseCase.startBackfill(context, {
        cutoff: CUTOFF,
      });

      expect(result.status).toBe('completed');
    });
  });
});
