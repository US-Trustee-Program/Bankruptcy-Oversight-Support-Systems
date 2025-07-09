import { ApplicationContext } from '../../../lib/adapters/types/basic';
import { createMockApplicationContext } from '../../../lib/testing/testing-utilities';
import { closeDeferred } from '../../../lib/deferrable/defer-close';

import HealthcheckSqlDb from './healthcheck.db.sql';

const mockRequestFunc = jest.fn().mockImplementation(() => ({
  input: jest.fn(),
  query: jest.fn().mockResolvedValue({ recordset: [{ id: 1 }] }),
}));
const mockCloseFunc = jest.fn();
const mockConnect = jest.fn().mockImplementation(
  (): Promise<unknown> =>
    Promise.resolve({
      request: mockRequestFunc,
      close: mockCloseFunc,
    }),
);

jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn().mockImplementation(() => {
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
    jest.clearAllMocks();
  });

  test('should return true when database query returns records', async () => {
    mockRequestFunc.mockImplementation(() => ({
      input: jest.fn(),
      query: jest.fn().mockResolvedValue({ recordset: [{ id: 1 }] }),
    }));

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(true);
    expect(mockConnect).toHaveBeenCalled();
    expect(mockCloseFunc).toHaveBeenCalled();
  });

  test('should return false when database query returns no records', async () => {
    mockRequestFunc.mockImplementation(() => ({
      input: jest.fn(),
      query: jest.fn().mockResolvedValue({ recordset: [] }),
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
    const loggerErrorSpy = jest.spyOn(context.logger, 'error');

    const result = await healthcheckSqlDb.checkDxtrDbRead();

    expect(result).toBe(false);
    expect(mockConnect).toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith('HEALTHCHECK-SQL-DB', error.message, error);
  });
});
