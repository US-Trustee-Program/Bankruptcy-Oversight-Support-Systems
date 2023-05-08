describe('Testing that database configuration is loaded correctly based on environment variables', () => {
  const env = process.env;

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...env }
  })

  afterEach(() => {
    process.env = env
  })

  test('Config is setup with default database authentication if AZURE_MANAGED_IDENTITY is 0 length and MSSQL_PASS is not empty', async () => {
    process.env.AZURE_MANAGED_IDENTITY = '';
    process.env.MSSQL_PASS = 'abcdefg';

    const dbConfig = await import('../configs/db.config');
    expect(dbConfig.default.authentication.type).toEqual('default');
  });

  test('Config is setup with database mock if AZURE_MANAGED_IDENTITY is 0 length and MSSQL_PASS is 0 length and DATABASE_MOCK environment variable is set', async () => {
    process.env.AZURE_MANAGED_IDENTITY = '';
    process.env.MSSQL_PASS = '';
    process.env.DATABASE_MOCK = 'true';

    const dbConfig = await import('../configs/db.config');
    expect(dbConfig.default.authentication.type).toEqual('mock');
  });

  test('Config throws Error if AZURE_MANAGED_IDENTITY is 0 length, MSSQL_PASS is 0 length and DATABASE_MOCK environment variable is false', async () => {
    process.env.AZURE_MANAGED_IDENTITY = '';
    process.env.MSSQL_PASS = '';
    process.env.DATABASE_MOCK = 'false';

    try {
      await import('../configs/db.config');
    } catch (e) {
      expect(e.message).toBe('No Database authentication type specified');
    }
  });

});
