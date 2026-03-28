import { vi } from 'vitest';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeDueDateMetricsUseCase } from './trustee-due-date-metrics';
import factory from '../../factory';
import { TrusteeAppointmentsRepository, TrusteeDueDateMetricsAggregation } from '../gateways.types';

describe('TrusteeDueDateMetricsUseCase', () => {
  let context: ApplicationContext;
  let mockAppointmentsRepo: Partial<TrusteeAppointmentsRepository>;

  beforeEach(async () => {
    context = await createMockApplicationContext();

    mockAppointmentsRepo = {
      getChapter7DueDateMetricsAggregation: vi.fn(),
      release: vi.fn(),
    };

    vi.spyOn(factory, 'getTrusteeAppointmentsRepository').mockReturnValue(
      mockAppointmentsRepo as TrusteeAppointmentsRepository,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return all zeros when no appointments exist', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 0,
      completeCount: 0,
      partialCount: 0,
      noneCount: 0,
      tprReviewPeriodCount: 0,
      pastFieldExamCount: 0,
      pastIndependentAuditCount: 0,
      tirReviewPeriodCount: 0,
      tprDueDateCount: 0,
      upcomingFieldExamCount: 0,
      upcomingIndependentAuditRequiredCount: 0,
      tirSubmissionCount: 0,
      tirReviewDueDateCount: 0,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.totalChapter7Appointments).toBe(0);
    expect(metrics.completeCount).toBe(0);
    expect(metrics.partialCount).toBe(0);
    expect(metrics.noneCount).toBe(0);
    expect(metrics.completePercent).toBe(0);
    expect(metrics.partialPercent).toBe(0);
    expect(metrics.nonePercent).toBe(0);
    expect(metrics.tprReviewPeriodPercent).toBe(0);
    expect(metrics.pastFieldExamPercent).toBe(0);
    expect(metrics.pastIndependentAuditPercent).toBe(0);
    expect(metrics.tirReviewPeriodPercent).toBe(0);
    expect(metrics.tprDueDatePercent).toBe(0);
    expect(metrics.upcomingFieldExamPercent).toBe(0);
    expect(metrics.upcomingIndependentAuditRequiredPercent).toBe(0);
    expect(metrics.tirSubmissionPercent).toBe(0);
    expect(metrics.tirReviewDueDatePercent).toBe(0);
  });

  test('should calculate percentages correctly for complete appointments', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 4,
      completeCount: 2,
      partialCount: 1,
      noneCount: 1,
      tprReviewPeriodCount: 2,
      pastFieldExamCount: 3,
      pastIndependentAuditCount: 2,
      tirReviewPeriodCount: 2,
      tprDueDateCount: 3,
      upcomingFieldExamCount: 2,
      upcomingIndependentAuditRequiredCount: 2,
      tirSubmissionCount: 2,
      tirReviewDueDateCount: 2,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.totalChapter7Appointments).toBe(4);
    expect(metrics.completeCount).toBe(2);
    expect(metrics.partialCount).toBe(1);
    expect(metrics.noneCount).toBe(1);
    expect(metrics.completePercent).toBe(50); // 2/4 = 50%
    expect(metrics.partialPercent).toBe(25); // 1/4 = 25%
    expect(metrics.nonePercent).toBe(25); // 1/4 = 25%
    expect(metrics.pastFieldExamPercent).toBe(75); // 3/4 = 75%
    expect(metrics.tprReviewPeriodPercent).toBe(50); // 2/4 = 50%
    expect(metrics.tprDueDatePercent).toBe(75); // 3/4 = 75%
  });

  test('should handle 100% complete appointments', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 1,
      completeCount: 1,
      partialCount: 0,
      noneCount: 0,
      tprReviewPeriodCount: 1,
      pastFieldExamCount: 1,
      pastIndependentAuditCount: 1,
      tirReviewPeriodCount: 1,
      tprDueDateCount: 1,
      upcomingFieldExamCount: 1,
      upcomingIndependentAuditRequiredCount: 1,
      tirSubmissionCount: 1,
      tirReviewDueDateCount: 1,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.completePercent).toBe(100);
    expect(metrics.partialPercent).toBe(0);
    expect(metrics.nonePercent).toBe(0);
    expect(metrics.tprReviewPeriodPercent).toBe(100);
    expect(metrics.pastFieldExamPercent).toBe(100);
  });

  test('should handle 100% none appointments', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 1,
      completeCount: 0,
      partialCount: 0,
      noneCount: 1,
      tprReviewPeriodCount: 0,
      pastFieldExamCount: 0,
      pastIndependentAuditCount: 0,
      tirReviewPeriodCount: 0,
      tprDueDateCount: 0,
      upcomingFieldExamCount: 0,
      upcomingIndependentAuditRequiredCount: 0,
      tirSubmissionCount: 0,
      tirReviewDueDateCount: 0,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.nonePercent).toBe(100);
    expect(metrics.completePercent).toBe(0);
    expect(metrics.partialPercent).toBe(0);
  });

  test('should round percentages correctly', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 3,
      completeCount: 1,
      partialCount: 0,
      noneCount: 2,
      tprReviewPeriodCount: 1,
      pastFieldExamCount: 1,
      pastIndependentAuditCount: 1,
      tirReviewPeriodCount: 1,
      tprDueDateCount: 1,
      upcomingFieldExamCount: 1,
      upcomingIndependentAuditRequiredCount: 1,
      tirSubmissionCount: 1,
      tirReviewDueDateCount: 1,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    // 1/3 = 0.333... → rounds to 33%
    expect(metrics.completePercent).toBe(33);
    expect(metrics.tprReviewPeriodPercent).toBe(33);
    // 2/3 = 0.666... → rounds to 67%
    expect(metrics.nonePercent).toBe(67);
  });

  test('should calculate field-specific percentages independently', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 10,
      completeCount: 2,
      partialCount: 5,
      noneCount: 3,
      tprReviewPeriodCount: 7, // 70%
      pastFieldExamCount: 5, // 50%
      pastIndependentAuditCount: 3, // 30%
      tirReviewPeriodCount: 8, // 80%
      tprDueDateCount: 6, // 60%
      upcomingFieldExamCount: 4, // 40%
      upcomingIndependentAuditRequiredCount: 2, // 20%
      tirSubmissionCount: 9, // 90%
      tirReviewDueDateCount: 1, // 10%
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    const metrics = await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(metrics.tprReviewPeriodPercent).toBe(70);
    expect(metrics.pastFieldExamPercent).toBe(50);
    expect(metrics.pastIndependentAuditPercent).toBe(30);
    expect(metrics.tirReviewPeriodPercent).toBe(80);
    expect(metrics.tprDueDatePercent).toBe(60);
    expect(metrics.upcomingFieldExamPercent).toBe(40);
    expect(metrics.upcomingIndependentAuditRequiredPercent).toBe(20);
    expect(metrics.tirSubmissionPercent).toBe(90);
    expect(metrics.tirReviewDueDatePercent).toBe(10);
  });

  test('should release repository after use', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 0,
      completeCount: 0,
      partialCount: 0,
      noneCount: 0,
      tprReviewPeriodCount: 0,
      pastFieldExamCount: 0,
      pastIndependentAuditCount: 0,
      tirReviewPeriodCount: 0,
      tprDueDateCount: 0,
      upcomingFieldExamCount: 0,
      upcomingIndependentAuditRequiredCount: 0,
      tirSubmissionCount: 0,
      tirReviewDueDateCount: 0,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(mockAppointmentsRepo.release).toHaveBeenCalledTimes(1);
  });

  test('should call aggregation method once', async () => {
    const aggregation: TrusteeDueDateMetricsAggregation = {
      totalChapter7Appointments: 5,
      completeCount: 2,
      partialCount: 2,
      noneCount: 1,
      tprReviewPeriodCount: 3,
      pastFieldExamCount: 4,
      pastIndependentAuditCount: 2,
      tirReviewPeriodCount: 3,
      tprDueDateCount: 4,
      upcomingFieldExamCount: 3,
      upcomingIndependentAuditRequiredCount: 2,
      tirSubmissionCount: 3,
      tirReviewDueDateCount: 3,
    };

    vi.mocked(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).mockResolvedValue(
      aggregation,
    );

    await new TrusteeDueDateMetricsUseCase().gatherMetrics(context);

    expect(mockAppointmentsRepo.getChapter7DueDateMetricsAggregation).toHaveBeenCalledTimes(1);
  });
});
