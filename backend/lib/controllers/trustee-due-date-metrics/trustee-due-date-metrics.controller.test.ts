import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeDueDateMetricsController } from './trustee-due-date-metrics.controller';
import {
  TrusteeDueDateMetrics,
  TrusteeDueDateMetricsUseCase,
} from '../../use-cases/dataflows/trustee-due-date-metrics';
import { UnknownError } from '../../common-errors/unknown-error';

const MOCK_METRICS: TrusteeDueDateMetrics = {
  totalChapter7Appointments: 10,
  completeCount: 5,
  partialCount: 3,
  noneCount: 2,
  completePercent: 50,
  partialPercent: 30,
  nonePercent: 20,
  tprReviewPeriodPercent: 60,
  pastFieldExamPercent: 70,
  pastIndependentAuditPercent: 40,
  tirReviewPeriodPercent: 50,
  tprDueDatePercent: 80,
  upcomingFieldExamPercent: 60,
  upcomingIndependentAuditRequiredPercent: 50,
  tirSubmissionPercent: 70,
  tirReviewDueDatePercent: 65,
};

describe('TrusteeDueDateMetricsController', () => {
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should delegate to use case and return metrics on success', async () => {
    vi.spyOn(TrusteeDueDateMetricsUseCase.prototype, 'gatherMetrics').mockResolvedValue(
      MOCK_METRICS,
    );

    const controller = new TrusteeDueDateMetricsController();
    await expect(controller.handleTimer(context)).resolves.toEqual(MOCK_METRICS);
  });

  test('should wrap and rethrow errors from use case', async () => {
    const error = new UnknownError('TEST_MODULE');
    vi.spyOn(TrusteeDueDateMetricsUseCase.prototype, 'gatherMetrics').mockRejectedValue(error);

    const controller = new TrusteeDueDateMetricsController();
    await expect(controller.handleTimer(context)).rejects.toThrow(error);
  });
});
