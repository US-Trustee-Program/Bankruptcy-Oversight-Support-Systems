/**
 * Shared ACMS dataflow constants. SENTINEL_TRUSTEE_ID moved to ../cases/sentinel-trustee.ts
 * (cams-fd8qd.1.11) since migrate-case-appointments, the dataflow this file was named for, is
 * deleted; DEFAULT_FETCH_SIZE (AcmsTrusteeAppointmentSource) and WRITE_BATCH_SIZE
 * (migrate-trustees.ts) are still live.
 */

// Rows fetched from ACMS per region/date page.
export const DEFAULT_FETCH_SIZE = 2500;

// Records per write queue message. Azure Storage Queue limit is 64KB base64-encoded,
// which is ~48KB raw. ResolvedAcmsRecord serializes to ~280 bytes with denormalized fields —
// 100 records ≈ 28KB raw / 37KB base64, well within 64KB limit.
export const WRITE_BATCH_SIZE = 100;
