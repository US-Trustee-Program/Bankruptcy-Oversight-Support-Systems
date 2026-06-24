import { ApplicationContext } from '../../adapters/types/basic';
import { TrusteeAppointmentsRepository, TrusteesRepository } from '../gateways.types';
import { getCamsErrorWithStack } from '../../common-errors/error-utilities';
import factory from '../../factory';
import {
  TrusteeAppointment,
  TrusteeAppointmentInput,
  TRUSTEE_APPOINTMENTS_INTERNAL_SPEC,
} from '@common/cams/trustee-appointments';
import { NotFoundError } from '../../common-errors/not-found-error';
import { CourtsUseCase } from '../courts/courts';
import { CourtDivisionDetails } from '@common/cams/courts';
import { getCamsUserReference } from '@common/cams/session';
import { CamsUserReference } from '@common/cams/users';
import {
  TrusteeAppointmentHistory,
  TrusteeHistory,
  AppointmentChapterType,
  AppointmentType,
  AppointmentStatus,
} from '@common/cams/trustees';
import { Creatable } from '@common/cams/creatable';
import DateHelper from '@common/date-helper';
import { validateObject } from '@common/cams/validation';
import { CamsError } from '../../common-errors/cams-error';
import {
  buildAppointmentChangeSet,
  AppointmentFieldSnapshot,
} from './build-appointment-change-set';
import { TrusteeChangeNotificationUseCase } from '../notifications/trustee-change-notification';

const MODULE_NAME = 'TRUSTEE-APPOINTMENTS-USE-CASE';

type AppointmentSnapshot = {
  chapter: AppointmentChapterType;
  appointmentType: AppointmentType;
  courtId: string;
  divisionCode: string;
  divisionCodes?: string[];
  appointedDate: string;
  status: AppointmentStatus;
  effectiveDate: string;
};

function snapshotFrom(apt: TrusteeAppointment): AppointmentSnapshot & AppointmentFieldSnapshot {
  return {
    chapter: apt.chapter,
    appointmentType: apt.appointmentType,
    courtId: apt.courtId,
    divisionCode: apt.divisionCode,
    divisionCodes: apt.divisionCodes,
    appointedDate: apt.appointedDate,
    status: apt.status,
    effectiveDate: apt.effectiveDate,
  };
}

export class TrusteeAppointmentsUseCase {
  private readonly trusteeAppointmentsRepository: TrusteeAppointmentsRepository;
  private readonly trusteesRepository: TrusteesRepository;
  private readonly courtsUseCase: CourtsUseCase;

  constructor(context: ApplicationContext) {
    this.trusteeAppointmentsRepository = factory.getTrusteeAppointmentsRepository(context);
    this.trusteesRepository = factory.getTrusteesRepository(context);
    this.courtsUseCase = new CourtsUseCase();
  }

  /**
   * Find the court district name (e.g., "Eastern District of Missouri") for a given courtId.
   * Note: We only return the district name (courtName), not division names,
   * as per product requirements.
   */
  private findCourtDistrict(courts: CourtDivisionDetails[], courtId: string): string | undefined {
    const court = courts.find((c) => c.courtId === courtId);
    return court?.courtName;
  }

  /**
   * Normalize appointment data to ensure backward compatibility.
   * Converts single divisionCode to divisionCodes array if needed.
   */
  private normalizeAppointmentData(
    appointmentData: TrusteeAppointmentInput,
  ): TrusteeAppointmentInput {
    // If new format is provided, use it
    if (appointmentData.divisionCodes && appointmentData.divisionCodes.length > 0) {
      return {
        ...appointmentData,
        divisionCode: appointmentData.divisionCodes[0], // Keep first for backward compatibility
        divisionCodes: appointmentData.divisionCodes,
      };
    }

    // If old format is provided, convert to new format
    if (appointmentData.divisionCode) {
      return {
        ...appointmentData,
        divisionCode: appointmentData.divisionCode,
        divisionCodes: [appointmentData.divisionCode],
      };
    }

    // Neither provided - validation will catch this
    return appointmentData;
  }

  private validateAppointmentData(appointmentData: TrusteeAppointmentInput): void {
    const validationResult = validateObject(TRUSTEE_APPOINTMENTS_INTERNAL_SPEC, appointmentData);

    if (!validationResult.valid && validationResult.reasonMap?.$?.reasons) {
      const errors = validationResult.reasonMap.$.reasons.join('; ');
      throw new CamsError(MODULE_NAME, {
        message: errors,
      });
    }
  }

  private divisionsChanged(before: TrusteeAppointment, after: TrusteeAppointment): boolean {
    const beforeSet = new Set(before.divisionCodes ?? [before.divisionCode].filter(Boolean));
    const afterSet = new Set(after.divisionCodes ?? [after.divisionCode].filter(Boolean));
    if (beforeSet.size !== afterSet.size) return true;
    for (const code of beforeSet) {
      if (!afterSet.has(code)) return true;
    }
    return false;
  }

