import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSourceName,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import factory from '../../factory';

/** One page of events for a single change date, paged by id within that date. */
export type TrusteeAppointmentSourcePage = {
  events: TrusteeAppointmentSyncEvent[];
  /** Greatest id on this page; pass it back as lastId to fetch the next page. Absent when no more pages. */
  lastId?: string;
};

/**
 * A legacy system the trustee-appointment sync reads case appointments from. Reads are scoped to
 * one region and one change date at a time, paged by id within the date.
 */
export interface TrusteeAppointmentSource {
  readonly name: TrusteeAppointmentSourceName;

  /** Most recent change date (ISO) in the source for the region, or undefined when it has no rows. */
  getLatestChangeDate(context: ApplicationContext, regionId: string): Promise<string | undefined>;

  /** Events changed on changeDate (ISO date) for the region, after lastId when given. */
  getEventsForDate(
    context: ApplicationContext,
    regionId: string,
    changeDate: string,
    lastId?: string,
  ): Promise<TrusteeAppointmentSourcePage>;
}

/**
 * DXTR implementation, wrapping the existing transaction-date reads on the cases gateway.
 *
 * Non-functional stub: it exists to keep the interface honest against the existing DXTR read and
 * is not wired into the dataflow until GitHub #3191. DXTR reads are keyed by transaction start
 * date across all regions, so regionId is ignored, there is no id paging (every call returns the
 * complete result), and getLatestChangeDate is not supported.
 */
export class DxtrTrusteeAppointmentSource implements TrusteeAppointmentSource {
  readonly name = 'DXTR' as const;

  async getLatestChangeDate(): Promise<string | undefined> {
    throw new Error('DxtrTrusteeAppointmentSource.getLatestChangeDate is not supported');
  }

  async getEventsForDate(
    context: ApplicationContext,
    _regionId: string,
    changeDate: string,
  ): Promise<TrusteeAppointmentSourcePage> {
    const casesGateway = factory.getCasesGateway(context);
    const [appointments, petitions] = await Promise.all([
      casesGateway.getTrusteeAppointments(context, changeDate),
      casesGateway.getTrusteePetitionEvents(context, changeDate),
    ]);
    return { events: [...appointments.events, ...petitions.events] };
  }
}
