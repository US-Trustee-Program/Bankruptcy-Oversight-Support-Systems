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

  test('Should setup Config with default database authentication if AZURE_MANAGED_IDENTITY is 0 length and MSSQL_PASS is not empty', async () => {
    process.env.AZURE_MANAGED_IDENTITY = '';
    process.env.MSSQL_PASS = 'abcdefg';
    const config = new ApplicationConfiguration();

    expect(config.dbConfig.authentication.type).toEqual('default');
  });

  test('Should setup Config with database mock if AZURE_MANAGED_IDENTITY is 0 length and MSSQL_PASS is 0 length and DATABASE_MOCK environment variable is set', async () => {
    process.env.AZURE_MANAGED_IDENTITY = '';
    process.env.MSSQL_PASS = '';
    process.env.DATABASE_MOCK = 'true';
    const config = new ApplicationConfiguration();

    expect(config.dbConfig.authentication.type).toEqual('mock');
  });

  test('Should throw Error if setting up Config and AZURE_MANAGED_IDENTITY is 0 length, MSSQL_PASS is 0 length and DATABASE_MOCK environment variable is false', async () => {
    process.env.AZURE_MANAGED_IDENTITY = '';
    process.env.MSSQL_PASS = '';
    process.env.DATABASE_MOCK = 'false';

    try {
      new ApplicationConfiguration();
    } catch (e) {
      expect(e.message).toBe('No Database authentication type specified');
    }
  });
});
