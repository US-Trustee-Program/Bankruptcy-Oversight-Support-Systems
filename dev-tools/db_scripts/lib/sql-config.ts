import type * as sql from 'mssql';

/**
 * Builds mssql connection config for DXTR or ACMS databases.
 *
 * Uses SQL auth if MSSQL_USER/MSSQL_PASS are set, otherwise Azure AD auth.
 * Database name comes from MSSQL_DATABASE_DXTR or ACMS_MSSQL_DATABASE env var.
 *
 * @param dbPrefix - 'MSSQL' for DXTR, 'ACMS_MSSQL' for ACMS
 */
export function buildSqlConfig(dbPrefix: 'MSSQL' | 'ACMS_MSSQL'): sql.config {
  const hostEnv = dbPrefix === 'MSSQL' ? 'MSSQL_HOST' : 'ACMS_MSSQL_HOST';
  const dbEnv = dbPrefix === 'MSSQL' ? 'MSSQL_DATABASE_DXTR' : 'ACMS_MSSQL_DATABASE';
  const userEnv = dbPrefix === 'MSSQL' ? 'MSSQL_USER' : 'ACMS_MSSQL_USER';
  const passEnv = dbPrefix === 'MSSQL' ? 'MSSQL_PASS' : 'ACMS_MSSQL_PASS';

  const config: sql.config = {
    server: process.env[hostEnv] || 'localhost',
    database: process.env[dbEnv] || (dbPrefix === 'MSSQL' ? 'DXTR' : 'ACMS'),
    options: {
      encrypt: process.env.MSSQL_ENCRYPT?.toLowerCase() === 'true',
      trustServerCertificate: process.env.MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true',
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };

  const user = process.env[userEnv];
  const pass = process.env[passEnv];

  if (user && pass) {
    config.user = user;
    config.password = pass;
  } else {
    const authType = process.env.MSSQL_AUTH_TYPE || 'azure-active-directory-default';
    const clientId = process.env.MSSQL_CLIENT_ID;
    config.authentication = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mssql auth type is a string literal union
      type: authType as any,
      ...(clientId && { options: { clientId } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting full object to satisfy mssql types
    } as any;
  }

  return config;
}

/**
 * Builds mssql connection config for TOD (ATS) from the ATS_MSSQL_* variables, read the same way
 * the dataflows app reads them (backend/lib/configs/application-configuration.ts), so a seed
 * writes to the TOD database the trustee data report reads.
 *
 * Uses SQL auth if ATS_MSSQL_USER/ATS_MSSQL_PASS are set, otherwise ATS_MSSQL_AUTH_TYPE
 * (default azure-active-directory-default) with optional ATS_MSSQL_CLIENT_ID.
 */
export function buildAtsSqlConfig(): sql.config {
  const config: sql.config = {
    server: process.env.ATS_MSSQL_HOST || 'localhost',
    port: Number(process.env.ATS_MSSQL_PORT) || 1433,
    database: process.env.ATS_MSSQL_DATABASE || 'ATS',
    options: {
      encrypt: process.env.ATS_MSSQL_ENCRYPT?.toLowerCase() === 'true',
      trustServerCertificate: process.env.ATS_MSSQL_TRUST_UNSIGNED_CERT?.toLowerCase() === 'true',
    },
    requestTimeout: 60000,
    connectionTimeout: 30000,
  };

  const user = process.env.ATS_MSSQL_USER;
  const pass = process.env.ATS_MSSQL_PASS;
  if (user && pass) {
    config.user = user;
    config.password = pass;
  } else {
    const clientId = process.env.ATS_MSSQL_CLIENT_ID;
    config.authentication = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mssql auth type is a string literal union
      type: (process.env.ATS_MSSQL_AUTH_TYPE || 'azure-active-directory-default') as any,
      ...(clientId && { options: { clientId } }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- casting full object to satisfy mssql types
    } as any;
  }

  return config;
}
