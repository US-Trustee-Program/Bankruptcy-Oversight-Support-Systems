import { vi } from 'vitest';
import { ApplicationConfiguration } from './application-configuration';
import { generateTestCredential } from '../testing/testing-utilities';

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
    process.env.MSSQL_PASS = generateTestCredential();

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dxtrDbConfig.user).not.toBeNull();
    expect(appConfig.dxtrDbConfig.password).not.toBeNull();
  });
});
