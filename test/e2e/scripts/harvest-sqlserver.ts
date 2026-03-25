#!/usr/bin/env tsx

/**
 * SQL Server Harvest Script (ONE-TIME USE)
 *
 * Connects to the dev DXTR Azure SQL database, extracts records for all case IDs
 * currently in the MongoDB E2E database, nulls out PII columns, and writes a
 * fixture file to fixtures/sqlserver-fixture.json.
 *
 * The fixture file is committed to the repo and used by seed-sqlserver.ts to
 * populate the local SQL Edge container. PII is replaced with Faker data at
 * seed time — nothing sensitive is stored in the fixture.
 *
 * Usage:
 *   SOURCE_MSSQL_HOST=<host> \
 *   SOURCE_MSSQL_DATABASE=<db> \
 *   SOURCE_MSSQL_USER=<user> \
 *   SOURCE_MSSQL_PASS=<pass> \
 *   tsx ./scripts/harvest-sqlserver.ts
 *
 * Or set SOURCE_MSSQL_* vars in .env before running.
 */

import { config } from 'dotenv';

config({ path: '.env', quiet: true });

import * as sql from 'mssql';
import { MongoClient } from 'mongodb';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const MODULE_NAME = 'HARVEST-SQL';

const sourceConfig: sql.config = {
  server: process.env.SOURCE_MSSQL_HOST || process.env.MSSQL_HOST,
  database:
    process.env.SOURCE_MSSQL_DATABASE || process.env.SOURCE_MSSQL_DATABASE_DXTR || 'AODATEX_SUB',
  user: process.env.SOURCE_MSSQL_USER || process.env.MSSQL_USER,
  password: process.env.SOURCE_MSSQL_PASS || process.env.MSSQL_PASS,
  options: {
    encrypt: (process.env.SOURCE_MSSQL_ENCRYPT ?? process.env.MSSQL_ENCRYPT ?? 'true') !== 'false',
    trustServerCertificate: true,
  },
  requestTimeout: 120000,
  connectionTimeout: 30000,
};

// Lookup tables — all rows, no case filter
const LOOKUP_TABLES = [
  'AO_COURT',
  'AO_REGION',
  'AO_GRP_DES',
  'AO_CS_DIV',
  'AO_OFFICE',
  'AO_PDF_PATH',
];

// Case tables — filtered by CS_CASEID + COURT_ID
const CASE_TABLES = [
  'AO_CS',
  'AO_TX',
  'AO_PY',
  'AO_ALIAS',
  'AO_SSN',
  'AO_TAXID',
  'AO_AT',
  'AO_DC',
  'AO_DE',
];

// PII columns to null out before writing the fixture.
// Keyed by table name; '*' applies to any table containing that column name.
const PII_COLUMNS: Record<string, string[]> = {
  AO_CS: ['JD_FIRST_NAME', 'JD_MIDDLE_NAME', 'JD_LAST_NAME', 'CS_SHORT_TITLE'],
  AO_PY: [
    'PY_FIRST_NAME',
    'PY_MIDDLE_NAME',
    'PY_LAST_NAME',
    'PY_GENERATION',
    'PY_ADDRESS1',
    'PY_ADDRESS2',
    'PY_ADDRESS3',
    'PY_CITY',
    'PY_STATE',
    'PY_ZIP',
    'PY_COUNTRY',
    'PY_PHONENO',
    'PY_E_MAIL',
    'PY_SSN',
    'PY_TAXID',
  ],
  AO_ALIAS: ['PY_FIRST_NAME', 'PY_MIDDLE_NAME', 'PY_LAST_NAME', 'PY_GENERATION'],
  AO_SSN: ['PY_SSN'],
  AO_TAXID: ['PY_TAXID'],
  AO_AT: [
    'AT_FIRST_NAME',
    'AT_MIDDLE_NAME',
    'AT_LAST_NAME',
    'AT_GENERATION',
    'AT_ADDRESS1',
    'AT_ADDRESS2',
    'AT_ADDRESS3',
    'AT_CITY',
    'AT_STATE',
    'AT_ZIP',
    'AT_COUNTRY',
    'AT_PHONENO',
    'AT_E_MAIL',
    'AT_OFFICE',
  ],
  AO_DE: ['DO_SUMMARY_TEXT', 'DT_TEXT'],
};

