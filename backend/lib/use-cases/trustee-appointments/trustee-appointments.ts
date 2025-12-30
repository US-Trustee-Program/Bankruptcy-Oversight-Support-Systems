import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getTrusteeAppointmentsRepository, getTrusteesRepository } from '../../factory';
import {
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '../../../../common/src/cams/trustee-appointments';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '../../../../common/src/cams/courts';
import { getCamsUserReference } from '../../../../common/src/cams/session';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-USE-CASE';

export class TrusteeAppointmentsUseCase {
  private readonly trusteeAppointmentsRepository: TrusteeAppointmentsRepository;
  private readonly trusteesRepository: TrusteesRepository;
  private readonly courtsUseCase: CourtsUseCase;

  constructor(context: ApplicationContext) {
    this.trusteeAppointmentsRepository = getTrusteeAppointmentsRepository(context);
    this.trusteesRepository = getTrusteesRepository(context);
    this.courtsUseCase = new CourtsUseCase();
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

      const [appointments, courts] = await Promise.all([
        this.trusteeAppointmentsRepository.getTrusteeAppointments(trusteeId),
        this.courtsUseCase.getCourts(context),
      ]);

      // Enrich appointments with court information
      const enrichedAppointments = appointments.map((appointment) => {
        const courtDivision = this.findCourtDivision(courts, appointment.divisionCode);
        return {
          ...appointment,
          courtName: courtDivision?.courtName,
          courtDivisionName: courtDivision?.courtDivisionName,
        };
      });

      return enrichedAppointments;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to retrieve appointments for trustee ${trusteeId}.`,
        },
      });
    }
  }

  private findCourtDivision(
    courts: CourtDivisionDetails[],
    divisionCode: string,
  ): CourtDivisionDetails | undefined {
    return courts.find((court) => court.courtDivisionCode === divisionCode);
  }

  async createAppointment(
    context: ApplicationContext,
    trusteeId: string,
    appointmentData: TrusteeAppointmentInput,
  ): Promise<TrusteeAppointment> {
    try {
      try {
        await this.trusteesRepository.read(trusteeId);
      } catch (_e) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee with ID ${trusteeId} not found.`,
        });
      }

      const userReference = getCamsUserReference(context.session.user);

      const createdAppointment = await this.trusteeAppointmentsRepository.createAppointment(
        trusteeId,
        appointmentData,
        userReference,
      );

      context.logger.info(
        MODULE_NAME,
        `Created appointment ${createdAppointment.id} for trustee ${trusteeId}`,
      );

      return createdAppointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to create appointment for trustee ${trusteeId}.`,
        },
      });
    }
  }

  async updateAppointment(
    context: ApplicationContext,
    trusteeId: string,
    appointmentId: string,
    appointmentData: TrusteeAppointmentInput,
  ): Promise<TrusteeAppointment> {
    try {
      const userReference = getCamsUserReference(context.session.user);

      const updatedAppointment = await this.trusteeAppointmentsRepository.updateAppointment(
        trusteeId,
        appointmentId,
        appointmentData,
        userReference,
      );

      context.logger.info(MODULE_NAME, `Updated appointment ${appointmentId}`);

      return updatedAppointment;
    } catch (originalError) {
      throw getCamsErrorWithStack(originalError, MODULE_NAME, {
        camsStackInfo: {
          module: MODULE_NAME,
          message: `Failed to update appointment ${appointmentId}.`,
        },
      });
    }
  }
}
