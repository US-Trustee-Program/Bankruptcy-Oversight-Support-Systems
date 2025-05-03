import { IResult } from 'mssql';

import { createMockApplicationContext } from '../../testing/testing-utilities';
import { ApplicationContext } from '../types/basic';
import { IDbConfig, QueryResults } from '../types/database';
import { AbstractMssqlClient } from './abstract-mssql-client';

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
                  .mockImplementation(
                    (): Promise<IResult<string>> =>
                      Promise.resolve({ recordset: 'test string' } as unknown as IResult<string>),
                  ),
              })),
            }),
        ),
        request: jest.fn().mockImplementation(() => ({
          input: jest.fn(),
          query: jest
            .fn()
            .mockImplementation(
              (): Promise<IResult<string>> =>
                Promise.resolve({ recordset: 'test string' } as unknown as IResult<string>),
            ),
        })),
      };
    }),
  };
});

describe('Abstract MS-SQL client', () => {
  test('should get appropriate results', async () => {
    const applicationContext = await createMockApplicationContext();
    // setup test
    // execute method under test
    const context = applicationContext;
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
    class TestDbClient extends AbstractMssqlClient {
      constructor(_context: ApplicationContext, config: IDbConfig, childModuleName: string) {
        super(config, childModuleName);
      }
    }
    const client = new TestDbClient(context, context.config.dxtrDbConfig, 'TEST_MODULE');
    const queryResult: QueryResults = await client.executeQuery<string>(context, query, input);

    // assert
    expect(queryResult).toEqual({ message: '', results: 'test string', success: true });
  });
});
