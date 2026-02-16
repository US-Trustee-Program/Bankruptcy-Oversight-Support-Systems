import { ApplicationContext } from '../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../adapters/types/ats.types';
import {
  transformAppointmentRecord,
  isValidAppointmentForChapter,
  getAppointmentKey,
  deriveTrusteeStatus,
  parseTodStatus,
} from '../../adapters/gateways/ats/ats-mappings';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { Trustee, AppointmentStatus } from '@common/cams/trustees';
import { TrusteeAppointment } from '@common/cams/trustee-appointments';
import { CamsUserReference } from '@common/cams/users';

const MODULE_NAME = 'APPOINTMENTS-SYNC-HELPERS';

/**
 * System user reference for audit trail
 */
const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

/**
 * Result of processing a single appointment
 */
type AppointmentProcessResult = { success: boolean };

/**
 * Process a single appointment for a trustee.
 * Handles validation, duplicate detection, and upsert logic.
 */
export async function processSingleAppointment(
  context: ApplicationContext,
  repo: ReturnType<typeof factory.getTrusteeAppointmentsRepository>,
  trustee: Trustee,
  atsAppointment: AtsAppointmentRecord,
  processedKeys: Set<string>,
  existingAppointments: TrusteeAppointment[],
): Promise<AppointmentProcessResult> {
  try {
    // Transform ATS appointment to CAMS format
    const appointmentInput = transformAppointmentRecord(atsAppointment);

    // Validate appointment type for chapter
    if (!isValidAppointmentForChapter(appointmentInput.chapter, appointmentInput.appointmentType)) {
      context.logger.warn(
        MODULE_NAME,
        `Invalid appointment type ${appointmentInput.appointmentType} for chapter ${appointmentInput.chapter}`,
      );
      return { success: false };
    }

    // Generate unique key to prevent duplicates
    const appointmentKey = getAppointmentKey(trustee.trusteeId, appointmentInput);

    // Skip if we've already processed this appointment (duplicate in source data)
    if (processedKeys.has(appointmentKey)) {
      context.logger.debug(MODULE_NAME, `Skipping duplicate appointment ${appointmentKey}`);
      return { success: false };
    }

    processedKeys.add(appointmentKey);

    // Check if appointment already exists.
    // Match on courtId, divisionCode, chapter, and appointmentType for uniqueness.
    // TODO: CAMS-596 revisit logic for existing appointments
    const existingAppointment = existingAppointments.find(
      (a) =>
        a.courtId === appointmentInput.courtId &&
        a.divisionCode === appointmentInput.divisionCode &&
        a.chapter === appointmentInput.chapter &&
        a.appointmentType === appointmentInput.appointmentType,
    );

    if (existingAppointment) {
      // Merge new data into existing document to ensure all fields are updated
      context.logger.debug(MODULE_NAME, `Updating existing appointment ${appointmentKey}`);
      const merged = { ...existingAppointment, ...appointmentInput };
      await repo.updateAppointment(trustee.trusteeId, existingAppointment.id, merged, SYSTEM_USER);
    } else {
      // Create new appointment
      context.logger.debug(MODULE_NAME, `Creating new appointment ${appointmentKey}`);
      await repo.createAppointment(trustee.trusteeId, appointmentInput, SYSTEM_USER);
    }

    return { success: true };
  } catch (appointmentError) {
    // Log error but return failure status
    context.logger.error(
      MODULE_NAME,
      `Failed to process appointment for trustee ${trustee.trusteeId}`,
      {
        error: getCamsError(appointmentError, MODULE_NAME).message,
        appointment: atsAppointment,
      },
    );
    return { success: false };
  }
}

/**
 * Derive trustee status from appointment statuses.
 * Uses full transformation to account for CBC overrides and code-1 chapter-dependent logic.
 * Falls back to flat map status if transformation fails.
 */
export function deriveStatusFromAppointments(
  context: ApplicationContext,
  appointments: AtsAppointmentRecord[],
): AppointmentStatus {
  const appointmentStatuses: AppointmentStatus[] = appointments.map((a) => {
    try {
      const transformed = transformAppointmentRecord(a);
      return transformed.status;
    } catch (_error) {
      // If transformation fails, fall back to flat map status
      context.logger.warn(
        MODULE_NAME,
        `Failed to transform appointment for status derivation, using flat map`,
        {
          trusteeId: a.TRU_ID,
          chapter: a.CHAPTER,
          status: a.STATUS,
        },
      );
      return parseTodStatus(a.STATUS).status;
    }
  });

  return deriveTrusteeStatus(appointmentStatuses);
}
