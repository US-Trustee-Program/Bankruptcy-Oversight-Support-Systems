import * as sql from 'mssql';
import { buildAtsSqlConfig } from './sql-config.js';

/**
 * Upserts rows into a SQL Server table via MERGE statement.
 *
 * Reads connection config from environment variables based on dbPrefix:
 * - dxtr: MSSQL_HOST, MSSQL_DATABASE_DXTR, MSSQL_USER, MSSQL_PASS, etc.
 * - acms: ACMS_MSSQL_HOST, ACMS_MSSQL_DATABASE, ACMS_MSSQL_USER, ACMS_MSSQL_PASS, etc.
 * - ats:  ATS_MSSQL_HOST, ATS_MSSQL_DATABASE, ATS_MSSQL_USER, ATS_MSSQL_PASS, etc. (TOD)
 *
 * Falls back to Azure AD auth (azure-active-directory-default) if user/pass not set.
 * Logs each upserted row and closes the connection pool in a finally block.
 *
 * Rows may supply a value for the table's identity column, as the TOD seed does with its reserved
 * TRUSTEES.ID range. Those rows are written with IDENTITY_INSERT on, and afterwards the table's
 * identity counter is reset to where it was, so the database keeps assigning its own IDs from the
 * same place instead of from just past the seed's IDs.
 *
 * @param dbPrefix - Database identifier ('dxtr', 'acms' or 'ats')
 * @param tableName - SQL table name (e.g., 'AO_CS', 'AO_PY')
 * @param rows - Array of rows to upsert
 * @param primaryKey - Column name(s) to use as primary key(s) for MERGE
 * @param insertOnly - When true, omit WHEN MATCHED UPDATE branch (insert-only semantics)
 */
export async function sqlUpsert(
  dbPrefix: 'dxtr' | 'acms' | 'ats',
  tableName: string,
  rows: Record<string, unknown>[],
  primaryKey: string | string[],
  insertOnly?: boolean,
): Promise<void> {
  const keys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  const config = dbPrefix === 'ats' ? buildAtsSqlConfig() : buildSqlConfig(dbPrefix);
  let pool: sql.ConnectionPool | null = null;

  try {
    // mssql is CJS; under tsx the namespace import resolves ConnectionPool via .default at runtime.

    const Pool: typeof sql.ConnectionPool =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sql as any).ConnectionPool ?? (sql as any).default?.ConnectionPool;
    pool = await new Pool(config).connect();

    const identity = rows.length > 0 ? await findIdentity(pool, tableName) : undefined;
    const writesIdentity = !!identity && rows.some((row) => identity.column in row);

    for (const row of rows) {
      for (const key of keys) {
        if (!(key in row)) {
          throw new Error(
            `[SEED] Row missing primary key '${key}' in table '${tableName}': ${JSON.stringify(row)}`,
          );
        }
      }

      await upsertRow(pool, tableName, row, keys, insertOnly, writesIdentity);
      const keyValues = keys.map((k) => `${k}=${row[k]}`).join(',');
      console.log(`[SEED] ${tableName} ${keyValues}`);
    }

    if (writesIdentity && identity.current !== null) {
      await resetIdentity(pool, tableName, identity.current);
    }
  } finally {
    await pool?.close();
  }
}

type TableIdentity = { column: string; current: number | null };

/** The table's identity column, if it has one, and the last identity value it assigned. */
async function findIdentity(
  pool: sql.ConnectionPool,
  tableName: string,
): Promise<TableIdentity | undefined> {
  const { recordset } = await pool
    .request()
    .input('table', `dbo.${tableName}`)
    .query(
      `SELECT c.name AS identityColumn, CAST(IDENT_CURRENT(@table) AS BIGINT) AS identCurrent
       FROM sys.identity_columns c WHERE c.object_id = OBJECT_ID(@table)`,
    );
  const found = recordset?.[0];
  if (!found) return undefined;
  return {
    column: found.identityColumn,
    current: found.identCurrent === null ? null : Number(found.identCurrent),
  };
}

