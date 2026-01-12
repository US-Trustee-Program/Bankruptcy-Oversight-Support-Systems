import { ApplicationContext } from '../../types/basic';
import { getCamsErrorWithStack } from '../../../common-errors/error-utilities';
import { NotFoundError } from '../../../common-errors/not-found-error';
import { TrusteeAppointmentsRepository } from '../../../use-cases/gateways.types';
import { BaseMongoRepository } from './utils/base-mongo-repository';
import QueryBuilder from '../../../query/query-builder';
import { TrusteeAppointment, TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { createAuditRecord } from '@common/cams/auditable';
import { CamsUserReference } from '@common/cams/users';
import { Creatable } from '../../types/persistence.gateway';

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
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee appointment with ID ${id} not found.`,
        });
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

  async createAppointment(
    trusteeId: string,
    appointmentInput: TrusteeAppointmentInput,
    user: CamsUserReference,
  ): Promise<TrusteeAppointment> {
    const appointmentDocument = createAuditRecord<Creatable<TrusteeAppointmentDocument>>(
      {
        ...appointmentInput,
        trusteeId,
        documentType: 'TRUSTEE_APPOINTMENT',
      },
      user,
    );

    try {
      const id =
        await this.getAdapter<Creatable<TrusteeAppointmentDocument>>().insertOne(
          appointmentDocument,
        );
      return { id, ...appointmentDocument };
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to create trustee appointment for trustee ${trusteeId}.`,
      });
    }
  }

  async updateAppointment(
    trusteeId: string,
    appointmentId: string,
    appointmentInput: TrusteeAppointmentInput,
    user: CamsUserReference,
  ): Promise<TrusteeAppointment> {
    try {
      const doc = using<TrusteeAppointmentDocument>();
      const query = and(
        doc('documentType').equals('TRUSTEE_APPOINTMENT'),
        doc('id').equals(appointmentId),
      );

      const existingAppointment =
        await this.getAdapter<TrusteeAppointmentDocument>().findOne(query);

      if (!existingAppointment) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee appointment with ID ${appointmentId} not found.`,
        });
      }

      if (existingAppointment.trusteeId !== trusteeId) {
        const error: Error & { code?: string } = new Error(
          `Appointment ${appointmentId} does not belong to trustee ${trusteeId}`,
        );
        error.code = 'TRUSTEE_APPOINTMENT_FORBIDDEN';
        throw error;
      }

      const updatedAppointment: TrusteeAppointmentDocument = {
        ...existingAppointment,
        ...appointmentInput,
        id: appointmentId,
        documentType: 'TRUSTEE_APPOINTMENT',
        updatedBy: user,
        updatedOn: new Date().toISOString(),
      };

      await this.getAdapter<TrusteeAppointmentDocument>().replaceOne(query, updatedAppointment);

      return updatedAppointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        message: `Failed to update trustee appointment with ID ${appointmentId}.`,
      });
    }
  }
}