interface ColumnInfo {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  NUMERIC_PRECISION: number | null;
  NUMERIC_SCALE: number | null;
  IS_NULLABLE: string;
}

interface CaseKey {
  csCaseId: number;
  courtId: string;
}

interface TableFixture {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
}

interface Fixture {
  harvestedAt: string;
  sourceCaseIds: string[];
  tables: Record<string, TableFixture>;
}

async function getCaseIdsFromMongo(): Promise<string[]> {
  const connectionString =
    process.env.MONGO_CONNECTION_STRING || 'mongodb://localhost:27017/cams-e2e?retrywrites=false';
  const dbName = process.env.COSMOS_DATABASE_NAME || 'cams-e2e';

  console.log(`[${MODULE_NAME}] Fetching case IDs from MongoDB (${dbName})...`);
  const client = await MongoClient.connect(connectionString);
  const db = client.db(dbName);
  const cases = await db
    .collection('cases')
    .find({}, { projection: { caseId: 1, _id: 0 } })
    .toArray();
  await client.close();

  const caseIds = cases.map((c) => c.caseId as string).filter(Boolean);
  console.log(`[${MODULE_NAME}] Found ${caseIds.length} case IDs in MongoDB`);
  return caseIds;
}

async function resolveCaseKeys(pool: sql.ConnectionPool, caseIds: string[]): Promise<CaseKey[]> {
  if (caseIds.length === 0) return [];

  const allKeys: CaseKey[] = [];
  const chunkSize = 100;

  for (let i = 0; i < caseIds.length; i += chunkSize) {
    const chunk = caseIds.slice(i, i + chunkSize);
    const placeholders = chunk.map((_, idx) => `@id${idx}`).join(', ');
    const request = pool.request();
    chunk.forEach((id, idx) => request.input(`id${idx}`, sql.VarChar(20), id));

    const result = await request.query<{ CS_CASEID: number; COURT_ID: string }>(`
      SELECT DISTINCT cs.CS_CASEID, cs.COURT_ID
      FROM [dbo].[AO_CS] cs
      JOIN [dbo].[AO_CS_DIV] cs_div ON cs.CS_DIV = cs_div.CS_DIV
      WHERE cs_div.CS_DIV_ACMS + '-' + cs.CASE_ID IN (${placeholders})
    `);
    allKeys.push(...result.recordset.map((r) => ({ csCaseId: r.CS_CASEID, courtId: r.COURT_ID })));
  }

  console.log(`[${MODULE_NAME}] Resolved ${allKeys.length} DXTR case keys`);
  return allKeys;
}

async function getColumnDefs(pool: sql.ConnectionPool, tableName: string): Promise<ColumnInfo[]> {
  const result = await pool.request().input('tableName', sql.VarChar(128), tableName)
    .query<ColumnInfo>(`
      SELECT
        COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH,
        NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `);
  return result.recordset;
}

function stripPii(tableName: string, rows: Record<string, unknown>[]): Record<string, unknown>[] {
  const piiCols = new Set(PII_COLUMNS[tableName] ?? []);
  if (piiCols.size === 0) return rows;

  return rows.map((row) => {
    const clean: Record<string, unknown> = { ...row };
    for (const col of piiCols) {
      if (col in clean) clean[col] = null;
    }
    return clean;
  });
}

