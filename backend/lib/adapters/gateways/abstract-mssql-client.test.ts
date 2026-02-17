import { vi } from 'vitest';
import { QueryResults, IDbConfig } from '../types/database';
import { createMockApplicationContext } from '../../testing/testing-utilities';
import { AbstractMssqlClient } from './abstract-mssql-client';
import { ApplicationContext } from '../types/basic';
import { IResult } from 'mssql';

type sqlConnect = {
  request: () => void;
  close: () => void;
  query: () => void;
};

vi.mock('mssql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mssql')>();
  return {
    ...actual,
    ConnectionPool: vi.fn().mockImplementation(function () {
      return {
        connect: vi.fn().mockImplementation(
          (): Promise<sqlConnect> =>
            Promise.resolve({
              request: vi.fn().mockImplementation(() => ({
                input: vi.fn(),
                query: vi
                  .fn()
                  .mockImplementation(
                    (): Promise<IResult<string>> =>
                      Promise.resolve({ recordset: 'test string' } as unknown as IResult<string>),
                  ),
              })),
              close: vi.fn(),
              query: vi
                .fn()
                .mockImplementation(
                  (): Promise<string> =>
                    Promise.resolve("this is not the string you're looking for"),
                ),
            }),
        ),
        request: vi.fn().mockImplementation(() => ({
          input: vi.fn(),
          query: vi
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
    expect(queryResult).toEqual({ results: 'test string', message: '', success: true });
  });
});
