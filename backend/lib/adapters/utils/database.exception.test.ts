import { ConnectionError, MSSQLError, RequestError } from 'mssql';

import { createMockApplicationContext } from '../../testing/testing-utilities';
import { IDbConfig, QueryResults } from '../types/database';
import { executeQuery } from './database';

// Setting default Jest mocks for mssql
//NOTE: using const here causes these tests to error out with 'Cannot access {const} before initialization
// eslint-disable-next-line no-var
var connectionError = new ConnectionError('');
// eslint-disable-next-line no-var
var requestError = new RequestError('');
// eslint-disable-next-line no-var
var mssqlError = new MSSQLError('');

const mockClose = jest.fn();
const mockQuery = jest.fn();
const mockRequest = jest.fn().mockImplementation(() => ({
  input: jest.fn(),
  query: mockQuery,
}));
const mockConnect = jest.fn().mockImplementation(
  (): Promise<unknown> =>
    Promise.resolve({
      close: mockClose,
      request: mockRequest,
    }),
);
jest.mock('mssql', () => {
  return {
    ConnectionError: jest.fn().mockReturnValue(connectionError),
    ConnectionPool: jest.fn().mockImplementation(() => {
      return {
        connect: mockConnect,
      };
    }),
    MSSQLError: jest.fn().mockReturnValue(mssqlError),
    RequestError: jest.fn().mockReturnValue(requestError),
  };
});

describe('Tests database client exceptions', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('should handle known mssql MSSQLError exceptions', async () => {
    const expectedErrorMessage = 'Test MSSQLError exception';
    const context = await createMockApplicationContext();
    const requestError = new RequestError(expectedErrorMessage);
    requestError.name = 'RequestError';
    requestError.code = '';
    requestError.message = expectedErrorMessage;
    mockRequest.mockImplementation(() => {
      throw requestError;
    });

    // method under test
    const queryResult: QueryResults = await executeQuery(
      context,
      { server: 'foo' } as IDbConfig,
      'SELECT * FROM bar',
      [],
    );

    expect(mockRequest).toThrow(expectedErrorMessage);
    expect(queryResult.success).toBeFalsy();
  });

  test('should handle known mssql ConnectionError exceptions', async () => {
    const expectedErrorMessage = 'Test ConnectionError exception';
    const context = await createMockApplicationContext();
    const connectionError = new ConnectionError(expectedErrorMessage);
    connectionError.code = '';
    connectionError.name = 'ConnectionError';
    connectionError.message = expectedErrorMessage;
    mockConnect.mockImplementation(() => {
      throw connectionError;
    });

    // method under test
    const queryResult: QueryResults = await executeQuery(
      context,
      { server: 'foo' } as IDbConfig,
      'SELECT * FROM bar',
      [],
    );
    expect(mockConnect).toThrow(expectedErrorMessage);
    expect(queryResult.success).toBeFalsy();
  });

  test('should handle known mssql ConnectionError exceptions with AggregateErrors', async () => {
    const expectedErrorMessage = 'Test ConnectionError exception with AggregateErrors';
    const connectionError = new ConnectionError(expectedErrorMessage);
    connectionError.code = '';
    connectionError.name = 'ConnectionError';
    connectionError.message = expectedErrorMessage;
    connectionError.originalError = {
      errors: [
        { code: '', message: 'Something happen 01', name: '01' } as MSSQLError,
        {
          code: '',
          message: 'Something happen 02',
          name: '02',
          originalError: {
            errors: [
              { code: '', message: 'Nested aggregate error 04', name: '04' } as MSSQLError,
              { code: '', message: 'Nested aggregate error 05', name: '05' } as MSSQLError,
            ],
            message: 'Nested aggregate errors',
            name: '03',
          } as AggregateError,
        } as ConnectionError,
      ],
      message: '',
      name: 'AggregateError',
    } as AggregateError;
    mockConnect.mockImplementation(() => {
      throw connectionError;
    });

    const context = await createMockApplicationContext();
    // method under test
    const queryResult: QueryResults = await executeQuery(
      context,
      { server: 'foo' } as IDbConfig,
      'SELECT * FROM bar',
      [],
    );

    expect(mockConnect).toThrow(expectedErrorMessage);
    expect(queryResult.success).toBeFalsy();
  });
});

type AggregateError = Error & {
  errors?: Error[];
};
