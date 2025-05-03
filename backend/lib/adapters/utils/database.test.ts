import { createMockApplicationContext } from '../../testing/testing-utilities';
import { IDbConfig, QueryResults } from '../types/database';
import { executeQuery } from './database';

type sqlConnect = {
  close: () => void;
  query: () => void;
  request: () => void;
};

jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn().mockImplementation(() => {
      return {
        connect: jest.fn().mockImplementation(
          (): Promise<sqlConnect> =>
            Promise.resolve({
              close: jest.fn(),
              query: jest
                .fn()
                .mockImplementation(
                  (): Promise<string> =>
                    Promise.resolve("this is not the string you're looking for"),
                ),
              request: jest.fn().mockImplementation(() => ({
                input: jest.fn(),
                query: jest
                  .fn()
                  .mockImplementation((): Promise<string> => Promise.resolve('test string')),
              })),
            }),
        ),
        request: jest.fn().mockImplementation(() => ({
          input: jest.fn(),
          query: jest
            .fn()
            .mockImplementation((): Promise<string> => Promise.resolve('test string')),
        })),
      };
    }),
  };
});

describe('Tests database', () => {
  test('should get appropriate results', async () => {
    const applicationContext = await createMockApplicationContext();
    // setup test
    // execute method under test
    const context = applicationContext;
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

    // execute method under test
    const queryResult: QueryResults = await executeQuery(context, config, query, input);

    // assert
    expect(queryResult).toEqual({ message: '', results: 'test string', success: true });
  });
});
