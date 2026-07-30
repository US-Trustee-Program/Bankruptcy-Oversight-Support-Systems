import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import FixChapter7AppointmentsUseCase from './fix-chapter-7-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';
import { TooManyRequestsError } from '../../common-errors/too-many-requests-error';

function mockRepository(overrides: {
  findAppointmentIdPairsByChapter?: ReturnType<typeof vi.fn>;
  applyChapterFix?: ReturnType<typeof vi.fn>;
}) {
  vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
    Object.assign(new MockMongoRepository(), overrides) as unknown as ReturnType<
      typeof factory.getTrusteeCaseAppointmentsRepository
    >,
  );
}

describe('FixChapter7AppointmentsUseCase', () => {
  let context: ApplicationContext;

  beforeAll(async () => {
    context = await createMockApplicationContext();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const idPairs = [
    { trusteeApptId: 'trustee-mongo-1', caseApptId: 'case-mongo-1' },
    { trusteeApptId: 'trustee-mongo-2', caseApptId: 'case-mongo-2' },
  ];

  describe('readIdPairs', () => {
    test('delegates to repository.findAppointmentIdPairsByChapter with the same arguments', async () => {
      const findAppointmentIdPairsByChapterMock = vi.fn().mockResolvedValue(idPairs);
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      const result = await FixChapter7AppointmentsUseCase.readIdPairs(context, '7A', 10000);

      expect(result).toEqual(idPairs);
      expect(findAppointmentIdPairsByChapterMock).toHaveBeenCalledWith('7A', 10000);
    });

    test('returns an empty array when the repository finds nothing', async () => {
      const findAppointmentIdPairsByChapterMock = vi.fn().mockResolvedValue([]);
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      const result = await FixChapter7AppointmentsUseCase.readIdPairs(context, 'AC', 10000);

      expect(result).toEqual([]);
    });

    test('propagates errors thrown by the repository', async () => {
      const findAppointmentIdPairsByChapterMock = vi
        .fn()
        .mockRejectedValue(new Error('mongo read failed'));
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      await expect(
        FixChapter7AppointmentsUseCase.readIdPairs(context, '7A', 10000),
      ).rejects.toThrow('mongo read failed');
    });
  });

  describe('applyFix', () => {
    test('delegates to repository.applyChapterFix with the same arguments for a rename operation', async () => {
      const applyChapterFixMock = vi.fn().mockResolvedValue({ modifiedCount: 2 });
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          applyChapterFix: applyChapterFixMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      const result = await FixChapter7AppointmentsUseCase.applyFix(
        context,
        idPairs,
        'rename',
        '7A',
        '7',
      );

      expect(result).toEqual({ modifiedCount: 2 });
      expect(applyChapterFixMock).toHaveBeenCalledWith(idPairs, 'rename', '7A', '7');
    });

    test('delegates to repository.applyChapterFix for a delete operation without setChapter', async () => {
      const applyChapterFixMock = vi.fn().mockResolvedValue({ modifiedCount: 1 });
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          applyChapterFix: applyChapterFixMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      const result = await FixChapter7AppointmentsUseCase.applyFix(
        context,
        [idPairs[0]],
        'delete',
        'AC',
      );

      expect(result).toEqual({ modifiedCount: 1 });
      expect(applyChapterFixMock).toHaveBeenCalledWith([idPairs[0]], 'delete', 'AC', undefined);
    });

    test('propagates errors thrown by the repository', async () => {
      const applyChapterFixMock = vi.fn().mockRejectedValue(new Error('mongo write failed'));
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          applyChapterFix: applyChapterFixMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      await expect(
        FixChapter7AppointmentsUseCase.applyFix(context, [idPairs[0]], 'rename', '7A', '7'),
      ).rejects.toThrow('mongo write failed');
    });
  });

  describe('runReaderLoop', () => {
    test('drains multiple batches in one call, summing totalModified, until an empty read reports stream complete', async () => {
      const findAppointmentIdPairsByChapterMock = vi
        .fn()
        .mockResolvedValueOnce([idPairs[0]])
        .mockResolvedValueOnce([idPairs[1]])
        .mockResolvedValueOnce([]);
      const applyChapterFixMock = vi
        .fn()
        .mockResolvedValueOnce({ modifiedCount: 1 })
        .mockResolvedValueOnce({ modifiedCount: 1 });
      mockRepository({
        findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock,
        applyChapterFix: applyChapterFixMock,
      });

      const result = await FixChapter7AppointmentsUseCase.runReaderLoop(
        context,
        '7A',
        'rename',
        '7',
        1000,
      );

      expect(result).toEqual({
        totalModified: 2,
        streamComplete: true,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 0,
      });
      expect(findAppointmentIdPairsByChapterMock).toHaveBeenCalledTimes(3);
      expect(applyChapterFixMock).toHaveBeenCalledTimes(2);
    });

    test('escapes before reading when already past the safe threshold, without querying Mongo', async () => {
      const findAppointmentIdPairsByChapterMock = vi.fn().mockResolvedValue(idPairs);
      mockRepository({ findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock });

      const result = await FixChapter7AppointmentsUseCase.runReaderLoop(
        context,
        '7A',
        'rename',
        '7',
        1000,
        { startedAt: Date.now() - 1000, safeThresholdMs: 500 },
      );

      expect(result).toEqual({
        totalModified: 0,
        streamComplete: false,
        unwrittenIdPairs: [],
        recommendedVisibilitySeconds: 0,
      });
      expect(findAppointmentIdPairsByChapterMock).not.toHaveBeenCalled();
    });

    test('retries a rate-limited read in place, then succeeds without escaping', async () => {
      const findAppointmentIdPairsByChapterMock = vi
        .fn()
        .mockRejectedValueOnce(new TooManyRequestsError('TEST'))
        .mockResolvedValueOnce([]);
      mockRepository({ findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock });

      const result = await FixChapter7AppointmentsUseCase.runReaderLoop(
        context,
        '7A',
        'rename',
        '7',
        1000,
        { startedAt: Date.now(), safeThresholdMs: 60 * 60 * 1000, baseDelayMs: 1 },
      );

      expect(result.streamComplete).toBe(true);
      expect(findAppointmentIdPairsByChapterMock).toHaveBeenCalledTimes(2);
    });

    test('escapes when a rate-limited read retry would exceed the safe threshold, with no unwritten id pairs', async () => {
      const findAppointmentIdPairsByChapterMock = vi
        .fn()
        .mockRejectedValue(new TooManyRequestsError('TEST'));
      mockRepository({ findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock });

      const result = await FixChapter7AppointmentsUseCase.runReaderLoop(
        context,
        '7A',
        'rename',
        '7',
        1000,
        { startedAt: Date.now(), safeThresholdMs: 1000, baseDelayMs: 30_000 },
      );

      expect(result.streamComplete).toBe(false);
      expect(result.unwrittenIdPairs).toEqual([]);
      expect(result.recommendedVisibilitySeconds).toBeGreaterThan(0);
    });

    test('escapes when a rate-limited write retry would exceed the safe threshold, returning the batch as unwrittenIdPairs', async () => {
      const findAppointmentIdPairsByChapterMock = vi.fn().mockResolvedValueOnce(idPairs);
      const applyChapterFixMock = vi.fn().mockRejectedValue(new TooManyRequestsError('TEST'));
      mockRepository({
        findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock,
        applyChapterFix: applyChapterFixMock,
      });

      const result = await FixChapter7AppointmentsUseCase.runReaderLoop(
        context,
        '7A',
        'rename',
        '7',
        1000,
        { startedAt: Date.now(), safeThresholdMs: 1000, baseDelayMs: 30_000 },
      );

      expect(result.streamComplete).toBe(false);
      expect(result.unwrittenIdPairs).toEqual(idPairs);
      expect(result.totalModified).toBe(0);
      expect(result.recommendedVisibilitySeconds).toBeGreaterThan(0);
    });

    test('propagates a non-rate-limit read error without escaping or catching it', async () => {
      const findAppointmentIdPairsByChapterMock = vi
        .fn()
        .mockRejectedValue(new Error('mongo connection failed'));
      mockRepository({ findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock });

      await expect(
        FixChapter7AppointmentsUseCase.runReaderLoop(context, '7A', 'rename', '7', 1000),
      ).rejects.toThrow('mongo connection failed');
    });

    test('propagates a non-rate-limit write error without escaping or catching it', async () => {
      const findAppointmentIdPairsByChapterMock = vi.fn().mockResolvedValueOnce(idPairs);
      const applyChapterFixMock = vi.fn().mockRejectedValue(new Error('mongo write failed'));
      mockRepository({
        findAppointmentIdPairsByChapter: findAppointmentIdPairsByChapterMock,
        applyChapterFix: applyChapterFixMock,
      });

      await expect(
        FixChapter7AppointmentsUseCase.runReaderLoop(context, '7A', 'rename', '7', 1000),
      ).rejects.toThrow('mongo write failed');
    });
  });
});
