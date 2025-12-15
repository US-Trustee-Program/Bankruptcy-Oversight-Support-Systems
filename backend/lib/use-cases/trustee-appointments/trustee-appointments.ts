import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getTrusteeAppointmentsRepository } from '../../factory';
import { TrusteeAppointment } from '../../../../common/src/cams/trustee-appointments';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-USE-CASE';

export class TrusteeAppointmentsUseCase {
  private readonly trusteeAppointmentsRepository: TrusteeAppointmentsRepository;

  constructor(context: ApplicationContext) {
    this.trusteeAppointmentsRepository = getTrusteeAppointmentsRepository(context);
  }

  async getTrusteeAppointment(
    context: ApplicationContext,
    id: string,
  ): Promise<TrusteeAppointment> {
    try {
      const appointment = await this.trusteeAppointmentsRepository.read(id);

      context.logger.info(MODULE_NAME, `Retrieved trustee appointment ${id}`);
      return appointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve trustee appointment with ID ${id}.`,
        },
      });
    }
  }

  async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<TrusteeAppointment[]> {
    try {
      const appointments =
        await this.trusteeAppointmentsRepository.getTrusteeAppointments(trusteeId);

      context.logger.info(
        MODULE_NAME,
        `Retrieved ${appointments.length} appointments for trustee ${trusteeId}`,
      );
      return appointments;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve appointments for trustee ${trusteeId}.`,
        },
      });
    }
  }
}
