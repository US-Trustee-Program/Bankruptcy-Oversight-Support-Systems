import { executeQuery } from '../utils/database';
import { QueryResults, IDbConfig } from '../types/database';
const context = require('azure-function-context-mock');
import { applicationContextCreator } from '../utils/application-context-creator';

const appContext = applicationContextCreator(context);

type sqlConnect = {
  request: () => void;
  close: () => void;
  query: () => void;
};

function mssqlMock() {
  return class ConnectionPool {
    public connect = jest.fn().mockImplementation(
      (): Promise<sqlConnect> =>
        Promise.resolve({
          request: jest.fn().mockImplementation(() => ({
            input: jest.fn(),
          })),
          close: jest.fn(),
          query: jest
            .fn()
            .mockImplementation((): Promise<string> => Promise.resolve('test string')),
        }),
    );
  };
}

describe('Tests database', () => {
  test('???', async () => {
    // setup test
    jest.mock('mssql', mssqlMock);

    // execute method under test
    const context = appContext;
    const config = { server: 'foo' } as IDbConfig;
    const query = 'SELECT * FROM foo WHERE data = @param1 AND name=@param2';
    const input = [
      {
        name: 'param1',
        type: null,
        value: 'dataValue',
      },
      {
        name: 'param2',
        type: null,
        value: 'nameValue',
      },
    ];
    const queryResult: QueryResults = await executeQuery(context, config, query, input);

    // assert
    console.log(queryResult);
  });
});
