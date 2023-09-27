import { executeQuery } from '../utils/database';
import { QueryResults, IDbConfig } from '../types/database';
// import log from '../services/logger.service';
import { ApplicationContext } from '../types/basic';

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

function logMock() {
  return class log {
    public static info = jest.fn();
    public static error = jest.fn();
  };
}

describe('Tests database', () => {
  test('???', async () => {
    // setup test
    jest.mock('../services/logger.service', logMock);
    jest.mock('mssql', mssqlMock);

    // execute method under test
    const context = {} as ApplicationContext;
    const config = {} as IDbConfig;
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
