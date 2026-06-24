import { config, ConnectionError, ConnectionPool, MSSQLError, IResult, Request } from 'mssql';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';
import { deferClose } from '../../deferrable/defer-close';
import { ApplicationContext } from '../types/basic';
import { getCamsError } from '../../common-errors/error-utilities';

export abstract class AbstractMssqlClient {
  private static readonly connectionPools: Map<string, ConnectionPool> = new Map();
  private readonly moduleName: string;
  private readonly poolKey: string;

  protected constructor(dbConfig: IDbConfig, childModuleName: string) {
    this.moduleName = `ABSTRACT-MSSQL-CLIENT (${childModuleName})`;
    this.poolKey = `${dbConfig.server}:${dbConfig.port}:${dbConfig.database}`;
    if (!AbstractMssqlClient.connectionPools.has(this.poolKey)) {
      const pool = new ConnectionPool(dbConfig as config);
      AbstractMssqlClient.connectionPools.set(this.poolKey, pool);
      deferClose(pool);
    }
  }

  public async withTransaction<T>(
    context: ApplicationContext,
    fn: (tx: { request(): Request }) => Promise<T>,
    options?: { operationName?: string; logContext?: Record<string, unknown> },
  ): Promise<T> {
    const connectionPool = AbstractMssqlClient.connectionPools.get(this.poolKey);
    if (!connectionPool.connected) {
      await connectionPool.connect();
    }
    const transaction = connectionPool.transaction();
    await transaction.begin();
    try {
      const result = await fn({ request: () => transaction.request() });
      await transaction.commit();
      return result;
    } catch (error) {
      try {
        await transaction.rollback();
      } catch (rollbackError) {
        context.logger.error(this.moduleName, 'rollback failed after error', { rollbackError });
      }
      const unknownError =
        error instanceof Error
          ? error
          : new Error((error as { message?: string }).message ?? String(error));
      const label = options?.operationName ?? unknownError.message;
      const detail = { ...options?.logContext, error: unknownError };
      context.logger.error(this.moduleName, label, detail);
      throw getCamsError(unknownError, this.moduleName);
    }
  }

  public async executeQuery<T = unknown>(
    context: ApplicationContext,
    query: string,
    input?: DbTableFieldSpec[],
    requestTimeout?: number,
  ): Promise<QueryResults> {
    const connectionPool = AbstractMssqlClient.connectionPools.get(this.poolKey);
    try {
      if (!connectionPool.connected) {
        await connectionPool.connect();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const request = (connectionPool as any).request(
        requestTimeout !== undefined ? { requestTimeout } : undefined,
      );

      if (input !== undefined) {
        input.forEach((item) => {
          request.input(item.name, item.type, item.value);
        });
      }
      const result = (await request.query(query)) as IResult<T>;

      return {
        results: result,
        message: '',
        success: true,
      };
    } catch (error) {
      const unknownError =
        error instanceof Error
          ? error
          : new Error((error as { message?: string }).message ?? String(error));

      if (isConnectionError(error)) {
        const errorMessages: string[] = [];
        // No recursive function here. Limiting this to just 2 "errors" lists deep.
        if (isAggregateError(error.originalError)) {
          error.originalError.errors?.reduce((acc, e) => {
            if (isAggregateError(e)) {
              e.errors?.forEach((lowestE) => {
                acc.push(lowestE.message);
              });
            } else {
              acc.push(e.message);
            }
            return acc;
          }, errorMessages);
        }
        errorMessages.push(error.message);
        context.logger.error(this.moduleName, 'ConnectionError', { errorMessages });
      } else if (isMssqlError(error)) {
        const newError = {
          error: {
            name: error.name,
            description: error.message,
          },
          originalError: {},
          query,
          input,
        };
        if (error.originalError) {
          newError.originalError = {
            name: error.originalError.name,
            description: error.originalError.message,
          };
        }

        context.logger.error(this.moduleName, 'MssqlError', newError);
      } else {
        context.logger.error(this.moduleName, unknownError.message, { error, query, input });
      }

      throw getCamsError(unknownError, this.moduleName);
    }
  }
}

function isMssqlError(e: unknown): e is MSSQLError {
  return e instanceof MSSQLError;
}

function isConnectionError(e: unknown): e is ConnectionError {
  return e instanceof ConnectionError;
}

type AggregateError = Error & {
  errors?: Error[];
};

function isAggregateError(e: unknown): e is AggregateError {
  return !!e && 'errors' in (e as object);
}
