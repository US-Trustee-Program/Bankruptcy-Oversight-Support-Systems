#!/usr/bin/env tsx

/**
 * SQL Server (Azure SQL Edge) Seeding Script for E2E Tests
 *
 * Reads fixtures/sqlserver-fixture.json (harvested once from dev DXTR, no PII),
 * generates Faker replacements for all nulled PII columns, creates the schema
 * in the local SQL Edge container, and bulk inserts all rows.
 *
 * Self-contained — requires no external database access after the fixture is created.
 *
 * Usage: tsx ./scripts/seed-sqlserver.ts
 */

import { config } from 'dotenv';

config({ path: '.env', quiet: true });

import * as sql from 'mssql';
import { faker } from '@faker-js/faker';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const MODULE_NAME = 'SEED-SQL-E2E';

const targetBaseConfig: sql.config = {
  server: process.env.LOCAL_MSSQL_HOST || process.env.MSSQL_HOST || 'localhost',
  user: process.env.LOCAL_MSSQL_USER || process.env.MSSQL_USER || 'sa',
  password: process.env.LOCAL_MSSQL_PASS || process.env.MSSQL_PASS || 'YourStrong!Passw0rd',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  requestTimeout: 60000,
  connectionTimeout: 30000,
};

const TARGET_DATABASE =
  process.env.LOCAL_MSSQL_DATABASE || process.env.MSSQL_DATABASE_DXTR || 'CAMS_E2E';

