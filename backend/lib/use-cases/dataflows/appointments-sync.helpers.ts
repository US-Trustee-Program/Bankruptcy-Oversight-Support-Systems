import { ApplicationContext } from '../../adapters/types/basic';
import { AtsAppointmentRecord } from '../../adapters/types/ats.types';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { Trustee } from '@common/cams/trustees';
import { CamsUserReference } from '@common/cams/users';
import { isValidAppointmentForChapter } from '@common/cams/trustee-appointments';
import { cleanseAndMapAppointment } from './ats-cleansing/ats-cleansing-pipeline';
import {
  CleansingClassification,
  TrusteeOverride,
  FailedAppointment,
} from './ats-cleansing/ats-cleansing-types';
import { getAppointmentKey } from './ats-cleansing/ats-cleansing-utils';
import { transformAppointmentRecord } from './ats-cleansing/ats-cleansing-transform';

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
type AppointmentProcessResult = {
  success: boolean;
  skipped?: boolean; // True if appointment was skipped (already exists or override directive)
  failedAppointment?: FailedAppointment; // Only present when success=false
};

/**
 * Process a single appointment for a trustee.
 * Runs through cleansing pipeline, handles classification results.
 * Idempotent: skips appointments that already exist in the database.
 */
export async function processSingleAppointment(
  context: ApplicationContext,
  repo: ReturnType<typeof factory.getTrusteeAppointmentsRepository>,
  trustee: Trustee,
  atsAppointment: AtsAppointmentRecord,
  processedKeys: Set<string>,
  existingKeys: Set<string>,
  overridesCache: Map<string, TrusteeOverride[]>,
): Promise<AppointmentProcessResult> {
  const truId = trustee.legacy?.truId || '';

  try {
    // Run through cleansing pipeline
    const cleansingResult = cleanseAndMapAppointment(
      context,
      truId,
      atsAppointment,
      overridesCache,
    );

    // Handle SKIP classification - treat as SUCCESS, not failure
    if (cleansingResult.classification === CleansingClassification.SKIP) {
      context.logger.debug(MODULE_NAME, `Skipping appointment per override directive`, {
        trusteeId: trustee.trusteeId,
        notes: cleansingResult.notes,
      });
      return { success: true, skipped: true };
    }

    // Handle UNCLEANSABLE classification
    if (cleansingResult.classification === CleansingClassification.UNCLEANSABLE) {
      context.logger.warn(MODULE_NAME, `Appointment is UNCLEANSABLE`, {
        trusteeId: trustee.trusteeId,
        truId,
        notes: cleansingResult.notes,
      });

      return {
        success: false,
        failedAppointment: {
          trusteeId: trustee.trusteeId,
          truId,
          atsAppointment,
          classification: CleansingClassification.UNCLEANSABLE,
          notes: cleansingResult.notes,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Handle PROBLEMATIC classification
    if (cleansingResult.classification === CleansingClassification.PROBLEMATIC) {
      context.logger.warn(MODULE_NAME, `Appointment is PROBLEMATIC`, {
        trusteeId: trustee.trusteeId,
        truId,
        notes: cleansingResult.notes,
      });

      return {
        success: false,
        failedAppointment: {
          trusteeId: trustee.trusteeId,
          truId,
          atsAppointment,
          classification: CleansingClassification.PROBLEMATIC,
          notes: cleansingResult.notes,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // CLEAN or AUTO_RECOVERABLE - proceed with creation

    // Handle multi-expansion (1:N mapping) - create multiple appointments
    if (!cleansingResult.appointment && cleansingResult.courtIds.length > 1) {
      context.logger.info(
        MODULE_NAME,
        `Multi-expansion: creating ${cleansingResult.courtIds.length} appointments`,
        {
          trusteeId: trustee.trusteeId,
          courtIds: cleansingResult.courtIds,
        },
      );

      let created = 0;
      for (const courtId of cleansingResult.courtIds) {
        try {
          // Transform using the original ATS appointment and this courtId
          const appointmentInput = transformAppointmentRecord(atsAppointment, courtId);

          // Validate appointment type for chapter
          if (
            !isValidAppointmentForChapter(
              appointmentInput.chapter,
              appointmentInput.appointmentType,
            )
          ) {
            context.logger.warn(
              MODULE_NAME,
              `Invalid appointment type ${appointmentInput.appointmentType} for chapter ${appointmentInput.chapter} (court ${courtId})`,
            );
            continue; // Skip this courtId but continue with others
          }

          // Generate unique key to prevent duplicates
          const appointmentKey = getAppointmentKey(trustee.trusteeId, appointmentInput);

          // Skip if already exists or already processed
          if (existingKeys.has(appointmentKey) || processedKeys.has(appointmentKey)) {
            context.logger.debug(
              MODULE_NAME,
              `Skipping existing/duplicate appointment ${appointmentKey}`,
            );
            continue;
          }

          processedKeys.add(appointmentKey);

          context.logger.debug(MODULE_NAME, `Creating appointment ${appointmentKey}`);
          await repo.createAppointment(trustee.trusteeId, appointmentInput, SYSTEM_USER);
          created++;
        } catch (createError) {
          context.logger.error(MODULE_NAME, `Failed to create appointment for court ${courtId}`, {
            error: getCamsError(createError, MODULE_NAME).message,
          });
        }
      }

      // Log cleansing notes if present
      if (cleansingResult.notes.length > 0) {
        context.logger.info(
          MODULE_NAME,
          `Multi-expansion cleansing: ${cleansingResult.notes.join('; ')}`,
          {
            trusteeId: trustee.trusteeId,
            created,
          },
        );
      }

      return { success: created > 0 };
    }

    // Single appointment (1:1 mapping)
    const appointmentInput = cleansingResult.appointment!;

    // Validate appointment type for chapter
    if (!isValidAppointmentForChapter(appointmentInput.chapter, appointmentInput.appointmentType)) {
      context.logger.warn(
        MODULE_NAME,
        `Invalid appointment type ${appointmentInput.appointmentType} for chapter ${appointmentInput.chapter}`,
      );

      return {
        success: false,
        failedAppointment: {
          trusteeId: trustee.trusteeId,
          truId,
          atsAppointment,
          classification: CleansingClassification.UNCLEANSABLE,
          notes: [
            ...cleansingResult.notes,
            `Invalid appointment type ${appointmentInput.appointmentType} for chapter ${appointmentInput.chapter}`,
          ],
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Generate unique key to prevent duplicates
    const appointmentKey = getAppointmentKey(trustee.trusteeId, appointmentInput);

    // Skip if appointment already exists in database (idempotency)
    if (existingKeys.has(appointmentKey)) {
      context.logger.debug(MODULE_NAME, `Skipping existing appointment ${appointmentKey}`);
      return { success: true, skipped: true };
    }

    // Skip if we've already processed this appointment in this batch (duplicate in source data)
    if (processedKeys.has(appointmentKey)) {
      context.logger.debug(
        MODULE_NAME,
        `Skipping duplicate appointment in batch ${appointmentKey}`,
      );
      return { success: true, skipped: true };
    }

    processedKeys.add(appointmentKey);

    // Log cleansing notes if present (especially for AUTO_RECOVERABLE)
    if (cleansingResult.notes.length > 0) {
      context.logger.info(
        MODULE_NAME,
        `Appointment cleansed: ${cleansingResult.notes.join('; ')}`,
        {
          trusteeId: trustee.trusteeId,
          classification: cleansingResult.classification,
        },
      );
    }

    context.logger.debug(MODULE_NAME, `Creating appointment ${appointmentKey}`);
    await repo.createAppointment(trustee.trusteeId, appointmentInput, SYSTEM_USER);

    return { success: true };
  } catch (appointmentError) {
    // Catch-all for unexpected errors during appointment creation
    const camsError = getCamsError(appointmentError, MODULE_NAME);

    context.logger.error(
      MODULE_NAME,
      `Failed to process appointment for trustee ${trustee.trusteeId}`,
      {
        error: camsError.message,
        appointment: atsAppointment,
      },
    );

    return {
      success: false,
      failedAppointment: {
        trusteeId: trustee.trusteeId,
        truId,
        atsAppointment,
        classification: CleansingClassification.UNCLEANSABLE,
        notes: [`Unexpected error: ${camsError.message}`],
        timestamp: new Date().toISOString(),
      },
    };
  }
}
