import { ApplicationContext } from '../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../adapters/types/ats.types';
import {
  transformAppointmentRecord,
  isValidAppointmentForChapter,
  getAppointmentKey,
} from '../../adapters/gateways/ats/ats-mappings';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { Trustee } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';

const MODULE_NAME = 'APPOINTMENTS-SYNC-HELPERS';

/**
 * System user reference for audit trail
 */
export const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

/**
 * Result of processing a single appointment
 */
type AppointmentProcessResult = { success: boolean };

/**
 * Process a single appointment for a trustee.
 * Handles validation, duplicate detection, and creation.
 */
export async function processSingleAppointment(
  context: ApplicationContext,
  repo: ReturnType<typeof factory.getTrusteeAppointmentsRepository>,
  trustee: Trustee,
  atsAppointment: AtsAppointmentRecord,
  processedKeys: Set<string>,
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

    // Generate unique key to prevent duplicates within this migration batch
    const appointmentKey = getAppointmentKey(trustee.trusteeId, appointmentInput);

    // Skip if we've already processed this appointment (duplicate in source data)
    if (processedKeys.has(appointmentKey)) {
      context.logger.debug(MODULE_NAME, `Skipping duplicate appointment ${appointmentKey}`);
      return { success: false };
    }

    processedKeys.add(appointmentKey);

    context.logger.debug(MODULE_NAME, `Creating appointment ${appointmentKey}`);
    await repo.createAppointment(trustee.trusteeId, appointmentInput, SYSTEM_USER);

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
