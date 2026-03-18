import {
  TrusteeUpcomingReportDates,
  TrusteeUpcomingReportDatesHistory,
} from '@common/cams/trustee-upcoming-report-dates';
import { getCamsError } from '../../../common-errors/error-utilities';
import { Creatable } from '@common/cams/creatable';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeUpcomingReportDatesRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'TRUSTEE-UPCOMING-REPORT-DATES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { and, using } = QueryBuilder;
const doc = using<TrusteeUpcomingReportDates>();

export class TrusteeUpcomingReportDatesMongoRepository
  extends BaseMongoRepository
  implements TrusteeUpcomingReportDatesRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeUpcomingReportDatesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeUpcomingReportDatesMongoRepository.instance) {
      TrusteeUpcomingReportDatesMongoRepository.instance =
        new TrusteeUpcomingReportDatesMongoRepository(context);
    }
    TrusteeUpcomingReportDatesMongoRepository.referenceCount++;
    return TrusteeUpcomingReportDatesMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeUpcomingReportDatesMongoRepository.referenceCount > 0) {
      TrusteeUpcomingReportDatesMongoRepository.referenceCount--;
    }
    if (TrusteeUpcomingReportDatesMongoRepository.referenceCount < 1) {
      TrusteeUpcomingReportDatesMongoRepository.instance?.client.close().then();
      TrusteeUpcomingReportDatesMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeUpcomingReportDatesMongoRepository.dropInstance();
  }

  async getByAppointmentId(appointmentId: string): Promise<TrusteeUpcomingReportDates | null> {
    const query = and(
      doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
      doc('appointmentId').equals(appointmentId),
    );
    try {
      return await this.getAdapter<TrusteeUpcomingReportDates>().findOne(query);
    } catch {
      return null;
    }
  }

  async read(id: string): Promise<TrusteeUpcomingReportDates | null> {
    const query = and(
      doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
      doc('id').equals(id),
    );
    try {
      return await this.getAdapter<TrusteeUpcomingReportDates>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, `Unable to read upcoming report dates ${id}.`);
    }
  }

  async upsert(data: TrusteeUpcomingReportDates): Promise<void> {
    const query = and(
      doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
      doc('appointmentId').equals(data.appointmentId),
    );
    try {
      await this.getAdapter<TrusteeUpcomingReportDates>().replaceOne(query, data, true);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to upsert upcoming report dates.');
    }
  }

  async createHistory(history: Creatable<TrusteeUpcomingReportDatesHistory>): Promise<void> {
    try {
      await this.getAdapter<Creatable<TrusteeUpcomingReportDatesHistory>>().insertOne(history, {
        useProvidedId: true,
      });
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to create upcoming report dates history.',
      );
    }
  }
}
