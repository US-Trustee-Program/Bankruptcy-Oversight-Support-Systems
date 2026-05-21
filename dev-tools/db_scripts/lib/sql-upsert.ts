import * as sql from 'mssql';

/**
 * Upserts rows into a SQL Server table via MERGE statement.
 *
 * Reads connection config from environment variables based on dbPrefix:
 * - dxtr: MSSQL_HOST, MSSQL_DATABASE_DXTR, MSSQL_USER, MSSQL_PASS, etc.
 * - acms: ACMS_MSSQL_HOST, ACMS_MSSQL_DATABASE, ACMS_MSSQL_USER, ACMS_MSSQL_PASS, etc.
 *
 * Falls back to Azure AD auth (azure-active-directory-default) if user/pass not set.
 * Logs each upserted row and closes the connection pool in a finally block.
 *
 * @param dbPrefix - Database identifier ('dxtr' or 'acms')
 * @param tableName - SQL table name (e.g., 'AO_CS', 'AO_PY')
 * @param rows - Array of rows to upsert
 * @param primaryKey - Column name(s) to use as primary key(s) for MERGE
 * @param insertOnly - When true, omit WHEN MATCHED UPDATE branch (insert-only semantics)
 */
export async function sqlUpsert(
  dbPrefix: 'dxtr' | 'acms',
  tableName: string,
  rows: Record<string, unknown>[],
  primaryKey: string | string[],
  insertOnly?: boolean,
): Promise<void> {
  const keys = Array.isArray(primaryKey) ? primaryKey : [primaryKey];
  const config = buildSqlConfig(dbPrefix);
  let pool: sql.ConnectionPool | null = null;

  try {
    // mssql is CJS; under tsx the namespace import resolves ConnectionPool via .default at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Pool: typeof sql.ConnectionPool =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sql as any).ConnectionPool ?? (sql as any).default?.ConnectionPool;
    pool = await new Pool(config).connect();

    for (const row of rows) {
      for (const key of keys) {
        if (!(key in row)) {
          throw new Error(
            `[SEED] Row missing primary key '${key}' in table '${tableName}': ${JSON.stringify(row)}`,
          );
        }
      }

      await upsertRow(pool, tableName, row, keys, insertOnly);
      const keyValues = keys.map((k) => `${k}=${row[k]}`).join(',');
      console.log(`[SEED] ${tableName} ${keyValues}`);
    }
  } finally {
    await pool?.close();
  }
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
  insertOnly?: boolean,
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

  const mergeQuery = `
    MERGE INTO [dbo].[${tableName}] AS target
    USING (SELECT ${usingSelect}) AS source
    ON ${onClause}
    ${whenMatchedBranch}
    WHEN NOT MATCHED THEN
      INSERT (${insertColumns})
      VALUES (${insertValues});
  `;

  const request = pool.request();
  for (const [key, value] of Object.entries(row)) {
    request.input(key, value ?? null);
  }

  await request.query(mergeQuery);
}
