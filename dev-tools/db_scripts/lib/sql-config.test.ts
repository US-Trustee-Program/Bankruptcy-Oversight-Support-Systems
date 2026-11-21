import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { buildAtsSqlConfig } from './sql-config.js';

const ATS_VARS = [
  'ATS_MSSQL_HOST',
  'ATS_MSSQL_PORT',
  'ATS_MSSQL_DATABASE',
  'ATS_MSSQL_ENCRYPT',
  'ATS_MSSQL_TRUST_UNSIGNED_CERT',
  'ATS_MSSQL_AUTH_TYPE',
  'ATS_MSSQL_USER',
  'ATS_MSSQL_PASS',
  'ATS_MSSQL_CLIENT_ID',
];

describe('buildAtsSqlConfig', () => {
  let saved: Record<string, string | undefined>;

  beforeEach(() => {
    saved = Object.fromEntries(ATS_VARS.map((name) => [name, process.env[name]]));
    ATS_VARS.forEach((name) => delete process.env[name]);
  });

  afterEach(() => {
    Object.entries(saved).forEach(([name, value]) => {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    });
  });

  test('should connect with SQL auth from the ATS_MSSQL_* variables', () => {
    Object.assign(process.env, {
      ATS_MSSQL_HOST: 'tod.example.net',
      ATS_MSSQL_PORT: '1444',
      ATS_MSSQL_DATABASE: 'ATS_DEV',
      ATS_MSSQL_ENCRYPT: 'true',
      ATS_MSSQL_TRUST_UNSIGNED_CERT: 'TRUE',
      ATS_MSSQL_USER: 'seeder',
      ATS_MSSQL_PASS: 'secret',
    });

    expect(buildAtsSqlConfig()).toEqual(
      expect.objectContaining({
        server: 'tod.example.net',
        port: 1444,
        database: 'ATS_DEV',
        options: { encrypt: true, trustServerCertificate: true },
        user: 'seeder',
        password: 'secret',
      }),
    );
  });

  test('should use the configured auth type and client ID when no user and password are set', () => {
    Object.assign(process.env, {
      ATS_MSSQL_AUTH_TYPE: 'azure-active-directory-msi-app-service',
      ATS_MSSQL_CLIENT_ID: 'client-1',
    });

    const config = buildAtsSqlConfig();

    expect(config.user).toBeUndefined();
    expect(config.authentication).toEqual({
      type: 'azure-active-directory-msi-app-service',
      options: { clientId: 'client-1' },
    });
  });

  test('should default to localhost, port 1433, database ATS and Azure AD default auth', () => {
    expect(buildAtsSqlConfig()).toEqual(
      expect.objectContaining({
        server: 'localhost',
        port: 1433,
        database: 'ATS',
        options: { encrypt: false, trustServerCertificate: false },
        authentication: { type: 'azure-active-directory-default' },
      }),
    );
  });
});