interface ColumnInfo {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  NUMERIC_PRECISION: number | null;
  NUMERIC_SCALE: number | null;
  IS_NULLABLE: string;
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

// The transfer-pair taxId is shared across the FROM and TO cases so that the
// "order suggestions" SQL query can find a match and render the radio button table.
// Generated once per seed run so every re-seed uses a fresh (still fake) value.
const TRANSFER_PAIR_TAXID = `${faker.string.numeric(2)}-${faker.string.numeric(7)}`;

// Faker generators for each PII column name.
// Called once per row so each row gets unique values.
type FakerFn = () => string | null;

const PII_GENERATORS: Record<string, FakerFn> = {
  // AO_CS — judge name + case title
  JD_FIRST_NAME: () => faker.person.firstName(),
  JD_MIDDLE_NAME: () => (faker.datatype.boolean() ? faker.person.middleName() : null),
  JD_LAST_NAME: () => faker.person.lastName(),
  CS_SHORT_TITLE: () => `In re ${faker.person.lastName()}`,

  // AO_PY / AO_ALIAS — party names
  PY_FIRST_NAME: () => faker.person.firstName(),
  PY_MIDDLE_NAME: () => (faker.datatype.boolean() ? faker.person.middleName() : null),
  PY_LAST_NAME: () => faker.person.lastName(),
  PY_GENERATION: () => (faker.datatype.boolean() ? faker.person.suffix() : null),

  // AO_PY — address
  PY_ADDRESS1: () => faker.location.streetAddress(),
  PY_ADDRESS2: () => (faker.datatype.boolean() ? faker.location.secondaryAddress() : null),
  PY_ADDRESS3: () => null,
  PY_CITY: () => faker.location.city(),
  PY_STATE: () => faker.location.state({ abbreviated: true }),
  PY_ZIP: () => faker.location.zipCode('#####'),
  PY_COUNTRY: () => 'US',

  // AO_PY — contact
  PY_PHONENO: () => faker.phone.number({ style: 'national' }),
  PY_E_MAIL: () => faker.internet.email(),

  // AO_PY / AO_SSN — SSN (fake format: ###-##-####)
  PY_SSN: () => `${faker.string.numeric(3)}-${faker.string.numeric(2)}-${faker.string.numeric(4)}`,

  // AO_PY / AO_TAXID — EIN (fake format: ##-#######)
  PY_TAXID: () => `${faker.string.numeric(2)}-${faker.string.numeric(7)}`,

  // AO_AT — attorney names
  AT_FIRST_NAME: () => faker.person.firstName(),
  AT_MIDDLE_NAME: () => (faker.datatype.boolean() ? faker.person.middleName() : null),
  AT_LAST_NAME: () => faker.person.lastName(),
  AT_GENERATION: () => (faker.datatype.boolean() ? faker.person.suffix() : null),

  // AO_AT — attorney address
  AT_ADDRESS1: () => faker.location.streetAddress(),
  AT_ADDRESS2: () => (faker.datatype.boolean() ? faker.location.secondaryAddress() : null),
  AT_ADDRESS3: () => null,
  AT_CITY: () => faker.location.city(),
  AT_STATE: () => faker.location.state({ abbreviated: true }),
  AT_ZIP: () => faker.location.zipCode('#####'),
  AT_COUNTRY: () => 'US',

  // AO_AT — attorney contact
  AT_PHONENO: () => faker.phone.number({ style: 'national' }),
  AT_E_MAIL: () => faker.internet.email(),
  AT_OFFICE: () => faker.company.name(),

  // AO_DE — docket text (strip real content, replace with placeholder)
  DO_SUMMARY_TEXT: () => faker.lorem.sentence(),
  DT_TEXT: () => faker.lorem.paragraph(),
};

function applyFakerPii(
  tableName: string,
  rows: Record<string, unknown>[],
  columns: ColumnInfo[],
): Record<string, unknown>[] {
  // Find which columns in this table have null values (were PII-stripped during harvest)
  const colNames = new Set(columns.map((c) => c.COLUMN_NAME));
  const piiCols = [...colNames].filter(
    (col) => col in PII_GENERATORS && rows.some((r) => r[col] === null),
  );

  if (piiCols.length === 0) return rows;

  console.log(`    [${tableName}] Generating Faker PII for: ${piiCols.join(', ')}`);

  return rows.map((row) => {
    const out = { ...row };
    for (const col of piiCols) {
      if (out[col] === null) {
        out[col] = PII_GENERATORS[col]();
      }
    }
    return out;
  });
}

/**
 * Align the AO_PY taxId for the known transfer pair so that getSuggestedCases()
 * returns at least one result and the "case not listed" radio button renders.
 *
 * The SQL suggestions query matches cases by PY_TAXID (or PY_SSN). After
 * Faker substitution each row gets an independent random taxId, so the FROM
 * and TO cases would never match. This function overwrites both rows with the
 * same pre-generated TRANSFER_PAIR_TAXID.
 *
 * Transfer pair: 081-65-67641 (FROM) → 091-69-12345 (TO)
 */
function alignTransferPairTaxId(
  aoPyRows: Record<string, unknown>[],
  fixture: Fixture,
): Record<string, unknown>[] {
  const TRANSFER_FROM_CASE = '081-65-67641';
  const TRANSFER_TO_CASE = '091-69-12345';

  const divRows = fixture.tables.AO_CS_DIV?.rows ?? [];
  const csRows = fixture.tables.AO_CS?.rows ?? [];

  function lookupCsCaseId(caseId: string): string | null {
    const [divCode, year, num] = caseId.split('-');
    const divRow = divRows.find((r) => r.CS_DIV_ACMS === divCode);
    if (!divRow) return null;
    const csRow = csRows.find((r) => r.CS_DIV === divRow.CS_DIV && r.CASE_ID === `${year}-${num}`);
    return csRow ? String(csRow.CS_CASEID) : null;
  }

  const fromId = lookupCsCaseId(TRANSFER_FROM_CASE);
  const toId = lookupCsCaseId(TRANSFER_TO_CASE);

  if (!fromId || !toId) {
    console.warn(
      '    [AO_PY] WARNING: Could not resolve transfer pair CS_CASEIDs — suggestions may be empty',
    );
    return aoPyRows;
  }

  console.log(`    [AO_PY] Aligning transfer pair taxId (CS_CASEID ${fromId} ↔ ${toId})`);
  return aoPyRows.map((row) => {
    if (String(row.CS_CASEID) === fromId || String(row.CS_CASEID) === toId) {
      return { ...row, PY_TAXID: TRANSFER_PAIR_TAXID };
    }
    return row;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMssqlType(col: ColumnInfo): any {
  const type = col.DATA_TYPE.toLowerCase();
  const charLen = col.CHARACTER_MAXIMUM_LENGTH;
  const len = charLen === -1 ? sql.MAX : (charLen ?? 255);

  switch (type) {
    case 'int':
      return sql.Int();
    case 'bigint':
      return sql.BigInt();
    case 'smallint':
      return sql.SmallInt();
    case 'tinyint':
      return sql.TinyInt();
    case 'bit':
      return sql.Bit();
    case 'varchar':
      return sql.VarChar(len);
    case 'nvarchar':
      return sql.NVarChar(len);
    case 'char':
      return sql.Char(len);
    case 'nchar':
      return sql.NChar(len);
    case 'text':
      return sql.VarChar(sql.MAX);
    case 'ntext':
      return sql.NVarChar(sql.MAX);
    case 'decimal':
      return sql.Decimal(col.NUMERIC_PRECISION ?? 18, col.NUMERIC_SCALE ?? 0);
    case 'numeric':
      return sql.Numeric(col.NUMERIC_PRECISION ?? 18, col.NUMERIC_SCALE ?? 0);
    case 'float':
      return sql.Float();
    case 'real':
      return sql.Real();
    case 'datetime':
      return sql.DateTime();
    case 'datetime2':
      return sql.DateTime2();
    case 'date':
      return sql.Date();
    case 'time':
      return sql.Time();
    case 'smalldatetime':
      return sql.SmallDateTime();
    case 'money':
      return sql.Money();
    case 'smallmoney':
      return sql.SmallMoney();
    case 'uniqueidentifier':
      return sql.UniqueIdentifier();
    default:
      return sql.VarChar(sql.MAX);
  }
}

function buildColumnSqlType(col: ColumnInfo): string {
  const type = col.DATA_TYPE.toLowerCase();
  if (['varchar', 'nvarchar', 'char', 'nchar'].includes(type)) {
    const len = col.CHARACTER_MAXIMUM_LENGTH === -1 ? 'MAX' : col.CHARACTER_MAXIMUM_LENGTH;
    return `${col.DATA_TYPE.toUpperCase()}(${len})`;
  }
  if (['decimal', 'numeric'].includes(type)) {
    return `${col.DATA_TYPE.toUpperCase()}(${col.NUMERIC_PRECISION}, ${col.NUMERIC_SCALE})`;
  }
  return col.DATA_TYPE.toUpperCase();
}

async function createTable(
  pool: sql.ConnectionPool,
  tableName: string,
  columns: ColumnInfo[],
): Promise<void> {
  const columnDefs = columns
    .map((col) => {
      const typeDef = buildColumnSqlType(col);
      const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';
      return `  [${col.COLUMN_NAME}] ${typeDef} ${nullable}`;
    })
    .join(',\n');

  await pool.request().query(`
    IF OBJECT_ID('dbo.${tableName}', 'U') IS NOT NULL
      DROP TABLE [dbo].[${tableName}]
  `);

  await pool.request().query(`
    CREATE TABLE [dbo].[${tableName}] (
${columnDefs}
    )
  `);
}

async function bulkInsert(
  pool: sql.ConnectionPool,
  tableName: string,
  columns: ColumnInfo[],
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;

  const table = new sql.Table(`[dbo].[${tableName}]`);
  table.create = false;

  for (const col of columns) {
    table.columns.add(col.COLUMN_NAME, getMssqlType(col), { nullable: col.IS_NULLABLE === 'YES' });
  }

  for (const row of rows) {
    table.rows.add(...columns.map((col) => (row[col.COLUMN_NAME] ?? null) as string));
  }

  await pool.request().bulk(table);
}

async function seedTable(
  pool: sql.ConnectionPool,
  tableName: string,
  tableFixture: TableFixture,
  fullFixture: Fixture,
): Promise<void> {
  process.stdout.write(`  ${tableName}... `);

  if (tableFixture.columns.length === 0) {
    console.log('SKIP (no fixture data)');
    return;
  }

  await createTable(pool, tableName, tableFixture.columns);
  let rows = applyFakerPii(tableName, tableFixture.rows, tableFixture.columns);
  if (tableName === 'AO_PY') {
    rows = alignTransferPairTaxId(rows, fullFixture);
  }
  await bulkInsert(pool, tableName, tableFixture.columns, rows);
  console.log(`${rows.length} rows`);
}

async function main() {
  const fixturePath = resolve(__dirname, '../fixtures/sqlserver-fixture.json');

  let fixture: Fixture;
  try {
    fixture = JSON.parse(readFileSync(fixturePath, 'utf-8')) as Fixture;
  } catch {
    console.error(`[${MODULE_NAME}] ERROR: Cannot read fixture file at ${fixturePath}`);
    console.error(`[${MODULE_NAME}] Run harvest-sqlserver.ts first to generate the fixture.`);
    process.exit(1);
  }

  console.log(`[${MODULE_NAME}] Starting SQL Server seeding from fixture...`);
  console.log(`[${MODULE_NAME}] Fixture harvested: ${fixture.harvestedAt}`);
  console.log(`[${MODULE_NAME}] Source case IDs: ${fixture.sourceCaseIds.length}`);
  console.log(`[${MODULE_NAME}] Target: ${targetBaseConfig.server}/${TARGET_DATABASE}`);

  let masterPool: sql.ConnectionPool | null = null;
  let targetPool: sql.ConnectionPool | null = null;

  try {
    // Create database via master connection
    masterPool = await new sql.ConnectionPool(targetBaseConfig).connect();
    await masterPool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = '${TARGET_DATABASE}')
        CREATE DATABASE [${TARGET_DATABASE}]
    `);
    await masterPool.close();
    masterPool = null;

    targetPool = await new sql.ConnectionPool({
      ...targetBaseConfig,
      database: TARGET_DATABASE,
    }).connect();
    console.log(`[${MODULE_NAME}] ✓ Connected to ${TARGET_DATABASE}`);

    // Seed in dependency order: lookup tables first, then case tables
    const tableOrder = [
      'AO_COURT',
      'AO_REGION',
      'AO_GRP_DES',
      'AO_CS_DIV',
      'AO_OFFICE',
      'AO_PDF_PATH',
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

    for (const tableName of tableOrder) {
      const tableFixture = fixture.tables[tableName];
      if (tableFixture) {
        await seedTable(targetPool, tableName, tableFixture, fixture);
      } else {
        console.log(`  ${tableName}... SKIP (not in fixture)`);
      }
    }

    console.log(`\n[${MODULE_NAME}] ✓ SQL Server seeded successfully`);
    process.exit(0);
  } catch (error: unknown) {
    const err = error as Error;
    console.error(`[${MODULE_NAME}] ERROR:`, err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await masterPool?.close();
    await targetPool?.close();
  }
}

main();
