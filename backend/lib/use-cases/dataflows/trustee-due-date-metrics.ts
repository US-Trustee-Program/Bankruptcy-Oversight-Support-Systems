import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeUpcomingKeyDates } from '@common/cams/trustee-upcoming-key-dates';

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
  pastIndependentAuditPercent: number;
  tirReviewPeriodPercent: number;
  // Calculated fields
  tprDueDatePercent: number;
  upcomingFieldExamPercent: number;
  upcomingIndependentAuditRequiredPercent: number;
  tirSubmissionPercent: number;
  tirReviewDueDatePercent: number;
};

function countFields(doc: TrusteeUpcomingKeyDates): number {
  let count = 0;
  if (doc.tprReviewPeriodStart && doc.tprReviewPeriodEnd) count++;
  if (doc.pastFieldExam) count++;
  if (doc.pastAudit) count++;
  if (doc.tirReviewPeriodStart && doc.tirReviewPeriodEnd) count++;
  if (doc.tprDue) count++;
  if (doc.upcomingFieldExam) count++;
  if (doc.upcomingIndependentAuditRequired) count++;
  if (doc.tirSubmission) count++;
  if (doc.tirReview) count++;
  return count;
}

const TOTAL_FIELDS = 9;

export class TrusteeDueDateMetricsUseCase {
  public async gatherMetrics(context: ApplicationContext): Promise<TrusteeDueDateMetrics> {
    const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);
    const keyDatesRepo = factory.getTrusteeUpcomingKeyDatesRepository(context);
    try {
      const [appointments, keyDatesDocs] = await Promise.all([
        appointmentsRepo.listAllChapter7Appointments(),
        keyDatesRepo.listAll(),
      ]);

      const keyDatesMap = new Map<string, TrusteeUpcomingKeyDates>(
        keyDatesDocs.map((doc) => [doc.appointmentId, doc]),
      );

      const total = appointments.length;
      let completeCount = 0;
      let partialCount = 0;
      let noneCount = 0;

      let tprReviewPeriodCount = 0;
      let pastFieldExamCount = 0;
      let pastIndependentAuditCount = 0;
      let tirReviewPeriodCount = 0;
      let tprDueDateCount = 0;
      let upcomingFieldExamCount = 0;
      let upcomingIndependentAuditRequiredCount = 0;
      let tirSubmissionCount = 0;
      let tirReviewDueDateCount = 0;

      for (const appointment of appointments) {
        const doc = keyDatesMap.get(appointment.id);

        if (!doc) {
          noneCount++;
          continue;
        }

        const fieldCount = countFields(doc);

        if (fieldCount === TOTAL_FIELDS) {
          completeCount++;
        } else if (fieldCount > 0) {
          partialCount++;
        } else {
          noneCount++;
        }

        if (doc.tprReviewPeriodStart && doc.tprReviewPeriodEnd) tprReviewPeriodCount++;
        if (doc.pastFieldExam) pastFieldExamCount++;
        if (doc.pastAudit) pastIndependentAuditCount++;
        if (doc.tirReviewPeriodStart && doc.tirReviewPeriodEnd) tirReviewPeriodCount++;
        if (doc.tprDue) tprDueDateCount++;
        if (doc.upcomingFieldExam) upcomingFieldExamCount++;
        if (doc.upcomingIndependentAuditRequired) upcomingIndependentAuditRequiredCount++;
        if (doc.tirSubmission) tirSubmissionCount++;
        if (doc.tirReview) tirReviewDueDateCount++;
      }

      return {
        totalChapter7Appointments: total,
        completeCount,
        partialCount,
        noneCount,
        completePercent: toPercent(completeCount, total),
        partialPercent: toPercent(partialCount, total),
        nonePercent: toPercent(noneCount, total),
        tprReviewPeriodPercent: toPercent(tprReviewPeriodCount, total),
        pastFieldExamPercent: toPercent(pastFieldExamCount, total),
        pastIndependentAuditPercent: toPercent(pastIndependentAuditCount, total),
        tirReviewPeriodPercent: toPercent(tirReviewPeriodCount, total),
        tprDueDatePercent: toPercent(tprDueDateCount, total),
        upcomingFieldExamPercent: toPercent(upcomingFieldExamCount, total),
        upcomingIndependentAuditRequiredPercent: toPercent(
          upcomingIndependentAuditRequiredCount,
          total,
        ),
        tirSubmissionPercent: toPercent(tirSubmissionCount, total),
        tirReviewDueDatePercent: toPercent(tirReviewDueDateCount, total),
      };
    } finally {
      appointmentsRepo.release();
      keyDatesRepo.release();
    }
  }
}