async function harvestTable(
  pool: sql.ConnectionPool,
  tableName: string,
  caseKeys?: CaseKey[],
): Promise<TableFixture> {
  process.stdout.write(`  ${tableName}... `);

  const columns = await getColumnDefs(pool, tableName);
  if (columns.length === 0) {
    console.log('SKIP (not found in source)');
    return { columns: [], rows: [] };
  }

  let rows: Record<string, unknown>[];

  if (caseKeys && caseKeys.length > 0) {
    const hasCsCaseId = columns.some((c) => c.COLUMN_NAME === 'CS_CASEID');
    const hasCourtId = columns.some((c) => c.COLUMN_NAME === 'COURT_ID');

    if (hasCsCaseId && hasCourtId) {
      // SQL Server max 2100 params; 2 per key → max 1000 keys per chunk
      const chunkSize = 1000;
      const allRows: Record<string, unknown>[] = [];
      for (let i = 0; i < caseKeys.length; i += chunkSize) {
        const chunk = caseKeys.slice(i, i + chunkSize);
        const valueRows = chunk.map((_, idx) => `(@caseId${idx}, @courtId${idx})`).join(', ');
        const request = pool.request();
        chunk.forEach((key, idx) => {
          request.input(`caseId${idx}`, sql.Int, key.csCaseId);
          request.input(`courtId${idx}`, sql.VarChar(10), key.courtId);
        });
        const result = await request.query(`
          SELECT t.*
          FROM [dbo].[${tableName}] t
          INNER JOIN (VALUES ${valueRows}) AS keys(csCaseId, courtId)
            ON t.CS_CASEID = keys.csCaseId AND t.COURT_ID = keys.courtId
        `);
        allRows.push(...result.recordset);
      }
      rows = allRows;
    } else {
      const result = await pool.request().query(`SELECT * FROM [dbo].[${tableName}]`);
      rows = result.recordset;
    }
  } else {
    const result = await pool.request().query(`SELECT * FROM [dbo].[${tableName}]`);
    rows = result.recordset;
  }

  const cleanRows = stripPii(tableName, rows);
  console.log(
    `${cleanRows.length} rows (${Object.keys(PII_COLUMNS[tableName] ?? {}).length > 0 ? 'PII stripped' : 'no PII'})`,
  );
  return { columns, rows: cleanRows };
}

async function main() {
  console.log(`[${MODULE_NAME}] Starting one-time harvest from DXTR...`);
  console.log(`[${MODULE_NAME}] Source: ${sourceConfig.server}/${sourceConfig.database}`);

  let pool: sql.ConnectionPool | null = null;

  try {
    const caseIds = await getCaseIdsFromMongo();
    if (caseIds.length === 0) {
      console.error(`[${MODULE_NAME}] No case IDs found in MongoDB. Seed MongoDB first.`);
      process.exit(1);
    }

    console.log(`[${MODULE_NAME}] Connecting to source DXTR...`);
    pool = await new sql.ConnectionPool(sourceConfig).connect();
    console.log(`[${MODULE_NAME}] ✓ Connected`);

    const caseKeys = await resolveCaseKeys(pool, caseIds);
    if (caseKeys.length === 0) {
      console.error(`[${MODULE_NAME}] No DXTR case keys resolved. Check case IDs exist in DXTR.`);
      process.exit(1);
    }

    const fixture: Fixture = {
      harvestedAt: new Date().toISOString(),
      sourceCaseIds: caseIds,
      tables: {},
    };

    console.log(`[${MODULE_NAME}] Harvesting lookup tables...`);
    for (const table of LOOKUP_TABLES) {
      fixture.tables[table] = await harvestTable(pool, table);
    }

    console.log(`[${MODULE_NAME}] Harvesting case tables...`);
    for (const table of CASE_TABLES) {
      fixture.tables[table] = await harvestTable(pool, table, caseKeys);
    }

    const fixtureDir = resolve(__dirname, '../fixtures');
    mkdirSync(fixtureDir, { recursive: true });
    const fixturePath = resolve(fixtureDir, 'sqlserver-harvested.json');
    writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));

    console.log(`\n[${MODULE_NAME}] ✓ Harvest written to fixtures/sqlserver-harvested.json`);
    console.log(`[${MODULE_NAME}]   Tables: ${Object.keys(fixture.tables).length}`);
    console.log(`[${MODULE_NAME}]   Case IDs: ${caseIds.length}`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${MODULE_NAME}] ERROR:`, err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await pool?.close();
  }
}

main();
