import { vi } from 'vitest';
import MockData from '@common/cams/test-utilities/mock-data';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeNotesMetricsUseCase } from './trustee-notes-metrics';
import factory from '../../factory';
import { TrusteeNotesRepository } from '../gateways.types';

describe('TrusteeNotesMetricsUseCase', () => {
  let context: ApplicationContext;
  let mockRepo: Partial<TrusteeNotesRepository>;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    mockRepo = {
      getNotesSince: vi.fn(),
      release: vi.fn(),
    };
    vi.spyOn(factory, 'getTrusteeNotesRepository').mockReturnValue(
      mockRepo as TrusteeNotesRepository,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should compute metrics from notes in the last 24 hours', async () => {
    const trusteeId1 = 'trustee-1';
    const trusteeId2 = 'trustee-2';
    const authorId1 = 'author-1';
    const authorId2 = 'author-2';

    const notes = [
      MockData.getTrusteeNote({
        trusteeId: trusteeId1,
        createdBy: { id: authorId1, name: 'Author One' },
      }),
      MockData.getTrusteeNote({
        trusteeId: trusteeId1,
        createdBy: { id: authorId1, name: 'Author One' },
      }),
      MockData.getTrusteeNote({
        trusteeId: trusteeId2,
        createdBy: { id: authorId2, name: 'Author Two' },
      }),
    ];

    vi.mocked(mockRepo.getNotesSince).mockResolvedValue(notes);

    const useCase = new TrusteeNotesMetricsUseCase();
    const metrics = await useCase.gatherMetrics(context);

    expect(metrics.notesLast24Hrs).toBe(3);
    expect(metrics.trusteesWithNotes).toBe(2);
    expect(metrics.uniqueNoteAuthors).toBe(2);
    expect(metrics.notesPerTrustee).toEqual([
      { trusteeId: trusteeId1, noteCount: 2 },
      { trusteeId: trusteeId2, noteCount: 1 },
    ]);
    expect(mockRepo.getNotesSince).toHaveBeenCalledTimes(1);
    expect(mockRepo.release).toHaveBeenCalled();
  });

  test('should return all-zero metrics when no notes exist in last 24 hours', async () => {
    vi.mocked(mockRepo.getNotesSince).mockResolvedValue([]);

    const useCase = new TrusteeNotesMetricsUseCase();
    const metrics = await useCase.gatherMetrics(context);

    expect(metrics.notesLast24Hrs).toBe(0);
    expect(metrics.trusteesWithNotes).toBe(0);
    expect(metrics.uniqueNoteAuthors).toBe(0);
    expect(metrics.notesPerTrustee).toEqual([]);
    expect(mockRepo.release).toHaveBeenCalled();
  });

  test('should propagate repository errors', async () => {
    const error = new Error('DB connection failed');
    vi.mocked(mockRepo.getNotesSince).mockRejectedValue(error);

    const useCase = new TrusteeNotesMetricsUseCase();
    await expect(useCase.gatherMetrics(context)).rejects.toThrow('DB connection failed');
  });
});
