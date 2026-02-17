import { ApplicationContext } from '../../adapters/types/basic';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../adapters/types/ats.types';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/ats-mappings';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { CamsUserReference } from '@common/cams/users';
import { Trustee } from '@common/cams/trustees';
import { processSingleAppointment } from './appointments-sync.helpers';

const MODULE_NAME = 'MIGRATE-TRUSTEES-USE-CASE';

/**
 * Result of processing a single trustee with appointments
 */
type TrusteeProcessingResult = {
  trusteeId: string;
  truId: string;
  success: boolean;
  appointmentsProcessed: number;
  error?: string;
};

/**
 * Result of a page of trustees
 */
type TrusteePageResult = {
  trustees: AtsTrusteeRecord[];
  hasMore: boolean;
  totalProcessed: number;
};

type TrusteePageMaybeResult = MaybeData<TrusteePageResult>;

/**
 * System user reference for audit trail
 */
const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

/**
 * Get a page of trustees from ATS using cursor-based pagination.
 * Uses TRU_ID as the cursor for efficient pagination.
 */
export async function getPageOfTrustees(
  context: ApplicationContext,
  lastTrusteeId: number | null,
  pageSize: number,
): Promise<TrusteePageMaybeResult> {
  try {
    const atsGateway = factory.getAtsGateway(context);

    const trustees = await atsGateway.getTrusteesPage(context, lastTrusteeId, pageSize);

    // Check if there are more trustees
    const hasMore = trustees.length === pageSize;

    context.logger.info(
      MODULE_NAME,
      `Retrieved ${trustees.length} trustees from ATS (lastId: ${lastTrusteeId})`,
    );

    return {
      data: {
        trustees,
        hasMore,
        totalProcessed: trustees.length,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get page of trustees (lastId: ${lastTrusteeId})`,
      ),
    };
  }
}

/**
 * Get all appointments for a trustee from ATS.
 */
export async function getTrusteeAppointments(
  context: ApplicationContext,
  trusteeId: number,
): Promise<MaybeData<AtsAppointmentRecord[]>> {
  try {
    const atsGateway = factory.getAtsGateway(context);
    const appointments = await atsGateway.getTrusteeAppointments(context, trusteeId);

    context.logger.debug(
      MODULE_NAME,
      `Retrieved ${appointments.length} appointments for trustee ${trusteeId}`,
    );

    return { data: appointments };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to get appointments for trustee ${trusteeId}`,
      ),
    };
  }
}

/**
 * Upsert a trustee to CAMS MongoDB.
 * If trustee exists (matched by legacy.truId), update it.
 * Otherwise, create a new trustee.
 */
export async function upsertTrustee(
  context: ApplicationContext,
  atsTrustee: AtsTrusteeRecord,
): Promise<MaybeData<Trustee>> {
  try {
    const repo = factory.getTrusteesRepository(context);

    // Transform ATS record to CAMS format
    const trusteeInput = transformTrusteeRecord(atsTrustee);

    // Check if trustee already exists by legacy.truId using indexed query
    const existingTrustee = await repo.findTrusteeByLegacyTruId(atsTrustee.ID.toString());

    if (existingTrustee) {
      // Merge new data into existing document to preserve fields that replaceOne would strip
      context.logger.debug(MODULE_NAME, `Updating existing trustee ${atsTrustee.ID}`);
      const merged = { ...existingTrustee, ...trusteeInput };
      const updated = await repo.updateTrustee(existingTrustee.trusteeId, merged, SYSTEM_USER);
      return { data: updated };
    } else {
      // Create new trustee
      context.logger.debug(MODULE_NAME, `Creating new trustee ${atsTrustee.ID}`);
      const created = await repo.createTrustee(trusteeInput, SYSTEM_USER);
      return { data: created };
    }
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, `Failed to upsert trustee ${atsTrustee.ID}`),
    };
  }
}

/**
 * Create appointments for a trustee.
 * Uses a unique key (trusteeId-courtId-divisionCode-chapter-appointmentType) to prevent duplicates
 * within the same migration batch.
 */
