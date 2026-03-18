import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeUpcomingReportDatesRepository } from '../gateways.types';
import {
  TrusteeUpcomingReportDates,
  TrusteeUpcomingReportDatesHistory,
  TrusteeUpcomingReportDatesInput,
} from '@common/cams/trustee-upcoming-report-dates';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

type DateField =
  | 'fieldExam'
  | 'audit'
  | 'tprReviewPeriodStart'
  | 'tprReviewPeriodEnd'
  | 'tprDue'
  | 'tirReviewPeriodStart'
  | 'tirReviewPeriodEnd'
  | 'tirSubmission'
  | 'tirReview';

const DATE_FIELDS: DateField[] = [
  'fieldExam',
  'audit',
  'tprReviewPeriodStart',
  'tprReviewPeriodEnd',
  'tprDue',
  'tirReviewPeriodStart',
  'tirReviewPeriodEnd',
  'tirSubmission',
  'tirReview',
];

export class TrusteeUpcomingReportDatesUseCase {
  private repository: TrusteeUpcomingReportDatesRepository;

  constructor(context: ApplicationContext) {
    this.repository = factory.getTrusteeUpcomingReportDatesRepository(context);
  }

  public async getUpcomingReportDates(
    appointmentId: string,
  ): Promise<TrusteeUpcomingReportDates | null> {
    return this.repository.getByAppointmentId(appointmentId);
  }

  public async upsertUpcomingReportDates(
    trusteeId: string,
    appointmentId: string,
    input: TrusteeUpcomingReportDatesInput,
    user: CamsUserReference,
  ): Promise<void> {
    const existing = await this.repository.getByAppointmentId(appointmentId);
    const id = existing?.id ?? crypto.randomUUID();

    const newDoc: TrusteeUpcomingReportDates = {
      ...createAuditRecord<TrusteeUpcomingReportDates>(
        {
          documentType: 'TRUSTEE_UPCOMING_REPORT_DATES',
          trusteeId,
          appointmentId,
          ...(input.fieldExam !== null ? { fieldExam: input.fieldExam } : {}),
          ...(input.audit !== null ? { audit: input.audit } : {}),
          ...(input.tprReviewPeriodStart !== null
            ? { tprReviewPeriodStart: input.tprReviewPeriodStart }
            : {}),
          ...(input.tprReviewPeriodEnd !== null
            ? { tprReviewPeriodEnd: input.tprReviewPeriodEnd }
            : {}),
          ...(input.tprDue !== null ? { tprDue: input.tprDue } : {}),
          ...(input.tirReviewPeriodStart !== null
            ? { tirReviewPeriodStart: input.tirReviewPeriodStart }
            : {}),
          ...(input.tirReviewPeriodEnd !== null
            ? { tirReviewPeriodEnd: input.tirReviewPeriodEnd }
            : {}),
          ...(input.tirSubmission !== null ? { tirSubmission: input.tirSubmission } : {}),
          ...(input.tirReview !== null ? { tirReview: input.tirReview } : {}),
        },
        user,
      ),
      id,
    };

    await this.repository.upsert(newDoc);

    const before: Partial<TrusteeUpcomingReportDates> = {};
    const after: Partial<TrusteeUpcomingReportDates> = {};

    for (const field of DATE_FIELDS) {
      const existingValue = (existing?.[field] as string | undefined) ?? null;
      const incomingValue = input[field] ?? null;
      if (existingValue !== incomingValue) {
        if (existingValue !== null) {
          (before as Record<string, string>)[field] = existingValue;
        }
        if (incomingValue !== null) {
          (after as Record<string, string>)[field] = incomingValue;
        }
      }
    }

    if (Object.keys(before).length > 0 || Object.keys(after).length > 0) {
      const history = createAuditRecord<Creatable<TrusteeUpcomingReportDatesHistory>>(
        {
          documentType: 'AUDIT_UPCOMING_REPORT_DATES',
          trusteeId,
          appointmentId,
          before,
          after,
        },
        user,
      );
      await this.repository.createHistory(history);
    }
  }
}
