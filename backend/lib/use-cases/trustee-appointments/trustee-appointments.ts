import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getTrusteeAppointmentsRepository, getTrusteesRepository } from '../../factory';
import { TrusteeAppointment } from '../../../../common/src/cams/trustee-appointments';
import { NotFoundError } from '../../common-errors/not-found-error';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-USE-CASE';

export class TrusteeAppointmentsUseCase {
  private readonly trusteeAppointmentsRepository: TrusteeAppointmentsRepository;
  private readonly trusteesRepository: TrusteesRepository;

  constructor(context: ApplicationContext) {
    this.trusteeAppointmentsRepository = getTrusteeAppointmentsRepository(context);
    this.trusteesRepository = getTrusteesRepository(context);
  }

  async getTrusteeAppointments(
    context: ApplicationContext,
    trusteeId: string,
  ): Promise<TrusteeAppointment[]> {
    try {
      // Verify trustee exists
      try {
        await this.trusteesRepository.read(trusteeId);
      } catch (_e) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee with ID ${trusteeId} not found.`,
        });
      }

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
