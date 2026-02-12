import { vi } from 'vitest';
import { ApplicationConfiguration } from './application-configuration';

describe('Testing that database configuration is loaded correctly based on environment variables', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = {};
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test('should default dbMock to false', () => {
    process.env.DATABASE_MOCK = undefined;
    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dbMock).toBeFalsy();
  });

  test('should set dbMock to true if DATABASE_MOCK env var is true', () => {
    process.env.DATABASE_MOCK = 'true';
    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dbMock).toBeTruthy();
  });

  test('Should contain client id in config when MSSQL_CLIENT_ID is set', async () => {
    const expectedClientId = '12345';
    process.env.MSSQL_CLIENT_ID = expectedClientId;
    process.env.MSSQL_USER = '';
    process.env.MSSQL_PASS = undefined;

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dxtrDbConfig.authentication.type).not.toBeNull();
    expect(appConfig.dxtrDbConfig.authentication.options.clientId).not.toBeNull();
    expect(appConfig.dxtrDbConfig.authentication.options.clientId).toEqual(expectedClientId);
  });

  test('Should default to azure-active-directory-default if no password provided', async () => {
    process.env.MSSQL_USER = 'tester';
    process.env.MSSQL_PASS = undefined;

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dxtrDbConfig.authentication.type).not.toBeNull();
  });

  test('Should use sql auth', async () => {
    process.env.MSSQL_USER = 'tester';
    process.env.MSSQL_PASS = (Math.random() + 1).toString(36);

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dxtrDbConfig.user).not.toBeNull();
    expect(appConfig.dxtrDbConfig.password).not.toBeNull();
  });

  test('Should configure ATS database with SQL auth', async () => {
    process.env.ATS_MSSQL_HOST = 'test-server.database.usgovcloudapi.net';
    process.env.ATS_MSSQL_DATABASE = 'ATS_TEST';
    process.env.ATS_MSSQL_USER = 'atsUser';
    process.env.ATS_MSSQL_PASS = (Math.random() + 1).toString(36).substring(2);
    process.env.ATS_MSSQL_ENCRYPT = 'true';
    process.env.ATS_MSSQL_TRUST_UNSIGNED_CERT = 'true';

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.atsDbConfig).toBeDefined();
    expect(appConfig.atsDbConfig.server).toEqual('test-server.database.usgovcloudapi.net');
    expect(appConfig.atsDbConfig.database).toEqual('ATS_TEST');
    expect(appConfig.atsDbConfig.user).toEqual('atsUser');
    expect(appConfig.atsDbConfig.password).toEqual(process.env.ATS_MSSQL_PASS);
    expect(appConfig.atsDbConfig.options.encrypt).toBeTruthy();
    expect(appConfig.atsDbConfig.options.trustServerCertificate).toBeTruthy();
  });

  test('Should configure ATS database with Azure AD auth when no password', async () => {
    process.env.ATS_MSSQL_HOST = 'test-server.database.usgovcloudapi.net';
    process.env.ATS_MSSQL_DATABASE = 'ATS_TEST';
    process.env.ATS_MSSQL_USER = undefined;
    process.env.ATS_MSSQL_PASS = undefined;
    process.env.ATS_MSSQL_CLIENT_ID = 'ats-client-id-123';

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.atsDbConfig).toBeDefined();
    expect(appConfig.atsDbConfig.authentication).toBeDefined();
    expect(appConfig.atsDbConfig.authentication.type).toEqual('azure-active-directory-default');
    expect(appConfig.atsDbConfig.authentication.options.clientId).toEqual('ats-client-id-123');
  });

  test('Should set ATS database pool configuration', async () => {
    process.env.ATS_MSSQL_DATABASE = 'ATS_TEST';

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.atsDbConfig.pool).toBeDefined();
    expect(appConfig.atsDbConfig.pool.max).toEqual(10);
    expect(appConfig.atsDbConfig.pool.min).toEqual(0);
    expect(appConfig.atsDbConfig.pool.idleTimeoutMillis).toEqual(30000);
  });
});