/** Puts the table's identity counter back, so the next database-assigned ID follows `current`. */
async function resetIdentity(
  pool: sql.ConnectionPool,
  tableName: string,
  current: number,
): Promise<void> {
  if (!Number.isSafeInteger(current)) {
    throw new Error(`[SEED] Unexpected identity value ${current} for table '${tableName}'`);
  }
  await pool.request().query(`DBCC CHECKIDENT ('dbo.${tableName}', RESEED, ${current})`);
  console.log(`[SEED] ${tableName} identity counter reset to ${current}`);
}

/**
 * Builds SQL Server connection config from environment variables based on dbPrefix.
 */
function buildSqlConfig(dbPrefix: 'dxtr' | 'acms'): sql.config {
  const envMap =
    dbPrefix === 'dxtr'
      ? {
          host: process.env.MSSQL_HOST || 'localhost',
          database: process.env.MSSQL_DATABASE_DXTR || 'DXTR',
          user: process.env.MSSQL_USER,
          pass: process.env.MSSQL_PASS,
          encrypt: process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true',
          trustCert: process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true',
          authType: process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-default',
          clientId: process.env.MSSQL_CLIENT_ID,
        }
      : {
          host: process.env.ACMS_MSSQL_HOST || 'localhost',
          database: process.env.ACMS_MSSQL_DATABASE || 'ACMS',
          user: process.env.ACMS_MSSQL_USER,
          pass: process.env.ACMS_MSSQL_PASS,
          encrypt: process.env.ACMS_MSSQL_ENCRYPT?.toLowerCase() === 'true',
          trustCert: process.env.ACMS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true',
          authType: process.env.ACMS_MSSQL_AUTH_TYPE || 'azure-active-directory-default',
          clientId: process.env.ACMS_MSSQL_CLIENT_ID,
        };

  const config: sql.config = {
    server: envMap.host,
    database: envMap.database,
    options: {
      encrypt: envMap.encrypt,
      trustServerCertificate: envMap.trustCert,
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };

  const useSqlAuth = envMap.user && envMap.pass;
  if (useSqlAuth) {
    config.user = envMap.user;
    config.password = envMap.pass;
  } else {
    config.authentication = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mssql auth type is a string literal union
      type: envMap.authType as any,
      ...(envMap.clientId && { options: { clientId: envMap.clientId } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting full object to satisfy mssql types
    } as any;
  }

  return config;
}

/**
 * Performs MERGE upsert for a single row.
 * Uses parameterized query to prevent SQL injection.
 */
async function upsertRow(
  pool: sql.ConnectionPool,
  tableName: string,
  row: Record<string, unknown>,
  primaryKeys: string[],
  insertOnly: boolean | undefined,
  writesIdentity: boolean,
): Promise<void> {
  const columns = Object.keys(row);
  const keySet = new Set(primaryKeys);

  // USING clause projects all key columns as parameters
  const usingSelect = primaryKeys.map((k) => `@${k} AS [${k}]`).join(', ');

  // ON clause joins on all key columns
  const onClause = primaryKeys.map((k) => `target.[${k}] = source.[${k}]`).join(' AND ');

  // SET clause excludes all key columns
  const nonKeyColumns = columns.filter((col) => !keySet.has(col));
  const setClause = nonKeyColumns.map((col) => `[${col}] = @${col}`).join(', ');

  const insertColumns = columns.map((col) => `[${col}]`).join(', ');
  const insertValues = columns.map((col) => `@${col}`).join(', ');

  const whenMatchedBranch =
    insertOnly || !setClause ? '' : `WHEN MATCHED THEN\n      UPDATE SET ${setClause}`;

  // IDENTITY_INSERT applies to one connection, and the pool may hand each request a different one,
  // so it is turned on and off in the same batch as the MERGE.
  const merge = `
    MERGE INTO [dbo].[${tableName}] AS target
    USING (SELECT ${usingSelect}) AS source
    ON ${onClause}
    ${whenMatchedBranch}
    WHEN NOT MATCHED THEN
      INSERT (${insertColumns})
      VALUES (${insertValues});
  `;
  const mergeQuery = writesIdentity
    ? `SET IDENTITY_INSERT [dbo].[${tableName}] ON;${merge}SET IDENTITY_INSERT [dbo].[${tableName}] OFF;`
    : merge;

  const request = pool.request();
  for (const [key, value] of Object.entries(row)) {
    request.input(key, value ?? null);
  }

  await request.query(mergeQuery);
}
