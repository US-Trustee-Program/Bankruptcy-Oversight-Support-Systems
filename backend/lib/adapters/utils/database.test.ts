import { vi } from 'vitest';
import { executeQuery } from './database';
import { QueryResults, IDbConfig } from '../types/database';
import { createMockApplicationContext } from '../../testing/testing-utilities';

type sqlConnect = {
  request: () => void;
  close: () => void;
  query: () => void;
};

vi.mock('mssql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mssql')>();
  return {
    ...actual,
    ConnectionPool: vi.fn().mockImplementation(() => {
      return {
        request: vi.fn().mockImplementation(() => ({
          input: vi.fn(),
          query: vi.fn().mockImplementation((): Promise<string> => Promise.resolve('test string')),
        })),
        connect: vi.fn().mockImplementation(
          (): Promise<sqlConnect> =>
            Promise.resolve({
              request: vi.fn().mockImplementation(() => ({
                input: vi.fn(),
                query: vi
                  .fn()
                  .mockImplementation((): Promise<string> => Promise.resolve('test string')),
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
