import { ApplicationConfiguration } from './application-configuration';

describe('Testing that database configuration is loaded correctly based on environment variables', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
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
    process.env.MSSQL_PASS = 'password';

    const appConfig = new ApplicationConfiguration();
    expect(appConfig.dxtrDbConfig.user).not.toBeNull();
    expect(appConfig.dxtrDbConfig.password).not.toBeNull();
  });
});
