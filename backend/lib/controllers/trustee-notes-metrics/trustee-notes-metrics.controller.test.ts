import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeNotesMetricsController } from './trustee-notes-metrics.controller';
import { TrusteeNotesMetricsUseCase } from '../../use-cases/dataflows/trustee-notes-metrics';
import { UnknownError } from '../../common-errors/unknown-error';

describe('TrusteeNotesMetricsController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return metrics when handleTimer is called successfully', async () => {
    const metrics = {
      notesLast24Hrs: 5,
      trusteesWithNotes: 3,
      notesPerTrustee: [{ trusteeId: 'trustee-1', noteCount: 3 }],
      uniqueNoteAuthors: 2,
    };
    vi.spyOn(TrusteeNotesMetricsUseCase.prototype, 'gatherMetrics').mockResolvedValue(metrics);

    const controller = new TrusteeNotesMetricsController();
    await expect(controller.handleTimer(context)).resolves.toEqual(metrics);
  });

  test('should throw error when handleTimer throws', async () => {
    const error = new UnknownError('TEST_MODULE');
    vi.spyOn(TrusteeNotesMetricsUseCase.prototype, 'gatherMetrics').mockRejectedValue(error);

    const controller = new TrusteeNotesMetricsController();
    await expect(controller.handleTimer(context)).rejects.toThrow(error);
  });
});
