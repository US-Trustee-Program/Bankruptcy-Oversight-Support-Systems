import { ApplicationContext } from '../../adapters/types/basic';
import { AtsTrusteeRecord, AtsAppointmentRecord } from '../../adapters/types/ats.types';
import {
  transformTrusteeRecord,
  transformAppointmentRecord,
  isValidAppointmentForChapter,
  getAppointmentKey,
  deriveTrusteeStatus,
  parseTodStatus,
} from '../../adapters/gateways/ats/ats-mappings';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { RuntimeState } from '../gateways.types';
import { MaybeData } from './queue-types';
import { CamsUserReference } from '@common/cams/users';
import { Trustee } from '@common/cams/trustees';

const MODULE_NAME = 'MIGRATE-TRUSTEES-USE-CASE';

/**
 * Runtime state for tracking trustee migration progress.
 * Stored in MongoDB runtime-state collection for resumability.
 */
export type TrusteeMigrationState = RuntimeState & {
  documentType: 'TRUSTEE_MIGRATION_STATE';
  lastTrusteeId: number | null;
  processedCount: number;
  appointmentsProcessedCount: number;
  errors: number;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  divisionMappingVersion: string;
};

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
 * Get or create the migration state document.
 * Used for tracking progress and enabling resume capability.
 */
export async function getOrCreateMigrationState(
  context: ApplicationContext,
): Promise<MaybeData<TrusteeMigrationState>> {
  try {
    const repo = factory.getRuntimeStateRepository<TrusteeMigrationState>(context);

    // Try to find existing state by reading with documentType
    try {
      const existingState = await repo.read('TRUSTEE_MIGRATION_STATE');
      if (existingState) {
        context.logger.info(
          MODULE_NAME,
          `Resuming migration from trustee ID ${existingState.lastTrusteeId}`,
        );
        return { data: existingState };
      }
    } catch (_e) {
      // State doesn't exist yet, create new one
    }

    // Create new state
    const newState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: null,
      processedCount: 0,
      appointmentsProcessedCount: 0,
      errors: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      divisionMappingVersion: '1.0.0', // Track version of division mapping used
    };

    await repo.upsert(newState);
    context.logger.info(MODULE_NAME, 'Starting new trustee migration');
    return { data: newState };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to get or create migration state'),
    };
  }
}

/**
 * Update the migration state with progress.
 */
export async function updateMigrationState(
  context: ApplicationContext,
  updates: Partial<TrusteeMigrationState>,
): Promise<MaybeData<void>> {
  try {
    const repo = factory.getRuntimeStateRepository<TrusteeMigrationState>(context);

    // We need to merge updates with the existing state
    const fullState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      ...updates,
      lastUpdatedAt: new Date().toISOString(),
    } as TrusteeMigrationState;

    await repo.upsert(fullState);

    return { data: undefined };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to update migration state'),
    };
  }
}

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

    // Check if trustee already exists by legacy.truId
    // We need to search through all trustees to find one with matching legacy.truId
    const allTrustees = await repo.listTrustees();
    const existingTrustee = allTrustees.find((t) => t.legacy?.truId === atsTrustee.ID.toString());

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
 * Upsert appointments for a trustee.
 * Uses a unique key (trusteeId-courtId-divisionCode-chapter-appointmentType) to prevent duplicates.
 */
export async function upsertAppointments(
  context: ApplicationContext,
  trustee: Trustee,
  atsAppointments: AtsAppointmentRecord[],
): Promise<MaybeData<number>> {
  try {
    const repo = factory.getTrusteeAppointmentsRepository(context);
    let successCount = 0;
    const processedKeys = new Set<string>();

    for (const atsAppointment of atsAppointments) {
      try {
        // Transform ATS appointment to CAMS format
        const appointmentInput = transformAppointmentRecord(atsAppointment);

        // Validate appointment type for chapter
        if (
          !isValidAppointmentForChapter(appointmentInput.chapter, appointmentInput.appointmentType)
        ) {
          context.logger.warn(
            MODULE_NAME,
            `Invalid appointment type ${appointmentInput.appointmentType} for chapter ${appointmentInput.chapter}`,
          );
          continue;
        }

        // Generate unique key to prevent duplicates
        const appointmentKey = getAppointmentKey(trustee.trusteeId, appointmentInput);

        // Skip if we've already processed this appointment (duplicate in source data)
        if (processedKeys.has(appointmentKey)) {
          context.logger.debug(MODULE_NAME, `Skipping duplicate appointment ${appointmentKey}`);
          continue;
        }

        processedKeys.add(appointmentKey);

        // Check if appointment already exists
        const existingAppointments = await repo.getTrusteeAppointments(trustee.trusteeId);
        const existingAppointment = existingAppointments.find(
          (a) =>
            a.courtId === appointmentInput.courtId &&
            a.divisionCode === appointmentInput.divisionCode &&
            a.chapter === appointmentInput.chapter &&
            a.appointmentType === appointmentInput.appointmentType,
        );

        if (existingAppointment) {
          // Update existing appointment
          context.logger.debug(MODULE_NAME, `Updating existing appointment ${appointmentKey}`);
          await repo.updateAppointment(
            trustee.trusteeId,
            existingAppointment.id,
            appointmentInput,
            SYSTEM_USER,
          );
        } else {
          // Create new appointment
          context.logger.debug(MODULE_NAME, `Creating new appointment ${appointmentKey}`);
          await repo.createAppointment(trustee.trusteeId, appointmentInput, SYSTEM_USER);
        }

        successCount++;
      } catch (appointmentError) {
        // Log error but continue processing other appointments
        context.logger.error(
          MODULE_NAME,
          `Failed to process appointment for trustee ${trustee.trusteeId}`,
          {
            error: getCamsError(appointmentError, MODULE_NAME).message,
            appointment: atsAppointment,
          },
        );
      }
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
        `Failed to upsert appointments for trustee ${trustee.trusteeId}`,
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
      const appointmentResult = await upsertAppointments(context, trustee, appointments);
      if (appointmentResult.error) {
        context.logger.error(MODULE_NAME, `Failed to process appointments for trustee ${truId}`, {
          error: appointmentResult.error.message,
        });
      } else {
        appointmentsProcessed = appointmentResult.data;
      }

      // Derive trustee status from appointment statuses
      const appointmentStatuses = appointments.map((a) => parseTodStatus(a.STATUS).status);
      const derivedStatus = deriveTrusteeStatus(appointmentStatuses);

      if (derivedStatus !== trustee.status) {
        const repo = factory.getTrusteesRepository(context);
        await repo.updateTrustee(
          trustee.trusteeId,
          { ...trustee, status: derivedStatus },
          SYSTEM_USER,
        );
        context.logger.debug(MODULE_NAME, `Updated trustee ${truId} status to '${derivedStatus}'`);
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

/**
 * Mark the migration as completed.
 */
export async function completeMigration(
  context: ApplicationContext,
  state: TrusteeMigrationState,
): Promise<MaybeData<void>> {
  return updateMigrationState(context, {
    ...state,
    status: 'COMPLETED',
    lastUpdatedAt: new Date().toISOString(),
  });
}

/**
 * Mark the migration as failed.
 */
export async function failMigration(
  context: ApplicationContext,
  state: TrusteeMigrationState,
  error: string,
): Promise<MaybeData<void>> {
  context.logger.error(MODULE_NAME, `Migration failed: ${error}`);

  return updateMigrationState(context, {
    ...state,
    status: 'FAILED',
    lastUpdatedAt: new Date().toISOString(),
  });
}
