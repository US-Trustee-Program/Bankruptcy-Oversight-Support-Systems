#!/usr/bin/env tsx

/**
 * Unseed Script
 *
 * Removes all documents created by seed scenarios from Cosmos and all rows
 * created by seed scenarios from DXTR. Identifies seed data by the stable
 * prefixes used during seeding:
 *
 *   Cosmos:  id starts with "seed-" or matches /^\d{3}-\d{2}-9\d{4}$/  (seed-range caseId)
 *   DXTR:    CS_CASEID starts with "SEED"  (seed-range csCaseId)
 *
 * Also removes documents the application itself writes as a side effect of interacting with
 * seed data, which get real app-generated ids the id-prefix rule above can't match (see the
 * TRUSTEE_VARIATION_COLLECTION and TRUSTEE_MATCH_POLLUTED_COLLECTIONS comments below).
 *
 * Usage:
 *   tsx --env-file=../backend/.env unseed.ts
 */

import { MongoClient } from 'mongodb';
import { createRequire } from 'module';
import { buildSqlConfig } from './db_scripts/lib/sql-config.js';

// Guards against running the script as a side effect of import (e.g. from unseed.test.ts),
// which would otherwise attempt real Mongo/SQL connections and call process.exit during tests.
const isMainModule =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;

const _require = createRequire(import.meta.url);

const sql = _require('mssql') as typeof import('mssql');

const MODULE_NAME = 'UNSEED';

// ─── Throttle retry ──────────────────────────────────────────────────────────

const THROTTLE_ERROR_CODE = 16500;
const MAX_THROTTLE_RETRIES = 8;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 15_000;

// Bounds each find+delete request to this many documents at a time, so an unindexed
// cross-partition scan can't accumulate enough RU cost in one request to blow the
// account's provisioned RU/s and trip throttling (see deleteInChunks below).
const DELETE_BATCH_SIZE = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Cosmos DB's Mongo-API compatibility layer signals RU throttling via error code 16500
// (~HTTP 429), optionally with a RetryAfterMs hint. The raw MongoDB driver has no built-in
// retry for this error class, so a single throttled request aborts the whole script.
function isThrottlingError(error: unknown): boolean {
  if (!(error instanceof Object)) return false;
  const err = error as Record<string, unknown>;
  return err['code'] === THROTTLE_ERROR_CODE || err['code'] === String(THROTTLE_ERROR_CODE);
}

// Only called after isThrottlingError(error) has confirmed error is an Object, so no
// redundant guard is needed here.
function getRetryAfterMs(error: Record<string, unknown>): number | undefined {
  const retryAfterMs = error['RetryAfterMs'];
  return typeof retryAfterMs === 'number' && retryAfterMs > 0 ? retryAfterMs : undefined;
}

// Retries an operation on Cosmos throttling (error 16500) with exponential backoff,
// honoring the server's RetryAfterMs hint when present instead of the computed backoff.
export async function withThrottleRetry<T>(operation: () => Promise<T>, label: string): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await operation();
    } catch (error) {
      if (!isThrottlingError(error) || attempt >= MAX_THROTTLE_RETRIES) {
        throw error;
      }
      const delayMs =
        getRetryAfterMs(error as Record<string, unknown>) ??
        Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
      attempt += 1;
      console.log(
        `[${MODULE_NAME}] Throttled (16500) on ${label}, retrying in ${delayMs}ms (attempt ${attempt}/${MAX_THROTTLE_RETRIES})`,
      );
      await sleep(delayMs);
    }
  }
}

// Minimal shape needed from a MongoDB collection to chunk-delete by filter. Kept narrow
// (rather than importing mongodb's Collection type) so tests can pass simple fakes.
export interface ThrottleRetryableCollection {
  find(
    filter: Record<string, unknown>,
    options: { projection: Record<string, unknown> },
  ): { limit(n: number): { toArray(): Promise<{ _id: unknown }[]> } };
  deleteMany(filter: Record<string, unknown>): Promise<{ deletedCount: number }>;
}

// Deletes documents matching `filter` in bounded batches instead of one unindexed
// cross-partition deleteMany. Each iteration finds up to DELETE_BATCH_SIZE matching _ids
// (bounding scan cost) and deletes just that batch by _id (an indexed, cheap delete),
// making forward progress even if a given batch has to retry after throttling.
export async function deleteInChunks(
  collection: ThrottleRetryableCollection,
  filter: Record<string, unknown>,
  label: string,
): Promise<number> {
  let totalDeleted = 0;
  for (;;) {
    const batch = await withThrottleRetry(
      () =>
        collection
          .find(filter, { projection: { _id: 1 } })
          .limit(DELETE_BATCH_SIZE)
          .toArray(),
      `${label} (find batch)`,
    );
    if (batch.length === 0) break;

    const ids = batch.map((doc) => doc._id);
    const result = await withThrottleRetry(
      () => collection.deleteMany({ _id: { $in: ids } }),
      `${label} (delete batch)`,
    );
    totalDeleted += result.deletedCount;
  }
  return totalDeleted;
}

// ─── Cosmos ──────────────────────────────────────────────────────────────────

const COSMOS_COLLECTIONS: { db: string; name: string }[] = [
  { db: 'cams', name: 'cases' },
  { db: 'cams', name: 'assignments' },
  { db: 'cams', name: 'orders' },
  { db: 'cams', name: 'consolidations' },
  { db: 'cams', name: 'trustees' },
  { db: 'cams', name: 'trustee-appointments' },
  { db: 'cams', name: 'case-trustee-appointments' },
  { db: 'cams', name: 'trustee-case-appointments' },
  { db: 'cams', name: 'trustee-match-verification' },
  { db: 'cams', name: 'banks' },
  { db: 'cams', name: 'bankruptcy-software' },
];

