import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeUpcomingReportDatesRepository } from '../gateways.types';
import {
  DATE_FIELDS,
  TEXT_FIELDS,
  TrusteeUpcomingReportDates,
  TrusteeUpcomingReportDatesHistory,
  TrusteeUpcomingReportDatesInput,
} from '@common/cams/trustee-upcoming-report-dates';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

function buildFields(input: TrusteeUpcomingReportDatesInput): Partial<TrusteeUpcomingReportDates> {
  const fields: Partial<TrusteeUpcomingReportDates> = {};
  for (const field of [...DATE_FIELDS, ...TEXT_FIELDS]) {
    if (input[field] !== null) {
      (fields as Record<string, string>)[field] = input[field]!;
    }
  }
  return fields;
}

function diffFields(
  existing: TrusteeUpcomingReportDates | null,
  input: TrusteeUpcomingReportDatesInput,
): { before: Partial<TrusteeUpcomingReportDates>; after: Partial<TrusteeUpcomingReportDates> } {
  const before: Partial<TrusteeUpcomingReportDates> = {};
  const after: Partial<TrusteeUpcomingReportDates> = {};
  for (const field of [...DATE_FIELDS, ...TEXT_FIELDS]) {
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
  return { before, after };
}

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
          ...buildFields(input),
        },
        user,
      ),
      id,
    };

    await this.repository.upsert(newDoc);

    const { before, after } = diffFields(existing, input);

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
