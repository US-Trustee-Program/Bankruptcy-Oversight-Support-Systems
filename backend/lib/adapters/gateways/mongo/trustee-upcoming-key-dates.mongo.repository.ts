import {
  TrusteeUpcomingKeyDates,
  TrusteeUpcomingKeyDatesHistory,
} from '@common/cams/trustee-upcoming-key-dates';
import { getCamsError } from '../../../common-errors/error-utilities';
import { Creatable } from '@common/cams/creatable';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeUpcomingKeyDatesRepository } from '../../../use-cases/gateways.types';
import { ApplicationContext } from '../../types/basic';
import { BaseMongoRepository } from './utils/base-mongo-repository';

const MODULE_NAME = 'TRUSTEE-UPCOMING-KEY-DATES-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustees';

const { and, using } = QueryBuilder;
const doc = using<TrusteeUpcomingKeyDates>();

export class TrusteeUpcomingKeyDatesMongoRepository
  extends BaseMongoRepository
  implements TrusteeUpcomingKeyDatesRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeUpcomingKeyDatesMongoRepository;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeUpcomingKeyDatesMongoRepository.instance) {
      TrusteeUpcomingKeyDatesMongoRepository.instance = new TrusteeUpcomingKeyDatesMongoRepository(
        context,
      );
    }
    TrusteeUpcomingKeyDatesMongoRepository.referenceCount++;
    return TrusteeUpcomingKeyDatesMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeUpcomingKeyDatesMongoRepository.referenceCount > 0) {
      TrusteeUpcomingKeyDatesMongoRepository.referenceCount--;
    }
    if (TrusteeUpcomingKeyDatesMongoRepository.referenceCount < 1) {
      TrusteeUpcomingKeyDatesMongoRepository.instance?.client.close().then();
      TrusteeUpcomingKeyDatesMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeUpcomingKeyDatesMongoRepository.dropInstance();
  }

  async getByAppointmentId(appointmentId: string): Promise<TrusteeUpcomingKeyDates | null> {
    const query = and(
      doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
      doc('appointmentId').equals(appointmentId),
    );
    try {
      return await this.getAdapter<TrusteeUpcomingKeyDates>().findOne(query);
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        `Unable to fetch upcoming key dates for appointment ${appointmentId}.`,
      );
    }
  }

  async read(id: string): Promise<TrusteeUpcomingKeyDates | null> {
    const query = and(
      doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
      doc('id').equals(id),
    );
    try {
      return await this.getAdapter<TrusteeUpcomingKeyDates>().findOne(query);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, `Unable to read upcoming key dates ${id}.`);
    }
  }

  async upsert(data: TrusteeUpcomingKeyDates): Promise<void> {
    const query = and(
      doc('documentType').equals('TRUSTEE_UPCOMING_REPORT_DATES'),
      doc('appointmentId').equals(data.appointmentId),
    );
    try {
      await this.getAdapter<TrusteeUpcomingKeyDates>().replaceOne(query, data, true);
    } catch (originalError) {
      throw getCamsError(originalError, MODULE_NAME, 'Unable to upsert upcoming key dates.');
    }
  }

  async createHistory(history: Creatable<TrusteeUpcomingKeyDatesHistory>): Promise<void> {
    try {
      await this.getAdapter<Creatable<TrusteeUpcomingKeyDatesHistory>>().insertOne(history, {
        useProvidedId: true,
      });
    } catch (originalError) {
      throw getCamsError(
        originalError,
        MODULE_NAME,
        'Unable to create upcoming key dates history.',
      );
    }
  }
}
