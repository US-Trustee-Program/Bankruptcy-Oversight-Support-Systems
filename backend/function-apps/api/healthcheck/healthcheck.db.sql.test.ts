import { vi } from 'vitest';
import { ConnectionPool } from 'mssql';

import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { closeDeferred } from '../../../lib/deferrable/defer-close';
import factory from '../../../lib/factory';
import HealthcheckSqlDb from './healthcheck.db.sql';

describe('healthcheck.db.sql', () => {
  let context: ApplicationContext;
  let healthcheckSqlDb: HealthcheckSqlDb;
  let mockRequestFunc: ReturnType<typeof vi.fn>;
  let mockCloseFunc: ReturnType<typeof vi.fn>;
  let mockConnect: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    context = await createMockApplicationContext();
    healthcheckSqlDb = new HealthcheckSqlDb(context);
  });

  beforeEach(() => {
    mockRequestFunc = vi.fn(() => ({
      input: vi.fn(),
      query: vi.fn().mockResolvedValue({ recordset: [{ id: 1 }] }),
    }));
    mockCloseFunc = vi.fn();
    mockConnect = vi.fn().mockResolvedValue({
      request: mockRequestFunc,
      close: mockCloseFunc,
    });

    vi.spyOn(factory, 'getSqlConnection').mockReturnValue({
      connect: mockConnect,
    } as unknown as ConnectionPool);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.restoreAllMocks();
  });

  test('should return true when database query returns records', async () => {
    mockRequestFunc.mockImplementation(() => ({
      input: vi.fn(),
      query: vi.fn().mockResolvedValue({ recordset: [{ id: 1 }] }),
    }));

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(true);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockCloseFunc).toHaveBeenCalled();
  });

  test('should return false when database query returns no records', async () => {
    mockRequestFunc.mockImplementation(() => ({
      input: vi.fn(),
      query: vi.fn().mockResolvedValue({ recordset: [] }),
    }));

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(false);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockCloseFunc).toHaveBeenCalled();
  });

  test('should handle errors and return false', async () => {
    const error = new Error('Database connection error');
    mockConnect.mockRejectedValueOnce(error);

    // Mock the logger.error method
    const loggerErrorSpy = vi.spyOn(context.logger, 'error');

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(false);
    expect(mockConnect).toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('HEALTHCHECK-SQL-DB', error.message, error);
  });
});
