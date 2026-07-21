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
  ambiguousCount: number;
  errors: number;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  divisionMappingVersion: string;

  // Heal (inverse ACMS→CAMS professional-ID backfill) progress. Tracked as FLAT
  // top-level fields — NOT a nested object — because heal-page handlers run
  // concurrently (dataflows host.json queue batchSize=10) and must update these
  // counters via atomic $inc/$dec (repo.atomicIncrement/atomicDecrement), which
  // only operate on top-level fields. Undefined until a heal run is initialized.
  //
  // Completion is driven by healRecordsRemaining (records, not pages): each page
  // invocation decrements it by the number of records it actually processed
  // (created + alreadyMapped + unmatched). Records re-enqueued by the escape
  // hatch are NOT counted until their re-enqueued page processes them, so the
  // counter converges to 0 exactly once regardless of how many times pages split.
  healStatus?: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  healScanned?: number;
  healPagesTotal?: number; // observability only — initial page count
  healRecordsRemaining?: number; // drives completion (0 → COMPLETED)
  healCreated?: number;
  healAlreadyMapped?: number;
  healUnmatched?: number;
  healStartedAt?: string;
  healLastUpdatedAt?: string;
};

/**
 * Get or create the migration state document.
 * Used for tracking progress and enabling resume capability.
 */
export async function getOrCreateMigrationState(
  context: ApplicationContext,
  reset: boolean = false,
): Promise<MaybeData<TrusteeMigrationState>> {
  try {
    const repo = factory.getRuntimeStateRepository<TrusteeMigrationState>(context);

    if (!reset) {
      try {
        const existingState = await repo.read('TRUSTEE_MIGRATION_STATE');
        if (existingState) {
          context.logger.info(
            MODULE_NAME,
            `Resuming migration from trustee ID ${existingState.lastTrusteeId}`,
          );
          return { data: existingState };
        }
      } catch {
        context.logger.info(MODULE_NAME, 'Migration runtime state not found.');
      }
    }

    // Create new state
    const newState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: null,
      processedCount: 0,
      appointmentsProcessedCount: 0,
      ambiguousCount: 0,
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
 * Read the migration state document without creating one. Returns null when no
 * state exists yet. Use this for read-only guards (e.g. the heal intent checking
 * whether the ATS migration is still IN_PROGRESS) where getOrCreateMigrationState
 * would wrongly materialize an IN_PROGRESS state as a side effect.
 */
export async function readMigrationState(
  context: ApplicationContext,
): Promise<MaybeData<TrusteeMigrationState | null>> {
  try {
    const repo = factory.getRuntimeStateRepository<TrusteeMigrationState>(context);
    try {
      const existingState = await repo.read('TRUSTEE_MIGRATION_STATE');
      return { data: existingState ?? null };
    } catch {
      return { data: null };
    }
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to read migration state'),
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

/**
 * Reset the migration state to start fresh.
 * Used when deleteAll flag is set to begin a clean migration.
 */
export async function resetMigrationState(context: ApplicationContext): Promise<MaybeData<void>> {
  try {
    const repo = factory.getRuntimeStateRepository<TrusteeMigrationState>(context);

    const newState: TrusteeMigrationState = {
      documentType: 'TRUSTEE_MIGRATION_STATE',
      lastTrusteeId: null,
      processedCount: 0,
      appointmentsProcessedCount: 0,
      ambiguousCount: 0,
      errors: 0,
      startedAt: new Date().toISOString(),
      lastUpdatedAt: new Date().toISOString(),
      status: 'IN_PROGRESS',
      divisionMappingVersion: '1.0.0',
    };

    await repo.upsert(newState);
    context.logger.info(MODULE_NAME, 'Migration state reset successfully');

    return { data: undefined };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to reset migration state'),
    };
  }
}

/**
 * Initialize the heal (professional-ID backfill) progress fields on the migration
 * state document. This is a FENCE WRITE: it zeroes all heal counters and sets
 * healPagesRemaining to the total page count BEFORE any heal-page message fires,
 * so the concurrent atomicIncrement/atomicDecrement calls in the page handler
 * always find initialized numeric fields (mirrors the migrate-case-appointments
 * fresh-start fence).
 *
 * Reuses getOrCreateMigrationState so a heal run can proceed even if no ATS
 * migration state exists yet.
 */
export async function initHealState(
  context: ApplicationContext,
  totals: { scanned: number; pagesTotal: number },
): Promise<MaybeData<void>> {
  try {
    const stateResult = await getOrCreateMigrationState(context);
    if (stateResult.error) {
      return { error: stateResult.error };
    }

    const now = new Date().toISOString();
    return updateMigrationState(context, {
      healStatus: totals.scanned === 0 ? 'COMPLETED' : 'IN_PROGRESS',
      healScanned: totals.scanned,
      healPagesTotal: totals.pagesTotal,
      healRecordsRemaining: totals.scanned,
      healCreated: 0,
      healAlreadyMapped: 0,
      healUnmatched: 0,
      healStartedAt: now,
      healLastUpdatedAt: now,
    });
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to initialize heal state'),
    };
  }
}

/**
 * Atomically record the outcome of a single processed heal page:
 * - increment healCreated / healAlreadyMapped / healUnmatched by the page's counts
 * - decrement healRecordsRemaining by the number of records this page actually
 *   PROCESSED (created + alreadyMapped + unmatched) — NOT records the escape hatch
 *   re-enqueued, which are counted only when their re-enqueued page runs.
 *
 * All updates use atomic $inc/$dec so concurrent page handlers do not clobber one
 * another. When healRecordsRemaining reaches 0, healStatus is set to COMPLETED.
 *
 * Returns the remaining record count after the decrement.
 */
export async function recordHealPageResult(
  context: ApplicationContext,
  counts: { created: number; alreadyMapped: number; unmatched: number },
): Promise<MaybeData<number>> {
  try {
    const repo = factory.getRuntimeStateRepository<TrusteeMigrationState>(context);

    if (counts.created > 0) {
      await repo.atomicIncrement('TRUSTEE_MIGRATION_STATE', 'healCreated', counts.created);
    }
    if (counts.alreadyMapped > 0) {
      await repo.atomicIncrement(
        'TRUSTEE_MIGRATION_STATE',
        'healAlreadyMapped',
        counts.alreadyMapped,
      );
    }
    if (counts.unmatched > 0) {
      await repo.atomicIncrement('TRUSTEE_MIGRATION_STATE', 'healUnmatched', counts.unmatched);
    }

    const processed = counts.created + counts.alreadyMapped + counts.unmatched;
    const remaining =
      processed > 0
        ? await repo.atomicIncrement('TRUSTEE_MIGRATION_STATE', 'healRecordsRemaining', -processed)
        : ((await repo.read('TRUSTEE_MIGRATION_STATE')).healRecordsRemaining ?? 0);

    if (remaining <= 0) {
      await updateMigrationState(context, {
        healStatus: 'COMPLETED',
        healLastUpdatedAt: new Date().toISOString(),
      });
    } else {
      await updateMigrationState(context, { healLastUpdatedAt: new Date().toISOString() });
    }

    return { data: remaining };
  } catch (originalError) {
    return {
      error: getCamsError(originalError, MODULE_NAME, 'Failed to record heal page result'),
    };
  }
}
