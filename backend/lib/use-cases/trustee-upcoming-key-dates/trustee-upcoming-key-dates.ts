import { ApplicationContext } from '../../adapters/types/basic';
import factory from '../../factory';
import { TrusteeUpcomingKeyDatesRepository } from '../gateways.types';
import {
  DATE_FIELDS,
  TEXT_FIELDS,
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesHistory,
  TrusteeUpcomingKeyDatesInput,
} from '@common/cams/trustee-upcoming-key-dates';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '@common/cams/creatable';

function buildFields(input: TrusteeUpcomingKeyDatesInput): Partial<TrusteeUpcomingKeyDates> {
  const fields: Partial<TrusteeUpcomingKeyDates> = {};
  for (const field of [...DATE_FIELDS, ...TEXT_FIELDS]) {
    if (input[field] !== null) {
      (fields as Record<string, string>)[field] = input[field]!;
    }
  }
  return fields;
}

function diffFields(
  existing: TrusteeUpcomingKeyDates | null,
  input: TrusteeUpcomingKeyDatesInput,
): { before: Partial<TrusteeUpcomingKeyDates>; after: Partial<TrusteeUpcomingKeyDates> } {
  const before: Partial<TrusteeUpcomingKeyDates> = {};
  const after: Partial<TrusteeUpcomingKeyDates> = {};
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

export class TrusteeUpcomingKeyDatesUseCase {
  private repository: TrusteeUpcomingKeyDatesRepository;

  constructor(context: ApplicationContext) {
    this.repository = factory.getTrusteeUpcomingKeyDatesRepository(context);
  }

  public async getUpcomingKeyDates(appointmentId: string): Promise<TrusteeUpcomingKeyDates | null> {
    return this.repository.getByAppointmentId(appointmentId);
  }

  public async upsertUpcomingKeyDates(
    trusteeId: string,
    appointmentId: string,
    input: TrusteeUpcomingKeyDatesInput,
    user: CamsUserReference,
  ): Promise<void> {
    const existing = await this.repository.getByAppointmentId(appointmentId);
    const id = existing?.id ?? crypto.randomUUID();

    const newDoc: TrusteeUpcomingKeyDates = {
      ...createAuditRecord<TrusteeUpcomingKeyDates>(
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
      const history = createAuditRecord<Creatable<TrusteeUpcomingKeyDatesHistory>>(
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
