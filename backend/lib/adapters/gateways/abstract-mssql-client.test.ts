import { vi, describe, test, expect, beforeEach } from 'vitest';
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

const mockTransactionRequest = vi.fn().mockImplementation(() => ({
  input: vi.fn(),
  query: vi.fn().mockResolvedValue({ recordset: [] }),
}));

const mockTransaction = {
  begin: vi.fn().mockResolvedValue(undefined),
  commit: vi.fn().mockResolvedValue(undefined),
  rollback: vi.fn().mockResolvedValue(undefined),
  request: mockTransactionRequest,
};

vi.mock('mssql', async (importOriginal) => {
  const actual = await importOriginal<typeof import('mssql')>();
  return {
    ...actual,
    ConnectionPool: vi.fn().mockImplementation(function () {
      return {
        connect: vi.fn().mockImplementation((): Promise<sqlConnect> =>
          Promise.resolve({
            request: vi.fn().mockImplementation(() => ({
              input: vi.fn(),
              query: vi
                .fn()
                .mockImplementation((): Promise<IResult<string>> =>
                  Promise.resolve({ recordset: 'test string' } as unknown as IResult<string>),
                ),
            })),
            close: vi.fn(),
            query: vi
              .fn()
              .mockImplementation((): Promise<string> =>
                Promise.resolve("this is not the string you're looking for"),
              ),
          }),
        ),
        request: vi.fn().mockImplementation(() => ({
          input: vi.fn(),
          query: vi
            .fn()
            .mockImplementation((): Promise<IResult<string>> =>
              Promise.resolve({ recordset: 'test string' } as unknown as IResult<string>),
            ),
        })),
        transaction: vi.fn().mockReturnValue(mockTransaction),
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

    expect(queryResult).toEqual({
      results: { recordset: 'test string' },
      message: '',
      success: true,
    });
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

describe('AbstractMssqlClient.withTransaction', () => {
  let client: TestDbClient;
  let context: ApplicationContext;

  beforeEach(async () => {
    context = await createMockApplicationContext();
    client = new TestDbClient(context, context.config.dxtrDbConfig, 'TX_TEST');
    mockTransaction.begin.mockReset().mockResolvedValue(undefined);
    mockTransaction.commit.mockReset().mockResolvedValue(undefined);
    mockTransaction.rollback.mockReset().mockResolvedValue(undefined);
    mockTransactionRequest.mockReset().mockImplementation(() => ({
      input: vi.fn(),
      query: vi.fn().mockResolvedValue({ recordset: [] }),
    }));
  });

  test('commits when callback resolves successfully', async () => {
    await client.withTransaction(context, async (_tx) => {
      return 'result';
    });

    expect(mockTransaction.begin).toHaveBeenCalledOnce();
    expect(mockTransaction.commit).toHaveBeenCalledOnce();
    expect(mockTransaction.rollback).not.toHaveBeenCalled();
  });

  test('returns the value resolved by the callback', async () => {
    const result = await client.withTransaction(context, async (_tx) => {
      return 42;
    });

    expect(result).toBe(42);
  });

  test('rolls back and throws a CamsError when callback throws', async () => {
    const cause = new Error('query failed');

    await expect(
      client.withTransaction(context, async (_tx) => {
        throw cause;
      }),
    ).rejects.toMatchObject({ isCamsError: true });

    expect(mockTransaction.rollback).toHaveBeenCalledOnce();
    expect(mockTransaction.commit).not.toHaveBeenCalled();
  });

  test('rolls back and throws a CamsError when commit fails', async () => {
    mockTransaction.commit.mockRejectedValue(new Error('commit failed'));

    await expect(
      client.withTransaction(context, async (_tx) => {
        return 'ok';
      }),
    ).rejects.toMatchObject({ isCamsError: true });

    expect(mockTransaction.rollback).toHaveBeenCalledOnce();
  });

  test('includes operation name and context data in error log when provided', async () => {
    const errorSpy = vi.spyOn(context.logger, 'error');

    await expect(
      client.withTransaction(
        context,
        async (_tx) => {
          throw new Error('query failed');
        },
        { operationName: 'upsertCmmapCamsRow', logContext: { caseId: '081-24-12345' } },
      ),
    ).rejects.toMatchObject({ isCamsError: true });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TX_TEST'),
      expect.stringContaining('upsertCmmapCamsRow'),
      expect.objectContaining({ caseId: '081-24-12345' }),
    );
  });

  test('logs a structured error when the callback throws', async () => {
    const errorSpy = vi.spyOn(context.logger, 'error');
    const cause = new Error('query failed');

    await expect(
      client.withTransaction(context, async (_tx) => {
        throw cause;
      }),
    ).rejects.toThrow();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TX_TEST'),
      'query failed',
      expect.objectContaining({ error: expect.objectContaining({ message: 'query failed' }) }),
    );
  });

  test('logs a structured error when commit fails', async () => {
    const errorSpy = vi.spyOn(context.logger, 'error');
    mockTransaction.commit.mockRejectedValue(new Error('commit failed'));

    await expect(
      client.withTransaction(context, async (_tx) => {
        return 'ok';
      }),
    ).rejects.toMatchObject({ isCamsError: true });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TX_TEST'),
      'commit failed',
      expect.objectContaining({ error: expect.objectContaining({ message: 'commit failed' }) }),
    );
  });

  test('re-throws original error and logs rollback failure when rollback also throws', async () => {
    const originalError = new Error('query failed');
    const rollbackError = new Error('rollback failed');
    mockTransaction.rollback.mockRejectedValue(rollbackError);
    const errorSpy = vi.spyOn(context.logger, 'error');

    await expect(
      client.withTransaction(context, async (_tx) => {
        throw originalError;
      }),
    ).rejects.toMatchObject({ isCamsError: true });

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('TX_TEST'),
      expect.stringContaining('rollback'),
      expect.objectContaining({ rollbackError }),
    );
  });

  test('exposes a request on the transaction context', async () => {
    let capturedRequest: unknown;

    await client.withTransaction(context, async (tx) => {
      capturedRequest = tx.request();
    });

    expect(capturedRequest).toBeDefined();
    expect(mockTransactionRequest).toHaveBeenCalled();
  });
});
