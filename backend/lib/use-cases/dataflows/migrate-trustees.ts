import { ApplicationContext } from '../../adapters/types/basic';
import {
  AtsTrusteeRecord,
  TrusteeAppointmentsResult,
  FailedAppointment,
} from '../../adapters/types/ats.types';
import { transformTrusteeRecord } from '../../adapters/gateways/ats/cleansing/ats-mappings';
import { getCamsError } from '../../common-errors/error-utilities';
import factory from '../../factory';
import { MaybeData } from './queue-types';
import { Trustee } from '@common/cams/trustees';
import { TrusteeAppointmentInput } from '@common/cams/trustee-appointments';
import { getAppointmentKey } from '../../adapters/gateways/ats/cleansing/ats-cleansing-utils';
import { CamsUserReference } from '@common/cams/users';
import { LegacyAddress } from '@common/cams/parties';
import { normalizeName } from './trustee-match.helpers';

const MODULE_NAME = 'MIGRATE-TRUSTEES-USE-CASE';

/**
 * System user reference for audit trail
 */
const SYSTEM_USER: CamsUserReference = {
  id: 'SYSTEM',
  name: 'ATS Migration',
};

/**
 * Merged trustee data from multiple TOD records
 */
type MergedTrusteeData = {
  primary: AtsTrusteeRecord;
  todIds: string[];
  additionalAddresses: LegacyAddress[];
  allAppointments: TrusteeAppointmentInput[];
};

/**
 * Generate a deduplication key for a trustee based on normalized name and state.
 * Key format: "firstName|lastName|state"
 *
 * @param atsTrustee - ATS trustee record
 * @returns Deduplication key string
 */
export function getTrusteeDedupeKey(atsTrustee: AtsTrusteeRecord): string {
  const firstName = normalizeName(atsTrustee.FIRST_NAME || '');
  const lastName = normalizeName(atsTrustee.LAST_NAME || '');
  const state = (atsTrustee.STATE || '').trim().toUpperCase();

  return `${firstName}|${lastName}|${state}`;
}

/**
 * Deduplicate trustees in a page by name and state.
 * Groups trustees by (firstName, lastName, state) compound key.
 *
 * @param trustees - Array of ATS trustee records
 * @returns Map of dedup key to array of matching trustee records
 */
export function deduplicateTrusteesInPage(
  trustees: AtsTrusteeRecord[],
): Map<string, AtsTrusteeRecord[]> {
  const deduplicatedMap = new Map<string, AtsTrusteeRecord[]>();

  for (const trustee of trustees) {
    const key = getTrusteeDedupeKey(trustee);

    if (!deduplicatedMap.has(key)) {
      deduplicatedMap.set(key, []);
    }

    deduplicatedMap.get(key)!.push(trustee);
  }

  return deduplicatedMap;
}

/**
 * Calculate address completeness score for an ATS trustee record.
 * Counts non-null/non-empty address fields.
 *
 * @param atsTrustee - ATS trustee record
 * @returns Completeness score (higher is more complete)
 */
function calculateAddressScore(atsTrustee: AtsTrusteeRecord): number {
  let score = 0;

  if (atsTrustee.STREET) score++;
  if (atsTrustee.STREET1) score++;
  if (atsTrustee.CITY) score++;
  if (atsTrustee.STATE) score++;
  if (atsTrustee.ZIP) score++;
  if (atsTrustee.ZIP_PLUS) score++;
  if (atsTrustee.TELEPHONE) score++;
  if (atsTrustee.EMAIL_ADDRESS) score++;
  if (atsTrustee.COMPANY) score++;

  return score;
}

/**
 * Select the primary record from multiple trustee records based on address completeness.
 * Chooses the record with the most complete address data.
 * Uses ID as a tiebreaker for consistent selection.
 *
 * @param records - Array of ATS trustee records (same person, different TOD IDs)
 * @returns Primary record with the most complete address
 */
function selectPrimaryRecord(records: AtsTrusteeRecord[]): AtsTrusteeRecord {
  if (records.length === 0) {
    throw new Error('Cannot select primary record from empty array');
  }

  if (records.length === 1) {
    return records[0];
  }

  // Score each record and select the one with highest score
  const scoredRecords = records.map((record) => ({
    record,
    score: calculateAddressScore(record),
  }));

  // Sort by score descending (highest first), then by ID ascending for consistency
  scoredRecords.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.record.ID - b.record.ID;
  });

  return scoredRecords[0].record;
}

