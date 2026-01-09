import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import { getTrusteeAppointmentsRepository, getTrusteesRepository } from '../../factory';
import {
  AppointmentStatus,
  TrusteeAppointment,
  TrusteeAppointmentInput,
} from '@common/cams/trustee-appointments';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import {
  TrusteeAppointmentHistory,
  TrusteeHistory,
  ChapterType,
  AppointmentType,
} from '@common/cams/trustees';
import { Creatable } from '../../adapters/types/persistence.gateway';
import DateHelper from '@common/date-helper';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-USE-CASE';

type AppointmentSnapshot = {
  chapter: ChapterType;
  appointmentType: AppointmentType;
  courtId: string;
  divisionCode: string;
  appointedDate: string;
  status: AppointmentStatus;
  effectiveDate: string;
};

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

  private hasAppointmentChanged(before: TrusteeAppointment, after: TrusteeAppointment): boolean {
    return (
      before.chapter !== after.chapter ||
      before.appointmentType !== after.appointmentType ||
      before.courtId !== after.courtId ||
      before.divisionCode !== after.divisionCode ||
      before.appointedDate !== after.appointedDate ||
      before.status !== after.status ||
      before.effectiveDate !== after.effectiveDate
    );
  }

  private async buildAppointmentHistory(
    context: ApplicationContext,
    trusteeId: string,
    appointmentId: string,
    userReference: CamsUserReference,
    before: AppointmentSnapshot | undefined,
    after: AppointmentSnapshot | undefined,
  ): Promise<Creatable<TrusteeAppointmentHistory>> {
    const courts = await this.courtsUseCase.getCourts(context);

    const withCourtInfo = (snap?: AppointmentSnapshot) => {
      if (!snap) return undefined;
      const court = this.findCourtDivision(courts, snap.courtId, snap.divisionCode);
      return {
        ...snap,
        courtName: court?.courtName,
        courtDivisionName: court?.courtDivisionName,
      };
    };

    const now = DateHelper.getCurrentIsoTimestamp();

    return {
      documentType: 'AUDIT_APPOINTMENT',
      trusteeId,
      appointmentId,
      before: withCourtInfo(before),
      after: withCourtInfo(after),
      updatedBy: userReference,
      updatedOn: now,
      createdBy: userReference,
      createdOn: now,
    };
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

      const history = await this.buildAppointmentHistory(
        context,
        trusteeId,
        createdAppointment.id,
        userReference,
        undefined,
        {
          chapter: createdAppointment.chapter,
          appointmentType: createdAppointment.appointmentType,
          courtId: createdAppointment.courtId,
          divisionCode: createdAppointment.divisionCode,
          appointedDate: createdAppointment.appointedDate,
          status: createdAppointment.status,
          effectiveDate: createdAppointment.effectiveDate,
        },
      );

      await this.trusteesRepository.createTrusteeHistory(history as Creatable<TrusteeHistory>);

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

      if (this.hasAppointmentChanged(existingAppointment, updatedAppointment)) {
        const history = await this.buildAppointmentHistory(
          context,
          trusteeId,
          appointmentId,
          userReference,
          {
            chapter: existingAppointment.chapter,
            appointmentType: existingAppointment.appointmentType,
            courtId: existingAppointment.courtId,
            divisionCode: existingAppointment.divisionCode,
            appointedDate: existingAppointment.appointedDate,
            status: existingAppointment.status,
            effectiveDate: existingAppointment.effectiveDate,
          },
          {
            chapter: updatedAppointment.chapter,
            appointmentType: updatedAppointment.appointmentType,
            courtId: updatedAppointment.courtId,
            divisionCode: updatedAppointment.divisionCode,
            appointedDate: updatedAppointment.appointedDate,
            status: updatedAppointment.status,
            effectiveDate: updatedAppointment.effectiveDate,
          },
        );

        await this.trusteesRepository.createTrusteeHistory(history as Creatable<TrusteeHistory>);
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
