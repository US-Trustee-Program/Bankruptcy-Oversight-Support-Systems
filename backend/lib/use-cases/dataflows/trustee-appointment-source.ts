import { ApplicationContext } from '../../adapters/types/basic';
import {
  TrusteeAppointmentSourceName,
  TrusteeAppointmentSyncEvent,
} from '@common/cams/dataflow-events';
import { UstpOfficeDetails } from '@common/cams/offices';
import factory from '../../factory';
import { AcmsCaseAppointmentRawRecord, formatCaseId } from '../gateways.types';
import { rawToTrusteeAppointmentSyncEvent } from './acms-case-appointment.helpers';
import { DEFAULT_FETCH_SIZE } from './migrate-case-appointments-constants';

/** A source row that could not be converted to an event. Its siblings on the same page still convert. */
export type TrusteeAppointmentSourceRowFailure = {
  rowId: number;
  caseId: string;
  reason: string;
};

/** One page of events for a single change date, paged by id within that date. */
export type TrusteeAppointmentSourcePage = {
  events: TrusteeAppointmentSyncEvent[];
  failures: TrusteeAppointmentSourceRowFailure[];
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
    return { events: [...appointments.events, ...petitions.events], failures: [] };
  }
}

/** ACMS division code (CMMAP.CASE_DIV, zero-padded to 3 digits) -> DXTR courtId. */
function buildDivisionCodeToCourtIdMap(offices: UstpOfficeDetails[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const office of offices) {
    for (const group of office.groups) {
      for (const division of group.divisions) {
        map.set(division.divisionCode, division.court.courtId);
      }
    }
  }
  return map;
}

/**
 * ACMS implementation, reading CMMAP (joined to CMMDB/CMMPR) per region and change date, paged by
 * CMMAP id. ACMS has no COURT_ID column (see acms.gateway.ts), so courtId is resolved per row from
 * the offices graph via its ACMS division code (CASE_DIV) -- not always numerically identical to
 * the matching DXTR division code for the same real-world division.
 */
export class AcmsTrusteeAppointmentSource implements TrusteeAppointmentSource {
  readonly name = 'ACMS' as const;

  async getLatestChangeDate(
    context: ApplicationContext,
    regionId: string,
  ): Promise<string | undefined> {
    const acmsGateway = factory.getAcmsGateway(context);
    return acmsGateway.getLatestCmmapChangeDateForRegion(context, regionId);
  }

  async getEventsForDate(
    context: ApplicationContext,
    regionId: string,
    changeDate: string,
    lastId?: string,
  ): Promise<TrusteeAppointmentSourcePage> {
    const acmsGateway = factory.getAcmsGateway(context);
    const rawRecords = await acmsGateway.getCmmapAppointmentsRaw(
      context,
      lastId ? Number(lastId) : 0,
      DEFAULT_FETCH_SIZE,
      null,
      regionId,
      changeDate,
    );

    if (rawRecords.length === 0) {
      return { events: [], failures: [] };
    }

    const officesGateway = factory.getOfficesGateway(context);
    const offices = await officesGateway.getOffices(context);
    const divisionCodeToCourtId = buildDivisionCodeToCourtIdMap(offices);

    const events: TrusteeAppointmentSyncEvent[] = [];
    const failures: TrusteeAppointmentSourceRowFailure[] = [];
    for (const raw of rawRecords) {
      try {
        events.push(this.toEvent(raw, divisionCodeToCourtId));
      } catch (error) {
        failures.push({
          rowId: raw.id,
          caseId: formatCaseId(raw.CASE_DIV, raw.CASE_YEAR, raw.CASE_NUMBER),
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const greatestId = rawRecords.reduce<number>(
      (max, raw) => (raw.id > max ? raw.id : max),
      rawRecords[0].id,
    );

    return { events, failures, lastId: String(greatestId) };
  }

  private toEvent(
    raw: AcmsCaseAppointmentRawRecord,
    divisionCodeToCourtId: Map<string, string>,
  ): TrusteeAppointmentSyncEvent {
    const divisionCode = raw.CASE_DIV.toString().padStart(3, '0');
    const courtId = divisionCodeToCourtId.get(divisionCode);
    if (!courtId) {
      throw new Error(
        `No courtId found in offices data for ACMS division ${divisionCode} (CMMAP.id ${raw.id})`,
      );
    }
    return rawToTrusteeAppointmentSyncEvent(raw, courtId);
  }
}
