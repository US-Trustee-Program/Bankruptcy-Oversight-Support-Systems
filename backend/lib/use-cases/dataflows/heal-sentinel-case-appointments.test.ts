import { describe, test, expect, vi, beforeEach } from 'vitest';
import HealSentinelCaseAppointmentsUseCase, { HealClock } from './heal-sentinel-case-appointments';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import factory from '../../factory';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';
import { GatewayTimeoutError } from '../../common-errors/gateway-timeout';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import { ApplicationContext } from '../../adapters/types/basic';
import { CaseAppointment } from '@common/cams/trustee-appointments';
import { HealSentinelCaseAppointmentsPageMessage } from '@common/cams/dataflow-events';
import { TrusteeProfessionalIdSummary } from './trustee-professional-ids.types';
import { SENTINEL_TRUSTEE_ID } from './migrate-case-appointments-constants';

type SentinelAppointment = CaseAppointment & {
  _id: string;
  reason?: string;
  acmsProfessionalId?: string;
};

const PAGE_SIZE = 1000;

const makeSentinel = (n: number, overrides: Partial<SentinelAppointment> = {}) =>
  ({
    id: `sentinel-${n}`,
    _id: `appt-mongo-${String(n).padStart(4, '0')}`,
    caseId: `081-25-${String(n).padStart(5, '0')}`,
    trusteeId: SENTINEL_TRUSTEE_ID,
    assignedOn: '2025-01-01T00:00:00.000Z',
    appointedDate: '2025-01-01',
    dateFiled: '2024-06-01',
    chapter: '7',
    courtDivisionCode: '081',
    reason: 'trustee-not-found',
    acmsProfessionalId: 'NY-00063',
    ...overrides,
  }) as SentinelAppointment;

const makeLink = (
  overrides: Partial<TrusteeProfessionalIdSummary & { _id: string }> = {},
): TrusteeProfessionalIdSummary & { _id: string } =>
  ({
    _id: 'prof-mongo-1',
    id: 'prof-id-1',
    documentType: 'TRUSTEE_PROFESSIONAL_ID',
    camsTrusteeId: 'trustee-resolved',
    acmsProfessionalId: 'NY-00063',
    disposition: 'linked',
    linkMethod: 'auto',
    nameMatchCount: 1,
    createdOn: '2025-01-01T00:00:00.000Z',
    updatedOn: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }) as TrusteeProfessionalIdSummary & { _id: string };

const makePage = (
  overrides: Partial<HealSentinelCaseAppointmentsPageMessage> = {},
): HealSentinelCaseAppointmentsPageMessage => ({
  trusteeProfessionalId: 'prof-id-1',
  camsTrusteeId: 'trustee-resolved',
  acmsProfessionalId: 'NY-00063',
  ...overrides,
});

/** A clock whose time advances only by what the code under test sleeps, plus explicit ticks. */
const makeClock = (start = 0) => {
  let time = start;
  const slept: number[] = [];
  const clock: HealClock = {
    now: () => time,
    sleep: async (ms: number) => {
      slept.push(ms);
      time += ms;
    },
  };
  return { clock, slept, advance: (ms: number) => (time += ms) };
};

const tooMany = () => new TooManyRequestsError('TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY');

