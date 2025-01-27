import { executeQuery } from './database';
import { QueryResults, IDbConfig } from '../types/database';
import { createMockApplicationContext } from '../../testing/testing-utilities';

type sqlConnect = {
  request: () => void;
  close: () => void;
  query: () => void;
};

jest.mock('mssql', () => {
  return {
    ConnectionPool: jest.fn().mockImplementation(() => {
      return {
        request: jest.fn().mockImplementation(() => ({
          input: jest.fn(),
          query: jest
            .fn()
            .mockImplementation((): Promise<string> => Promise.resolve('test string')),
        })),
        connect: jest.fn().mockImplementation(
          (): Promise<sqlConnect> =>
            Promise.resolve({
              request: jest.fn().mockImplementation(() => ({
                input: jest.fn(),
                query: jest
                  .fn()
                  .mockImplementation((): Promise<string> => Promise.resolve('test string')),
              })),
              close: jest.fn(),
              query: jest
                .fn()
                .mockImplementation(
                  (): Promise<string> =>
                    Promise.resolve("this is not the string you're looking for"),
                ),
            }),
        ),
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
    expect(queryResult).toEqual({ results: 'test string', message: '', success: true });
  });
});
