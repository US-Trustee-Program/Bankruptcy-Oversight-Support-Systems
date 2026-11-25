import { ApplicationContext } from '../../../types/basic';
import {
  AtsAppointmentRecord,
  FailedAppointment,
  TrusteeAppointmentsResult,
} from '../../../types/ats.types';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { cleanseAndMapAppointment } from './ats-cleansing-pipeline';
import { CleansingClassification, TrusteeOverride } from './ats-cleansing-types';
import { transformAppointmentRecord } from './ats-cleansing-transform';

/**
 * Cleanses one TOD trustee's raw appointment rows the way the trustee migration does: SKIP rows
 * are dropped and counted, PROBLEMATIC and UNCLEANSABLE rows are returned as failed, and the rest
 * become CAMS appointments, one per court ID when a row maps to several. Logs under moduleName, the
 * caller's module.
 */
export function cleanseAppointments(
  context: ApplicationContext,
  moduleName: string,
  trusteeId: number,
  atsAppointments: AtsAppointmentRecord[],
  overridesCache: Map<string, TrusteeOverride[]>,
): TrusteeAppointmentsResult {
  const cleanAppointments: TrusteeAppointmentInput[] = [];
  const failedAppointments: FailedAppointment[] = [];
  const stats = {
    total: atsAppointments.length,
    clean: 0,
    autoRecoverable: 0,
    problematic: 0,
    uncleansable: 0,
    skipped: 0,
  };

  for (const atsAppointment of atsAppointments) {
    const cleansingResult = cleanseAndMapAppointment(
      context,
      String(trusteeId),
      atsAppointment,
      overridesCache,
    );

    // Handle SKIP classification
    if (cleansingResult.classification === CleansingClassification.SKIP) {
      context.logger.debug(moduleName, `Skipping appointment per override directive`, {
        trusteeId,
        notes: cleansingResult.notes,
      });
      stats.skipped++;
      continue;
    }

    // Handle UNCLEANSABLE or PROBLEMATIC - ADD TO FAILED LIST
    if (
      cleansingResult.classification === CleansingClassification.UNCLEANSABLE ||
      cleansingResult.classification === CleansingClassification.PROBLEMATIC
    ) {
      context.logger.warn(
        moduleName,
        `Appointment is ${cleansingResult.classification} for trustee ${trusteeId}`,
        {
          notes: cleansingResult.notes,
        },
      );

      // Add to failed appointments list for DLQ
      failedAppointments.push({
        atsAppointment,
        classification: cleansingResult.classification as 'PROBLEMATIC' | 'UNCLEANSABLE',
        notes: cleansingResult.notes,
        mapType: cleansingResult.mapType,
        timestamp: new Date().toISOString(),
      });

      if (cleansingResult.classification === CleansingClassification.PROBLEMATIC) {
        stats.problematic++;
      } else {
        stats.uncleansable++;
      }

      continue;
    }

    // Track CLEAN vs AUTO_RECOVERABLE
    if (cleansingResult.classification === CleansingClassification.CLEAN) {
      stats.clean++;
    } else if (cleansingResult.classification === CleansingClassification.AUTO_RECOVERABLE) {
      stats.autoRecoverable++;
    }

    // Handle multi-expansion (1:N mapping from cleansing - e.g., regional patterns)
    if (!cleansingResult.appointment && cleansingResult.courtIds.length > 1) {
      context.logger.debug(
        moduleName,
        `Multi-expansion: creating ${cleansingResult.courtIds.length} appointments`,
        {
          trusteeId,
          courtIds: cleansingResult.courtIds,
        },
      );

      for (const courtId of cleansingResult.courtIds) {
        const appointmentInput = transformAppointmentRecord(atsAppointment, courtId);
        cleanAppointments.push(appointmentInput);
      }
    } else if (cleansingResult.appointment) {
      // Single appointment - use as-is
      cleanAppointments.push(cleansingResult.appointment);
    }
  }

  return { cleanAppointments, failedAppointments, stats };
}
