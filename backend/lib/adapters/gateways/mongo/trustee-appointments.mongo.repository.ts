import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { TrusteeAppointmentsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeAppointment } from '../../../../../common/src/cams/trustee-appointments';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-MONGO-REPOSITORY';
const COLLECTION_NAME = 'trustee-appointments';

const { using, and } = QueryBuilder;

export type TrusteeAppointmentDocument = TrusteeAppointment & {
  documentType: 'TRUSTEE_APPOINTMENT';
};

export class TrusteeAppointmentsMongoRepository
  extends BaseMongoRepository
  implements TrusteeAppointmentsRepository
{
  private static referenceCount: number = 0;
  private static instance: TrusteeAppointmentsMongoRepository | null = null;

  constructor(context: ApplicationContext) {
    super(context, MODULE_NAME, COLLECTION_NAME);
  }

  public static getInstance(context: ApplicationContext) {
    if (!TrusteeAppointmentsMongoRepository.instance) {
      TrusteeAppointmentsMongoRepository.instance = new TrusteeAppointmentsMongoRepository(context);
    }
    TrusteeAppointmentsMongoRepository.referenceCount++;
    return TrusteeAppointmentsMongoRepository.instance;
  }

  public static dropInstance() {
    if (TrusteeAppointmentsMongoRepository.referenceCount > 0) {
      TrusteeAppointmentsMongoRepository.referenceCount--;
    }
    if (TrusteeAppointmentsMongoRepository.referenceCount < 1) {
      TrusteeAppointmentsMongoRepository.instance?.client.close().then();
      TrusteeAppointmentsMongoRepository.instance = null;
    }
  }

  public release() {
    TrusteeAppointmentsMongoRepository.dropInstance();
  }

  async read(id: string): Promise<TrusteeAppointment> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(doc('documentType').equals('TRUSTEE_APPOINTMENT'), doc('id').equals(id));
      const appointment = await this.getAdapter<TrusteeAppointmentDocument>().findOne(query);

      if (!appointment) {
        throw new Error(`Trustee appointment with ID ${id} not found.`);
      }

      return appointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve trustee appointment with ID ${id}.`,
      });
    }
  }

  async getTrusteeAppointments(trusteeId: string): Promise<TrusteeAppointment[]> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('trusteeId').equals(trusteeId),
      );
      return await this.getAdapter<TrusteeAppointmentDocument>().find(query);
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to retrieve appointments for trustee ${trusteeId}.`,
      });
    }
  }
}
