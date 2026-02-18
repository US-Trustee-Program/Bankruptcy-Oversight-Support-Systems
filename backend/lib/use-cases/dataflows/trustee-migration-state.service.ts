import { ApplicationContext } from '../../adapters/types/basic';
import { RuntimeState } from '../gateways.types';
import { MaybeData } from './queue-types';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';

const MODULE_NAME = 'TRUSTEE-MIGRATION-STATE';

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

    // Read existing state to merge updates properly
    const existingState = await repo.read('TRUSTEE_MIGRATION_STATE');
    if (!existingState) {
      return {
        error: getCamsError(
          new Error('Migration state not found'),
          MODULE_NAME,
          'Cannot update non-existent migration state',
        ),
      };
    }

    // Merge updates with existing state
    const fullState: TrusteeMigrationState = {
      ...existingState,
      ...updates,
      lastUpdatedAt: new Date().toISOString(),
    };

    await repo.upsert(fullState);

    return { data: undefined };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to update migration state'),
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
