/**
 * Shared constants for the migrate-case-appointments dataflow.
 * Must be kept in sync between handler and use-case.
 */

// Azure Function execution budget (matches host.json functionTimeout of 01:00:00).
// Used as the upper bound for the writePage escape hatch calculation.
// 4-minute safety buffer: 60 min - 4 min = 56 min
export const SAFE_THRESHOLD_MS = 56 * 60 * 1000;

// Rows fetched from ACMS per handleStart continuation invocation.
export const DEFAULT_FETCH_SIZE = 2500;
// Upper bound — matches the original hardcoded value and the ACMS query timeout budget.
export const MAX_FETCH_SIZE = 10000;

// Records per write queue message. Azure Storage Queue limit is 64KB base64-encoded,
// which is ~48KB raw. ResolvedAcmsRecord serializes to ~280 bytes with denormalized fields —
// 100 records ≈ 28KB raw / 37KB base64, well within 64KB limit.
export const WRITE_BATCH_SIZE = 100;
