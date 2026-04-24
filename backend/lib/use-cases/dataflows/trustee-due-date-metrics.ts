import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';

function toPercent(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

export type TrusteeDueDateMetrics = {
  totalChapter7Appointments: number;
  completeCount: number;
  partialCount: number;
  noneCount: number;
  completePercent: number;
  partialPercent: number;
  nonePercent: number;
  // Manual entry fields
  tprReviewPeriodPercent: number;
  pastFieldExamPercent: number;
  pastAuditPercent: number;
  tirReviewPeriodPercent: number;
  lastAuditFiscalYearPercent: number;
  tirFrequencyPercent: number;
  // Calculated fields
  tprDueDatePercent: number;
  upcomingExamOrAuditYearPercent: number;
  tirSubmissionPercent: number;
  tirReviewDueDatePercent: number;
};

export class TrusteeDueDateMetricsUseCase {
  public async gatherMetrics(context: ApplicationContext): Promise<TrusteeDueDateMetrics> {
    const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
    try {
      // Single aggregation call returns all counts
      const aggregation = await appointmentsRepo.getChapter7DueDateMetricsAggregation();

      const total = aggregation.totalChapter7Appointments;

      // Calculate percentages from counts
      return {
        totalChapter7Appointments: total,
        completeCount: aggregation.completeCount,
        partialCount: aggregation.partialCount,
        noneCount: aggregation.noneCount,
        completePercent: toPercent(aggregation.completeCount, total),
        partialPercent: toPercent(aggregation.partialCount, total),
        nonePercent: toPercent(aggregation.noneCount, total),
        tprReviewPeriodPercent: toPercent(aggregation.tprReviewPeriodCount, total),
        pastFieldExamPercent: toPercent(aggregation.pastFieldExamCount, total),
        pastAuditPercent: toPercent(aggregation.pastAuditCount, total),
        tirReviewPeriodPercent: toPercent(aggregation.tirReviewPeriodCount, total),
        lastAuditFiscalYearPercent: toPercent(aggregation.lastAuditFiscalYearCount, total),
        tirFrequencyPercent: toPercent(aggregation.tirFrequencyCount, total),
        tprDueDatePercent: toPercent(aggregation.tprDueDateCount, total),
        upcomingExamOrAuditYearPercent: toPercent(aggregation.upcomingExamOrAuditYearCount, total),
        tirSubmissionPercent: toPercent(aggregation.tirSubmissionCount, total),
        tirReviewDueDatePercent: toPercent(aggregation.tirReviewDueDateCount, total),
      };
    } finally {
      appointmentsRepo.release();
    }
  }
}
