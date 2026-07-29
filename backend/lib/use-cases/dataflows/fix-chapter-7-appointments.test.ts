import { describe, test, expect, vi, beforeAll, beforeEach } from 'vitest';
import { ApplicationContext } from '../../adapters/types/basic';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import FixChapter7AppointmentsUseCase from './fix-chapter-7-appointments';
import { MockMongoRepository } from '../../testing/mock-gateways/mock-mongo.repository';
import factory from '../../factory';

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
});