  private hasAppointmentChanged(before: TrusteeAppointment, after: TrusteeAppointment): boolean {
    return (
      before.chapter !== after.chapter ||
      before.appointmentType !== after.appointmentType ||
      before.courtId !== after.courtId ||
      this.divisionsChanged(before, after) ||
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
    courts?: CourtDivisionDetails[],
  ): Promise<Creatable<TrusteeAppointmentHistory>> {
    const resolvedCourts = courts ?? (await this.courtsUseCase.getCourts(context));

    const withCourtInfo = (snap?: AppointmentSnapshot) => {
      if (!snap) return undefined;
      const courtName = this.findCourtDistrict(resolvedCourts, snap.courtId);
      return {
        ...snap,
        courtName,
        courtDivisionName: undefined, // Division names are not used per product requirements
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

      // Enrich appointments with court district name
      const enrichedAppointments = appointments.map((appointment) => {
        const courtName = this.findCourtDistrict(courts, appointment.courtId);
        context.logger.debug(
          MODULE_NAME,
          `Enriching appointment ${appointment.id}: courtId=${appointment.courtId} -> courtName=${courtName || 'NOT FOUND'}`,
        );
        return {
          ...appointment,
          courtName,
          courtDivisionName: undefined, // Division names are not used per product requirements
        };
      });

      context.logger.info(MODULE_NAME, `Enriched ${enrichedAppointments.length} appointments`);
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
      let trusteeName: string;
      try {
        const trustee = await this.trusteesRepository.read(trusteeId);
        trusteeName = trustee.name;
      } catch (_e) {
        throw new NotFoundError(MODULE_NAME, {
          message: `Trustee with ID ${trusteeId} not found.`,
        });
      }

      // Normalize data (convert old format to new format if needed)
      const normalizedData = this.normalizeAppointmentData(appointmentData);

      this.validateAppointmentData(normalizedData);

      const userReference = getCamsUserReference(context.session.user);

      const createdAppointment = await this.trusteeAppointmentsRepository.createAppointment(
        trusteeId,
        normalizedData,
        userReference,
      );

      const courts = await this.courtsUseCase.getCourts(context);

      const createdSnapshot = snapshotFrom(createdAppointment);

      const history = await this.buildAppointmentHistory(
        context,
        trusteeId,
        createdAppointment.id,
        userReference,
        undefined,
        createdSnapshot,
        courts,
      );

      await this.trusteesRepository.createTrusteeHistory(history as Creatable<TrusteeHistory>);

      if (context.featureFlags['trustee-change-notification-enabled']) {
        try {
          const courtNameResolver = (courtId: string) => this.findCourtDistrict(courts, courtId);
          const changeSet = buildAppointmentChangeSet({
            trusteeId,
            trusteeName,
            before: undefined,
            after: createdSnapshot,
            courtNameResolver,
          });
          if (changeSet.fields.length > 0) {
            const notificationUseCase = new TrusteeChangeNotificationUseCase(context);
            await notificationUseCase.notify(context, changeSet);
          }
        } catch (notificationError) {
          context.logger.error(
            MODULE_NAME,
            'Failed to dispatch new appointment notification.',
            notificationError,
          );
        }
      }

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
      // Normalize data (convert old format to new format if needed)
      const normalizedData = this.normalizeAppointmentData(appointmentData);

      this.validateAppointmentData(normalizedData);

      const userReference = getCamsUserReference(context.session.user);

      const existingAppointment = await this.trusteeAppointmentsRepository.read(
        trusteeId,
        appointmentId,
      );

      const updatedAppointment = await this.trusteeAppointmentsRepository.updateAppointment(
        trusteeId,
        appointmentId,
        normalizedData,
        userReference,
      );

      if (this.hasAppointmentChanged(existingAppointment, updatedAppointment)) {
        const courts = await this.courtsUseCase.getCourts(context);

        const beforeSnapshot = snapshotFrom(existingAppointment);
        const afterSnapshot = snapshotFrom(updatedAppointment);

        const history = await this.buildAppointmentHistory(
          context,
          trusteeId,
          appointmentId,
          userReference,
          beforeSnapshot,
          afterSnapshot,
          courts,
        );

        await this.trusteesRepository.createTrusteeHistory(history as Creatable<TrusteeHistory>);

        if (context.featureFlags['trustee-change-notification-enabled']) {
          try {
            const trustee = await this.trusteesRepository.read(trusteeId);
            const courtNameResolver = (courtId: string) => this.findCourtDistrict(courts, courtId);
            const changeSet = buildAppointmentChangeSet({
              trusteeId,
              trusteeName: trustee.name,
              before: beforeSnapshot,
              after: afterSnapshot,
              courtNameResolver,
            });
            if (changeSet.fields.length > 0) {
              const notificationUseCase = new TrusteeChangeNotificationUseCase(context);
              await notificationUseCase.notify(context, changeSet);
            }
          } catch (notificationError) {
            context.logger.error(
              MODULE_NAME,
              'Failed to dispatch appointment change notification.',
              notificationError,
            );
          }
        }
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
