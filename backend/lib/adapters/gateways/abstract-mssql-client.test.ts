import { vi } from 'vitest';
import { QueryResults, IDbConfig, DbTableFieldSpec } from '../types/database';
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

class TestDbClient extends AbstractMssqlClient {
  constructor(_context: ApplicationContext, config: IDbConfig, childModuleName: string) {
    super(config, childModuleName);
  }
}

describe('Abstract MS-SQL client', () => {
  test('should get appropriate results', async () => {
    const context = await createMockApplicationContext();
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
    ] as unknown as DbTableFieldSpec[];

    const client = new TestDbClient(context, context.config.dxtrDbConfig, 'TEST_MODULE');
    const queryResult: QueryResults = await client.executeQuery<string>(context, query, input);

    expect(queryResult).toEqual({ results: 'test string', message: '', success: true });
  });

  test('should use separate connection pools for clients with different database configs', async () => {
    const { ConnectionPool } = await import('mssql');
    const mockConnectionPool = vi.mocked(ConnectionPool);
    mockConnectionPool.mockClear();

    const context = await createMockApplicationContext();
    const configA: IDbConfig = { ...context.config.dxtrDbConfig, database: 'DATABASE_A' };
    const configB: IDbConfig = { ...context.config.dxtrDbConfig, database: 'DATABASE_B' };

    new TestDbClient(context, configA, 'CLIENT_A');
    new TestDbClient(context, configB, 'CLIENT_B');

    expect(mockConnectionPool).toHaveBeenCalledTimes(2);
  });

  test('should reuse the same connection pool for clients with the same database config', async () => {
    const { ConnectionPool } = await import('mssql');
    const mockConnectionPool = vi.mocked(ConnectionPool);
    mockConnectionPool.mockClear();

    const context = await createMockApplicationContext();
    const config: IDbConfig = { ...context.config.dxtrDbConfig, database: 'SHARED_DATABASE' };

    new TestDbClient(context, config, 'CLIENT_1');
    new TestDbClient(context, config, 'CLIENT_2');

    expect(mockConnectionPool).toHaveBeenCalledTimes(1);
  });
});