export async function createAppointments(
  context: ApplicationContext,
  trustee: Trustee,
  atsAppointments: AtsAppointmentRecord[],
): Promise<MaybeData<number>> {
  try {
    const repo = factory.getTrusteeAppointmentsRepository(context);
    const processedKeys = new Set<string>();
    let successCount = 0;

    for (const atsAppointment of atsAppointments) {
      const result = await processSingleAppointment(
        context,
        repo,
        trustee,
        atsAppointment,
        processedKeys,
      );
      if (result.success) successCount++;
    }

    context.logger.info(
      MODULE_NAME,
      `Processed ${successCount}/${atsAppointments.length} appointments for trustee ${trustee.trusteeId}`,
    );

    return { data: successCount };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to create appointments for trustee ${trustee.trusteeId}`,
      ),
    };
  }
}

/**
 * Process a single trustee with all their appointments.
 * This is the main unit of work for the migration.
 */
export async function processTrusteeWithAppointments(
  context: ApplicationContext,
  atsTrustee: AtsTrusteeRecord,
): Promise<TrusteeProcessingResult> {
  const truId = atsTrustee.ID.toString();

  try {
    // Upsert the trustee
    const trusteeResult = await upsertTrustee(context, atsTrustee);
    if (trusteeResult.error) {
      throw trusteeResult.error;
    }

    const trustee = trusteeResult.data;

    // Get and process appointments
    const appointmentsResult = await getTrusteeAppointments(context, atsTrustee.ID);
    if (appointmentsResult.error) {
      // Log error but don't fail the trustee processing
      context.logger.error(MODULE_NAME, `Failed to get appointments for trustee ${truId}`, {
        error: appointmentsResult.error.message,
      });
      return {
        trusteeId: trustee.trusteeId,
        truId,
        success: true,
        appointmentsProcessed: 0,
      };
    }

    const appointments = appointmentsResult.data;
    let appointmentsProcessed = 0;

    if (appointments && appointments.length > 0) {
      const appointmentResult = await createAppointments(context, trustee, appointments);
      if (appointmentResult.error) {
        context.logger.error(MODULE_NAME, `Failed to process appointments for trustee ${truId}`, {
          error: appointmentResult.error.message,
        });
      } else {
        appointmentsProcessed = appointmentResult.data;
      }
    }

    return {
      trusteeId: trustee.trusteeId,
      truId,
      success: true,
      appointmentsProcessed,
    };
  } catch (error) {
    const camsError = getCamsError(error, MODULE_NAME);
    context.logger.error(MODULE_NAME, `Failed to process trustee ${truId}`, {
      error: camsError.message,
    });

    return {
      trusteeId: '',
      truId,
      success: false,
      appointmentsProcessed: 0,
      error: camsError.message,
    };
  }
}

/**
 * Process a page of trustees.
 * Main entry point for batch processing.
 */
export async function processPageOfTrustees(
  context: ApplicationContext,
  trustees: AtsTrusteeRecord[],
): Promise<MaybeData<{ processed: number; appointments: number; errors: number }>> {
  let processed = 0;
  let appointments = 0;
  let errors = 0;

  for (const trustee of trustees) {
    const result = await processTrusteeWithAppointments(context, trustee);

    if (result.success) {
      processed++;
      appointments += result.appointmentsProcessed;
    } else {
      errors++;
    }
  }

  context.logger.info(
    MODULE_NAME,
    `Page complete: ${processed} trustees, ${appointments} appointments, ${errors} errors`,
  );

  return {
    data: {
      processed,
      appointments,
      errors,
    },
  };
}

/**
 * Get the total count of trustees in ATS.
 * Useful for progress tracking and estimation.
 */
export async function getTotalTrusteeCount(
  context: ApplicationContext,
): Promise<MaybeData<number>> {
  try {
    const atsGateway = factory.getAtsGateway(context);
    const count = await atsGateway.getTrusteeCount(context);

    context.logger.info(MODULE_NAME, `Total trustees in ATS: ${count}`);
    return { data: count };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to get total trustee count'),
    };
  }
}
