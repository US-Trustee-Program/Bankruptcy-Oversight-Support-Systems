import { vi } from 'vitest';

import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import HealthcheckSqlDb from './healthcheck.db.sql';
import { AbstractMssqlClient } from '../../../lib/adapters/gateways/abstract-mssql-client';
import { QueryResults } from '../../../lib/adapters/types/database';

describe('healthcheck.db.sql', () => {
  let context: ApplicationContext;
  let healthcheckSqlDb: HealthcheckSqlDb;
  let querySpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    healthcheckSqlDb = new HealthcheckSqlDb(context);
    querySpy = vi.spyOn(AbstractMssqlClient.prototype, 'executeQuery');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('should return true when database query returns records', async () => {
    querySpy.mockResolvedValue({
      success: true,
      results: { recordset: [{ id: 1 }] },
      message: '',
    } as QueryResults);

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(true);
    expect(querySpy).toHaveBeenCalled();
  });

  test('should return false when database query returns no records', async () => {
    querySpy.mockResolvedValue({
      success: true,
      results: { recordset: [] },
      message: '',
    } as QueryResults);

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(false);
    expect(querySpy).toHaveBeenCalled();
  });

  test('should handle errors and return false', async () => {
    const error = new Error('Database connection error');
    querySpy.mockRejectedValueOnce(error);

    const loggerErrorSpy = vi.spyOn(context.logger, 'error');

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(false);
    expect(loggerErrorSpy).toHaveBeenCalledWith('HEALTHCHECK-SQL-DB', error.message, error);
  });
});