// No scenario file ever seeds this collection (verified) — every document in it in a dev
// environment was written by the application as a side effect of resolving a trustee mismatch.
const TRUSTEE_VARIATION_COLLECTION = { db: 'cams', name: 'trustee-variation' };

// Collections legitimately seeded by many scenario files, so they can't be wiped
// unconditionally — but a real (non-seed) trustee would never carry the
// seed-trustee-match- prefix, unique to trustee-match-all-scenarios.ts's own candidates.
const TRUSTEE_MATCH_POLLUTED_COLLECTIONS = new Set([
  'case-trustee-appointments',
  'trustee-case-appointments',
]);

async function unseedCosmos(): Promise<void> {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  if (!connectionString) throw new Error(`[${MODULE_NAME}] MONGO_CONNECTION_STRING not set`);

  const client = new MongoClient(connectionString);

  try {
    await client.connect();

    const variationDeleted = await deleteInChunks(
      client.db(TRUSTEE_VARIATION_COLLECTION.db).collection(TRUSTEE_VARIATION_COLLECTION.name),
      {},
      TRUSTEE_VARIATION_COLLECTION.name,
    );
    if (variationDeleted > 0) {
      console.log(
        `[${MODULE_NAME}] Deleted ${variationDeleted} doc(s) from ${TRUSTEE_VARIATION_COLLECTION.name}`,
      );
    }

    for (const { db: dbName, name: collectionName } of COSMOS_COLLECTIONS) {
      const db = client.db(dbName);
      const collection = db.collection(collectionName);

      // Delete anything whose id starts with "seed-" OR matches the seed case ID pattern
      const conditions: object[] = [
        { id: { $regex: '^seed-' } },
        { id: { $regex: '^\\d{3}-\\d{2}-9\\d{4}$' } },
      ];
      if (TRUSTEE_MATCH_POLLUTED_COLLECTIONS.has(collectionName)) {
        conditions.push({ trusteeId: { $regex: '^seed-trustee-match-' } });
      }
      const deletedCount = await deleteInChunks(collection, { $or: conditions }, collectionName);

      if (deletedCount > 0) {
        console.log(`[${MODULE_NAME}] Deleted ${deletedCount} doc(s) from ${collectionName}`);
      }
    }
  } finally {
    await client.close();
  }
}

// ─── DXTR ─────────────────────────────────────────────────────────────────────

async function unseedDxtr(): Promise<void> {
  if (!process.env.MSSQL_HOST) {
    console.log(`[${MODULE_NAME}] MSSQL_HOST not set — skipping DXTR cleanup`);
    return;
  }

  const Pool: typeof sql.ConnectionPool =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sql as any).ConnectionPool ?? (sql as any).default?.ConnectionPool;
  const pool = await new Pool(buildSqlConfig('MSSQL')).connect();

  try {
    // AO_PY must be deleted before AO_CS (FK constraint)
    const pyResult = await pool
      .request()
      .query(`DELETE FROM [dbo].[AO_PY] WHERE [CS_CASEID] LIKE 'SEED%'`);
    console.log(`[${MODULE_NAME}] Deleted ${pyResult.rowsAffected[0]} row(s) from AO_PY`);

    const csResult = await pool
      .request()
      .query(`DELETE FROM [dbo].[AO_CS] WHERE [CS_CASEID] LIKE 'SEED%'`);
    console.log(`[${MODULE_NAME}] Deleted ${csResult.rowsAffected[0]} row(s) from AO_CS`);
  } finally {
    await pool.close();
  }
}

// ─── ACMS ─────────────────────────────────────────────────────────────────────

async function unseedAcms(): Promise<void> {
  if (!process.env.ACMS_MSSQL_HOST) {
    console.log(`[${MODULE_NAME}] ACMS_MSSQL_HOST not set — skipping ACMS cleanup`);
    return;
  }

  const Pool: typeof sql.ConnectionPool =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sql as any).ConnectionPool ?? (sql as any).default?.ConnectionPool;
  const pool = await new Pool(buildSqlConfig('ACMS_MSSQL')).connect();

  try {
    // CMMAP must be deleted before CMMPR (FK constraint on PROF_CODE)
    // Seed cases use CASE_NUMBER in the 90000–99999 range
    const cmmapResult = await pool
      .request()
      .query(`DELETE FROM [dbo].[CMMAP] WHERE [CASE_NUMBER] >= 90000`);
    console.log(`[${MODULE_NAME}] Deleted ${cmmapResult.rowsAffected[0]} row(s) from CMMAP`);

    // Professional codes used by seed scripts:
    // - basic.ts: 99901
    // - dxtr-historical-trustees.ts: 11111, 22221, 22222, 33331, 33332, 44444, 55551, 55552, 55553
    const cmmprResult = await pool
      .request()
      .query(
        `DELETE FROM [dbo].[CMMPR] WHERE [PROF_CODE] IN (99901, 11111, 22221, 22222, 33331, 33332, 44444, 55551, 55552, 55553)`,
      );
    console.log(`[${MODULE_NAME}] Deleted ${cmmprResult.rowsAffected[0]} row(s) from CMMPR`);
  } finally {
    await pool.close();
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log(`[${MODULE_NAME}] Removing seed data from Cosmos, DXTR, and ACMS...\n`);
    await unseedDxtr();
    await unseedAcms();
    await unseedCosmos();
    console.log(`\n[${MODULE_NAME}] Done.`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${MODULE_NAME}] ERROR:`, err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

if (isMainModule) {
  main();
}
