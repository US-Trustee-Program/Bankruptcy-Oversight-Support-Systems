import { vi } from 'vitest';
import { IDbConfig } from '../types/database';
import { ConnectionError, MSSQLError, RequestError } from 'mssql';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AbstractMssqlClient } from './abstract-mssql-client';
import { ApplicationContext } from '../types/basic';

// Setting default Vitest mocks for mssql
//NOTE: using const here causes these tests to error out with 'Cannot access {var} before initialization
// eslint-disable-next-line no-var
var connectionError = new ConnectionError('');
// eslint-disable-next-line no-var
var requestError = new RequestError('');
// eslint-disable-next-line no-var
var mssqlError = new MSSQLError('');

type AggregateError = Error & {
  errors?: Error[];
};

const mockClose = vi.fn();
const mockConnectionPoolClose = vi.fn();
const mockQuery = vi.fn();
const mockRequest = vi.fn().mockImplementation(() => ({
  input: vi.fn(),
  query: mockQuery,
}));
const mockConnect = vi.fn().mockImplementation(
  (): Promise<unknown> =>
    Promise.resolve({
      request: mockRequest,
      close: mockClose,
    }),
);
vi.mock('mssql', () => {
  return {
    ConnectionError: vi.fn().mockReturnValue(connectionError),
    RequestError: vi.fn().mockReturnValue(requestError),
    MSSQLError: vi.fn().mockReturnValue(mssqlError),
    ConnectionPool: vi.fn().mockImplementation(() => {
      return {
        close: mockConnectionPoolClose,
        connect: mockConnect,
        request: mockRequest,
      };
    }),
  };
});

class MssqlClient extends AbstractMssqlClient {
  constructor(_context: ApplicationContext) {
    const config = { server: 'foo' } as IDbConfig;
    super(config, 'Exception Tests');
  }
}

describe('Tests database client exceptions', () => {
  let client: MssqlClient;
  let context: ApplicationContext;

  beforeEach(async () => {
    vi.resetModules();
    context = await createMockApplicationContext();
    client = new MssqlClient(context);
  });

  test('should rethrow miscelaneous mssql error exceptions', async () => {
    const expectedErrorMessage = 'Test request error exception';
    const requestError = new RequestError(expectedErrorMessage);
    requestError.name = 'RequestError';
    requestError.code = '';
    requestError.message = expectedErrorMessage;
    mockRequest.mockImplementation(() => {
      throw requestError;
    });

    // method under test
    await expect(async () => {
      await client.executeQuery(context, 'SELECT * FROM bar', []);
    }).rejects.toThrow(expectedErrorMessage);
  });

  test('should handle known mssql MSSQLError exceptions', async () => {
    const expectedErrorMessage = 'Test MSSQLError exception';
    const requestError = new RequestError(expectedErrorMessage);
    requestError.name = 'RequestError';
    requestError.code = '';
    requestError.message = expectedErrorMessage;
    mockRequest.mockImplementation(() => {
      const mssqlError = new MSSQLError({
        name: '',
        message: '',
      });
      // not totally sure why I have to set the error in this way to get it to work.
      mssqlError.name = 'TestMSSQLMessage';
      mssqlError.message = expectedErrorMessage;
      mssqlError.code = '1';
      mssqlError.originalError = { message: 'original error', name: 'originalError' };
      throw mssqlError;
    });

    // method under test
    await expect(async () => {
      await client.executeQuery(context, 'SELECT * FROM bar', []);
    }).rejects.toThrow(expectedErrorMessage);
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
    await expect(async () => {
      await client.executeQuery(context, 'SELECT * FROM bar', []);
    }).rejects.toThrow(expectedErrorMessage);
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
          errors: [
            {
              message: 'Agreggate error sub error 1',
              name: '02.1',
              code: '',
            },
          ],
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

    const context = await createMockApplicationContext();
    // method under test
    await expect(async () => {
      await client.executeQuery(context, 'SELECT * FROM bar', []);
    }).rejects.toThrow(expectedErrorMessage);
  });
});