/**
 * Build additional addresses from non-primary trustee records.
 * Transforms ATS records into LegacyAddress format, filtering out empty addresses.
 *
 * @param records - Array of ATS trustee records (same person, different TOD IDs)
 * @param primary - The primary record (will be excluded from additional addresses)
 * @returns Array of additional addresses in LegacyAddress format
 */
function buildAdditionalAddresses(
  records: AtsTrusteeRecord[],
  primary: AtsTrusteeRecord,
): LegacyAddress[] {
  return records
    .filter((record) => record.ID !== primary.ID)
    .filter(
      (record) =>
        // Only include if address has meaningful data
        record.STREET || record.CITY || record.STATE || record.ZIP,
    )
    .map((record) => {
      const address: LegacyAddress = {};

      if (record.STREET) address.address1 = record.STREET;
      if (record.STREET1) address.address2 = record.STREET1;
      if (record.CITY || record.STATE || record.ZIP) {
        const parts = [];
        if (record.CITY) parts.push(record.CITY);
        if (record.STATE) parts.push(record.STATE);
        if (record.ZIP) {
          const zip = record.ZIP_PLUS ? `${record.ZIP}-${record.ZIP_PLUS}` : record.ZIP;
          parts.push(zip);
        }
        address.cityStateZipCountry = parts.join(', ');
      }

      return address;
    });
}

/**
 * Select the primary address from multiple trustee records.
 * Chooses the record with the most complete address data.
 * Returns the primary record and additional addresses from other records.
 *
 * @param records - Array of ATS trustee records (same person, different TOD IDs)
 * @returns Primary record and array of additional addresses
 */
export function selectPrimaryAddress(records: AtsTrusteeRecord[]): {
  primary: AtsTrusteeRecord;
  additional: LegacyAddress[];
} {
  const primary = selectPrimaryRecord(records);
  const additional = buildAdditionalAddresses(records, primary);
  return { primary, additional };
}

/**
 * Merge multiple trustee records into a single merged data structure.
 * Selects the primary address, collects all TOD IDs, and aggregates appointments.
 *
 * @param records - Array of ATS trustee records for the same person
 * @returns Merged trustee data
 */
export function mergeTrusteeRecords(records: AtsTrusteeRecord[]): MergedTrusteeData {
  const { primary, additional } = selectPrimaryAddress(records);

  // Collect all TOD IDs
  const todIds = records.map((r) => r.ID.toString());

  return {
    primary,
    todIds,
    additionalAddresses: additional,
    allAppointments: [], // Appointments will be fetched and merged separately
  };
}

/**
 * Result of processing a single trustee with appointments
 */
