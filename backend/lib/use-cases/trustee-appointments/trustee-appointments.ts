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
import { TrusteeAppointmentHistory, TrusteeHistory } from '../../../../common/src/cams/trustees';
import { Creatable } from '../../adapters/types/persistence.gateway';

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

  private findCourtDivision(
    courts: CourtDivisionDetails[],
    courtId: string,
    divisionCode: string,
  ): CourtDivisionDetails | undefined {
    return courts.find(
      (court) => court.courtId === courtId && court.courtDivisionCode === divisionCode,
    );
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
        const courtDivision = this.findCourtDivision(
          courts,
          appointment.courtId,
          appointment.divisionCode,
        );
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

      const [courts] = await Promise.all([this.courtsUseCase.getCourts(context)]);

      const court = this.findCourtDivision(
        courts,
        createdAppointment.courtId,
        createdAppointment.divisionCode,
      );

      const appointmentHistory: Creatable<TrusteeAppointmentHistory> = {
        documentType: 'AUDIT_APPOINTMENT',
        trusteeId,
        appointmentId: createdAppointment.id,
        before: undefined,
        after: {
          chapter: createdAppointment.chapter,
          courtId: createdAppointment.courtId,
          divisionCode: createdAppointment.divisionCode,
          courtName: court?.courtName,
          courtDivisionName: court?.courtDivisionName,
          appointedDate: createdAppointment.appointedDate,
          status: createdAppointment.status,
          effectiveDate: createdAppointment.effectiveDate,
        },
        updatedBy: userReference,
        updatedOn: new Date().toISOString(),
        createdBy: userReference,
        createdOn: new Date().toISOString(),
      };

      await this.trusteesRepository.createTrusteeHistory(
        appointmentHistory as Creatable<TrusteeHistory>,
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

      const existingAppointment = await this.trusteeAppointmentsRepository.read(appointmentId);

      const updatedAppointment = await this.trusteeAppointmentsRepository.updateAppointment(
        trusteeId,
        appointmentId,
        appointmentData,
        userReference,
      );

      const appointmentChanged =
        existingAppointment.chapter !== updatedAppointment.chapter ||
        existingAppointment.courtId !== updatedAppointment.courtId ||
        existingAppointment.divisionCode !== updatedAppointment.divisionCode ||
        existingAppointment.appointedDate !== updatedAppointment.appointedDate ||
        existingAppointment.status !== updatedAppointment.status ||
        existingAppointment.effectiveDate !== updatedAppointment.effectiveDate;

      if (appointmentChanged) {
        const [courts] = await Promise.all([this.courtsUseCase.getCourts(context)]);

        const beforeCourt = this.findCourtDivision(
          courts,
          existingAppointment.courtId,
          existingAppointment.divisionCode,
        );
        const afterCourt = this.findCourtDivision(
          courts,
          updatedAppointment.courtId,
          updatedAppointment.divisionCode,
        );

        const appointmentHistory: Creatable<TrusteeAppointmentHistory> = {
          documentType: 'AUDIT_APPOINTMENT',
          trusteeId,
          appointmentId,
          before: {
            chapter: existingAppointment.chapter,
            courtId: existingAppointment.courtId,
            divisionCode: existingAppointment.divisionCode,
            courtName: beforeCourt?.courtName,
            courtDivisionName: beforeCourt?.courtDivisionName,
            appointedDate: existingAppointment.appointedDate,
            status: existingAppointment.status,
            effectiveDate: existingAppointment.effectiveDate,
          },
          after: {
            chapter: updatedAppointment.chapter,
            courtId: updatedAppointment.courtId,
            divisionCode: updatedAppointment.divisionCode,
            courtName: afterCourt?.courtName,
            courtDivisionName: afterCourt?.courtDivisionName,
            appointedDate: updatedAppointment.appointedDate,
            status: updatedAppointment.status,
            effectiveDate: updatedAppointment.effectiveDate,
          },
          updatedBy: userReference,
          updatedOn: new Date().toISOString(),
          createdBy: userReference,
          createdOn: new Date().toISOString(),
        };

        await this.trusteesRepository.createTrusteeHistory(
          appointmentHistory as Creatable<TrusteeHistory>,
        );
      }

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
