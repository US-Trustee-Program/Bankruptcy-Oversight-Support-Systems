#!/usr/bin/env tsx

/**
 * SQL Server Warmup Script for E2E Tests
 *
 * Fires the same join patterns that the DXTR gateway uses in getCaseSummary and
 * getCaseDetail so SQL Server compiles execution plans and loads data pages into
 * the buffer pool before Playwright begins. Without this, the first test that
 * hits a case detail page times out waiting for cold-start query compilation.
 *
 * Safe to run against an empty database — all queries use LEFT JOIN or WHERE EXISTS
 * patterns that return empty result sets gracefully.
 *
 * Usage: tsx ./scripts/warmup-sqlserver.ts
 */

import { config } from 'dotenv';

config({ path: '.env', quiet: true });

import * as sql from 'mssql';

const MODULE_NAME = 'WARMUP-SQL-E2E';

const poolConfig: sql.config = {
  server: process.env.LOCAL_MSSQL_HOST || process.env.MSSQL_HOST || 'localhost',
  user: process.env.LOCAL_MSSQL_USER || process.env.MSSQL_USER || 'sa',
  password: process.env.LOCAL_MSSQL_PASS || process.env.MSSQL_PASS || 'YourStrong!Passw0rd',
  database: process.env.LOCAL_MSSQL_DATABASE || process.env.MSSQL_DATABASE_DXTR || 'CAMS_E2E',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  requestTimeout: 30000,
  connectionTimeout: 15000,
};

// Mirrors the core join patterns in the DXTR gateway:
//   getCaseSummary  → AO_CS + AO_PY (debtor/joint debtor)
//   getCaseDetail   → AO_TX (transaction dates), AO_PY (trustee), AO_AT (attorney)
//   getSuggestedCases → AO_CS + AO_PY join on PY_TAXID/PY_SSN
const WARMUP_QUERIES = [
  // getCaseSummary core path
  `SELECT TOP 1 cs.CS_CASEID, cs.CASE_ID, cs.CS_DIV, cs.CS_SHORT_TITLE, cs.CS_DATE_FILED
     FROM dbo.AO_CS cs
     LEFT JOIN dbo.AO_CS_DIV div ON cs.CS_DIV = div.CS_DIV`,

  // getCaseSummary debtor party
  `SELECT TOP 1 py.CS_CASEID, py.PY_ROLE, py.PY_FIRST_NAME, py.PY_LAST_NAME, py.PY_TAXID, py.PY_SSN
     FROM dbo.AO_PY py
     WHERE py.PY_ROLE = 'db'`,

  // getCaseDetail transaction dates
  `SELECT TOP 1 tx.CS_CASEID, tx.TX_TYPE, tx.TX_CODE, tx.TX_DATE
     FROM dbo.AO_TX tx
     WHERE tx.TX_TYPE = '1' AND tx.TX_CODE = '1'`,

  // getCaseDetail trustee
  `SELECT TOP 1 py.CS_CASEID, py.PY_ROLE, py.PY_FIRST_NAME, py.PY_LAST_NAME
     FROM dbo.AO_PY py
     WHERE py.PY_ROLE IN ('tr', 'tp')`,

  // getCaseDetail debtor attorney
  `SELECT TOP 1 at2.CS_CASEID, at2.AT_FIRST_NAME, at2.AT_LAST_NAME, at2.AT_PHONENO, at2.AT_E_MAIL
     FROM dbo.AO_AT at2`,

  // getSuggestedCases taxId join
  `SELECT TOP 1 cs2.CS_CASEID, cs2.CASE_ID, cs2.CS_DIV
     FROM dbo.AO_CS cs2
     INNER JOIN dbo.AO_PY py2 ON cs2.CS_CASEID = py2.CS_CASEID
     WHERE py2.PY_ROLE = 'db' AND py2.PY_TAXID IS NOT NULL`,
];

async function main() {
  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await new sql.ConnectionPool(poolConfig).connect();
    console.log(`[${MODULE_NAME}] Connected — running ${WARMUP_QUERIES.length} warmup queries...`);

    for (let i = 0; i < WARMUP_QUERIES.length; i++) {
      await pool.request().query(WARMUP_QUERIES[i]);
      process.stdout.write('.');
    }

    console.log(`\n[${MODULE_NAME}] ✓ SQL Server plan cache warmed`);
    process.exit(0);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[${MODULE_NAME}] WARNING: Warmup failed (${error.message}) — continuing anyway`);
    process.exit(0); // Non-fatal — tests may still pass
  } finally {
    await pool?.close();
  }
}

main();
