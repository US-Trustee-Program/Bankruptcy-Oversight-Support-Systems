import { executeQuery } from '../utils/database';
import { QueryResults, IDbConfig } from '../types/database';
const functionContext = require('azure-function-context-mock');
import { applicationContextCreator } from '../utils/application-context-creator';
import { ConnectionError, MSSQLError, RequestError } from 'mssql';

// Setting default Jest mocks for mssql
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
      request: mockRequest,
      close: mockClose,
    }),
);
jest.mock('mssql', () => {
  return {
    ConnectionError: jest.fn().mockReturnValue(connectionError),
    RequestError: jest.fn().mockReturnValue(requestError),
    MSSQLError: jest.fn().mockReturnValue(mssqlError),
    ConnectionPool: jest.fn().mockImplementation(() => {
      return {
        connect: mockConnect,
      };
    }),
  };
});

describe('Tests database client exceptions', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('should handle known mssql MSSQLError exceptions', async () => {
    const expectedErrorMessage = 'Test MSSQLError exception';
    const context = await applicationContextCreator(functionContext);
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
    const context = await applicationContextCreator(functionContext);
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
      message: '',
      name: 'AggregateError',
      errors: [
        { message: 'Something happen 01', name: '01', code: '' } as MSSQLError,
        {
          message: 'Something happen 02',
          name: '02',
          code: '',
          originalError: {
            name: '03',
            message: 'Nested aggregate errors',
            errors: [
              { message: 'Nested aggregate error 04', name: '04', code: '' } as MSSQLError,
              { message: 'Nested aggregate error 05', name: '05', code: '' } as MSSQLError,
            ],
          } as AggregateError,
        } as ConnectionError,
      ],
    } as AggregateError;
    mockConnect.mockImplementation(() => {
      throw connectionError;
    });

    const context = await applicationContextCreator(functionContext);
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
