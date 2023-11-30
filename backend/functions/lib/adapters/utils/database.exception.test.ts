import { executeQuery } from '../utils/database';
import { QueryResults, IDbConfig } from '../types/database';
const functionContext = require('azure-function-context-mock');
import { applicationContextCreator } from '../utils/application-context-creator';
import { ConnectionError, RequestError } from 'mssql';

describe('Tests database client exceptions', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('should handle known mssql MSSQLError exceptions', async () => {
    const expectedErrorMessage = 'Test MSSQLError exception';
    const context = await applicationContextCreator(functionContext);
    const mockFuncConnect = jest.fn().mockImplementation(() => {
      throw new RequestError(expectedErrorMessage);
    });
    const mockFuncConnectionPool = jest.fn().mockImplementation(() => {
      return {
        connect: mockFuncConnect,
      };
    });
    jest.mock('mssql', () => {
      return {
        ConnectionPool: mockFuncConnectionPool,
      };
    });

    // method under test
    const queryResult: QueryResults = await executeQuery(
      context,
      { server: 'foo' } as IDbConfig,
      'SELECT * FROM bar',
      [],
    );

    expect(mockFuncConnect).toThrow(expectedErrorMessage);
    expect(queryResult.success).toBeFalsy();
  });

  test('should handle known mssql ConnectionError exceptions', async () => {
    const expectedErrorMessage = 'Test ConnectionError exception';
    const context = await applicationContextCreator(functionContext);
    const mockFuncConnect = jest.fn().mockImplementation(() => {
      throw new ConnectionError(expectedErrorMessage);
    });
    const mockFuncConnectionPool = jest.fn().mockImplementation(() => {
      return {
        connect: mockFuncConnect,
      };
    });
    jest.mock('mssql', () => {
      return {
        ConnectionPool: mockFuncConnectionPool,
      };
    });

    // method under test
    const queryResult: QueryResults = await executeQuery(
      context,
      { server: 'foo' } as IDbConfig,
      'SELECT * FROM bar',
      [],
    );
    expect(mockFuncConnect).toThrow(expectedErrorMessage);
    expect(queryResult.success).toBeFalsy();
  });

  test('should handle known mssql ConnectionError exceptions with AggregateErrors', async () => {
    const expectedErrorMessage = 'Test ConnectionError exception with AggregateErrors';
    const context = await applicationContextCreator(functionContext);

    const mockFuncConnect = jest.fn().mockImplementation((): Promise<unknown> => {
      const connectionError = new Error(expectedErrorMessage) as ConnectionError;
      connectionError.code = '';
      connectionError.name = 'ConnectionError';
      connectionError.originalError = {
        message: '',
        name: 'AggregateError',
        errors: [
          { message: 'Something happen 01', name: '01', code: '' } as Error,
          { message: 'Something happen 02', name: '02', code: '' } as Error,
        ],
      } as AggregateError;
      throw connectionError;
    });
    const mockFunctionConnectionPool = jest.fn().mockImplementation(() => {
      return {
        connect: mockFuncConnect,
      };
    });
    jest.mock('mssql', () => {
      return {
        ConnectionPool: mockFunctionConnectionPool,
      };
    });

    // method under test
    const queryResult: QueryResults = await executeQuery(
      context,
      { server: 'foo' } as IDbConfig,
      'SELECT * FROM bar',
      [],
    );

    expect(mockFuncConnect).toThrow(expectedErrorMessage);
    expect(queryResult.success).toBeFalsy();
  });
});

type AggregateError = Error & {
  errors?: Error[];
};
