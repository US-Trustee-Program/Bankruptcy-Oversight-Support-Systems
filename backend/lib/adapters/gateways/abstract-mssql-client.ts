import { config, ConnectionError, ConnectionPool, IResult, MSSQLError } from 'mssql';

import { getCamsError } from '../../common-errors/error-utilities';
import { deferClose } from '../../deferrable/defer-close';
import { ApplicationContext } from '../types/basic';
import { DbTableFieldSpec, IDbConfig, QueryResults } from '../types/database';

type AggregateError = Error & {
  errors?: Error[];
};

export abstract class AbstractMssqlClient {
  private static connectionPool: ConnectionPool;
  private readonly moduleName: string;

  protected constructor(dbConfig: IDbConfig, childModuleName: string) {
    this.moduleName = `ABSTRACT-MSSQL-CLIENT (${childModuleName})`;
    if (!AbstractMssqlClient.connectionPool) {
      AbstractMssqlClient.connectionPool = new ConnectionPool(dbConfig as config);
      deferClose(AbstractMssqlClient.connectionPool);
    }
  }

  public async executeQuery<T = unknown>(
    context: ApplicationContext,
    query: string,
    input?: DbTableFieldSpec[],
  ): Promise<QueryResults> {
    try {
      if (!AbstractMssqlClient.connectionPool.connected) {
        await AbstractMssqlClient.connectionPool.connect();
      }
      const request = AbstractMssqlClient.connectionPool.request();

      if (typeof input != 'undefined') {
        input.forEach((item) => {
          request.input(item.name, item.type, item.value);
        });
      }
      const result = (await request.query(query)) as IResult<T>;

      const queryResults: QueryResults = {
        message: '',
        results: result.recordset,
        success: true,
      };

      return queryResults;
    } catch (error) {
      if (isConnectionError(error)) {
        const errorMessages = [];
        // No recursive function here. Limiting this to just 2 "errors" lists deep.
        if (isAggregateError(error.originalError)) {
          error.originalError.errors.reduce((acc, e) => {
            if (isAggregateError(e)) {
              e.errors.forEach((lowestE) => {
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
            description: error.message,
            name: error.name,
          },
          input,
          originalError: {},
          query,
        };
        if (error.originalError) {
          newError.originalError = {
            description: error.originalError.name,
            name: error.originalError.name,
          };
        }

        context.logger.error(this.moduleName, 'MssqlError', newError);
      } else {
        context.logger.error(this.moduleName, error.message, { error, input, query });
      }

      throw getCamsError(error, this.moduleName, error.message);
    }
  }
}

function isAggregateError(e: unknown): e is AggregateError {
  return e && 'errors' in (e as object);
}

function isConnectionError(e): e is ConnectionError {
  return e instanceof ConnectionError;
}

function isMssqlError(e): e is MSSQLError {
  return e instanceof MSSQLError;
}
