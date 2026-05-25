/**
 * Helper to ensure a case exists in DXTR before creating CAMS case.
 *
 * Problem: Backend queries DXTR for case details. If case only exists in CAMS,
 * case detail pages fail to load.
 *
 * Solution: Check if case exists in DXTR. If not, seed DXTR tables (AO_CS + AO_PY).
 *
 * Usage:
 * ```typescript
 * const dxtrOps = await ensureDxtrCase(ctx, {
 *   divisionCode: '081',
 *   chapter: '7',
 *   debtorName: 'Test Debtor',
 *   courtId: '0208',
 *   groupDesignator: 'NY',
 * });
 *
 * return [
 *   ...dxtrOps,  // DXTR seeding operations (if case doesn't exist)
 *   { db: 'cams', collectionOrTable: 'cases', data: [...] },  // CAMS case
 * ];
 * ```
 */

import type { SeedContext, SeedOperation } from '../../runner.js';
import sql from 'mssql';

interface DxtrCaseOptions {
  /** Division code (3 digits, e.g., '081') */
  divisionCode: string;
  /** Chapter number ('7', '11', '12', '13', '15', '9') */
  chapter: string;
  /** Debtor name for case title */
  debtorName: string;
  /** Court ID (e.g., '0208') */
  courtId: string;
  /** Group designator (e.g., 'NY', 'BU') */
  groupDesignator: string;
  /** Optional: Override generated case info */
  caseInfo?: {
    caseId: string;
    caseNumber: string;
    csCaseId: string;
  };
}

interface DxtrCaseResult {
  /** Operations to seed DXTR (empty if case already exists) */
  operations: SeedOperation[];
  /** Case info for CAMS seeding */
  caseInfo: {
    caseId: string;
    caseNumber: string;
    csCaseId: string;
  };
  /** Whether case already existed in DXTR */
  existed: boolean;
}

/**
 * Check if case exists in DXTR. If not, return operations to seed DXTR tables.
 */
export async function ensureDxtrCase(
  ctx: SeedContext,
  options: DxtrCaseOptions,
): Promise<DxtrCaseResult> {
  const { divisionCode, chapter, debtorName, courtId, groupDesignator } = options;

  // Generate or use provided case info
  const caseInfo = options.caseInfo || (await ctx.generateCaseId(divisionCode));

  // Check if case exists in DXTR
  const exists = await checkDxtrCase(caseInfo.csCaseId, courtId);

  if (exists) {
    return {
      operations: [],
      caseInfo,
      existed: true,
    };
  }

  // Case doesn't exist - create DXTR seed operations
  const operations: SeedOperation[] = [
    // AO_CS: Case Master
    {
      db: 'dxtr',
      collectionOrTable: 'AO_CS',
      primaryKey: ['CS_CASEID', 'COURT_ID'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: caseInfo.csCaseId,
          COURT_ID: courtId,
          CS_CASE_NUMBER: caseInfo.caseNumber.split('-')[1], // Just the number part
          CS_DIV: divisionCode,
          GRP_DES: groupDesignator,
          CASE_ID: caseInfo.caseNumber,
          CS_SHORT_TITLE: debtorName,
          CS_CHAPTER: chapter,
          CS_TYPE: 'bk',
          CS_FEE_STATUS: 'p',
          CS_JOINT: 'n',
          CS_VOL_INVOL: 'v',
          CS_DATE_FILED: new Date('1999-01-01'),
        },
      ],
    },

    // AO_PY: Party (Debtor)
    {
      db: 'dxtr',
      collectionOrTable: 'AO_PY',
      primaryKey: ['CS_CASEID', 'COURT_ID', 'PY_ROLE'],
      insertOnly: true,
      data: [
        {
          CS_CASEID: caseInfo.csCaseId,
          COURT_ID: courtId,
          PY_ROLE: 'DB', // Debtor (uppercase)
          PY_LAST_NAME: debtorName,
          PY_FIRST_NAME: null,
          PY_MIDDLE_NAME: null,
          PY_ADDRESS1: '123 Test St',
          PY_ADDRESS2: null,
          PY_ADDRESS3: null,
          PY_CITY: 'Test City',
          PY_STATE: 'NY',
          PY_ZIP: '10001',
          PY_COUNTRY: 'United States',
        },
      ],
    },
  ];

  return {
    operations,
    caseInfo,
    existed: false,
  };
}

/**
 * Check if case exists in DXTR AO_CS table
 */
async function checkDxtrCase(csCaseId: string, courtId: string): Promise<boolean> {
  const config: sql.config = {
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
      type: authType as any,
      options: clientId ? { clientId } : undefined,
    };
  }

  let pool: sql.ConnectionPool | null = null;

  try {
    pool = await new sql.ConnectionPool(config).connect();
    const result = await pool
      .request()
      .input('csCaseId', sql.VarChar, csCaseId)
      .input('courtId', sql.VarChar, courtId).query(`
        SELECT CS_CASEID
        FROM AO_CS
        WHERE CS_CASEID = @csCaseId AND COURT_ID = @courtId
      `);

    return result.recordset.length > 0;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}
