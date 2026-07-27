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

  describe('readIds', () => {
    test('delegates to repository.findIdsByChapter with the same arguments', async () => {
      const findIdsByChapterMock = vi.fn().mockResolvedValue(['id-1', 'id-2']);
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findIdsByChapter: findIdsByChapterMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      const result = await FixChapter7AppointmentsUseCase.readIds(
        context,
        'case-trustee-appointments',
        '7A',
        10000,
      );

      expect(result).toEqual(['id-1', 'id-2']);
      expect(findIdsByChapterMock).toHaveBeenCalledWith('case-trustee-appointments', '7A', 10000);
    });

    test('returns an empty array when the repository finds nothing', async () => {
      const findIdsByChapterMock = vi.fn().mockResolvedValue([]);
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findIdsByChapter: findIdsByChapterMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      const result = await FixChapter7AppointmentsUseCase.readIds(
        context,
        'trustee-case-appointments',
        'AC',
        10000,
      );

      expect(result).toEqual([]);
    });

    test('propagates errors thrown by the repository', async () => {
      const findIdsByChapterMock = vi.fn().mockRejectedValue(new Error('mongo read failed'));
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          findIdsByChapter: findIdsByChapterMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      await expect(
        FixChapter7AppointmentsUseCase.readIds(context, 'case-trustee-appointments', '7A', 10000),
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
        'case-trustee-appointments',
        ['id-1', 'id-2'],
        'rename',
        '7A',
        '7',
      );

      expect(result).toEqual({ modifiedCount: 2 });
      expect(applyChapterFixMock).toHaveBeenCalledWith(
        'case-trustee-appointments',
        ['id-1', 'id-2'],
        'rename',
        '7A',
        '7',
      );
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
        'trustee-case-appointments',
        ['id-1'],
        'delete',
        'AC',
      );

      expect(result).toEqual({ modifiedCount: 1 });
      expect(applyChapterFixMock).toHaveBeenCalledWith(
        'trustee-case-appointments',
        ['id-1'],
        'delete',
        'AC',
        undefined,
      );
    });

    test('propagates errors thrown by the repository', async () => {
      const applyChapterFixMock = vi.fn().mockRejectedValue(new Error('mongo write failed'));
      vi.spyOn(factory, 'getTrusteeCaseAppointmentsRepository').mockReturnValue(
        Object.assign(new MockMongoRepository(), {
          applyChapterFix: applyChapterFixMock,
        }) as unknown as ReturnType<typeof factory.getTrusteeCaseAppointmentsRepository>,
      );

      await expect(
        FixChapter7AppointmentsUseCase.applyFix(
          context,
          'case-trustee-appointments',
          ['id-1'],
          'rename',
          '7A',
          '7',
        ),
      ).rejects.toThrow('mongo write failed');
    });
  });
});
