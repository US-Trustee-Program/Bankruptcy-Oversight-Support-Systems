import { config, ConnectionError, ConnectionPool, MSSQLError, IResult } from 'mssql';
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

  public async executeQuery<T = unknown>(
    context: ApplicationContext,
    query: string,
    input?: DbTableFieldSpec[],
  ): Promise<QueryResults> {
    const connectionPool = AbstractMssqlClient.connectionPools.get(this.poolKey);
    try {
      if (!connectionPool.connected) {
        await connectionPool.connect();
      }
      const request = connectionPool.request();

      if (input !== undefined) {
        input.forEach((item) => {
          request.input(item.name, item.type, item.value);
        });
      }
      const result = (await request.query(query)) as IResult<T>;

      return {
        results: result.recordset,
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
