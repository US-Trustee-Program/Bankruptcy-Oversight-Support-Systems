/**
 * Sentinel trustee ID written for a CASE_APPOINTMENT whose ACMS professional id could not be
 * mapped to a real trustee at the time of writing. Read by the mongo repository layer (to
 * exclude sentinel rows from "active appointment" queries), the case-appointment history read,
 * and the backfill/heal dataflows that clean up legacy sentinel rows. Moved out of
 * migrate-case-appointments-constants.ts (cams-fd8qd.1.11) since that dataflow was deleted but
 * this ID's rows and the code that reads them were not.
 */
export const SENTINEL_TRUSTEE_ID = '00000000-0000-0000-0000-000000000000';
