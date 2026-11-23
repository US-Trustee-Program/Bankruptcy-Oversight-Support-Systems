/**
 * TOD (ATS) trustee IDs reserved for seed data: TRUSTEES.ID and CHAPTER_DETAILS.TRU_ID. Real TOD
 * IDs are far below this range. Seed scenarios use only IDs inside it, and unseed deletes every
 * TOD row inside it.
 */
export const TOD_SEED_ID_MIN = 9_900_000;
export const TOD_SEED_ID_MAX = 9_900_999;