describe('HealSentinelCaseAppointmentsUseCase', () => {
  let context: ApplicationContext;
  let mockFindSentinels: ReturnType<typeof vi.fn>;
  let mockUpsert: ReturnType<typeof vi.fn>;
  let mockDeleteSentinel: ReturnType<typeof vi.fn>;
  let mockFindLinked: ReturnType<typeof vi.fn>;
  let mockFindByAcmsProfessionalId: ReturnType<typeof vi.fn>;
  let mockMarkSentinelsHealed: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.restoreAllMocks();
    context = await createMockApplicationContext();

    mockFindSentinels = vi.fn().mockResolvedValue([]);
    mockUpsert = vi.fn().mockResolvedValue({});
    mockDeleteSentinel = vi.fn().mockResolvedValue(undefined);
    mockFindLinked = vi.fn().mockResolvedValue([]);
    mockFindByAcmsProfessionalId = vi.fn().mockResolvedValue([makeLink()]);
    mockMarkSentinelsHealed = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findSentinelAppointmentsByAcmsProfessionalId: mockFindSentinels,
        upsert: mockUpsert,
        deleteSentinel: mockDeleteSentinel,
      }),
    );
    vi.spyOn(factory, 'getTrusteeProfessionalIdsRepository').mockReturnValue(
      Object.assign(new MockMongoRepository(), {
        findLinkedForSentinelHeal: mockFindLinked,
        findByAcmsProfessionalId: mockFindByAcmsProfessionalId,
        markSentinelsHealed: mockMarkSentinelsHealed,
      }),
    );
  });

  describe('startPages', () => {
    test('queues one page per linked record, paging through every linked record', async () => {
      const firstBatch = Array.from({ length: 1000 }, (_, i) =>
        makeLink({ _id: `prof-mongo-${i}`, id: `prof-id-${i}`, acmsProfessionalId: `NY-${i}` }),
      );
      const lastBatch = [
        makeLink({
          _id: 'prof-mongo-z',
          id: 'prof-id-z',
          camsTrusteeId: 't-z',
          acmsProfessionalId: 'NY-Z',
        }),
      ];
      mockFindLinked.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce(lastBatch);
      const useCase = new HealSentinelCaseAppointmentsUseCase(context);

      const pages = await useCase.startPages(false);

      expect(mockFindLinked).toHaveBeenNthCalledWith(1, null, 1000, false);
      expect(mockFindLinked).toHaveBeenNthCalledWith(2, 'prof-mongo-999', 1000, false);
      expect(pages).toHaveLength(1001);
      expect(pages[1000]).toEqual({
        trusteeProfessionalId: 'prof-id-z',
        camsTrusteeId: 't-z',
        acmsProfessionalId: 'NY-Z',
      });
    });

    test('includes records already marked healed when told to ignore the flag', async () => {
      const useCase = new HealSentinelCaseAppointmentsUseCase(context);

      await useCase.startPages(true);

      expect(mockFindLinked).toHaveBeenCalledWith(null, 1000, true);
    });
  });

  describe('healPage', () => {
    test('heals each sentinel under the linked trustee, then requeues with the cursor advanced', async () => {
      const sentinels = [makeSentinel(1), makeSentinel(2)];
      mockFindSentinels.mockResolvedValueOnce(sentinels);
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(makePage(), 60_000, PAGE_SIZE);

      expect(mockFindSentinels).toHaveBeenCalledWith('NY-00063', null, PAGE_SIZE);
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      const upserted = mockUpsert.mock.calls[0][0];
      expect(upserted).toMatchObject({
        caseId: sentinels[0].caseId,
        trusteeId: 'trustee-resolved',
      });
      expect(upserted).not.toHaveProperty('reason');
      expect(upserted).not.toHaveProperty('acmsProfessionalId');
      expect(upserted).not.toHaveProperty('_id');
      expect(upserted).not.toHaveProperty('id');
      expect(mockDeleteSentinel).toHaveBeenNthCalledWith(
        1,
        sentinels[0].caseId,
        sentinels[0].id,
        sentinels[0]._id,
      );
      expect(mockUpsert.mock.invocationCallOrder[0]).toBeLessThan(
        mockDeleteSentinel.mock.invocationCallOrder[0],
      );
      expect(result).toEqual({
        documentsWritten: 2,
        documentsFailed: 0,
        pageSize: 2,
        outcome: 'requeued',
        delaySeconds: 0,
        next: makePage({ lastAppointmentId: sentinels[1]._id }),
      });
    });

    test('preserves unassignedOn, closedDate, and reopenedDate from a sentinel that represents an already-closed/reopened case', async () => {
      // upsert() is a full replaceOne with no merge, so dropping these would discard the case's
      // ACMS history and (since caseStatus derives from closedDate) misreport a closed case as OPEN.
      mockFindSentinels.mockResolvedValueOnce([
        makeSentinel(1, {
          unassignedOn: '2025-03-01T00:00:00.000Z',
          closedDate: '2025-03-01',
          reopenedDate: '2025-04-01',
        }),
      ]);
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      await useCase.healPage(makePage(), 60_000, PAGE_SIZE);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          unassignedOn: '2025-03-01T00:00:00.000Z',
          closedDate: '2025-03-01',
          reopenedDate: '2025-04-01',
        }),
      );
    });

    test('reads the next page from the cursor in the message', async () => {
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      await useCase.healPage(makePage({ lastAppointmentId: 'appt-mongo-0999' }), 60_000, PAGE_SIZE);

      expect(mockFindSentinels).toHaveBeenNthCalledWith(
        1,
        'NY-00063',
        'appt-mongo-0999',
        PAGE_SIZE,
      );
    });

    test('is done when no sentinels are left, and marks the record healed', async () => {
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(
        makePage({ lastAppointmentId: 'appt-mongo-0999' }),
        60_000,
        PAGE_SIZE,
      );

      expect(mockMarkSentinelsHealed).toHaveBeenCalledWith('trustee-resolved', 'NY-00063');
      expect(result).toMatchObject({ outcome: 'done', next: null, pageSize: 0 });
    });

    test('is done without marking the record healed when failed sentinels remain behind the cursor', async () => {
      mockFindSentinels.mockResolvedValueOnce([]).mockResolvedValueOnce([makeSentinel(1)]);
      const warnSpy = vi.spyOn(context.logger, 'warn');
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(
        makePage({ lastAppointmentId: 'appt-mongo-0999' }),
        60_000,
        PAGE_SIZE,
      );

      expect(mockMarkSentinelsHealed).not.toHaveBeenCalled();
      expect(warnSpy).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('NY-00063'));
      expect(result).toMatchObject({ outcome: 'done', next: null });
    });

    test.each([
      { description: 'no longer linked', links: [] },
      { description: 'linked to a different record', links: [makeLink({ id: 'prof-id-2' })] },
      {
        description: 'one of several links',
        links: [makeLink(), makeLink({ id: 'prof-id-2' })],
      },
    ])('stops without healing when the record is $description', async ({ links }) => {
      mockFindByAcmsProfessionalId.mockResolvedValue(links);
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(makePage(), 60_000, PAGE_SIZE);

      expect(mockFindSentinels).not.toHaveBeenCalled();
      expect(result).toMatchObject({ outcome: 'link-changed', next: null });
    });

    test('counts a failed sentinel, leaves it in place, and moves on', async () => {
      mockFindSentinels.mockResolvedValueOnce([makeSentinel(1), makeSentinel(2)]);
      mockUpsert.mockRejectedValueOnce(new Error('upsert failed'));
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(makePage(), 60_000, PAGE_SIZE);

      expect(mockDeleteSentinel).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        documentsWritten: 1,
        documentsFailed: 1,
        next: makePage({ lastAppointmentId: 'appt-mongo-0002' }),
      });
    });

    test.each([
      { description: '429s', throttle: tooMany },
      {
        description: 'gateway timeouts',
        throttle: () => new GatewayTimeoutError('TRUSTEE-CASE-APPOINTMENTS-MONGO-REPOSITORY'),
      },
    ])(
      'backs off exponentially on consecutive $description and then heals the sentinel',
      async ({ throttle }) => {
        mockFindSentinels.mockResolvedValueOnce([makeSentinel(1)]);
        mockUpsert
          .mockRejectedValueOnce(throttle())
          .mockRejectedValueOnce(throttle())
          .mockRejectedValueOnce(throttle())
          .mockResolvedValue({});
        const { clock, slept } = makeClock();
        const useCase = new HealSentinelCaseAppointmentsUseCase(context, clock);

        const result = await useCase.healPage(makePage(), 60_000, PAGE_SIZE);

        expect(slept).toEqual([1000, 2000, 4000]);
        expect(result).toMatchObject({ documentsWritten: 1, outcome: 'requeued' });
      },
    );

    test('caps a single backoff at 60 seconds', async () => {
      mockFindSentinels.mockResolvedValueOnce([makeSentinel(1)]);
      for (let i = 0; i < 7; i++) mockUpsert.mockRejectedValueOnce(tooMany());
      const { clock, slept } = makeClock();
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, clock);

      await useCase.healPage(makePage(), Number.MAX_SAFE_INTEGER, PAGE_SIZE);

      expect(slept).toEqual([1000, 2000, 4000, 8000, 16000, 32000, 60000]);
    });

    test.each([
      {
        call: 'the link check',
        throttle: () => mockFindByAcmsProfessionalId.mockRejectedValue(tooMany()),
      },
      {
        call: 'the remaining-sentinel check',
        throttle: () =>
          mockFindSentinels.mockResolvedValueOnce([]).mockRejectedValueOnce(tooMany()),
      },
      {
        call: 'marking the record healed',
        throttle: () => mockMarkSentinelsHealed.mockRejectedValue(tooMany()),
      },
    ])(
      'escapes with the incoming cursor when $call is throttled past the deadline',
      async ({ throttle }) => {
        throttle();
        const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);
        const page = makePage({ lastAppointmentId: 'appt-mongo-0999' });

        const result = await useCase.healPage(page, 1_000, PAGE_SIZE);

        expect(result).toMatchObject({ outcome: 'escaped', next: page });
      },
    );

    test('escapes before deleting when the upsert is throttled past the deadline', async () => {
      mockFindSentinels.mockResolvedValueOnce([makeSentinel(1)]);
      mockUpsert.mockRejectedValue(tooMany());
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(makePage(), 1_000, PAGE_SIZE);

      expect(mockDeleteSentinel).not.toHaveBeenCalled();
      expect(result).toMatchObject({ outcome: 'escaped', documentsWritten: 0, next: makePage() });
    });

    test('escapes and requeues from the last completed sentinel when the next backoff would pass the deadline', async () => {
      mockFindSentinels.mockResolvedValueOnce([makeSentinel(1), makeSentinel(2), makeSentinel(3)]);
      mockDeleteSentinel.mockResolvedValueOnce(undefined).mockRejectedValue(tooMany());
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);

      const result = await useCase.healPage(makePage(), 5_000, PAGE_SIZE);

      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        documentsWritten: 1,
        documentsFailed: 0,
        pageSize: 3,
        outcome: 'escaped',
        delaySeconds: 4,
        next: makePage({ lastAppointmentId: 'appt-mongo-0001' }),
      });
    });

    test('escapes with the incoming cursor when the sentinel query is throttled past the deadline', async () => {
      mockFindSentinels.mockRejectedValue(tooMany());
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, makeClock().clock);
      const page = makePage({ lastAppointmentId: 'appt-mongo-0999' });

      const result = await useCase.healPage(page, 2_000, PAGE_SIZE);

      expect(result).toMatchObject({ outcome: 'escaped', next: page, documentsWritten: 0 });
    });

    test('escapes before the next sentinel once the deadline has passed', async () => {
      mockFindSentinels.mockResolvedValueOnce([makeSentinel(1), makeSentinel(2)]);
      const { clock, advance } = makeClock();
      mockUpsert.mockImplementation(async () => {
        advance(10_000);
        return {};
      });
      const useCase = new HealSentinelCaseAppointmentsUseCase(context, clock);

      const result = await useCase.healPage(makePage(), 5_000, PAGE_SIZE);

      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        documentsWritten: 1,
        outcome: 'escaped',
        delaySeconds: 0,
        next: makePage({ lastAppointmentId: 'appt-mongo-0001' }),
      });
    });
  });
});
