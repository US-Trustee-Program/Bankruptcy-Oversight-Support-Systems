import { vi } from 'vitest';
import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { closeDeferred } from '../../../lib/deferrable/defer-close';

import HealthcheckSqlDb from './healthcheck.db.sql';

const mockRequestFunc = vi.fn().mockImplementation(() => ({
  input: vi.fn(),
  query: vi.fn().mockResolvedValue({ recordset: [{ id: 1 }] }),
}));
const mockCloseFunc = vi.fn();
const mockConnect = vi.fn().mockImplementation(
  (): Promise<unknown> =>
    Promise.resolve({
      request: mockRequestFunc,
      close: mockCloseFunc,
    }),
);

vi.mock('mssql', () => {
  return {
    ConnectionPool: vi.fn().mockImplementation(() => {
      return {
        connect: mockConnect,
      };
    }),
  };
});

describe('healthcheck.db.sql', () => {
  let context: ApplicationContext;
  let healthcheckSqlDb: HealthcheckSqlDb;

  beforeAll(async () => {
    context = await createMockApplicationContext();
    healthcheckSqlDb = new HealthcheckSqlDb(context);
  });

  afterEach(async () => {
    await closeDeferred(context);
    vi.clearAllMocks();
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