type TrusteeProcessingResult = {
  trusteeId: string;
  truId: string; // comma-joined for backward compatibility
  todIds: string[]; // structured form
  success: boolean;
  appointmentsProcessed: number;
  failedAppointments?: FailedAppointment[];
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
 * Get cleansed appointments for a trustee from ATS gateway.
 * Gateway handles ATS data fetching, cleansing, and transformation.
 * Returns both clean appointments (for storage) and failed appointments (for DLQ).
 */
export async function getTrusteeAppointments(
  context: ApplicationContext,
  trusteeId: number,
): Promise<MaybeData<TrusteeAppointmentsResult>> {
  try {
    const atsGateway = factory.getAtsGateway(context);
    const result = await atsGateway.getTrusteeAppointments(context, trusteeId);

    context.logger.debug(
      MODULE_NAME,
      `Retrieved ${result.cleanAppointments.length} clean, ${result.failedAppointments.length} failed appointments for trustee ${trusteeId}`,
    );

    return { data: result };
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
 * Build a deduplication key for an address based on normalized address1 and cityStateZipCountry.
 * Used to identify duplicate addresses when merging trustees.
 *
 * @param address - Legacy address object
 * @returns Normalized key string for deduplication
 */
function getAddressKey(address: {
  address1?: string | null;
  cityStateZipCountry?: string | null;
}): string {
  const addr1 = (address.address1 ?? '').trim().toLowerCase();
  const cityStateZip = (address.cityStateZipCountry ?? '').trim().toLowerCase();
  return `${addr1}|${cityStateZip}`;
}

/**
 * Upsert a trustee to CAMS MongoDB.
 * Handles deduplication by (firstName, lastName, state).
 * If trustee exists, merges TOD IDs and addresses.
 * Otherwise, creates a new trustee.
 *
 * @param context - Application context
 * @param mergedData - Merged trustee data from multiple TOD records
 * @returns Upserted trustee or error
 */
export async function upsertTrustee(
  context: ApplicationContext,
  mergedData: MergedTrusteeData,
): Promise<MaybeData<Trustee>> {
  try {
    const repo = factory.getTrusteesRepository(context);
    const { primary, todIds, additionalAddresses } = mergedData;

    // Transform primary ATS record to CAMS format
    const trusteeInput = transformTrusteeRecord(primary);

    // Extract name components for dedup check
    const firstName = normalizeName(primary.FIRST_NAME || '');
    const lastName = normalizeName(primary.LAST_NAME || '');
    const state = (primary.STATE || '').trim().toUpperCase();

    if (!firstName || !lastName || !state) {
      context.logger.warn(
        MODULE_NAME,
        `Skipping trustee ${primary.ID} with incomplete name or state: firstName="${firstName}", lastName="${lastName}", state="${state}"`,
      );
      return {
        error: getCamsError(
          new Error('Incomplete name or state'),
          MODULE_NAME,
          `Cannot upsert trustee ${primary.ID} without complete name and state`,
        ),
      };
    }

    // Check if trustee already exists by name and state
    const existingTrustee = await repo.findTrusteeByNameAndState(firstName, lastName, state);

    if (existingTrustee) {
      // Merge TOD IDs and addresses into existing trustee
      context.logger.debug(
        MODULE_NAME,
        `Updating existing trustee ${existingTrustee.trusteeId} with TOD IDs: ${todIds.join(', ')}`,
      );

      // Handle backward compatibility: legacy.truId (singular) vs legacy.truIds (array)
      const existingTodIds: string[] = [];
      if (existingTrustee.legacy?.truIds) {
        existingTodIds.push(...existingTrustee.legacy.truIds);
      } else if (existingTrustee.legacy?.truId) {
        existingTodIds.push(existingTrustee.legacy.truId);
      }

      // Merge TOD IDs (deduplicate)
      const mergedTodIds = Array.from(new Set([...existingTodIds, ...todIds]));

      // Merge addresses with deduplication
      const existingAddresses = existingTrustee.legacy?.addresses || [];
      const existingAddressKeys = new Set(
        existingAddresses.map((address: LegacyAddress) => getAddressKey(address)),
      );

      const dedupedAdditionalAddresses = additionalAddresses.filter((address: LegacyAddress) => {
        const key = getAddressKey(address);
        if (!key || key === '|') return true; // If we can't compute a key, keep the address
        if (existingAddressKeys.has(key)) return false;
        existingAddressKeys.add(key);
        return true;
      });

      const mergedAddresses = [...existingAddresses, ...dedupedAdditionalAddresses];

      const merged = {
        ...existingTrustee,
        ...trusteeInput,
        legacy: {
          ...existingTrustee.legacy,
          ...trusteeInput.legacy,
          truIds: mergedTodIds,
          addresses: mergedAddresses.length > 0 ? mergedAddresses : undefined,
        },
      };

      const updated = await repo.updateTrustee(existingTrustee.trusteeId, merged, SYSTEM_USER);
      return { data: updated };
    } else {
      // Create new trustee with all TOD IDs and addresses
      context.logger.debug(MODULE_NAME, `Creating new trustee with TOD IDs: ${todIds.join(', ')}`);

      const newTrusteeInput = {
        ...trusteeInput,
        legacy: {
          ...trusteeInput.legacy,
          truIds: todIds,
          addresses: additionalAddresses.length > 0 ? additionalAddresses : undefined,
        },
      };

      const created = await repo.createTrustee(newTrusteeInput, SYSTEM_USER);
      return { data: created };
    }
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        `Failed to upsert trustee ${mergedData.primary.ID}`,
      ),
    };
  }
}

/**
 * Create appointments for a trustee (idempotent).
 * Receives clean CAMS domain types from gateway (already cleansed).
 * Fetches existing appointments and only creates new ones that don't already exist.
 * Uses a unique key (trusteeId-courtId-divisionCode-chapter-appointmentType) to prevent duplicates.
 */
export async function createAppointments(
  context: ApplicationContext,
  trustee: Trustee,
  cleanAppointments: TrusteeAppointmentInput[],
): Promise<MaybeData<{ successCount: number }>> {
  try {
    const repo = factory.getTrusteeAppointmentsRepository(context);

    // Fetch existing appointments for idempotency check
    const existingAppointments = await repo.getTrusteeAppointments(trustee.trusteeId);
    const existingKeys = new Set<string>(
      existingAppointments.map((apt) => getAppointmentKey(trustee.trusteeId, apt)),
    );

    const processedKeys = new Set<string>();
    let successCount = 0;
    let skippedCount = 0;

    // Clean appointments are already validated by gateway - just check for duplicates
    for (const appointmentInput of cleanAppointments) {
      const appointmentKey = getAppointmentKey(trustee.trusteeId, appointmentInput);

      // Skip if appointment already exists in database (idempotency)
      if (existingKeys.has(appointmentKey)) {
        context.logger.debug(MODULE_NAME, `Skipping existing appointment ${appointmentKey}`);
        successCount++;
        skippedCount++;
        continue;
      }

      // Skip if we've already processed this appointment in this batch (duplicate in source data)
      if (processedKeys.has(appointmentKey)) {
        context.logger.debug(
          MODULE_NAME,
          `Skipping duplicate appointment in batch ${appointmentKey}`,
        );
        successCount++;
        skippedCount++;
        continue;
      }

      processedKeys.add(appointmentKey);

      context.logger.debug(MODULE_NAME, `Creating appointment ${appointmentKey}`);
      await repo.createAppointment(trustee.trusteeId, appointmentInput, SYSTEM_USER);
      successCount++;
    }

    context.logger.info(
      MODULE_NAME,
      `Processed ${successCount}/${cleanAppointments.length} appointments for trustee ${trustee.trusteeId} (${skippedCount} already existed)`,
    );

    return {
      data: {
        successCount,
      },
    };
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
 * Fetch and aggregate appointments across multiple TOD IDs.
 * Collects all clean and failed appointments, merging statistics.
 *
 * @param context - Application context
 * @param todIds - Array of TOD IDs to fetch appointments for
 * @returns Aggregated appointments, failures, and statistics
 */
async function fetchAndAggregateAppointments(
  context: ApplicationContext,
  todIds: string[],
): Promise<{
  cleanAppointments: TrusteeAppointmentInput[];
  failedAppointments: FailedAppointment[];
  stats: {
    total: number;
    clean: number;
    autoRecoverable: number;
    problematic: number;
    uncleansable: number;
    skipped: number;
  };
}> {
  const allCleanAppointments: TrusteeAppointmentInput[] = [];
  const allFailedAppointments: FailedAppointment[] = [];
  const totalStats = {
    total: 0,
    clean: 0,
    autoRecoverable: 0,
    problematic: 0,
    uncleansable: 0,
    skipped: 0,
  };

  for (const todId of todIds) {
    const appointmentsResult = await getTrusteeAppointments(context, parseInt(todId, 10));
    if (appointmentsResult.error) {
      // Log error but continue processing other TOD IDs
      context.logger.error(MODULE_NAME, `Failed to get appointments for TOD ID ${todId}`, {
        error: appointmentsResult.error.message,
      });
      continue;
    }

    const { cleanAppointments, failedAppointments, stats } = appointmentsResult.data;
    allCleanAppointments.push(...cleanAppointments);
    allFailedAppointments.push(...failedAppointments);

    // Aggregate stats
    totalStats.total += stats.total;
    totalStats.clean += stats.clean;
    totalStats.autoRecoverable += stats.autoRecoverable;
    totalStats.problematic += stats.problematic;
    totalStats.uncleansable += stats.uncleansable;
    totalStats.skipped += stats.skipped;
  }

  return {
    cleanAppointments: allCleanAppointments,
    failedAppointments: allFailedAppointments,
    stats: totalStats,
  };
}

/**
 * Process a single merged trustee group with all their appointments.
 * This is the main unit of work for the migration with deduplication.
 * Gateway handles appointment cleansing - use case just stores clean data.
 *
 * @param context - Application context
 * @param mergedData - Merged trustee data from multiple TOD records
 * @returns Processing result with trustee ID and appointment counts
 */
export async function processTrusteeWithAppointments(
  context: ApplicationContext,
  mergedData: MergedTrusteeData,
): Promise<TrusteeProcessingResult> {
  const { primary, todIds } = mergedData;

  // Guard against malformed trustee records
  if (!primary?.ID) {
    context.logger.error(MODULE_NAME, 'Received malformed trustee record without ID', {
      trustee: primary,
    });
    return {
      trusteeId: '',
      truId: 'UNKNOWN',
      todIds: [],
      success: false,
      appointmentsProcessed: 0,
      failedAppointments: [],
      error: 'Malformed trustee record: missing ID',
    };
  }

  const truId = todIds.join(',');

  try {
    // Upsert the trustee (with deduplication)
    const trusteeResult = await upsertTrustee(context, mergedData);
    if (trusteeResult.error) {
      throw trusteeResult.error;
    }

    const trustee = trusteeResult.data;

    // Fetch and aggregate appointments for all TOD IDs
    const { cleanAppointments, failedAppointments, stats } = await fetchAndAggregateAppointments(
      context,
      todIds,
    );

    let appointmentsProcessed = 0;

    // Process merged clean appointments
    if (cleanAppointments.length > 0) {
      const appointmentResult = await createAppointments(context, trustee, cleanAppointments);

      if (appointmentResult.error) {
        context.logger.error(
          MODULE_NAME,
          `Failed to process appointments for trustee TOD IDs ${truId}`,
          {
            error: appointmentResult.error.message,
          },
        );
      } else {
        appointmentsProcessed = appointmentResult.data.successCount;
      }
    }

    // Log statistics
    context.logger.info(MODULE_NAME, `Trustee TOD IDs ${truId} stats:`, stats);

    return {
      trusteeId: trustee.trusteeId,
      truId,
      todIds,
      success: true,
      appointmentsProcessed,
      failedAppointments,
    };
  } catch (error) {
    const camsError = getCamsError(error, MODULE_NAME);
    context.logger.error(MODULE_NAME, `Failed to process trustee TOD IDs ${truId}`, {
      error: camsError.message,
    });

    return {
      trusteeId: '',
      truId,
      todIds,
      success: false,
      appointmentsProcessed: 0,
      failedAppointments: [],
      error: camsError.message,
    };
  }
}

/**
 * Process a page of trustees with deduplication.
 * Main entry point for batch processing.
 * Deduplicates trustees by (firstName, lastName, state) before processing.
 * Gateway handles appointment cleansing internally.
 * Returns both processing stats and failed appointments for DLQ.
 */
export async function processPageOfTrustees(
  context: ApplicationContext,
  trustees: AtsTrusteeRecord[],
): Promise<
  MaybeData<{
    processed: number;
    appointments: number;
    errors: number;
    failedAppointments: FailedAppointment[];
  }>
> {
  // Deduplicate trustees in this page by (firstName, lastName, state)
  const deduplicatedMap = deduplicateTrusteesInPage(trustees);

  context.logger.info(
    MODULE_NAME,
    `Deduplicated ${trustees.length} trustee records into ${deduplicatedMap.size} unique trustees`,
  );

  let processed = 0;
  let appointments = 0;
  let errors = 0;
  const failedAppointments: FailedAppointment[] = [];

  // Process each deduplicated group
  for (const [dedupeKey, trusteeGroup] of deduplicatedMap.entries()) {
    // Merge the trustee group into a single entity
    const mergedData = mergeTrusteeRecords(trusteeGroup);

    context.logger.debug(
      MODULE_NAME,
      `Processing deduplicated trustee group: ${dedupeKey} (${trusteeGroup.length} TOD records)`,
    );

    const result = await processTrusteeWithAppointments(context, mergedData);

    if (result.success) {
      processed++;
      appointments += result.appointmentsProcessed;

      if (result.failedAppointments && result.failedAppointments.length > 0) {
        failedAppointments.push(...result.failedAppointments);
      }
    } else {
      errors++;
    }
  }

  context.logger.info(
    MODULE_NAME,
    `Page complete: ${processed} unique trustees, ${appointments} appointments, ${failedAppointments.length} failed, ${errors} errors`,
  );

  return {
    data: {
      processed,
      appointments,
      errors,
      failedAppointments,
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
 * Delete all trustees and appointments from MongoDB.
 * Used for clean-slate re-migration scenarios.
 * Returns counts of deleted records for verification.
 */
export async function deleteAllTrusteesAndAppointments(
  context: ApplicationContext,
): Promise<MaybeData<{ deletedTrustees: number; deletedAppointments: number }>> {
  try {
    const trusteesRepo = factory.getTrusteesRepository(context);
    const appointmentsRepo = factory.getTrusteeAppointmentsRepository(context);

    const deletedTrustees = await trusteesRepo.deleteAll();
    context.logger.info(MODULE_NAME, `Deleted ${deletedTrustees} trustees`);

    const deletedAppointments = await appointmentsRepo.deleteAll();
    context.logger.info(MODULE_NAME, `Deleted ${deletedAppointments} trustee appointments`);

    return {
      data: {
        deletedTrustees,
        deletedAppointments,
      },
    };
  } catch (originalError) {
    return {
      error: getCamsError(
        originalError,
        MODULE_NAME,
        'Failed to delete all trustees and appointments',
      ),
    };
  }
}
