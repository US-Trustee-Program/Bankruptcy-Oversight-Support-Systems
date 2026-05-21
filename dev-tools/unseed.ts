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
 * Usage:
 *   tsx --env-file=../backend/.env unseed.ts
 */

import { MongoClient, Db } from 'mongodb';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

const sql = _require('mssql') as typeof import('mssql');

const MODULE_NAME = 'UNSEED';

// ─── Cosmos ──────────────────────────────────────────────────────────────────

const COSMOS_COLLECTIONS: { db: string; name: string }[] = [
  { db: 'cams', name: 'cases' },
  { db: 'cams', name: 'assignments' },
  { db: 'cams', name: 'orders' },
  { db: 'cams', name: 'consolidations' },
  { db: 'cams', name: 'trustees' },
  { db: 'cams', name: 'trustee-appointments' },
  { db: 'cams', name: 'trustee-match-verification' },
  { db: 'cams', name: 'banks' },
  { db: 'cams', name: 'bankruptcy-software' },
];

async function unseedCosmos(): Promise<void> {
  const connectionString = process.env.MONGO_CONNECTION_STRING;
  if (!connectionString) throw new Error(`[${MODULE_NAME}] MONGO_CONNECTION_STRING not set`);

  const client = new MongoClient(connectionString);

  try {
    await client.connect();

    for (const { db: dbName, name: collectionName } of COSMOS_COLLECTIONS) {
      const db = new Db(client, dbName);
      const collection = db.collection(collectionName);

      // Delete anything whose id starts with "seed-" OR matches the seed case ID pattern
      const result = await collection.deleteMany({
        $or: [{ id: { $regex: '^seed-' } }, { id: { $regex: '^\\d{3}-\\d{2}-9\\d{4}$' } }],
      });

      if (result.deletedCount > 0) {
        console.log(
          `[${MODULE_NAME}] Deleted ${result.deletedCount} doc(s) from ${collectionName}`,
        );
      }
    }
  } finally {
    await client.close();
  }
}

// ─── DXTR ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildDxtrConfig(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: any = {
    server: process.env.MSSQL_HOST || 'localhost',
    database: process.env.MSSQL_DATABASE_DXTR || 'DXTR',
    options: {
      encrypt: process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true',
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };

  const user = process.env.MSSQL_USER;
  const pass = process.env.MSSQL_PASS;

  if (user && pass) {
    config.user = user;
    config.password = pass;
  } else {
    const authType = process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-default';
    const clientId = process.env.MSSQL_CLIENT_ID;
    config.authentication = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      type: authType as any,
      ...(clientId && { options: { clientId } }),
    };
  }

  return config;
}

async function unseedDxtr(): Promise<void> {
  if (!process.env.MSSQL_HOST) {
    console.log(`[${MODULE_NAME}] MSSQL_HOST not set — skipping DXTR cleanup`);
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Pool: typeof sql.ConnectionPool =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sql as any).ConnectionPool ?? (sql as any).default?.ConnectionPool;
  const pool = await new Pool(buildDxtrConfig()).connect();

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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  try {
    console.log(`[${MODULE_NAME}] Removing seed data from Cosmos and DXTR...\n`);
    await unseedDxtr();
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

main();
