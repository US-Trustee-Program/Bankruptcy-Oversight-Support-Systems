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
  port: 1433,
  user: process.env.LOCAL_MSSQL_USER || process.env.MSSQL_USER || 'sa',
  password: process.env.LOCAL_MSSQL_PASS || process.env.MSSQL_PASS || 'YourStrong!Passw0rd',
  database: process.env.LOCAL_MSSQL_DATABASE || process.env.MSSQL_DATABASE_DXTR || 'CAMS_E2E',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
  requestTimeout: 60000,
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

  // getOffices — 5-table join that times out on cold SQL Edge if not warmed
  `SELECT a.[CS_DIV_ACMS] AS courtDivisionCode
      ,a.[GRP_DES] AS groupDesignator
      ,a.[COURT_ID] AS courtId
      ,a.[OFFICE_CODE] AS officeCode
      ,a.[STATE] AS state
      ,c.COURT_NAME AS courtName
      ,b.OFFICE_NAME_DISPLAY AS courtDivisionName
      ,d.REGION_ID AS regionId
      ,r.REGION_NAME AS regionName
    FROM [dbo].[AO_CS_DIV] a
    JOIN [dbo].[AO_OFFICE] b on a.COURT_ID = b.COURT_ID and a.OFFICE_CODE = b.OFFICE_CODE
    JOIN [dbo].[AO_COURT] c on a.COURT_ID = c.COURT_ID
    JOIN [dbo].[AO_GRP_DES] d on a.GRP_DES = d.GRP_DES
    JOIN [dbo].[AO_REGION] r on d.REGION_ID = r.REGION_ID
    WHERE b.CAMS = 'Y'
    ORDER BY a.STATE, c.COURT_NAME, b.OFFICE_NAME_DISPLAY`,
];

const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 3000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let pool: sql.ConnectionPool | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      pool = await new sql.ConnectionPool(poolConfig).connect();
      console.log(
        `[${MODULE_NAME}] Connected — running ${WARMUP_QUERIES.length} warmup queries...`,
      );

      for (let i = 0; i < WARMUP_QUERIES.length; i++) {
        await pool.request().query(WARMUP_QUERIES[i]);
        process.stdout.write('.');
      }

      console.log(`\n[${MODULE_NAME}] ✓ SQL Server plan cache warmed`);
      process.exit(0);
    } catch (err: unknown) {
      const error = err as Error;
      if (attempt < MAX_RETRIES) {
        console.log(
          `[${MODULE_NAME}] Connection attempt ${attempt}/${MAX_RETRIES} failed (${error.message}) — retrying in ${RETRY_DELAY_MS / 1000}s...`,
        );
        await sleep(RETRY_DELAY_MS);
      } else {
        console.error(
          `[${MODULE_NAME}] WARNING: Warmup failed after ${MAX_RETRIES} attempts (${error.message}) — continuing anyway`,
        );
      }
    } finally {
      await pool?.close();
      pool = null;
    }
  }

  process.exit(0); // Non-fatal — tests may still pass
}

main();
